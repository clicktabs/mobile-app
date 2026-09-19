import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * The furniture the MAR and TAR share.
 *
 * The two records stay separate screens — a treatment is not a dose — but they are read the
 * same way: a day at a time, oldest due first, with the overdue ones catching the eye. That
 * much is worth sharing so the two do not drift into looking like different applications.
 */

/** Paging by day. Both records are read a day at a time and corrected a day late. */
export function DayBar({ date, onChange }: { date: string; onChange: (next: string) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const isToday = date === today;

  const shift = (days: number) => {
    // Midday, so a daylight-saving shift cannot roll the date over.
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + days);
    const next = d.toISOString().slice(0, 10);
    if (next > today) return;
    onChange(next);
  };

  return (
    <View style={sharedStyles.dayBar}>
      <Pressable style={sharedStyles.dayArrow} onPress={() => shift(-1)} hitSlop={8}>
        <Ionicons name="chevron-back" size={20} color="#334155" />
      </Pressable>

      <Text style={sharedStyles.dayLabel}>
        {isToday
          ? 'Today'
          : new Date(date + 'T12:00:00').toLocaleDateString(undefined, {
              weekday: 'short', month: 'short', day: 'numeric',
            })}
      </Text>

      <Pressable
        style={[sharedStyles.dayArrow, isToday && sharedStyles.dayArrowOff]}
        onPress={() => shift(1)}
        disabled={isToday}
        hitSlop={8}
      >
        <Ionicons name="chevron-forward" size={20} color={isToday ? '#CBD5E1' : '#334155'} />
      </Pressable>
    </View>
  );
}

export function Figure({
  label, value, warn, good,
}: { label: string; value: number; warn?: boolean; good?: boolean }) {
  return (
    <View style={sharedStyles.figure}>
      <Text
        style={[
          sharedStyles.figureValue,
          warn && value > 0 && sharedStyles.figureWarn,
          good && value > 0 && sharedStyles.figureGood,
        ]}
      >
        {value}
      </Text>
      <Text style={sharedStyles.figureLabel}>{label}</Text>
    </View>
  );
}

/** Past its time and still untouched — a fact about the clock, not a judgement. */
export function LateBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return <Text style={sharedStyles.late}>late</Text>;
}

/**
 * Ordered, but not on anyone's list.
 *
 * Both records have this: a medication whose frequency could not be read, a treatment whose
 * weekly count never says which days. Neither is scheduled at a guess — a guessed time makes
 * something look overdue that was never due — so the person in the home is told instead.
 */
export function NoticeBox({
  title, body, items,
}: { title: string; body: string; items: string[] }) {
  return (
    <View style={sharedStyles.notice}>
      <Ionicons name="alert-circle-outline" size={19} color="#B45309" />
      <View style={{ flex: 1 }}>
        <Text style={sharedStyles.noticeTitle}>{title}</Text>
        <Text style={sharedStyles.noticeBody}>{body}</Text>
        {items.map((item, i) => (
          <Text key={i} style={sharedStyles.noticeItem}>• {item}</Text>
        ))}
      </View>
    </View>
  );
}

export const sharedStyles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 48 },
  lead: {
    fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6,
    color: '#94A3B8', marginTop: 18, marginBottom: 8,
  },
  strong: { fontWeight: '700' },

  dayBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, backgroundColor: '#fff',
    paddingVertical: 8, paddingHorizontal: 10, marginBottom: 10,
  },
  dayArrow: { padding: 4 },
  dayArrowOff: { opacity: 0.4 },
  dayLabel: { fontSize: 15, fontWeight: '700', color: '#0F172A' },

  figures: { flexDirection: 'row', gap: 8 },
  figure: {
    flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff',
  },
  figureValue: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  figureWarn: { color: '#B45309' },
  figureGood: { color: '#047857' },
  figureLabel: {
    fontSize: 10, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.4, color: '#94A3B8', marginTop: 2,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: '#E2E8F0', borderLeftWidth: 4, borderRadius: 10,
    padding: 12, marginBottom: 8, backgroundColor: '#fff',
  },
  rowTime: { width: 52 },
  rowTimeText: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  rowMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  rowReason: { fontSize: 12, color: '#B45309', marginTop: 3, fontStyle: 'italic' },

  // The order behind a signed record has moved. Red rather than amber: amber on these
  // screens means late, and this is not a timing problem.
  drift: {
    marginTop: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
  },
  driftTitle: { fontSize: 12, fontWeight: '800', color: '#991B1B' },
  driftLine: { fontSize: 11, color: '#991B1B', marginTop: 3, lineHeight: 16 },
  rowBy: { fontSize: 11, color: '#94A3B8', marginTop: 3 },
  late: { fontSize: 10, fontWeight: '800', color: '#B45309', textTransform: 'uppercase' },

  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  pillText: { fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },

  card: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    padding: 12, marginBottom: 10, backgroundColor: '#fff',
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  cardMeta: { fontSize: 12.5, color: '#64748B', marginTop: 3 },

  subRow: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  subRowText: { fontSize: 12.5, color: '#334155' },
  subRowQuiet: { fontSize: 12, color: '#64748B', fontStyle: 'italic', marginTop: 2 },
  followUp: {
    alignSelf: 'flex-start', marginTop: 5,
    borderWidth: 1, borderColor: '#FDE68A', backgroundColor: '#FFFBEB',
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
  },
  followUpText: { fontSize: 11.5, fontWeight: '700', color: '#B45309' },

  notice: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 18,
    borderWidth: 1, borderColor: '#FDE68A', backgroundColor: '#FFFBEB',
    borderRadius: 10, padding: 12,
  },
  noticeTitle: { fontSize: 13, fontWeight: '800', color: '#78350F' },
  noticeBody: { fontSize: 12, color: '#78350F', marginTop: 3, lineHeight: 17 },
  noticeItem: { fontSize: 12, color: '#78350F', marginTop: 4 },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 20, paddingBottom: 34,
  },
  sheetHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  sheetMeta: { fontSize: 13, color: '#64748B', marginBottom: 2 },

  label: { fontSize: 12.5, fontWeight: '700', color: '#334155', marginTop: 14, marginBottom: 5 },
  input: {
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    backgroundColor: '#fff', color: '#0F172A',
  },
  multiline: { minHeight: 76, textAlignVertical: 'top' },

  primary: {
    marginTop: 18, backgroundColor: '#059669', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  primarySmall: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    marginTop: 10, backgroundColor: '#B4006E', borderRadius: 8, paddingVertical: 10,
  },
  primarySmallText: { color: '#fff', fontWeight: '700', fontSize: 13.5 },
  rowButtons: { flexDirection: 'row', gap: 8, marginTop: 10 },
  quiet: {
    flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  quietText: { color: '#334155', fontWeight: '600', fontSize: 13.5 },
  off: { opacity: 0.6 },
});
