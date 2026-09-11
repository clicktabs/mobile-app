import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  AppHeader,
  AppShell,
  MenuRow,
  openSupportEmail,
} from '../../components/chrome';
import { BrandLogo } from '../../components/BrandLogo';
import { Button, Field, LoadingBlock, SectionTitle, Subtitle } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';
import { confirmAction, showAlert } from '../../utils/confirm';
import {
  getWorkOffline,
  loadOfflineVisits,
  saveOfflineVisits,
  setWorkOffline,
} from '../../utils/offline';
import { storageDelete, storageGet, storageSet } from '../../utils/storage';
import { colors } from '../../theme/colors';
import type { StaffHomeStackParamList, StaffMenuStackParamList } from '../../navigation/types';
import { StaffEvvScreen } from './StaffEvvScreen';

function formatRole(role?: string | null) {
  if (!role) return '—';
  return role
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type MenuProps = NativeStackScreenProps<StaffMenuStackParamList, 'MenuHome'>;

export function StaffMenuHomeScreen({ navigation }: MenuProps) {
  const { token, logout } = useAuth();
  const [offline, setOffline] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [cachedCount, setCachedCount] = useState(0);

  const tabs = navigation.getParent();

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
      showAlert('Downloaded', `${visits.length} visit(s) saved for offline use.`);
    } catch (e) {
      showAlert('Download failed', e instanceof ApiError ? e.message : 'Error');
    } finally {
      setDownloading(false);
    }
  };

  const toggleOffline = async () => {
    const next = !offline;
    if (next && cachedCount === 0 && token) {
      await downloadVisits();
    }
    setOffline(next);
    await setWorkOffline(next);
    showAlert(
      next ? 'Working offline' : 'Back online',
      next
        ? 'Downloaded visits are available without a connection.'
        : 'You are connected to Click Tabs again.',
    );
  };

  return (
    <AppShell>
      <AppHeader title="Menu" />
      <ScrollView contentContainerStyle={styles.menuPad}>
        <Pressable
          onPress={toggleOffline}
          disabled={downloading}
          style={({ pressed }) => [
            styles.goOfflineBtn,
            offline && styles.goOfflineBtnActive,
            (pressed || downloading) && { opacity: 0.85 },
          ]}
        >
          <Text style={[styles.goOfflineText, offline && styles.goOfflineTextActive]}>
            {downloading ? 'Preparing…' : offline ? 'Go Online' : 'Go Offline'}
          </Text>
        </Pressable>
        {cachedCount > 0 ? (
          <Text style={styles.cacheHint}>{cachedCount} visit(s) cached on this device</Text>
        ) : null}

        <View style={styles.menuGroup}>
          <MenuRow icon="home-outline" label="Home" onPress={() => tabs?.navigate('Home')} />
          <MenuRow
            icon="person-outline"
            label="My Account"
            onPress={() => navigation.navigate('MenuAccount')}
          />
          <MenuRow
            icon="chatbubble-outline"
            label="My Messages"
            onPress={() => tabs?.navigate('Messages')}
          />
          <MenuRow
            icon="calendar-outline"
            label="My Schedule"
            onPress={() => tabs?.navigate('Schedule')}
          />
          <MenuRow
            icon="people-outline"
            label="My Patients"
            onPress={() => tabs?.navigate('Patients')}
          />
          <MenuRow
            icon="map-outline"
            label="Route Visits"
            onPress={() => tabs?.navigate('Home', { screen: 'RouteVisits' })}
          />
          <MenuRow
            icon="id-card-outline"
            label="Electronic ID Badge"
            onPress={() => tabs?.navigate('Home', { screen: 'ElectronicIdBadge' })}
          />
          <MenuRow
            icon="alert-circle-outline"
            label="My COVID-19 Screening(s)"
            onPress={() => navigation.navigate('MenuCovid')}
          />
          <MenuRow
            icon="clipboard-outline"
            label="NVA Log"
            onPress={() => navigation.navigate('MenuNva')}
          />
          <MenuRow
            icon="medkit-outline"
            label="Immunizations"
            onPress={() => navigation.navigate('MenuImmunizations')}
          />
          <MenuRow
            icon="mail-outline"
            label="Contact Us"
            onPress={() => navigation.navigate('MenuContact')}
          />
          <MenuRow
            icon="ribbon-outline"
            label="Licenses & Credentials"
            onPress={() => navigation.navigate('MenuCertification')}
          />
          <MenuRow
            icon="sparkles-outline"
            label="Product Updates"
            onPress={() => navigation.navigate('MenuUpdates')}
          />
          <MenuRow
            icon="time-outline"
            label="Time Clock"
            onPress={() => navigation.navigate('MenuTime')}
          />
          <MenuRow
            icon="car-outline"
            label="Mileage"
            onPress={() => navigation.navigate('MenuMileage')}
          />
          <MenuRow
            icon="navigate-outline"
            label="EVV"
            onPress={() => navigation.navigate('MenuEvv')}
          />
        </View>

        <View style={styles.menuSpacer} />

        <View style={styles.menuGroup}>
          <MenuRow
            icon="swap-horizontal-outline"
            label="Switch Agency"
            onPress={() => navigation.navigate('MenuSwitchAgency')}
          />
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
        </View>
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
      <ScrollView contentContainerStyle={styles.accountPad} keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={() => navigation.getParent()?.navigate('Home')}
          accessibilityRole="link"
          accessibilityLabel="Go to Home"
          style={({ pressed }) => [styles.logoLink, pressed && { opacity: 0.85 }]}
        >
          <BrandLogo size="sm" />
        </Pressable>

        <View style={styles.profileCard}>
          <Text style={styles.profileName}>{staffUser?.name || 'Staff'}</Text>
          <Text style={styles.profileEmail}>{staffUser?.email || '—'}</Text>
          <View style={styles.metaList}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Role</Text>
              <Text style={styles.metaValue}>{formatRole(staffUser?.role)}</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Organization</Text>
              <Text style={styles.metaValue}>{staffUser?.organization_name || '—'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.passwordSection}>
          <SectionTitle>Change password</SectionTitle>
          <Text style={styles.sectionHint}>Use a strong password you do not reuse elsewhere.</Text>
          <Field
            label="Current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
          />
          <Field label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
          <Field
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
          <Button
            label="Update password"
            loading={saving}
            onPress={async () => {
              if (!token) return;
              setSaving(true);
              try {
                await staffApi.staffChangePassword(token, currentPassword, newPassword, confirmPassword);
                showAlert('Password changed');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
              } catch (e) {
                showAlert('Failed', e instanceof ApiError ? e.message : 'Error');
              } finally {
                setSaving(false);
              }
            }}
          />
        </View>
      </ScrollView>
    </AppShell>
  );
}

export function StaffMenuSwitchAgencyScreen({
  navigation,
}: NativeStackScreenProps<StaffMenuStackParamList, 'MenuSwitchAgency'>) {
  const { staffUser } = useAuth();

  return (
    <AppShell>
      <AppHeader
        title="Switch Agency"
        actions={[{ icon: 'arrow-back', onPress: () => navigation.goBack() }]}
      />
      <ScrollView contentContainerStyle={styles.accountPad}>
        <View style={styles.profileCard}>
          <Text style={styles.metaLabel}>Current agency</Text>
          <Text style={styles.profileName}>{staffUser?.organization_name || '—'}</Text>
          <Text style={styles.profileEmail}>{staffUser?.email || '—'}</Text>
        </View>
        <Text style={styles.body}>
          Your account is tied to this agency. Agency changes are managed by your administrator in
          Click Tabs web — there is nothing else to select on mobile.
        </Text>
        <Button label="Open My Account" onPress={() => navigation.navigate('MenuAccount')} />
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
    MenuCovid: 'My COVID-19 Screening(s)',
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
        actions={[
          {
            icon: 'arrow-back',
            onPress: () => {
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.navigate('MenuHome');
            },
          },
        ]}
      />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
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
}: NativeStackScreenProps<StaffHomeStackParamList, 'ElectronicIdBadge'>) {
  const { staffUser } = useAuth();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const storageKey = `ct_badge_photo_${staffUser?.id || 'guest'}`;

  useEffect(() => {
    (async () => {
      const saved = await storageGet(storageKey);
      if (saved) setPhotoUri(saved);
    })();
  }, [storageKey]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert('Permission needed', 'Allow photo library access to upload a badge image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.55,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const mime = asset.mimeType || 'image/jpeg';
    const dataUri = asset.base64
      ? `data:${mime};base64,${asset.base64}`
      : asset.uri;

    setPhotoUri(dataUri);
    try {
      await storageSet(storageKey, dataUri);
      showAlert('Badge photo updated');
    } catch {
      showAlert('Upload failed', 'Please try a smaller image.');
    }
  };

  const clearPhoto = async () => {
    setPhotoUri(null);
    await storageDelete(storageKey);
  };

  const roleLabel = formatRole(staffUser?.role) || 'Caregiver';
  const orgName = staffUser?.organization_name || 'Click Tabs';

  return (
    <AppShell>
      <AppHeader
        title="Electronic ID Badge"
        actions={[{ icon: 'arrow-back', onPress: () => navigation.goBack() }]}
      />
      <ScrollView contentContainerStyle={styles.badgePad}>
        <Pressable onPress={pickPhoto} style={styles.photoBox}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="camera" size={36} color={colors.brandMagenta} />
              <Text style={styles.uploadText}>Upload Image</Text>
            </View>
          )}
        </Pressable>
        {photoUri ? (
          <Pressable onPress={clearPhoto} style={{ marginBottom: 16 }}>
            <Text style={styles.clearPhoto}>Remove photo</Text>
          </Pressable>
        ) : null}

        <Text style={styles.badgeName}>{staffUser?.name || 'Staff Member'}</Text>
        <Text style={styles.badgeRole}>{roleLabel}</Text>

        <Text style={styles.essential}>Essential Personnel</Text>
        <Text style={styles.essentialLaw}>Sec. 403. Essential Assistance (42 U.S.C. 5170b)</Text>

        <Text style={styles.orgName}>{orgName}</Text>
        <Text style={styles.orgMeta}>
          {orgName}
          {staffUser?.email ? ` · ${staffUser.email}` : ''}
        </Text>

        <View style={styles.badgeDivider} />
        <Pressable
          onPress={() => navigation.getParent()?.navigate('Menu', { screen: 'MenuAccount' })}
          style={({ pressed }) => [styles.noneBtn, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.noneBtnText}>Account</Text>
        </Pressable>
      </ScrollView>
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
      showAlert('Failed', e instanceof ApiError ? e.message : 'Error');
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
                showAlert('Clocked in');
                load();
              } catch (e) {
                showAlert('Failed', e instanceof ApiError ? e.message : 'Error');
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
                showAlert('Clocked out');
                load();
              } catch (e) {
                showAlert('Failed', e instanceof ApiError ? e.message : 'Error');
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
      showAlert('Failed', e instanceof ApiError ? e.message : 'Error');
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
                showAlert('Saved');
                load();
              } catch (e) {
                showAlert('Failed', e instanceof ApiError ? e.message : 'Error');
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
  menuPad: {
    paddingBottom: 32,
  },
  goOfflineBtn: {
    marginHorizontal: 20,
    marginTop: 18,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  goOfflineBtnActive: {
    borderColor: colors.brandMagenta,
    backgroundColor: '#FFF1F5',
  },
  goOfflineText: {
    fontWeight: '700',
    fontSize: 15,
    color: colors.ink,
    letterSpacing: -0.1,
  },
  goOfflineTextActive: {
    color: colors.brandMagenta,
  },
  menuGroup: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  menuSpacer: {
    height: 20,
    backgroundColor: colors.bg,
  },
  sep: { height: 10, backgroundColor: '#F3F4F6' },
  cacheHint: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    color: colors.textMuted,
    fontSize: 12,
  },
  meta: { color: colors.textMuted, marginBottom: 4 },
  accountPad: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  logoLink: {
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 8,
    marginBottom: 28,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.25,
    lineHeight: 28,
    marginBottom: 6,
  },
  profileEmail: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: 18,
  },
  metaList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  metaRow: {
    paddingVertical: 14,
    gap: 4,
  },
  metaDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 21,
  },
  passwordSection: {
    paddingTop: 4,
  },
  sectionHint: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: 18,
  },
  badgePad: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
    alignItems: 'center',
  },
  photoBox: {
    width: 148,
    height: 148,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    backgroundColor: '#F3F4F6',
    marginBottom: 22,
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadText: {
    color: colors.brandMagenta,
    fontWeight: '600',
    fontSize: 15,
  },
  clearPhoto: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  badgeName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 6,
  },
  badgeRole: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 22,
  },
  essential: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.brandMagenta,
    textAlign: 'center',
    marginBottom: 6,
  },
  essentialLaw: {
    fontSize: 13,
    color: '#2563eb',
    textAlign: 'center',
    marginBottom: 22,
  },
  orgName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  orgMeta: {
    fontSize: 13,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  badgeDivider: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginTop: 28,
    marginBottom: 16,
  },
  noneBtn: {
    alignSelf: 'stretch',
    backgroundColor: colors.brandMagenta,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  noneBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
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
  badgeOrg: { color: colors.textMuted },
  badgeEmail: { color: colors.text, marginTop: 8 },
  body: { color: colors.text, lineHeight: 22, fontSize: 15, marginBottom: 16 },
  card: {
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
});
