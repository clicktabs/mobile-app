import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { EmptyState, ErrorBanner, LoadingBlock } from './ui';
import { DayBar, Figure, LateBadge, NoticeBox, sharedStyles as s } from './RecordShared';
import * as tarApi from '../api/tar';
import { ApiError } from '../api/client';
import { showAlert } from '../utils/confirm';

/**
 * The TAR — treatments, not medications.
 *
 * Its own screen rather than a tab inside the MAR, because what a nurse needs in front of
 * them is different. A wound dressing has supplies to bring, a stage, and a result worth
 * recording: how the patient tolerated it. A medication row has none of that, and folding
 * the two together would mean one screen doing neither job properly.
 *
 * Supplies are shown on the row rather than behind a tap, because reading them at the door
 * is the difference between arriving prepared and driving back.
 */
export function PatientTarView({ patientId, token }: { patientId: number; token: string }) {
  const [day, setDay] = useState<tarApi.TarDay | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<tarApi.TarTreatment | null>(null);

  const load = useCallback(
    async (forDate: string) => {
      setError(null);
      try {
        setDay(await tarApi.getDay(token, patientId, forDate));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not load the treatment record.');
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
            <Figure label="Done" value={day.summary.completed} good />
            <Figure label="Not done" value={day.summary.not_done} />
          </View>
        ) : null}

        {day && day.treatments.length === 0 && day.unscheduled.length === 0
          && day.unordered_wounds.length === 0 ? (
          <EmptyState message="No treatments are ordered for this day." />
        ) : null}

        {day && day.treatments.length > 0 ? (
          <>
            <Text style={s.lead}>Treatments</Text>
            {day.treatments.map((treatment) => (
              <TreatmentRow key={treatment.id} treatment={treatment} onPress={() => setOpen(treatment)} />
            ))}
          </>
        ) : null}

        {day && day.unscheduled.length > 0 ? (
          <NoticeBox
            title="Written down but not on the schedule"
            body="These are not being tracked. Each one says what is missing — a signature, or the days the order runs on."
            items={day.unscheduled.map((u) =>
              u.frequency
                ? `${u.treatment} (${u.frequency}) — ${u.reason}`
                : `${u.treatment} — ${u.reason}`,
            )}
          />
        ) : null}

        {day && day.unordered_wounds.length > 0 ? (
          <NoticeBox
            title="Wounds with no treatment order"
            body="These are on the chart but nothing has been ordered for them, so no treatment is scheduled."
            items={day.unordered_wounds.map((w) => w.wound)}
          />
        ) : null}
      </ScrollView>

      <TreatmentSheet
        treatment={open}
        token={token}
        patientId={patientId}
        onClose={() => setOpen(null)}
        onDone={() => {
          setOpen(null);
          load(date);
        }}
      />
    </>
  );
}

function TreatmentRow({
  treatment, onPress,
}: { treatment: tarApi.TarTreatment; onPress: () => void }) {
  const tone = treatmentTone(treatment);

  return (
    <Pressable style={[s.row, { borderLeftColor: tone.accent }]} onPress={onPress}>
      <View style={s.rowTime}>
        <Text style={s.rowTimeText}>{treatment.time}</Text>
        <LateBadge show={treatment.is_late} />
      </View>

      <View style={s.rowBody}>
        <Text style={s.rowTitle}>{treatment.treatment}</Text>
        {treatment.description ? <Text style={s.rowMeta}>{treatment.description}</Text> : null}

        {/* What was done, when it is not simply the order read back. */}
        {treatment.performed && treatment.performed !== treatment.description ? (
          <Text style={s.rowMeta}>
            <Text style={s.strong}>Done: </Text>{treatment.performed}
          </Text>
        ) : null}

        {/* What to bring, read at the door rather than found out on arrival. */}
        {treatment.supplies ? (
          <Text style={s.rowMeta}>
            <Text style={s.strong}>Bring: </Text>{treatment.supplies}
          </Text>
        ) : null}

        {treatment.reason ? <Text style={s.rowReason}>{treatment.reason}</Text> : null}
        {treatment.order_changed ? <OrderChangedNote notice={treatment.order_changed} /> : null}
        {treatment.patient_response ? (
          <Text style={s.rowMeta}>Tolerated: {treatment.patient_response}</Text>
        ) : null}
        {treatment.administered_by ? (
          <Text style={s.rowBy}>
            {treatment.status === 'completed' ? `Done ${treatment.administered_at}` : label(treatment.status)}
            {' · '}{treatment.administered_by}
          </Text>
        ) : null}
      </View>

      <View style={[s.pill, { backgroundColor: tone.bg }]}>
        <Text style={[s.pillText, { color: tone.fg }]}>{label(treatment.status)}</Text>
      </View>
    </Pressable>
  );
}

/**
 * The order behind a recorded treatment has moved since somebody signed for it.
 *
 * On the row rather than behind a tap. A TAR row is an attestation and is never rewritten
 * once it has been acted on, so the order can change underneath it — and the row then reads
 * as though it still matches. That assumption is the one worth interrupting, and it has to
 * be interrupted where it is made.
 */
function OrderChangedNote({
  notice,
}: { notice: NonNullable<tarApi.TarTreatment['order_changed']> }) {
  if (notice.state === 'order_missing') {
    return (
      <View style={s.drift}>
        <Text style={s.driftTitle}>The wound order behind this treatment no longer exists.</Text>
      </View>
    );
  }

  return (
    <View style={s.drift}>
      <Text style={s.driftTitle}>The order changed after this was recorded.</Text>
      {notice.changes.map((change) => (
        <Text key={change.field} style={s.driftLine}>
          {change.field} — recorded “{change.recorded ?? '—'}”, now “{change.ordered ?? '—'}”
        </Text>
      ))}
    </View>
  );
}

function label(status: tarApi.TarStatus) {
  switch (status) {
    case 'completed': return 'Done';
    case 'refused': return 'Refused';
    case 'missed': return 'Missed';
    default: return 'Due';
  }
}

function treatmentTone(treatment: tarApi.TarTreatment) {
  switch (treatment.status) {
    case 'completed': return { bg: '#ECFDF5', fg: '#047857', accent: '#059669' };
    case 'refused': return { bg: '#FEF2F2', fg: '#B91C1C', accent: '#DC2626' };
    case 'missed': return { bg: '#F5F3FF', fg: '#6D28D9', accent: '#7C3AED' };
    default:
      return treatment.is_late
        ? { bg: '#FFFBEB', fg: '#B45309', accent: '#D97706' }
        : { bg: '#F1F5F9', fg: '#475569', accent: '#CBD5E1' };
  }
}

function TreatmentSheet({
  treatment, token, patientId, onClose, onDone,
}: {
  treatment: tarApi.TarTreatment | null;
  token: string;
  patientId: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [response, setResponse] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setResponse('');
    setReason('');
  }, [treatment]);

  if (!treatment) return null;

  const submit = async (status: 'completed' | 'refused' | 'missed') => {
    if (status !== 'completed' && !reason.trim()) {
      showAlert('Say why', 'A treatment that was not done needs a reason.');
      return;
    }

    setBusy(true);
    try {
      const res = await tarApi.recordTreatment(token, patientId, treatment.id, {
        status,
        reason: reason.trim() || undefined,
        patient_response: status === 'completed' ? response.trim() || undefined : undefined,
      });
      showAlert('Saved', res.message);
      onDone();
    } catch (e) {
      showAlert('Not saved', e instanceof ApiError ? e.message : 'That could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.sheet}>
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>{treatment.treatment}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color="#0F172A" />
            </Pressable>
          </View>

          <Text style={s.sheetMeta}>Due {treatment.time}</Text>
          {treatment.description ? <Text style={s.sheetMeta}>{treatment.description}</Text> : null}
          {treatment.supplies ? <Text style={s.sheetMeta}>Supplies: {treatment.supplies}</Text> : null}
          {treatment.wound_stage ? <Text style={s.sheetMeta}>Stage: {treatment.wound_stage}</Text> : null}
          {treatment.order_changed ? <OrderChangedNote notice={treatment.order_changed} /> : null}

          {/* The thing a treatment has that a dose does not. */}
          <Text style={s.label}>How did the patient tolerate it?</Text>
          <TextInput
            style={[s.input, s.multiline]}
            value={response}
            onChangeText={setResponse}
            multiline
            placeholder="e.g. tolerated well, wound bed clean, no drainage"
            placeholderTextColor="#94A3B8"
          />

          <Text style={s.label}>Reason (needed unless done)</Text>
          <TextInput
            style={[s.input, s.multiline]}
            value={reason}
            onChangeText={setReason}
            multiline
            placeholder="e.g. patient declined, supplies not available"
            placeholderTextColor="#94A3B8"
          />

          <Pressable style={[s.primary, busy && s.off]} disabled={busy} onPress={() => submit('completed')}>
            <Text style={s.primaryText}>{busy ? 'Saving…' : 'Done'}</Text>
          </Pressable>

          <View style={s.rowButtons}>
            {(['refused', 'missed'] as const).map((status) => (
              <Pressable key={status} style={[s.quiet, busy && s.off]} disabled={busy}
                onPress={() => submit(status)}>
                <Text style={s.quietText}>{label(status)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
