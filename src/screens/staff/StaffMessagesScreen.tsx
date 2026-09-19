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
  from_email?: string;
  to?: string;
  created_at?: string;
  is_read?: boolean;
  reply_to_id?: number;
  thread_id?: number;
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
  const [replyToId, setReplyToId] = useState<number | undefined>(undefined);
  const [threadId, setThreadId] = useState<number | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [selected, setSelected] = useState<Msg | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const res = await staffApi.getStaffMessages(token, folder);
      const data = (res.data || []) as Msg[];
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
      `${m.from || ''} ${m.to || ''} ${m.subject || ''} ${m.body || ''}`.toLowerCase().includes(q),
    );
  }, [items, search]);

  const resetCompose = () => {
    setToEmail('');
    setSubject('');
    setBody('');
    setReplyToId(undefined);
    setThreadId(undefined);
  };

  const openMessage = useCallback(
    async (m: Msg) => {
      setSelected(m);
      if (folder === 'inbox' && !m.is_read && token) {
        setItems((prev) => prev.map((item) => (item.id === m.id ? { ...item, is_read: true } : item)));
        setSelected((prev) => (prev && prev.id === m.id ? { ...prev, is_read: true } : prev));
        try {
          await staffApi.markStaffMessageRead(token, m.id);
        } catch {
          // Non-blocking UI update
        }
      }
    },
    [token, folder],
  );

  const toggleReadStatus = useCallback(
    async (m: Msg, fromViewer = false) => {
      if (!token) return;
      const nextRead = !m.is_read;
      setItems((prev) => prev.map((item) => (item.id === m.id ? { ...item, is_read: nextRead } : item)));

      if (fromViewer) {
        // In Gmail, tapping "Mark as unread" closes the viewer so you return to the inbox
        // with the message unread, rather than staying inside the message you just marked unread.
        setSelected(null);
      } else if (selected && selected.id === m.id) {
        setSelected((prev) => (prev ? { ...prev, is_read: nextRead } : null));
      }

      try {
        if (nextRead) {
          await staffApi.markStaffMessageRead(token, m.id);
        } else {
          await staffApi.markStaffMessageUnread(token, m.id);
        }
      } catch (e) {
        // Revert on failure
        setItems((prev) => prev.map((item) => (item.id === m.id ? { ...item, is_read: m.is_read } : item)));
        if (fromViewer) {
          setSelected(m);
        } else if (selected && selected.id === m.id) {
          setSelected((prev) => (prev ? { ...prev, is_read: m.is_read } : null));
        }
        showAlert('Update failed', 'Could not update read status.');
      }
    },
    [token, selected],
  );

  const handleReply = useCallback((m: Msg) => {
    const replyRecipient = m.from_email || (m.from && m.from.includes('@') ? m.from : '');
    const cleanSubject = (m.subject || '').trim();
    const replySubject = cleanSubject.toLowerCase().startsWith('re:')
      ? cleanSubject
      : `Re: ${cleanSubject}`;
    const quotedBody = `\n\n--- On ${m.created_at || 'earlier'}, ${m.from || 'sender'} wrote: ---\n${(
      m.body || ''
    )
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n')}`;

    setToEmail(replyRecipient);
    setSubject(replySubject);
    setBody(quotedBody);
    setReplyToId(m.id);
    setThreadId(m.thread_id || m.id);
    setSelected(null);
    setCompose(true);
  }, []);

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
        reply_to_id: replyToId,
        thread_id: threadId,
      });
      showAlert('Message sent', `Delivered to ${email}.`);
      setCompose(false);
      resetCompose();
      setFolder('sent');
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
            onPress: () => {
              resetCompose();
              setCompose(true);
            },
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
          { key: 'inbox', label: 'Inbox' },
          { key: 'sent', label: 'Sent' },
          { key: 'deleted', label: 'Deleted' },
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
                <Pressable
                  style={styles.composePill}
                  onPress={() => {
                    resetCompose();
                    setCompose(true);
                  }}
                >
                  <Ionicons name="pencil" size={18} color="#fff" />
                  <Text style={styles.composePillText}>Compose</Text>
                </Pressable>
              </View>
            ) : (
              filtered.map((m) => {
                const isUnread = !m.is_read;
                const displayName =
                  folder === 'sent' ? `To: ${m.to || 'Recipient'}` : m.from || 'Click Tabs';
                return (
                  <Pressable
                    key={m.id}
                    style={[styles.row, isUnread && styles.rowUnread]}
                    onPress={() => openMessage(m)}
                  >
                    {folder === 'inbox' ? (
                      <Pressable
                        hitSlop={10}
                        style={styles.unreadToggleBtn}
                        onPress={() => toggleReadStatus(m)}
                        accessibilityLabel={isUnread ? 'Mark as read' : 'Mark as unread'}
                      >
                        <Ionicons
                          name={isUnread ? 'mail-unread' : 'mail-outline'}
                          size={18}
                          color={isUnread ? colors.primary : colors.textMuted}
                        />
                      </Pressable>
                    ) : null}

                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {(displayName.replace(/^To:\s*/, '') || 'C')[0]?.toUpperCase()}
                      </Text>
                    </View>

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.rowTop}>
                        <Text
                          style={[styles.from, isUnread && styles.unreadText]}
                          numberOfLines={1}
                        >
                          {displayName}
                        </Text>
                        <Text style={[styles.date, isUnread && styles.unreadDate]}>
                          {m.created_at
                            ? new Date(m.created_at.replace(' ', 'T')).toLocaleDateString()
                            : ''}
                        </Text>
                      </View>
                      <Text
                        style={[styles.subject, isUnread && styles.unreadText]}
                        numberOfLines={1}
                      >
                        {m.subject || '(no subject)'}
                      </Text>
                      <Text style={styles.preview} numberOfLines={1}>
                        {m.body}
                      </Text>
                    </View>

                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        )}
      </View>

      {filtered.length > 0 ? (
        <Pressable
          style={styles.fab}
          onPress={() => {
            resetCompose();
            setCompose(true);
          }}
        >
          <Ionicons name="pencil" size={20} color="#fff" />
          <Text style={styles.fabText}>Compose</Text>
        </Pressable>
      ) : null}

      <LastUpdatedBar at={updatedAt} />

      {/* Compose Modal */}
      <Modal visible={compose} animationType="slide" onRequestClose={() => setCompose(false)}>
        <AppShell>
          <View style={styles.composeHeader}>
            <Pressable onPress={() => setCompose(false)} hitSlop={10}>
              <Ionicons name="arrow-back" size={24} color={colors.ink} />
            </Pressable>
            <Text style={styles.composeTitle}>
              {replyToId ? 'Reply message' : 'New message'}
            </Text>
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

      {/* Message Detail Viewer Modal */}
      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <AppShell>
          <View style={styles.composeHeader}>
            <Pressable onPress={() => setSelected(null)} hitSlop={10} accessibilityLabel="Back">
              <Ionicons name="arrow-back" size={24} color={colors.ink} />
            </Pressable>
            <Text style={styles.composeTitle} numberOfLines={1}>
              {selected?.subject || 'Message'}
            </Text>
            <View style={styles.viewerHeaderActions}>
              {selected && folder === 'inbox' ? (
                <Pressable
                  hitSlop={8}
                  style={styles.headerActionBtn}
                  onPress={() => toggleReadStatus(selected, true)}
                  accessibilityLabel="Mark as unread"
                >
                  <Ionicons
                    name="mail-unread-outline"
                    size={22}
                    color={colors.ink}
                  />
                </Pressable>
              ) : null}
              {selected && folder !== 'sent' ? (
                <Pressable
                  onPress={() => handleReply(selected)}
                  style={styles.headerActionBtn}
                  accessibilityLabel="Reply"
                >
                  <Ionicons name="arrow-undo-outline" size={18} color={colors.primary} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => setSelected(null)}
                style={styles.headerActionBtn}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={20} color={colors.ink} />
              </Pressable>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.viewerScroll}>
            <Text style={styles.subjectDetail}>{selected?.subject || '(No subject)'}</Text>
            <View style={styles.divider} />
            <View style={styles.messageMetaBox}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(selected?.from || selected?.from_email || 'S')[0]?.toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fromName}>{selected?.from || 'Unknown'}</Text>
                {selected?.from_email ? (
                  <Text style={styles.fromEmailSub}>{selected.from_email}</Text>
                ) : null}
              </View>
            </View>
            <Text style={styles.bodyDetail}>{selected?.body || ''}</Text>
            {folder === 'inbox' && selected ? (
              <View style={styles.replyFooter}>
                <Pressable onPress={() => handleReply(selected)} style={styles.replyPill}>
                  <Ionicons name="arrow-undo-outline" size={16} color={colors.primary} />
                  <Text style={styles.replyPillText}>Reply</Text>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
        </AppShell>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 80 },
  emptyWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyState: { alignItems: 'center', maxWidth: 320 },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#F1F5F9',
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
    backgroundColor: colors.primary,
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
  rowUnread: {
    backgroundColor: '#F8FAFC',
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primary, fontWeight: '800', fontSize: 16 },
  unreadToggleBtn: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  from: { flex: 1, fontWeight: '500', color: colors.ink, fontSize: 14 },
  unreadText: { fontWeight: '800', color: '#0F172A' },
  date: { color: colors.textMuted, fontSize: 12 },
  unreadDate: { color: colors.primary, fontWeight: '700' },
  subject: { color: colors.text, marginTop: 2, fontSize: 14 },
  preview: { color: colors.textMuted, marginTop: 2, fontSize: 13 },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
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
  composeTitle: {
    flex: 1,
    marginHorizontal: 10,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  viewerHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    padding: 6,
    borderRadius: 8,
  },
  replyHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  replyHeaderBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
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
  viewerScroll: {
    padding: 16,
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  messageMetaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  fromName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  fromEmailSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  subjectDetail: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    lineHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  bodyDetail: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 24,
  },
  replyFooter: {
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  replyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
  },
  replyPillText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
});
