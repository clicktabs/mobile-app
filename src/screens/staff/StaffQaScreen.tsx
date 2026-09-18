import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppHeader, AppShell, SegmentTabs } from '../../components/chrome';
import { EmptyState, ErrorBanner, LoadingBlock } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as qa from '../../api/qa';
import { ApiError } from '../../api/client';
import type { StaffHomeStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<StaffHomeStackParamList, 'Qa'>;

type Tab = 'mine' | 'queue';

/**
 * Quality Assurance.
 *
 * Two people open this screen and want different things from it:
 *
 *   a clinician  — did my notes pass, and what am I being asked to fix
 *   a reviewer   — what is waiting, and what have I taken
 *
 * So there are two tabs, and the second only exists for somebody the server says holds
 * `qa.approve_documents`. For everyone else the screen is just their own documentation,
 * with no tab bar at all — a queue they cannot open is not worth a tab that says 403.
 *
 * My Documentation opens on the notes that need work rather than the full history. Twenty
 * approved notes are a receipt; one rejected note is somebody's afternoon, and it should
 * not be the twenty-first row down.
 */
export function StaffQaScreen({ navigation }: Props) {
  const { token, handleUnauthorized } = useAuth();

  const [data, setData] = useState<qa.QaDashboard | null>(null);
  const [notes, setNotes] = useState<qa.MyNote[]>([]);
  const [assigned, setAssigned] = useState<qa.QaItem[]>([]);
  const [tab, setTab] = useState<Tab>('mine');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      const dash = await qa.getDashboard(token);
      setData(dash);

      // My own notes always — this tab is the one everybody has.
      const mine = await qa.getMine(token);
      setNotes(mine.notes ?? []);

      if (dash.is_reviewer) {
        const queue = await qa.getQueue(token);
        setAssigned(queue.assigned_to_me ?? []);
        // Re-read the per-type counts from the queue call: it carries the items too, so
        // the summary and the lists behind it come from one response and cannot disagree.
        setData({ ...dash, queue: { ...dash.queue!, types: queue.types, pending_total: queue.pending_total } });
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Could not load Quality Assurance.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const isReviewer = data?.is_reviewer ?? false;

  if (loading) {
    return (
      <AppShell>
        <AppHeader title="Quality Assurance" showBack onBackPress={() => navigation.goBack()} />
        <LoadingBlock />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AppHeader title="Quality Assurance" showBack onBackPress={() => navigation.goBack()} />

      {isReviewer ? (
        <SegmentTabs<Tab>
          tabs={[
            { key: 'mine', label: 'My Documentation' },
            {
              key: 'queue',
              label: `Review Queue${data?.queue?.pending_total ? ` (${data.queue.pending_total})` : ''}`,
            },
          ]}
          value={tab}
          onChange={setTab}
        />
      ) : null}

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

        {tab === 'mine' || !isReviewer ? (
          <MyDocumentation notes={notes} summary={data?.mine} />
        ) : (
          <ReviewQueue
            types={data?.queue?.types ?? []}
            assigned={assigned}
            onOpenType={(key, label) => navigation.navigate('QaQueue', { type: key, label })}
            onOpenItem={(type, id) => navigation.navigate('QaReview', { type, id })}
          />
        )}
      </ScrollView>
    </AppShell>
  );
}

/* ------------------------------------------------------------------ my documentation */

function MyDocumentation({
  notes,
  summary,
}: {
  notes: qa.MyNote[];
  summary?: qa.QaDashboard['mine'];
}) {
  // Order by what needs doing, not by date: returned first, then filed and waiting, then
  // the settled ones as history.
  const returned = notes.filter((n) => n.needs_revision);
  const waiting = notes.filter((n) => n.awaiting);
  const settled = notes.filter((n) => !n.needs_revision && !n.awaiting);

  if (notes.length === 0) {
    return (
      <EmptyState message="No documentation yet. Notes you file appear here with whatever QA says about them." />
    );
  }

  return (
    <>
      <View style={styles.figures}>
        <Figure label="Returned" value={summary?.needs_revision ?? returned.length} warn />
        <Figure label="With QA" value={summary?.awaiting ?? waiting.length} />
        <Figure label="Filed" value={summary?.total ?? notes.length} />
      </View>

      {returned.length > 0 ? (
        <>
          <Text style={styles.lead}>Sent back to you</Text>
          {returned.map((n) => (
            <NoteCard key={n.id} note={n} />
          ))}
        </>
      ) : null}

      {waiting.length > 0 ? (
        <>
          <Text style={styles.lead}>With QA</Text>
          {waiting.map((n) => (
            <NoteCard key={n.id} note={n} />
          ))}
        </>
      ) : null}

      {settled.length > 0 ? (
        <>
          <Text style={styles.lead}>Cleared</Text>
          {settled.map((n) => (
            <NoteCard key={n.id} note={n} />
          ))}
        </>
      ) : null}
    </>
  );
}

function NoteCard({ note }: { note: qa.MyNote }) {
  return (
    <View style={[styles.card, note.needs_revision && styles.cardFlagged]}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{note.patient_name}</Text>
        <StatusPill status={note.qa_status} />
      </View>

      <Text style={styles.cardMeta}>
        {[prettyVisitType(note.visit_type), formatDate(note.visit_date)].filter(Boolean).join(' · ') ||
          'Visit'}
      </Text>

      {/*
        The feedback is the point of this card. A rejected note without the reason on
        screen sends the clinician to a browser to find out what to change.
      */}
      {note.feedback ? (
        <View style={styles.feedback}>
          <Text style={styles.feedbackLabel}>
            {note.reviewer ? `${note.reviewer} wrote` : 'QA wrote'}
          </Text>
          <Text style={styles.feedbackText}>{note.feedback}</Text>
        </View>
      ) : null}

      {note.needs_revision && !note.feedback ? (
        <Text style={styles.cardHint}>
          Returned without a written reason. Open it on the web to see the section feedback.
        </Text>
      ) : null}
    </View>
  );
}

/* ---------------------------------------------------------------------- review queue */

function ReviewQueue({
  types,
  assigned,
  onOpenType,
  onOpenItem,
}: {
  types: qa.QaTypeSummary[];
  assigned: qa.QaItem[];
  onOpenType: (key: string, label: string) => void;
  onOpenItem: (type: string, id: number) => void;
}) {
  const waiting = types.filter((t) => t.pending > 0);
  const broken = types.filter((t) => t.unavailable);

  return (
    <>
      {assigned.length > 0 ? (
        <>
          <Text style={styles.lead}>Assigned to you</Text>
          {assigned.map((item) => (
            <Pressable
              key={`${item.type}-${item.id}`}
              style={styles.card}
              onPress={() => item.type && onOpenItem(item.type, item.id)}
            >
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>{item.patient_name}</Text>
                <Text style={styles.cardType}>{item.type_label}</Text>
              </View>
              <Text style={styles.cardMeta}>
                {[item.detail, item.source].filter(Boolean).join(' · ')}
              </Text>
              <View style={styles.openHint}>
                <Text style={styles.openHintText}>Open to review</Text>
                <Ionicons name="chevron-forward" size={15} color="#B4006E" />
              </View>
            </Pressable>
          ))}
        </>
      ) : null}

      <Text style={styles.lead}>Waiting for review</Text>

      {waiting.length === 0 && broken.length === 0 ? (
        <EmptyState message="Nothing waiting — every document has been reviewed." />
      ) : null}

      {waiting.map((t) => (
        <Pressable key={t.key} style={styles.typeRow} onPress={() => onOpenType(t.key, t.label)}>
          <View style={styles.typeCount}>
            <Text style={styles.typeCountText}>{t.pending}</Text>
          </View>
          <View style={styles.typeBody}>
            <Text style={styles.typeLabel}>{t.label}</Text>
            <Text style={styles.typeMeta}>
              {t.pending === 1 ? '1 document waiting' : `${t.pending} documents waiting`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </Pressable>
      ))}

      {/*
        A type that could not be read says so. Showing it as zero would be a different
        claim — "nothing waiting" — and only one of the two means there is no work.
      */}
      {broken.map((t) => (
        <View key={t.key} style={[styles.typeRow, styles.typeRowBroken]}>
          <Ionicons name="alert-circle-outline" size={20} color="#B45309" />
          <View style={styles.typeBody}>
            <Text style={styles.typeLabel}>{t.label}</Text>
            <Text style={styles.typeMetaWarn}>
              Could not be read. Anything waiting here is not counted — check the web console.
            </Text>
          </View>
        </View>
      ))}
    </>
  );
}

/* ---------------------------------------------------------------------------- pieces */

function Figure({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <View style={styles.figure}>
      <Text style={styles.figureLabel}>{label}</Text>
      <Text style={[styles.figureValue, warn && value > 0 && styles.figureValueWarn]}>{value}</Text>
    </View>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone = pillTone(status);

  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.pillText, { color: tone.fg }]}>{prettyStatus(status)}</Text>
    </View>
  );
}

function pillTone(status: string) {
  switch (status) {
    case 'approved':
      return { bg: '#ECFDF5', fg: '#047857' };
    case 'rejected':
    case 'needs_revision':
      return { bg: '#FEF2F2', fg: '#B91C1C' };
    case 'submitted':
    case 'under_review':
    case 'reviewing':
    case 'correcting':
      return { bg: '#FFFBEB', fg: '#B45309' };
    default:
      return { bg: '#F1F5F9', fg: '#475569' };
  }
}

export function prettyStatus(status: string) {
  // The server's vocabulary is wider than the screen's: draft, submitted, reviewing,
  // correcting, under_review, approved, rejected, needs_revision. Said in the words the
  // clinician would use about their own note.
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'submitted':
      return 'With QA';
    case 'reviewing':
    case 'under_review':
      return 'Being reviewed';
    case 'correcting':
      return 'Being corrected';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Sent back';
    case 'needs_revision':
      return 'Needs changes';
    default:
      return status.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function prettyVisitType(type?: string | null) {
  if (!type) return null;
  return type.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 48 },
  lead: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#94A3B8',
    marginTop: 8,
    marginBottom: 8,
  },

  figures: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  figure: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#fff',
  },
  figureLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#94A3B8',
  },
  figureValue: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  figureValueWarn: { color: '#B45309' },

  card: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  cardFlagged: { borderColor: '#FCA5A5', backgroundColor: '#FFFBFB' },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0F172A' },
  cardType: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  cardMeta: { fontSize: 12.5, color: '#475569', marginTop: 3 },
  cardHint: { fontSize: 11.5, color: '#94A3B8', marginTop: 6 },
  openHint: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 10 },
  openHintText: { fontSize: 13, fontWeight: '700', color: '#B4006E' },

  feedback: {
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#B45309',
    paddingLeft: 10,
    paddingVertical: 2,
  },
  feedbackLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#B45309',
  },
  feedbackText: { fontSize: 13, color: '#334155', marginTop: 3, lineHeight: 19 },

  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },

  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  typeRowBroken: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  typeCount: {
    minWidth: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FDF2F8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  typeCountText: { fontSize: 16, fontWeight: '800', color: '#B4006E' },
  typeBody: { flex: 1 },
  typeLabel: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  typeMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  typeMetaWarn: { fontSize: 12, color: '#B45309', marginTop: 2, lineHeight: 17 },
});
