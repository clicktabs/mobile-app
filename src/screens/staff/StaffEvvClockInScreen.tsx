import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader, AppShell } from '../../components/chrome';
import { ErrorBanner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as evvApi from '../../api/evv';
import { ApiError } from '../../api/client';
import { showAlert } from '../../utils/confirm';
import { isOffline } from '../../utils/connectivity';
import { safeGoBack } from '../../utils/navigation';
import { getGpsFix, formatLocationError } from '../../utils/location';
import { colors } from '../../theme/colors';
import type { EvvVisit } from '../../types';
import type { StaffMenuStackParamList } from '../../navigation/types';
import { OpenStreetMapView } from '../../components/OpenStreetMapView';
import { formatGeofenceMiss, geofenceMatchMeters, isWithinGeofence } from '../../utils/geofence';
import { documentationRouteFor } from '../../utils/visitDocumentation';

const SELF_CHECKS = [
  { id: 'ppe', label: 'Personal Protective Equipment (PPE) ready' },
  { id: 'hands', label: 'Sanitized hands' },
  { id: 'careplan', label: 'Care Plan tasks reviewed' },
] as const;

type Props = NativeStackScreenProps<StaffMenuStackParamList, 'MenuEvvClockIn'>;

function deviceMeta() {
  return {
    device_id: 'click-tabs-mobile',
    app_version: '1.0.0',
    platform: Platform.OS,
  };
}

function goToVisitDocumentation(
  navigation: Props['navigation'],
  params: {
    scheduleId: number;
    patientId?: number;
    patientName?: string;
    startTime?: string;
  },
  taskType?: string | null,
) {
  // An aide gets the aide's form. This named SkilledNurseVisit outright, so every
  // discipline was handed the skilled-nursing assessment on clock-in.
  const screen = documentationRouteFor(taskType);

  navigation.getParent()?.navigate('Schedule', {
    screen,
    params: { ...params, ...(screen === 'SkilledNurseVisit' ? { evvFlow: true } : {}) },
  });
}

function LocationMapPreview({
  coords,
  patientLat,
  patientLng,
  label,
  geofenceMeters,
}: {
  coords: { latitude: number; longitude: number };
  patientLat?: number | null;
  patientLng?: number | null;
  label: string;
  geofenceMeters: number;
}) {
  const hasPatient =
    patientLat != null && patientLng != null && Number.isFinite(patientLat) && Number.isFinite(patientLng);

  return (
    <View style={styles.map}>
      <OpenStreetMapView
        user={{ lat: coords.latitude, lng: coords.longitude }}
        pins={
          hasPatient
            ? [
                {
                  id: 'home',
                  lat: patientLat!,
                  lng: patientLng!,
                  title: label,
                  geofenceMeters,
                },
              ]
            : []
        }
      />
    </View>
  );
}

export function StaffEvvClockInScreen({ navigation, route }: Props) {
  const { scheduleId } = route.params;
  const { token, handleUnauthorized } = useAuth();
  const [visit, setVisit] = useState<EvvVisit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number; gps_accuracy?: number } | null>(
    null,
  );
  const [locError, setLocError] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({
    ppe: false,
    hands: false,
    careplan: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [activeElsewhereId, setActiveElsewhereId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    setActiveElsewhereId(null);
    try {
      const [visitRes, listRes] = await Promise.all([
        evvApi.getEvvVisit(token, scheduleId),
        evvApi.getEvvVisits(token, { days_past: 30, days_ahead: 60, schedule_id: scheduleId }),
      ]);
      setVisit(visitRes.visit);
      const activeId = listRes.active_schedule_id ?? null;
      if (activeId != null && Number(activeId) !== Number(scheduleId)) {
        setActiveElsewhereId(Number(activeId));
        setError('You are already clocked in on another visit. Clock out there before starting this one.');
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Failed to load visit');
    } finally {
      setLoading(false);
    }
  }, [token, scheduleId, handleUnauthorized]);

  const refreshLocation = useCallback(async () => {
    setLocError(null);
    try {
      const loc = await getGpsFix();
      setCoords(loc);
    } catch (e) {
      setLocError(formatLocationError(e));
    }
  }, []);

  useEffect(() => {
    load();
    refreshLocation();
  }, [load, refreshLocation]);

  const patient = visit?.patient;
  const patientLat = patient?.latitude ?? null;
  const patientLng = patient?.longitude ?? null;
  const hasPatientCoords =
    patientLat != null && patientLng != null && Number.isFinite(patientLat) && Number.isFinite(patientLng);
  const geofenceLimitM = geofenceMatchMeters(coords?.gps_accuracy);

  const geofence = useMemo(() => {
    if (!coords) return { status: 'waiting' as const, meters: null as number | null };
    if (!hasPatientCoords) return { status: 'skipped' as const, meters: null as number | null };
    const near = isWithinGeofence(
      coords.latitude,
      coords.longitude,
      [{ latitude: patientLat!, longitude: patientLng! }],
      geofenceLimitM,
    );
    return {
      status: near.match ? ('match' as const) : ('miss' as const),
      meters: near.meters,
    };
  }, [coords, hasPatientCoords, patientLat, patientLng, geofenceLimitM]);

  const allChecked = SELF_CHECKS.every((c) => checks[c.id]);
  const canStart =
    !!coords &&
    allChecked &&
    (geofence.status === 'match' || geofence.status === 'skipped') &&
    !submitting &&
    !visit?.evv?.is_open_session &&
    !activeElsewhereId;

  const initials = (patient?.name || 'PT')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  const mapLabel =
    geofence.status === 'match'
      ? 'Clock-In (Matched)'
      : geofence.status === 'miss'
        ? 'Outside geofence'
        : 'Your location';

  const onStart = async () => {
    if (!token || !coords || !canStart) return;
    setSubmitting(true);
    try {
      // Detected automatically now, or forced by the caregiver — the branch is the same.
      const offline = isOffline();
      if (offline) {
        await evvApi.queueOfflineEvvEvent({
          type: 'checkin',
          patient_schedule_id: scheduleId,
          occurred_at: new Date().toISOString(),
          ...coords,
          verification_method: 'gps',
        });
        showAlert('Saved offline', 'Clock-in queued. It will sync when you are online.', 'info');
        goToVisitDocumentation(navigation, {
          scheduleId,
          patientId: patient?.id,
          patientName: patient?.name,
          startTime: visit?.start_datetime,
        }, visit?.task_type);
        return;
      }

      const res = await evvApi.evvCheckin(token, scheduleId, {
        ...coords,
        ...deviceMeta(),
        verification_method: 'gps',
      });
      showAlert('Visit started', res.check_in_time || res.message || 'Clock-in transmitted.', 'success');
      goToVisitDocumentation(navigation, {
        scheduleId,
        patientId: patient?.id,
        patientName: patient?.name,
        startTime: visit?.start_datetime,
      }, visit?.task_type);
    } catch (e) {
      if (!(e instanceof ApiError) || e.status === 0) {
        try {
          await evvApi.queueOfflineEvvEvent({
            type: 'checkin',
            patient_schedule_id: scheduleId,
            occurred_at: new Date().toISOString(),
            ...coords,
            verification_method: 'gps',
          });
          showAlert('Saved offline', 'Network issue — clock-in queued for sync.', 'info');
          goToVisitDocumentation(navigation, {
            scheduleId,
            patientId: patient?.id,
            patientName: patient?.name,
            startTime: visit?.start_datetime,
          }, visit?.task_type);
          return;
        } catch {
          // fall through
        }
      }
      if (e instanceof ApiError && e.status === 409) {
        const payload = e.payload as { active_schedule_id?: number; message?: string } | undefined;
        const msg = e.message || 'You are already clocked in on another visit.';
        showAlert('Clock-in blocked', msg, 'error');
        if (payload?.active_schedule_id) {
          navigation.replace('MenuEvvClockOut', { scheduleId: Number(payload.active_schedule_id) });
        }
        return;
      }
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Clock-in failed';
      showAlert('Clock-in failed', msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <AppHeader
        title="Pre-Visit Clock-In"
        showLogo={false}
        actions={[
          {
            icon: 'refresh',
            onPress: () => {
              refreshLocation();
              load();
            },
          },
          { icon: 'close', onPress: () => safeGoBack(navigation, { tab: 'Menu', screen: 'MenuEvv' }) },
        ]}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPink} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          {error ? <ErrorBanner message={error} onRetry={load} /> : null}
          {locError ? <ErrorBanner message={locError} onRetry={refreshLocation} /> : null}

          <View style={styles.patientRow}>
            {patient?.photo_url ? (
              <Image source={{ uri: patient.photo_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>{initials || '?'}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>{patient?.name || `Visit #${scheduleId}`}</Text>
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>
                  {(patient?.status || 'active').replace(/^./, (c) => c.toUpperCase())}
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Step 1: Validate Visit Details</Text>
          <View style={styles.visitMetaCard}>
            <MetaRow label="Visit Type" value={visit?.service_type || 'Home Health Visit'} />
            <MetaRow
              label="Date"
              value={
                visit?.start_datetime
                  ? new Date(visit.start_datetime).toLocaleDateString()
                  : new Date().toLocaleDateString()
              }
            />
            <MetaRow
              label="Scheduled Time"
              value={
                visit?.start_datetime
                  ? `${new Date(visit.start_datetime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${
                      visit.end_datetime
                        ? ` – ${new Date(visit.end_datetime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                        : ''
                    }`
                  : '—'
              }
            />
          </View>

          <Text style={styles.sectionTitle}>Current Location Check</Text>
          <View style={styles.mapCard}>
            {coords ? (
              <LocationMapPreview
                coords={coords}
                patientLat={patientLat}
                patientLng={patientLng}
                label={mapLabel}
                geofenceMeters={geofenceLimitM}
              />
            ) : (
              <View style={[styles.map, styles.mapPlaceholder]}>
                <ActivityIndicator color={colors.brandPink} />
                <Text style={styles.mapHint}>Reading GPS…</Text>
              </View>
            )}
            {patient?.address ? (
              <View style={styles.addrBar}>
                <Ionicons name="location" size={14} color={colors.brandPink} />
                <Text style={styles.addrText} numberOfLines={2}>
                  {patient.address}
                </Text>
              </View>
            ) : null}
          </View>

          <Text
            style={[
              styles.geofenceLine,
              geofence.status === 'match' && styles.geofenceOk,
              geofence.status === 'miss' && styles.geofenceBad,
              geofence.status === 'skipped' && styles.geofenceWarn,
            ]}
          >
            {geofence.status === 'waiting' && 'Geofence Check: Waiting for GPS…'}
            {geofence.status === 'match' &&
              `Geofence Check: Matches (${patient?.name || 'Patient'}'s Residence)`}
            {geofence.status === 'miss' && formatGeofenceMiss(geofence.meters || 0)}
            {geofence.status === 'skipped' &&
              'Geofence Check: No patient coordinates on file — office may verify later'}
          </Text>

          <Text style={styles.sectionTitle}>Step 2: Pre-Visit Self-Check</Text>
          <View style={styles.checkCard}>
            {SELF_CHECKS.map((item) => {
              const on = !!checks[item.id];
              return (
                <Pressable
                  key={item.id}
                  style={styles.checkRow}
                  onPress={() => setChecks((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                >
                  <View style={[styles.checkbox, on && styles.checkboxOn]}>
                    {on ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                  </View>
                  <Text style={[styles.checkLabel, on && styles.checkLabelOn]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {activeElsewhereId ? (
            <Pressable
              style={styles.startBtn}
              onPress={() => navigation.replace('MenuEvvClockOut', { scheduleId: activeElsewhereId })}
            >
              <Text style={styles.startBtnText}>GO TO ACTIVE VISIT CLOCK-OUT</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
            disabled={!canStart}
            onPress={onStart}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.startBtnText}>START VISIT & TRANSMIT CLOCK-IN</Text>
            )}
          </Pressable>

          <Pressable style={styles.cancelBtn} onPress={() => safeGoBack(navigation, { tab: 'Menu', screen: 'MenuEvv' })}>
            <Text style={styles.cancelBtnText}>CANCEL / RETURN</Text>
          </Pressable>
        </ScrollView>
      )}
    </AppShell>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40 },
  visitMetaCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  metaLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  metaValue: { fontSize: 13, color: colors.text, fontWeight: '700', flex: 1, textAlign: 'right' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarFallback: {
    backgroundColor: '#FFE4EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: colors.brandPink },
  patientName: { fontSize: 20, fontWeight: '700', color: colors.text },
  activeBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  activeBadgeText: { color: '#047857', fontWeight: '700', fontSize: 12 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
    marginTop: 4,
  },
  mapCard: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  map: { height: 240, width: '100%', backgroundColor: '#EEF2F7', overflow: 'hidden' },
  mapImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  mapOverlay: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  mapOverlayText: { fontWeight: '700', color: colors.success, fontSize: 13 },
  mapOverlaySub: { marginTop: 2, color: colors.textMuted, fontSize: 11 },
  mapPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  mapHint: { color: colors.textMuted, fontSize: 13 },
  addrBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addrText: { flex: 1, fontSize: 12, color: colors.textMuted },
  geofenceLine: {
    marginTop: 10,
    marginBottom: 18,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  geofenceOk: { color: colors.success },
  geofenceBad: { color: colors.danger },
  geofenceWarn: { color: colors.warning },
  checkCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 4,
    marginBottom: 20,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.success, borderColor: colors.success },
  checkLabel: { flex: 1, fontSize: 14, color: colors.text },
  checkLabelOn: { color: colors.success, fontWeight: '600' },
  startBtn: {
    backgroundColor: colors.crimson,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  startBtnDisabled: { opacity: 0.45 },
  startBtnText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },
  cancelBtn: {
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: { color: colors.text, fontWeight: '700', fontSize: 13 },
});
