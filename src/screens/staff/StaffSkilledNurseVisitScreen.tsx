import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, AppShell } from '../../components/chrome';
import { Button, Field } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';
import { VISIT_SECTIONS } from '../../data/visitAssessment';
import {
  emptyVitalSigns,
  VitalSignsForm,
  vitalsToFormData,
  type VitalSignsState,
} from '../../components/VitalSignsForm';
import { InterventionsForm } from '../../components/InterventionsForm';
import {
  CareCoordinationForm,
  emptyCareCoordination,
  type CareCoordinationState,
} from '../../components/CareCoordinationForm';
import { PainProfileForm, emptyPainProfile, type PainProfileState } from '../../components/PainProfileForm';
import {
  IntegumentForm,
  emptyIntegument,
  integumentCount,
  integumentToFormData,
  integumentToNoteLines,
  type IntegumentState,
} from '../../components/IntegumentForm';
import { VoiceInputButton } from '../../components/VoiceInputButton';
import type { StaffScheduleStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { showAlert } from '../../utils/confirm';

type Props = NativeStackScreenProps<StaffScheduleStackParamList, 'SkilledNurseVisit'>;

type SectionState = {
  open: boolean;
  selected: Record<string, boolean>;
  childSelected: Record<string, Record<string, boolean>>;
  comment: string;
  fields: Record<string, string>;
  /** Accumulated select values for Labs-style options (web appendCardioSelection) */
  optionNotes: Record<string, string>;
};

function emptySection(): SectionState {
  return {
    open: false,
    selected: {},
    childSelected: {},
    comment: '',
    fields: {},
    optionNotes: {},
  };
}

function OptionSelect({
  placeholder,
  options,
  onSelect,
}: {
  placeholder: string;
  options: string[];
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [styles.selectTrigger, pressed && { opacity: 0.9 }]}
      >
        <Text style={styles.selectTriggerText}>{placeholder}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </Pressable>
      {open
        ? options.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => {
                onSelect(opt);
                setOpen(false);
              }}
              style={({ pressed }) => [styles.selectOption, pressed && styles.selectOptionOn]}
            >
              <Text style={styles.selectOptionText}>{opt}</Text>
            </Pressable>
          ))
        : null}
    </View>
  );
}

export function StaffSkilledNurseVisitScreen({ navigation, route }: Props) {
  const { token } = useAuth();
  const { scheduleId, patientId, patientName, startTime } = route.params;
  const [sections, setSections] = useState<Record<string, SectionState>>(() => {
    const init: Record<string, SectionState> = {};
    VISIT_SECTIONS.forEach((s) => {
      init[s.id] = emptySection();
    });
    init.vitals = { ...emptySection(), open: true };
    return init;
  });
  const [vitals, setVitals] = useState<VitalSignsState>(emptyVitalSigns);
  const [patientGoals, setPatientGoals] = useState('');
  const [painProfile, setPainProfile] = useState<PainProfileState>(emptyPainProfile);
  const [integument, setIntegument] = useState<IntegumentState>(emptyIntegument);
  const [coordination, setCoordination] = useState<CareCoordinationState>(emptyCareCoordination);
  const [responseToCare, setResponseToCare] = useState('');
  const [medicalNecessity, setMedicalNecessity] = useState('');
  const [visitNarrative, setVisitNarrative] = useState('');
  const [saving, setSaving] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [signaturePin, setSignaturePin] = useState('');
  const signedAt = useMemo(() => new Date().toLocaleString(), [signOpen]);

  const subtitle = `For ${patientName || 'Patient'}${
    startTime ? ` on ${new Date(startTime.replace(' ', 'T')).toLocaleDateString()}` : ''
  }`;

  const toggleOpen = (id: string) => {
    setSections((prev) => ({
      ...prev,
      [id]: { ...prev[id], open: !prev[id].open },
    }));
  };

  const toggleOption = (sectionId: string, optionId: string) => {
    setSections((prev) => {
      const cur = prev[sectionId];
      const nextSelected = { ...cur.selected, [optionId]: !cur.selected[optionId] };
      const nextChild = { ...cur.childSelected };
      const nextNotes = { ...cur.optionNotes };
      if (!nextSelected[optionId]) {
        delete nextChild[optionId];
        delete nextNotes[optionId];
      } else if (!nextChild[optionId]) {
        nextChild[optionId] = {};
      }
      return {
        ...prev,
        [sectionId]: {
          ...cur,
          selected: nextSelected,
          childSelected: nextChild,
          optionNotes: nextNotes,
        },
      };
    });
  };

  const toggleChild = (sectionId: string, optionId: string, child: string) => {
    setSections((prev) => {
      const cur = prev[sectionId];
      const map = { ...(cur.childSelected[optionId] || {}) };
      map[child] = !map[child];
      return {
        ...prev,
        [sectionId]: {
          ...cur,
          childSelected: { ...cur.childSelected, [optionId]: map },
        },
      };
    });
  };

  const setComment = (sectionId: string, comment: string) => {
    setSections((prev) => ({
      ...prev,
      [sectionId]: { ...prev[sectionId], comment },
    }));
  };

  const setField = (sectionId: string, fieldId: string, value: string) => {
    setSections((prev) => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        fields: { ...prev[sectionId].fields, [fieldId]: value },
      },
    }));
  };

  const setOptionNotes = (sectionId: string, optionId: string, notes: string) => {
    setSections((prev) => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        optionNotes: { ...prev[sectionId].optionNotes, [optionId]: notes },
      },
    }));
  };

  const appendOptionSelect = (sectionId: string, optionId: string, value: string) => {
    if (!value) return;
    setSections((prev) => {
      const cur = prev[sectionId];
      const existing = (cur.optionNotes[optionId] || '').trim();
      const next = existing ? `${existing}, ${value}` : value;
      return {
        ...prev,
        [sectionId]: {
          ...cur,
          optionNotes: { ...cur.optionNotes, [optionId]: next },
        },
      };
    });
  };

  const buildNoteText = () => {
    const lines: string[] = [`Skilled Nurse Visit — ${patientName || 'Patient'}`];
    if (startTime) lines.push(`Visit date/time: ${startTime}`);

    lines.push('\n[Vital Signs]');
    vitals.tempHrRows.forEach((r, i) => {
      if (r.temperature || r.heart_rate) {
        lines.push(
          `- Set ${i + 1}: Temp ${r.temperature || '—'}°F (${r.temp_route || 'n/a'}), HR ${r.heart_rate || '—'}/min (${r.pulse_type || 'n/a'})`,
        );
      }
    });
    if (vitals.respirations) lines.push(`- Respirations: ${vitals.respirations}/min`);
    if (vitals.weight) lines.push(`- Weight: ${vitals.weight} lbs (${vitals.weight_method || 'n/a'})`);
    vitals.oxBpRows.forEach((r, i) => {
      if (r.pulse_oximetry || r.blood_pressure) {
        lines.push(
          `- Set ${i + 1}: SpO2 ${r.pulse_oximetry || '—'}% (${r.ox_method || 'n/a'}), BP ${r.blood_pressure || '—'} (${r.bp_position || 'n/a'})`,
        );
      }
    });
    if (vitals.unable_to_collect_vitals) lines.push('- Unable to collect all vitals');
    if (vitals.physician_notified) lines.push('- Physician notified of abnormal vitals');
    if (vitals.clinical_manager_notified) lines.push('- Clinical manager notified of abnormal vitals');
    if (vitals.pain_level) lines.push(`- Pain: ${vitals.pain_level}/10`);
    if (vitals.blood_glucose) lines.push(`- Glucose: ${vitals.blood_glucose} (${vitals.glucose_timing || 'n/a'})`);
    if (patientGoals.trim()) {
      lines.push('\n[Interventions]');
      lines.push(patientGoals.trim());
    }
    if (
      painProfile.hadPainThisWeek ||
      painProfile.frequency ||
      painProfile.assessmentComments.trim() ||
      painProfile.profileComments.trim()
    ) {
      lines.push('\n[Pain Profile]');
      if (painProfile.hadPainThisWeek) {
        lines.push(
          `- Had pain this week: ${painProfile.hadPainThisWeek === 'yes' ? 'Yes' : 'No'}`,
        );
      }
      if (painProfile.frequency) {
        lines.push(`- Pain interfering with activity/movement: ${painProfile.frequency}`);
      }
      if (painProfile.assessmentComments.trim()) {
        lines.push(`Pain assessment: ${painProfile.assessmentComments.trim()}`);
      }
      if (painProfile.profileComments.trim()) {
        lines.push(`Comments: ${painProfile.profileComments.trim()}`);
      }
    }
    const integLines = integumentToNoteLines(integument);
    if (integLines.length) {
      lines.push('\n[Integumentary]');
      lines.push(...integLines);
    }
    if (
      coordination.na ||
      coordination.notes.length ||
      coordination.comments.trim() ||
      coordination.with ||
      coordination.regarding.trim()
    ) {
      lines.push('\n[Care Coordination]');
      if (coordination.na) lines.push('- NA');
      coordination.notes.forEach((n) => {
        lines.push(
          `- ${n.withLabel}${n.nameTitle ? ` (${n.nameTitle})` : ''}${
            n.regarding ? `: ${n.regarding}` : ''
          }`,
        );
      });
      if (coordination.with && !coordination.na) {
        const pendingLabel =
          [
            { value: 'primary_physician', label: 'Primary Physician' },
            { value: 'specialist', label: 'Specialist' },
            { value: 'physical_therapist', label: 'Physical Therapist' },
            { value: 'occupational_therapist', label: 'Occupational Therapist' },
            { value: 'speech_therapist', label: 'Speech Therapist' },
            { value: 'social_worker', label: 'Social Worker' },
            { value: 'case_manager', label: 'Case Manager' },
            { value: 'pharmacist', label: 'Pharmacist' },
            { value: 'home_health_aide', label: 'Home Health Aide' },
            { value: 'family_member', label: 'Family Member' },
            { value: 'other', label: 'Other' },
          ].find((p) => p.value === coordination.with)?.label || coordination.with;
        lines.push(
          `- Pending entry: ${pendingLabel}${
            coordination.nameTitle ? ` (${coordination.nameTitle})` : ''
          }${coordination.regarding ? `: ${coordination.regarding}` : ''}`,
        );
      }
      if (coordination.comments.trim()) lines.push(`Comments: ${coordination.comments.trim()}`);
    }
    if (responseToCare.trim() || medicalNecessity.trim() || visitNarrative.trim()) {
      lines.push('\n[Response to Care / Progress Toward Goals / Plan for Next Visit]');
      if (responseToCare.trim()) lines.push(`Response to care: ${responseToCare.trim()}`);
      if (medicalNecessity.trim()) lines.push(`Medical necessity for care: ${medicalNecessity.trim()}`);
      if (visitNarrative.trim()) lines.push(`Visit narrative: ${visitNarrative.trim()}`);
    }

    VISIT_SECTIONS.forEach((sec) => {
      if (
        sec.id === 'vitals' ||
        sec.id === 'response' ||
        sec.id === 'interventions' ||
        sec.id === 'orders_discipline' ||
        sec.id === 'coordination' ||
        sec.id === 'pain' ||
        sec.id === 'integument'
      ) {
        return;
      }
      const st = sections[sec.id];
      const picks = sec.options
        .filter((o) => st.selected[o.id])
        .map((o) => {
          const kids = Object.entries(st.childSelected[o.id] || {})
            .filter(([, v]) => v)
            .map(([k]) => k);
          const notes = (st.optionNotes[o.id] || '').trim();
          if (kids.length && notes) return `${o.label} (${kids.join(', ')}): ${notes}`;
          if (kids.length) return `${o.label} (${kids.join(', ')})`;
          if (notes) return `${o.label}: ${notes}`;
          return o.label;
        });
      const extras = (sec.extraFields || [])
        .map((f) => ({ label: f.label, value: (st.fields[f.id] || '').trim() }))
        .filter((f) => f.value);
      if (!picks.length && !st.comment.trim() && !extras.length) return;
      lines.push(`\n[${sec.title}]`);
      picks.forEach((p) => lines.push(`- ${p}`));
      extras.forEach((f) => lines.push(`${f.label}: ${f.value}`));
      if (st.comment.trim()) {
        lines.push(`${sec.commentLabel || 'Comments'}: ${st.comment.trim()}`);
      }
    });
    return lines.join('\n');
  };

  const buildFormData = () => {
    const form: Record<string, unknown> = {
      ...vitalsToFormData(vitals),
      patient_goals: patientGoals.trim(),
      response_to_care: responseToCare.trim(),
      medical_necessity: medicalNecessity.trim(),
      visit_narrative: visitNarrative.trim(),
      pain_this_week: painProfile.hadPainThisWeek,
      pain_frequency: painProfile.frequency,
      pain_comments: painProfile.assessmentComments.trim(),
      pain_profile_comments: painProfile.profileComments.trim(),
      ...integumentToFormData(integument),
      care_coordination_na: coordination.na ? '1' : '',
      coordinated_care_with: coordination.with,
      coordination_name_title: coordination.nameTitle.trim(),
      coordination_regarding: coordination.regarding.trim(),
      care_coordination_notes: coordination.notes,
      care_coordination_comments: coordination.comments.trim(),
    };

    const homebound = sections.homebound;
    if (homebound) {
      const mobilityIds = ['ambulatory', 'ambulatory_with_device', 'bedfast', 'chairfast'];
      const deviceIds = [
        'cane',
        'crutches',
        'human_assistance',
        'special_transportation',
        'walker',
        'wheelchair',
      ];
      form.mobility = mobilityIds.filter((id) => homebound.selected[id]);
      form.assistive_device = deviceIds.filter((id) => homebound.selected[id]);
      if (homebound.comment.trim()) form.homebound_narrative = homebound.comment.trim();
    }

    const poc = sections.poc;
    if (poc) {
      const patientIds = ['willing_able', 'willing_unable', 'unwilling', 'barriers'];
      const caregiverMap: Record<string, string> = {
        cg_none: 'na',
        cg_willing_able: 'cg_willing_able',
        cg_willing_unable: 'cg_willing_unable',
        cg_unwilling: 'cg_unwilling',
        cg_barriers: 'cg_barriers',
      };
      form.patient_response = patientIds.filter((id) => poc.selected[id]);
      form.caregiver_involvement = Object.entries(caregiverMap)
        .filter(([id]) => poc.selected[id])
        .map(([, v]) => v);
      if ((poc.fields.caregiver_availability || '').trim()) {
        form.caregiver_availability = poc.fields.caregiver_availability.trim();
      }
      if (poc.comment.trim()) form.poc_comment = poc.comment.trim();
    }

    const discharge = sections.discharge;
    if (discharge) {
      form.discharge_planning = [
        'na',
        'discussed',
        'patient_dc_notice',
        'legal_rep_dc_notice',
        'beneficiary_notice',
      ].filter((id) => discharge.selected[id]);
      if (discharge.comment.trim()) form.discharge_planning_notes = discharge.comment.trim();
    }

    VISIT_SECTIONS.forEach((sec) => {
      if (
        sec.id === 'vitals' ||
        sec.id === 'response' ||
        sec.id === 'interventions' ||
        sec.id === 'orders_discipline' ||
        sec.id === 'coordination' ||
        sec.id === 'homebound' ||
        sec.id === 'poc' ||
        sec.id === 'discharge' ||
        sec.id === 'pain' ||
        sec.id === 'integument'
      ) {
        return;
      }
      const st = sections[sec.id];
      sec.options.forEach((o) => {
        if (st.selected[o.id]) form[o.id] = '1';
        const kids = Object.entries(st.childSelected[o.id] || {})
          .filter(([, v]) => v)
          .map(([k]) => k);
        if (kids.length) form[`${o.id}_detail`] = kids;
        const notes = (st.optionNotes[o.id] || '').trim();
        if (notes) form[`${o.id}_notes`] = notes;
      });
      (sec.extraFields || []).forEach((f) => {
        const v = (st.fields[f.id] || '').trim();
        if (v) form[f.id] = v;
      });
      if (st.comment.trim()) {
        form[sec.commentFormKey || `${sec.id}_comments`] = st.comment.trim();
      }
    });
    return form;
  };

  const saveDraft = async () => {
    if (!token || !patientId) {
      showAlert('Missing patient', 'This visit has no patient linked.');
      return;
    }
    setSaving(true);
    try {
      await staffApi.saveNursingNote(token, {
        patient_id: patientId,
        schedule_id: scheduleId,
        status: 'draft',
        form_data: buildFormData(),
        note_text: buildNoteText(),
      });
      showAlert('Draft saved');
    } catch (e) {
      showAlert('Save failed', e instanceof ApiError ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const completeAndSign = async () => {
    if (!signaturePin.trim()) {
      showAlert('Signature required', 'Enter your electronic signature PIN/password.');
      return;
    }
    if (!token) return;
    setSaving(true);
    try {
      if (patientId) {
        await staffApi.saveNursingNote(token, {
          patient_id: patientId,
          schedule_id: scheduleId,
          status: 'completed',
          form_data: {
            ...buildFormData(),
            electronic_signature_at: signedAt,
            electronic_signature_verified: true,
          },
          note_text: buildNoteText(),
        });
      }
      await staffApi.completeVisit(token, scheduleId, {
        completion_notes: 'Completed via Skilled Nurse Visit documentation',
      });
      setSignOpen(false);
      showAlert('Visit completed');
      navigation.goBack();
    } catch (e) {
      showAlert('Complete failed', e instanceof ApiError ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <AppHeader
        title="Skilled Nurse Visit"
        actions={[{ icon: 'arrow-back', onPress: () => navigation.goBack() }]}
      />
      <Text style={styles.subtitle}>{subtitle}</Text>
      <Pressable style={styles.loadPrev}>
        <Text style={styles.loadPrevText}>Load Previous Note</Text>
        <Ionicons name="chevron-down" size={16} color={colors.brandMagenta} />
      </Pressable>

      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {VISIT_SECTIONS.map((sec) => {
          const st = sections[sec.id];
          const count =
            sec.id === 'vitals'
              ? [
                  ...vitals.tempHrRows.flatMap((r) => [r.temperature, r.heart_rate]),
                  vitals.respirations,
                  vitals.weight,
                  ...vitals.oxBpRows.flatMap((r) => [r.pulse_oximetry, r.blood_pressure]),
                ].filter(Boolean).length
              : sec.id === 'interventions'
                ? patientGoals.trim()
                  ? patientGoals
                      .split('\n')
                      .map((l) => l.trim())
                      .filter(Boolean).length
                  : 0
                : sec.id === 'response'
                  ? [responseToCare, medicalNecessity, visitNarrative].filter((v) => v.trim()).length
                  : sec.id === 'coordination'
                    ? (coordination.na ? 1 : 0) +
                      coordination.notes.length +
                      (coordination.comments.trim() ? 1 : 0)
                    : sec.id === 'pain'
                      ? [
                          painProfile.hadPainThisWeek,
                          painProfile.frequency,
                          painProfile.assessmentComments.trim(),
                          painProfile.profileComments.trim(),
                        ].filter(Boolean).length
                      : sec.id === 'integument'
                        ? integumentCount(integument)
                        : Object.values(st.selected).filter(Boolean).length;
          return (
            <View key={sec.id} style={styles.sectionWrap}>
              <Pressable
                onPress={() => toggleOpen(sec.id)}
                style={[styles.sectionHeader, { backgroundColor: sec.color }]}
              >
                <Ionicons
                  name={st.open ? 'chevron-down' : 'chevron-forward'}
                  size={18}
                  color="#fff"
                />
                <Text style={styles.sectionTitle}>{sec.title}</Text>
                {count > 0 ? (
                  <View style={styles.countChip}>
                    <Text style={styles.countChipText}>{count}</Text>
                  </View>
                ) : null}
              </Pressable>

              {st.open ? (
                <View style={styles.sectionBody}>
                  {sec.id === 'vitals' ? (
                    <VitalSignsForm value={vitals} onChange={setVitals} />
                  ) : sec.id === 'orders_discipline' ? (
                    <View style={styles.ordersBlock}>
                      <Text style={styles.ordersDesc}>
                        Review and manage discipline orders and treatment plans associated with this
                        patient's current certification period.
                      </Text>
                      <Pressable
                        onPress={() => {
                          if (!patientId) {
                            showAlert('Missing patient', 'This visit has no patient linked.');
                            return;
                          }
                          navigation.navigate('PlanOfCareProfile', {
                            patientId,
                            patientName,
                          });
                        }}
                        style={({ pressed }) => [styles.ordersBtn, pressed && { opacity: 0.9 }]}
                      >
                        <Ionicons name="document-text-outline" size={16} color="#fff" />
                        <Text style={styles.ordersBtnText}>Orders for Discipline and Treatment</Text>
                      </Pressable>
                      <Text style={styles.ordersHint}>Opens Plan of Care Profile</Text>
                      <Pressable
                        onPress={() => {
                          if (!patientId) {
                            showAlert('Missing patient', 'This visit has no patient linked.');
                            return;
                          }
                          navigation.navigate('PlanOfCareProfile', {
                            patientId,
                            patientName,
                          });
                        }}
                        style={({ pressed }) => [styles.ordersSecondary, pressed && { opacity: 0.9 }]}
                      >
                        <Ionicons name="open-outline" size={14} color="#334155" />
                        <Text style={styles.ordersSecondaryText}>Open Plan of Care</Text>
                      </Pressable>
                    </View>
                  ) : sec.id === 'interventions' ? (
                    <InterventionsForm value={patientGoals} onChange={setPatientGoals} />
                  ) : sec.id === 'pain' ? (
                    <PainProfileForm value={painProfile} onChange={setPainProfile} />
                  ) : sec.id === 'integument' ? (
                    <IntegumentForm
                      value={integument}
                      onChange={setIntegument}
                      patientId={patientId}
                    />
                  ) : sec.id === 'coordination' ? (
                    <CareCoordinationForm
                      value={coordination}
                      onChange={setCoordination}
                      onAddNote={async (note) => {
                        if (!token || !patientId) {
                          showAlert('Missing patient', 'This visit has no patient linked.');
                          throw new Error('missing patient');
                        }
                        const body = [
                          `Coordinated care with: ${note.withLabel}`,
                          note.nameTitle ? `Name/Title: ${note.nameTitle}` : '',
                          note.regarding ? `Regarding: ${note.regarding}` : '',
                        ]
                          .filter(Boolean)
                          .join('\n');
                        try {
                          await staffApi.createCommNote(token, patientId, body, 'care_coordination');
                        } catch (e) {
                          showAlert(
                            'Note save failed',
                            e instanceof ApiError ? e.message : 'Could not save coordination note',
                          );
                          throw e;
                        }
                      }}
                    />
                  ) : sec.id === 'response' ? (
                    <View style={styles.responseBlock}>
                      <View style={styles.commentBlock}>
                        <View style={styles.voiceRow}>
                          <Text style={[styles.commentLabel, styles.voiceLabel]}>
                            Response to Care / Progress Toward Goals / Plan for Next Visit
                          </Text>
                          <VoiceInputButton value={responseToCare} onChange={setResponseToCare} />
                        </View>
                        <TextInput
                          value={responseToCare}
                          onChangeText={setResponseToCare}
                          placeholder="Enter Responses"
                          placeholderTextColor={colors.textMuted}
                          multiline
                          style={styles.commentInput}
                        />
                      </View>
                      <View style={styles.commentBlock}>
                        <View style={styles.voiceRow}>
                          <Text style={[styles.commentLabel, styles.voiceLabel]}>Medical Necessity for Care</Text>
                          <VoiceInputButton value={medicalNecessity} onChange={setMedicalNecessity} />
                        </View>
                        <TextInput
                          value={medicalNecessity}
                          onChangeText={setMedicalNecessity}
                          placeholder="Enter Medical Necessity for Care Notes"
                          placeholderTextColor={colors.textMuted}
                          multiline
                          style={styles.commentInput}
                        />
                      </View>
                      <View style={styles.commentBlock}>
                        <View style={styles.voiceRow}>
                          <Text style={[styles.commentLabel, styles.voiceLabel]}>Visit Narrative</Text>
                          <VoiceInputButton value={visitNarrative} onChange={setVisitNarrative} />
                        </View>
                        <TextInput
                          value={visitNarrative}
                          onChangeText={setVisitNarrative}
                          placeholder="Enter Visit Narrative"
                          placeholderTextColor={colors.textMuted}
                          multiline
                          style={styles.commentInput}
                        />
                      </View>
                    </View>
                  ) : (
                    <>
                      {(() => {
                        let lastGroup = '';
                        return sec.options.map((opt) => {
                          const on = !!st.selected[opt.id];
                          const showGroup = !!opt.group && opt.group !== lastGroup;
                          if (opt.group) lastGroup = opt.group;
                          return (
                            <View key={opt.id}>
                              {showGroup ? <Text style={styles.groupLabel}>{opt.group}</Text> : null}
                              <Pressable
                                onPress={() => toggleOption(sec.id, opt.id)}
                                style={[styles.optionRow, on && styles.optionRowOn]}
                              >
                                <Ionicons
                                  name={on ? 'checkbox' : 'square-outline'}
                                  size={20}
                                  color={on ? colors.brandMagenta : colors.textMuted}
                                />
                                <Text style={[styles.optionLabel, on && styles.optionLabelOn]}>
                                  {opt.label}
                                </Text>
                              </Pressable>
                              {on && opt.selectOptions?.length ? (
                                <View style={styles.selectDetailWrap}>
                                  <OptionSelect
                                    placeholder={opt.selectPlaceholder || 'Select type...'}
                                    options={opt.selectOptions}
                                    onSelect={(v) => appendOptionSelect(sec.id, opt.id, v)}
                                  />
                                  <TextInput
                                    value={st.optionNotes[opt.id] || ''}
                                    onChangeText={(t) => setOptionNotes(sec.id, opt.id, t)}
                                    placeholder="Selected options will appear here..."
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    style={styles.selectNotes}
                                  />
                                </View>
                              ) : null}
                              {on && opt.children?.length ? (
                                <View style={styles.childWrap}>
                                  <Text style={styles.childHint}>Select options</Text>
                                  {opt.children.map((child) => {
                                    const childOn = !!st.childSelected[opt.id]?.[child];
                                    return (
                                      <Pressable
                                        key={child}
                                        onPress={() => toggleChild(sec.id, opt.id, child)}
                                        style={[styles.childRow, childOn && styles.childRowOn]}
                                      >
                                        <Ionicons
                                          name={childOn ? 'checkmark-circle' : 'ellipse-outline'}
                                          size={18}
                                          color={childOn ? colors.brandMagenta : colors.textMuted}
                                        />
                                        <Text style={styles.childLabel}>{child}</Text>
                                      </Pressable>
                                    );
                                  })}
                                </View>
                              ) : null}
                            </View>
                          );
                        });
                      })()}
                      {(sec.extraFields || []).map((field) => (
                        <View key={field.id} style={styles.commentBlock}>
                          <View style={styles.voiceRow}>
                            <Text style={[styles.commentLabel, styles.voiceLabel]}>{field.label}</Text>
                            {field.voice ? (
                              <VoiceInputButton
                                value={st.fields[field.id] || ''}
                                onChange={(t) => setField(sec.id, field.id, t)}
                              />
                            ) : null}
                          </View>
                          <TextInput
                            value={st.fields[field.id] || ''}
                            onChangeText={(t) => setField(sec.id, field.id, t)}
                            placeholder={field.placeholder}
                            placeholderTextColor={colors.textMuted}
                            multiline
                            style={styles.commentInput}
                          />
                        </View>
                      ))}
                      {sec.showComments ? (
                        <View style={styles.commentBlock}>
                          <View style={styles.voiceRow}>
                            <Text style={[styles.commentLabel, styles.voiceLabel]}>
                              {sec.commentLabel || 'Comments'}
                            </Text>
                            {sec.commentVoice ? (
                              <VoiceInputButton
                                value={st.comment}
                                onChange={(t) => setComment(sec.id, t)}
                              />
                            ) : null}
                          </View>
                          <TextInput
                            value={st.comment}
                            onChangeText={(t) => setComment(sec.id, t)}
                            placeholder={sec.commentPlaceholder}
                            placeholderTextColor={colors.textMuted}
                            multiline
                            style={styles.commentInput}
                          />
                        </View>
                      ) : null}
                    </>
                  )}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={saveDraft}
          disabled={saving}
          style={({ pressed }) => [styles.footerBtn, styles.saveBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Note'}</Text>
        </Pressable>
        <Pressable
          onPress={() => setSignOpen(true)}
          disabled={saving}
          style={({ pressed }) => [
            styles.footerBtn,
            styles.completeBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.completeBtnText}>Complete Note</Text>
        </Pressable>
      </View>

      <Modal visible={signOpen} animationType="slide" transparent onRequestClose={() => setSignOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="document-text-outline" size={18} color="#fff" />
              <Text style={styles.modalHeaderText}>Electronic Signature</Text>
            </View>
            <View style={styles.modalBody}>
              <Field
                label="Electronic signature authentication"
                value={signaturePin}
                onChangeText={setSignaturePin}
                secureTextEntry
                placeholder="Enter PIN or password"
              />
              <Text style={styles.helper}>Required for electronic signature authentication</Text>
              <Text style={styles.signDateLabel}>Signature date & time</Text>
              <Text style={styles.signDate}>{signedAt}</Text>
              <View style={styles.modalActions}>
                <Button label="Cancel" variant="ghost" onPress={() => setSignOpen(false)} />
                <Button label="Save Draft" variant="secondary" loading={saving} onPress={saveDraft} />
                <Button label="Complete & Sign" loading={saving} onPress={completeAndSign} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    color: colors.textMuted,
    fontSize: 13,
  },
  loadPrev: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  loadPrevText: { color: colors.brandMagenta, fontWeight: '600', fontSize: 14 },
  list: { paddingHorizontal: 12, paddingBottom: 100 },
  sectionWrap: {
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  sectionTitle: {
    flex: 1,
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  countChip: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countChipText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  sectionBody: { padding: 10, gap: 6 },
  groupLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 8,
    marginBottom: 2,
    marginLeft: 2,
  },
  selectDetailWrap: {
    marginLeft: 8,
    marginTop: 4,
    marginBottom: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  selectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  selectTriggerText: { flex: 1, fontSize: 13, color: colors.textMuted },
  selectOption: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#1e293b',
    marginTop: 4,
  },
  selectOptionOn: { backgroundColor: '#006bb7' },
  selectOptionText: { color: '#fff', fontSize: 13 },
  selectNotes: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
    backgroundColor: '#fff',
    textAlignVertical: 'top',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F0F7FF',
  },
  optionRowOn: { backgroundColor: '#FFE4EC' },
  optionLabel: { flex: 1, color: colors.text, fontSize: 14 },
  optionLabelOn: { fontWeight: '600', color: colors.ink },
  childWrap: {
    marginLeft: 12,
    marginTop: 4,
    marginBottom: 6,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  childHint: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 2,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  childRowOn: { backgroundColor: '#FFF1F5' },
  childLabel: { color: colors.text, fontSize: 13 },
  commentBlock: { marginTop: 8 },
  commentLabel: { fontWeight: '700', color: colors.textMuted, marginBottom: 6, fontSize: 12 },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  voiceLabel: {
    flex: 1,
    marginBottom: 0,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  commentInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    textAlignVertical: 'top',
    color: colors.text,
    backgroundColor: '#fff',
  },
  responseBlock: { gap: 8 },
  ordersBlock: { gap: 10, paddingVertical: 4 },
  ordersDesc: { fontSize: 13, color: '#64748b', lineHeight: 19 },
  ordersBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#006bb7',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ordersBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  ordersHint: { fontSize: 12, color: '#94a3b8' },
  ordersSecondary: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
  },
  ordersSecondaryText: { color: '#334155', fontWeight: '600', fontSize: 12 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footerBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  saveBtn: { borderColor: '#2563EB', backgroundColor: '#fff' },
  saveBtnText: { color: '#2563EB', fontWeight: '700' },
  completeBtn: { borderColor: '#0D9488', backgroundColor: '#fff' },
  completeBtnText: { color: '#0D9488', fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    maxHeight: '85%',
  },
  modalHeader: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalHeaderText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  modalBody: { padding: 16, paddingBottom: 28 },
  helper: { color: colors.textMuted, fontSize: 12, marginTop: -8, marginBottom: 14 },
  signDateLabel: { fontWeight: '700', color: colors.textMuted, fontSize: 12, marginBottom: 4 },
  signDate: { color: colors.ink, marginBottom: 16, fontSize: 15 },
  modalActions: { gap: 8 },
});
