import React, { useCallback, useMemo, useState } from 'react';
import {
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
import { useFocusEffect } from '@react-navigation/native';
import {
  AppHeader,
  AppShell,
  LastUpdatedBar,
  SearchBar,
  SegmentTabs,
} from '../../components/chrome';
import { ErrorBanner, LoadingBlock } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';
import { colors } from '../../theme/colors';
import { showAlert } from '../../utils/confirm';

type Folder = 'inbox' | 'sent' | 'deleted';

type Msg = {
  id: number;
  subject?: string;
  body?: string;
  from?: string;
  created_at?: string;
  is_read?: boolean;
};

export function StaffMessagesScreen() {
  const { token, staffUser, handleUnauthorized } = useAuth();
  const [folder, setFolder] = useState<Folder>('inbox');
  const [items, setItems] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [compose, setCompose] = useState(false);
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [selected, setSelected] = useState<Msg | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const apiFolder = folder === 'inbox' ? 'inbox' : 'all';
      const res = await staffApi.getStaffMessages(token, apiFolder);
      let data = (res.data || []) as Msg[];
      if (folder === 'sent') data = [];
      if (folder === 'deleted') data = [];
      setItems(data);
      setUpdatedAt(new Date());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Failed to load messages');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, folder, handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((m) =>
      `${m.from || ''} ${m.subject || ''} ${m.body || ''}`.toLowerCase().includes(q),
    );
  }, [items, search]);

  const resetCompose = () => {
    setToEmail('');
    setSubject('');
    setBody('');
  };

  const send = async () => {
    if (!token) return;
    const email = toEmail.trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      showAlert('Missing recipient', 'Enter a valid email in the To field.');
      return;
    }
    if (!subject.trim()) {
      showAlert('Missing subject', 'Add a subject line.');
      return;
    }
    if (!body.trim()) {
      showAlert('Missing message', 'Write a message before sending.');
      return;
    }
    setSending(true);
    try {
      await staffApi.sendStaffMessage(token, {
        recipient_email: email,
        subject: subject.trim(),
        body: body.trim(),
      });
      showAlert('Message sent', `Delivered to ${email}.`);
      setCompose(false);
      resetCompose();
      setFolder('inbox');
      await load();
    } catch (e) {
      showAlert('Send failed', e instanceof ApiError ? e.message : 'Could not send');
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell>
      <AppHeader
        title="My Messages"
        actions={[
          {
            icon: 'create-outline',
            label: 'Compose',
            onPress: () => setCompose(true),
          },
          {
            icon: 'refresh',
            onPress: () => {
              setRefreshing(true);
              load();
            },
          },
        ]}
      />
      <SegmentTabs
        tabs={[
          { key: 'inbox', label: 'Inbox', tint: colors.brandMagenta },
          { key: 'sent', label: 'Sent', tint: colors.brandMagenta },
          { key: 'deleted', label: 'Deleted', tint: colors.brandMagenta },
        ]}
        value={folder}
        onChange={setFolder}
      />
      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder={`Search ${folder === 'inbox' ? 'Inbox' : folder === 'sent' ? 'Sent' : 'Deleted'} Messages`}
      />
      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      <View style={{ flex: 1 }}>
        {loading ? (
          <LoadingBlock />
        ) : (
          <ScrollView
            contentContainerStyle={filtered.length === 0 ? styles.emptyWrap : styles.list}
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
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="mail-open-outline" size={48} color={colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>
                  {folder === 'sent'
                    ? 'No sent messages'
                    : folder === 'deleted'
                      ? 'No deleted messages'
                      : 'Your inbox is empty'}
                </Text>
                <Text style={styles.emptySub}>
                  Messages you send and receive with Click Tabs users will show up here.
                </Text>
                <Pressable style={styles.composePill} onPress={() => setCompose(true)}>
                  <Ionicons name="pencil" size={18} color="#fff" />
                  <Text style={styles.composePillText}>Compose</Text>
                </Pressable>
              </View>
            ) : (
              filtered.map((m) => (
                <Pressable key={m.id} style={styles.row} onPress={() => setSelected(m)}>
                  {!m.is_read ? <View style={styles.unreadDot} /> : <View style={styles.readPad} />}
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{(m.from || 'C')[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowTop}>
                      <Text style={[styles.from, !m.is_read && styles.unreadText]} numberOfLines={1}>
                        {m.from || 'Click Tabs'}
                      </Text>
                      <Text style={styles.date}>
                        {m.created_at
                          ? new Date(m.created_at.replace(' ', 'T')).toLocaleDateString()
                          : ''}
                      </Text>
                    </View>
                    <Text style={[styles.subject, !m.is_read && styles.unreadText]} numberOfLines={1}>
                      {m.subject || '(no subject)'}
                    </Text>
                    <Text style={styles.preview} numberOfLines={1}>
                      {m.body}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}
      </View>

      {filtered.length > 0 ? (
        <Pressable style={styles.fab} onPress={() => setCompose(true)}>
          <Ionicons name="pencil" size={20} color="#fff" />
          <Text style={styles.fabText}>Compose</Text>
        </Pressable>
      ) : null}

      <LastUpdatedBar at={updatedAt} />

      {/* Gmail-like compose */}
      <Modal visible={compose} animationType="slide" onRequestClose={() => setCompose(false)}>
        <AppShell>
          <View style={styles.composeHeader}>
            <Pressable onPress={() => setCompose(false)} hitSlop={10}>
              <Ionicons name="arrow-back" size={24} color={colors.ink} />
            </Pressable>
            <Text style={styles.composeTitle}>New message</Text>
            <Pressable
              onPress={send}
              disabled={sending}
              style={[styles.sendBtn, sending && { opacity: 0.6 }]}
            >
              <Ionicons name="send" size={18} color="#fff" />
              <Text style={styles.sendBtnText}>{sending ? 'Sending…' : 'Send'}</Text>
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.composeBody}>
            <View style={styles.composeField}>
              <Text style={styles.composeLabel}>To</Text>
              <TextInput
                value={toEmail}
                onChangeText={setToEmail}
                placeholder="name@organization.com"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                style={styles.composeInput}
              />
            </View>
            <View style={styles.composeField}>
              <Text style={styles.composeLabel}>From</Text>
              <Text style={styles.fromValue}>{staffUser?.email || 'you@clicktabs'}</Text>
            </View>
            <View style={styles.composeField}>
              <Text style={styles.composeLabel}>Subject</Text>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                placeholder="Subject"
                placeholderTextColor={colors.textMuted}
                style={styles.composeInput}
              />
            </View>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Compose email"
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              style={styles.composeMessage}
            />
          </ScrollView>
        </AppShell>
      </Modal>

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <AppShell>
          <View style={styles.composeHeader}>
            <Pressable onPress={() => setSelected(null)} hitSlop={10}>
              <Ionicons name="arrow-back" size={24} color={colors.ink} />
            </Pressable>
            <Text style={styles.composeTitle} numberOfLines={1}>
              {selected?.subject || 'Message'}
            </Text>
            <View style={{ width: 72 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.from}>{selected?.from || 'Click Tabs'}</Text>
            <Text style={styles.date}>{selected?.created_at}</Text>
            <Text style={[styles.subject, { marginTop: 12 }]}>{selected?.subject}</Text>
            <Text style={{ marginTop: 12, color: colors.text, lineHeight: 22 }}>{selected?.body}</Text>
          </ScrollView>
        </AppShell>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 88 },
  emptyWrap: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  emptyState: { alignItems: 'center', paddingHorizontal: 24 },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  emptySub: { color: colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  composePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.brandMagenta,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
    boxShadow: '0px 3px 8px rgba(0, 0, 0, 0.15)',
    elevation: 3,
  },
  composePillText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: '#fff',
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFE4EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.brandMagenta, fontWeight: '800' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6' },
  readPad: { width: 8 },
  from: { flex: 1, fontWeight: '600', color: colors.ink, fontSize: 14 },
  unreadText: { fontWeight: '800', color: '#000' },
  date: { color: colors.textMuted, fontSize: 12 },
  subject: { color: colors.text, marginTop: 2, fontSize: 14 },
  preview: { color: colors.textMuted, marginTop: 2, fontSize: 13 },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.brandMagenta,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 28,
    boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.2)',
    elevation: 4,
  },
  fabText: { color: '#fff', fontWeight: '700' },
  composeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: '#fff',
  },
  composeTitle: { flex: 1, marginHorizontal: 12, fontSize: 17, fontWeight: '700', color: colors.ink },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brandMagenta,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  composeBody: { paddingBottom: 40, backgroundColor: '#fff', flexGrow: 1 },
  composeField: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  composeLabel: {
    width: 64,
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  composeInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 12,
    outlineStyle: 'none' as any,
  },
  fromValue: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 12 },
  composeMessage: {
    minHeight: 280,
    paddingHorizontal: 14,
    paddingTop: 14,
    fontSize: 15,
    color: colors.text,
    outlineStyle: 'none' as any,
  },
});
