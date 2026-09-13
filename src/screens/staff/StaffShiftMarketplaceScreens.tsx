import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppHeader, AppShell, LastUpdatedBar } from '../../components/chrome';
import { EmptyState, ErrorBanner, LoadingBlock } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import type { StaffShiftItem } from '../../api/staff';
import { ApiError } from '../../api/client';
import { colors } from '../../theme/colors';
import { confirmAction, showAlert } from '../../utils/confirm';

function ShiftCard({
  item,
  mode,
  busyId,
  locked,
  onClaim,
  onAccept,
  onDecline,
  onWithdraw,
}: {
  item: StaffShiftItem;
  mode: 'available' | 'offers';
  busyId: number | null;
  locked?: boolean;
  onClaim: (id: number) => void;
  onAccept: (id: number) => void;
  onDecline: (id: number) => void;
  onWithdraw: (id: number) => void;
}) {
  const busy = busyId === item.id;
  /** Disable every action while any claim/accept is in flight (stops multi-card double taps). */
  const anyBusy = busyId != null;
  const actionDisabled = busy || anyBusy || !!locked;
  const awaiting = !!item.awaiting_admin_approval || item.status === 'pending';
  const isOffer = !!item.is_admin_offer || item.status === 'offered';
  const when = item.start_display || item.start_time || '—';
  const end = item.end_display ? ` – ${item.end_display}` : '';

  return (
    <View style={styles.card}>
      <View style={styles.cardAccent} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={styles.whenBlock}>
            <Ionicons name="calendar-outline" size={14} color={colors.brandPink} />
            <Text style={styles.when}>
              {when}
              {end}
            </Text>
          </View>
          {item.required_role ? (
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{item.required_role}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.patient}>{item.patient_name || 'Patient'}</Text>

        <View style={styles.metaRow}>
          {item.mrn ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>MRN {item.mrn}</Text>
            </View>
          ) : null}
          {item.task_type ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{String(item.task_type).replace(/_/g, ' ')}</Text>
            </View>
          ) : null}
          {awaiting ? (
            <View style={[styles.chip, styles.chipWarn]}>
              <Text style={[styles.chipText, styles.chipWarnText]}>Awaiting approval</Text>
            </View>
          ) : null}
          {isOffer && mode === 'offers' ? (
            <View style={[styles.chip, styles.chipInfo]}>
              <Text style={[styles.chipText, styles.chipInfoText]}>Agency offer</Text>
            </View>
          ) : null}
        </View>

        {item.patient_address ? (
          <View style={styles.addrRow}>
            <Ionicons name="location-outline" size={14} color={colors.textMuted} />
            <Text style={styles.meta} numberOfLines={2}>
              {item.patient_address}
            </Text>
          </View>
        ) : null}

        {item.notes ? (
          <Text style={styles.notes} numberOfLines={3}>
            {item.notes}
          </Text>
        ) : null}

        <View style={styles.actions}>
          {mode === 'available' && awaiting ? (
            <>
              <View style={styles.pendingBanner}>
                <Ionicons name="hourglass-outline" size={16} color="#92400E" />
                <Text style={styles.pendingText}>Claim pending — waiting for agency approval</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={actionDisabled}
                onPress={() => onWithdraw(item.id)}
                style={[styles.btnGhost, actionDisabled && styles.btnDisabled]}
              >
                <Text style={styles.btnGhostText}>{busy ? '…' : 'Withdraw Claim'}</Text>
              </TouchableOpacity>
            </>
          ) : mode === 'available' ? (
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={actionDisabled}
              onPress={() => onClaim(item.id)}
              style={styles.btnWrap}
            >
              <LinearGradient
                colors={locked ? ['#9CA3AF', '#9CA3AF'] : [...colors.brandGradient]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.btnPrimary, actionDisabled && styles.btnDisabled]}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnPrimaryText}>
                    {locked ? 'Claim submitted' : 'Claim Shift'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          ) : awaiting ? (
            <>
              <View style={styles.pendingBanner}>
                <Ionicons name="hourglass-outline" size={16} color="#92400E" />
                <Text style={styles.pendingText}>Waiting for admin approval</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={actionDisabled}
                onPress={() => onWithdraw(item.id)}
                style={[styles.btnGhost, actionDisabled && styles.btnDisabled]}
              >
                <Text style={styles.btnGhostText}>{busy ? '…' : 'Withdraw Claim'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={actionDisabled}
                onPress={() => onAccept(item.id)}
                style={styles.btnWrapHalf}
              >
                <LinearGradient
                  colors={[...colors.brandGradient]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.btnPrimary, actionDisabled && styles.btnDisabled]}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnPrimaryText}>Accept</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={actionDisabled}
                onPress={() => onDecline(item.id)}
                style={[styles.btnGhost, styles.btnWrapHalf, actionDisabled && styles.btnDisabled]}
              >
                <Text style={styles.btnGhostText}>Decline</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

function useShiftList(mode: 'available' | 'offers') {
  const { token, handleUnauthorized } = useAuth();
  const [items, setItems] = useState<StaffShiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  /** Sync lock — React state alone cannot stop rapid double-taps. */
  const actionLockRef = useRef(false);
  /** Shift IDs claimed this session (extra guard if list refresh is slow). */
  const [lockedIds, setLockedIds] = useState<Record<number, true>>({});
  const lockedIdsRef = useRef<Record<number, true>>({});

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const res =
        mode === 'available'
          ? await staffApi.staffAvailableShifts(token, 30)
          : await staffApi.staffShiftOffers(token);
      const next = Array.isArray(res.data) ? res.data : [];
      // Keep session-locked claims visible as awaiting (API already flags them).
      setItems(next);
      setUpdatedAt(new Date());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Failed to load shifts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, handleUnauthorized, mode]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const runAction = async (id: number, action: 'claim' | 'accept' | 'decline' | 'withdraw') => {
    if (!token) return false;
    if (actionLockRef.current) return false;
    actionLockRef.current = true;
    setBusyId(id);

    // Optimistic: mark claimed as awaiting so Claim cannot be tapped again.
    if (action === 'claim') {
      lockedIdsRef.current = { ...lockedIdsRef.current, [id]: true };
      setLockedIds(lockedIdsRef.current);
      setItems((prev) =>
        prev.map((x) =>
          x.id === id ? { ...x, awaiting_admin_approval: true, status: 'pending' } : x,
        ),
      );
    }

    try {
      let title = 'Done';
      let message = '';
      if (action === 'claim') {
        const res = await staffApi.claimAvailableShift(token, id);
        title = 'Claim submitted';
        message = res.message || 'Waiting for your agency to approve. You cannot claim this shift again while pending.';
      }
      if (action === 'accept') {
        const res = await staffApi.acceptShiftOffer(token, id);
        title = 'Offer accepted';
        message = res.message || 'You are now assigned to this shift.';
        setItems((prev) => prev.filter((x) => x.id !== id));
      }
      if (action === 'decline') {
        const res = await staffApi.declineShiftOffer(token, id);
        title = 'Updated';
        message = res.message || 'Shift updated.';
        setItems((prev) => prev.filter((x) => x.id !== id));
      }
      if (action === 'withdraw') {
        const res = await staffApi.withdrawShiftClaim(token, id);
        title = 'Claim withdrawn';
        message = res.message || 'You can claim again if the shift is still open.';
        const next = { ...lockedIdsRef.current };
        delete next[id];
        lockedIdsRef.current = next;
        setLockedIds(next);
        setItems((prev) =>
          prev.map((x) =>
            x.id === id
              ? {
                  ...x,
                  awaiting_admin_approval: false,
                  status: x.status === 'pending' ? 'unassigned' : x.status,
                }
              : x,
          ),
        );
      }
      showAlert(title, message, 'success');
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return false;
      }
      // Same user already claimed — keep as awaiting, not Claim again.
      if (
        action === 'claim' &&
        e instanceof ApiError &&
        (e.status === 409 ||
          /already claimed|already assigned|already submitted|no longer available/i.test(e.message))
      ) {
        lockedIdsRef.current = { ...lockedIdsRef.current, [id]: true };
        setLockedIds(lockedIdsRef.current);
        setItems((prev) =>
          prev.map((x) =>
            x.id === id ? { ...x, awaiting_admin_approval: true, status: 'pending' } : x,
          ),
        );
        showAlert(
          /already/i.test(e.message) ? 'Already claimed' : 'Shift unavailable',
          e.message || 'This shift is no longer available.',
          'info',
        );
        return true;
      }
      if (action === 'claim') {
        const next = { ...lockedIdsRef.current };
        delete next[id];
        lockedIdsRef.current = next;
        setLockedIds(next);
      }
      showAlert('Could not complete', e instanceof ApiError ? e.message : 'Action failed', 'error');
      await load();
      return false;
    } finally {
      actionLockRef.current = false;
      setBusyId(null);
    }
  };

  return {
    items,
    loading,
    refreshing,
    setRefreshing,
    error,
    updatedAt,
    busyId,
    lockedIds,
    actionLockRef,
    load,
    runAction,
    setBusyId,
  };
}

export function StaffAvailableShiftsScreen() {
  const navigation = useNavigation<any>();
  const state = useShiftList('available');

  const onClaim = async (id: number) => {
    // Block double-tap before the confirm dialog even opens.
    if (state.actionLockRef.current || state.busyId != null || state.lockedIds[id]) {
      return;
    }
    state.actionLockRef.current = true;
    state.setBusyId(id);

    const ok = await confirmAction(
      'Claim this shift?',
      'Your request goes to your agency for approval. You are not assigned until an admin approves. You can claim each shift only once while pending.',
      { confirmLabel: 'Submit Claim', icon: 'briefcase-outline' },
    );

    if (!ok) {
      state.actionLockRef.current = false;
      state.setBusyId(null);
      return;
    }

    // Unlock so runAction can take the lock for the API call.
    state.actionLockRef.current = false;
    await state.runAction(id, 'claim');
  };

  const onWithdraw = async (id: number) => {
    if (state.actionLockRef.current || state.busyId != null) return;
    state.actionLockRef.current = true;
    state.setBusyId(id);
    const ok = await confirmAction(
      'Withdraw your claim?',
      'After withdrawing you can claim this shift again if it is still open.',
      { confirmLabel: 'Withdraw', destructive: true, icon: 'arrow-undo-outline' },
    );
    if (!ok) {
      state.actionLockRef.current = false;
      state.setBusyId(null);
      return;
    }
    state.actionLockRef.current = false;
    await state.runAction(id, 'withdraw');
  };

  return (
    <AppShell>
      <AppHeader
        title="Available Shifts"
        actions={[
          { icon: 'arrow-back', onPress: () => navigation.goBack() },
          {
            icon: 'refresh',
            onPress: () => {
              if (state.actionLockRef.current || state.busyId != null) return;
              state.setRefreshing(true);
              state.load();
            },
          },
        ]}
      />
      <LastUpdatedBar at={state.updatedAt} />
      <View style={styles.hintBar}>
        <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
        <Text style={styles.hintText}>
          Claim once → pending until agency approves. While pending you cannot claim again (you can withdraw).
        </Text>
      </View>
      {state.error ? <ErrorBanner message={state.error} /> : null}
      {state.loading && !state.refreshing ? (
        <LoadingBlock />
      ) : (
        <FlatList
          data={state.items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={state.refreshing}
              onRefresh={() => {
                if (state.actionLockRef.current || state.busyId != null) return;
                state.setRefreshing(true);
                state.load();
              }}
              tintColor={colors.brandPink}
            />
          }
          ListEmptyComponent={
            <EmptyState message="No available shifts right now. Check back soon — open shifts from your agency appear here." />
          }
          renderItem={({ item }) => (
            <ShiftCard
              item={item}
              mode="available"
              busyId={state.busyId}
              locked={!!state.lockedIds[item.id]}
              onClaim={onClaim}
              onAccept={() => {}}
              onDecline={() => {}}
              onWithdraw={onWithdraw}
            />
          )}
        />
      )}
    </AppShell>
  );
}

export function StaffShiftOffersScreen() {
  const navigation = useNavigation<any>();
  const state = useShiftList('offers');

  const onAccept = async (id: number) => {
    if (state.actionLockRef.current || state.busyId != null) return;
    state.actionLockRef.current = true;
    state.setBusyId(id);
    const ok = await confirmAction(
      'Accept this offer?',
      'Confirm this shift on your schedule.',
      { confirmLabel: 'Accept', icon: 'checkmark-circle-outline' },
    );
    if (!ok) {
      state.actionLockRef.current = false;
      state.setBusyId(null);
      return;
    }
    state.actionLockRef.current = false;
    await state.runAction(id, 'accept');
  };

  const onDecline = async (id: number) => {
    if (state.actionLockRef.current || state.busyId != null) return;
    state.actionLockRef.current = true;
    state.setBusyId(id);
    const ok = await confirmAction(
      'Decline this offer?',
      'The shift will return to the open pool for other staff.',
      { confirmLabel: 'Decline', destructive: true, icon: 'close-circle-outline' },
    );
    if (!ok) {
      state.actionLockRef.current = false;
      state.setBusyId(null);
      return;
    }
    state.actionLockRef.current = false;
    await state.runAction(id, 'decline');
  };

  const onWithdraw = async (id: number) => {
    if (state.actionLockRef.current || state.busyId != null) return;
    state.actionLockRef.current = true;
    state.setBusyId(id);
    const ok = await confirmAction(
      'Withdraw your claim?',
      'The shift will become available again.',
      { confirmLabel: 'Withdraw', destructive: true, icon: 'arrow-undo-outline' },
    );
    if (!ok) {
      state.actionLockRef.current = false;
      state.setBusyId(null);
      return;
    }
    state.actionLockRef.current = false;
    await state.runAction(id, 'withdraw');
  };

  return (
    <AppShell>
      <AppHeader
        title="Shift Offers"
        actions={[
          { icon: 'arrow-back', onPress: () => navigation.goBack() },
          {
            icon: 'refresh',
            onPress: () => {
              state.setRefreshing(true);
              state.load();
            },
          },
        ]}
      />
      <LastUpdatedBar at={state.updatedAt} />
      <View style={styles.hintBar}>
        <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
        <Text style={styles.hintText}>
          Agency offers need Accept. Your own claims show as awaiting approval.
        </Text>
      </View>
      {state.error ? <ErrorBanner message={state.error} /> : null}
      {state.loading && !state.refreshing ? (
        <LoadingBlock />
      ) : (
        <FlatList
          data={state.items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={state.refreshing}
              onRefresh={() => {
                state.setRefreshing(true);
                state.load();
              }}
              tintColor={colors.brandPink}
            />
          }
          ListEmptyComponent={
            <EmptyState message="No offers or pending claims. When your agency offers you a shift — or you claim one — it shows here." />
          }
          renderItem={({ item }) => (
            <ShiftCard
              item={item}
              mode="offers"
              busyId={state.busyId}
              onClaim={() => {}}
              onAccept={onAccept}
              onDecline={onDecline}
              onWithdraw={onWithdraw}
            />
          )}
        />
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    paddingBottom: 48,
    flexGrow: 1,
  },
  hintBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    flexDirection: 'row',
    ...Platform.select({
      ios: {
        boxShadow: '0px 3px 8px rgba(0, 0, 0, 0.06)',
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  cardAccent: {
    width: 4,
    backgroundColor: colors.brandPink,
  },
  cardBody: {
    flex: 1,
    padding: 14,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  whenBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  when: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  roleBadge: {
    backgroundColor: colors.navy,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roleText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  patient: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  chipWarn: {
    backgroundColor: '#FEF3C7',
  },
  chipWarnText: {
    color: '#92400E',
  },
  chipInfo: {
    backgroundColor: '#DBEAFE',
  },
  chipInfoText: {
    color: '#1E40AF',
  },
  addrRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginBottom: 4,
  },
  meta: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
  notes: {
    marginTop: 6,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  btnWrap: {
    flex: 1,
    minWidth: '100%',
  },
  btnWrapHalf: {
    flex: 1,
    minWidth: 120,
  },
  btnPrimary: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  btnPrimaryText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  btnGhost: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    minHeight: 46,
  },
  btnGhostText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.55,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pendingText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
});
