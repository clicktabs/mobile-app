import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ErrorBanner, LoadingBlock } from '../../components/ui';
import { AppShell } from '../../components/chrome';
import { PatientProfileCard, PatientProfileHeader } from '../../components/PatientProfileCard';
import { SlideDownMenu } from '../../components/SlideDownMenu';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';
import { colors } from '../../theme/colors';
import { showAlert } from '../../utils/confirm';
import { PatientMedicationsView } from '../../components/PatientMedicationsView';
import { PatientImmunizationLogView } from '../../components/PatientImmunizationLogView';
import { PatientAllergiesView } from '../../components/PatientAllergiesView';
import { PatientInfectionsView } from '../../components/PatientInfectionsView';
import { PatientVitalsView } from '../../components/PatientVitalsView';
import { PatientCommNotesView } from '../../components/PatientCommNotesView';
import type { StaffPatientsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<StaffPatientsStackParamList, 'PatientDetail'>;
type Section = 'hub' | 'meds' | 'allergies' | 'infections' | 'vitals' | 'comm' | 'immunizations';

const MENU_ITEMS: { key: Section; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'meds', label: 'Medications', icon: 'medkit-outline' },
  { key: 'allergies', label: 'Allergies', icon: 'alert-circle-outline' },
  { key: 'infections', label: 'Infections', icon: 'bug-outline' },
  { key: 'vitals', label: 'Vitals', icon: 'pulse-outline' },
  { key: 'immunizations', label: 'Immunization Log', icon: 'eyedrop-outline' },
  { key: 'comm', label: 'Communication notes', icon: 'chatbubble-ellipses-outline' },
];

function dash(v: unknown) {
  const s = String(v ?? '').trim();
  return s || '—';
}

function pretty(v: unknown) {
  const s = String(v ?? '').replace(/_/g, ' ').trim();
  if (!s) return '—';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Row({ label, value }: { label: string; value: unknown }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{dash(value)}</Text>
    </View>
  );
}

export function StaffPatientDetailScreen({ route, navigation }: Props) {
  const { patientId } = route.params;
  const { token, handleUnauthorized } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patient, setPatient] = useState<Record<string, any> | null>(null);
  const [section, setSection] = useState<Section>('hub');
  const [menuOpen, setMenuOpen] = useState(false);
  const [list, setList] = useState<Record<string, any>[]>([]);

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
    setSectionLoading(true);
    setList([]);
    try {
      let res: { data?: Record<string, any>[] };
      if (key === 'vitals') res = await staffApi.getPatientVitals(token, patientId, 50);
      else if (key === 'meds') res = await staffApi.getMedicationSchedule(token, patientId);
      else if (key === 'allergies') res = await staffApi.getPatientAllergies(token, patientId);
      else if (key === 'infections') res = await staffApi.getPatientInfections(token, patientId);
      else if (key === 'immunizations') res = await staffApi.getPatientImmunizations(token, patientId);
      else res = await staffApi.getCommNotes(token, patientId);
      setList(res.data || []);
    } catch (e) {
      showAlert('Error', e instanceof ApiError ? e.message : 'Failed to load');
    } finally {
      setSectionLoading(false);
    }
  };

  const sectionTitle = MENU_ITEMS.find((i) => i.key === section)?.label || 'Patient Profile';

  return (
    <AppShell>
      <PatientProfileHeader
        title={section === 'hub' ? 'Patient Profile' : sectionTitle}
        showBack
        onBack={() => (section === 'hub' ? navigation.goBack() : setSection('hub'))}
        onMenu={() => setMenuOpen((open) => !open)}
      />
      {section === 'meds' && token ? (
        <PatientMedicationsView
          patientId={patientId}
          token={token}
          patient={patient}
          items={list as any}
          onRefresh={() => openSection('meds')}
          loading={sectionLoading}
        />
      ) : section === 'allergies' && token ? (
        <PatientAllergiesView
          patientId={patientId}
          token={token}
          patient={patient}
          items={list as any}
          onRefresh={() => openSection('allergies')}
          loading={sectionLoading}
        />
      ) : section === 'infections' && token ? (
        <PatientInfectionsView
          patientId={patientId}
          token={token}
          patient={patient}
          items={list as any}
          onRefresh={() => openSection('infections')}
          loading={sectionLoading}
        />
      ) : section === 'vitals' && token ? (
        <PatientVitalsView
          patientId={patientId}
          token={token}
          patient={patient}
          items={list as any}
          onRefresh={() => openSection('vitals')}
          loading={sectionLoading}
        />
      ) : section === 'immunizations' && token ? (
        <PatientImmunizationLogView
          patientId={patientId}
          token={token}
          items={list as any}
          onRefresh={() => openSection('immunizations')}
          loading={sectionLoading}
        />
      ) : section === 'comm' && token ? (
        <PatientCommNotesView
          patientId={patientId}
          token={token}
          patient={patient}
          items={list as any}
          onRefresh={() => openSection('comm')}
          loading={sectionLoading}
        />
      ) : loading && !patient ? (
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

            {section !== 'hub' && sectionLoading ? <LoadingBlock /> : null}

            {section === 'allergies' && !sectionLoading && (
              <ChartList
                empty="No allergies on file for this patient."
                items={list}
                renderItem={(a) => (
                  <>
                    <Text style={styles.itemTitle}>{dash(a.allergen)}</Text>
                    <Text style={styles.statusChip}>{pretty(a.status)} · {pretty(a.severity)}</Text>
                    <Row label="Type" value={pretty(a.type)} />
                    <Row label="Reaction" value={a.reaction} />
                    <Row label="Onset" value={a.onset_date} />
                    <Row label="Notes" value={a.notes} />
                  </>
                )}
              />
            )}

            {section === 'infections' && !sectionLoading && (
              <ChartList
                empty="No infections on file for this patient."
                items={list}
                renderItem={(inf) => (
                  <>
                    <Text style={styles.itemTitle}>{dash(inf.infection_type)}</Text>
                    <Text style={styles.statusChip}>{pretty(inf.status)}</Text>
                    <Row label="Organism" value={inf.organism} />
                    <Row label="Site" value={inf.site} />
                    <Row label="Identified" value={inf.date_identified} />
                    <Row label="Resolved" value={inf.date_resolved} />
                    <Row label="Severity" value={pretty(inf.severity)} />
                    <Row label="Notes" value={inf.notes} />
                  </>
                )}
              />
            )}

            {section === 'vitals' && !sectionLoading && (
              <ChartList
                empty="No vital signs recorded yet."
                items={list}
                renderItem={(v) => (
                  <>
                    <Text style={styles.itemTitle}>{dash(v.date || v.recorded_at)}</Text>
                    <Text style={styles.itemMeta}>{dash(v.time)} · {dash(v.recorded_by)}</Text>
                    <Row
                      label="Blood pressure"
                      value={
                        v.blood_pressure_systolic || v.blood_pressure_diastolic
                          ? `${v.blood_pressure_systolic ?? '—'}/${v.blood_pressure_diastolic ?? '—'}`
                          : null
                      }
                    />
                    <Row label="Heart rate" value={v.heart_rate} />
                    <Row label="Temperature" value={v.temperature ? `${v.temperature}°F` : null} />
                    <Row label="Respiratory rate" value={v.respiratory_rate} />
                    <Row label="O2 saturation" value={v.oxygen_saturation ? `${v.oxygen_saturation}%` : null} />
                    <Row label="Pain scale" value={v.pain_level} />
                    <Row label="Status" value={pretty(v.status)} />
                  </>
                )}
              />
            )}

            {section === 'comm' && !sectionLoading && (
              <ChartList
                empty="No communication notes on file for this patient."
                items={list}
                renderItem={(n) => (
                  <>
                    <Text style={styles.itemTitle}>{dash(n.type)}</Text>
                    <Text style={styles.statusChip}>{pretty(n.status)}</Text>
                    <Text style={styles.noteBody}>{dash(n.note)}</Text>
                    <Row label="Date" value={n.created_at} />
                    <Row label="User" value={n.created_by} />
                  </>
                )}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <SlideDownMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={MENU_ITEMS.map((item) => ({
          key: item.key,
          label: item.label,
          icon: item.icon,
          onPress: () => openSection(item.key),
        }))}
      />
    </AppShell>
  );
}

function ChartList({
  items,
  empty,
  renderItem,
}: {
  items: Record<string, any>[];
  empty: string;
  renderItem: (item: Record<string, any>) => React.ReactNode;
}) {
  if (items.length === 0) {
    return <Text style={styles.empty}>{empty}</Text>;
  }
  return (
    <>
      {items.map((item, idx) => (
        <View key={String(item.id ?? idx)} style={styles.itemCard}>
          {renderItem(item)}
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#FAFAFA' },
  hubPad: { paddingBottom: 28 },
  sectionPad: { padding: 16, paddingBottom: 32 },
  empty: { color: colors.textMuted, marginTop: 16, textAlign: 'center' },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 10,
  },
  itemTitle: { fontWeight: '800', color: colors.text, fontSize: 16 },
  itemMeta: { color: colors.textMuted, marginTop: 4, marginBottom: 6 },
  statusChip: { color: colors.textMuted, marginTop: 4, marginBottom: 8, fontWeight: '600' },
  noteBody: { color: colors.text, marginTop: 8, marginBottom: 8, lineHeight: 20 },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 3 },
  kvLabel: { color: colors.textMuted, fontSize: 13, width: 120 },
  kvValue: { flex: 1, textAlign: 'right', color: colors.text, fontSize: 13, fontWeight: '500' },
});
