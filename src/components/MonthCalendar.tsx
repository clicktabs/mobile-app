import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * A month of visits, the way the web Schedule Center shows it.
 *
 * The web uses FullCalendar with event pills inside each day cell. A phone cell is about
 * 44 points wide, which holds a number and not a sentence — so the day carries a count
 * and a state colour, and tapping it lists that day's visits underneath at full width.
 * Same information, read in two steps instead of one.
 *
 * What is deliberately not here: drag-to-reschedule. On the web you drag an event to
 * another day and confirm. On a month grid this size, dragging would move visits by
 * accident, and a visit that silently changes day is a caregiver who goes to the wrong
 * house. Rescheduling stays on the web, where the gesture is precise.
 */

export type CalendarDayState = 'none' | 'scheduled' | 'attention' | 'done';

export type CalendarMark = {
  /** Visits on this day. */
  count: number;
  /** Worst state on the day, which is what the cell colours by. */
  state: CalendarDayState;
};

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATE_COLOR: Record<Exclude<CalendarDayState, 'none'>, string> = {
  // Needs somebody to act: past due, missed, documentation owed.
  attention: '#DC2626',
  scheduled: '#B4006E',
  done: '#047857',
};

export function isoDate(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function monthLabel(year: number, monthIndex: number) {
  return `${MONTHS[monthIndex]} ${year}`;
}

/** First and last ISO date of a month — what the API needs to fetch it. */
export function monthBounds(year: number, monthIndex: number) {
  return {
    from: isoDate(year, monthIndex, 1),
    to: isoDate(year, monthIndex, new Date(year, monthIndex + 1, 0).getDate()),
  };
}

export function MonthCalendar({
  year,
  monthIndex,
  marks,
  selectedIso,
  todayIso,
  onSelect,
  onPrev,
  onNext,
  onToday,
}: {
  year: number;
  monthIndex: number;
  /** Keyed by ISO date. Days with no visits may be absent. */
  marks: Record<string, CalendarMark>;
  selectedIso: string | null;
  todayIso: string;
  onSelect: (iso: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const cells = useMemo(() => {
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const leading = new Date(year, monthIndex, 1).getDay();

    // Leading blanks keep the 1st under its real weekday; trailing ones keep the last
    // row from stretching its cells wider than the rest of the grid.
    const out: (string | null)[] = Array.from({ length: leading }, () => null);
    for (let d = 1; d <= daysInMonth; d += 1) out.push(isoDate(year, monthIndex, d));
    while (out.length % 7 !== 0) out.push(null);

    return out;
  }, [year, monthIndex]);

  const showsToday = todayIso.startsWith(`${year}-${String(monthIndex + 1).padStart(2, '0')}`);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Pressable onPress={onPrev} hitSlop={10} style={styles.nav}>
          <Ionicons name="chevron-back" size={20} color="#0F172A" />
        </Pressable>

        <Pressable onPress={onToday} hitSlop={8} style={styles.titleWrap}>
          <Text style={styles.title}>{monthLabel(year, monthIndex)}</Text>
          {/* Paging a few months out and losing today is easy; getting back should not
              mean counting months backwards. Hidden when already here. */}
          {!showsToday ? <Text style={styles.todayLink}>Today</Text> : null}
        </Pressable>

        <Pressable onPress={onNext} hitSlop={10} style={styles.nav}>
          <Ionicons name="chevron-forward" size={20} color="#0F172A" />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((d) => (
          <Text key={d} style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((iso, idx) => {
          if (!iso) return <View key={`blank-${idx}`} style={styles.cell} />;

          const mark = marks[iso];
          const selected = iso === selectedIso;
          const today = iso === todayIso;
          const day = Number(iso.slice(8, 10));

          return (
            <Pressable
              key={iso}
              style={[styles.cell, selected && styles.cellSelected]}
              onPress={() => onSelect(iso)}
              accessibilityRole="button"
              accessibilityLabel={
                mark
                  ? `${day}, ${mark.count} ${mark.count === 1 ? 'visit' : 'visits'}`
                  : `${day}, no visits`
              }
            >
              <Text
                style={[
                  styles.dayNum,
                  today && styles.dayNumToday,
                  selected && styles.dayNumSelected,
                ]}
              >
                {day}
              </Text>

              {/*
                The count, not one dot per visit: a dot row stops being countable past
                three or four, and a scheduler is deciding whether a day is full.
              */}
              {mark && mark.count > 0 ? (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: STATE_COLOR[mark.state === 'none' ? 'scheduled' : mark.state] },
                    selected && styles.badgeOnSelected,
                  ]}
                >
                  <Text style={styles.badgeText}>{mark.count}</Text>
                </View>
              ) : (
                <View style={styles.badgeSpacer} />
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legend}>
        <Legend color={STATE_COLOR.scheduled} label="Scheduled" />
        <Legend color={STATE_COLOR.attention} label="Needs attention" />
        <Legend color={STATE_COLOR.done} label="Completed" />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10, backgroundColor: '#fff' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nav: { padding: 6 },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  todayLink: { fontSize: 12, fontWeight: '700', color: '#B4006E' },

  weekRow: { flexDirection: 'row', marginTop: 8 },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  cell: {
    // Seven to a row, whatever the screen width.
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 8,
  },
  cellSelected: { backgroundColor: '#0F172A' },
  dayNum: { fontSize: 14, color: '#334155' },
  dayNumToday: { fontWeight: '800', color: '#B4006E' },
  dayNumSelected: { color: '#fff', fontWeight: '700' },

  badge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOnSelected: { borderWidth: 1, borderColor: '#fff' },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  // Keeps every cell the same height whether or not it has visits, so the grid does not
  // jitter as the user pages through months.
  badgeSpacer: { height: 16 },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: '#64748B' },
});
