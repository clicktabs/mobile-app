import React, { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  LoadingBlock,
  Screen,
  Subtitle,
  Title,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as evvApi from '../../api/evv';
import { ApiError } from '../../api/client';
import type { EvvVisit } from '../../types';
import { colors } from '../../theme/colors';

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

export function StaffEvvScreen({ embedded = false }: { embedded?: boolean }) {
  const { token, handleUnauthorized } = useAuth();
  const [visits, setVisits] = useState<EvvVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const res = await evvApi.getEvvVisits(token);
      setVisits(res.visits || []);
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

  const checkIn = async (scheduleId: number) => {
    if (!token) return;
    setBusyId(scheduleId);
    try {
      const coords = await getCoords();
      const res = await evvApi.evvCheckin(token, scheduleId, {
        ...coords,
        verification_method: 'gps',
        device_id: 'android-app',
      });
      Alert.alert('Checked in', res.check_in_time || res.message || 'Success');
      await load();
    } catch (e) {
      Alert.alert('Check-in failed', e instanceof Error ? e.message : 'Error');
    } finally {
      setBusyId(null);
    }
  };

  const checkOut = async (scheduleId: number) => {
    if (!token) return;
    setBusyId(scheduleId);
    try {
      const coords = await getCoords();
      const res = await evvApi.evvCheckout(token, scheduleId, {
        ...coords,
        notes: notes || undefined,
      });
      Alert.alert(
        'Checked out',
        `Duration: ${res.duration_minutes ?? '—'} min${
          res.compliance_issues ? '\nCompliance notes returned from server.' : ''
        }`,
      );
      setNotes('');
      await load();
    } catch (e) {
      Alert.alert('Check-out failed', e instanceof Error ? e.message : 'Error');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <LoadingBlock />;

  const body = (
    <>
      {!embedded ? <Title>EVV</Title> : null}
      <Subtitle>GPS check-in and check-out for assigned visits.</Subtitle>
      <Field label="Checkout notes (optional)" value={notes} onChangeText={setNotes} />
      {error ? <ErrorBanner message={error} onRetry={load} /> : null}
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
      >
        {visits.length === 0 ? (
          <EmptyState message="No EVV visits in range" />
        ) : (
          visits.map((v) => {
            const checkedIn = !!v.evv?.check_in_time;
            const checkedOut = !!v.evv?.check_out_time;
            return (
              <Card key={v.id}>
                <Text style={{ fontWeight: '700', color: colors.text }}>{v.patient?.name || `Visit #${v.id}`}</Text>
                <Text style={{ color: colors.textMuted, marginTop: 4 }}>
                  {v.start_datetime ? new Date(v.start_datetime).toLocaleString() : '—'}
                </Text>
                <Text style={{ color: colors.textMuted, marginTop: 4 }}>
                  EVV: {checkedOut ? 'Checked out' : checkedIn ? 'Checked in' : 'Not started'}
                </Text>
                {!checkedIn ? (
                  <Button
                    label="Check in"
                    loading={busyId === v.id}
                    onPress={() => checkIn(v.id)}
                  />
                ) : !checkedOut ? (
                  <Button
                    label="Check out"
                    loading={busyId === v.id}
                    onPress={() =>
                      Alert.alert('Check out?', 'Submit GPS check-out for this visit?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Check out', onPress: () => checkOut(v.id) },
                      ])
                    }
                  />
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>
    </>
  );

  if (embedded) {
    return <View style={{ flex: 1, padding: 16 }}>{body}</View>;
  }

  return <Screen>{body}</Screen>;
}
