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
import { showAlert } from '../../utils/confirm';
import type { StaffHomeStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<StaffHomeStackParamList, 'PayrollGate'>;

/**
 * Stage 04 — the compliance gate.
 *
 * Three checks stand between a calculated batch and a paid one: do the hours match
 * verified EVV time, was the caregiver where the patient lives, and is there a pay rate
 * covering the period.
 *
 * Severity decides what can be done about a finding, and the app must not blur it. A hold
 * is questionable and a person may release it by stating why. A block has no release path
 * by design — it is fixed at the source and the checks re-run — so no button is offered
 * for one.
 */
export function StaffPayrollGateScreen({ navigation, route }: Props) {
  const { token, handleUnauthorized } = useAuth();
  const { periodId } = route.params;

  const [findings, setFindings] = useState<payroll.GateFinding[]>([]);
  const [summary, setSummary] = useState<payroll.GateSummary | null>(null);
  const [period, setPeriod] = useState<payroll.PayrollPeriodRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Which hold is being released, and the reason being typed for it.
  const [releasing, setReleasing] = useState<number | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      const res = await payroll.getGate(token, periodId);
      setFindings(res.data ?? []);
      setSummary(res.summary ?? null);
      setPeriod(res.period ?? null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Could not load the gate.');
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

  const run = async () => {
    if (!token) return;
    setBusy(true);

    try {
      const res = await payroll.runGate(token, periodId);
      showAlert('Checks run', res.message, res.summary.open ? 'success' : 'info');
      await load();
    } catch (e) {
      showAlert('Could not run the checks', e instanceof ApiError ? e.message : 'Nothing ran.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const release = async (checkId: number) => {
    if (!token || reason.trim().length < 4) return;
    setBusy(true);

    try {
      const res = await payroll.releaseCheck(token, checkId, reason.trim());
      showAlert('Hold released', res.message, 'success');
      setReleasing(null);
      setReason('');
      await load();
    } catch (e) {
      showAlert('Could not release', e instanceof ApiError ? e.message : 'Nothing was released.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <AppHeader title="Compliance Gate" actions={[{ icon: 'arrow-back', onPress: () => navigation.goBack() }]} />
        <LoadingBlock />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AppHeader
        title="Compliance Gate"
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

        {summary && summary.people > 0 ? (
          <View style={[styles.state, summary.open ? styles.stateOpen : styles.stateShut]}>
            <Ionicons
              name={summary.open ? 'checkmark-circle' : 'alert-circle'}
              size={18}
              color={summary.open ? '#047857' : '#B91C1C'}
            />
            <Text style={[styles.stateText, summary.open ? styles.stateTextOpen : styles.stateTextShut]}>
              {summary.open
                ? `Gate open — ${summary.ready_people} ready, $${summary.ready_net.toFixed(2)} net`
                : `${summary.blocked} blocked · ${summary.held} on hold`}
            </Text>
          </View>
        ) : null}

        {findings.length === 0 ? (
          <EmptyState
            message={
              summary && summary.people > 0
                ? 'Every check passed.'
                : 'Not run yet. Calculate the batch, then run the checks.'
            }
          />
        ) : (
          findings.map((f) => (
            <View
              key={f.id}
              style={[styles.finding, f.severity === 'block' ? styles.findingBlock : styles.findingHold]}
            >
              <View style={styles.findingHead}>
                <Text style={styles.findingWho}>{f.caregiver_name}</Text>
                <View
                  style={[styles.pill, f.severity === 'block' ? styles.pillBlock : f.released ? styles.pillPass : styles.pillHold]}
                >
                  <Text style={styles.pillText}>
                    {f.severity === 'block' ? 'Blocked' : f.released ? 'Released' : 'Hold'}
                  </Text>
                </View>
              </View>

              <Text style={styles.findingLabel}>{f.check_label}</Text>
              <Text style={styles.findingText}>{f.finding}</Text>

              {f.released ? (
                <Text style={styles.findingReleased}>
                  Released by {f.released_by ?? 'someone'} — “{f.release_reason}”
                </Text>
              ) : null}

              {/* A block never offers a release. The fix is at the source, and pretending
                  otherwise would be the app disagreeing with the rule. */}
              {f.releasable ? (
                releasing === f.id ? (
                  <View style={styles.releaseBox}>
                    <TextInput
                      value={reason}
                      onChangeText={setReason}
                      placeholder="Why this hold is being released"
                      style={styles.input}
                      multiline
                    />
                    <View style={styles.releaseActions}>
                      <Pressable style={styles.btnQuiet} onPress={() => setReleasing(null)}>
                        <Text style={styles.btnQuietText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.btn, (reason.trim().length < 4 || busy) && styles.btnOff]}
                        disabled={reason.trim().length < 4 || busy}
                        onPress={() => release(f.id)}
                      >
                        <Text style={styles.btnText}>Release</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    style={styles.releaseLink}
                    onPress={() => {
                      setReleasing(f.id);
                      setReason('');
                    }}
                  >
                    <Text style={styles.releaseLinkText}>Release this hold</Text>
                  </Pressable>
                )
              ) : f.severity === 'block' ? (
                <Text style={styles.fixAtSource}>Fix at the source, then run the checks again.</Text>
              ) : null}
            </View>
          ))
        )}

        {period?.is_open ? (
          <Pressable style={[styles.btnQuiet, busy && styles.btnOff]} disabled={busy} onPress={run}>
            <Text style={styles.btnQuietText}>{busy ? 'Working…' : 'Run the checks'}</Text>
          </Pressable>
        ) : null}

        <PayrollStageNav stage="gate" periodId={periodId} />
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 48 },
  lead: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 12 },

  state: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
  },
  stateOpen: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  stateShut: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  stateText: { flex: 1, fontSize: 13, fontWeight: '700' },
  stateTextOpen: { color: '#047857' },
  stateTextShut: { color: '#B91C1C' },

  finding: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  findingBlock: { borderColor: '#FECACA', borderLeftWidth: 4, borderLeftColor: '#B91C1C' },
  findingHold: { borderColor: '#FDE68A', borderLeftWidth: 4, borderLeftColor: '#B45309' },
  findingHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  findingWho: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0F172A' },
  findingLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#94A3B8',
    marginTop: 6,
  },
  findingText: { fontSize: 13, color: '#334155', marginTop: 3, lineHeight: 19 },
  findingReleased: { fontSize: 11.5, color: '#047857', marginTop: 6 },
  fixAtSource: { fontSize: 11.5, color: '#94A3B8', marginTop: 8, fontStyle: 'italic' },

  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  pillBlock: { backgroundColor: '#B91C1C' },
  pillHold: { backgroundColor: '#B45309' },
  pillPass: { backgroundColor: '#047857' },
  pillText: { fontSize: 10, fontWeight: '800', color: '#fff' },

  releaseLink: { marginTop: 10 },
  releaseLinkText: { fontSize: 13, fontWeight: '700', color: '#B4006E' },
  releaseBox: { marginTop: 10, gap: 10 },
  releaseActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 66,
    textAlignVertical: 'top',
    backgroundColor: '#F8FAFC',
  },

  btn: {
    backgroundColor: '#B4006E',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  btnOff: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnQuiet: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#fff',
    marginTop: 8,
  },
  btnQuietText: { color: '#334155', fontWeight: '600', fontSize: 14 },
});
