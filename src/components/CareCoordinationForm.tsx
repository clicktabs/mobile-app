import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VoiceInputButton } from './VoiceInputButton';
import { colors } from '../theme/colors';
import { showAlert } from '../utils/confirm';

export type CoordinationNote = {
  with: string;
  withLabel: string;
  nameTitle: string;
  regarding: string;
};

export type CareCoordinationState = {
  na: boolean;
  with: string;
  nameTitle: string;
  regarding: string;
  notes: CoordinationNote[];
  comments: string;
};

export function emptyCareCoordination(): CareCoordinationState {
  return {
    na: false,
    with: '',
    nameTitle: '',
    regarding: '',
    notes: [],
    comments: '',
  };
}

const PROVIDERS: Array<{ value: string; label: string }> = [
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
];

type Props = {
  value: CareCoordinationState;
  onChange: (next: CareCoordinationState) => void;
  onAddNote?: (note: CoordinationNote) => Promise<void> | void;
};

export function CareCoordinationForm({ value, onChange, onAddNote }: Props) {
  const [savingNote, setSavingNote] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const set = (patch: Partial<CareCoordinationState>) => onChange({ ...value, ...patch });

  const addNote = async () => {
    if (value.na) {
      showAlert('Not applicable', 'Uncheck NA to add a coordination note.');
      return;
    }
    if (!value.with) {
      showAlert('Required', 'Select who care was coordinated with.');
      return;
    }
    const withLabel = PROVIDERS.find((p) => p.value === value.with)?.label || value.with;
    const note: CoordinationNote = {
      with: value.with,
      withLabel,
      nameTitle: value.nameTitle.trim(),
      regarding: value.regarding.trim(),
    };
    setSavingNote(true);
    try {
      await onAddNote?.(note);
      set({
        notes: [...value.notes, note],
        with: '',
        nameTitle: '',
        regarding: '',
      });
      showAlert('Coordination note added');
    } catch {
      // caller shows error
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => set({ na: !value.na })}
        style={[styles.naRow, value.na && styles.naRowOn]}
      >
        <Ionicons
          name={value.na ? 'checkbox' : 'square-outline'}
          size={20}
          color={value.na ? colors.brandMagenta : colors.textMuted}
        />
        <Text style={styles.naLabel}>NA</Text>
      </Pressable>

      {!value.na ? (
        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>Coordinated Care with:</Text>
          <Pressable onPress={() => setPickerOpen((o) => !o)} style={styles.select}>
            <Text style={value.with ? styles.selectText : styles.selectPlaceholder}>
              {PROVIDERS.find((p) => p.value === value.with)?.label || 'Select care provider...'}
            </Text>
            <Ionicons name={pickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
          </Pressable>
          {pickerOpen
            ? PROVIDERS.map((p) => (
                <Pressable
                  key={p.value}
                  onPress={() => {
                    set({ with: p.value });
                    setPickerOpen(false);
                  }}
                  style={[styles.providerRow, value.with === p.value && styles.providerRowOn]}
                >
                  <Text style={styles.providerText}>{p.label}</Text>
                </Pressable>
              ))
            : null}

          <Text style={styles.fieldLabel}>Name/Title</Text>
          <TextInput
            value={value.nameTitle}
            onChangeText={(t) => set({ nameTitle: t })}
            style={styles.input}
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.fieldLabel}>Regarding</Text>
          <TextInput
            value={value.regarding}
            onChangeText={(t) => set({ regarding: t })}
            multiline
            style={styles.textarea}
            placeholder="Describe coordination details, care plans discussed, recommendations made..."
            placeholderTextColor={colors.textMuted}
            textAlignVertical="top"
          />

          <Pressable
            onPress={addNote}
            disabled={savingNote}
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.addBtnText}>
              {savingNote ? 'Adding…' : 'Add Coordination Note'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {value.notes.length ? (
        <View style={styles.notesList}>
          {value.notes.map((n, i) => (
            <View key={`${n.with}-${i}`} style={styles.noteCard}>
              <Text style={styles.noteTitle}>{n.withLabel}</Text>
              {n.nameTitle ? <Text style={styles.noteMeta}>{n.nameTitle}</Text> : null}
              {n.regarding ? <Text style={styles.noteBody}>{n.regarding}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.commentBlock}>
        <View style={styles.voiceRow}>
          <Text style={styles.commentLabel}>Comments</Text>
          <VoiceInputButton
            value={value.comments}
            onChange={(t) => set({ comments: t })}
          />
        </View>
        <TextInput
          value={value.comments}
          onChangeText={(t) => set({ comments: t })}
          multiline
          style={styles.textarea}
          placeholder="Care coordination comments..."
          placeholderTextColor={colors.textMuted}
          textAlignVertical="top"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  naRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F0F7FF',
  },
  naRowOn: { backgroundColor: '#FFE4EC' },
  naLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  formCard: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 10,
    gap: 6,
    backgroundColor: '#fff',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  selectText: { flex: 1, fontSize: 13, color: colors.text },
  selectPlaceholder: { flex: 1, fontSize: 13, color: colors.textMuted },
  providerRow: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
  },
  providerRowOn: { backgroundColor: '#E8F1FF' },
  providerText: { fontSize: 13, color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
  },
  textarea: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
    backgroundColor: '#fff',
  },
  addBtn: {
    marginTop: 8,
    backgroundColor: '#006bb7',
    borderRadius: 6,
    paddingVertical: 11,
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  notesList: { gap: 6 },
  noteCard: {
    borderWidth: 1,
    borderColor: '#dbe3ef',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#F8FAFC',
    gap: 2,
  },
  noteTitle: { fontWeight: '700', fontSize: 13, color: colors.ink },
  noteMeta: { fontSize: 12, color: colors.textMuted },
  noteBody: { fontSize: 12, color: colors.text, marginTop: 4, lineHeight: 17 },
  commentBlock: { gap: 6 },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  commentLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
});
