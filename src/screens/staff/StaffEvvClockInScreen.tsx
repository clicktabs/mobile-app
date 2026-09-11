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
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader, AppShell } from '../../components/chrome';
import { ErrorBanner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as evvApi from '../../api/evv';
import { ApiError } from '../../api/client';
import { showAlert } from '../../utils/confirm';
import { getWorkOffline } from '../../utils/offline';
import { colors } from '../../theme/colors';
import type { EvvVisit } from '../../types';
import type { StaffMenuStackParamList } from '../../navigation/types';

const SELF_CHECKS = [
  { id: 'ppe', label: 'Personal Protective Equipment (PPE) ready' },
  { id: 'hands', label: 'Sanitized hands' },
  { id: 'careplan', label: 'Care Plan tasks reviewed' },
] as const;

const DEFAULT_TOLERANCE_M = 152; // ~500 ft
const USE_WEBVIEW_MAP = Platform.OS === 'ios' || Platform.OS === 'android';

type Props = NativeStackScreenProps<StaffMenuStackParamList, 'MenuEvvClockIn'>;

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
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=16&size=600x320&markers=${lat},${lng},red-pushpin`;
}

function mapHtml(opts: {
  caregiverLat: number;
  caregiverLng: number;
  patientLat?: number | null;
  patientLng?: number | null;
  label: string;
}) {
  const { caregiverLat, caregiverLng, patientLat, patientLng, label } = opts;
  const hasPatient = patientLat != null && patientLng != null;
  const centerLat = hasPatient ? (caregiverLat + patientLat!) / 2 : caregiverLat;
  const centerLng = hasPatient ? (caregiverLng + patientLng!) / 2 : caregiverLng;
  const safeLabel = label.replace(/</g, '').replace(/>/g, '').replace(/"/g, "'");

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#map{margin:0;height:100%;width:100%;background:#e8eef5}
  .pin{background:#fff;border:2px solid #2563eb;border-radius:10px;padding:4px 8px;
       font:600 11px -apple-system,sans-serif;color:#059669;box-shadow:0 2px 8px rgba(0,0,0,.2);
       white-space:nowrap}
</style></head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map',{zoomControl:false,attributionControl:false}).setView([${centerLat},${centerLng}], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  var you = L.circleMarker([${caregiverLat},${caregiverLng}],{radius:9,color:'#fff',weight:2,fillColor:'#FF4D8D',fillOpacity:1}).addTo(map);
  you.bindPopup('You');
  ${
    hasPatient
      ? `
  L.circle([${patientLat},${patientLng}],{radius:${DEFAULT_TOLERANCE_M},color:'#38BEB9',fillColor:'#38BEB9',fillOpacity:0.12,weight:2}).addTo(map);
  var home = L.marker([${patientLat},${patientLng}]).addTo(map);
  home.bindPopup(${JSON.stringify(safeLabel)});
  var icon = L.divIcon({className:'',html:'<div class="pin">${safeLabel}</div>',iconSize:[160,28],iconAnchor:[80,36]});
  L.marker([${patientLat},${patientLng}],{icon:icon}).addTo(map);
  `
      : ''
  }
</script></body></html>`;
}

function LocationMapPreview({
  coords,
  patientLat,
  patientLng,
  label,
}: {
  coords: { latitude: number; longitude: number };
  patientLat?: number | null;
  patientLng?: number | null;
  label: string;
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
            caregiverLat: coords.latitude,
            caregiverLng: coords.longitude,
            patientLat,
            patientLng,
            label,
          }),
        }}
      />
    );
  }

  const openMaps = () => {
    const url = `https://www.openstreetmap.org/?mlat=${coords.latitude}&mlon=${coords.longitude}#map=16/${coords.latitude}/${coords.longitude}`;
    Linking.openURL(url).catch(() => undefined);
  };

  return (
    <Pressable style={styles.map} onPress={openMaps}>
      <Image
        source={{ uri: staticMapUri(coords.latitude, coords.longitude) }}
        style={styles.mapImage}
        resizeMode="cover"
      />
      <View style={styles.mapOverlay}>
        <Text style={styles.mapOverlayText}>{label}</Text>
        <Text style={styles.mapOverlaySub}>
          {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)} · tap to open map
        </Text>
      </View>
    </Pressable>
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

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const res = await evvApi.getEvvVisit(token, scheduleId);
      setVisit(res.visit);
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
        setLocError('Location permission is required for EVV clock-in.');
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
  const patientLat = patient?.latitude ?? null;
  const patientLng = patient?.longitude ?? null;
  const hasPatientCoords =
    patientLat != null && patientLng != null && Number.isFinite(patientLat) && Number.isFinite(patientLng);

  const geofence = useMemo(() => {
    if (!coords) return { status: 'waiting' as const, meters: null as number | null };
    if (!hasPatientCoords) return { status: 'skipped' as const, meters: null as number | null };
    const meters = haversineMeters(coords.latitude, coords.longitude, patientLat!, patientLng!);
    return {
      status: meters <= DEFAULT_TOLERANCE_M ? ('match' as const) : ('miss' as const),
      meters,
    };
  }, [coords, hasPatientCoords, patientLat, patientLng]);

  const allChecked = SELF_CHECKS.every((c) => checks[c.id]);
  const canStart =
    !!coords &&
    allChecked &&
    (geofence.status === 'match' || geofence.status === 'skipped') &&
    !submitting &&
    !visit?.evv?.check_in_time;

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
      const offline = await getWorkOffline();
      if (offline) {
        await evvApi.queueOfflineEvvEvent({
          type: 'checkin',
          patient_schedule_id: scheduleId,
          occurred_at: new Date().toISOString(),
          ...coords,
          verification_method: 'gps',
        });
        showAlert('Saved offline', 'Clock-in queued. It will sync when you are online.', 'info');
        navigation.goBack();
        return;
      }

      const res = await evvApi.evvCheckin(token, scheduleId, {
        ...coords,
        ...deviceMeta(),
        verification_method: 'gps',
      });
      showAlert('Visit started', res.check_in_time || res.message || 'Clock-in transmitted.', 'success');
      navigation.goBack();
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
          navigation.goBack();
          return;
        } catch {
          // fall through
        }
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
          { icon: 'close', onPress: () => navigation.goBack() },
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

          <Text style={styles.sectionTitle}>Current Location Check</Text>
          <View style={styles.mapCard}>
            {coords ? (
              <LocationMapPreview
                coords={coords}
                patientLat={patientLat}
                patientLng={patientLng}
                label={mapLabel}
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
            {geofence.status === 'miss' &&
              `Geofence Check: Outside area (${Math.round(geofence.meters || 0)} m; limit ${DEFAULT_TOLERANCE_M} m)`}
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
