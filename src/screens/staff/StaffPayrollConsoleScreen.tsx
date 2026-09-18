import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { AppHeader, AppShell } from '../../components/chrome';
import { EmptyState, ErrorBanner, LoadingBlock } from '../../components/ui';
import { PayrollStageNav } from '../../components/PayrollStageNav';
import { useAuth } from '../../context/AuthContext';
import * as payroll from '../../api/payrollConsole';
import { ApiError } from '../../api/client';
import { AppDatePicker } from '../../components/AppDatePicker';
import { showAlert } from '../../utils/confirm';
import { openPayrollConsole } from '../../utils/payrollConsole';

/**
 * The Payroll Console's front door on a phone.
 *
 * The web version draws the pipeline as a rail of numbered stages. That rail is six items
 * of vertical space here, so the stages are cards instead, each carrying the one figure
 * that says whether it needs attention — which is the only reason to open a stage.
 *
 * A pay period is picked once, at the top, and every stage inherits it. The web console
 * carries the period in a query string on each screen; carrying it in navigation state
 * here means a stage cannot end up showing a different period from the one on screen.
 */
export function StaffPayrollConsoleScreen() {
  const { token, handleUnauthorized } = useAuth();
  const navigation = useNavigation<any>();

  const [periods, setPeriods] = useState<payroll.PayrollPeriodRow[]>([]);
  const [orphaned, setOrphaned] = useState<{ count: number; hours: number; from: string | null; to: string | null } | null>(null);
  const [selected, setSelected] = useState<payroll.PayrollPeriodRow | null>(null);
  const [totals, setTotals] = useState<payroll.HoursTotals | null>(null);
  const [gate, setGate] = useState<payroll.GateSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Creating a period, shown on demand rather than occupying the top of the screen.
  const [creating, setCreating] = useState(false);
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (keepPeriodId?: number) => {
      if (!token) return;
      setError(null);

      try {
        const res = await payroll.getPeriods(token);
        setPeriods(res.data ?? []);
        setOrphaned(res.orphaned ?? null);

        const period =
          (keepPeriodId && res.data?.find((p) => p.id === keepPeriodId)) ||
          res.data?.find((p) => p.is_open) ||
          res.data?.[0] ||
          null;
        setSelected(period);

        // The two figures that decide whether a stage needs opening. Fetched here so the
        // cards are answers rather than labels.
        if (period) {
          const [hours, gateRes] = await Promise.all([
            payroll.getHours(token, period.id).catch(() => null),
            payroll.getGate(token, period.id).catch(() => null),
          ]);
          setTotals(hours?.totals ?? null);
          setGate(gateRes?.summary ?? null);
        } else {
          setTotals(null);
          setGate(null);
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          await handleUnauthorized();
          return;
        }
        setError(
          e instanceof ApiError && e.status === 403
            ? 'Your role does not include managing payroll.'
            : 'Could not load the payroll console.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, handleUnauthorized],
  );

  useFocusEffect(
    useCallback(() => {
      load(selected?.id);
      // selected is deliberately not a dependency: refetching on every period change
      // would fight the picker.
    }, [load]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const pickPeriod = async (period: payroll.PayrollPeriodRow) => {
    setSelected(period);
    if (!token) return;

    const [hours, gateRes] = await Promise.all([
      payroll.getHours(token, period.id).catch(() => null),
      payroll.getGate(token, period.id).catch(() => null),
    ]);
    setTotals(hours?.totals ?? null);
    setGate(gateRes?.summary ?? null);
  };

  const createPeriod = async () => {
    if (!token || !newStart || !newEnd) return;
    setSaving(true);

    try {
      const res = await payroll.createPeriod(token, { period_start: newStart, period_end: newEnd });
      showAlert('Pay period created', res.data?.name, 'success');
      setCreating(false);
      setNewStart('');
      setNewEnd('');
      await load(res.data?.id);
    } catch (e) {
      showAlert(
        'Could not create it',
        e instanceof ApiError ? e.message : 'The period was not created.',
        'error',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <AppHeader title="Payroll Console" />
        <LoadingBlock />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AppHeader
        title="Payroll Console"
        actions={[
          {
            icon: 'refresh-outline',
            onPress: () => {
              setRefreshing(true);
              load(selected?.id);
            },
          },
        ]}
      />

      {error ? <ErrorBanner message={error} onRetry={() => load(selected?.id)} /> : null}

      <ScrollView
        contentContainerStyle={styles.pad}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(selected?.id);
            }}
          />
        }
      >
        {/*
          Verified hours no period covers.

          Periods are made by hand, so the moment the newest one ends every visit after it
          is invisible in a period-scoped queue. First thing on the screen, because this is
          the screen that can fix it.
        */}
        {orphaned && orphaned.count > 0 ? (
          <View style={styles.warn}>
            <Ionicons name="alert-circle-outline" size={16} color="#B45309" />
            <Text style={styles.warnText}>
              {orphaned.count} verified {orphaned.count === 1 ? 'visit' : 'visits'} (
              {orphaned.hours.toFixed(2)} h) fall outside every pay period
              {orphaned.from ? `, from ${orphaned.from} to ${orphaned.to}` : ''}. Create one
              covering those dates.
            </Text>
          </View>
        ) : null}

        {/*
          Intake's work, which is this screen's: choose a pay period, create one when it
          is missing, and say what it currently amounts to.

          The number lives on the stage card below rather than here. Saying "01" twice on
          one screen makes the reader check whether they are the same 01.
        */}
        <Text style={styles.section}>Pay period</Text>

        {periods.length === 0 ? (
          <EmptyState message="No pay periods yet. Create one to begin." />
        ) : (
          <View style={styles.periodRow}>
            {periods.slice(0, 6).map((p) => {
              const on = p.id === selected?.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => pickPeriod(p)}
                  style={[styles.periodChip, on && styles.periodChipOn]}
                >
                  <Text style={[styles.periodChipText, on && styles.periodChipTextOn]}>
                    {p.name}
                  </Text>
                  <Text style={[styles.periodChipMeta, on && styles.periodChipTextOn]}>
                    {p.status}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {creating ? (
          <View style={styles.createBox}>
            <Text style={styles.label}>Starts</Text>
            <AppDatePicker value={newStart} onChange={setNewStart} format="YYYY-MM-DD" />
            <Text style={styles.label}>Ends</Text>
            <AppDatePicker value={newEnd} onChange={setNewEnd} format="YYYY-MM-DD" />

            <View style={styles.createActions}>
              <Pressable style={styles.btnQuiet} onPress={() => setCreating(false)}>
                <Text style={styles.btnQuietText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, (!newStart || !newEnd || saving) && styles.btnOff]}
                disabled={!newStart || !newEnd || saving}
                onPress={createPeriod}
              >
                <Text style={styles.btnText}>{saving ? 'Creating…' : 'Create period'}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.addPeriod} onPress={() => setCreating(true)}>
            <Ionicons name="add" size={16} color="#B4006E" />
            <Text style={styles.addPeriodText}>New pay period</Text>
          </Pressable>
        )}

        {/*
          What the selected period amounts to.

          Zeroes before it is priced, and that is the answer rather than a gap: a period
          with no figures has not reached the calculation yet, which the stage cards below
          then say in words.
        */}
        {selected?.figures ? (
          <View style={styles.figures}>
            <Figure label="Caregivers" value={String(selected.figures.people)} />
            <Figure label="Hours" value={selected.figures.hours.toFixed(2)} />
            <Figure label="Gross" value={`$${selected.figures.gross.toFixed(2)}`} />
          </View>
        ) : null}

        {selected ? (
          <>
            <Text style={styles.section}>Stages</Text>

            {/*
              Stage 01 is this screen, and it belongs in the list.

              Naming it only in the section heading above left the card list starting at
              02, which reads as a pipeline that begins at step two. Shown as where you
              are — no chevron, nothing to open — so the sequence runs 01 to 05 with the
              current position visible in it.
            */}
            <StageCard
              n="01"
              name="Intake"
              meta={`${selected.name} · ${selected.status}`}
              current
            />

            <StageCard
              n="02"
              name="Hours approval"
              meta={
                totals
                  ? totals.pending > 0
                    ? `${totals.pending} waiting · ${totals.pending_hours.toFixed(2)} h`
                    : `${totals.approved_hours.toFixed(2)} h approved`
                  : '—'
              }
              tone={totals && totals.pending > 0 ? 'attention' : undefined}
              onPress={() => navigation.navigate('PayrollHours', { periodId: selected.id })}
            />

            <StageCard
              n="03"
              name="Calculation"
              meta={selected.entries > 0 ? `${selected.entries} entries priced` : 'Not calculated'}
              tone={selected.entries === 0 ? 'attention' : undefined}
              onPress={() => navigation.navigate('PayrollBatch', { periodId: selected.id })}
            />

            <StageCard
              n="04"
              name="Compliance gate"
              meta={
                gate
                  ? gate.people === 0
                    ? 'Not run yet'
                    : `${gate.blocked} blocked · ${gate.held} on hold`
                  : 'Not run yet'
              }
              tone={gate && (gate.blocked > 0 || gate.held > 0) ? 'attention' : undefined}
              onPress={() => navigation.navigate('PayrollGate', { periodId: selected.id })}
            />

            {/*
              Payout and sync are not here.

              They hand a batch to Gusto, ADP or the native payer and cannot be recalled.
              That is worth doing where every figure being committed is on one screen, so
              the app says where it lives rather than pretending the stage does not exist.
            */}
            <Pressable style={styles.webStage} onPress={openPayrollConsole}>
              <View style={{ flex: 1 }}>
                <Text style={styles.webStageName}>05 · Payout &amp; sync</Text>
                <Text style={styles.webStageMeta}>
                  Done on the web console — a payout cannot be recalled, so it is made where
                  the whole batch is visible.
                </Text>
              </View>
              <Ionicons name="open-outline" size={18} color="#64748B" />
            </Pressable>
          </>
        ) : null}

        <PayrollStageNav stage="intake" periodId={selected?.id} />
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

function StageCard({
  n,
  name,
  meta,
  tone,
  current,
  onPress,
}: {
  n: string;
  name: string;
  meta: string;
  tone?: 'attention';
  /** The stage you are already on. Shown in the list, but not a way to go anywhere. */
  current?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={[styles.stage, current && styles.stageCurrent]}
      disabled={!onPress}
      onPress={onPress}
    >
      <View
        style={[
          styles.stageN,
          tone === 'attention' && styles.stageNAttention,
          current && styles.stageNCurrent,
        ]}
      >
        <Text
          style={[
            styles.stageNText,
            tone === 'attention' && styles.stageNTextAttention,
            current && styles.stageNTextAttention,
          ]}
        >
          {n}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stageName}>{name}</Text>
        <Text style={[styles.stageMeta, tone === 'attention' && styles.stageMetaAttention]}>
          {meta}
        </Text>
      </View>
      {current ? (
        <Text style={styles.stageHere}>You are here</Text>
      ) : (
        <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40 },

  warn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  warnText: { flex: 1, fontSize: 12.5, color: '#854D0E', lineHeight: 18 },

  section: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#0F172A',
    marginTop: 10,
    marginBottom: 8,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginTop: 10, marginBottom: 4 },

  figures: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 4 },
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

  periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  periodChip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  periodChipOn: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  periodChipText: { fontSize: 13, color: '#0F172A', fontWeight: '600' },
  periodChipMeta: { fontSize: 11, color: '#64748B', marginTop: 2, textTransform: 'capitalize' },
  periodChipTextOn: { color: '#fff' },

  addPeriod: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  addPeriodText: { fontSize: 13, fontWeight: '700', color: '#B4006E' },

  createBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fff',
  },
  createActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },

  stage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  stageN: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageCurrent: { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' },
  stageNAttention: { backgroundColor: '#B4006E', borderColor: '#B4006E' },
  stageNCurrent: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  stageHere: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  stageNText: { fontSize: 12, fontWeight: '800', color: '#64748B' },
  stageNTextAttention: { color: '#fff' },
  stageName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  stageMeta: { fontSize: 12.5, color: '#64748B', marginTop: 2 },
  stageMetaAttention: { color: '#B4006E', fontWeight: '600' },

  webStage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#F8FAFC',
  },
  webStageName: { fontSize: 14, fontWeight: '700', color: '#475569' },
  webStageMeta: { fontSize: 12, color: '#94A3B8', marginTop: 3, lineHeight: 17 },

  btn: {
    backgroundColor: '#B4006E',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  btnOff: { backgroundColor: '#CBD5E1' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnQuiet: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  btnQuietText: { color: '#334155', fontWeight: '600', fontSize: 13 },
});
