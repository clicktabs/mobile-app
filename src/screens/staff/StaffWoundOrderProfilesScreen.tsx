import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { AppShell } from '../../components/chrome';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import type { WoundOrderProfileRow } from '../../api/staff';
import { ApiError } from '../../api/client';
import type { StaffScheduleStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { confirmAction, showAlert } from '../../utils/confirm';
import { storageGet } from '../../utils/storage';

type Props = NativeStackScreenProps<StaffScheduleStackParamList, 'WoundOrderProfiles'>;
type TabId = 'patients' | 'profiles' | 'settings';

const CLEANSING_OPTS = ['Normal Saline', 'Wound Cleanser', 'Sterile Water', 'Antiseptic'];
const PRIMARY_OPTS = ['Hydrocolloid', 'Alginate', 'Foam', 'Hydrogel', 'Collagen', 'Gauze'];
const SECONDARY_OPTS = ['Transparent Film', 'Foam', 'Surgical Tape', 'Coban Wrap', 'Abd Pad'];
const FREQ_OPTS = ['Daily', 'Q2 Days', 'Q3 Days', 'QW'];

function staffPhotoStorageKey(userId?: number | null) {
  return `ct_badge_photo_${userId || 'guest'}`;
}

function initialsFromName(name?: string | null) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

export function StaffWoundOrderProfilesScreen({ navigation, route }: Props) {
  const { token, staffUser } = useAuth();
  const { patientId, patientName } = route.params;
  const [tab, setTab] = useState<TabId>('profiles');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState<WoundOrderProfileRow[]>([]);
  const [clinicianName, setClinicianName] = useState(staffUser?.name || 'Clinician');
  const [clinicianTitle, setClinicianTitle] = useState('Wound Care Specialist');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<WoundOrderProfileRow | null>(null);
  const [formName, setFormName] = useState('');
  const [formCleansing, setFormCleansing] = useState('Normal Saline');
  const [formPrimary, setFormPrimary] = useState('Hydrocolloid');
  const [formSecondary, setFormSecondary] = useState('Transparent Film');
  const [formFreq, setFormFreq] = useState('Q3 Days');

  const resolveAvatar = useCallback(
    async (apiAvatar?: string | null) => {
      if (apiAvatar) {
        setAvatarUrl(apiAvatar);
        return;
      }
      try {
        const localPhoto = await storageGet(staffPhotoStorageKey(staffUser?.id));
        setAvatarUrl(localPhoto || null);
      } catch {
        setAvatarUrl(null);
      }
    },
    [staffUser?.id],
  );

  const load = useCallback(
    async (isRefresh = false) => {
      if (!token) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await staffApi.getWoundOrderProfiles(token);
        setProfiles(res.data || []);
        if (res.clinician?.name) setClinicianName(res.clinician.name);
        else if (staffUser?.name) setClinicianName(staffUser.name);
        if (res.clinician?.title) setClinicianTitle(res.clinician.title);
        await resolveAvatar(res.clinician?.avatar_url);
      } catch (e) {
        showAlert('Order Profiles', e instanceof ApiError ? e.message : 'Unable to load profiles.');
        await resolveAvatar(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, staffUser?.name, resolveAvatar],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openCreate = () => {
    setEditing(null);
    setFormName('');
    setFormCleansing('Normal Saline');
    setFormPrimary('Hydrocolloid');
    setFormSecondary('Transparent Film');
    setFormFreq('Q3 Days');
    setEditorOpen(true);
  };

  const openEdit = (p: WoundOrderProfileRow) => {
    setEditing(p);
    setFormName(p.name);
    setFormCleansing(p.cleansing || 'Normal Saline');
    setFormPrimary(p.primary_dressing || 'Hydrocolloid');
    setFormSecondary(p.secondary_dressing || 'Transparent Film');
    setFormFreq(p.frequency || 'Q3 Days');
    setEditorOpen(true);
  };

  const saveProfile = async () => {
    if (!token) return;
    if (!formName.trim()) {
      showAlert('Name required', 'Enter a profile name.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: formName.trim(),
        cleansing: formCleansing,
        primary_dressing: formPrimary,
        secondary_dressing: formSecondary,
        frequency: formFreq,
      };
      if (editing) {
        await staffApi.updateWoundOrderProfile(token, editing.id, body);
      } else {
        await staffApi.createWoundOrderProfile(token, body);
      }
      setEditorOpen(false);
      await load(true);
    } catch (e) {
      showAlert('Save failed', e instanceof ApiError ? e.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const removeProfile = async (p: WoundOrderProfileRow) => {
    const ok = await confirmAction('Delete profile', `Delete “${p.name}”?`);
    if (!ok || !token) return;
    try {
      await staffApi.deleteWoundOrderProfile(token, p.id);
      await load(true);
      showAlert('Deleted', 'Order profile removed.');
    } catch (e) {
      showAlert('Delete failed', e instanceof ApiError ? e.message : 'Unable to delete.');
    }
  };

  const goNewWoundOrder = (profile?: WoundOrderProfileRow) => {
    navigation.navigate('NewWoundOrder', {
      patientId,
      patientName,
      profileId: profile?.id,
      profileName: profile?.name,
      cleansing: profile?.cleansing || undefined,
      primaryDressing: profile?.primary_dressing || undefined,
      secondaryDressing: profile?.secondary_dressing || undefined,
      frequency: profile?.frequency || undefined,
    });
  };

  const tabs = useMemo(
    () =>
      [
        { id: 'patients' as const, label: 'PATIENTS' },
        { id: 'profiles' as const, label: 'ORDER PROFILES' },
        { id: 'settings' as const, label: 'SETTINGS' },
      ] as const,
    [],
  );

  return (
    <AppShell>
      <LinearGradient colors={['#E8F4FB', '#F4F7FA', '#EEF2F6']} style={styles.headerGrad}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </Pressable>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]} accessibilityLabel="Default avatar">
            <Text style={styles.avatarInitials}>{initialsFromName(clinicianName)}</Text>
          </View>
        )}
        <Text style={styles.name}>{clinicianName}</Text>
        <Text style={styles.title}>{clinicianTitle}</Text>
      </LinearGradient>

      <View style={styles.tabBar}>
        {tabs.map((t) => {
          const on = tab === t.id;
          return (
            <Pressable key={t.id} onPress={() => setTab(t.id)} style={styles.tabItem}>
              <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
              {on ? <View style={styles.tabUnderline} /> : <View style={styles.tabUnderlineOff} />}
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#1E5A7A" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        >
          {tab === 'profiles' ? (
            <>
              {profiles.map((p, idx) => (
                <View key={p.id}>
                  <View style={styles.card}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle}>{p.name.toUpperCase()}</Text>
                      <View style={styles.cardActions}>
                        <Pressable onPress={() => openEdit(p)} hitSlop={8} style={styles.iconBtn}>
                          <Ionicons name="pencil" size={18} color="#2563EB" />
                        </Pressable>
                        <Pressable onPress={() => removeProfile(p)} hitSlop={8} style={styles.iconBtn}>
                          <Ionicons name="trash" size={18} color="#DC2626" />
                        </Pressable>
                      </View>
                    </View>
                    <Detail label="Cleansing" value={p.cleansing || '—'} />
                    <Detail label="Primary" value={p.primary_dressing || '—'} />
                    <Detail label="Secondary" value={p.secondary_dressing || '—'} />
                    <Detail label="Freq" value={p.frequency || '—'} />
                    <Pressable
                      onPress={() => goNewWoundOrder(p)}
                      style={({ pressed }) => [styles.useBtn, pressed && { opacity: 0.9 }]}
                    >
                      <Text style={styles.useBtnText}>Use for new order</Text>
                    </Pressable>
                  </View>
                  {idx === 0 ? (
                    <Pressable
                      onPress={openCreate}
                      style={({ pressed }) => [styles.createInline, pressed && { opacity: 0.9 }]}
                    >
                      <Text style={styles.createInlineText}>+ CREATE NEW ORDER PROFILE</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
              {profiles.length === 0 ? (
                <>
                  <Text style={styles.empty}>No order profiles yet.</Text>
                  <Pressable
                    onPress={openCreate}
                    style={({ pressed }) => [styles.createInline, pressed && { opacity: 0.9 }]}
                  >
                    <Text style={styles.createInlineText}>+ CREATE NEW ORDER PROFILE</Text>
                  </Pressable>
                </>
              ) : null}
            </>
          ) : null}

          {tab === 'patients' ? (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Current patient</Text>
              <Text style={styles.panelBody}>{patientName || `Patient #${patientId}`}</Text>
              <Pressable
                onPress={() => navigation.navigate('WoundManager', { patientId, patientName })}
                style={({ pressed }) => [styles.createInline, pressed && { opacity: 0.9 }]}
              >
                <Text style={styles.createInlineText}>OPEN WOUND MANAGER</Text>
              </Pressable>
            </View>
          ) : null}

          {tab === 'settings' ? (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Order profile settings</Text>
              <Text style={styles.panelBody}>
                Templates apply cleansing, primary/secondary dressings, and frequency when you start a new wound
                order. Electronic signature is required on Sign & Submit.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      <View style={styles.footer}>
        <Pressable
          onPress={() => goNewWoundOrder()}
          style={({ pressed }) => [styles.newOrderBtn, pressed && { opacity: 0.92 }]}
        >
          <Text style={styles.newOrderText}>+ NEW WOUND ORDER</Text>
        </Pressable>
      </View>

      <Modal visible={editorOpen} animationType="slide" onRequestClose={() => setEditorOpen(false)}>
        <AppShell>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setEditorOpen(false)}>
              <Ionicons name="close" size={24} color="#0F172A" />
            </Pressable>
            <Text style={styles.modalTitle}>{editing ? 'Edit Order Profile' : 'Create Order Profile'}</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Profile name</Text>
            <TextInput
              value={formName}
              onChangeText={setFormName}
              placeholder="e.g. My Stage 2 Pressure Ulcer Routine"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />
            <Text style={styles.label}>Cleansing</Text>
            <ChipRow options={CLEANSING_OPTS} value={formCleansing} onChange={setFormCleansing} />
            <Text style={styles.label}>Primary</Text>
            <ChipRow options={PRIMARY_OPTS} value={formPrimary} onChange={setFormPrimary} />
            <Text style={styles.label}>Secondary</Text>
            <ChipRow options={SECONDARY_OPTS} value={formSecondary} onChange={setFormSecondary} />
            <Text style={styles.label}>Freq</Text>
            <ChipRow options={FREQ_OPTS} value={formFreq} onChange={setFormFreq} />
            <Pressable
              disabled={saving}
              onPress={saveProfile}
              style={({ pressed }) => [styles.newOrderBtn, { marginTop: 16 }, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.newOrderText}>{saving ? 'SAVING…' : 'SAVE PROFILE'}</Text>
            </Pressable>
          </ScrollView>
        </AppShell>
      </Modal>
    </AppShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Text style={styles.detailLine}>
      <Text style={styles.detailKey}>{label}: </Text>
      <Text style={styles.detailVal}>{value}</Text>
    </Text>
  );
}

function ChipRow({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((o) => {
        const on = value === o;
        return (
          <Pressable key={o} onPress={() => onChange(o)} style={[styles.chip, on && styles.chipOn]}>
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  headerGrad: {
    paddingTop: 52,
    paddingBottom: 18,
    alignItems: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: 14,
    top: 52,
    zIndex: 2,
    padding: 4,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: '#CBD5E1',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCEAF4',
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E5A7A',
    letterSpacing: 0.5,
  },
  name: {
    marginTop: 12,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  title: {
    marginTop: 4,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 12,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: '#94A3B8',
    marginBottom: 10,
  },
  tabTextOn: { color: '#0F172A' },
  tabUnderline: {
    height: 3,
    width: '78%',
    borderRadius: 2,
    backgroundColor: '#1E5A7A',
  },
  tabUnderlineOff: { height: 3, width: '78%' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1, backgroundColor: '#EEF2F6' },
  scrollContent: { padding: 16, paddingBottom: 110, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    boxShadow: '0px 4px 10px rgba(15, 23, 42, 0.08)',
    elevation: 3,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  cardActions: { flexDirection: 'row', gap: 10 },
  iconBtn: { padding: 2 },
  detailLine: { marginBottom: 4, fontSize: 14, lineHeight: 20 },
  detailKey: { fontWeight: '800', color: '#0F172A' },
  detailVal: { fontWeight: '400', color: '#334155' },
  useBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
  },
  useBtnText: { color: '#075985', fontWeight: '700', fontSize: 12 },
  createInline: {
    marginTop: 12,
    backgroundColor: '#E8EDF2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 14,
    alignItems: 'center',
  },
  createInlineText: {
    fontWeight: '800',
    color: '#0F172A',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  empty: { color: '#64748B', textAlign: 'center', marginVertical: 12 },
  panel: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  panelTitle: { fontWeight: '800', fontSize: 15, color: '#0F172A' },
  panelBody: { color: '#475569', fontSize: 14, lineHeight: 20 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: 'transparent',
  },
  newOrderBtn: {
    backgroundColor: '#1E5A7A',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    boxShadow: '0px 4px 8px rgba(15, 23, 42, 0.2)',
    elevation: 4,
  },
  newOrderText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: { fontWeight: '800', fontSize: 16, color: '#0F172A' },
  modalContent: { padding: 16, gap: 8, paddingBottom: 40 },
  label: { fontSize: 12, fontWeight: '700', color: '#64748B', marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#fff',
    color: '#0F172A',
    fontSize: 14,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipOn: { backgroundColor: '#1E5A7A', borderColor: '#1E5A7A' },
  chipText: { fontSize: 12, color: '#334155', fontWeight: '600' },
  chipTextOn: { color: '#fff' },
});
