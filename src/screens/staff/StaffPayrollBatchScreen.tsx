import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppHeader, AppShell } from '../../components/chrome';
import { EmptyState, ErrorBanner, LoadingBlock } from '../../components/ui';
import { PayrollStageNav } from '../../components/PayrollStageNav';
import { useAuth } from '../../context/AuthContext';
import * as payroll from '../../api/payrollConsole';
import { ApiError } from '../../api/client';
import { confirmAction, showAlert } from '../../utils/confirm';
import type { StaffHomeStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<StaffHomeStackParamList, 'PayrollBatch'>;

/**
 * Stage 03 — pricing the approved hours, and approving the batch.
 *
 * Only approved hours are priced, so what this screen totals is the decision made on the
 * previous one. Anyone the engine had to skip is named rather than counted: "3 skipped"
 * is not actionable and "no active pay rate" says exactly what to go and fix.
 *
 * Approving the batch is confirmed, because the gate and the payout both follow from it.
 */
export function StaffPayrollBatchScreen({ navigation, route }: Props) {
  const { token, handleUnauthorized } = useAuth();
  const { periodId } = route.params;

  const [entries, setEntries] = useState<payroll.BatchEntry[]>([]);
  const [totals, setTotals] = useState<{ people: number; hours: number; gross: number; net: number } | null>(null);
  const [period, setPeriod] = useState<payroll.PayrollPeriodRow | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      const res = await payroll.getBatch(token, periodId);
      setEntries(res.data ?? []);
      setTotals(res.totals ?? null);
      setPeriod(res.period ?? null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Could not load the batch.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, periodId, handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const calculate = async () => {
    if (!token) return;
    setBusy(true);

    try {
      const res = await payroll.calculate(token, periodId);
      setSkipped(res.skipped ?? []);
      showAlert('Calculated', res.message, 'success');
      await load();
    } catch (e) {
      showAlert('Could not calculate', e instanceof ApiError ? e.message : 'Nothing was priced.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!token || !totals) return;

    const ok = await confirmAction(
      'Approve this batch?',
      `${totals.people} ${totals.people === 1 ? 'caregiver' : 'caregivers'} · ${totals.hours.toFixed(2)} h · $${totals.net.toFixed(2)} net. Payout and sync follow on the web console.`,
      { confirmLabel: 'Approve batch' },
    );
    if (!ok) return;

    setBusy(true);
    try {
      const res = await payroll.approveBatch(token, periodId);
      showAlert('Batch approved', res.message, 'success');
      await load();
    } catch (e) {
      showAlert(
        'Could not approve',
        e instanceof ApiError ? e.message : 'The batch was not approved.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <AppHeader title="Calculation" actions={[{ icon: 'arrow-back', onPress: () => navigation.goBack() }]} />
        <LoadingBlock />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AppHeader
        title="Calculation"
        actions={[{ icon: 'arrow-back', onPress: () => navigation.goBack() }]}
      />

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      <ScrollView
        contentContainerStyle={styles.pad}
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
        {period ? (
          <Text style={styles.lead}>
            {period.name} · <Text style={styles.status}>{period.status}</Text>
          </Text>
        ) : null}

        {totals && totals.people > 0 ? (
          <View style={styles.figures}>
            <Figure label="Caregivers" value={String(totals.people)} />
            <Figure label="Hours" value={totals.hours.toFixed(2)} />
            <Figure label="Net" value={`$${totals.net.toFixed(2)}`} />
          </View>
        ) : null}

        {entries.length === 0 ? (
          <EmptyState message="Nothing priced yet. Calculate to price the approved hours." />
        ) : (
          entries.map((e) => (
            <View key={e.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{e.caregiver_name}</Text>
                <Text style={styles.rowMeta}>
                  {e.regular_hours.toFixed(2)} h
                  {e.overtime_hours > 0 ? ` · ${e.overtime_hours.toFixed(2)} h OT` : ''}
                  {e.pay_type ? ` · ${e.pay_type.replace('_', ' ')}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.rowNet}>${e.net_pay.toFixed(2)}</Text>
                <Text style={styles.rowGross}>${e.gross_pay.toFixed(2)} gross</Text>
              </View>
            </View>
          ))
        )}

        {/* Named, not counted. "No active pay rate" is a caregiver nobody will be paid
            for, and the name is what makes it fixable. */}
        {skipped.length > 0 ? (
          <View style={styles.skipped}>
            <Text style={styles.skippedTitle}>
              {skipped.length} skipped by the calculation
            </Text>
            {skipped.map((s) => (
              <Text key={s} style={styles.skippedRow}>
                · {s}
              </Text>
            ))}
          </View>
        ) : null}

        {period?.is_open ? (
          <View style={styles.actions}>
            <Pressable style={[styles.btnQuiet, busy && styles.btnOff]} disabled={busy} onPress={calculate}>
              <Text style={styles.btnQuietText}>
                {entries.length > 0 ? 'Recalculate' : 'Calculate approved hours'}
              </Text>
            </Pressable>

            {entries.length > 0 ? (
              <Pressable style={[styles.btn, busy && styles.btnOff]} disabled={busy} onPress={approve}>
                <Text style={styles.btnText}>{busy ? 'Working…' : 'Approve batch'}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.settled}>
            <Ionicons name="lock-closed-outline" size={15} color="#64748B" />
            <Text style={styles.settledText}>
              This period is {period?.status} — its figures are a record now and cannot be
              recalculated.
            </Text>
          </View>
        )}

        <PayrollStageNav stage="batch" periodId={periodId} />
      </ScrollView>
    </AppShell>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.figure}>
      <Text style={styles.figureLabel}>{label}</Text>
      <Text style={styles.figureValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 48 },
  lead: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  status: { color: '#64748B', fontWeight: '600', textTransform: 'capitalize' },

  figures: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  figure: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#fff',
  },
  figureLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#94A3B8',
  },
  figureValue: { fontSize: 17, fontWeight: '800', color: '#0F172A', marginTop: 4 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  rowName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  rowMeta: { fontSize: 12, color: '#64748B', marginTop: 2, textTransform: 'capitalize' },
  rowNet: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  rowGross: { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  skipped: {
    marginTop: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 12,
  },
  skippedTitle: { fontSize: 12.5, fontWeight: '700', color: '#854D0E', marginBottom: 4 },
  skippedRow: { fontSize: 12, color: '#854D0E', lineHeight: 18 },

  actions: { marginTop: 18, gap: 10 },
  settled: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 18,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  settledText: { flex: 1, fontSize: 12.5, color: '#64748B', lineHeight: 18 },

  btn: { backgroundColor: '#B4006E', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnOff: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnQuiet: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  btnQuietText: { color: '#334155', fontWeight: '600', fontSize: 14 },
});
