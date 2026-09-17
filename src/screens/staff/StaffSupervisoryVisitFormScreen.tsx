import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { AppHeader, AppShell } from '../../components/chrome';
import { LoadingBlock } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';
import { isOffline } from '../../utils/connectivity';
import { showAlert } from '../../utils/confirm';
import { AppDatePicker } from '../../components/AppDatePicker';
import { SignaturePad } from '../../components/SignaturePad';
import type { StaffHomeStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<StaffHomeStackParamList, 'SupervisoryVisitForm'>;

type Evaluation = { rating?: string | null; comment?: string | null };

/**
 * The supervisory visit itself — a nurse's record of observing an aide in the home.
 *
 * §484.80(h): the observation is *of* the aide *by* a nurse. The server refuses a visit
 * whose supervisee is the person filing it, because a self-signed one would advance the
 * next due date by a fortnight on the strength of nothing. This screen is not offered to
 * an aide either, so the refusal is a backstop rather than the first the user hears of it.
 *
 * Fifteen observations, the same ones and in the same order as the paper form the office
 * uses, because a phone record that omitted items would not be the same document.
 */
export function StaffSupervisoryVisitFormScreen({ navigation, route }: Props) {
  const { token, handleUnauthorized } = useAuth();
  const { patientId, patientName, aideId, aideName } = route.params;

  const [options, setOptions] = useState<staffApi.SupervisoryFormOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const [visitDate, setVisitDate] = useState(today);
  const [staffPresent, setStaffPresent] = useState<'yes' | 'no'>('yes');
  const [careType, setCareType] = useState<string[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [carePlanMeetsNeeds, setCarePlanMeetsNeeds] = useState(false);
  const [carePlanRevised, setCarePlanRevised] = useState(false);
  const [comments, setComments] = useState('');

  // The patient's attestation that the observation happened in their home, or a named
  // reason it is absent.
  const [signature, setSignature] = useState<string | null>(null);
  const [signedBy, setSignedBy] = useState('');
  const [unableReason, setUnableReason] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;

    try {
      const res = await staffApi.getSupervisoryFormOptions(token);
      setOptions(res.data ?? null);
      setEvaluations((res.data?.items ?? []).map(() => ({ rating: null, comment: null })));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }
      showAlert('Could not open the form', 'The observation list did not load.', 'error');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [token, handleUnauthorized, navigation]);

  useEffect(() => {
    load();
  }, [load]);

  const setRating = (index: number, rating: string) => {
    setEvaluations((prev) =>
      prev.map((e, i) =>
        i === index ? { ...e, rating: e.rating === rating ? null : rating } : e,
      ),
    );
  };

  const setComment = (index: number, comment: string) => {
    setEvaluations((prev) => prev.map((e, i) => (i === index ? { ...e, comment } : e)));
  };

  const rated = evaluations.filter((e) => !!e.rating).length;
  const futureDated = visitDate > today;

  // Signed, or a reason it is not — never neither. The server applies the same rule.
  const attested = !!signature || !!unableReason;

  /*
    Every item answered, because "not observed" is an answer and a blank is not. A form
    with gaps reaches the office as a record nobody can tell apart from an interrupted
    one, and the whole point is that it evidences the observation.
  */
  const canSubmit =
    rated === evaluations.length && evaluations.length > 0 && !futureDated && attested && !saving;

  const submit = async () => {
    if (!token || !canSubmit) return;

    if (isOffline()) {
      showAlert(
        'You are offline',
        'A supervisory visit is filed against the aide’s compliance record, so it is sent rather than queued. Try again when you have signal.',
        'info',
      );
      return;
    }

    setSaving(true);

    try {
      await staffApi.saveSupervisoryVisit(token, {
        patient_id: patientId,
        supervisee_id: aideId,
        visit_date: visitDate,
        staff_present: staffPresent,
        care_type: careType,
        evaluations: evaluations.map((e) => ({
          rating: e.rating ?? null,
          comment: e.comment?.trim() || null,
        })),
        care_plan_meets_needs: carePlanMeetsNeeds,
        care_plan_revised: carePlanRevised,
        ...(comments.trim() ? { supervisor_comments: comments.trim() } : {}),
        // One or the other reaches the server, never both: a signature plus a reason it
        // is missing would be a record that contradicts itself.
        ...(signature
          ? {
              patient_signature: signature,
              ...(signedBy.trim() ? { patient_signature_name: signedBy.trim() } : {}),
            }
          : { patient_unable_to_sign_reason: unableReason ?? undefined }),
      });

      showAlert(
        'Supervision recorded',
        `${aideName ?? 'The aide'} observed on ${patientName}. The next one is now scheduled.`,
        'success',
      );
      navigation.goBack();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }

      showAlert(
        'Could not record the visit',
        e instanceof ApiError ? e.message : 'The visit was not saved.',
        'error',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading || !options) {
    return (
      <AppShell>
        <AppHeader title="Supervisory Visit" actions={[{ icon: 'arrow-back', onPress: () => navigation.goBack() }]} />
        <LoadingBlock />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AppHeader
        title="Supervisory Visit"
        actions={[{ icon: 'arrow-back', onPress: () => navigation.goBack() }]}
      />

      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        {/* Who is being observed, and on whom. Said plainly because the record is filed
            against this aide's compliance, not the patient's chart alone. */}
        <View style={styles.banner}>
          <Ionicons name="shield-checkmark-outline" size={16} color="#0F172A" />
          <Text style={styles.bannerText}>
            {aideName ?? 'Aide'} · {patientName}
          </Text>
        </View>

        <Text style={styles.section}>The visit</Text>

        <Text style={styles.label}>Date observed</Text>
        <AppDatePicker
          value={visitDate}
          onChange={setVisitDate}
          format="YYYY-MM-DD"
          maxDate={today}
          placeholder="Select date"
        />
        {futureDated ? (
          <Text style={styles.warn}>An observation cannot be dated in the future.</Text>
        ) : null}

        <Text style={styles.label}>Aide present during the visit</Text>
        <View style={styles.chips}>
          {(['yes', 'no'] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => setStaffPresent(v)}
              style={[styles.chip, staffPresent === v && styles.chipOn]}
            >
              <Text style={[styles.chipText, staffPresent === v && styles.chipTextOn]}>
                {v === 'yes' ? 'Yes' : 'No'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Care provided</Text>
        <View style={styles.chips}>
          {options.care_types.map((c) => {
            const on = careType.includes(c.value);
            return (
              <Pressable
                key={c.value}
                onPress={() =>
                  setCareType((prev) =>
                    on ? prev.filter((x) => x !== c.value) : [...prev, c.value],
                  )
                }
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>Observations</Text>
        <Text style={styles.hint}>
          {rated} of {evaluations.length} answered. &ldquo;Not observed&rdquo; is an answer;
          a blank is not.
        </Text>

        {options.items.map((item, index) => {
          const evaluation = evaluations[index] ?? {};
          // A rating that reflects badly on somebody, or one recording that nothing was
          // seen, is worth a sentence — so the box appears exactly where it is owed.
          const wantsComment =
            evaluation.rating === 'does_not_meet' || evaluation.rating === 'not_observed';

          return (
            <View key={item} style={styles.item}>
              <Text style={styles.itemLabel}>
                {index + 1}. {item}
              </Text>

              <View style={styles.ratings}>
                {options.ratings.map((r) => {
                  const on = evaluation.rating === r.value;
                  return (
                    <Pressable
                      key={r.value}
                      onPress={() => setRating(index, r.value)}
                      style={[
                        styles.rating,
                        on && styles.ratingOn,
                        on && r.value === 'does_not_meet' && styles.ratingBad,
                      ]}
                    >
                      <Text style={[styles.ratingText, on && styles.ratingTextOn]}>{r.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {wantsComment ? (
                <TextInput
                  value={evaluation.comment ?? ''}
                  onChangeText={(t) => setComment(index, t)}
                  placeholder={
                    evaluation.rating === 'does_not_meet'
                      ? 'What did you see, and what did you ask for?'
                      : 'Why was this not observed?'
                  }
                  style={styles.itemComment}
                  multiline
                />
              ) : null}
            </View>
          );
        })}

        <Text style={styles.section}>Plan of care</Text>
        <Toggle
          label="Care plan and services meet the patient's needs"
          value={carePlanMeetsNeeds}
          onToggle={() => setCarePlanMeetsNeeds((v) => !v)}
        />
        <Toggle
          label="Care plan revised during this visit"
          value={carePlanRevised}
          onToggle={() => setCarePlanRevised((v) => !v)}
        />

        <Text style={styles.label}>Supervisor comments</Text>
        <TextInput
          value={comments}
          onChangeText={setComments}
          placeholder="Anything the office should know"
          multiline
          style={styles.textarea}
        />

        <Text style={styles.section}>Patient signature</Text>
        <Text style={styles.hint}>
          {patientName} or their representative confirms this visit took place and that they
          were asked about the aide&rsquo;s care.
        </Text>

        {unableReason ? (
          /*
            Chosen the reason instead. Shown as a statement with a way back, rather than
            leaving a disabled pad on screen looking broken.
          */
          <View style={styles.unableBox}>
            <Ionicons name="information-circle-outline" size={16} color="#B45309" />
            <Text style={styles.unableText}>Recorded as: {unableReason}</Text>
            <Pressable onPress={() => setUnableReason(null)} hitSlop={8}>
              <Text style={styles.undoText}>Undo</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.sigWrap}>
              <SignaturePad onChange={setSignature} height={150} />
            </View>

            <Text style={styles.label}>Signed by</Text>
            <TextInput
              value={signedBy}
              onChangeText={setSignedBy}
              placeholder={patientName}
              style={styles.input}
            />
            <Text style={styles.hint}>
              Left blank this records {patientName}. Name the representative if somebody
              signed on their behalf.
            </Text>

            {/*
              The way out that does not involve signing for somebody.

              A patient may be asleep, confused, or without the use of their hands. Making
              the signature mandatory would leave the nurse choosing between an unfiled
              visit and a mark she made herself, and only one of those is a record.
            */}
            <Text style={styles.label}>If they cannot sign</Text>
            <View style={styles.chips}>
              {UNABLE_REASONS.map((reason) => (
                <Pressable
                  key={reason}
                  onPress={() => {
                    setUnableReason(reason);
                    setSignature(null);
                  }}
                  style={styles.chip}
                >
                  <Text style={styles.chipText}>{reason}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Pressable
          style={[styles.submit, !canSubmit && styles.submitOff]}
          disabled={!canSubmit}
          onPress={submit}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>RECORD SUPERVISORY VISIT</Text>
          )}
        </Pressable>

        {rated < evaluations.length ? (
          <Text style={styles.footnote}>
            {evaluations.length - rated} observation
            {evaluations.length - rated === 1 ? '' : 's'} still to answer.
          </Text>
        ) : !attested ? (
          <Text style={styles.footnote}>
            A patient signature, or a reason there is none, is still needed.
          </Text>
        ) : null}
      </ScrollView>
    </AppShell>
  );
}

function Toggle({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle} style={styles.toggle}>
      <Ionicons
        name={value ? 'checkbox' : 'square-outline'}
        size={22}
        color={value ? '#B4006E' : '#94A3B8'}
      />
      <Text style={styles.toggleText}>{label}</Text>
    </Pressable>
  );
}

/**
 * Why a patient did not sign.
 *
 * A fixed list rather than free text: these are the cases that recur, and a chosen reason
 * is one the office can count across visits. "Other" would only reopen the blank box this
 * list exists to replace — a nurse with a genuinely different reason has the supervisor
 * comments field above.
 */
const UNABLE_REASONS = [
  'Patient declined to sign',
  'Patient unable to sign',
  'Patient not present',
  'No representative available',
];

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 48 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  bannerText: { fontSize: 13, fontWeight: '700', color: '#0F172A', flex: 1 },

  section: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#0F172A',
    marginTop: 22,
    marginBottom: 4,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginTop: 12, marginBottom: 4 },
  hint: { fontSize: 12, color: '#64748B', marginBottom: 10 },
  warn: { fontSize: 12, color: '#B45309', marginTop: 4 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  chipOn: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  chipText: { fontSize: 13, color: '#334155' },
  chipTextOn: { color: '#fff', fontWeight: '600' },

  item: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  itemLabel: { fontSize: 13, color: '#0F172A', lineHeight: 19 },
  ratings: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  rating: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  ratingOn: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  ratingBad: { backgroundColor: '#B91C1C', borderColor: '#B91C1C' },
  ratingText: { fontSize: 12, color: '#334155' },
  ratingTextOn: { color: '#fff', fontWeight: '700' },
  itemComment: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    minHeight: 60,
    textAlignVertical: 'top',
    backgroundColor: '#F8FAFC',
  },

  sigWrap: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  unableBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
  },
  unableText: { flex: 1, fontSize: 13, color: '#854D0E', fontWeight: '600' },
  undoText: { fontSize: 12, fontWeight: '800', color: '#B4006E' },

  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  toggleText: { flex: 1, fontSize: 14, color: '#0F172A' },

  textarea: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 90,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
  },

  submit: {
    marginTop: 26,
    backgroundColor: '#B4006E',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitOff: { backgroundColor: '#CBD5E1' },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  footnote: { fontSize: 12, color: '#94A3B8', marginTop: 10, textAlign: 'center' },
});
