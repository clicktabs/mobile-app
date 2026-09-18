import React, { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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

type Props = NativeStackScreenProps<StaffHomeStackParamList, 'PayrollHours'>;

/**
 * Stage 02 — approving verified hours before they are priced.
 *
 * EVV verifies a visit automatically: the compliance engine marks it verified when it
 * finds no critical issue, which says the record is well formed and nothing about whether
 * the hours are right. This is where a person agrees them.
 *
 * Selection is per visit, not per caregiver, so a week with one bad visit in it can be
 * approved without approving the bad one. Visits whose note is unfinished start unticked:
 * a bulk approve should not sweep up hours the office has not decided to pay ahead of
 * their paperwork.
 */
export function StaffPayrollHoursScreen({ navigation, route }: Props) {
  const { token, handleUnauthorized } = useAuth();
  const { periodId } = route.params;

  const [groups, setGroups] = useState<payroll.QueueGroup[]>([]);
  const [totals, setTotals] = useState<payroll.HoursTotals | null>(null);
  const [period, setPeriod] = useState<payroll.PayrollPeriodRow | null>(null);
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [holdReason, setHoldReason] = useState('');
  const [holding, setHolding] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      const res = await payroll.getHours(token, periodId);
      setGroups(res.data ?? []);
      setTotals(res.totals ?? null);
      setPeriod(res.period ?? null);

      // Default the ticks: everything waiting and payable, except hours whose note is
      // not finished — those are a deliberate choice, not a default.
      const next: Record<number, boolean> = {};
      (res.data ?? []).forEach((g) =>
        g.visits.forEach((v) => {
          if (v.approval_status === 'pending' && v.hours) {
            next[v.id] = !v.blocks_approval;
          }
        }),
      );
      setPicked(next);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Could not load the queue.');
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

  const chosen = Object.entries(picked)
    .filter(([, on]) => on)
    .map(([id]) => Number(id));

  /** Of what is ticked, how much still lacks a finished note. */
  const chosenUndocumented = groups
    .flatMap((g) => g.visits)
    .filter((v) => picked[v.id] && v.blocks_approval).length;

  const approve = async () => {
    if (!token || chosen.length === 0) return;

    // The server refuses these without the override; asking here means the refusal is a
    // decision rather than an error message.
    let allowUndocumented = false;
    if (chosenUndocumented > 0) {
      const ok = await confirmAction(
        'Note not finished',
        `${chosenUndocumented} of the selected ${chosenUndocumented === 1 ? 'visit has' : 'visits have'} no finished note. Paying for a visit without one cannot be billed. Approve anyway?`,
        { confirmLabel: 'Approve anyway', destructive: true },
      );
      if (!ok) return;
      allowUndocumented = true;
    }

    setBusy(true);
    try {
      const res = await payroll.approveHours(token, {
        visit_ids: chosen,
        allow_undocumented: allowUndocumented,
      });
      showAlert('Hours approved', res.message, 'success');
      await load();
    } catch (e) {
      showAlert('Could not approve', e instanceof ApiError ? e.message : 'Nothing was approved.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const hold = async () => {
    if (!token || chosen.length === 0 || holdReason.trim().length < 4) return;

    setBusy(true);
    try {
      const res = await payroll.rejectHours(token, {
        visit_ids: chosen,
        note: holdReason.trim(),
      });
      showAlert('Hours held', res.message, 'info');
      setHoldReason('');
      setHolding(false);
      await load();
    } catch (e) {
      showAlert('Could not hold', e instanceof ApiError ? e.message : 'Nothing was held.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <AppHeader title="Hours Approval" actions={[{ icon: 'arrow-back', onPress: () => navigation.goBack() }]} />
        <LoadingBlock />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AppHeader
        title="Hours Approval"
        actions={[{ icon: 'arrow-back', onPress: () => navigation.goBack() }]}
      />

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      <ScrollView
        contentContainerStyle={styles.pad}
        keyboardShouldPersistTaps="handled"
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
        {period ? <Text style={styles.lead}>{period.name}</Text> : null}

        {totals ? (
          <View style={styles.figures}>
            <Figure label="Waiting" value={totals.pending_hours.toFixed(2)} sub={`${totals.pending} visits`} />
            <Figure label="Approved" value={totals.approved_hours.toFixed(2)} sub="hours" />
            <Figure
              label="Note not done"
              value={String(totals.undocumented)}
              sub="of those waiting"
              tone={totals.undocumented > 0 ? 'warn' : undefined}
            />
          </View>
        ) : null}

        {groups.length === 0 ? (
          <EmptyState message="No verified hours in this period." />
        ) : (
          groups.map((g) => (
            <View key={g.caregiver_id} style={styles.group}>
              <View style={styles.groupHead}>
                <Text style={styles.groupName}>{g.caregiver_name}</Text>
                <Text style={styles.groupMeta}>
                  {g.pending_hours.toFixed(2)} h waiting · {g.approved_hours.toFixed(2)} h approved
                </Text>
              </View>

              {g.visits.map((v) => {
                const waiting = v.approval_status === 'pending';
                const selectable = waiting && !!v.hours;

                return (
                  <Pressable
                    key={v.id}
                    disabled={!selectable}
                    onPress={() => setPicked((p) => ({ ...p, [v.id]: !p[v.id] }))}
                    style={[styles.visit, v.blocks_approval && waiting && styles.visitFlagged]}
                  >
                    <Ionicons
                      name={
                        !selectable
                          ? v.approval_status === 'approved'
                            ? 'checkmark-circle'
                            : 'remove-circle-outline'
                          : picked[v.id]
                            ? 'checkbox'
                            : 'square-outline'
                      }
                      size={20}
                      color={
                        v.approval_status === 'approved'
                          ? '#047857'
                          : picked[v.id]
                            ? '#B4006E'
                            : '#94A3B8'
                      }
                    />

                    <View style={{ flex: 1 }}>
                      <Text style={styles.visitPatient} numberOfLines={1}>
                        {v.patient_name}
                      </Text>
                      <Text style={styles.visitMeta}>
                        {v.service_date}
                        {v.start_time ? ` · ${v.start_time}` : ''} ·{' '}
                        {v.hours != null ? `${v.hours.toFixed(2)} h` : 'no clock-out'}
                      </Text>
                      {/* Which note, and whether it is finished — the thing that decides
                          whether these hours may be approved without an override. */}
                      <Text
                        style={[styles.visitDoc, v.blocks_approval && styles.visitDocFlagged]}
                      >
                        {v.documentation_label}
                      </Text>
                      {v.approval_status === 'rejected' && v.approval_note ? (
                        <Text style={styles.visitHeld}>Held — “{v.approval_note}”</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))
        )}

        {chosen.length > 0 ? (
          <View style={styles.actions}>
            <Text style={styles.actionsCount}>
              {chosen.length} {chosen.length === 1 ? 'visit' : 'visits'} selected
              {chosenUndocumented > 0 ? ` · ${chosenUndocumented} without a finished note` : ''}
            </Text>

            <Pressable
              style={[styles.btn, busy && styles.btnOff]}
              disabled={busy}
              onPress={approve}
            >
              <Text style={styles.btnText}>{busy ? 'Working…' : 'Approve selected'}</Text>
            </Pressable>

            {holding ? (
              <View style={styles.holdBox}>
                {/* Required, and recorded against your name: a caregiver whose hours are
                    held is owed an explanation. */}
                <TextInput
                  value={holdReason}
                  onChangeText={setHoldReason}
                  placeholder="Why these hours are being held"
                  style={styles.input}
                  multiline
                />
                <View style={styles.holdActions}>
                  <Pressable style={styles.btnQuiet} onPress={() => setHolding(false)}>
                    <Text style={styles.btnQuietText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btnDanger, (holdReason.trim().length < 4 || busy) && styles.btnOff]}
                    disabled={holdReason.trim().length < 4 || busy}
                    onPress={hold}
                  >
                    <Text style={styles.btnText}>Hold these hours</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable style={styles.btnQuiet} onPress={() => setHolding(true)}>
                <Text style={styles.btnQuietText}>Hold back instead</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {/* Says what Next is about to carry forward, and what it is leaving behind. */}
        <PayrollStageNav
          stage="hours"
          periodId={periodId}
          note={
            totals && totals.pending > 0
              ? `${totals.pending} still waiting — only the ${totals.approved_hours.toFixed(2)} h approved will be priced.`
              : totals
                ? `${totals.approved_hours.toFixed(2)} h approved and ready to price.`
                : undefined
          }
        />
      </ScrollView>
    </AppShell>
  );
}

function Figure({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: 'warn';
}) {
  return (
    <View style={styles.figure}>
      <Text style={styles.figureLabel}>{label}</Text>
      <Text style={[styles.figureValue, tone === 'warn' && styles.figureValueWarn]}>{value}</Text>
      <Text style={styles.figureSub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 48 },
  lead: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 12 },

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
  figureValue: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  figureValueWarn: { color: '#B45309' },
  figureSub: { fontSize: 11, color: '#64748B', marginTop: 2 },

  group: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  groupHead: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  groupName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  groupMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },

  visit: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  visitFlagged: { backgroundColor: '#FFFBEB' },
  visitPatient: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  visitMeta: { fontSize: 12, color: '#475569', marginTop: 2 },
  visitDoc: { fontSize: 11.5, color: '#94A3B8', marginTop: 3 },
  visitDocFlagged: { color: '#B45309', fontWeight: '600' },
  visitHeld: { fontSize: 11.5, color: '#B91C1C', marginTop: 3 },

  actions: { marginTop: 8, gap: 10 },
  actionsCount: { fontSize: 12.5, color: '#475569' },

  holdBox: { gap: 10 },
  holdActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
  },

  btn: { backgroundColor: '#B4006E', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnDanger: {
    backgroundColor: '#B91C1C',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  btnOff: { backgroundColor: '#CBD5E1' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnQuiet: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    alignItems: 'center',
  },
  btnQuietText: { color: '#334155', fontWeight: '600', fontSize: 13 },
});
