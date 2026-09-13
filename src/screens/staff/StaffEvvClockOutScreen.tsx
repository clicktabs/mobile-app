import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader, AppShell } from '../../components/chrome';
import { ErrorBanner } from '../../components/ui';
import { SignaturePad } from '../../components/SignaturePad';
import { useAuth } from '../../context/AuthContext';
import * as evvApi from '../../api/evv';
import { ApiError } from '../../api/client';
import { showAlert } from '../../utils/confirm';
import { getWorkOffline } from '../../utils/offline';
import { safeGoBack } from '../../utils/navigation';
import { getGpsFix, formatLocationError } from '../../utils/location';
import { colors } from '../../theme/colors';
import type { EvvVisit } from '../../types';
import type { StaffMenuStackParamList } from '../../navigation/types';
import { OpenStreetMapView } from '../../components/OpenStreetMapView';
import { geofenceMetersFromFeet, formatFeet, formatGeofenceLimit } from '../../utils/geofence';

const CARE_TASKS = [
  { id: 'major_services', label: 'Major Services' },
  { id: 'vital_signs', label: 'Vital Signs (BP, HR, Pulse Ox)' },
  { id: 'wound_care', label: 'Wound Care (Dressing Change)' },
  { id: 'med_admin', label: 'Medication Administration' },
] as const;

const GEO_EXCEPTION_REASONS = [
  'Patient not at residence (community location)',
  'Patient transported / ER / facility',
  'GPS drift / poor signal',
  'Service delivered at alternate approved address',
  'Other (see notes)',
];

const TASK_EXCEPTION_REASONS = [
  'Patient refused',
  'Not ordered this visit',
  'Deferred to next visit',
  'Form / detail pending — reason documented',
  'Other',
];

type Props = NativeStackScreenProps<StaffMenuStackParamList, 'MenuEvvClockOut'>;

function goToMySchedule(navigation: Props['navigation']) {
  navigation.getParent()?.navigate('Schedule', { screen: 'ScheduleList' });
}

type TaskState = {
  id: string;
  label: string;
  completed: boolean;
  exception_reason: string | null;
  open: boolean;
};

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function deviceMeta() {
  return {
    device_id: 'click-tabs-mobile',
    app_version: '1.0.0',
    platform: Platform.OS,
  };
}

function ClockOutMap({
  out,
  inLat,
  inLng,
  homeLat,
  homeLng,
  geofenceMeters,
}: {
  out: { latitude: number; longitude: number };
  inLat?: number | null;
  inLng?: number | null;
  homeLat?: number | null;
  homeLng?: number | null;
  geofenceMeters: number;
}) {
  const pins: { id: string; lat: number; lng: number; title: string; geofenceMeters?: number }[] = [];
  if (homeLat != null && homeLng != null && Number.isFinite(homeLat) && Number.isFinite(homeLng)) {
    pins.push({
      id: 'home',
      lat: homeLat,
      lng: homeLng,
      title: 'Patient home',
      geofenceMeters,
    });
  }
  if (inLat != null && inLng != null && Number.isFinite(inLat) && Number.isFinite(inLng)) {
    pins.push({
      id: 'clock-in',
      lat: inLat,
      lng: inLng,
      title: 'Clock-In',
    });
  }

  return (
    <View style={styles.map}>
      <OpenStreetMapView
        user={{ lat: out.latitude, lng: out.longitude }}
        pins={pins}
      />
    </View>
  );
}

export function StaffEvvClockOutScreen({ navigation, route }: Props) {
  const { scheduleId } = route.params;
  const { token, handleUnauthorized } = useAuth();
  const [visit, setVisit] = useState<EvvVisit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number; gps_accuracy?: number } | null>(
    null,
  );
  const [locError, setLocError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskState[]>(
    CARE_TASKS.map((t) => ({
      id: t.id,
      label: t.label,
      completed: true,
      exception_reason: null,
      open: false,
    })),
  );
  const [attested, setAttested] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [geoException, setGeoException] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [syncHint, setSyncHint] = useState('Ready to transmit EVV');
  const [attestModalOpen, setAttestModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const res = await evvApi.getEvvVisit(token, scheduleId);
      setVisit(res.visit);
      if (!res.visit?.evv?.check_in_time) {
        setError('No active check-in for this visit. Clock in first.');
      }
      if (res.visit?.evv?.check_out_time) {
        setError('This visit is already checked out.');
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
  const homeLat = patient?.latitude ?? null;
  const homeLng = patient?.longitude ?? null;
  const inLat = visit?.evv?.gps_checkin?.latitude ?? null;
  const inLng = visit?.evv?.gps_checkin?.longitude ?? null;

  const geofenceFeet = visit?.geofence_tolerance_feet;
  const geofenceLimitM = geofenceMetersFromFeet(geofenceFeet);

  const geofence = useMemo(() => {
    if (!coords) return { status: 'waiting' as const, meters: null as number | null };
    if (homeLat == null || homeLng == null) return { status: 'skipped' as const, meters: null as number | null };
    const meters = haversineMeters(coords.latitude, coords.longitude, homeLat, homeLng);
    return {
      status: meters <= geofenceLimitM ? ('match' as const) : ('miss' as const),
      meters,
    };
  }, [coords, homeLat, homeLng, geofenceLimitM]);

  const incompleteTasks = tasks.filter((t) => !t.completed && !t.exception_reason);
  const exceptionsText = tasks
    .filter((t) => !t.completed && t.exception_reason)
    .map((t) => `${t.label}: ${t.exception_reason}`)
    .join('; ');

  const needsGeoException = geofence.status === 'miss';
  const tasksReady = incompleteTasks.length === 0 && !!coords && !!visit?.evv?.check_in_time && !visit?.evv?.check_out_time;
  const canOpenAttest = tasksReady && !submitting;
  const canSubmit =
    canOpenAttest &&
    attested &&
    !!signature &&
    (!needsGeoException || !!geoException);

  const distanceFromHome = useMemo(() => {
    if (!coords || homeLat == null || homeLng == null) return null;
    const meters = haversineMeters(coords.latitude, coords.longitude, homeLat, homeLng);
    const miles = meters / 1609.34;
    return { meters, miles };
  }, [coords, homeLat, homeLng]);

  const initials = (patient?.name || 'PT')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  const toggleTaskCompleted = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const nextCompleted = !t.completed;
        return {
          ...t,
          completed: nextCompleted,
          exception_reason: nextCompleted ? null : t.exception_reason,
          open: nextCompleted ? false : true,
        };
      }),
    );
  };

  const toggleTaskOpen = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id && !t.completed ? { ...t, open: !t.open } : t)),
    );
  };

  const setTaskException = (id: string, reason: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, exception_reason: reason, completed: false, open: true } : t,
      ),
    );
  };

  const onSubmit = async () => {
    if (!token || !coords || !canSubmit) return;
    setSubmitting(true);
    setSyncHint('Syncing with Sandata EVV…');
    try {
      const offline = await getWorkOffline();
      if (offline) {
        await evvApi.queueOfflineEvvEvent({
          type: 'checkout',
          patient_schedule_id: scheduleId,
          occurred_at: new Date().toISOString(),
          ...coords,
          verification_method: 'gps',
          notes: notes || undefined,
        });
        showAlert('Saved offline', 'Clock-out queued. It will sync when online.', 'info');
        goToMySchedule(navigation);
        return;
      }

      const res = await evvApi.evvCheckout(token, scheduleId, {
        ...coords,
        ...deviceMeta(),
        notes: notes || undefined,
        verification_method: 'gps',
        services_rendered: tasks.map((t) => ({
          id: t.id,
          label: t.label,
          completed: t.completed,
          exception_reason: t.exception_reason,
        })),
        patient_signature: signature || undefined,
        attestation_verified: true,
        geofence_exception_reason: geoException || undefined,
        location_type: needsGeoException ? 'community' : 'home',
      });

      setSyncHint(res.sandata_queued ? 'Queued for Sandata EVV' : 'Clock-out saved');
      showAlert(
        res.verification_status === 'verified' ? 'Clock-out · Verified' : 'Clock-out recorded',
        `${res.message || 'Submitted'}\nDuration: ${res.duration_minutes ?? '—'} min` +
          (res.sandata_queued ? '\nEVV transmission queued.' : ''),
        'success',
      );
      setAttestModalOpen(false);
      goToMySchedule(navigation);
    } catch (e) {
      setSyncHint('Ready to transmit EVV');
      if (e instanceof ApiError && e.status === 409 && /already checked out/i.test(e.message)) {
        showAlert('Already checked out', 'This visit is already closed.', 'info');
        goToMySchedule(navigation);
        return;
      }
      if (e instanceof ApiError && (e.payload as any)?.requires_geofence_exception) {
        showAlert('Geofence exception required', e.message, 'error');
        return;
      }
      if (!(e instanceof ApiError) || e.status === 0) {
        try {
          await evvApi.queueOfflineEvvEvent({
            type: 'checkout',
            patient_schedule_id: scheduleId,
            occurred_at: new Date().toISOString(),
            ...coords,
            verification_method: 'gps',
            notes: notes || undefined,
          });
          showAlert('Saved offline', 'Network issue — clock-out queued for sync.', 'info');
          goToMySchedule(navigation);
          return;
        } catch {
          // fall through
        }
      }
      showAlert('Clock-out failed', e instanceof ApiError ? e.message : 'Error', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <AppHeader
        title="Confirm Clock-Out"
        showLogo={false}
        actions={[
          {
            icon: 'refresh',
            onPress: () => {
              refreshLocation();
              load();
            },
          },
          { icon: 'close', onPress: () => safeGoBack(navigation, { tab: 'Schedule', screen: 'ScheduleList' }) },
        ]}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPink} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          {error ? <ErrorBanner message={error} /> : null}
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
                <Text style={styles.activeBadgeText}>Active</Text>
              </View>
            </View>
          </View>

          {/* Step 1 */}
          <Text style={styles.sectionTitle}>Step 1: Verify Tasks</Text>
          <View style={styles.card}>
            {tasks.map((t) => (
              <View key={t.id}>
                <View style={styles.taskRow}>
                  <Pressable
                    style={styles.checkboxHit}
                    onPress={() => toggleTaskCompleted(t.id)}
                    hitSlop={8}
                  >
                    <View style={[styles.checkbox, t.completed && styles.checkboxOn]}>
                      {t.completed ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                    </View>
                  </Pressable>
                  <Pressable
                    style={styles.taskLabelPress}
                    onPress={() => toggleTaskCompleted(t.id)}
                  >
                    <Text style={[styles.taskLabel, t.completed && styles.taskDone]}>{t.label}</Text>
                  </Pressable>
                  {!t.completed ? (
                    <Pressable onPress={() => toggleTaskOpen(t.id)} hitSlop={8}>
                      <Ionicons
                        name={t.open ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={colors.textMuted}
                      />
                    </Pressable>
                  ) : null}
                </View>
                {!t.completed && t.open ? (
                  <View style={styles.reasonWrap}>
                    <Text style={styles.reasonHint}>Exception reason required</Text>
                    {TASK_EXCEPTION_REASONS.map((r) => (
                      <Pressable key={r} style={styles.reasonChip} onPress={() => setTaskException(t.id, r)}>
                        <Text
                          style={[
                            styles.reasonChipText,
                            t.exception_reason === r && styles.reasonChipTextOn,
                          ]}
                        >
                          {r}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {!t.completed && t.exception_reason ? (
                  <Text style={styles.exceptionNote}>Exception: {t.exception_reason}</Text>
                ) : null}
              </View>
            ))}
            {exceptionsText ? (
              <View style={styles.exceptionsBox}>
                <Text style={styles.exceptionsTitle}>Exceptions</Text>
                <Text style={styles.exceptionsBody}>{exceptionsText}</Text>
              </View>
            ) : null}
          </View>

          {/* Step 2 */}
          <Text style={styles.sectionTitle}>Step 2: Log Locations</Text>
          <View style={styles.mapCard}>
            {coords ? (
              <ClockOutMap
                out={coords}
                inLat={inLat}
                inLng={inLng}
                homeLat={homeLat}
                homeLng={homeLng}
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
            ]}
          >
            {geofence.status === 'waiting' && 'Geofence Check: Waiting for GPS…'}
            {geofence.status === 'match' && 'Geofence Check: Matches residence'}
            {geofence.status === 'miss' &&
              `Clock-Out (Unmatched) — ${formatFeet(geofence.meters || 0)}; limit ${formatGeofenceLimit(geofenceFeet)} · exception required`}
            {geofence.status === 'skipped' && 'Geofence Check: No patient coordinates on file'}
          </Text>

          {coords ? (
            <Text style={styles.coordLine}>
              Clock-Out GPS: {coords.latitude.toFixed(4)} N, {Math.abs(coords.longitude).toFixed(4)} W
            </Text>
          ) : null}

          <View style={styles.syncRow}>
            <Ionicons name="sync" size={16} color={colors.brandPink} />
            <Text style={styles.syncText}>{syncHint}</Text>
          </View>

          <Text style={styles.sectionTitle}>Step 3: Attestation</Text>
          <Text style={styles.attestHint}>
            Patient/caregiver signature and geofence exception (if needed) are collected before
            transmitting EVV.
          </Text>

          <Pressable
            style={[styles.startBtn, !canOpenAttest && styles.startBtnDisabled]}
            disabled={!canOpenAttest}
            onPress={() => setAttestModalOpen(true)}
          >
            <Text style={styles.startBtnText}>SUBMIT CLOCK-OUT & TRANSMIT EVV</Text>
          </Pressable>
          <Pressable
            style={styles.cancelBtn}
            onPress={() => safeGoBack(navigation, { tab: 'Schedule', screen: 'ScheduleList' })}
          >
            <Text style={styles.cancelBtnText}>CANCEL / RETURN</Text>
          </Pressable>
        </ScrollView>
      )}

      <Modal visible={attestModalOpen} animationType="slide" transparent onRequestClose={() => setAttestModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Step 3: Attestation</Text>
            <Text style={styles.attestCopy}>
              By signing, the patient or designated representative confirms services were rendered
              according to the care plan for this visit.
            </Text>

            <Text style={styles.sigLabel}>Patient/Caregiver Signature</Text>
            <View style={styles.sigPadWrap}>
              <SignaturePad onChange={setSignature} height={120} />
            </View>

            <Pressable style={styles.taskRow} onPress={() => setAttested((v) => !v)}>
              <View style={[styles.checkbox, attested && styles.checkboxOn]}>
                {attested ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
              </View>
              <Text style={styles.taskLabel}>Verify tasks completed according to care plan.</Text>
            </Pressable>

            {needsGeoException ? (
              <View style={styles.geoExceptionBox}>
                <Text style={styles.geoExceptionTitle}>Proceed with Geofence Exception?</Text>
                {GEO_EXCEPTION_REASONS.map((r) => (
                  <Pressable key={r} style={styles.reasonChip} onPress={() => setGeoException(r)}>
                    <Text style={[styles.reasonChipText, geoException === r && styles.reasonChipTextOn]}>
                      {r}
                    </Text>
                  </Pressable>
                ))}
                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  placeholder="Exception notes (required if outside geofence)"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            ) : (
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="Visit notes (optional)"
                placeholderTextColor={colors.textMuted}
              />
            )}

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.confirmBtn, !canSubmit && styles.startBtnDisabled]}
                disabled={!canSubmit}
                onPress={onSubmit}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm</Text>
                )}
              </Pressable>
              <Pressable style={styles.editBtn} onPress={() => setAttestModalOpen(false)}>
                <Text style={styles.editBtnText}>Edit Visit</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
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
    marginTop: 6,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    marginBottom: 14,
    overflow: 'hidden',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  checkboxHit: { padding: 2 },
  taskLabelPress: { flex: 1 },
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
  taskLabel: { flex: 1, fontSize: 14, color: colors.text },
  taskDone: { color: colors.success, fontWeight: '600' },
  reasonWrap: { paddingHorizontal: 14, paddingBottom: 10, gap: 6 },
  reasonHint: { fontSize: 12, color: colors.warning, fontWeight: '600' },
  reasonChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FAFAFA',
  },
  reasonChipText: { fontSize: 13, color: colors.text },
  reasonChipTextOn: { color: colors.brandMagenta, fontWeight: '700' },
  exceptionNote: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    fontSize: 12,
    color: colors.warning,
  },
  exceptionsBox: {
    margin: 12,
    marginTop: 4,
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  exceptionsTitle: { fontWeight: '800', color: '#C2410C', marginBottom: 4 },
  exceptionsBody: { color: '#9A3412', fontSize: 13 },
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
  mapOverlayText: { fontWeight: '700', color: colors.danger, fontSize: 13 },
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
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  geofenceOk: { color: colors.success },
  geofenceBad: { color: colors.danger },
  coordLine: { fontSize: 12, color: colors.textMuted, marginBottom: 8 },
  attestHint: { fontSize: 13, color: colors.textMuted, marginBottom: 12, lineHeight: 18 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    paddingBottom: 28,
    maxHeight: '92%',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8 },
  sigLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 8, marginBottom: 6 },
  sigPadWrap: { marginBottom: 8 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  editBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  editBtnText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  syncText: { color: colors.brandPink, fontWeight: '600', fontSize: 13 },
  geoExceptionBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 12,
    marginBottom: 14,
    gap: 6,
  },
  geoExceptionTitle: { fontWeight: '800', color: '#991B1B', marginBottom: 4 },
  attestCopy: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  notesLabel: {
    marginTop: 10,
    marginHorizontal: 14,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  notesInput: {
    marginHorizontal: 14,
    marginBottom: 12,
    marginTop: 6,
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    color: colors.text,
    textAlignVertical: 'top',
  },
  startBtn: {
    backgroundColor: colors.crimson,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  startBtnDisabled: { opacity: 0.45 },
  startBtnText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.2 },
  cancelBtn: {
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: { color: colors.text, fontWeight: '700', fontSize: 13 },
});
