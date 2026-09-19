import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { openPayrollConsole } from '../utils/payrollConsole';
import { colors } from '../theme/colors';

/**
 * Walking the payroll pipeline forward, at the foot of every stage.
 *
 * One definition of the order, so the numbering and the sequence cannot drift apart —
 * the web console had a hand-written "Next:" line on intake that went stale the moment a
 * stage was inserted, skipping it and misnumbering everything after.
 *
 * The last step leaves the app. Payout and sync commit a batch to an external payer and
 * cannot be recalled, so they stay on the web; Next from the gate says where it goes
 * rather than pretending the pipeline ends early.
 */

type StageKey = 'intake' | 'hours' | 'batch' | 'gate' | 'payout';

const STAGES: {
  key: StageKey;
  n: string;
  name: string;
  route?: 'PayrollHome' | 'PayrollHours' | 'PayrollBatch' | 'PayrollGate';
}[] = [
  { key: 'intake', n: '01', name: 'Intake', route: 'PayrollHome' },
  { key: 'hours', n: '02', name: 'Hours approval', route: 'PayrollHours' },
  { key: 'batch', n: '03', name: 'Calculation', route: 'PayrollBatch' },
  { key: 'gate', n: '04', name: 'Compliance gate', route: 'PayrollGate' },
  // No route: this one opens the browser.
  { key: 'payout', n: '05', name: 'Payout & sync' },
];

export function PayrollStageNav({
  stage,
  periodId,
  note,
}: {
  stage: StageKey;
  /** Absent on intake until a period is chosen — Next has nowhere to carry. */
  periodId?: number;
  /** One line saying what Next is about to carry forward. */
  note?: string;
}) {
  const navigation = useNavigation<any>();

  const at = STAGES.findIndex((s) => s.key === stage);
  const prev = at > 0 ? STAGES[at - 1] : null;
  const next = at >= 0 ? STAGES[at + 1] : null;

  if (!prev && !next) return null;

  const go = (target: (typeof STAGES)[number]) => {
    if (!target.route) {
      openPayrollConsole();
      return;
    }

    // Intake is the only stage that does not need a period, because choosing one is its
    // whole job.
    if (target.route === 'PayrollHome') {
      navigation.navigate('PayrollHome');
      return;
    }

    if (periodId) navigation.navigate(target.route, { periodId });
  };

  const nextDisabled = !!next && next.route !== undefined && !periodId;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {prev ? (
          <Pressable style={styles.back} onPress={() => go(prev)}>
            <Ionicons name="chevron-back" size={16} color="#334155" />
            <Text style={styles.backText} numberOfLines={1}>
              {prev.name}
            </Text>
          </Pressable>
        ) : (
          // Keeps Next on the right on the first stage rather than letting it slide left.
          <View style={{ flex: 1 }} />
        )}

        {next ? (
          <Pressable
            style={[styles.next, nextDisabled && styles.nextOff]}
            disabled={nextDisabled}
            onPress={() => go(next)}
          >
            <Text style={styles.nextText} numberOfLines={1}>
              {next.name}
            </Text>
            <Ionicons
              name={next.route ? 'chevron-forward' : 'open-outline'}
              size={16}
              color="#fff"
            />
          </Pressable>
        ) : null}
      </View>

      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  back: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  backText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#334155' },

  next: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 10,
  },
  nextOff: { backgroundColor: '#CBD5E1' },
  nextText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  note: { fontSize: 12, color: '#94A3B8', textAlign: 'right', lineHeight: 17 },
});
