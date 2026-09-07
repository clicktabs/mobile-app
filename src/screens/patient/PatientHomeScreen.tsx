import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Button, Card, EmptyState, ErrorBanner, LoadingBlock, Screen, Subtitle, Title } from '../../components/ui';
import { BrandLogo } from '../../components/BrandLogo';
import { useAuth } from '../../context/AuthContext';
import * as patientApi from '../../api/patient';
import { ApiError } from '../../api/client';
import type { ScheduleItem } from '../../types';
import { colors } from '../../theme/colors';

export function PatientHomeScreen() {
  const { token, patientUser, handleUnauthorized } = useAuth();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [sched, notes] = await Promise.all([
        patientApi.patientSchedule(token, 'upcoming', 5),
        patientApi.patientNotifications(token),
      ]);
      setSchedule(sched.data || []);
      setUnread(notes.unread || 0);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Failed to load');
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

  if (loading) return <LoadingBlock />;

  return (
    <Screen>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
      >
        <BrandLogo size="sm" style={{ marginBottom: 12 }} />
        <Title>Hello{patientUser?.name ? `, ${patientUser.name}` : ''}</Title>
        <Subtitle>
          MRN {patientUser?.mrn || '—'}
          {unread > 0 ? ` · ${unread} unread notifications` : ''}
        </Subtitle>
        {error ? <ErrorBanner message={error} onRetry={load} /> : null}

        <Button label="Medications" onPress={() => navigation.navigate('PatientMeds')} />
        <Button label="Care plans" onPress={() => navigation.navigate('PatientCarePlans')} variant="secondary" />
        <Button label="Care team" onPress={() => navigation.navigate('PatientCareTeam')} variant="secondary" />
        <Button label="Notifications" onPress={() => navigation.navigate('PatientNotifications')} variant="ghost" />
        <Button label="Grievances" onPress={() => navigation.navigate('PatientGrievances')} variant="ghost" />
        <Button label="Profile" onPress={() => navigation.navigate('PatientProfile')} variant="ghost" />

        <Text style={{ fontWeight: '700', marginTop: 16, marginBottom: 8, color: colors.navy }}>
          Upcoming visits
        </Text>
        {schedule.length === 0 ? (
          <EmptyState message="No upcoming visits" />
        ) : (
          schedule.map((v) => (
            <Card key={v.id}>
              <Text style={{ fontWeight: '700' }}>{v.title || v.task_type}</Text>
              <Text style={{ color: colors.textMuted }}>
                {v.start_time ? new Date(v.start_time).toLocaleString() : '—'} · {v.staff_name || 'Staff'}
              </Text>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
