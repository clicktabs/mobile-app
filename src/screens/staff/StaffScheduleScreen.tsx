import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  AppHeader,
  AppShell,
  LastUpdatedBar,
  SearchBar,
  SegmentTabs,
} from '../../components/chrome';
import { Button, EmptyState, ErrorBanner, LoadingBlock } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';
import type { ScheduleItem } from '../../types';
import { colors } from '../../theme/colors';
import { confirmAction, showAlert } from '../../utils/confirm';

type TabKey = 'past' | 'upcoming' | 'completed';

function isPastDue(item: ScheduleItem) {
  if (!item.start_time || item.status === 'completed') return false;
  return new Date(item.start_time).getTime() < Date.now();
}

function isCompleted(item: ScheduleItem) {
  return (item.status || '').toLowerCase() === 'completed';
}

export function StaffScheduleScreen() {
  const { token, handleUnauthorized } = useAuth();
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<TabKey>('upcoming');
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [completingId, setCompletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [today, week] = await Promise.all([
        staffApi.staffTodaySchedule(token),
        staffApi.staffWeekSchedule(token),
      ]);
      const map = new Map<number, ScheduleItem>();
      [...(today.data || []), ...(week.data || [])].forEach((v) => map.set(v.id, v));
      setItems([...map.values()]);
      setUpdatedAt(new Date());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Failed to load schedule');
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items;
    if (tab === 'past') list = items.filter(isPastDue);
    if (tab === 'completed') list = items.filter(isCompleted);
    if (tab === 'upcoming') list = items.filter((i) => !isCompleted(i) && !isPastDue(i));
    if (!q) return list;
    return list.filter((i) =>
      `${i.patient_name || ''} ${i.title || ''} ${i.task_type || ''}`.toLowerCase().includes(q),
    );
  }, [items, tab, search]);

  const counts = useMemo(
    () => ({
      past: items.filter(isPastDue).length,
      upcoming: items.filter((i) => !isCompleted(i) && !isPastDue(i)).length,
      completed: items.filter(isCompleted).length,
    }),
    [items],
  );

  const complete = async (id: number) => {
    if (!token) return;
    const ok = await confirmAction('Complete visit?', 'Mark this visit as completed?');
    if (!ok) return;
    setCompletingId(id);
    try {
      await staffApi.completeVisit(token, id);
      showAlert('Visit completed');
      await load();
    } catch (e) {
      showAlert('Could not complete', e instanceof ApiError ? e.message : 'Error');
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <AppShell>
      <AppHeader
        title="My Schedule"
        actions={[
          {
            icon: 'refresh-outline',
            onPress: () => {
              setRefreshing(true);
              load();
            },
          },
          {
            icon: 'calendar-outline',
            onPress: () => setTab('upcoming'),
          },
        ]}
      />
      <SegmentTabs
        tabs={[
          { key: 'past', label: `Past Due (${counts.past})`, tint: colors.danger },
          { key: 'upcoming', label: `Upcoming (${counts.upcoming})`, tint: colors.brandMagenta },
          { key: 'completed', label: `Completed (${counts.completed})`, tint: colors.success },
        ]}
        value={tab}
        onChange={setTab}
      />
      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder={`Search ${tab === 'past' ? 'Past Due' : tab === 'completed' ? 'Completed' : 'Upcoming'} Tasks`}
      />
      {error ? <ErrorBanner message={error} onRetry={load} /> : null}
      <View style={{ flex: 1 }}>
        {loading ? (
          <LoadingBlock />
        ) : (
          <ScrollView
            contentContainerStyle={filtered.length === 0 ? styles.empty : undefined}
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
            {filtered.length === 0 ? (
              <EmptyState
                message={
                  tab === 'past'
                    ? 'No past due tasks found.'
                    : tab === 'completed'
                      ? 'No completed tasks found.'
                      : 'No upcoming tasks found.'
                }
              />
            ) : (
              filtered.map((item) => (
                <View key={item.id} style={styles.card}>
                  <Text style={styles.name}>{item.patient_name || item.title}</Text>
                  <Text style={styles.meta}>
                    {item.start_time ? new Date(item.start_time.replace(' ', 'T')).toLocaleString() : '—'} ·{' '}
                    {item.status || 'scheduled'}
                  </Text>
                  <View style={styles.actions}>
                    {item.patient_id ? (
                      <Button
                        label="Patient"
                        variant="ghost"
                        onPress={() =>
                          navigation.navigate('Patients', {
                            screen: 'PatientDetail',
                            params: { patientId: item.patient_id },
                          })
                        }
                      />
                    ) : null}
                    {!isCompleted(item) ? (
                      <Button
                        label="Complete"
                        loading={completingId === item.id}
                        onPress={() => complete(item.id)}
                      />
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>
      <LastUpdatedBar at={updatedAt} />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  empty: { flexGrow: 1, justifyContent: 'center' },
  card: {
    marginHorizontal: 14,
    marginBottom: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  name: { fontWeight: '700', color: colors.text, fontSize: 15 },
  meta: { color: colors.textMuted, marginTop: 4, marginBottom: 6 },
  actions: { gap: 4 },
});
