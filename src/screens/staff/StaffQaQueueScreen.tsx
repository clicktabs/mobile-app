import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppHeader, AppShell } from '../../components/chrome';
import { EmptyState, ErrorBanner, LoadingBlock } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as qa from '../../api/qa';
import { ApiError } from '../../api/client';
import { confirmAction, showAlert } from '../../utils/confirm';
import type { StaffHomeStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<StaffHomeStackParamList, 'QaQueue'>;

/**
 * One document type's review queue.
 *
 * A row opens the document itself, where it can be read and decided. Taking one is the
 * separate, narrower action: it puts the reviewer's name on an item so two people do not
 * work the same document without knowing, and it does not require reading it first.
 *
 * Not every type can be opened. A nursing note has a readable version stored with it; an
 * OASIS assessment or a CMS-485 does not, and the review screen says so rather than
 * offering a decision on a document it could not show.
 *
 * Ordered oldest first, the way the server sends it, and each row leads with how long it
 * has sat. A note waiting eleven days is a different problem from one filed this morning,
 * and that is the number a reviewer triages on.
 */
export function StaffQaQueueScreen({ navigation, route }: Props) {
  const { token, handleUnauthorized } = useAuth();
  const { type, label } = route.params;

  const [items, setItems] = useState<qa.QaItem[]>([]);
  const [title, setTitle] = useState(label ?? 'Review Queue');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      const res = await qa.getQueueType(token, type);
      setItems(res.items ?? []);
      if (res.label) setTitle(res.label);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Could not load the queue.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, type, handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const assign = async (item: qa.QaItem) => {
    if (!token) return;

    const ok = await confirmAction(
      'Take this for review?',
      `${item.patient_name}'s ${(item.type_label ?? 'document').toLowerCase()} will be marked as yours, so nobody else picks it up. You can open and decide it whenever you are ready.`,
      { confirmLabel: 'Take it' },
    );
    if (!ok) return;

    setBusy(item.id);
    try {
      const res = await qa.assignItem(token, type, item.id);
      showAlert('Assigned to you', res.message ?? 'Open it when you are ready to review.');
      // Gone from this list the moment it is taken — otherwise the obvious next action is
      // to tap it again.
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }
      showAlert(
        'Could not assign',
        e instanceof ApiError ? e.message : 'That document could not be assigned.',
      );
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <AppHeader title={title} showBack onBackPress={() => navigation.goBack()} />
        <LoadingBlock />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AppHeader title={title} showBack onBackPress={() => navigation.goBack()} />

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

        {items.length === 0 && !error ? (
          <EmptyState message="Nothing waiting in this queue." />
        ) : null}

        {items.map((item) => (
          /*
            The whole card opens the document. Reading it is the ordinary thing a reviewer
            does next, so it is the whole-card tap rather than a link they have to find;
            taking it without reading it is the narrower action and sits on its own button.
          */
          <Pressable
            key={item.id}
            style={styles.card}
            onPress={() => navigation.navigate('QaReview', { type, id: item.id })}
          >
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>{item.patient_name}</Text>
              <WaitBadge days={item.waiting_days} />
            </View>

            {item.patient_mrn ? <Text style={styles.mrn}>MRN {item.patient_mrn}</Text> : null}

            <Text style={styles.meta}>
              {[item.detail, item.source].filter(Boolean).join(' · ') || item.type_label}
            </Text>

            <View style={styles.cardActions}>
              <View style={styles.openHint}>
                <Text style={styles.openHintText}>Open to review</Text>
                <Ionicons name="chevron-forward" size={15} color="#B4006E" />
              </View>

              <Pressable
                style={[styles.btn, busy === item.id && styles.btnOff]}
                disabled={busy === item.id}
                onPress={() => assign(item)}
              >
                <Text style={styles.btnText}>
                  {busy === item.id ? 'Taking…' : 'Take'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        ))}

        {items.length > 0 ? (
          <Text style={styles.footnote}>
            Open a document to read it and decide. Taking one without opening it puts your
            name on it so nobody else picks it up.
          </Text>
        ) : null}
      </ScrollView>
    </AppShell>
  );
}

/**
 * How long it has sat.
 *
 * Amber past a week, red past two. Not a compliance threshold — no rule says a note is
 * late at fourteen days — but a queue sorted oldest-first still needs the top of it to
 * look different from the bottom.
 */
function WaitBadge({ days }: { days: number | null }) {
  if (days === null || days === undefined) return null;

  const tone =
    days >= 14
      ? { bg: '#FEF2F2', fg: '#B91C1C' }
      : days >= 7
        ? { bg: '#FFFBEB', fg: '#B45309' }
        : { bg: '#F1F5F9', fg: '#475569' };

  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.badgeText, { color: tone.fg }]}>
        {days === 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 48 },

  card: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0F172A' },
  mrn: { fontSize: 11.5, color: '#94A3B8', marginTop: 2 },
  meta: { fontSize: 12.5, color: '#475569', marginTop: 4 },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
  },
  openHint: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  openHintText: { fontSize: 13, fontWeight: '700', color: '#B4006E' },

  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },

  btn: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignItems: 'center',
  },
  btnOff: { opacity: 0.5 },
  btnText: { color: '#334155', fontWeight: '600', fontSize: 13 },

  footnote: { fontSize: 11.5, color: '#94A3B8', marginTop: 6, lineHeight: 17 },
});
