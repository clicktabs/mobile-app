import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AppHeader, AppShell, LastUpdatedBar, SearchBar } from '../../components/chrome';
import { EmptyState, ErrorBanner, LoadingBlock } from '../../components/ui';
import { scopeLabels } from '../../utils/scopeLabels';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';
import type { PatientListItem } from '../../types';
import { colors } from '../../theme/colors';

export function StaffPatientsScreen() {
  const { token, handleUnauthorized, staffUser } = useAuth();
  // "My Patients" is wrong for a manager: the list is the agency's, not theirs.
  const labels = scopeLabels(staffUser);
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<PatientListItem[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(
    async (pageNum = 1, append = false) => {
      if (!token) return;
      setError(null);
      try {
        const res = await staffApi.staffPatients(token, {
          search: search || undefined,
          // Include pending/on-hold — many assigned patients are not yet "active"
          status: 'all',
          page: pageNum,
          limit: 20,
        });
        const data = res.data || [];
        setItems((prev) => (append ? [...prev, ...data] : data));
        setPage(res.pagination?.current_page || pageNum);
        setLastPage(res.pagination?.last_page || 1);
        setUpdatedAt(new Date());
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          await handleUnauthorized();
          return;
        }
        setError(e instanceof ApiError ? e.message : 'Failed to load patients');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, search, handleUnauthorized],
  );

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load(1, false);
    }, [load]),
  );

  return (
    <AppShell>
      <AppHeader
        title={labels.patients}
        actions={[
          /*
            Taking a referral, shown only to somebody the server says may.

            Reached from the patient list because that is where people look for "add
            someone new" — but what it creates is a referral, and the screen behind it
            says so before anything is typed. A patient only exists once the office has
            verified the referral and converted it.
          */
          ...(staffUser?.can_take_referrals
            ? [
                {
                  icon: 'person-add-outline' as const,
                  label: 'New referral',
                  onPress: () => navigation.navigate('NewReferral'),
                },
              ]
            : []),
          {
            icon: 'refresh' as const,
            onPress: () => {
              setRefreshing(true);
              load(1, false);
            },
          },
        ]}
      />
      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search"
        onSubmit={() => {
          setLoading(true);
          load(1, false);
        }}
      />
      {error ? <ErrorBanner message={error} onRetry={() => load(1, false)} /> : null}
      <View style={{ flex: 1 }}>
        {loading ? (
          <LoadingBlock />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={items.length === 0 ? styles.emptyList : styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load(1, false);
                }}
              />
            }
            onEndReached={() => {
              if (page < lastPage) load(page + 1, true);
            }}
            ListEmptyComponent={<EmptyState message="No assigned patients" />}
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                onPress={() => navigation.navigate('PatientDetail', { patientId: item.id })}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(item.first_name?.[0] || item.name?.[0] || 'P').toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {item.name || `${item.first_name || ''} ${item.last_name || ''}`.trim()}
                  </Text>
                  <Text style={styles.meta}>
                    MRN {item.mrn || '—'} · {item.status || 'active'}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
      <LastUpdatedBar at={updatedAt} />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 8 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFE4EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.brandMagenta, fontWeight: '800' },
  name: { fontWeight: '700', color: colors.text, fontSize: 15 },
  meta: { color: colors.textMuted, marginTop: 2, fontSize: 13 },
});
