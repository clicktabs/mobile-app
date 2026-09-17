import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { AppHeader, AppShell } from '../../components/chrome';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';
import { queueDocument } from '../../api/docQueue';
import { isOffline } from '../../utils/connectivity';
import { showAlert } from '../../utils/confirm';
import { VoiceInputButton } from '../../components/VoiceInputButton';
import { AppDatePicker, AppTimePicker } from '../../components/AppDatePicker';
import { colors } from '../../theme/colors';
import type { StaffPatientsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<StaffPatientsStackParamList, 'IncidentReport'>;

/**
 * An incident report, filed from the field.
 *
 * The short form on purpose: a caregiver standing in a patient's house needs to record
 * what happened while it is fresh, not complete an investigation record. It reaches the
 * office as pending review, and the office finishes it on the web.
 *
 * Lists come from the server rather than this file so a type the phone offers and the
 * office does not cannot exist.
 */
export function StaffIncidentReportScreen({ navigation, route }: Props) {
  const { token, handleUnauthorized } = useAuth();
  // Present when filed from a patient's profile; absent if ever opened on its own.
  const patientId = route.params?.patientId;
  const patientName = route.params?.patientName;

  const [options, setOptions] = useState<staffApi.IncidentReportOptions | null>(null);
  const [recent, setRecent] = useState<staffApi.IncidentReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const [incidentDate, setIncidentDate] = useState(today);
  const [incidentTime, setIncidentTime] = useState(
    new Date().toTimeString().slice(0, 5),
  );
  const [location, setLocation] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const [severity, setSeverity] = useState('1');
  const [injuryLevel, setInjuryLevel] = useState('na');
  const [witnessed, setWitnessed] = useState('na');
  const [witnessNames, setWitnessNames] = useState('');
  const [description, setDescription] = useState('');
  const [familyNotified, setFamilyNotified] = useState(false);
  const [physicianNotified, setPhysicianNotified] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;

    try {
      const [opts, list] = await Promise.all([
        staffApi.getIncidentReportOptions(token),
        staffApi.getIncidentReports(token).catch(() => null),
      ]);

      setOptions({
        types: opts.types,
        severities: opts.severities,
        injury_levels: opts.injury_levels,
        yes_no_na: opts.yes_no_na,
      });
      setRecent(list?.data ?? []);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }

      // Offline the form still has to work — an incident does not wait for signal — so
      // it falls back to the list bundled with the app.
      setOptions(FALLBACK_OPTIONS);
    } finally {
      setLoading(false);
    }
  }, [token, handleUnauthorized, patientId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleType = (key: string) => {
    setTypes((prev) => (prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]));
  };

  const canSubmit =
    !!incidentDate &&
    incidentDate <= today &&
    location.trim().length > 0 &&
    types.length > 0 &&
    description.trim().length >= 10 &&
    !saving;

  const buildPayload = (): staffApi.IncidentReportPayload => ({
    incident_date: incidentDate,
    incident_time: incidentTime || undefined,
    location: location.trim(),
    severity,
    description: description.trim(),
    types,
    // The patient the profile was open on. Sent only when there is one, so the server's
    // assignment check is not asked about a patient nobody named.
    ...(patientId ? { patient_id: patientId } : {}),
    injury_level: injuryLevel,
    witnessed,
    witness_names: witnessNames.trim() || undefined,
    family_notified: familyNotified,
    physician_notified: physicianNotified,
  });

  const submit = async () => {
    if (!token || !canSubmit) return;

    setSaving(true);

    const queueIt = async () => {
      // schedule_id 0: an incident report belongs to no visit. The queue keeps each one
      // rather than replacing, because two reports are two things that happened.
      await queueDocument('incident_report', 0, buildPayload() as Record<string, unknown>);
    };

    try {
      if (isOffline()) {
        await queueIt();
        showAlert(
          'Saved on this device',
          'The report will be submitted when you are back online.',
          'info',
        );
        navigation.goBack();
        return;
      }

      const res = await staffApi.saveIncidentReport(token, buildPayload());

      showAlert(
        'Incident reported',
        `Report ${res.data?.report_number ?? ''} sent to the office for review.`.trim(),
        'success',
      );
      navigation.goBack();
    } catch (e) {
      // The connection went mid-submit. An incident report is written once, under
      // pressure; losing it because the network chose that moment is the worst outcome.
      if (e instanceof ApiError && e.status === 0) {
        try {
          await queueIt();
          showAlert(
            'Saved on this device',
            'The connection dropped. The report will be submitted when you are back online.',
            'info',
          );
          navigation.goBack();
          return;
        } catch {
          // Falls through: if it cannot be written locally either, say so.
        }
      }

      showAlert(
        'Could not submit',
        e instanceof ApiError ? e.message : 'The report was not sent.',
        'error',
      );
    } finally {
      setSaving(false);
    }
  };

  const severityTint = useMemo(() => {
    switch (severity) {
      case '4': return '#B91C1C';
      case '3': return '#C2410C';
      case '2': return '#B45309';
      default: return '#047857';
    }
  }, [severity]);

  if (loading) {
    return (
      <AppShell>
        <AppHeader title="Incident Report" actions={[{ icon: 'arrow-back', onPress: () => navigation.goBack() }]} />
        <View style={styles.center}><ActivityIndicator /></View>
      </AppShell>
    );
  }

  const opts = options ?? FALLBACK_OPTIONS;

  return (
    <AppShell>
      <AppHeader
        title="Incident Report"
        actions={[{ icon: 'arrow-back', onPress: () => navigation.goBack() }]}
      />

      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>
          Report what happened while it is fresh. The office reviews and completes the record.
        </Text>

        {/* Said plainly, because the report is filed against this patient and the
            caregiver should not have to infer that from how they got here. */}
        {patientName ? (
          <View style={styles.patientBanner}>
            <Ionicons name="person-outline" size={16} color="#0F172A" />
            <Text style={styles.patientBannerText}>About {patientName}</Text>
          </View>
        ) : null}

        {/* ── When and where ─────────────────────────────────────────────── */}
        <Text style={styles.section}>When and where</Text>
        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Date</Text>
            {/* ISO, because that is what the API stores. The picker's own display
                formatting is separate from the value it hands back. */}
            <AppDatePicker
              value={incidentDate}
              onChange={setIncidentDate}
              format="YYYY-MM-DD"
              maxDate={today}
              placeholder="Select date"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Time</Text>
            <AppTimePicker
              value={incidentTime}
              onChange={setIncidentTime}
              format="24h"
              placeholder="Select time"
            />
          </View>
        </View>

        {/* The picker accepts maxDate but does not enforce it, so a caregiver can page
            forward a month and choose a day that has not happened. An incident report
            dated in the future is not a record of anything. */}
        {incidentDate > today ? (
          <Text style={styles.warn}>An incident cannot be dated in the future.</Text>
        ) : null}

        <Text style={styles.label}>Location</Text>
        <TextInput
          value={location}
          onChangeText={setLocation}
          placeholder="Where it happened — e.g. patient's bathroom"
          style={styles.input}
        />

        {/* ── What happened ──────────────────────────────────────────────── */}
        <Text style={styles.section}>What happened</Text>
        <Text style={styles.hint}>Choose everything that applies.</Text>
        <View style={styles.chips}>
          {Object.entries(opts.types).map(([key, label]) => {
            const on = types.includes(key);
            return (
              <Pressable
                key={key}
                onPress={() => toggleType(key)}
                style={[styles.chip, on && styles.chipOn]}
              >
                {on ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Description</Text>
        <View style={styles.textareaWrap}>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What happened, in your own words"
            multiline
            style={styles.textarea}
          />
          <VoiceInputButton value={description} onChange={setDescription} />
        </View>
        {description.trim().length > 0 && description.trim().length < 10 ? (
          <Text style={styles.warn}>A little more detail — at least 10 characters.</Text>
        ) : null}

        {/* ── Severity ───────────────────────────────────────────────────── */}
        <Text style={styles.section}>Severity</Text>
        <View style={styles.chips}>
          {Object.entries(opts.severities).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setSeverity(key)}
              style={[styles.chip, severity === key && { backgroundColor: severityTint, borderColor: severityTint }]}
            >
              <Text style={[styles.chipText, severity === key && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Injury</Text>
        <View style={styles.chips}>
          {Object.entries(opts.injury_levels).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setInjuryLevel(key)}
              style={[styles.chip, injuryLevel === key && styles.chipOn]}
            >
              <Text style={[styles.chipText, injuryLevel === key && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Witnesses and notification ─────────────────────────────────── */}
        <Text style={styles.section}>Witnessed</Text>
        <View style={styles.chips}>
          {Object.entries(opts.yes_no_na).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setWitnessed(key)}
              style={[styles.chip, witnessed === key && styles.chipOn]}
            >
              <Text style={[styles.chipText, witnessed === key && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {witnessed === 'yes' ? (
          <>
            <Text style={styles.label}>Who witnessed it</Text>
            <TextInput
              value={witnessNames}
              onChangeText={setWitnessNames}
              placeholder="Names"
              style={styles.input}
            />
          </>
        ) : null}

        <Text style={styles.section}>Who was told</Text>
        <Toggle label="Family notified" value={familyNotified} onToggle={() => setFamilyNotified((v) => !v)} />
        <Toggle
          label="Physician notified"
          value={physicianNotified}
          onToggle={() => setPhysicianNotified((v) => !v)}
        />

        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.submit,
            !canSubmit && styles.submitOff,
            pressed && canSubmit && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.submitText}>{saving ? 'Submitting…' : 'Submit report'}</Text>
        </Pressable>

        {/* ── What this caregiver has filed before ───────────────────────── */}
        {recent.length > 0 ? (
          <>
            <Text style={styles.section}>Your recent reports</Text>
            {recent.slice(0, 5).map((r) => (
              <View key={r.id} style={styles.recent}>
                <Text style={styles.recentTitle}>
                  {r.report_number} · {r.incident_date ?? '—'}
                </Text>
                <Text style={styles.recentMeta} numberOfLines={2}>
                  {r.location} — {r.description}
                </Text>
                <Text style={styles.recentStatus}>
                  {r.status === 'pending_review' ? 'With the office for review' : r.status}
                </Text>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </AppShell>
  );
}

function Toggle({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} style={styles.toggle}>
      <Ionicons
        name={value ? 'checkbox' : 'square-outline'}
        size={22}
        color={value ? colors.brandMagenta ?? '#B4006E' : '#94A3B8'}
      />
      <Text style={styles.toggleText}>{label}</Text>
    </Pressable>
  );
}

/**
 * Used when the options cannot be fetched.
 *
 * An incident does not wait for a signal, so the form has to open offline. Kept in step
 * with IncidentReport::TYPES on the server.
 */
const FALLBACK_OPTIONS: staffApi.IncidentReportOptions = {
  types: {
    fall_injury: 'Fall with injury',
    fall_no_injury: 'Fall without injury',
    near_fall: 'Near fall',
    medication_issue: 'Medication issue',
    patient_care_error: 'Patient care error',
    abuse_neglect: 'Suspected abuse or neglect',
    physical_altercation: 'Physical altercation',
    verbal_altercation: 'Verbal altercation',
    dme_malfunction: 'Equipment malfunction',
    missing_property: 'Missing property',
    phi_breach: 'Privacy or PHI breach',
    service_failure: 'Service failure',
    complaint: 'Complaint',
    suicide_attempt: 'Suicide attempt',
    incident_other: 'Other',
  },
  severities: {
    '1': 'Level 1 — no harm',
    '2': 'Level 2 — minor harm',
    '3': 'Level 3 — moderate harm',
    '4': 'Level 4 — severe harm',
  },
  injury_levels: {
    na: 'No injury',
    minor: 'Minor',
    moderate: 'Moderate',
    er_acute: 'Emergency or acute care',
  },
  yes_no_na: { yes: 'Yes', no: 'No', na: 'N/A' },
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pad: { padding: 16, paddingBottom: 48 },
  lead: { fontSize: 13, color: '#475569', marginBottom: 16, lineHeight: 19 },
  patientBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 6,
  },
  patientBannerText: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  section: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#0F172A',
    marginTop: 22,
    marginBottom: 8,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginTop: 10, marginBottom: 4 },
  hint: { fontSize: 12, color: '#64748B', marginBottom: 8 },
  warn: { fontSize: 12, color: '#B45309', marginTop: 4 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  textareaWrap: { position: 'relative' },
  textarea: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingRight: 48,
    fontSize: 15,
    minHeight: 120,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  chipOn: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  chipText: { fontSize: 13, color: '#334155' },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  toggleText: { fontSize: 15, color: '#0F172A' },
  submit: {
    marginTop: 26,
    backgroundColor: '#B4006E',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitOff: { backgroundColor: '#CBD5E1' },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  recent: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  recentTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  recentMeta: { fontSize: 12, color: '#475569', marginTop: 2 },
  recentStatus: { fontSize: 11, color: '#B45309', marginTop: 4, fontWeight: '600' },
});
