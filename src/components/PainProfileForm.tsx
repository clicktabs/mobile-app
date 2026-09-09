import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VoiceInputButton } from './VoiceInputButton';
import { colors } from '../theme/colors';

export type PainProfileState = {
  hadPainThisWeek: '' | 'yes' | 'no';
  frequency: string;
  assessmentComments: string;
  profileComments: string;
};

export function emptyPainProfile(): PainProfileState {
  return {
    hadPainThisWeek: '',
    frequency: '',
    assessmentComments: '',
    profileComments: '',
  };
}

const FREQUENCIES = [
  'Never',
  'Rarely',
  'Sometimes',
  'Often',
  'Always',
  'Daily',
  'Several times per day',
  'With movement only',
  'At rest',
  'Both movement and rest',
];

type Props = {
  value: PainProfileState;
  onChange: (next: PainProfileState) => void;
};

export function PainProfileForm({ value, onChange }: Props) {
  const [freqOpen, setFreqOpen] = useState(false);
  const set = (patch: Partial<PainProfileState>) => onChange({ ...value, ...patch });

  return (
    <View style={styles.wrap}>
      <Text style={styles.prompt}>Has patient had any pain this week?</Text>
      <View style={styles.radioRow}>
        {(['yes', 'no'] as const).map((opt) => {
          const on = value.hadPainThisWeek === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => set({ hadPainThisWeek: opt })}
              style={[styles.radioChip, on && styles.radioChipOn]}
            >
              <Ionicons
                name={on ? 'radio-button-on' : 'radio-button-off'}
                size={18}
                color={on ? colors.brandMagenta : colors.textMuted}
              />
              <Text style={[styles.radioLabel, on && styles.radioLabelOn]}>
                {opt === 'yes' ? 'Yes' : 'No'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.divider} />

      <Text style={styles.prompt}>
        Current Frequency of Pain Interfering with Patient's Activity or Movement
      </Text>
      <Pressable
        onPress={() => setFreqOpen((o) => !o)}
        style={({ pressed }) => [styles.select, pressed && { opacity: 0.9 }]}
      >
        <Text style={value.frequency ? styles.selectText : styles.selectPlaceholder}>
          {value.frequency || 'Select one'}
        </Text>
        <Ionicons name={freqOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </Pressable>
      {freqOpen
        ? FREQUENCIES.map((f) => (
            <Pressable
              key={f}
              onPress={() => {
                set({ frequency: f });
                setFreqOpen(false);
              }}
              style={[styles.optionRow, value.frequency === f && styles.optionRowOn]}
            >
              <Text style={[styles.optionText, value.frequency === f && styles.optionTextOn]}>{f}</Text>
            </Pressable>
          ))
        : null}

      <View style={styles.divider} />

      <View style={styles.commentBlock}>
        <View style={styles.voiceRow}>
          <Text style={styles.commentLabel}>Pain Assessment Comments</Text>
          <VoiceInputButton
            value={value.assessmentComments}
            onChange={(t) => set({ assessmentComments: t })}
          />
        </View>
        <TextInput
          value={value.assessmentComments}
          onChangeText={(t) => set({ assessmentComments: t })}
          multiline
          style={styles.textarea}
          placeholder="Document pain location, intensity (0-10 scale), quality, triggers, alleviating factors, current medications, and patient response to pain management interventions..."
          placeholderTextColor={colors.textMuted}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.commentBlock}>
        <View style={styles.voiceRow}>
          <Text style={styles.commentLabel}>Comments</Text>
          <VoiceInputButton
            value={value.profileComments}
            onChange={(t) => set({ profileComments: t })}
          />
        </View>
        <TextInput
          value={value.profileComments}
          onChangeText={(t) => set({ profileComments: t })}
          multiline
          style={styles.textarea}
          placeholder="Additional pain profile comments..."
          placeholderTextColor={colors.textMuted}
          textAlignVertical="top"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  prompt: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
    fontWeight: '600',
  },
  radioRow: { flexDirection: 'row', gap: 8 },
  radioChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F0F7FF',
    flex: 1,
  },
  radioChipOn: { backgroundColor: '#FFE4EC' },
  radioLabel: { fontSize: 14, color: colors.text },
  radioLabelOn: { fontWeight: '700', color: colors.ink },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e5e7eb',
    marginVertical: 6,
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  selectText: { flex: 1, fontSize: 13, color: colors.text },
  selectPlaceholder: { flex: 1, fontSize: 13, color: colors.textMuted },
  optionRow: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#1e293b',
    marginTop: 4,
  },
  optionRowOn: { backgroundColor: '#006bb7' },
  optionText: { color: '#fff', fontSize: 13 },
  optionTextOn: { fontWeight: '700' },
  commentBlock: { gap: 6, marginTop: 4 },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  commentLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, flex: 1 },
  textarea: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
    backgroundColor: '#fff',
  },
});
