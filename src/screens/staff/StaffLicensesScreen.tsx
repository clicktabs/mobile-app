import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AppHeader, AppShell, LastUpdatedBar } from '../../components/chrome';
import { EmptyState, ErrorBanner, LoadingBlock } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import type { StaffLicenseItem } from '../../api/staff';
import { ApiError } from '../../api/client';
import { colors } from '../../theme/colors';
import { showAlert } from '../../utils/confirm';

function statusMeta(status?: string) {
  switch (status) {
    case 'verified':
      return { label: 'Verified', color: '#047857', bg: '#D1FAE5', icon: 'checkmark-circle' as const };
    case 'rejected':
      return { label: 'Rejected', color: '#B91C1C', bg: '#FEE2E2', icon: 'close-circle' as const };
    case 'pending':
      return { label: 'Pending review', color: '#B45309', bg: '#FEF3C7', icon: 'hourglass' as const };
    default:
      return { label: 'Not submitted', color: '#6B7280', bg: '#F3F4F6', icon: 'ellipse-outline' as const };
  }
}

export function StaffLicensesScreen() {
  const navigation = useNavigation<any>();
  const { token, handleUnauthorized } = useAuth();
  const [items, setItems] = useState<StaffLicenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [editing, setEditing] = useState<StaffLicenseItem | null>(null);
  const [issueDate, setIssueDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const res = await staffApi.staffLicenses(token);
      setItems(Array.isArray(res.data) ? res.data : []);
      setUpdatedAt(new Date());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Failed to load licenses');
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

  const openEdit = (item: StaffLicenseItem) => {
    setEditing(item);
    setIssueDate(item.issue_date || '');
    setExpirationDate(item.expiration_date || '');
    setNotes(item.notes || '');
  };

  const closeEdit = () => {
    if (saving || uploading) return;
    setEditing(null);
  };

  const saveDates = async () => {
    if (!token || !editing) return;
    setSaving(true);
    try {
      const res = await staffApi.updateStaffLicense(token, editing.code, {
        issue_date: issueDate || null,
        expiration_date: expirationDate || null,
        notes: notes || null,
      });
      const next = res.data;
      setItems((prev) => prev.map((x) => (x.code === next.code ? next : x)));
      setEditing(next);
      showAlert('Submitted', res.message || 'Waiting for admin verification.', 'success');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }
      showAlert('Could not save', e instanceof ApiError ? e.message : 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const attachDocument = async () => {
    if (!token || !editing) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert('Permission needed', 'Allow photo library access to attach a document photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;

    const asset = result.assets[0];
    const mime = asset.mimeType || 'image/jpeg';
    setUploading(true);
    try {
      const res = await staffApi.uploadStaffLicenseDocument(token, editing.code, {
        file_base64: `data:${mime};base64,${asset.base64}`,
        file_name: asset.fileName || `${editing.code}.jpg`,
        mime_type: mime,
        issue_date: issueDate || null,
        expiration_date: expirationDate || null,
        notes: notes || null,
      });
      const next = res.data;
      setItems((prev) => prev.map((x) => (x.code === next.code ? next : x)));
      setEditing(next);
      showAlert('Document attached', res.message || 'Waiting for admin verification.', 'success');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }
      showAlert('Upload failed', e instanceof ApiError ? e.message : 'Could not upload', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <AppShell>
      <AppHeader
        title="Licenses"
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
      <View style={styles.hintBar}>
        <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
        <Text style={styles.hintText}>
          Update dates or attach a document photo. Your agency admin must verify before it shows as Verified.
        </Text>
      </View>
      {error ? <ErrorBanner message={error} /> : null}
      {loading && !refreshing ? (
        <LoadingBlock />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.code}
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
          ListEmptyComponent={<EmptyState message="No license types configured." />}
          renderItem={({ item }) => {
            const meta = statusMeta(item.verification_status);
            return (
              <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => openEdit(item)}>
                <View style={styles.cardTop}>
                  <View style={styles.codeBadge}>
                    <Text style={styles.codeText}>{item.code}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon} size={13} color={meta.color} />
                    <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.metaLine}>
                  {item.issue_date || item.expiration_date
                    ? `${item.issue_date || '—'} → ${item.expiration_date || '—'}`
                    : 'No dates yet'}
                </Text>
                {item.has_document ? (
                  <Text style={styles.docLine}>
                    <Ionicons name="attach" size={12} color={colors.textMuted} /> {item.file_name || 'Document attached'}
                  </Text>
                ) : null}
                {item.verification_status === 'rejected' && item.rejection_reason ? (
                  <Text style={styles.rejectLine}>{item.rejection_reason}</Text>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}

      <Modal visible={!!editing} animationType="slide" transparent onRequestClose={closeEdit}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing?.name}</Text>
              <TouchableOpacity onPress={closeEdit} hitSlop={12}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
              <Text style={styles.label}>Issue date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={issueDate}
                onChangeText={setIssueDate}
                placeholder="2026-01-15"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
              <Text style={styles.label}>Expiration date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={expirationDate}
                onChangeText={setExpirationDate}
                placeholder="2027-01-15"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
              <Text style={styles.label}>Remark</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional note"
                placeholderTextColor={colors.textMuted}
                multiline
              />
              {editing?.verification_status === 'rejected' && editing.rejection_reason ? (
                <Text style={styles.rejectLine}>{editing.rejection_reason}</Text>
              ) : null}
              <TouchableOpacity
                style={[styles.primaryBtn, (saving || uploading) && styles.btnDisabled]}
                disabled={saving || uploading}
                onPress={saveDates}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Save & submit for review</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryBtn, (saving || uploading) && styles.btnDisabled]}
                disabled={saving || uploading}
                onPress={attachDocument}
              >
                {uploading ? (
                  <ActivityIndicator color={colors.brandPink} />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={18} color={colors.brandPink} />
                    <Text style={styles.secondaryBtnText}>
                      {editing?.has_document ? 'Replace document photo' : 'Attach document photo'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={styles.footerHint}>
                After you submit, status becomes Pending until your organization admin verifies it on Staff
                Credentials.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  hintBar: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
  },
  hintText: { flex: 1, fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  list: { padding: 16, paddingBottom: 40, gap: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  codeBadge: {
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  codeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  name: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  metaLine: { fontSize: 12, color: colors.textMuted },
  docLine: { marginTop: 6, fontSize: 12, color: colors.textMuted },
  rejectLine: { marginTop: 8, fontSize: 12, color: '#B91C1C' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '88%',
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text, flex: 1, paddingRight: 12 },
  label: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: '#FAFAFA',
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  primaryBtn: {
    marginTop: 18,
    backgroundColor: colors.brandPink,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.brandPink,
  },
  secondaryBtnText: { color: colors.brandPink, fontWeight: '700', fontSize: 14 },
  btnDisabled: { opacity: 0.55 },
  footerHint: { marginTop: 14, fontSize: 12, color: colors.textMuted, lineHeight: 17 },
});
