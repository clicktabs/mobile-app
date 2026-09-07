import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Card, EmptyState, ErrorBanner, LoadingBlock, Screen, Title } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as patientApi from '../../api/patient';
import { ApiError } from '../../api/client';
import type { ScheduleItem } from '../../types';
import { colors } from '../../theme/colors';

export function PatientScheduleScreen() {
  const { token, handleUnauthorized } = useAuth();
  const [status, setStatus] = useState<'upcoming' | 'past'>('upcoming');
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const res = await patientApi.patientSchedule(token, status);
      setItems(res.data || []);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await handleUnauthorized();
      else setError(e instanceof ApiError ? e.message : 'Failed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, status, handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  if (loading) return <LoadingBlock />;

  return (
    <Screen>
      <Title>My schedule</Title>
      <View style={styles.row}>
        {(['upcoming', 'past'] as const).map((s) => (
          <Pressable key={s} onPress={() => setStatus(s)} style={[styles.chip, status === s && styles.active]}>
            <Text style={[styles.chipText, status === s && styles.activeText]}>
              {s === 'upcoming' ? 'Upcoming' : 'Past'}
            </Text>
          </Pressable>
        ))}
      </View>
      {error ? <ErrorBanner message={error} onRetry={load} /> : null}
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
      >
        {items.length === 0 ? (
          <EmptyState message="No visits" />
        ) : (
          items.map((item) => (
            <Card key={item.id}>
              <Text style={{ fontWeight: '700' }}>{item.title || item.task_type}</Text>
              <Text style={{ color: colors.textMuted, marginTop: 4 }}>
                {item.start_time ? new Date(item.start_time).toLocaleString() : '—'}
              </Text>
              <Text style={{ color: colors.textMuted }}>{item.staff_name || 'Care team'}</Text>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  active: { backgroundColor: colors.axxTeal, borderColor: colors.axxTeal },
  chipText: { fontWeight: '600', color: colors.text },
  activeText: { color: '#fff' },
});
