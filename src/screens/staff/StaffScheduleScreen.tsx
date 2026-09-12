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

type TabKey = 'past' | 'upcoming' | 'completed';

function isPastDue(item: ScheduleItem) {
  if (!item.start_time || item.status === 'completed') return false;
  return new Date(item.start_time).getTime() < Date.now();
}

function isCompleted(item: ScheduleItem) {
  return (item.status || '').toLowerCase() === 'completed';
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
      // One rolling window instead of today + this calendar week. The old pair could
      // not reach past Sunday, so the Upcoming tab was empty for anyone whose next
      // visit was more than a few days out — on a Saturday it could only ever hold
      // the rest of that day. Today's visits are inside this window already.
      const res = await staffApi.staffUpcomingSchedule(token);
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
    });
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
              filtered.map((item) => (
                <View key={item.id} style={styles.row}>
                  <View style={styles.rowMain}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.patient_name || item.title}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {formatWhen(item.start_time)} · {item.status || 'scheduled'}
                    </Text>
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
                    {!isCompleted(item) ? (
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
              ))
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
});
