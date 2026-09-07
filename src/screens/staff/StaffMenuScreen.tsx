import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppHeader,
  AppShell,
  MenuRow,
  OfflineCard,
  openSupportEmail,
} from '../../components/chrome';
import { BrandLogo } from '../../components/BrandLogo';
import { Button, Field, LoadingBlock, Subtitle, Title } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';
import { confirmAction } from '../../utils/confirm';
import {
  getWorkOffline,
  loadOfflineVisits,
  saveOfflineVisits,
  setWorkOffline,
} from '../../utils/offline';
import { colors } from '../../theme/colors';
import type { StaffMenuStackParamList } from '../../navigation/types';
import { StaffEvvScreen } from './StaffEvvScreen';

type MenuProps = NativeStackScreenProps<StaffMenuStackParamList, 'MenuHome'>;

export function StaffMenuHomeScreen({ navigation }: MenuProps) {
  const { token, logout } = useAuth();
  const [offline, setOffline] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [cachedCount, setCachedCount] = useState(0);

  useEffect(() => {
    (async () => {
      setOffline(await getWorkOffline());
      const cached = await loadOfflineVisits();
      setCachedCount(cached.visits.length);
    })();
  }, []);

  const downloadVisits = async () => {
    if (!token) return;
    setDownloading(true);
    try {
      const res = await staffApi.staffTodaySchedule(token);
      const visits = res.data || [];
      await saveOfflineVisits(visits);
      setCachedCount(visits.length);
      Alert.alert('Downloaded', `${visits.length} visit(s) saved for offline use.`);
    } catch (e) {
      Alert.alert('Download failed', e instanceof ApiError ? e.message : 'Error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <AppShell>
      <AppHeader title="Menu" />
      <ScrollView>
        <OfflineCard
          offline={offline}
          downloading={downloading}
          onDownload={downloadVisits}
          onToggle={async (v) => {
            setOffline(v);
            await setWorkOffline(v);
            if (v && cachedCount === 0) {
              Alert.alert('Tip', 'Download visits before working offline.');
            }
          }}
        />
        {cachedCount > 0 ? (
          <Text style={styles.cacheHint}>{cachedCount} visit(s) cached on this device</Text>
        ) : null}

        <MenuRow icon="person-outline" label="Account" onPress={() => navigation.navigate('MenuAccount')} />
        <MenuRow icon="pulse-outline" label="NVA Log" onPress={() => navigation.navigate('MenuNva')} />
        <MenuRow
          icon="help-circle-outline"
          label="COVID-19 Screening"
          onPress={() => navigation.navigate('MenuCovid')}
        />
        <MenuRow
          icon="medkit-outline"
          label="Immunizations"
          onPress={() => navigation.navigate('MenuImmunizations')}
        />
        <View style={styles.sep} />
        <MenuRow
          icon="call-outline"
          label="Contact Us"
          onPress={() => navigation.navigate('MenuContact')}
        />
        <MenuRow
          icon="ribbon-outline"
          label="Click Tabs Certification"
          onPress={() => navigation.navigate('MenuCertification')}
        />
        <View style={styles.sep} />
        <MenuRow icon="time-outline" label="Time Clock" onPress={() => navigation.navigate('MenuTime')} />
        <MenuRow icon="car-outline" label="Mileage" onPress={() => navigation.navigate('MenuMileage')} />
        <MenuRow icon="location-outline" label="EVV Visits" onPress={() => navigation.navigate('MenuEvv')} />
        <View style={styles.sep} />
        <MenuRow
          icon="log-out-outline"
          label="Log Out"
          danger
          onPress={async () => {
            const ok = await confirmAction('Log out?', 'You will need to sign in again.');
            if (!ok) return;
            setLoggingOut(true);
            try {
              await logout();
            } finally {
              setLoggingOut(false);
            }
          }}
        />
        {loggingOut ? <Text style={styles.cacheHint}>Signing out…</Text> : null}
      </ScrollView>
    </AppShell>
  );
}

export function StaffMenuAccountScreen({ navigation }: NativeStackScreenProps<StaffMenuStackParamList, 'MenuAccount'>) {
  const { token, staffUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <AppShell>
      <AppHeader title="Account" actions={[{ icon: 'arrow-back', onPress: () => navigation.goBack() }]} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <BrandLogo size="sm" style={{ marginBottom: 12 }} />
        <Title>{staffUser?.name || 'Staff'}</Title>
        <Subtitle>{staffUser?.email}</Subtitle>
        <Text style={styles.meta}>Role: {staffUser?.role || '—'}</Text>
        <Text style={styles.meta}>Organization: {staffUser?.organization_name || '—'}</Text>
        <Title>Change password</Title>
        <Field label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
        <Field label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
        <Field label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
        <Button
          label="Update password"
          loading={saving}
          onPress={async () => {
            if (!token) return;
            setSaving(true);
            try {
              await staffApi.staffChangePassword(token, currentPassword, newPassword, confirmPassword);
              Alert.alert('Password changed');
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
            } catch (e) {
              Alert.alert('Failed', e instanceof ApiError ? e.message : 'Error');
            } finally {
              setSaving(false);
            }
          }}
        />
      </ScrollView>
    </AppShell>
  );
}

export function StaffMenuInfoScreen({
  navigation,
  route,
}: NativeStackScreenProps<
  StaffMenuStackParamList,
  'MenuNva' | 'MenuCovid' | 'MenuImmunizations' | 'MenuCertification' | 'MenuUpdates' | 'MenuContact'
>) {
  const titles: Record<string, string> = {
    MenuNva: 'NVA Log',
    MenuCovid: 'COVID-19 Screening',
    MenuImmunizations: 'Immunizations',
    MenuCertification: 'Click Tabs Certification',
    MenuUpdates: 'Product Updates',
    MenuContact: 'Contact Us',
  };
  const bodies: Record<string, string> = {
    MenuNva:
      'Non-Visit Activities (NVA) are managed in Click Tabs web under Admin → Non-Visit Activities. Mobile shows this entry so field staff can jump to Contact Us or Account while NVA logging stays on web.',
    MenuCovid:
      'COVID-19 screening is saved on the patient chart in Click Tabs web. Open a patient from the Patients tab to continue clinical documentation there.',
    MenuImmunizations:
      'Patient immunization logs live on the patient chart (intake meta) in Click Tabs web. Use Patients to open a chart, then record immunizations on web.',
    MenuCertification:
      'Organization and clinician certification / SOC certification reports are available in Click Tabs web Reports. Your mobile account role and organization are shown under Account.',
    MenuUpdates:
      'Route Visits, Electronic ID Badge, EVV check-in/out, offline visit download, and in-app email messaging are available in this mobile app. More field tools continue to roll out from the production API.',
    MenuContact:
      'Need help? Email Click Tabs support. You can also reach your agency administrator from your organization account.',
  };

  return (
    <AppShell>
      <AppHeader
        title={titles[route.name] || 'Info'}
        actions={[{ icon: 'arrow-back', onPress: () => navigation.goBack() }]}
      />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.body}>{bodies[route.name]}</Text>
        {route.name === 'MenuContact' ? (
          <Button label="Email support" onPress={() => openSupportEmail()} />
        ) : null}
        {route.name === 'MenuCovid' || route.name === 'MenuImmunizations' ? (
          <Button label="Go to Patients" onPress={() => navigation.getParent()?.navigate('Patients')} />
        ) : null}
        {route.name === 'MenuCertification' ? (
          <Button label="Open Account" onPress={() => navigation.navigate('MenuAccount')} />
        ) : null}
      </ScrollView>
    </AppShell>
  );
}

export function StaffMenuBadgeScreen({
  navigation,
}: NativeStackScreenProps<StaffMenuStackParamList, 'MenuBadge'>) {
  const { staffUser } = useAuth();
  return (
    <AppShell>
      <AppHeader title="ID Badge" actions={[{ icon: 'arrow-back', onPress: () => navigation.goBack() }]} />
      <View style={styles.badgeWrap}>
        <View style={styles.badge}>
          <BrandLogo size="md" />
          <Text style={styles.badgeName}>{staffUser?.name || 'Staff Member'}</Text>
          <Text style={styles.badgeRole}>{staffUser?.role || 'Caregiver'}</Text>
          <Text style={styles.badgeOrg}>{staffUser?.organization_name || 'Click Tabs'}</Text>
          <Text style={styles.badgeEmail}>{staffUser?.email}</Text>
        </View>
      </View>
    </AppShell>
  );
}

export function StaffMenuTimeScreen({
  navigation,
}: NativeStackScreenProps<StaffMenuStackParamList, 'MenuTime'>) {
  const { token } = useAuth();
  const [entries, setEntries] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await staffApi.getTimeEntries(token);
      setEntries(res.data || []);
    } catch (e) {
      Alert.alert('Failed', e instanceof ApiError ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AppShell>
      <AppHeader title="Time Clock" actions={[{ icon: 'arrow-back', onPress: () => navigation.goBack() }]} />
      {loading ? (
        <LoadingBlock />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Button
            label="Clock in"
            onPress={async () => {
              if (!token) return;
              try {
                await staffApi.clockIn(token);
                Alert.alert('Clocked in');
                load();
              } catch (e) {
                Alert.alert('Failed', e instanceof ApiError ? e.message : 'Error');
              }
            }}
          />
          <Button
            label="Clock out"
            variant="secondary"
            onPress={async () => {
              if (!token) return;
              try {
                await staffApi.clockOut(token);
                Alert.alert('Clocked out');
                load();
              } catch (e) {
                Alert.alert('Failed', e instanceof ApiError ? e.message : 'Error');
              }
            }}
          />
          {entries.map((e) => (
            <View key={String(e.id)} style={styles.card}>
              <Text>
                {String(e.clock_in)} → {String(e.clock_out || 'open')}
              </Text>
              <Text style={styles.meta}>Hours: {String(e.hours ?? '—')}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </AppShell>
  );
}

export function StaffMenuMileageScreen({
  navigation,
}: NativeStackScreenProps<StaffMenuStackParamList, 'MenuMileage'>) {
  const { token } = useAuth();
  const [mileage, setMileage] = useState<Record<string, any>[]>([]);
  const [totalMiles, setTotalMiles] = useState(0);
  const [patientId, setPatientId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [miles, setMiles] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await staffApi.getMileage(token);
      setMileage(res.data || []);
      setTotalMiles(Number(res.total_miles || 0));
    } catch (e) {
      Alert.alert('Failed', e instanceof ApiError ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AppShell>
      <AppHeader title="Mileage" actions={[{ icon: 'arrow-back', onPress: () => navigation.goBack() }]} />
      {loading ? (
        <LoadingBlock />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Subtitle>Total: {totalMiles} miles</Subtitle>
          <Field label="Patient ID" value={patientId} onChangeText={setPatientId} keyboardType="number-pad" />
          <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
          <Field label="Miles" value={miles} onChangeText={setMiles} keyboardType="decimal-pad" />
          <Button
            label="Record mileage"
            onPress={async () => {
              if (!token) return;
              try {
                await staffApi.recordMileage(token, {
                  patient_id: Number(patientId),
                  date,
                  miles: Number(miles),
                });
                Alert.alert('Saved');
                load();
              } catch (e) {
                Alert.alert('Failed', e instanceof ApiError ? e.message : 'Error');
              }
            }}
          />
          {mileage.map((m) => (
            <View key={String(m.id)} style={styles.card}>
              <Text>
                {String(m.date)} · {String(m.miles)} mi
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </AppShell>
  );
}

export function StaffMenuEvvScreen({
  navigation,
}: NativeStackScreenProps<StaffMenuStackParamList, 'MenuEvv'>) {
  return (
    <AppShell>
      <AppHeader title="EVV" actions={[{ icon: 'arrow-back', onPress: () => navigation.goBack() }]} />
      <StaffEvvScreen embedded />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  sep: { height: 10, backgroundColor: '#F3F4F6' },
  cacheHint: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: colors.textMuted,
    fontSize: 12,
  },
  meta: { color: colors.textMuted, marginBottom: 4 },
  body: { color: colors.text, lineHeight: 22, fontSize: 15, marginBottom: 16 },
  badgeWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  badge: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 6,
  },
  badgeName: { marginTop: 12, fontSize: 22, fontWeight: '800', color: colors.ink },
  badgeRole: { color: colors.brandMagenta, fontWeight: '700' },
  badgeOrg: { color: colors.textMuted },
  badgeEmail: { color: colors.text, marginTop: 8 },
  card: {
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
});
