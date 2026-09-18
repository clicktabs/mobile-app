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
import { scopeLabels } from '../../utils/scopeLabels';
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
  supervisoryDue: number;
  supervisoryOverdue: number;
  /** My own notes QA sent back. */
  qaReturned: number;
  /** Waiting on a reviewer — null when this person is not one. */
  qaPending: number | null;
};

type DashTile = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value?: string | number;
  showChevron?: boolean;
  /** Omitted for a tile that only reports — see the supervisory one. */
  onPress?: () => void;
  /** Colours the figure when it is one somebody has to act on. */
  tone?: 'danger';
};

const EMPTY_STATS: HomeStats = {
  patients: 0,
  shiftOffers: 0,
  availableShifts: 0,
  licenses: null,
  payrollHours: '0.00',
  supervisoryDue: 0,
  supervisoryOverdue: 0,
  qaReturned: 0,
  qaPending: null,
};

export function StaffDashboardScreen() {
  const { token, handleUnauthorized, staffUser, updateStaffUser } = useAuth();
  // "My Patients" is wrong for a manager: the list is the agency's, not theirs.
  const labels = scopeLabels(staffUser);
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<HomeStats>(EMPTY_STATS);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [dash, patients, available, offers, pay] = await Promise.all([
        staffApi.staffDashboard(token),
        staffApi.staffPatients(token, { status: 'all', limit: 1, page: 1 }).catch(() => null),
        staffApi.staffAvailableShifts(token, 30).catch(() => null),
        staffApi.staffShiftOffers(token).catch(() => null),
        staffApi.staffPayrollPeriods(token).catch(() => null),
      ]);
      const s = dash.data?.stats;
      const listTotal =
        (patients as any)?.pagination?.total ??
        (patients as any)?.count ??
        (Array.isArray(patients?.data) ? patients.data.length : null);
      const fromDash = Number(s?.assigned_patients ?? 0) || 0;
      const fromList = listTotal != null ? Number(listTotal) || 0 : null;

      const marketAvailable =
        (available as any)?.count ??
        (Array.isArray((available as any)?.data) ? (available as any).data.length : null);
      const marketOffers =
        (offers as any)?.count ??
        (Array.isArray((offers as any)?.data) ? (offers as any).data.length : null);

      let payrollLabel =
        s?.payroll_hours_label ||
        (s?.payroll_hours != null ? Number(s.payroll_hours).toFixed(2) : null);

      // Prefer live payroll periods API when dashboard still shows 0
      if ((!payrollLabel || payrollLabel === '0.00') && pay && Array.isArray((pay as any).data)) {
        const rows = (pay as any).data as { regular_hours?: number; overtime_hours?: number }[];
        if (rows.length) {
          const hours = rows.reduce(
            (sum, r) => sum + Number(r.regular_hours || 0) + Number(r.overtime_hours || 0),
            0,
          );
          if (hours > 0) {
            payrollLabel = hours.toFixed(2);
          }
        }
      }

      setStats({
        patients: fromList != null && fromList > 0 ? fromList : fromDash || fromList || 0,
        shiftOffers:
          marketOffers != null ? Number(marketOffers) || 0 : Number(s?.shift_offers ?? 0) || 0,
        availableShifts:
          marketAvailable != null
            ? Number(marketAvailable) || 0
            : Number(s?.available_shifts ?? 0) || 0,
        licenses: s?.licenses != null ? Number(s.licenses) || 0 : null,
        payrollHours: payrollLabel || '0.00',
        supervisoryDue: Number(s?.supervisory_visits_due ?? 0) || 0,
        supervisoryOverdue: Number(s?.supervisory_visits_overdue ?? 0) || 0,
        qaReturned: Number(s?.qa_returned_to_me ?? 0) || 0,
        // Left null for somebody who cannot review, so the tile can leave the number
        // off rather than claim an empty queue.
        qaPending:
          typeof s?.qa_pending_review === 'number' ? s.qa_pending_review : null,
      });

      /*
        Correct the stored login payload from what the server just said.

        That payload is written once at sign-in and never refreshed, so a permission flag
        added to it later is absent for everyone already signed in — and absent reads as
        false, which hid the Payroll Console entry from the people who hold the permission.
        The dashboard asks the server on every visit, so it is the one screen that always
        knows better; the Menu reads the result without anybody signing out.
      */
      const flags: Partial<typeof staffUser & object> = {};
      if (typeof s?.can_manage_payroll === 'boolean') flags.can_manage_payroll = s.can_manage_payroll;
      if (typeof s?.can_create_schedules === 'boolean') flags.can_create_schedules = s.can_create_schedules;
      if (typeof s?.can_access_qa === 'boolean') flags.can_access_qa = s.can_access_qa;
      if (typeof s?.can_approve_qa === 'boolean') flags.can_approve_qa = s.can_approve_qa;
      if (typeof s?.can_take_referrals === 'boolean') flags.can_take_referrals = s.can_take_referrals;
      if (Object.keys(flags).length) await updateStaffUser(flags);
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
  }, [token, handleUnauthorized, updateStaffUser]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const tiles: DashTile[] = [
    {
      key: 'patients',
      label: labels.patients,
      icon: 'person-circle-outline',
      value: stats.patients,
      onPress: () => navigation.navigate('Patients'),
    },
    {
      key: 'shift_offers',
      label: 'Shift Offers',
      icon: 'swap-horizontal-outline',
      value: stats.shiftOffers,
      onPress: () => navigation.navigate('ShiftOffers'),
    },
    {
      key: 'available_shifts',
      label: 'Available Shifts',
      icon: 'time-outline',
      value: stats.availableShifts,
      onPress: () => navigation.navigate('AvailableShifts'),
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
      onPress: () => navigation.navigate('Menu', { screen: 'MenuPay' }),
    },
    /*
      Aide supervision that has come due.

      A registered nurse has to observe an aide in the patient's home every 14 days
      where skilled care is also in place, and every 60 days for an aide-only patient.
      Miss one and it is a survey finding, and nothing surfaces it until somebody goes
      looking — so it sits on the screen people open every morning.

      Red once any of them is past its date: a bare count reads as workload, and these
      stop being workload the day they lapse.

      Opens the list, which names the patient, the aide and how far past the date each
      one is. A count with nothing behind it tells somebody there is a problem and not
      which one.
    */
    {
      key: 'supervisory',
      label: 'Supervisory Visits',
      icon: 'shield-checkmark-outline',
      value: stats.supervisoryOverdue > 0
        ? `${stats.supervisoryDue} · ${stats.supervisoryOverdue} overdue`
        : stats.supervisoryDue,
      tone: stats.supervisoryOverdue > 0 ? 'danger' : undefined,
      showChevron: true,
      onPress: () => navigation.navigate('SupervisoryVisits'),
    },
    /*
      The Payroll Console, opened in the browser.

      Not rebuilt in the app on purpose: its stages price a batch, release compliance
      holds and send a payout — work that wants the whole batch in view and is close to
      irreversible — and a second implementation of those rules would eventually disagree
      with the first. The console's own layout works at phone width now.

      Shown only to somebody the server says holds a payroll permission, because following
      the link without one produces an error in a browser they then have to close.
    */
    /*
      Quality Assurance.

      Leads with the number that is the reader's own problem — notes QA sent back, which
      are unbilled work sitting still — and only then with the queue, which is a reviewer's
      problem and is left off entirely for everybody else.

      Red when something has come back: a returned note is not workload, it is a document
      that cannot be billed until somebody fixes it.
    */
    ...(staffUser?.can_access_qa
      ? [
          {
            key: 'qa',
            label: 'Quality Assurance',
            icon: 'checkmark-done-outline' as const,
            value:
              stats.qaReturned > 0
                ? `${stats.qaReturned} sent back`
                : stats.qaPending !== null
                  ? `${stats.qaPending} to review`
                  : '—',
            tone: stats.qaReturned > 0 ? ('danger' as const) : undefined,
            showChevron: true,
            onPress: () => navigation.navigate('Qa'),
          },
        ]
      : []),
    ...(staffUser?.can_manage_payroll
      ? [
          {
            key: 'payroll_console',
            label: 'Payroll Console',
            icon: 'calculator-outline' as const,
            showChevron: true,
            onPress: () => navigation.navigate('PayrollHome'),
          },
        ]
      : []),
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
                // A tile that only reports must not look tappable or dim under a press.
                disabled={!tile.onPress}
                style={({ pressed }) => [
                  styles.tile,
                  pressed && tile.onPress ? { opacity: 0.9 } : null,
                ]}
              >
                <Ionicons
                  name={tile.icon}
                  size={22}
                  color={tile.tone === 'danger' ? '#B91C1C' : '#475569'}
                />
                <Text style={styles.tileLabel}>{tile.label}</Text>
                {tile.value !== undefined ? (
                  <Text style={[styles.tileValue, tile.tone === 'danger' && styles.tileValueDanger]}>
                    {tile.value}
                  </Text>
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
  // Slightly smaller, because this one carries a phrase rather than a bare figure.
  tileValueDanger: {
    fontSize: 13,
    color: '#B91C1C',
  },
});
