import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeader, AppShell } from '../../components/chrome';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import * as evvApi from '../../api/evv';
import { ApiError } from '../../api/client';
import { queueDocument } from '../../api/docQueue';
import { isOffline } from '../../utils/connectivity';
import { VoiceInputButton } from '../../components/VoiceInputButton';
import { HHA_TASK_SECTIONS, type HhaTaskStatus } from '../../data/hhaTasks';
import type { StaffScheduleStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { showAlert } from '../../utils/confirm';
import { safeGoBack } from '../../utils/navigation';

type Props = NativeStackScreenProps<StaffScheduleStackParamList, 'HhaVisitNote'>;

const STATUS_CHOICES: { value: HhaTaskStatus; label: string; tint: string; bg: string }[] = [
  { value: 'completed', label: 'Done', tint: '#047857', bg: '#D1FAE5' },
  { value: 'refused', label: 'Refused', tint: '#B45309', bg: '#FEF3C7' },
  { value: 'na', label: 'N/A', tint: '#475569', bg: '#E2E8F0' },
];

/**
 * The Home Health Aide's shift note.
 *
 * Aides were being handed StaffSkilledNurseVisitScreen — vital signs, wound
 * assessment, integument — because every documentation entry point named that screen
 * outright. Signing it would have meant attesting to observations outside an aide's
 * scope of practice.
 *
 * The task list is generated from the web HHA form, so a note written here and one
 * written at a desk are the same record in hha_notes.assessment_data.
 */
export function StaffHhaVisitNoteScreen({ navigation, route }: Props) {
  const { token } = useAuth();
  const { scheduleId, patientId, patientName, startTime } = route.params;

  const [tasks, setTasks] = useState<Record<string, HhaTaskStatus>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [openComment, setOpenComment] = useState<string | null>(null);
  const [visitStart, setVisitStart] = useState('');
  const [visitEnd, setVisitEnd] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    // The first section open, the rest collapsed — 44 tasks is a long scroll.
    { [HHA_TASK_SECTIONS[0]?.section ?? '']: true },
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [signError, setSignError] = useState<string | null>(null);
  const [alreadySigned, setAlreadySigned] = useState(false);

  /** Whether a clock-out is still owed, so the note knows where to hand off. */
  const [sessionOpen, setSessionOpen] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        if (!token || !scheduleId) {
          setLoading(false);
          return;
        }

        try {
          const [noteRes, visitRes] = await Promise.all([
            staffApi.getHhaNote(token, scheduleId),
            evvApi.getEvvVisit(token, scheduleId).catch(() => null),
          ]);

          if (cancelled) return;

          if (noteRes.note) {
            setTasks(noteRes.note.tasks || {});
            setComments(noteRes.note.comments || {});
            setVisitStart(noteRes.note.visit_start_time || '');
            setVisitEnd(noteRes.note.visit_end_time || '');
            setAlreadySigned(noteRes.note.status === 'completed');
          }

          setSessionOpen(!!visitRes?.visit?.evv?.is_open_session);
        } catch (e) {
          if (!cancelled && e instanceof ApiError && e.status !== 404) {
            showAlert('Could not load', e.message, 'error');
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [token, scheduleId]),
  );

  const recordedCount = useMemo(() => Object.keys(tasks).length, [tasks]);

  const setTask = (key: string, value: HhaTaskStatus) => {
    setTasks((prev) => {
      // Tapping the same answer again clears it — an aide who mis-taps must be able
      // to unset a task rather than being stuck with an assertion they did not mean.
      if (prev[key] === value) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  };

  const buildPayload = (status: 'draft' | 'completed'): staffApi.HhaNotePayload => ({
    patient_id: patientId!,
    schedule_id: scheduleId,
    status,
    visit_start_time: visitStart || undefined,
    visit_end_time: visitEnd || undefined,
    tasks,
    comments,
  });

  const persist = async (status: 'draft' | 'completed', signaturePin?: string) => {
    if (!token || !patientId) {
      showAlert('Missing patient', 'This visit has no patient linked.');
      return false;
    }

    setSaving(true);

    const queueAsDraft = async () => {
      // A draft, never a signed note, whatever was asked for.
      //
      // The signature PIN is verified on the server; offline there is nothing to verify
      // it against. The alternatives are to keep a PIN on the device or to accept a
      // signature nobody checked, and neither is worth it — the work is captured either
      // way, and the caregiver signs it when there is a connection.
      await queueDocument('hha_note', scheduleId, buildPayload('draft'));
    };

    try {
      if (isOffline()) {
        if (status === 'completed') {
          await queueAsDraft();
          setSignError(
            'Saved on this device as a draft. Signing needs a connection — sign it once you are back online.',
          );
          return false;
        }

        await queueAsDraft();
        showAlert('Saved on this device', 'The note will upload when you are back online.', 'info');
        return true;
      }

      await staffApi.saveHhaNote(token, {
        ...buildPayload(status),
        ...(signaturePin ? { signature_pin: signaturePin } : {}),
      });
      return true;
    } catch (e) {
      // The connection went mid-save. Keep the work rather than lose it.
      if (e instanceof ApiError && e.status === 0) {
        try {
          await queueAsDraft();
          const message =
            status === 'completed'
              ? 'The connection dropped. Saved on this device as a draft — sign it once you are back online.'
              : 'The connection dropped. Saved on this device and will upload when you are back online.';

          if (status === 'completed') {
            setSignError(message);
            return false;
          }

          showAlert('Saved on this device', message, 'info');
          return true;
        } catch {
          // Cannot even write locally; fall through and say so.
        }
      }

      const msg = e instanceof ApiError ? e.message : 'Could not save the note.';
      if (status === 'completed') {
        setSignError(msg);
      } else {
        showAlert('Save failed', msg, 'error');
      }
      return false;
    } finally {
      setSaving(false);
    }
  };

  const leave = () => {
    if (sessionOpen) {
      const parent = navigation.getParent();
      const target = { screen: 'MenuEvvClockOut' as const, params: { scheduleId } };
      if (parent) parent.navigate('Menu', target);
      else (navigation as any).navigate('Menu', target);
      return;
    }

    safeGoBack(navigation, { tab: 'Schedule', screen: 'ScheduleList' });
  };

  const onSaveDraft = async () => {
    if (!(await persist('draft'))) return;
    showAlert('Draft saved', 'Finish this note from your schedule.', 'success');
    safeGoBack(navigation, { tab: 'Schedule', screen: 'ScheduleList' });
  };

  const onSign = async () => {
    if (!pin.trim()) {
      setSignError('Enter your signature PIN.');
      return;
    }

    if (!(await persist('completed', pin.trim()))) return;

    setSignOpen(false);
    setPin('');
    setAlreadySigned(true);
    showAlert(
      'Shift note signed',
      sessionOpen ? 'Proceeding to clock-out.' : 'Visit documentation saved.',
      'success',
    );
    leave();
  };

  const subtitle = `${patientName || 'Patient'}${
    startTime ? ` · ${new Date(startTime.replace(' ', 'T')).toLocaleDateString()}` : ''
  }`;

  return (
    <AppShell>
      <AppHeader
        title="HHA Shift Note"
        actions={[
          {
            icon: 'arrow-back',
            onPress: () => safeGoBack(navigation, { tab: 'Schedule', screen: 'ScheduleList' }),
          },
        ]}
      />

      <View style={styles.contextBar}>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
        <Text style={styles.counter}>
          {recordedCount} of {HHA_TASK_SECTIONS.reduce((n, s) => n + s.tasks.length, 0)} recorded
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPink} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {alreadySigned ? (
            <View style={styles.signedBanner}>
              <Ionicons name="checkmark-circle" size={16} color="#047857" />
              <Text style={styles.signedBannerText}>
                This note is signed. Saving again will update it.
              </Text>
            </View>
          ) : null}

          <View style={styles.timesRow}>
            <View style={styles.timeCol}>
              <Text style={styles.fieldLabel}>VISIT START</Text>
              <TextInput
                value={visitStart}
                onChangeText={setVisitStart}
                placeholder="09:00"
                placeholderTextColor="#94A3B8"
                style={styles.timeInput}
              />
            </View>
            <View style={styles.timeCol}>
              <Text style={styles.fieldLabel}>VISIT END</Text>
              <TextInput
                value={visitEnd}
                onChangeText={setVisitEnd}
                placeholder="11:00"
                placeholderTextColor="#94A3B8"
                style={styles.timeInput}
              />
            </View>
          </View>

          {HHA_TASK_SECTIONS.map((section) => {
            const open = !!openSections[section.section];
            const done = section.tasks.filter((t) => tasks[t.key]).length;

            return (
              <View key={section.section} style={styles.section}>
                <Pressable
                  style={styles.sectionHeader}
                  onPress={() =>
                    setOpenSections((prev) => ({
                      ...prev,
                      [section.section]: !prev[section.section],
                    }))
                  }
                >
                  <Text style={styles.sectionTitle}>{section.section}</Text>
                  <Text style={styles.sectionCount}>
                    {done}/{section.tasks.length}
                  </Text>
                  <Ionicons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.textMuted}
                  />
                </Pressable>

                {open
                  ? section.tasks.map((task) => (
                      <View key={task.key} style={styles.taskRow}>
                        <View style={styles.taskHead}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.taskLabel}>{task.label}</Text>
                            {task.frequency ? (
                              <Text style={styles.taskFreq}>{task.frequency}</Text>
                            ) : null}
                          </View>
                          <Pressable
                            hitSlop={8}
                            onPress={() =>
                              setOpenComment((k) => (k === task.key ? null : task.key))
                            }
                          >
                            <Ionicons
                              name={comments[task.key] ? 'chatbubble' : 'chatbubble-outline'}
                              size={17}
                              color={comments[task.key] ? colors.brandMagenta : colors.textMuted}
                            />
                          </Pressable>
                        </View>

                        <View style={styles.choiceRow}>
                          {STATUS_CHOICES.map((choice) => {
                            const on = tasks[task.key] === choice.value;
                            return (
                              <Pressable
                                key={choice.value}
                                onPress={() => setTask(task.key, choice.value)}
                                style={[
                                  styles.choice,
                                  on && { backgroundColor: choice.bg, borderColor: choice.tint },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.choiceText,
                                    on && { color: choice.tint, fontWeight: '800' },
                                  ]}
                                >
                                  {choice.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>

                        {openComment === task.key ? (
                          <View>
                            <View style={styles.commentHead}>
                              <Text style={styles.commentLabel}>NOTE</Text>
                              {/*
                                An aide is often mid-task with gloves on or hands full.
                                Dictating a note is the difference between recording
                                what happened and skipping it.
                              */}
                              <VoiceInputButton
                                value={comments[task.key] || ''}
                                onChange={(next) =>
                                  setComments((prev) => ({ ...prev, [task.key]: next }))
                                }
                              />
                            </View>
                            <TextInput
                              value={comments[task.key] || ''}
                              onChangeText={(t) =>
                                setComments((prev) => ({ ...prev, [task.key]: t }))
                              }
                              placeholder="Note for this task"
                              placeholderTextColor="#94A3B8"
                              multiline
                              style={styles.commentInput}
                            />
                          </View>
                        ) : comments[task.key] ? (
                          <Text style={styles.commentPreview} numberOfLines={2}>
                            {comments[task.key]}
                          </Text>
                        ) : null}
                      </View>
                    ))
                  : null}
              </View>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.footer}>
        <Pressable
          onPress={onSaveDraft}
          disabled={saving}
          style={({ pressed }) => [styles.footerBtn, styles.draftBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.draftBtnText}>{saving ? 'Saving…' : 'Save Draft'}</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            setSignError(null);
            setSignOpen(true);
          }}
          disabled={saving}
          style={({ pressed }) => [styles.footerBtn, styles.signBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.signBtnText}>{saving ? 'Saving…' : 'Complete & Sign'}</Text>
        </Pressable>
      </View>

      <Modal visible={signOpen} transparent animationType="slide" onRequestClose={() => setSignOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sign this shift note</Text>
            <Text style={styles.modalBody}>
              Signing records {recordedCount} task{recordedCount === 1 ? '' : 's'} against this
              visit under your name.
            </Text>

            <TextInput
              value={pin}
              onChangeText={(t) => {
                setPin(t);
                setSignError(null);
              }}
              placeholder="Signature PIN"
              placeholderTextColor="#94A3B8"
              secureTextEntry
              maxLength={12}
              style={styles.pinInput}
            />

            {signError ? <Text style={styles.modalError}>{signError}</Text> : null}

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setSignOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={onSign} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Sign</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  contextBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subtitle: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.text },
  counter: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  list: { padding: 14, paddingBottom: 30 },
  signedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  signedBannerText: { flex: 1, fontSize: 12, color: '#047857', fontWeight: '600' },
  timesRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  timeCol: { flex: 1 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  timeInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
  },
  sectionTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: colors.text },
  sectionCount: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  taskRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  taskHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  taskLabel: { fontSize: 14, color: colors.text, fontWeight: '600' },
  taskFreq: { marginTop: 2, fontSize: 11, color: colors.textMuted },
  choiceRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  choice: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.4,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  choiceText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  commentHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 2,
  },
  commentLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.4,
  },
  commentInput: {
    marginTop: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 60,
    fontSize: 13,
    color: colors.text,
    textAlignVertical: 'top',
  },
  commentPreview: { marginTop: 8, fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  draftBtn: { backgroundColor: '#E5E7EB' },
  draftBtnText: { color: colors.text, fontWeight: '800', fontSize: 14 },
  signBtn: { backgroundColor: '#0D9488' },
  signBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    gap: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  modalBody: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  pinInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    letterSpacing: 4,
    color: colors.text,
  },
  modalError: { fontSize: 12, color: colors.danger, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
  },
  modalCancelText: { color: colors.text, fontWeight: '700' },
  modalConfirm: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#0D9488',
  },
  modalConfirmText: { color: '#fff', fontWeight: '800' },
});
