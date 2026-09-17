import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AppHeader, AppShell, MenuRow } from '../../components/chrome';
import { BrandLogo } from '../../components/BrandLogo';
import { Button, Field, LoadingBlock, SectionTitle, Subtitle } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';
import { confirmAction, showAlert } from '../../utils/confirm';
import { useConnectivity } from '../../context/ConnectivityContext';
import { storageDelete, storageGet, storageSet } from '../../utils/storage';
import { safeGoBack } from '../../utils/navigation';
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
  // Reported, not chosen: the app decides this for itself now.
  const { state: connectivity } = useConnectivity();
  const [loggingOut, setLoggingOut] = useState(false);

  const tabs = navigation.getParent();

  return (
    <AppShell>
      <AppHeader title="Menu" />
      <ScrollView contentContainerStyle={styles.menuPad}>
        {/* Status, not a control. There is nothing here to press: the app switches
            between online and offline on its own, and a button offering to "Go Online"
            could not deliver it on a phone with no signal. Shown only when it is not the
            ordinary case, so a working connection costs no attention. */}
        {connectivity !== 'online' ? (
          <Text style={styles.cacheHint}>
            {connectivity === 'probing'
              ? 'Checking the connection…'
              : 'No connection. Work is saved on this device and will upload automatically.'}
          </Text>
        ) : null}

        <View style={styles.menuGroup}>
          <MenuRow icon="home-outline" label="Home" onPress={() => tabs?.navigate('Home')} />
          <MenuRow
            icon="person-outline"
            label="My Account"
            onPress={() => navigation.navigate('MenuAccount')}
          />
          <MenuRow
            icon="key-outline"
            label="Electronic Signature PIN"
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
            icon="ribbon-outline"
            label="Licenses & Credentials"
            onPress={() => navigation.navigate('MenuCertification')}
          />
          <MenuRow
            icon="wallet-outline"
            label="My Pay"
            onPress={() => navigation.navigate('MenuPay')}
          />
          <MenuRow
            icon="car-outline"
            label="Mileage"
            onPress={() => navigation.navigate('MenuMileage')}
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
  const [savingPassword, setSavingPassword] = useState(false);

  // Electronic Signature PIN state
  const [pinStatus, setPinStatus] = useState<staffApi.SignaturePinStatus | null>(null);
  const [currentPin, setCurrentPin] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [usePasswordToVerify, setUsePasswordToVerify] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await staffApi.getSignaturePinStatus(token);
        if (res.data) setPinStatus(res.data);
      } catch {
        // non-blocking
      }
    })();
  }, [token]);

  const handleUpdatePin = async () => {
    if (!token) return;
    const cleanPin = newPin.trim();
    const cleanConfirm = confirmPin.trim();

    if (!cleanPin) {
      showAlert('PIN required', 'Please enter a 4–6 digit numerical PIN.');
      return;
    }
    if (cleanPin.length < 4 || cleanPin.length > 6 || !/^\d+$/.test(cleanPin)) {
      showAlert('Invalid PIN', 'PIN must be between 4 and 6 digits (numbers only).');
      return;
    }
    if (cleanPin !== cleanConfirm) {
      showAlert('Mismatch', 'PIN confirmation does not match.');
      return;
    }
    if (pinStatus?.has_pin) {
      if (usePasswordToVerify) {
        if (!accountPassword.trim()) {
          showAlert('Password required', 'Please enter your account password.');
          return;
        }
      } else if (!currentPin.trim()) {
        showAlert('Current PIN required', 'Please enter your current PIN, or verify with account password.');
        return;
      }
    }

    setSavingPin(true);
    try {
      const res = await staffApi.updateSignaturePin(token, {
        pin: cleanPin,
        pin_confirmation: cleanConfirm,
        current_pin: usePasswordToVerify ? undefined : currentPin.trim(),
        password: usePasswordToVerify ? accountPassword.trim() : undefined,
      });
      showAlert('PIN saved', res.message || 'Electronic signature PIN updated successfully.', 'success');
      setPinStatus({ has_pin: true, pin_set_at: new Date().toISOString() });
      setCurrentPin('');
      setAccountPassword('');
      setNewPin('');
      setConfirmPin('');
    } catch (e) {
      showAlert('Update failed', e instanceof ApiError ? e.message : 'Failed to update PIN');
    } finally {
      setSavingPin(false);
    }
  };

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

        {/* Electronic Signature PIN Section */}
        <View style={styles.sectionCard}>
          <View style={styles.pinHeaderRow}>
            <View style={{ flex: 1 }}>
              <SectionTitle>Electronic Signature PIN</SectionTitle>
              <Text style={styles.sectionHint}>
                Create or change your 4–6 digit PIN used to electronically sign visit documentation and clinical notes.
              </Text>
            </View>
            <View style={[styles.pinStatusBadge, pinStatus?.has_pin ? styles.pinStatusConfigured : styles.pinStatusMissing]}>
              <Ionicons
                name={pinStatus?.has_pin ? 'checkmark-circle' : 'alert-circle'}
                size={14}
                color={pinStatus?.has_pin ? '#065F46' : '#92400E'}
              />
              <Text style={[styles.pinStatusText, pinStatus?.has_pin ? styles.pinStatusTextConfigured : styles.pinStatusTextMissing]}>
                {pinStatus?.has_pin ? 'Configured' : 'Not set up'}
              </Text>
            </View>
          </View>

          {pinStatus?.has_pin ? (
            <>
              {usePasswordToVerify ? (
                <Field
                  label="Account password"
                  value={accountPassword}
                  onChangeText={setAccountPassword}
                  secureTextEntry
                  placeholder="Enter login password"
                />
              ) : (
                <Field
                  label="Current PIN"
                  value={currentPin}
                  onChangeText={setCurrentPin}
                  secureTextEntry
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="Enter current 4-6 digit PIN"
                />
              )}
              <Pressable
                onPress={() => setUsePasswordToVerify(!usePasswordToVerify)}
                style={styles.switchVerifyLink}
              >
                <Text style={styles.switchVerifyText}>
                  {usePasswordToVerify ? '← Verify with current PIN instead' : 'Forgot current PIN? Verify with account password'}
                </Text>
              </Pressable>
            </>
          ) : null}

          <Field
            label={pinStatus?.has_pin ? 'New PIN (4–6 digits)' : 'Set Signature PIN (4–6 digits)'}
            value={newPin}
            onChangeText={setNewPin}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={6}
            placeholder="e.g. 1234"
          />
          <Field
            label="Confirm New PIN"
            value={confirmPin}
            onChangeText={setConfirmPin}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={6}
            placeholder="Repeat PIN"
          />

          <Button
            label={savingPin ? 'Saving PIN…' : pinStatus?.has_pin ? 'Update Signature PIN' : 'Save Signature PIN'}
            loading={savingPin}
            onPress={handleUpdatePin}
          />
        </View>

        {/* Change Password Section */}
        <View style={styles.sectionCard}>
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
            loading={savingPassword}
            onPress={async () => {
              if (!token) return;
              setSavingPassword(true);
              try {
                await staffApi.staffChangePassword(token, currentPassword, newPassword, confirmPassword);
                showAlert('Password changed', 'Your account password has been updated.', 'success');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
              } catch (e) {
                showAlert('Failed', e instanceof ApiError ? e.message : 'Error');
              } finally {
                setSavingPassword(false);
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

/**
 * Licenses & Credentials.
 *
 * This was a generic info screen shared by six menu entries, keyed off route.name. Five
 * of those entries have been removed, so the lookup tables and per-route conditionals are
 * gone with them — one entry in a map is just an indirection.
 */
export function StaffMenuInfoScreen({
  navigation,
}: NativeStackScreenProps<StaffMenuStackParamList, 'MenuCertification'>) {
  return (
    <AppShell>
      <AppHeader
        title="Click Tabs Certification"
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
        <Text style={styles.body}>
          Organization and clinician certification / SOC certification reports are available
          in Click Tabs web Reports. Your mobile account role and organization are shown
          under Account.
        </Text>
        <Button label="Open Account" onPress={() => navigation.navigate('MenuAccount')} />
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
  route,
}: NativeStackScreenProps<StaffMenuStackParamList, 'MenuEvv'>) {
  return (
    <AppShell>
      <AppHeader
        title="EVV"
        onBackPress={() => {
          if (route.params?.scheduleId) {
            navigation.getParent()?.navigate('Schedule', { screen: 'ScheduleList' });
            return;
          }
          safeGoBack(navigation, { tab: 'Menu', screen: 'MenuHome' });
        }}
      />
      <StaffEvvScreen
        embedded
        focusScheduleId={route.params?.scheduleId ? Number(route.params.scheduleId) : undefined}
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  menuPad: {
    paddingBottom: 32,
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
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 20,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)',
  },
  pinHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  pinStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 2,
  },
  pinStatusConfigured: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  pinStatusMissing: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  pinStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pinStatusTextConfigured: {
    color: '#065F46',
  },
  pinStatusTextMissing: {
    color: '#92400E',
  },
  switchVerifyLink: {
    marginTop: -8,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  switchVerifyText: {
    fontSize: 13,
    color: colors.brandMagenta,
    fontWeight: '600',
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
