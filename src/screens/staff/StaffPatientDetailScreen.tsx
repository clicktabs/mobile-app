import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  LoadingBlock,
  Screen,
  Subtitle,
  Title,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';
import { colors } from '../../theme/colors';
import { showAlert } from '../../utils/confirm';
import type { StaffPatientsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<StaffPatientsStackParamList, 'PatientDetail'>;

function numOrUndef(v: string) {
  const t = v.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

export function StaffPatientDetailScreen({ route, navigation }: Props) {
  const { patientId } = route.params;
  const { token, handleUnauthorized } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patient, setPatient] = useState<Record<string, any> | null>(null);
  const [section, setSection] = useState<'hub' | 'vitals' | 'notes' | 'meds' | 'allergies'>('hub');
  const [list, setList] = useState<Record<string, any>[]>([]);
  const [saving, setSaving] = useState(false);

  const [temp, setTemp] = useState('');
  const [sys, setSys] = useState('');
  const [dia, setDia] = useState('');
  const [hr, setHr] = useState('');
  const [pain, setPain] = useState('');
  const [vNotes, setVNotes] = useState('');

  const [visitType, setVisitType] = useState('skilled_nursing');
  const [note, setNote] = useState('');

  const loadPatient = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const res = await staffApi.staffPatientDetail(token, patientId);
      setPatient(res.data || null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Failed to load patient');
    } finally {
      setLoading(false);
    }
  }, [token, patientId, handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadPatient();
    }, [loadPatient]),
  );

  const openSection = async (key: typeof section) => {
    if (!token) return;
    setSection(key);
    if (key === 'hub') return;
    try {
      if (key === 'vitals') {
        const res = await staffApi.getPatientVitals(token, patientId);
        setList(res.data || []);
      } else if (key === 'notes') {
        const res = await staffApi.getVisitNotes(token, patientId);
        setList(res.data || []);
      } else if (key === 'meds') {
        const res = await staffApi.getMedicationSchedule(token, patientId);
        setList(res.data || []);
      } else if (key === 'allergies') {
        const res = await staffApi.getPatientAllergies(token, patientId);
        setList(res.data || []);
      }
    } catch (e) {
      showAlert('Error', e instanceof ApiError ? e.message : 'Failed to load');
    }
  };

  const saveVitals = async () => {
    if (!token) return;
    const payload = {
      temperature: numOrUndef(temp),
      blood_pressure_systolic: numOrUndef(sys),
      blood_pressure_diastolic: numOrUndef(dia),
      heart_rate: numOrUndef(hr),
      pain_level: numOrUndef(pain),
      notes: vNotes.trim() || undefined,
    };
    const hasValue = Object.values(payload).some((v) => v !== undefined);
    if (!hasValue) {
      showAlert('Missing values', 'Enter at least one vital sign before recording.');
      return;
    }

    setSaving(true);
    try {
      await staffApi.recordVitals(token, patientId, payload);
      showAlert('Vitals recorded', 'Saved to the patient chart.');
      setTemp('');
      setSys('');
      setDia('');
      setHr('');
      setPain('');
      setVNotes('');
      await openSection('vitals');
    } catch (e) {
      showAlert('Failed', e instanceof ApiError ? e.message : 'Could not record vitals');
    } finally {
      setSaving(false);
    }
  };

  const saveNote = async () => {
    if (!token) return;
    if (!visitType.trim() || !note.trim()) {
      showAlert('Validation', 'Visit type and note are required');
      return;
    }
    setSaving(true);
    try {
      await staffApi.createVisitNote(token, patientId, { visit_type: visitType, note });
      showAlert('Saved', 'Visit note saved as draft');
      setNote('');
      await openSection('notes');
    } catch (e) {
      showAlert('Failed', e instanceof ApiError ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const administer = async (medicationId: number) => {
    if (!token) return;
    setSaving(true);
    try {
      await staffApi.administerMedication(token, patientId, { medication_id: medicationId });
      showAlert('Recorded', 'Medication administration recorded');
    } catch (e) {
      showAlert('Failed', e instanceof ApiError ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingBlock />;

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled">
          <Title>{patient?.name || 'Patient'}</Title>
          <Subtitle>
            MRN {String(patient?.mrn || '—')} · {String(patient?.status || '')}
          </Subtitle>
          {error ? <ErrorBanner message={error} onRetry={loadPatient} /> : null}

          {section === 'hub' ? (
            <>
              <Card>
                <Text style={{ color: colors.textMuted }}>Phone: {String(patient?.phone || '—')}</Text>
                <Text style={{ color: colors.textMuted, marginTop: 4 }}>
                  Allergies: {String(patient?.allergies_count ?? 0)} · Meds: {String(patient?.medications_count ?? 0)}
                </Text>
              </Card>
              <Button label="Vitals" onPress={() => openSection('vitals')} />
              <Button label="Visit notes" onPress={() => openSection('notes')} variant="secondary" />
              <Button label="Medications" onPress={() => openSection('meds')} variant="secondary" />
              <Button label="Allergies" onPress={() => openSection('allergies')} variant="ghost" />
              <Button label="Back to list" onPress={() => navigation.goBack()} variant="ghost" />
            </>
          ) : (
            <>
              <Button label="← Back to patient" onPress={() => setSection('hub')} variant="ghost" />
              {section === 'vitals' && (
                <>
                  <Field label="Temperature" value={temp} onChangeText={setTemp} keyboardType="decimal-pad" placeholder="e.g. 98.6" />
                  <Field label="BP systolic" value={sys} onChangeText={setSys} keyboardType="number-pad" placeholder="e.g. 120" />
                  <Field label="BP diastolic" value={dia} onChangeText={setDia} keyboardType="number-pad" placeholder="e.g. 80" />
                  <Field label="Heart rate" value={hr} onChangeText={setHr} keyboardType="number-pad" placeholder="e.g. 72" />
                  <Field label="Pain (0-10)" value={pain} onChangeText={setPain} keyboardType="number-pad" placeholder="0-10" />
                  <Field label="Notes" value={vNotes} onChangeText={setVNotes} />
                  <Button label="Record vitals" onPress={saveVitals} loading={saving} />
                  {list.length === 0 ? (
                    <Text style={{ color: colors.textMuted, marginTop: 12 }}>No vitals recorded yet.</Text>
                  ) : (
                    list.map((v) => (
                      <Card key={String(v.id)}>
                        <Text style={{ fontWeight: '600' }}>{String(v.recorded_at || '')}</Text>
                        <Text style={{ color: colors.textMuted }}>
                          T {String(v.temperature ?? '—')} · BP {String(v.blood_pressure_systolic ?? '—')}/
                          {String(v.blood_pressure_diastolic ?? '—')} · HR {String(v.heart_rate ?? '—')}
                        </Text>
                      </Card>
                    ))
                  )}
                </>
              )}
              {section === 'notes' && (
                <>
                  <Field label="Visit type" value={visitType} onChangeText={setVisitType} />
                  <Field label="Note" value={note} onChangeText={setNote} multiline style={{ minHeight: 100 }} />
                  <Button label="Save draft note" onPress={saveNote} loading={saving} />
                  {list.map((n) => (
                    <Card key={String(n.id)}>
                      <Text style={{ fontWeight: '700' }}>{String(n.visit_type)}</Text>
                      <Text style={{ color: colors.textMuted }}>{String(n.note || n.content || '')}</Text>
                    </Card>
                  ))}
                </>
              )}
              {section === 'meds' &&
                list.map((m) => (
                  <Card key={String(m.id)}>
                    <Text style={{ fontWeight: '700' }}>{String(m.name)}</Text>
                    <Text style={{ color: colors.textMuted }}>
                      {String(m.dosage || '')} · {String(m.frequency || '')} · {String(m.route || '')}
                    </Text>
                    <Button label="Record administration" onPress={() => administer(Number(m.id))} loading={saving} />
                  </Card>
                ))}
              {section === 'allergies' &&
                (list.length === 0 ? (
                  <Text style={{ color: colors.textMuted }}>No active allergies</Text>
                ) : (
                  list.map((a) => (
                    <Card key={String(a.id)}>
                      <Text style={{ fontWeight: '700' }}>{String(a.allergen)}</Text>
                      <Text style={{ color: colors.textMuted }}>
                        {String(a.severity || '')} · {String(a.reaction || '')}
                      </Text>
                    </Card>
                  ))
                ))}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
