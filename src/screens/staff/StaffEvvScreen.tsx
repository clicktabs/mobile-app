import React, { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
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
import { getWorkOffline } from '../../utils/offline';

async function getCoords() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission is required for EVV check-in and check-out.');
  }
  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    gps_accuracy: loc.coords.accuracy ?? undefined,
  };
}

function deviceMeta() {
  return {
    device_id: 'click-tabs-mobile',
    app_version: '1.0.0',
    platform: Platform.OS,
  };
}

type Method = 'gps' | 'telephony' | 'biometric';

export function StaffEvvScreen({ embedded = false }: { embedded?: boolean }) {
  const navigation = useNavigation<any>();
  const { token, handleUnauthorized } = useAuth();
  const [visits, setVisits] = useState<EvvVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [method, setMethod] = useState<Method>('gps');
  const [pendingOffline, setPendingOffline] = useState(0);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const flushed = await evvApi.flushQueueEvvSafe(token);
      if (flushed > 0) {
        showAlert('Offline EVV synced', `${flushed} event(s) uploaded.`, 'success');
      }
      const res = await evvApi.getEvvVisits(token);
      setVisits(res.visits || []);
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
  }, [token, handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const openClockIn = (scheduleId: number) => {
    navigation.navigate('MenuEvvClockIn', { scheduleId });
  };

  const checkInAlt = async (scheduleId: number) => {
    if (!token) return;
    setBusyId(scheduleId);
    try {
      const coords = await getCoords();
      let telephony_session_id: string | undefined;
      if (method === 'telephony') {
        const tel = await evvApi.initiateTelephony(token, scheduleId);
        telephony_session_id = tel.session_id;
      }

      const offline = await getWorkOffline();
      if (offline) {
        await evvApi.queueOfflineEvvEvent({
          type: 'checkin',
          patient_schedule_id: scheduleId,
          occurred_at: new Date().toISOString(),
          ...coords,
          verification_method: method,
        });
        showAlert('Saved offline', 'Check-in queued. It will sync when you are online.', 'info');
        setPendingOffline(await evvApi.pendingOfflineEvvCount());
        return;
      }

      const res = await evvApi.evvCheckin(token, scheduleId, {
        ...coords,
        ...deviceMeta(),
        verification_method: method,
        telephony_session_id,
        biometric_attestation: method === 'biometric' ? `device-attestation-${Date.now()}` : undefined,
      });
      showAlert('Checked in', res.check_in_time || res.message || 'Success', 'success');
      await load();
    } catch (e) {
      if (!(e instanceof ApiError) || e.status === 0) {
        try {
          const coords = await getCoords();
          await evvApi.queueOfflineEvvEvent({
            type: 'checkin',
            patient_schedule_id: scheduleId,
            occurred_at: new Date().toISOString(),
            ...coords,
            verification_method: method,
          });
          showAlert('Saved offline', 'Network issue — check-in queued for sync.', 'info');
          setPendingOffline(await evvApi.pendingOfflineEvvCount());
          return;
        } catch {
          // fall through
        }
      }
      showAlert('Check-in failed', e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const checkOut = async (scheduleId: number) => {
    if (!token) return;
    setBusyId(scheduleId);
    try {
      const coords = await getCoords();
      const offline = await getWorkOffline();
      if (offline) {
        await evvApi.queueOfflineEvvEvent({
          type: 'checkout',
          patient_schedule_id: scheduleId,
          occurred_at: new Date().toISOString(),
          ...coords,
          verification_method: method,
          notes: notes || undefined,
        });
        showAlert('Saved offline', 'Check-out queued for sync.', 'info');
        setNotes('');
        setPendingOffline(await evvApi.pendingOfflineEvvCount());
        return;
      }

      const res = await evvApi.evvCheckout(token, scheduleId, {
        ...coords,
        ...deviceMeta(),
        notes: notes || undefined,
        verification_method: method,
      });
      showAlert(
        res.verification_status === 'verified' ? 'Checked out · Verified' : 'Checked out',
        `Duration: ${res.duration_minutes ?? '—'} min` +
          (res.verification_status ? `\nStatus: ${res.verification_status}` : ''),
        'success',
      );
      setNotes('');
      await load();
    } catch (e) {
      if (!(e instanceof ApiError) || e.status === 0) {
        try {
          const coords = await getCoords();
          await evvApi.queueOfflineEvvEvent({
            type: 'checkout',
            patient_schedule_id: scheduleId,
            occurred_at: new Date().toISOString(),
            ...coords,
            verification_method: method,
            notes: notes || undefined,
          });
          showAlert('Saved offline', 'Network issue — check-out queued for sync.', 'info');
          setPendingOffline(await evvApi.pendingOfflineEvvCount());
          return;
        } catch {
          // fall through
        }
      }
      showAlert('Check-out failed', e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <LoadingBlock />;

  const body = (
    <View style={styles.root}>
      <Subtitle>
        GPS check-in/out with geofence. Verified visits go to Sandata and payroll.
        {pendingOffline > 0 ? ` · ${pendingOffline} offline event(s) pending` : ''}
      </Subtitle>

      <View style={styles.methodRow}>
        {(['gps', 'telephony', 'biometric'] as const).map((m) => {
          const active = method === m;
          if (active) {
            return (
              <Pressable key={m} onPress={() => setMethod(m)} style={styles.methodOuter}>
                <LinearGradient
                  colors={[...colors.brandGradient]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.methodPillActive}
                >
                  <Text style={styles.methodTextActive}>{m.toUpperCase()}</Text>
                </LinearGradient>
              </Pressable>
            );
          }
          return (
            <Pressable key={m} onPress={() => setMethod(m)} style={styles.methodPill}>
              <Text style={styles.methodText}>{m.toUpperCase()}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.notesLabel}>Checkout notes (optional)</Text>
      <TextInput
        style={styles.notesInput}
        value={notes}
        onChangeText={setNotes}
        placeholder=""
        placeholderTextColor={colors.textMuted}
        multiline
      />

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

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
        {visits.length === 0 ? (
          <EmptyState message="No EVV visits in range" />
        ) : (
          visits.map((v) => {
            const checkedIn = !!v.evv?.check_in_time;
            const checkedOut = !!v.evv?.check_out_time;
            const title =
              (v.patient?.name && v.patient.name.trim()) ||
              (v.patient?.address ? v.patient.address.split(',')[0] : null) ||
              `Visit #${v.id}`;
            const status = checkedOut
              ? `EVV: Checked out (${v.evv?.verification_status || 'pending'})`
              : checkedIn
                ? 'EVV: Checked in'
                : 'EVV: Not started';

            return (
              <View key={v.id} style={styles.card}>
                <Text style={styles.cardTitle}>{title}</Text>
                {v.start_datetime ? (
                  <Text style={styles.cardMeta}>
                    {new Date(v.start_datetime).toLocaleString()}
                  </Text>
                ) : null}
                {v.patient?.address ? (
                  <Text style={styles.cardMeta} numberOfLines={2}>
                    {v.patient.address}
                  </Text>
                ) : null}
                <Text style={styles.cardStatus}>{status}</Text>

                {!checkedIn ? (
                  method === 'gps' ? (
                    <Pressable
                      style={styles.ctaOuter}
                      onPress={() => openClockIn(v.id)}
                    >
                      <LinearGradient
                        colors={[...colors.brandGradient]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.ctaFill}
                      >
                        <Text style={styles.ctaText}>Pre-Visit Clock-In</Text>
                      </LinearGradient>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={styles.ctaOuter}
                      disabled={busyId === v.id}
                      onPress={() => checkInAlt(v.id)}
                    >
                      <LinearGradient
                        colors={[...colors.brandGradient]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.ctaFill}
                      >
                        <Text style={styles.ctaText}>
                          {busyId === v.id ? 'Working…' : `Check in (${method})`}
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  )
                ) : !checkedOut ? (
                  <Pressable style={styles.ctaOuter} onPress={() => navigation.navigate('MenuEvvClockOut', { scheduleId: v.id })}>
                    <LinearGradient
                      colors={[...colors.brandGradient]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.ctaFill}
                    >
                      <Text style={styles.ctaText}>Confirm Clock-Out</Text>
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

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  methodRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginBottom: 14,
  },
  methodOuter: { flex: 1 },
  methodPillActive: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  methodPill: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  methodTextActive: { color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 0.3 },
  methodText: { color: colors.brandMagenta, fontWeight: '700', fontSize: 12, letterSpacing: 0.3 },
  notesLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 6 },
  notesInput: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    color: colors.text,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  listPad: { paddingBottom: 28 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardMeta: { marginTop: 4, fontSize: 13, color: colors.textMuted },
  cardStatus: { marginTop: 6, fontSize: 13, color: colors.textMuted },
  ctaOuter: { marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  ctaFill: { paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
