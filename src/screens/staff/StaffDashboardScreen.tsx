import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppHeader, AppShell, OutlineButton } from '../../components/chrome';
import { EmptyState, ErrorBanner, LoadingBlock } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';
import type { ScheduleItem } from '../../types';
import { colors } from '../../theme/colors';

export function StaffDashboardScreen() {
  const { token, staffUser, handleUnauthorized } = useAuth();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visits, setVisits] = useState<ScheduleItem[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const res = await staffApi.staffDashboard(token);
      setVisits(res.data?.upcoming_visits || []);
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

  return (
    <AppShell>
      <AppHeader title="Home" />
      {loading ? (
        <LoadingBlock />
      ) : (
        <ScrollView
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

          <View style={styles.banner}>
            <LinearGradient
              colors={['#FFB347', '#FF6B7A', '#FF4D8D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.bannerEyebrow}>
              Welcome{staffUser?.first_name ? `, ${staffUser.first_name}` : ''}
            </Text>
            <Text style={styles.bannerTitle}>New & Exciting Features</Text>
            <Pressable
              style={styles.seeUpdates}
              onPress={() => navigation.navigate('Menu', { screen: 'MenuUpdates' })}
            >
              <Text style={styles.seeUpdatesText}>SEE UPDATES</Text>
            </Pressable>
          </View>

          <OutlineButton
            label="Route Visits"
            color="#7C3AED"
            onPress={() => navigation.navigate('Schedule')}
          />
          <OutlineButton
            label="Electronic ID Badge"
            color={colors.brandMagenta}
            onPress={() => navigation.navigate('Menu', { screen: 'MenuBadge' })}
          />

          <Text style={styles.section}>Upcoming visits</Text>
          {visits.length === 0 ? (
            <EmptyState message="No visits scheduled today" />
          ) : (
            visits.map((v) => (
              <Pressable
                key={v.id}
                style={styles.visitCard}
                onPress={() => navigation.navigate('Schedule')}
              >
                <Text style={styles.visitName}>{v.patient_name || v.title}</Text>
                <Text style={styles.visitMeta}>
                  {v.start_time
                    ? new Date(v.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '—'}
                  {' · '}
                  {v.status || 'scheduled'}
                </Text>
              </Pressable>
            ))
          )}

          <Pressable
            style={styles.evvLink}
            onPress={() => navigation.navigate('Menu', { screen: 'MenuEvv' })}
          >
            <Text style={styles.evvLinkText}>Open EVV check-in / check-out</Text>
          </Pressable>
        </ScrollView>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  banner: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 180,
    padding: 20,
    justifyContent: 'flex-end',
  },
  bannerEyebrow: { color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginBottom: 4 },
  bannerTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 14 },
  seeUpdates: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brandMagenta,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 6,
  },
  seeUpdatesText: { color: '#fff', fontWeight: '800', letterSpacing: 0.5 },
  section: {
    marginTop: 20,
    marginHorizontal: 16,
    marginBottom: 8,
    fontWeight: '700',
    color: colors.ink,
    fontSize: 16,
  },
  visitCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  visitName: { fontWeight: '700', color: colors.text },
  visitMeta: { color: colors.textMuted, marginTop: 4 },
  evvLink: { alignItems: 'center', padding: 20 },
  evvLinkText: { color: colors.brandMagenta, fontWeight: '700' },
});
