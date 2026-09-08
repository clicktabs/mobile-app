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
import type { StaffScheduleStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { showAlert } from '../../utils/confirm';

type Props = NativeStackScreenProps<StaffScheduleStackParamList, 'SkilledNurseVisit'>;

type SectionState = {
  open: boolean;
  selected: Record<string, boolean>;
  childSelected: Record<string, Record<string, boolean>>;
  comment: string;
};

function emptySection(): SectionState {
  return { open: false, selected: {}, childSelected: {}, comment: '' };
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
      if (!nextSelected[optionId]) {
        delete nextChild[optionId];
      } else if (!nextChild[optionId]) {
        nextChild[optionId] = {};
      }
      return {
        ...prev,
        [sectionId]: { ...cur, selected: nextSelected, childSelected: nextChild },
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

    VISIT_SECTIONS.forEach((sec) => {
      if (sec.id === 'vitals') return;
      const st = sections[sec.id];
      const picks = sec.options
        .filter((o) => st.selected[o.id])
        .map((o) => {
          const kids = Object.entries(st.childSelected[o.id] || {})
            .filter(([, v]) => v)
            .map(([k]) => k);
          return kids.length ? `${o.label} (${kids.join(', ')})` : o.label;
        });
      if (!picks.length && !st.comment.trim()) return;
      lines.push(`\n[${sec.title}]`);
      picks.forEach((p) => lines.push(`- ${p}`));
      if (st.comment.trim()) lines.push(`Comments: ${st.comment.trim()}`);
    });
    return lines.join('\n');
  };

  const buildFormData = () => {
    const form: Record<string, unknown> = { ...vitalsToFormData(vitals) };
    VISIT_SECTIONS.forEach((sec) => {
      if (sec.id === 'vitals') return;
      const st = sections[sec.id];
      sec.options.forEach((o) => {
        if (st.selected[o.id]) form[o.id] = '1';
        const kids = Object.entries(st.childSelected[o.id] || {})
          .filter(([, v]) => v)
          .map(([k]) => k);
        if (kids.length) form[`${o.id}_detail`] = kids;
      });
      if (st.comment.trim()) form[`${sec.id}_comments`] = st.comment.trim();
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
                  ) : (
                    <>
                      {sec.options.map((opt) => {
                        const on = !!st.selected[opt.id];
                        return (
                          <View key={opt.id}>
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
                      })}
                      {sec.showComments ? (
                        <View style={styles.commentBlock}>
                          <Text style={styles.commentLabel}>Comments</Text>
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
