import React, { useCallback, useState } from 'react';
import {
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader, AppShell } from '../../components/chrome';
import { ErrorBanner, LoadingBlock } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';

const HOME_BANNER =
  'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=1200&q=80';

type HomeStats = {
  patients: number;
  shiftOffers: number;
  availableShifts: number;
  licenses: number | null;
  payrollHours: string;
};

type DashTile = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value?: string | number;
  showChevron?: boolean;
  onPress: () => void;
};

const EMPTY_STATS: HomeStats = {
  patients: 0,
  shiftOffers: 0,
  availableShifts: 0,
  licenses: null,
  payrollHours: '0.00',
};

export function StaffDashboardScreen() {
  const { token, handleUnauthorized } = useAuth();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<HomeStats>(EMPTY_STATS);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const dash = await staffApi.staffDashboard(token);
      const s = dash.data?.stats;
      setStats({
        patients: Number(s?.assigned_patients ?? 0) || 0,
        shiftOffers: Number(s?.shift_offers ?? 0) || 0,
        availableShifts: Number(s?.available_shifts ?? 0) || 0,
        licenses: s?.licenses != null ? Number(s.licenses) || 0 : null,
        payrollHours:
          s?.payroll_hours_label ||
          (s?.payroll_hours != null ? Number(s.payroll_hours).toFixed(2) : '0.00'),
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Failed to load home');
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

  const tiles: DashTile[] = [
    {
      key: 'patients',
      label: 'My Patients',
      icon: 'person-circle-outline',
      value: stats.patients,
      onPress: () => navigation.navigate('Patients'),
    },
    {
      key: 'shift_offers',
      label: 'Shift Offers',
      icon: 'swap-horizontal-outline',
      value: stats.shiftOffers,
      onPress: () => navigation.navigate('Schedule', { screen: 'ScheduleList' }),
    },
    {
      key: 'available_shifts',
      label: 'Available Shifts',
      icon: 'time-outline',
      value: stats.availableShifts,
      onPress: () => navigation.navigate('Schedule', { screen: 'ScheduleList' }),
    },
    {
      key: 'licenses',
      label: 'Licenses',
      icon: 'ribbon-outline',
      value: stats.licenses != null ? stats.licenses : undefined,
      showChevron: true,
      onPress: () => navigation.navigate('Menu', { screen: 'MenuCertification' }),
    },
    {
      key: 'payroll',
      label: 'My Payroll Hours',
      icon: 'wallet-outline',
      value: stats.payrollHours,
      onPress: () => navigation.navigate('Menu', { screen: 'MenuTime' }),
    },
  ];

  return (
    <AppShell>
      <AppHeader title="Home" />
      {loading ? (
        <LoadingBlock />
      ) : (
        <ScrollView
          contentContainerStyle={styles.pad}
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
          {error ? <ErrorBanner message={error} onRetry={load} /> : null}

          <ImageBackground
            source={{ uri: HOME_BANNER }}
            style={styles.banner}
            imageStyle={styles.bannerImage}
          >
            <View style={styles.bannerScrim} />
          </ImageBackground>

          <View style={styles.tileList}>
            {tiles.map((tile) => (
              <Pressable
                key={tile.key}
                onPress={tile.onPress}
                style={({ pressed }) => [styles.tile, pressed && { opacity: 0.9 }]}
              >
                <Ionicons name={tile.icon} size={22} color="#475569" />
                <Text style={styles.tileLabel}>{tile.label}</Text>
                {tile.value !== undefined ? (
                  <Text style={styles.tileValue}>{tile.value}</Text>
                ) : null}
                {tile.showChevron && tile.value === undefined ? (
                  <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                ) : null}
                {tile.showChevron && tile.value !== undefined ? (
                  <Ionicons name="chevron-forward" size={18} color="#94a3b8" style={{ marginLeft: 4 }} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  pad: { paddingBottom: 28 },
  banner: {
    marginHorizontal: 12,
    marginTop: 8,
    height: 168,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  bannerImage: { borderRadius: 10 },
  bannerScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15,23,42,0.08)',
  },
  tileList: {
    marginTop: 14,
    marginHorizontal: 12,
    gap: 10,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  tileLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  tileValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
  },
});
