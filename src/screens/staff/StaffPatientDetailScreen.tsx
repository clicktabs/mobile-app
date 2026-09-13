import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button, ErrorBanner, Field, LoadingBlock } from '../../components/ui';
import { AppShell } from '../../components/chrome';
import { PatientProfileCard, PatientProfileHeader } from '../../components/PatientProfileCard';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';
import { colors } from '../../theme/colors';
import { showAlert } from '../../utils/confirm';
import type { StaffPatientsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<StaffPatientsStackParamList, 'PatientDetail'>;
type Section = 'hub' | 'vitals' | 'notes' | 'meds' | 'allergies';

function numOrUndef(v: string) {
  const t = v.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

const MENU_ITEMS: { key: Section; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'vitals', label: 'Vitals', icon: 'pulse-outline' },
  { key: 'notes', label: 'Visit notes', icon: 'document-text-outline' },
  { key: 'meds', label: 'Medications', icon: 'medkit-outline' },
  { key: 'allergies', label: 'Allergies', icon: 'alert-circle-outline' },
];

export function StaffPatientDetailScreen({ route, navigation }: Props) {
  const { patientId } = route.params;
  const { token, handleUnauthorized } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patient, setPatient] = useState<Record<string, any> | null>(null);
  const [section, setSection] = useState<Section>('hub');
  const [menuOpen, setMenuOpen] = useState(false);
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

  const openSection = async (key: Section) => {
    if (!token) return;
    setMenuOpen(false);
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

  const sectionTitle =
    section === 'vitals'
      ? 'Vitals'
      : section === 'notes'
        ? 'Visit notes'
        : section === 'meds'
          ? 'Medications'
          : section === 'allergies'
            ? 'Allergies'
            : 'Patient Profile';

  return (
    <AppShell>
      <PatientProfileHeader
        title={sectionTitle}
        showBack
        onBack={() => (section === 'hub' ? navigation.goBack() : setSection('hub'))}
        onMenu={section === 'hub' ? () => setMenuOpen(true) : undefined}
      />
      {loading && !patient ? (
        <LoadingBlock />
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={section === 'hub' ? styles.hubPad : styles.sectionPad}
            keyboardShouldPersistTaps="handled"
            style={styles.scroll}
          >
            {error ? <ErrorBanner message={error} onRetry={loadPatient} /> : null}

            {section === 'hub' && patient ? <PatientProfileCard patient={patient} /> : null}

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
                  <Text style={styles.empty}>No vitals recorded yet.</Text>
                ) : (
                  list.map((v) => (
                    <View key={String(v.id)} style={styles.itemCard}>
                      <Text style={styles.itemTitle}>{String(v.recorded_at || '')}</Text>
                      <Text style={styles.itemMeta}>
                        T {String(v.temperature ?? '—')} · BP {String(v.blood_pressure_systolic ?? '—')}/
                        {String(v.blood_pressure_diastolic ?? '—')} · HR {String(v.heart_rate ?? '—')}
                      </Text>
                    </View>
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
                  <View key={String(n.id)} style={styles.itemCard}>
                    <Text style={styles.itemTitle}>{String(n.visit_type)}</Text>
                    <Text style={styles.itemMeta}>{String(n.note || n.content || '')}</Text>
                  </View>
                ))}
              </>
            )}
            {section === 'meds' &&
              list.map((m) => (
                <View key={String(m.id)} style={styles.itemCard}>
                  <Text style={styles.itemTitle}>{String(m.name)}</Text>
                  <Text style={styles.itemMeta}>
                    {String(m.dosage || '')} · {String(m.frequency || '')} · {String(m.route || '')}
                  </Text>
                  <Button label="Record administration" onPress={() => administer(Number(m.id))} loading={saving} />
                </View>
              ))}
            {section === 'allergies' &&
              (list.length === 0 ? (
                <Text style={styles.empty}>No active allergies</Text>
              ) : (
                list.map((a) => (
                  <View key={String(a.id)} style={styles.itemCard}>
                    <Text style={styles.itemTitle}>{String(a.allergen)}</Text>
                    <Text style={styles.itemMeta}>
                      {String(a.severity || '')} · {String(a.reaction || '')}
                    </Text>
                  </View>
                ))
              ))}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuSheet}>
            {MENU_ITEMS.map((item) => (
              <Pressable key={item.key} style={styles.menuRow} onPress={() => openSection(item.key)}>
                <Ionicons name={item.icon} size={20} color={colors.ink} />
                <Text style={styles.menuLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#FAFAFA' },
  hubPad: { paddingBottom: 28 },
  sectionPad: { padding: 16, paddingBottom: 32 },
  empty: { color: colors.textMuted, marginTop: 12 },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginTop: 10,
  },
  itemTitle: { fontWeight: '700', color: colors.text },
  itemMeta: { color: colors.textMuted, marginTop: 4 },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 28,
    paddingTop: 8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  menuLabel: { fontSize: 16, fontWeight: '600', color: colors.ink },
});
