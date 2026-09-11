import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AppHeader, AppShell, LastUpdatedBar } from '../../components/chrome';
import { EmptyState, ErrorBanner, LoadingBlock } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';
import { colors } from '../../theme/colors';
import { showAlert } from '../../utils/confirm';

type PayPeriodRow = {
  id: number;
  name?: string;
  start?: string;
  end?: string;
  status?: string;
  gross?: number;
  net?: number;
  regular_hours?: number;
  overtime_hours?: number;
  processing_route?: string;
  sync_status?: string | null;
  paid_at?: string | null;
};

export function StaffPayrollScreen() {
  const navigation = useNavigation<any>();
  const { token, handleUnauthorized } = useAuth();
  const [items, setItems] = useState<PayPeriodRow[]>([]);
  const [ytd, setYtd] = useState<{ gross: number; net: number }>({ gross: 0, net: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [disputeId, setDisputeId] = useState<number | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const res = await staffApi.staffPayrollPeriods(token);
      setItems(Array.isArray(res.data) ? res.data : []);
      setYtd(res.ytd || { gross: 0, net: 0 });
      setUpdatedAt(new Date());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Failed to load pay');
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

  const submitDispute = async () => {
    if (!token || !disputeId || reason.trim().length < 4) {
      showAlert('Need a reason', 'Explain the hours dispute (at least 4 characters).', 'error');
      return;
    }
    try {
      const res = await staffApi.disputeStaffPayrollPeriod(token, disputeId, reason.trim());
      showAlert('Dispute sent', res.message || 'Payroll will review.', 'success');
      setDisputeId(null);
      setReason('');
      await load();
    } catch (e) {
      showAlert('Could not dispute', e instanceof ApiError ? e.message : 'Failed', 'error');
    }
  };

  return (
    <AppShell>
      <AppHeader
        title="My Pay"
        actions={[
          { icon: 'arrow-back', onPress: () => navigation.goBack() },
          {
            icon: 'refresh',
            onPress: () => {
              setRefreshing(true);
              load();
            },
          },
        ]}
      />
      <LastUpdatedBar at={updatedAt} />
      <View style={styles.ytd}>
        <Text style={styles.ytdLabel}>YTD gross / net</Text>
        <Text style={styles.ytdValue}>
          ${ytd.gross.toFixed(2)} / ${ytd.net.toFixed(2)}
        </Text>
      </View>
      {error ? <ErrorBanner message={error} /> : null}
      {loading && !refreshing ? (
        <LoadingBlock />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.brandPink}
            />
          }
          ListEmptyComponent={<EmptyState message="No pay periods yet. After payroll runs, stubs appear here." />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.name || `Period #${item.id}`}</Text>
              <Text style={styles.meta}>
                {item.start || '—'} → {item.end || '—'} · {item.status || '—'}
              </Text>
              <Text style={styles.pay}>
                Net ${Number(item.net || 0).toFixed(2)} · Gross ${Number(item.gross || 0).toFixed(2)}
              </Text>
              <Text style={styles.meta}>
                {Number(item.regular_hours || 0).toFixed(2)} hrs + {Number(item.overtime_hours || 0).toFixed(2)} OT
                {' · '}
                {(item.processing_route || 'native').toUpperCase()}
                {item.sync_status ? ` · ${item.sync_status}` : ''}
              </Text>
              <TouchableOpacity style={styles.disputeBtn} onPress={() => setDisputeId(item.id)}>
                <Text style={styles.disputeText}>Dispute hours</Text>
              </TouchableOpacity>
              {disputeId === item.id ? (
                <View style={styles.disputeBox}>
                  <TextInput
                    style={styles.input}
                    value={reason}
                    onChangeText={setReason}
                    placeholder="What is wrong with this stub?"
                    placeholderTextColor={colors.textMuted}
                    multiline
                  />
                  <TouchableOpacity style={styles.submitBtn} onPress={submitDispute}>
                    <Text style={styles.submitText}>Submit dispute</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          )}
        />
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  ytd: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#F9FAFB' },
  ytdLabel: { fontSize: 12, color: colors.textMuted },
  ytdValue: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 2 },
  list: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  pay: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 8 },
  disputeBtn: { marginTop: 10 },
  disputeText: { color: colors.brandPink, fontWeight: '600' },
  disputeBox: { marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    minHeight: 64,
    color: colors.text,
  },
  submitBtn: {
    marginTop: 8,
    backgroundColor: colors.brandPink,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '700' },
});
