import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader, AppShell } from '../../components/chrome';
import { ErrorBanner } from '../../components/ui';
import { SignaturePad } from '../../components/SignaturePad';
import { useAuth } from '../../context/AuthContext';
import * as evvApi from '../../api/evv';
import { ApiError } from '../../api/client';
import { showAlert } from '../../utils/confirm';
import { getWorkOffline } from '../../utils/offline';
import { colors } from '../../theme/colors';
import type { EvvVisit } from '../../types';
import type { StaffMenuStackParamList } from '../../navigation/types';

const DEFAULT_TOLERANCE_M = 152;
const USE_WEBVIEW_MAP = Platform.OS === 'ios' || Platform.OS === 'android';

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

function staticMapUri(lat: number, lng: number) {
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=600x320&markers=${lat},${lng},red-pushpin`;
}

function mapHtml(opts: {
  outLat: number;
  outLng: number;
  inLat?: number | null;
  inLng?: number | null;
  homeLat?: number | null;
  homeLng?: number | null;
}) {
  const { outLat, outLng, inLat, inLng, homeLat, homeLng } = opts;
  const pts = [
    [outLat, outLng],
    inLat != null && inLng != null ? [inLat, inLng] : null,
    homeLat != null && homeLng != null ? [homeLat, homeLng] : null,
  ].filter(Boolean) as number[][];
  const centerLat = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const centerLng = pts.reduce((s, p) => s + p[1], 0) / pts.length;

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{margin:0;height:100%;width:100%;background:#e8eef5}
.pin{background:#fff;border-radius:8px;padding:3px 7px;font:600 10px -apple-system,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.18);white-space:nowrap}
.pin-in{border:2px solid #2563eb;color:#047857}.pin-out{border:2px solid #dc2626;color:#b91c1c}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map=L.map('map',{zoomControl:false,attributionControl:false}).setView([${centerLat},${centerLng}],15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
${
  homeLat != null && homeLng != null
    ? `L.circle([${homeLat},${homeLng}],{radius:${DEFAULT_TOLERANCE_M},color:'#38BEB9',fillColor:'#38BEB9',fillOpacity:0.12,weight:2}).addTo(map);`
    : ''
}
${
  inLat != null && inLng != null
    ? `L.marker([${inLat},${inLng}],{icon:L.divIcon({className:'',html:'<div class="pin pin-in">Clock-In (Matched)</div>',iconSize:[140,24],iconAnchor:[70,30]})}).addTo(map);
L.circleMarker([${inLat},${inLng}],{radius:8,color:'#fff',weight:2,fillColor:'#2563eb',fillOpacity:1}).addTo(map);`
    : ''
}
L.marker([${outLat},${outLng}],{icon:L.divIcon({className:'',html:'<div class="pin pin-out">Clock-Out</div>',iconSize:[100,24],iconAnchor:[50,30]})}).addTo(map);
L.circleMarker([${outLat},${outLng}],{radius:8,color:'#fff',weight:2,fillColor:'#dc2626',fillOpacity:1}).addTo(map);
</script></body></html>`;
}

function ClockOutMap({
  out,
  inLat,
  inLng,
  homeLat,
  homeLng,
}: {
  out: { latitude: number; longitude: number };
  inLat?: number | null;
  inLng?: number | null;
  homeLat?: number | null;
  homeLng?: number | null;
}) {
  if (USE_WEBVIEW_MAP) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { WebView } = require('react-native-webview');
    return (
      <WebView
        originWhitelist={['*']}
        style={styles.map}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        source={{
          html: mapHtml({
            outLat: out.latitude,
            outLng: out.longitude,
            inLat,
            inLng,
            homeLat,
            homeLng,
          }),
        }}
      />
    );
  }

  return (
    <Pressable
      style={styles.map}
      onPress={() =>
        Linking.openURL(
          `https://www.openstreetmap.org/?mlat=${out.latitude}&mlon=${out.longitude}#map=15/${out.latitude}/${out.longitude}`,
        ).catch(() => undefined)
      }
    >
      <Image
        source={{ uri: staticMapUri(out.latitude, out.longitude) }}
        style={styles.mapImage}
        resizeMode="cover"
      />
      <View style={styles.mapOverlay}>
        <Text style={styles.mapOverlayText}>Clock-Out GPS</Text>
        <Text style={styles.mapOverlaySub}>
          {out.latitude.toFixed(4)}, {out.longitude.toFixed(4)}
        </Text>
      </View>
    </Pressable>
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
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocError('Location permission is required for EVV clock-out.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        gps_accuracy: loc.coords.accuracy ?? undefined,
      });
    } catch (e) {
      setLocError(e instanceof Error ? e.message : 'Unable to read GPS');
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

  const geofence = useMemo(() => {
    if (!coords) return { status: 'waiting' as const, meters: null as number | null };
    if (homeLat == null || homeLng == null) return { status: 'skipped' as const, meters: null as number | null };
    const meters = haversineMeters(coords.latitude, coords.longitude, homeLat, homeLng);
    return {
      status: meters <= DEFAULT_TOLERANCE_M ? ('match' as const) : ('miss' as const),
      meters,
    };
  }, [coords, homeLat, homeLng]);

  const incompleteTasks = tasks.filter((t) => !t.completed && !t.exception_reason);
  const exceptionsText = tasks
    .filter((t) => !t.completed && t.exception_reason)
    .map((t) => `${t.label}: ${t.exception_reason}`)
    .join('; ');

  const needsGeoException = geofence.status === 'miss';
  const canSubmit =
    !!coords &&
    attested &&
    !!signature &&
    incompleteTasks.length === 0 &&
    (!needsGeoException || !!geoException) &&
    !submitting &&
    !!visit?.evv?.check_in_time &&
    !visit?.evv?.check_out_time;

  const initials = (patient?.name || 'PT')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              completed: !t.completed,
              exception_reason: !t.completed ? null : t.exception_reason,
              open: t.completed ? true : false,
            }
          : t,
      ),
    );
  };

  const setTaskException = (id: string, reason: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exception_reason: reason, completed: false, open: false } : t)),
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
        navigation.goBack();
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
      navigation.goBack();
    } catch (e) {
      setSyncHint('Ready to transmit EVV');
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
          navigation.goBack();
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
          { icon: 'close', onPress: () => navigation.goBack() },
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
                <Pressable style={styles.taskRow} onPress={() => toggleTask(t.id)}>
                  <View style={[styles.checkbox, t.completed && styles.checkboxOn]}>
                    {t.completed ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                  </View>
                  <Text style={[styles.taskLabel, t.completed && styles.taskDone]}>{t.label}</Text>
                  <Ionicons
                    name={t.open ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textMuted}
                    onPress={() =>
                      setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, open: !x.open } : x)))
                    }
                  />
                </Pressable>
                {!t.completed && (t.open || !t.exception_reason) ? (
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
              `Geofence Check: Outside (${Math.round(geofence.meters || 0)} m) — exception required`}
            {geofence.status === 'skipped' && 'Geofence Check: No patient coordinates on file'}
          </Text>

          <View style={styles.syncRow}>
            <Ionicons name="sync" size={16} color={colors.brandPink} />
            <Text style={styles.syncText}>{syncHint}</Text>
          </View>

          {needsGeoException ? (
            <View style={styles.geoExceptionBox}>
              <Text style={styles.geoExceptionTitle}>Proceed with clock-out with Geofence Exception?</Text>
              {GEO_EXCEPTION_REASONS.map((r) => (
                <Pressable key={r} style={styles.reasonChip} onPress={() => setGeoException(r)}>
                  <Text style={[styles.reasonChipText, geoException === r && styles.reasonChipTextOn]}>
                    {r}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* Step 3 */}
          <Text style={styles.sectionTitle}>Step 3: Attestation</Text>
          <View style={styles.card}>
            <Text style={styles.attestCopy}>
              By signing, the patient or designated representative confirms services were rendered
              according to the care plan for this visit.
            </Text>
            <Pressable style={styles.taskRow} onPress={() => setAttested((v) => !v)}>
              <View style={[styles.checkbox, attested && styles.checkboxOn]}>
                {attested ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
              </View>
              <Text style={styles.taskLabel}>Verify tasks completed according to care plan.</Text>
            </Pressable>
            <View style={{ paddingHorizontal: 14, paddingBottom: 4 }}>
              <SignaturePad onChange={setSignature} height={140} />
            </View>
            <Text style={styles.notesLabel}>Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Visit notes / exception detail"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <Pressable
            style={[styles.startBtn, !canSubmit && styles.startBtnDisabled]}
            disabled={!canSubmit}
            onPress={onSubmit}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.startBtnText}>SUBMIT CLOCK-OUT & TRANSMIT EVV</Text>
            )}
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelBtnText}>CANCEL / RETURN</Text>
          </Pressable>
        </ScrollView>
      )}
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
  map: { height: 200, width: '100%', backgroundColor: '#EEF2F7' },
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
