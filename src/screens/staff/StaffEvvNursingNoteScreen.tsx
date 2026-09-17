import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { ErrorBanner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as evvApi from '../../api/evv';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';
import { queueDocument } from '../../api/docQueue';
import { isOffline } from '../../utils/connectivity';
import { showAlert } from '../../utils/confirm';
import { colors } from '../../theme/colors';
import type { StaffMenuStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<StaffMenuStackParamList, 'MenuEvvNursingNote'>;

type SectionKey = 'subjective' | 'vitals' | 'interventions' | 'wound';

const SECTIONS: { id: SectionKey; label: string }[] = [
  { id: 'subjective', label: 'Subjective / Client Status' },
  { id: 'vitals', label: 'Vital Signs Assessment' },
  { id: 'interventions', label: 'Interventions & Admin' },
  { id: 'wound', label: 'Wound Care Exception Form' },
];

export function StaffEvvNursingNoteScreen({ navigation, route }: Props) {
  const { scheduleId, patientId, patientName } = route.params;
  const { token, handleUnauthorized } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** The visit could not be confirmed with the server; this device is the only record. */
  const [offlineVisit, setOfflineVisit] = useState(false);
  const [saving, setSaving] = useState(false);

  const [subjective, setSubjective] = useState('');
  const [bp, setBp] = useState('');
  const [hr, setHr] = useState('');
  const [spo2, setSpo2] = useState('');
  const [temp, setTemp] = useState('');
  const [respiration, setRespiration] = useState('');
  const [interventions, setInterventions] = useState('');
  const [woundDeviation, setWoundDeviation] = useState('');
  const [woundCareOrdered, setWoundCareOrdered] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const res = await evvApi.getEvvVisit(token, scheduleId);
      if (!res.visit?.evv?.check_in_time) {
        // The server may simply not have the clock-in yet.
        const local = await evvApi.localVisitState(scheduleId);
        if (!local.checkedIn) {
          setError('Clock in before documenting this visit.');
        }
      }
      const tasks = (res.visit as any)?.care_tasks;
      if (Array.isArray(tasks)) {
        setWoundCareOrdered(tasks.some((t: string) => /wound/i.test(t)));
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }

      // Offline is not a reason to withhold the form. The caregiver is standing in the
      // patient's house; the visit happened whether or not the server can confirm it.
      // Gating documentation on a server round trip is what produced "no active check-in
      // for this visit" on a clock-in that was queued on this very device.
      if (e instanceof ApiError && e.status === 0) {
        const local = await evvApi.localVisitState(scheduleId);
        setOfflineVisit(true);
        setError(local.checkedIn ? null : 'Clock in before documenting this visit.');
        return;
      }

      setError(e instanceof ApiError ? e.message : 'Failed to load visit');
    } finally {
      setLoading(false);
    }
  }, [token, scheduleId, handleUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  const sectionStatus = useMemo(() => {
    const vitalsDone = !!(bp.trim() && hr.trim() && spo2.trim() && temp.trim() && respiration.trim());
    const woundNeedsException = woundCareOrdered && !woundDeviation.trim();
    return {
      subjective: subjective.trim().length >= 10,
      vitals: vitalsDone,
      interventions: interventions.trim().length >= 5,
      wound: woundCareOrdered ? !!woundDeviation.trim() : true,
      woundNeedsException,
    };
  }, [subjective, bp, hr, spo2, temp, respiration, interventions, woundDeviation, woundCareOrdered]);

  const canProceed =
    sectionStatus.subjective &&
    sectionStatus.vitals &&
    sectionStatus.interventions &&
    sectionStatus.wound &&
    !!patientId &&
    !saving;

  /**
   * What gets sent, built once.
   *
   * Hoisted out of the save so the offline path can queue exactly what the online path
   * would have sent, including when the connection drops mid-request.
   */
  const buildPayload = useCallback((pid: number) => {
    const noteText = [
      'Subjective & Objective:',
      subjective.trim(),
      '',
      `Vitals — BP: ${bp}, HR: ${hr} bpm, SpO2: ${spo2}%, Temp: ${temp}°F, Resp: ${respiration} bpm`,
      '',
      'Interventions & Medications:',
      interventions.trim(),
      woundDeviation.trim() ? `\nWound Care Deviation: ${woundDeviation.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      patient_id: pid,
      schedule_id: scheduleId,
      status: 'completed' as const,
      note_text: noteText,
      form_data: {
        evv_mobile: true,
        subjective_objective: subjective.trim(),
        vitals: { bp, hr, spo2, temp, respiration },
        interventions_medications: interventions.trim(),
        wound_deviation_note: woundDeviation.trim() || null,
        wound_care_ordered: woundCareOrdered,
      },
    };
  }, [
    scheduleId,
    subjective,
    bp,
    hr,
    spo2,
    temp,
    respiration,
    interventions,
    woundDeviation,
    woundCareOrdered,
  ]);

  const onSignAndProceed = async () => {
    if (!token || !patientId || !canProceed) return;
    setSaving(true);
    try {
      const payload = buildPayload(patientId);

      // Known to be offline: queue without spending ten seconds proving it.
      if (isOffline()) {
        await queueDocument('nursing_note', scheduleId, payload);
        showAlert('Saved on this device', 'The note will upload when you are back online.', 'info');
        navigation.replace('MenuEvvClockOut', { scheduleId });
        return;
      }

      await staffApi.saveNursingNote(token, payload);

      showAlert('Shift note signed', 'Proceeding to clock-out.', 'success');
      navigation.replace('MenuEvvClockOut', { scheduleId });
    } catch (e) {
      // The connection dropped mid-save. The note is written; losing it because the
      // network chose that moment would be the worst outcome of the three.
      if (e instanceof ApiError && e.status === 0) {
        try {
          await queueDocument('nursing_note', scheduleId, buildPayload(patientId));
          showAlert(
            'Saved on this device',
            'The connection dropped. The note will upload when you are back online.',
            'info',
          );
          navigation.replace('MenuEvvClockOut', { scheduleId });
          return;
        } catch {
          // Falls through to the error below: if it cannot even be written locally,
          // the caregiver must be told rather than left thinking it was saved.
        }
      }

      showAlert(
        'Save failed',
        e instanceof ApiError ? e.message : 'Could not save nursing note',
        'error',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <AppHeader
        title="Nursing Shift Note"
        showLogo={false}
        actions={[
          { icon: 'close', onPress: () => navigation.goBack() },
        ]}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPink} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          {error ? <ErrorBanner message={error} onRetry={load} /> : null}

          <Text style={styles.patientLine}>
            {patientName || 'Patient'} · Point-of-care documentation during visit
          </Text>

          <Text style={styles.sectionTitle}>Nursing Note Sections</Text>
          <View style={styles.progressCard}>
            {SECTIONS.map((s) => {
              const done = sectionStatus[s.id];
              const warn = s.id === 'wound' && sectionStatus.woundNeedsException;
              return (
                <View key={s.id} style={styles.progressRow}>
                  <Ionicons
                    name={warn ? 'alert-circle' : done ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={warn ? colors.danger : done ? colors.success : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.progressLabel,
                      done && styles.progressDone,
                      warn && styles.progressWarn,
                    ]}
                  >
                    {s.label}
                  </Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.fieldTitle}>Subjective & Objective Assessment</Text>
          <TextInput
            style={styles.textArea}
            value={subjective}
            onChangeText={setSubjective}
            multiline
            placeholder="Patient alert, oriented x3. Reports mild fatigue. Skin warm and dry…"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.fieldTitle}>Vitals Assessment</Text>
          <View style={styles.vitalsGrid}>
            <VitalField label="BP" value={bp} onChange={setBp} placeholder="120/80" />
            <VitalField label="HR" value={hr} onChange={setHr} placeholder="72 bpm" />
            <VitalField label="SpO2" value={spo2} onChange={setSpo2} placeholder="98%" />
            <VitalField label="Temp" value={temp} onChange={setTemp} placeholder="98.6°F" />
            <VitalField
              label="Respiration"
              value={respiration}
              onChange={setRespiration}
              placeholder="16 bpm"
              wide
            />
          </View>

          <Text style={styles.fieldTitle}>Interventions & Medications</Text>
          <TextInput
            style={styles.textArea}
            value={interventions}
            onChangeText={setInterventions}
            multiline
            placeholder="Medication reminders provided. Assisted with ambulation…"
            placeholderTextColor={colors.textMuted}
          />

          {(woundCareOrdered || woundDeviation.trim()) ? (
            <>
              <Text style={styles.fieldTitle}>Wound Care Deviation Note</Text>
              {sectionStatus.woundNeedsException ? (
                <View style={styles.exceptionBox}>
                  <Text style={styles.exceptionTitle}>Wound Care Exception Form</Text>
                  <Text style={styles.exceptionBody}>
                    Wound care is on the care plan. Document why dressing change or wound detail
                    was not completed this visit.
                  </Text>
                </View>
              ) : null}
              <TextInput
                style={[styles.textArea, styles.exceptionInput]}
                value={woundDeviation}
                onChangeText={setWoundDeviation}
                multiline
                placeholder="Dressing intact. Patient requested dressing change postponement…"
                placeholderTextColor={colors.textMuted}
              />
            </>
          ) : null}

          <Pressable
            style={[styles.signBtn, !canProceed && styles.signBtnDisabled]}
            disabled={!canProceed}
            onPress={onSignAndProceed}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.signBtnText}>SIGN & PROCEED TO CLOCK-OUT</Text>
            )}
          </Pressable>
        </ScrollView>
      )}
    </AppShell>
  );
}

function VitalField({
  label,
  value,
  onChange,
  placeholder,
  wide,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.vitalCell, wide && styles.vitalCellWide]}>
      <Text style={styles.vitalLabel}>{label}</Text>
      <TextInput
        style={styles.vitalInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  patientLine: { fontSize: 13, color: colors.textMuted, marginBottom: 14 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  progressCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 18,
    gap: 8,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressLabel: { fontSize: 13, color: colors.textMuted },
  progressDone: { color: colors.success, fontWeight: '600' },
  progressWarn: { color: colors.danger, fontWeight: '700' },
  fieldTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    marginTop: 4,
  },
  textArea: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
    color: colors.text,
    textAlignVertical: 'top',
    marginBottom: 14,
    fontSize: 14,
    lineHeight: 20,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  vitalCell: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  vitalCellWide: { width: '100%' },
  vitalLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 },
  vitalInput: { fontSize: 15, fontWeight: '600', color: colors.text, padding: 0 },
  exceptionBox: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  exceptionTitle: { color: '#F97316', fontWeight: '800', fontSize: 13, marginBottom: 4 },
  exceptionBody: { color: '#FCD34D', fontSize: 12, lineHeight: 18 },
  exceptionInput: { borderColor: '#F97316' },
  signBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  signBtnDisabled: { opacity: 0.45 },
  signBtnText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },
});
