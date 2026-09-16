import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  AppHeader,
  AppShell,
  LastUpdatedBar,
  SearchBar,
  SegmentTabs,
} from '../../components/chrome';
import { EmptyState, ErrorBanner, LoadingBlock } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';
import type { ScheduleItem } from '../../types';
import { colors } from '../../theme/colors';
import { documentationRouteFor } from '../../utils/visitDocumentation';

type TabKey = 'past' | 'upcoming' | 'completed';

function isDocNeeded(item: ScheduleItem) {
  return item.status === 'document_needed' || !!item.needs_documentation;
}

function isCompleted(item: ScheduleItem) {
  return (item.status || '').toLowerCase() === 'completed' && !isDocNeeded(item);
}

/** Clocked in and not yet clocked out. */
function isInProgress(item: ScheduleItem) {
  return (item.status || '').toLowerCase() === 'in_progress';
}

/**
 * Flagged by the server because the visit's window passed with nobody in attendance.
 *
 * Distinct from past due, which only means the start time has gone by. A missed visit
 * has been determined, needs a reason recorded, and should not read as one more late
 * row in the same list.
 */
function isMissed(item: ScheduleItem) {
  return (item.status || '').toLowerCase() === 'missed_visit';
}

/**
 * Started, and nobody has clocked in yet.
 *
 * Derived on the server so the app and the web dashboard agree on when a visit counts
 * as late. Unlike a missed visit it is not stored — it clears itself the moment
 * somebody clocks in.
 */
function isLate(item: ScheduleItem) {
  return !!item.is_late && !isMissed(item);
}

/** "Late 20m" up to an hour, then "Late 1h 20m" — minutes alone stop meaning much. */
function formatLate(minutes?: number) {
  const m = Math.max(0, minutes ?? 0);

  return m >= 60 ? `Late ${Math.floor(m / 60)}h ${m % 60}m` : `Late ${m}m`;
}

function isPastDue(item: ScheduleItem) {
  if (!item.start_time || isCompleted(item)) return false;

  // A visit being worked on right now is not one that was missed. This filed every
  // clocked-in visit under "Past Due" the moment its start time passed — which used
  // to be hidden, because the status stayed 'scheduled' for the whole visit and
  // nothing could tell the two apart.
  if (isInProgress(item)) return false;

  return new Date(item.start_time.replace(' ', 'T')).getTime() < Date.now();
}

function formatWhen(start?: string) {
  if (!start) return '—';
  const d = new Date(start.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return start;
  return d.toLocaleString([], {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function StaffScheduleScreen() {
  const { token, handleUnauthorized } = useAuth();
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<TabKey>('upcoming');
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      // Rolling 30-day lookback / 60-day lookahead (not a calendar week, so Saturday
      // still includes visits past Sunday). Feeds Past Due, Upcoming, and Completed.
      const res = await staffApi.staffUpcomingSchedule(token, 60, 30);
      const map = new Map<number, ScheduleItem>();
      (res.data || []).forEach((v) => map.set(v.id, v));
      setItems([...map.values()]);
      setUpdatedAt(new Date());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Failed to load schedule');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items;
    if (tab === 'past') list = items.filter(isPastDue);
    if (tab === 'completed') list = items.filter(isCompleted);
    if (tab === 'upcoming') list = items.filter((i) => !isCompleted(i) && !isPastDue(i));
    if (!q) return list;
    return list.filter((i) =>
      `${i.patient_name || ''} ${i.title || ''} ${i.task_type || ''}`.toLowerCase().includes(q),
    );
  }, [items, tab, search]);

  const counts = useMemo(
    () => ({
      past: items.filter(isPastDue).length,
      upcoming: items.filter((i) => !isCompleted(i) && !isPastDue(i)).length,
      completed: items.filter(isCompleted).length,
    }),
    [items],
  );

  const openEvvForVisit = (item: ScheduleItem) => {
    navigation.getParent()?.navigate('Menu', {
      screen: 'MenuEvv',
      params: { scheduleId: item.id },
    });
  };

  const openDocumentation = (item: ScheduleItem) => {
    // An aide's visit gets the aide's form, not the skilled-nursing assessment.
    const screen = documentationRouteFor(item.task_type);

    navigation.navigate(screen, {
      scheduleId: item.id,
      patientId: item.patient_id,
      patientName: item.patient_name,
      startTime: item.start_time,
      ...(screen === 'SkilledNurseVisit' ? { evvFlow: false } : {}),
    } as never);
  };

  return (
    <AppShell>
      <AppHeader
        title="My Schedule"
        actions={[
          {
            icon: 'refresh-outline',
            onPress: () => {
              setRefreshing(true);
              load();
            },
          },
          {
            icon: 'calendar-outline',
            onPress: () => setTab('upcoming'),
          },
        ]}
      />
      <SegmentTabs
        tabs={[
          { key: 'past', label: `Past Due (${counts.past})`, tint: colors.danger },
          { key: 'upcoming', label: `Upcoming (${counts.upcoming})`, tint: colors.brandMagenta },
          { key: 'completed', label: `Completed (${counts.completed})`, tint: colors.success },
        ]}
        value={tab}
        onChange={setTab}
      />
      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder={`Search ${tab === 'past' ? 'Past Due' : tab === 'completed' ? 'Completed' : 'Upcoming'} Tasks`}
      />
      {error ? <ErrorBanner message={error} onRetry={load} /> : null}
      <View style={{ flex: 1 }}>
        {loading ? (
          <LoadingBlock />
        ) : (
          <ScrollView
            contentContainerStyle={filtered.length === 0 ? styles.empty : undefined}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
              />
            }
          >
            {filtered.length === 0 ? (
              <EmptyState
                message={
                  tab === 'past'
                    ? 'No past due tasks found.'
                    : tab === 'completed'
                      ? 'No completed tasks found.'
                      : 'No upcoming tasks found.'
                }
              />
            ) : (
              filtered.map((item) => {
                const docNeeded = isDocNeeded(item);
                const completed = isCompleted(item);
                const inProgress = isInProgress(item);
                const missed = isMissed(item);
                const late = isLate(item);
                return (
                  <View key={item.id} style={[styles.row, late && styles.rowLate, missed && styles.rowMissed]}>
                    <View style={styles.rowMain}>
                      <Text style={styles.name} numberOfLines={1}>
                        {item.patient_name || item.title}
                      </Text>
                      <View style={styles.metaRow}>
                        <Text style={styles.meta} numberOfLines={1}>
                          {formatWhen(item.start_time)} ·{' '}
                        </Text>
                        {missed ? (
                          <View style={styles.missedBadge}>
                            <Ionicons name="close-circle" size={13} color="#fff" />
                            <Text style={styles.missedBadgeText}>Missed Visit</Text>
                          </View>
                        ) : late ? (
                          <View style={styles.lateBadge}>
                            <Ionicons name="time" size={13} color="#854D0E" />
                            <Text style={styles.lateBadgeText}>{formatLate(item.minutes_late)}</Text>
                          </View>
                        ) : docNeeded ? (
                          <Pressable
                            style={styles.docNeededBadge}
                            onPress={() => openDocumentation(item)}
                          >
                            <Ionicons name="alert-circle" size={13} color="#854D0E" />
                            <Text style={styles.docNeededBadgeText}>Document Needed</Text>
                          </Pressable>
                        ) : (
                          <Text style={styles.meta} numberOfLines={1}>
                            {inProgress ? 'In progress' : item.status || 'scheduled'}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.rowActions}>
                      {item.patient_id ? (
                        <Pressable
                          accessibilityLabel="Open patient"
                          hitSlop={8}
                          style={styles.iconBtn}
                          onPress={() =>
                            navigation.navigate('Patients', {
                              screen: 'PatientDetail',
                              params: { patientId: item.patient_id },
                            })
                          }
                        >
                          <Ionicons name="person-outline" size={20} color={colors.brandMagenta} />
                        </Pressable>
                      ) : null}
                      {missed ? (
                        /*
                          A second action, not a replacement for the row's own.
                          Tapping the row still opens EVV, because the commonest
                          correction to a missed flag is "I was there, I just forgot
                          to clock in" — and clocking in clears the flag. Documenting
                          a genuine miss is the deliberate choice, so it gets its own
                          button rather than taking over the obvious one.
                        */
                        <Pressable
                          accessibilityLabel="Document missed visit"
                          style={styles.missedActionBtn}
                          onPress={() =>
                            navigation.navigate('MissedVisitNote', {
                              scheduleId: item.id,
                              patientName: item.patient_name,
                            })
                          }
                        >
                          <Ionicons name="create-outline" size={16} color="#fff" />
                          <Text style={styles.missedActionBtnText}>Document</Text>
                        </Pressable>
                      ) : docNeeded ? (
                        <Pressable
                          accessibilityLabel="Complete documentation"
                          style={styles.docActionBtn}
                          onPress={() => openDocumentation(item)}
                        >
                          <Ionicons name="document-text-outline" size={16} color="#854D0E" />
                          <Text style={styles.docActionBtnText}>Document</Text>
                        </Pressable>
                      ) : inProgress ? (
                        /*
                          A visit under way looks different from one not started. Blue
                          is what "active" means on the EVV screen — the Currently
                          clocked in banner and the Active badge are both #1D4ED8 — so
                          the two screens agree rather than each inventing a colour.
                        */
                        <Pressable
                          accessibilityLabel="Continue visit"
                          style={styles.inProgressActionBtn}
                          onPress={() => openEvvForVisit(item)}
                        >
                          <Ionicons name="time-outline" size={16} color="#1D4ED8" />
                          <Text style={styles.inProgressActionBtnText}>In Visit</Text>
                        </Pressable>
                      ) : !completed ? (
                        <Pressable
                          accessibilityLabel="Complete visit"
                          hitSlop={8}
                          style={[styles.iconBtn, styles.completeBtn]}
                          onPress={() => openEvvForVisit(item)}
                        >
                          <Ionicons name="checkmark" size={18} color="#fff" />
                        </Pressable>
                      ) : (
                        <View style={[styles.iconBtn, styles.doneChip]}>
                          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </View>
      <LastUpdatedBar at={updatedAt} />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  empty: { flexGrow: 1, justifyContent: 'center' },
  /** A determined miss, not just a late start. */
  /** Started with nobody there yet — a warning, not a determination. */
  rowLate: {
    backgroundColor: '#FFFBEB',
    borderLeftWidth: 4,
    borderLeftColor: '#EAB308',
  },
  lateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF08A',
    borderColor: '#EAB308',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  lateBadgeText: { color: '#854D0E', fontSize: 11, fontWeight: '800' },
  rowMissed: {
    backgroundColor: '#FFF5F5',
    borderLeftWidth: 4,
    borderLeftColor: '#C53030',
  },
  missedActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#C53030',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  missedActionBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  missedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#C53030',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  missedBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  row: {
    marginHorizontal: 12,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowMain: { flex: 1, minWidth: 0 },
  name: { fontWeight: '700', color: colors.text, fontSize: 14 },
  meta: { color: colors.textMuted, marginTop: 2, fontSize: 12 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1F5',
  },
  completeBtn: {
    backgroundColor: colors.brandMagenta,
  },
  doneChip: {
    backgroundColor: '#ECFDF5',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 2,
    gap: 4,
  },
  docNeededBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF9C3',
    borderColor: '#FACC15',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  docNeededBadgeText: {
    color: '#854D0E',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  inProgressActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DBEAFE',
    borderColor: '#93C5FD',
    borderWidth: 1.2,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  inProgressActionBtnText: { color: '#1D4ED8', fontSize: 12, fontWeight: '800' },
  docActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF08A',
    borderColor: '#EAB308',
    borderWidth: 1.2,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  docActionBtnText: {
    color: '#854D0E',
    fontSize: 12,
    fontWeight: '800',
  },
});
