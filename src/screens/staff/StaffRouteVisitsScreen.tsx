import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, AppShell } from '../../components/chrome';
import { OpenStreetMapView, type MapPin } from '../../components/OpenStreetMapView';
import { ErrorBanner, LoadingBlock } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';
import type { ScheduleItem } from '../../types';
import type { StaffHomeStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { showAlert } from '../../utils/confirm';
import { getGpsFix } from '../../utils/location';

type Props = NativeStackScreenProps<StaffHomeStackParamList, 'RouteVisits'>;

const geoCache = new Map<string, { lat: number; lng: number } | null>();

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const key = address.trim().toLowerCase();
  if (!key || key === ',') return null;
  if (geoCache.has(key)) return geoCache.get(key) || null;

  try {
    const url =
      'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' +
      encodeURIComponent(address);
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ClickTabsMobile/1.0 (route-visits)',
      },
    });
    if (!res.ok) {
      geoCache.set(key, null);
      return null;
    }
    const data = (await res.json()) as { lat: string; lon: string }[];
    const hit = data[0]
      ? { lat: Number(data[0].lat), lng: Number(data[0].lon) }
      : null;
    geoCache.set(key, hit);
    return hit;
  } catch {
    geoCache.set(key, null);
    return null;
  }
}

async function geocodeVisits(visits: ScheduleItem[]): Promise<MapPin[]> {
  const pins: MapPin[] = [];
  let networkCalls = 0;
  for (const v of visits) {
    const address = (v.patient_address || '').trim();
    if (!address || address === ',') continue;
    const key = address.toLowerCase();
    const cached = geoCache.has(key);
    if (!cached && networkCalls > 0) {
      await new Promise((r) => setTimeout(r, 1100));
    }
    const coords = await geocodeAddress(address);
    if (!cached) networkCalls += 1;
    if (!coords) continue;
    pins.push({
      id: v.id,
      lat: coords.lat,
      lng: coords.lng,
      title: v.patient_name || v.title || `Visit #${v.id}`,
      subtitle: [
        v.start_time ? new Date(v.start_time.replace(' ', 'T')).toLocaleString() : null,
        address,
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }
  return pins;
}

export function StaffMenuRouteVisitsScreen({ navigation }: Props) {
  const { token, handleUnauthorized } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pins, setPins] = useState<MapPin[]>([]);
  const [user, setUser] = useState<{ lat: number; lng: number } | null>(null);
  const [visitCount, setVisitCount] = useState(0);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      try {
        const loc = await getGpsFix();
        setUser({ lat: loc.latitude, lng: loc.longitude });
      } catch {
        // Map still loads without the user pin if GPS is unavailable.
      }

      const [today, week] = await Promise.all([
        staffApi.staffTodaySchedule(token),
        staffApi.staffWeekSchedule(token),
      ]);
      const map = new Map<number, ScheduleItem>();
      [...(today.data || []), ...(week.data || [])].forEach((v) => map.set(v.id, v));
      const visits = [...map.values()];
      setVisitCount(visits.length);
      const nextPins = await geocodeVisits(visits);
      setPins(nextPins);
      if (visits.length > 0 && nextPins.length === 0) {
        showAlert(
          'No map locations',
          'Patient addresses could not be located. Check addresses in Click Tabs web.',
        );
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Failed to load route visits');
    } finally {
      setLoading(false);
    }
  }, [token, handleUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AppShell>
      <AppHeader
        title="Route Visits"
        actions={[{ icon: 'arrow-back', onPress: () => navigation.goBack() }]}
      />
      {error ? <ErrorBanner message={error} onRetry={load} /> : null}
      {loading ? (
        <LoadingBlock />
      ) : (
        <View style={styles.body}>
          <OpenStreetMapView pins={pins} user={user} />
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {pins.length} patient location{pins.length === 1 ? '' : 's'} · {visitCount} visit
              {visitCount === 1 ? '' : 's'} · OpenStreetMap
            </Text>
            <Pressable onPress={load} hitSlop={8}>
              <Text style={styles.refresh}>Refresh</Text>
            </Pressable>
          </View>
        </View>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: '#fff',
  },
  footerText: { color: colors.textMuted, fontSize: 12, flex: 1, marginRight: 12 },
  refresh: { color: colors.brandMagenta, fontWeight: '700', fontSize: 13 },
});
