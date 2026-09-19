import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { EmptyState, ErrorBanner, LoadingBlock } from './ui';
import { DayBar, Figure, LateBadge, NoticeBox, sharedStyles as s } from './RecordShared';
import * as marApi from '../api/mar';
import { ApiError } from '../api/client';
import { showAlert } from '../utils/confirm';

/**
 * The MAR, where it is actually filled in.
 *
 * Someone in a kitchen with a pill organiser and a patient waiting. So it is a list in time
 * order rather than the office's grid, the next thing due is at the top, and every action is
 * one tap from the row it belongs to.
 *
 * Two things it refuses to be vague about: a dose not given must say why, and a PRN dose
 * must say what it was for and whether it worked.
 */
export function PatientMarView({ patientId, token }: { patientId: number; token: string }) {
  const [day, setDay] = useState<marApi.MarDay | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);

  const load = useCallback(
    async (forDate: string) => {
      setError(null);
      try {
        setDay(await marApi.getDay(token, patientId, forDate));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not load the medication record.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, patientId],
  );

  useEffect(() => {
    load(date);
  }, [load, date]);

  if (loading) return <LoadingBlock />;

  return (
    <>
      <ScrollView
        contentContainerStyle={s.pad}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(date);
            }}
          />
        }
      >
        {error ? <ErrorBanner message={error} onRetry={() => load(date)} /> : null}

        <DayBar
          date={date}
          onChange={(next) => {
            setLoading(true);
            setDate(next);
          }}
        />

        {day ? (
          <View style={s.figures}>
            <Figure label="Due" value={day.summary.due} />
            <Figure label="Late" value={day.summary.late} warn />
            <Figure label="Given" value={day.summary.given} good />
            <Figure label="Not given" value={day.summary.not_given} />
          </View>
        ) : null}

        {day && day.doses.length === 0 && day.prn.length === 0 && day.unscheduled.length === 0 ? (
          <EmptyState message="No medications are ordered for this day." />
        ) : null}

        {day && day.doses.length > 0 ? (
          <>
            <Text style={s.lead}>Scheduled</Text>
            {day.doses.map((dose) => (
              <DoseRow key={dose.id} dose={dose} onPress={() => setSheet({ kind: 'dose', dose })} />
            ))}
          </>
        ) : null}

        {day && day.prn.length > 0 ? (
          <>
            <Text style={s.lead}>As needed</Text>
            {day.prn.map((order) => (
              <View key={order.order_id} style={s.card}>
                <View style={s.cardHead}>
                  <Text style={s.cardTitle}>{order.medication}</Text>
                  <Text style={s.cardMeta}>{order.dose}</Text>
                </View>
                {order.instructions ? <Text style={s.cardMeta}>{order.instructions}</Text> : null}

                {order.doses_today.map((given) => (
                  <View key={given.id} style={s.subRow}>
                    <Text style={s.subRowText}>
                      <Text style={s.strong}>{given.administered_at}</Text>
                      {given.prn_reason ? ` · for ${given.prn_reason}` : ''}
                    </Text>
                    {given.awaiting_response ? (
                      // Unfinished: a PRN dose with no recorded effect is an incomplete entry.
                      <Pressable
                        style={s.followUp}
                        onPress={() => setSheet({ kind: 'prn-response', dose: given, medication: order.medication })}
                      >
                        <Text style={s.followUpText}>Did it help?</Text>
                      </Pressable>
                    ) : (
                      <Text style={s.subRowQuiet}>{given.prn_response}</Text>
                    )}
                  </View>
                ))}

                <Pressable style={s.primarySmall} onPress={() => setSheet({ kind: 'prn', order })}>
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={s.primarySmallText}>Record a dose</Text>
                </Pressable>
              </View>
            ))}
          </>
        ) : null}

        {day && day.unscheduled.length > 0 ? (
          <NoticeBox
            title="Ordered but not on the schedule"
            body="No doses are being tracked for these — the office needs to set administration times on the order."
            items={day.unscheduled.map((u) => `${u.medication} ${u.dose ?? ''} — “${u.frequency}”`)}
          />
        ) : null}
      </ScrollView>

      <MarSheet
        sheet={sheet}
        token={token}
        patientId={patientId}
        onClose={() => setSheet(null)}
        onDone={() => {
          setSheet(null);
          load(date);
        }}
      />
    </>
  );
}

function DoseRow({ dose, onPress }: { dose: marApi.MarDose; onPress: () => void }) {
  const tone = doseTone(dose);

  return (
    <Pressable style={[s.row, { borderLeftColor: tone.accent }]} onPress={onPress}>
      <View style={s.rowTime}>
        <Text style={s.rowTimeText}>{dose.time}</Text>
        <LateBadge show={dose.is_late} />
      </View>

      <View style={s.rowBody}>
        <Text style={s.rowTitle}>{dose.medication}</Text>
        <Text style={s.rowMeta}>
          {[dose.dose, dose.route].filter(Boolean).join(' · ')}
          {dose.instructions ? ` — ${dose.instructions}` : ''}
        </Text>
        {dose.reason ? <Text style={s.rowReason}>{dose.reason}</Text> : null}
        {dose.administered_by ? (
          <Text style={s.rowBy}>
            {dose.status === 'given' ? `Given ${dose.administered_at}` : label(dose.status)} · {dose.administered_by}
          </Text>
        ) : null}
      </View>

      <View style={[s.pill, { backgroundColor: tone.bg }]}>
        <Text style={[s.pillText, { color: tone.fg }]}>{label(dose.status)}</Text>
      </View>
    </Pressable>
  );
}

function label(status: marApi.MarStatus) {
  switch (status) {
    case 'given': return 'Given';
    case 'refused': return 'Refused';
    case 'held': return 'Held';
    case 'missed': return 'Missed';
    case 'discontinued': return 'Stopped';
    default: return 'Due';
  }
}

function doseTone(dose: marApi.MarDose) {
  switch (dose.status) {
    case 'given': return { bg: '#ECFDF5', fg: '#047857', accent: '#059669' };
    case 'refused': return { bg: '#FEF2F2', fg: '#B91C1C', accent: '#DC2626' };
    case 'held': return { bg: '#FFFBEB', fg: '#B45309', accent: '#D97706' };
    case 'missed': return { bg: '#F5F3FF', fg: '#6D28D9', accent: '#7C3AED' };
    case 'discontinued': return { bg: '#F1F5F9', fg: '#64748B', accent: '#CBD5E1' };
    default:
      // Due and late should catch the eye; due and on time should not.
      return dose.is_late
        ? { bg: '#FFFBEB', fg: '#B45309', accent: '#D97706' }
        : { bg: '#F1F5F9', fg: '#475569', accent: '#CBD5E1' };
  }
}

type Sheet =
  | { kind: 'dose'; dose: marApi.MarDose }
  | { kind: 'prn'; order: marApi.PrnOrder }
  | { kind: 'prn-response'; dose: marApi.MarDose; medication: string };

function MarSheet({
  sheet, token, patientId, onClose, onDone,
}: {
  sheet: Sheet | null;
  token: string;
  patientId: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [text, setText] = useState('');
  const [doseGiven, setDoseGiven] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setText('');
    setDoseGiven(sheet?.kind === 'dose' ? (sheet.dose.dose ?? '') : sheet?.kind === 'prn' ? (sheet.order.dose ?? '') : '');
  }, [sheet]);

  if (!sheet) return null;

  const run = async (fn: () => Promise<{ message: string }>) => {
    setBusy(true);
    try {
      const res = await fn();
      showAlert('Saved', res.message);
      onDone();
    } catch (e) {
      showAlert('Not saved', e instanceof ApiError ? e.message : 'That could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const submitDose = (status: 'given' | 'refused' | 'missed' | 'held') => {
    if (sheet.kind !== 'dose') return;
    if (status !== 'given' && !text.trim()) {
      showAlert('Say why', 'A dose that was not given needs a reason.');
      return;
    }
    run(() =>
      marApi.recordDose(token, patientId, sheet.dose.id, {
        status,
        reason: text.trim() || undefined,
        dose_given: status === 'given' ? doseGiven.trim() || undefined : undefined,
      }),
    );
  };

  const title = sheet.kind === 'dose' ? sheet.dose.medication
    : sheet.kind === 'prn' ? sheet.order.medication : sheet.medication;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.sheet}>
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color="#0F172A" />
            </Pressable>
          </View>

          {sheet.kind === 'dose' ? (
            <>
              <Text style={s.sheetMeta}>
                Due {sheet.dose.time} · {sheet.dose.dose}
                {sheet.dose.route ? ` · ${sheet.dose.route}` : ''}
              </Text>

              <Text style={s.label}>Dose given</Text>
              <TextInput style={s.input} value={doseGiven} onChangeText={setDoseGiven}
                placeholder={sheet.dose.dose ?? ''} placeholderTextColor="#94A3B8" />

              <Text style={s.label}>Reason (needed unless given)</Text>
              <TextInput style={[s.input, s.multiline]} value={text} onChangeText={setText} multiline
                placeholder="e.g. patient nauseated, held pending labs" placeholderTextColor="#94A3B8" />

              <Pressable style={[s.primary, busy && s.off]} disabled={busy} onPress={() => submitDose('given')}>
                <Text style={s.primaryText}>{busy ? 'Saving…' : 'Given'}</Text>
              </Pressable>

              <View style={s.rowButtons}>
                {(['refused', 'held', 'missed'] as const).map((status) => (
                  <Pressable key={status} style={[s.quiet, busy && s.off]} disabled={busy}
                    onPress={() => submitDose(status)}>
                    <Text style={s.quietText}>{label(status)}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {sheet.kind === 'prn' ? (
            <>
              <Text style={s.sheetMeta}>{[sheet.order.dose, sheet.order.route].filter(Boolean).join(' · ')}</Text>
              {sheet.order.instructions ? <Text style={s.sheetMeta}>{sheet.order.instructions}</Text> : null}

              <Text style={s.label}>Dose given</Text>
              <TextInput style={s.input} value={doseGiven} onChangeText={setDoseGiven}
                placeholder={sheet.order.dose ?? ''} placeholderTextColor="#94A3B8" />

              <Text style={s.label}>What was it given for?</Text>
              <TextInput style={[s.input, s.multiline]} value={text} onChangeText={setText} multiline
                placeholder="e.g. pain 7/10 right hip" placeholderTextColor="#94A3B8" />

              <Pressable
                style={[s.primary, busy && s.off]}
                disabled={busy}
                onPress={() => {
                  if (!text.trim()) {
                    showAlert('Say what for', 'An as-needed dose needs to say what it was given for.');
                    return;
                  }
                  run(() =>
                    marApi.recordPrn(token, patientId, {
                      patient_medication_id: sheet.order.order_id,
                      prn_reason: text.trim(),
                      dose_given: doseGiven.trim() || undefined,
                    }),
                  );
                }}
              >
                <Text style={s.primaryText}>{busy ? 'Saving…' : 'Record dose'}</Text>
              </Pressable>
            </>
          ) : null}

          {sheet.kind === 'prn-response' ? (
            <>
              <Text style={s.sheetMeta}>
                Given {sheet.dose.administered_at}
                {sheet.dose.prn_reason ? ` for ${sheet.dose.prn_reason}` : ''}
              </Text>

              <Text style={s.label}>Did it help?</Text>
              <TextInput style={[s.input, s.multiline]} value={text} onChangeText={setText} multiline
                placeholder="e.g. pain down to 3/10 after 45 minutes" placeholderTextColor="#94A3B8" />

              <Pressable
                style={[s.primary, busy && s.off]}
                disabled={busy}
                onPress={() => {
                  if (!text.trim()) {
                    showAlert('Say what happened', 'Note whether the dose helped.');
                    return;
                  }
                  run(() => marApi.recordPrnResponse(token, patientId, sheet.dose.id, text.trim()));
                }}
              >
                <Text style={s.primaryText}>{busy ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({});
