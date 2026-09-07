import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Card, EmptyState, ErrorBanner, LoadingBlock, Screen, Title } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as patientApi from '../../api/patient';
import { ApiError } from '../../api/client';
import { colors } from '../../theme/colors';

export function PatientMedsScreen() {
  const { token, handleUnauthorized } = useAuth();
  const [items, setItems] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, any> | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const res = await patientApi.patientMedications(token);
      setItems(res.data || []);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await handleUnauthorized();
      else setError(e instanceof ApiError ? e.message : 'Failed');
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

  const openDetail = async (id: number) => {
    if (!token) return;
    try {
      const res = await patientApi.patientMedicationDetail(token, id);
      setSelected(res.data || null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed');
    }
  };

  if (loading) return <LoadingBlock />;

  if (selected) {
    return (
      <Screen>
        <Title>{String(selected.name)}</Title>
        <Card>
          <Text>Dosage: {String(selected.dosage || '—')}</Text>
          <Text>Frequency: {String(selected.frequency || '—')}</Text>
          <Text>Route: {String(selected.route || '—')}</Text>
          <Text>Instructions: {String(selected.instructions || '—')}</Text>
          <Text>Refills: {String(selected.refills_remaining ?? '—')}</Text>
        </Card>
        <Card onPress={() => setSelected(null)}>
          <Text style={{ color: colors.blue, fontWeight: '700' }}>← Back to list</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Medications</Title>
      {error ? <ErrorBanner message={error} onRetry={load} /> : null}
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
      >
        {items.length === 0 ? (
          <EmptyState message="No active medications" />
        ) : (
          items.map((m) => (
            <Card key={String(m.id)} onPress={() => openDetail(Number(m.id))}>
              <Text style={{ fontWeight: '700' }}>{String(m.name)}</Text>
              <Text style={{ color: colors.textMuted }}>
                {String(m.dosage || '')} · {String(m.frequency || '')}
              </Text>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
