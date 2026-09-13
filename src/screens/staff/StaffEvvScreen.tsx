import React, { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  Screen,
  Subtitle,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as evvApi from '../../api/evv';
import { ApiError } from '../../api/client';
import { showAlert } from '../../utils/confirm';
import type { EvvVisit } from '../../types';
import { colors } from '../../theme/colors';

function formatVisitTime(start?: string, end?: string) {
  if (!start) return '';
  const s = new Date(start);
  const startStr = s.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (!end) return startStr;
  const e = new Date(end);
  const endStr = e.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${startStr} – ${endStr}`;
}

function formatVisitDate(dt?: string) {
  if (!dt) return '';
  return new Date(dt).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function sameId(a?: number | string | null, b?: number | string | null) {
  if (a == null || b == null) return false;
  const left = Number(a);
  const right = Number(b);
  return Number.isFinite(left) && Number.isFinite(right) && left === right;
}

function visitTitle(v: EvvVisit) {
  return (
    (v.patient?.name && v.patient.name.trim()) ||
    (v.patient?.address ? v.patient.address.split(',')[0] : null) ||
    `Visit #${v.id}`
  );
}

export function StaffEvvScreen({
  embedded = false,
  focusScheduleId,
}: {
  embedded?: boolean;
  focusScheduleId?: number;
}) {
  const navigation = useNavigation<any>();
  const { token, handleUnauthorized } = useAuth();
  const [visits, setVisits] = useState<EvvVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingOffline, setPendingOffline] = useState(0);
  const [activeScheduleId, setActiveScheduleId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const flushed = await evvApi.flushQueueEvvSafe(token);
      if (flushed > 0) {
        showAlert('Offline EVV synced', `${flushed} event(s) uploaded.`, 'success');
      }
      const res = await evvApi.getEvvVisits(token, {
        days_past: 30,
        days_ahead: 60,
        schedule_id: focusScheduleId,
      });
      setVisits(res.visits || []);
      setActiveScheduleId(res.active_schedule_id ?? null);
      setPendingOffline(await evvApi.pendingOfflineEvvCount());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Failed to load EVV visits');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, handleUnauthorized, focusScheduleId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  if (loading) return <LoadingBlock />;

  const activeVisit = visits.find((v) => sameId(v.id, activeScheduleId)) ?? null;
  const focusedOnActive = !!focusScheduleId && sameId(focusScheduleId, activeScheduleId);
  const listVisits = focusScheduleId
    ? visits.filter((v) => sameId(v.id, focusScheduleId))
    : visits;

  const openActiveSchedule = () => {
    if (!activeScheduleId) return;
    navigation.navigate('MenuEvv', { scheduleId: activeScheduleId });
  };

  const body = (
    <View style={styles.root}>
      <Subtitle>
        Clock-in → document care → clock-out. GPS verified visits sync to Sandata and payroll.
        {pendingOffline > 0 ? ` · ${pendingOffline} offline event(s) pending` : ''}
      </Subtitle>

      <View style={styles.flowLegend}>
        <FlowStep n={1} label="Clock-In" />
        <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        <FlowStep n={2} label="Shift Note" />
        <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        <FlowStep n={3} label="Clock-Out" />
      </View>

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {activeVisit && !focusedOnActive ? (
        <Pressable style={styles.activeLink} onPress={openActiveSchedule}>
          <View style={styles.activeLinkIcon}>
            <Ionicons name="time" size={18} color="#1D4ED8" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.activeLinkKicker}>Currently clocked in</Text>
            <Text style={styles.activeLinkTitle} numberOfLines={1}>
              {visitTitle(activeVisit)}
            </Text>
            {activeVisit.start_datetime ? (
              <Text style={styles.activeLinkMeta} numberOfLines={1}>
                {formatVisitDate(activeVisit.start_datetime)}
                {formatVisitTime(activeVisit.start_datetime, activeVisit.end_datetime)
                  ? ` · ${formatVisitTime(activeVisit.start_datetime, activeVisit.end_datetime)}`
                  : ''}
              </Text>
            ) : null}
            <Text style={styles.activeLinkCta}>Open this schedule to clock out</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#1D4ED8" />
        </Pressable>
      ) : null}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.listPad}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.brandPink}
          />
        }
      >
        {listVisits.length === 0 ? (
          <EmptyState
            message={
              focusScheduleId
                ? 'This schedule is not ready for EVV clock-in.'
                : 'No EVV visits in range'
            }
          />
        ) : (
          listVisits.map((v) => {
            const scheduleDone = (v.status || '').toLowerCase() === 'completed';
            const lastSessionClosed = !!v.evv?.check_out_time && !v.evv?.is_open_session;
            const isActiveSession = sameId(v.id, activeScheduleId) && !!v.evv?.is_open_session;
            const blockedByOther = !!activeScheduleId && !sameId(v.id, activeScheduleId);
            const canClockIn = !isActiveSession && !scheduleDone;
            const title = visitTitle(v);
            const phase = scheduleDone ? 3 : isActiveSession ? 2 : 1;

            return (
              <View key={v.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{title}</Text>
                    {v.service_type ? (
                      <Text style={styles.cardMeta}>{v.service_type}</Text>
                    ) : null}
                    {v.start_datetime ? (
                      <Text style={styles.cardMeta}>
                        {formatVisitDate(v.start_datetime)} · {formatVisitTime(v.start_datetime, v.end_datetime)}
                      </Text>
                    ) : null}
                    {v.patient?.address ? (
                      <Text style={styles.cardMeta} numberOfLines={2}>
                        {v.patient.address}
                      </Text>
                    ) : null}
                  </View>
                  <PhaseBadge
                    phase={phase}
                    checkedOut={scheduleDone}
                    status={v.evv?.verification_status}
                  />
                </View>

                <Text style={styles.cardStatus}>
                  {scheduleDone
                    ? `Schedule completed · ${v.evv?.verification_status || 'pending verification'}`
                    : isActiveSession
                      ? `In progress · clocked in ${new Date(v.evv!.check_in_time!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                      : blockedByOther
                        ? 'Clock out of your active visit before starting here'
                        : lastSessionClosed
                          ? 'Last session clocked out — clock in again for this schedule'
                          : 'Not started — clock in on arrival'}
                </Text>

                {isActiveSession ? (
                  <Pressable
                    style={styles.ctaOuter}
                    onPress={() => navigation.navigate('MenuEvvClockOut', { scheduleId: v.id })}
                  >
                    <LinearGradient
                      colors={['#DC2626', '#B91C1C']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.ctaFill}
                    >
                      <Text style={styles.ctaText}>CONFIRM CLOCK-OUT</Text>
                    </LinearGradient>
                  </Pressable>
                ) : canClockIn ? (
                  <Pressable
                    style={[styles.ctaOuter, blockedByOther && styles.ctaDisabled]}
                    disabled={blockedByOther}
                    onPress={() => navigation.navigate('MenuEvvClockIn', { scheduleId: v.id })}
                  >
                    <LinearGradient
                      colors={[...colors.brandGradient]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.ctaFill, blockedByOther && { opacity: 0.45 }]}
                    >
                      <Text style={styles.ctaText}>PRE-VISIT CLOCK-IN</Text>
                    </LinearGradient>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );

  if (embedded) return <View style={{ flex: 1 }}>{body}</View>;
  return <Screen>{body}</Screen>;
}

function FlowStep({ n, label }: { n: number; label: string }) {
  return (
    <View style={styles.flowStep}>
      <View style={styles.flowNum}>
        <Text style={styles.flowNumText}>{n}</Text>
      </View>
      <Text style={styles.flowLabel}>{label}</Text>
    </View>
  );
}

function PhaseBadge({
  phase,
  checkedOut,
  status,
}: {
  phase: number;
  checkedOut: boolean;
  status?: string;
}) {
  const bg = checkedOut
    ? status === 'verified'
      ? '#D1FAE5'
      : '#FEF3C7'
    : phase === 2
      ? '#DBEAFE'
      : '#F3F4F6';
  const color = checkedOut
    ? status === 'verified'
      ? '#047857'
      : '#B45309'
    : phase === 2
      ? '#1D4ED8'
      : colors.textMuted;

  const label = checkedOut ? 'Done' : phase === 2 ? 'Active' : 'Pending';

  return (
    <View style={[styles.phaseBadge, { backgroundColor: bg }]}>
      <Text style={[styles.phaseBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  flowLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    marginBottom: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flowStep: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flowNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.brandPink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowNumText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  flowLabel: { fontSize: 11, fontWeight: '600', color: colors.text },
  activeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#93C5FD',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  activeLinkIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeLinkKicker: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  activeLinkTitle: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  activeLinkMeta: {
    marginTop: 2,
    fontSize: 12,
    color: '#1E40AF',
  },
  activeLinkCta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: colors.brandMagenta,
    textDecorationLine: 'underline',
  },
  listPad: { paddingBottom: 28 },
  ctaDisabled: { opacity: 0.7 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardMeta: { marginTop: 4, fontSize: 13, color: colors.textMuted },
  cardStatus: { marginTop: 10, fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  phaseBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  phaseBadgeText: { fontSize: 11, fontWeight: '700' },
  ctaOuter: { marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  ctaFill: { paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.2 },
});
