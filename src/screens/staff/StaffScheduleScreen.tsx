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
import { scopeLabels } from '../../utils/scopeLabels';
import {
  MonthCalendar,
  monthBounds,
  type CalendarDayState,
  type CalendarMark,
} from '../../components/MonthCalendar';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';
import type { ScheduleItem } from '../../types';
import { colors } from '../../theme/colors';
import { documentationRouteFor } from '../../utils/visitDocumentation';

/**
 * `all` is the Schedule List: every visit in the window, in the order they happen.
 *
 * It sits first because it is the unfiltered thing the other three are filters of —
 * reading the whole schedule should not mean checking three tabs and adding them up.
 */
type TabKey = 'all' | 'past' | 'upcoming' | 'completed';

/**
 * List or calendar.
 *
 * A mode rather than a fourth tab: four segments at this width clip their own labels,
 * and the calendar is a different way of reading the same visits, not a fourth filter
 * alongside Past Due, Upcoming and Completed.
 */
type ViewMode = 'list' | 'calendar';

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

/** The day a visit falls on, as the calendar keys it. */
function dayOf(item: ScheduleItem): string | null {
  if (!item.start_time) return null;
  // The API sends "YYYY-MM-DD HH:MM:SS" in the agency's timezone. Slicing keeps the day
  // the office meant; parsing to a Date would shift it by the device's offset and land
  // some visits on the wrong square.
  return item.start_time.slice(0, 10);
}

/**
 * Which colour a day takes — the worst state on it wins.
 *
 * A day holding four finished visits and one missed one is a day that needs somebody,
 * and showing it green because most of it went well would bury the one that did not.
 */
function dayStateFor(items: ScheduleItem[]): CalendarDayState {
  if (items.some((i) => isMissed(i) || isPastDue(i) || isDocNeeded(i))) return 'attention';
  if (items.some((i) => !isCompleted(i))) return 'scheduled';
  return items.length ? 'done' : 'none';
}

/** "Thursday 17 September" — the selected day, written out above its visits. */
function formatDayHeading(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * The span to fetch for a month.
 *
 * A week either side, because the grid's first and last rows show days from the
 * neighbouring months and a visit on one of them is still a visit the user can see.
 */
function spanForMonth(year: number, monthIndex: number) {
  const { from, to } = monthBounds(year, monthIndex);
  const pad = (iso: string, days: number) => {
    const [y, m, d] = iso.split('-').map(Number);
    const shifted = new Date(y, m - 1, d + days);
    return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(
      shifted.getDate(),
    ).padStart(2, '0')}`;
  };

  return { from: pad(from, -7), to: pad(to, 7) };
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
  const { token, handleUnauthorized, staffUser } = useAuth();
  // "My Schedule" is wrong for a manager: the schedule is the agency's, not theirs.
  const labels = scopeLabels(staffUser);
  const navigation = useNavigation<any>();
  // Opens on the whole schedule. The other three are filters of it, and landing on one
  // of them means the first thing anyone sees is already a subset of their work.
  const [tab, setTab] = useState<TabKey>('all');
  const [mode, setMode] = useState<ViewMode>('list');
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  /*
    Whether this person may book a visit — "Schedule Visits/Activities" in the web app's
    role settings, which the Scheduler role exists to carry.

    Taken from the schedule response rather than the stored login payload, because that
    payload is written once at sign-in and never refreshed: a permission granted this
    morning would stay invisible until the person signed out and back in. Falls back to
    the login value so the button does not flicker in on first load.
  */
  const [canCreate, setCanCreate] = useState(!!staffUser?.can_create_schedules);

  // Which month the calendar is showing, and which day in it is open.
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(
    new Date().toISOString().slice(0, 10),
  );
  const todayIso = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      /*
        Two shapes of request from one screen.

        The lists want a rolling 30-back / 60-ahead window — not a calendar week, so a
        Saturday still shows visits past Sunday. The calendar wants whichever month the
        user turned to, which may be outside that window entirely; asked for explicitly,
        it also pulls a week either side so the grid's leading and trailing cells are not
        blank when they are not empty.
      */
      const res =
        mode === 'calendar'
          ? await staffApi.staffScheduleBetween(token, spanForMonth(viewYear, viewMonth))
          : await staffApi.staffUpcomingSchedule(token, 60, 30);

      const map = new Map<number, ScheduleItem>();
      (res.data || []).forEach((v) => map.set(v.id, v));
      setItems([...map.values()]);
      if (typeof res.can_create_schedules === 'boolean') setCanCreate(res.can_create_schedules);
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
  }, [token, handleUnauthorized, mode, viewYear, viewMonth]);

  /*
    Reruns on focus, and also when the month or the view mode changes, because load()
    closes over both. The full-screen spinner is held back once there is something on screen: paging
    to the next month should leave the grid in place while its counts refresh, not blank
    the calendar the user is reading.
  */
  useFocusEffect(
    useCallback(() => {
      setRefreshing(true);
      load();
    }, [load]),
  );

  /**
   * What the calendar shows: everything except past due.
   *
   * Past due has its own tab, which is where it gets worked. Repeating those visits on
   * the grid meant every earlier day carried a count of work that is really sitting in
   * one list, and the calendar stopped answering the question it is for — what is booked,
   * and what still has to be covered.
   */
  const calendarItems = useMemo(() => items.filter((i) => !isPastDue(i)), [items]);

  /** Visits per day for the month grid, and the worst state on each. */
  const marks = useMemo(() => {
    const byDay = new Map<string, ScheduleItem[]>();

    calendarItems.forEach((i) => {
      const day = dayOf(i);
      if (!day) return;
      byDay.set(day, [...(byDay.get(day) ?? []), i]);
    });

    const out: Record<string, CalendarMark> = {};
    byDay.forEach((dayItems, day) => {
      out[day] = { count: dayItems.length, state: dayStateFor(dayItems) };
    });

    return out;
  }, [calendarItems]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items;
    // The whole schedule, earliest first — the order it will actually be worked.
    if (tab === 'all') {
      list = [...items].sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''));
    }
    if (tab === 'past') list = items.filter(isPastDue);
    if (tab === 'completed') list = items.filter(isCompleted);
    if (tab === 'upcoming') list = items.filter((i) => !isCompleted(i) && !isPastDue(i));
    // The calendar's list is the selected day, in the order the visits happen — from
    // calendarItems, so the day below the grid holds the same visits the grid counted.
    if (mode === 'calendar') {
      list = calendarItems
        .filter((i) => dayOf(i) === selectedDay)
        .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''));
    }
    if (!q) return list;
    return list.filter((i) =>
      `${i.patient_name || ''} ${i.title || ''} ${i.task_type || ''}`.toLowerCase().includes(q),
    );
    // mode belongs here: leaving the calendar for a list tab changes which branch above
    // applies, and without it the memo hands back the selected day's visits as though
    // they were the whole list.
  }, [items, calendarItems, tab, mode, search, selectedDay]);

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

  const stepMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    // The day travels with the month, so the list below the grid is never showing a day
    // from a month that is no longer on screen.
    setSelectedDay(null);
  };

  const goToToday = () => {
    const d = new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDay(d.toISOString().slice(0, 10));
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
        title={labels.schedule}
        actions={[
          {
            icon: 'refresh-outline',
            onPress: () => {
              setRefreshing(true);
              load();
            },
          },
          /*
            The month, the way the calendar icon opens it on the web Schedule Center.

            Booking is reached from inside it — tap a day, then Schedule — rather than
            straight from this icon, because a visit is always booked *onto* a day and a
            scheduler needs to see what is already on it first. The button that appears
            on the selected day is shown only to whoever holds "Schedule
            Visits/Activities"; everyone else gets the month as a read-only view of their
            own work, which is worth having on its own.
          */
          {
            icon: mode === 'calendar' ? 'list-outline' : 'calendar-outline',
            onPress: () => {
              if (mode === 'calendar') {
                setMode('list');
                return;
              }
              setMode('calendar');
              goToToday();
            },
          },
        ]}
      />
      {mode === 'list' ? (
        <SegmentTabs
          tabs={[
            // No count of its own: it is the sum of the other three, and the label is
            // already the longest in the row.
            { key: 'all', label: 'Schedule List', tint: colors.brandMagenta },
            { key: 'past', label: `Past Due (${counts.past})`, tint: colors.danger },
            { key: 'upcoming', label: `Upcoming (${counts.upcoming})`, tint: colors.brandMagenta },
            { key: 'completed', label: `Completed (${counts.completed})`, tint: colors.success },
          ]}
          value={tab}
          onChange={setTab}
        />
      ) : null}
      {mode === 'calendar' ? (
        <MonthCalendar
          year={viewYear}
          monthIndex={viewMonth}
          marks={marks}
          selectedIso={selectedDay}
          todayIso={todayIso}
          onSelect={setSelectedDay}
          onPrev={() => stepMonth(-1)}
          onNext={() => stepMonth(1)}
          onToday={goToToday}
        />
      ) : (
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder={
            tab === 'all'
              ? 'Search all scheduled tasks'
              : `Search ${tab === 'past' ? 'Past Due' : tab === 'completed' ? 'Completed' : 'Upcoming'} Tasks`
          }
        />
      )}
      {mode === 'calendar' && selectedDay ? (
        <View style={styles.dayBar}>
          <Text style={styles.dayBarTitle}>
            {formatDayHeading(selectedDay)} · {filtered.length}{' '}
            {filtered.length === 1 ? 'visit' : 'visits'}
          </Text>
          {canCreate ? (
            <Pressable
              style={styles.dayBarAdd}
              onPress={() => navigation.navigate('CreateSchedule', { date: selectedDay })}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.dayBarAddText}>SCHEDULE</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
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
                  mode === 'calendar'
                    ? selectedDay
                      ? 'Nothing scheduled on this day.'
                      : 'Choose a day to see its visits.'
                    : tab === 'all'
                      ? 'Nothing scheduled in this period.'
                      : tab === 'past'
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
                    <Pressable
                      style={styles.rowMain}
                      onPress={() => openEvvForVisit(item)}
                      accessibilityLabel="Open visit EVV"
                    >
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
                      {item.employee_name ? (
                        <View style={styles.assigneeRow}>
                          <Ionicons name="person-outline" size={12} color={colors.textMuted} />
                          <Text style={styles.assigneeText} numberOfLines={1}>
                            Assigned: {item.employee_name}
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
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
                          accessibilityLabel="Continue visit and clock out"
                          style={styles.inProgressActionBtn}
                          onPress={() => openEvvForVisit(item)}
                        >
                          <Ionicons name="stopwatch" size={15} color="#1D4ED8" />
                          <Text style={styles.inProgressActionBtnText}>Clock Out</Text>
                        </Pressable>
                      ) : !completed ? (
                        <Pressable
                          accessibilityLabel="Clock in"
                          style={styles.clockInBtn}
                          onPress={() => openEvvForVisit(item)}
                        >
                          <Ionicons name="play" size={13} color="#fff" />
                          <Text style={styles.clockInBtnText}>Clock In</Text>
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

  // The selected day, named above its visits, with the way to add one to it.
  dayBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayBarTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: '#0F172A' },
  dayBarAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#B4006E',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  dayBarAddText: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.4 },

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
  assigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  assigneeText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  clockInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brandMagenta,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  clockInBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
});
