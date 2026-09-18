import React, { useCallback, useState } from 'react';
import {
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppHeader, AppShell } from '../../components/chrome';
import { ErrorBanner, LoadingBlock } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as qa from '../../api/qa';
import { ApiError } from '../../api/client';
import { confirmAction, showAlert } from '../../utils/confirm';
import type { StaffHomeStackParamList } from '../../navigation/types';
import { StatusPill, formatDate, prettyVisitType } from './StaffQaScreen';

type Props = NativeStackScreenProps<StaffHomeStackParamList, 'QaReview'>;

/**
 * One document, open for review.
 *
 * The screen exists because the queue used to be a dead end: you could take an item on
 * the phone and the card then told you to go and find a browser.
 *
 * A nursing note can be read here in full. The app rendered it when the nurse filed it —
 * that rendering is stored with the note, and it is the only readable version of a
 * nursing note that exists anywhere, the web's own review partial included. So the note
 * is shown section by section, and the decision is made underneath what was read.
 *
 * An OASIS assessment or a CMS-485 has no such rendering. Those arrive with `reviewable`
 * false, and this screen shows the header, says why, and offers no decision — the server
 * refuses one too. Approving a document nobody was shown is the single thing a QA step
 * exists to prevent, and a button that did it would make this screen worse than the dead
 * end it replaces.
 */
export function StaffQaReviewScreen({ navigation, route }: Props) {
  const { token, handleUnauthorized } = useAuth();
  const { type, id } = route.params;

  const [doc, setDoc] = useState<qa.QaDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<'read' | 'approve' | 'reject'>('read');
  const [feedback, setFeedback] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      setDoc(await qa.getDocument(token, type, id));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Could not open this document.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, type, id, handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const submit = async (decision: 'approve' | 'reject') => {
    if (!token || !doc) return;

    const note = feedback.trim();

    if (decision === 'reject' && !note) {
      showAlert(
        'Say what needs to change',
        'A note sent back without a reason cannot be fixed. Write what the clinician should correct.',
      );
      return;
    }

    if (decision === 'approve') {
      const ok = await confirmAction(
        'Approve this note?',
        `${doc.patient_name}'s note goes to billing as reviewed and cannot be edited afterwards.`,
        { confirmLabel: 'Approve' },
      );
      if (!ok) return;
    }

    setBusy(true);
    try {
      const res = await qa.decide(token, type, id, {
        decision,
        feedback: note || undefined,
        // Only sent when the reviewer typed one. The server treats it the same way the
        // web does — verified if present, not demanded — so an agency that has not set
        // PINs up is not locked out of its own queue.
        signature_pin: pin.trim() || undefined,
      });

      showAlert(decision === 'approve' ? 'Approved' : 'Sent back', res.message);
      navigation.goBack();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401 && !pin.trim()) {
        await handleUnauthorized();
        return;
      }
      // A 401 with a PIN in hand is a wrong PIN, not an expired session — and a 423 is
      // the lockout. Both are the reviewer's to fix here, not a reason to sign them out.
      showAlert(
        'Not saved',
        e instanceof ApiError ? e.message : 'That decision could not be saved.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <AppHeader title="QA Review" showBack onBackPress={() => navigation.goBack()} />
        <LoadingBlock />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AppHeader title="QA Review" showBack onBackPress={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.pad}
        keyboardShouldPersistTaps="handled"
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

        {doc ? (
          <>
            {/* Who and what, before anything else. */}
            <View style={styles.header}>
              <View style={styles.headerTop}>
                <Text style={styles.patient}>{doc.patient_name}</Text>
                {doc.qa_status ? <StatusPill status={doc.qa_status} /> : null}
              </View>

              {doc.patient_mrn ? <Text style={styles.mrn}>MRN {doc.patient_mrn}</Text> : null}

              <View style={styles.facts}>
                <Fact label="Document" value={doc.type_label} />
                <Fact label="Visit" value={prettyVisitType(doc.visit_type) ?? '—'} />
                <Fact label="Visit date" value={formatDate(doc.visit_date) ?? '—'} />
                <Fact label="Written by" value={doc.author ?? '—'} />
                {doc.signed_at ? <Fact label="Signed" value={doc.signed_at} /> : null}
                {doc.revision ? <Fact label="Revision" value={`#${doc.revision}`} /> : null}
              </View>
            </View>

            {/*
              What QA asked for last time.

              Above the note rather than below it: a reviewer looking at a resubmission is
              really asking one question — was the thing I asked for done — and they need
              it in mind while reading, not after.
            */}
            {doc.prior_feedback ? (
              <View style={styles.prior}>
                <Text style={styles.priorLabel}>
                  {doc.prior_reviewer ? `${doc.prior_reviewer} previously asked` : 'Previously asked'}
                </Text>
                <Text style={styles.priorText}>{doc.prior_feedback}</Text>
              </View>
            ) : null}

            {doc.reviewable ? (
              <>
                <Text style={styles.lead}>The note</Text>
                {doc.sections.map((section, i) => (
                  <Section key={`${section.heading ?? 'header'}-${i}`} section={section} />
                ))}
              </>
            ) : (
              <View style={styles.notice}>
                <Ionicons name="alert-circle-outline" size={20} color="#B45309" />
                <Text style={styles.noticeText}>
                  {doc.reason ??
                    'This document cannot be shown in full on a phone, so it cannot be decided here.'}
                </Text>
              </View>
            )}

            {doc.history.length > 0 ? (
              <>
                <Text style={styles.lead}>History</Text>
                {doc.history.map((h, i) => (
                  <View key={i} style={styles.historyRow}>
                    <Text style={styles.historyAction}>{h.detail ?? h.action ?? 'Activity'}</Text>
                    <Text style={styles.historyMeta}>
                      {[h.reviewer, formatDate(h.at)].filter(Boolean).join(' · ')}
                    </Text>
                    {h.feedback ? <Text style={styles.historyFeedback}>{h.feedback}</Text> : null}
                  </View>
                ))}
              </>
            ) : null}

            {doc.reviewable ? (
              <Decision
                mode={mode}
                setMode={setMode}
                feedback={feedback}
                setFeedback={setFeedback}
                pin={pin}
                setPin={setPin}
                busy={busy}
                onSubmit={submit}
              />
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </AppShell>
  );
}

/* --------------------------------------------------------------------------- the note */

function Section({ section }: { section: qa.QaSection }) {
  // The untitled block is the note's own header — title and visit date/time. Shown as
  // plain lines rather than given a made-up heading.
  if (!section.heading) {
    return (
      <View style={styles.noteHeader}>
        {section.lines.map((line, i) => (
          <Text key={i} style={i === 0 ? styles.noteTitle : styles.noteSub}>
            {line}
          </Text>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeading}>{section.heading}</Text>
      {section.lines.length === 0 ? (
        // An empty section is a finding, not a blank to be tidied away — it is often
        // exactly what the note is going to be sent back for.
        <Text style={styles.sectionEmpty}>Nothing recorded</Text>
      ) : (
        section.lines.map((line, i) => (
          <View key={i} style={styles.bulletRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>{line}</Text>
          </View>
        ))
      )}
    </View>
  );
}

/* ----------------------------------------------------------------------- the decision */

function Decision({
  mode,
  setMode,
  feedback,
  setFeedback,
  pin,
  setPin,
  busy,
  onSubmit,
}: {
  mode: 'read' | 'approve' | 'reject';
  setMode: (m: 'read' | 'approve' | 'reject') => void;
  feedback: string;
  setFeedback: (v: string) => void;
  pin: string;
  setPin: (v: string) => void;
  busy: boolean;
  onSubmit: (d: 'approve' | 'reject') => void;
}) {
  if (mode === 'read') {
    return (
      <View style={styles.decision}>
        <Pressable style={styles.btnPrimary} onPress={() => setMode('approve')}>
          <Text style={styles.btnPrimaryText}>Approve</Text>
        </Pressable>
        <Pressable style={styles.btnQuiet} onPress={() => setMode('reject')}>
          <Text style={styles.btnQuietText}>Send back for changes</Text>
        </Pressable>
      </View>
    );
  }

  const rejecting = mode === 'reject';

  return (
    <View style={styles.decision}>
      <Text style={styles.decisionLead}>
        {rejecting ? 'What needs to change?' : 'Anything to add? (optional)'}
      </Text>

      <TextInput
        style={styles.input}
        value={feedback}
        onChangeText={setFeedback}
        multiline
        placeholder={
          rejecting
            ? 'e.g. Vital signs section is empty — add the readings you took.'
            : 'Optional note recorded with the approval.'
        }
        placeholderTextColor="#94A3B8"
      />

      {/*
        The signature PIN, the same one this app asks for when the clinician signs a note.
        A QA decision is an attestation too. Left optional because the server treats it
        that way: an agency that has not set PINs up still has to be able to work.
      */}
      <Text style={styles.decisionLead}>Signature PIN (if your agency uses one)</Text>
      <TextInput
        style={styles.pinInput}
        value={pin}
        onChangeText={setPin}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={10}
        placeholder="••••"
        placeholderTextColor="#94A3B8"
      />

      <View style={styles.decisionActions}>
        <Pressable style={styles.btnQuiet} disabled={busy} onPress={() => setMode('read')}>
          <Text style={styles.btnQuietText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[rejecting ? styles.btnDanger : styles.btnPrimary, busy && styles.btnOff]}
          disabled={busy}
          onPress={() => onSubmit(rejecting ? 'reject' : 'approve')}
        >
          <Text style={styles.btnPrimaryText}>
            {busy ? 'Saving…' : rejecting ? 'Send back' : 'Approve'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 56 },
  lead: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#94A3B8',
    marginTop: 18,
    marginBottom: 8,
  },

  header: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fff',
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  patient: { flex: 1, fontSize: 18, fontWeight: '800', color: '#0F172A' },
  mrn: { fontSize: 11.5, color: '#94A3B8', marginTop: 2 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  fact: { minWidth: 120, flexGrow: 1, flexBasis: '40%' },
  factLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#94A3B8',
  },
  factValue: { fontSize: 13.5, color: '#0F172A', marginTop: 2 },

  prior: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 12,
  },
  priorLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#B45309',
  },
  priorText: { fontSize: 13.5, color: '#334155', marginTop: 4, lineHeight: 20 },

  noteHeader: { marginBottom: 10 },
  noteTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  noteSub: { fontSize: 12, color: '#64748B', marginTop: 2 },

  section: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  sectionHeading: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#B4006E',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  sectionEmpty: { fontSize: 13, color: '#B45309', fontStyle: 'italic' },
  bulletRow: { flexDirection: 'row', gap: 8, marginTop: 3 },
  bullet: { fontSize: 13, color: '#94A3B8', lineHeight: 20 },
  bulletText: { flex: 1, fontSize: 13.5, color: '#334155', lineHeight: 20 },

  notice: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
  },
  noticeText: { flex: 1, fontSize: 13, color: '#78350F', lineHeight: 19 },

  historyRow: {
    borderLeftWidth: 2,
    borderLeftColor: '#E2E8F0',
    paddingLeft: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  historyAction: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  historyMeta: { fontSize: 11.5, color: '#94A3B8', marginTop: 1 },
  historyFeedback: { fontSize: 12.5, color: '#475569', marginTop: 4, lineHeight: 18 },

  decision: { marginTop: 20, gap: 10 },
  decisionLead: { fontSize: 12.5, fontWeight: '700', color: '#334155' },
  decisionActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 90,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
    color: '#0F172A',
  },
  pinInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    letterSpacing: 4,
    backgroundColor: '#fff',
    color: '#0F172A',
    maxWidth: 160,
  },

  btnPrimary: {
    backgroundColor: '#B4006E',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnDanger: {
    backgroundColor: '#B91C1C',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnQuiet: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnQuietText: { color: '#334155', fontWeight: '600', fontSize: 13.5 },
  btnOff: { opacity: 0.6 },
});
