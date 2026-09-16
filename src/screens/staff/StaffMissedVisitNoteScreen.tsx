import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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
import { ApiError } from '../../api/client';
import { VoiceInputButton } from '../../components/VoiceInputButton';
import type { StaffScheduleStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { showAlert } from '../../utils/confirm';
import { safeGoBack } from '../../utils/navigation';

type Props = NativeStackScreenProps<StaffScheduleStackParamList, 'MissedVisitNote'>;

/**
 * Why a visit did not happen.
 *
 * A visit flagged automatically carries no reason — the system can see that nobody
 * attended, not why, and the why is what the physician notification and the plan of
 * care turn on. This is a record of care not given, so it is signed like any other.
 *
 * Reaching it is deliberately a separate action from tapping the row: the row still
 * opens EVV, because the most common correction is "I was there, I just forgot to
 * clock in" and that should stay one tap.
 */
export function StaffMissedVisitNoteScreen({ navigation, route }: Props) {
  const { token } = useAuth();
  const { scheduleId } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [context, setContext] = useState<staffApi.MissedVisitContext | null>(null);

  const [reason, setReason] = useState('');
  const [comments, setComments] = useState('');
  const [physicianNotified, setPhysicianNotified] = useState(false);
  const [willReschedule, setWillReschedule] = useState(true);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        if (!token) return;
        try {
          const res = await staffApi.getMissedVisitNote(token, scheduleId);
          if (cancelled) return;

          setContext(res);

          // An already-documented note reopens with what was recorded, so an edit
          // corrects it rather than starting from nothing.
          if (res.note?.documented) {
            setReason(res.note.reason || '');
            setComments(res.note.comments || '');
          }
        } catch (e) {
          if (!cancelled) {
            showAlert('Could not load', e instanceof ApiError ? e.message : 'Error', 'error');
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

  const onSave = async () => {
    if (!reason.trim()) {
      setError('Choose a reason.');
      return;
    }
    if (!comments.trim()) {
      setError('Add what happened — the reason alone is not enough for the record.');
      return;
    }
    if (!pin.trim()) {
      setError('Enter your signature PIN.');
      return;
    }

    if (!token) return;

    setSaving(true);
    setError(null);

    try {
      await staffApi.saveMissedVisitNote(token, scheduleId, {
        reason: reason.trim(),
        comments: comments.trim(),
        physician_notified: physicianNotified,
        will_reschedule: willReschedule,
        signature_pin: pin.trim(),
      });

      showAlert('Missed visit documented', 'The office can see the reason now.', 'success');
      safeGoBack(navigation, { tab: 'Schedule', screen: 'ScheduleList' });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save the note.');
    } finally {
      setSaving(false);
    }
  };

  const visit = context?.visit;

  return (
    <AppShell>
      <AppHeader
        title="Missed Visit"
        actions={[
          {
            icon: 'arrow-back',
            onPress: () => safeGoBack(navigation, { tab: 'Schedule', screen: 'ScheduleList' }),
          },
        ]}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPink} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          <View style={styles.visitCard}>
            <Ionicons name="close-circle" size={20} color="#C53030" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.visitName}>{visit?.patient_name || 'Patient'}</Text>
              <Text style={styles.visitMeta}>
                {visit?.task || 'Visit'}
                {visit?.scheduled_at ? ` · scheduled ${visit.scheduled_at}` : ''}
              </Text>
            </View>
          </View>

          {context?.note && !context.note.documented ? (
            <View style={styles.flagNotice}>
              <Text style={styles.flagNoticeText}>
                Flagged automatically because the visit window passed with no clock-in.
                A reason is required.
              </Text>
            </View>
          ) : null}

          <Text style={styles.label}>REASON</Text>
          <View style={styles.reasonList}>
            {(context?.reasons || []).map((r) => {
              const on = reason === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => {
                    setReason(r);
                    setError(null);
                  }}
                  style={[styles.reasonChip, on && styles.reasonChipOn]}
                >
                  <Ionicons
                    name={on ? 'radio-button-on' : 'radio-button-off'}
                    size={16}
                    color={on ? '#C53030' : colors.textMuted}
                  />
                  <Text style={[styles.reasonText, on && styles.reasonTextOn]}>{r}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.labelRow}>
            <Text style={styles.label}>WHAT HAPPENED</Text>
            <VoiceInputButton value={comments} onChange={setComments} />
          </View>
          <TextInput
            value={comments}
            onChangeText={(t) => {
              setComments(t);
              setError(null);
            }}
            placeholder="Who you spoke to, what you were told, what you did next"
            placeholderTextColor="#94A3B8"
            multiline
            style={styles.textArea}
          />

          <View style={styles.switchRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.switchLabel}>Physician notified</Text>
              <Text style={styles.switchHint}>Required for most missed skilled visits</Text>
            </View>
            <Switch
              value={physicianNotified}
              onValueChange={setPhysicianNotified}
              trackColor={{ true: '#FCA5A5', false: '#CBD5E1' }}
              thumbColor={physicianNotified ? '#C53030' : '#F1F5F9'}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.switchLabel}>Will be rescheduled</Text>
              <Text style={styles.switchHint}>Records this as a reschedule rather than a loss</Text>
            </View>
            <Switch
              value={willReschedule}
              onValueChange={setWillReschedule}
              trackColor={{ true: '#FCA5A5', false: '#CBD5E1' }}
              thumbColor={willReschedule ? '#C53030' : '#F1F5F9'}
            />
          </View>

          <Text style={styles.label}>SIGNATURE PIN</Text>
          <TextInput
            value={pin}
            onChangeText={(t) => {
              setPin(t);
              setError(null);
            }}
            placeholder="••••"
            placeholderTextColor="#94A3B8"
            secureTextEntry
            maxLength={12}
            style={styles.pinInput}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={onSave}
            disabled={saving}
            style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>SIGN & SUBMIT</Text>
            )}
          </Pressable>

          <Text style={styles.footnote}>
            If you did attend this visit, go back and clock in instead — that clears the
            flag without recording a missed visit.
          </Text>
        </ScrollView>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pad: { padding: 16, paddingBottom: 36 },
  visitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF5F5',
    borderColor: '#FEB2B2',
    borderWidth: 1,
    borderLeftWidth: 4,
    borderLeftColor: '#C53030',
    borderRadius: 12,
    padding: 12,
  },
  visitName: { fontSize: 15, fontWeight: '800', color: colors.text },
  visitMeta: { marginTop: 2, fontSize: 12, color: colors.textMuted },
  flagNotice: {
    marginTop: 10,
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  flagNoticeText: { fontSize: 12, color: '#92400E', lineHeight: 17 },
  label: {
    marginTop: 18,
    marginBottom: 6,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.textMuted,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reasonList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  reasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  reasonChipOn: { backgroundColor: '#FFF5F5' },
  reasonText: { flex: 1, fontSize: 14, color: colors.text },
  reasonTextOn: { fontWeight: '700', color: '#C53030' },
  textArea: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 96,
    fontSize: 14,
    color: colors.text,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  switchHint: { marginTop: 2, fontSize: 11, color: colors.textMuted },
  pinInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    letterSpacing: 4,
    color: colors.text,
  },
  error: { marginTop: 10, fontSize: 12, color: colors.danger, fontWeight: '600' },
  saveBtn: {
    marginTop: 18,
    backgroundColor: '#C53030',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.3 },
  footnote: {
    marginTop: 14,
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
    lineHeight: 16,
  },
});
