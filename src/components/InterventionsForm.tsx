import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { INTERVENTION_TEMPLATES } from '../data/interventionTemplates';
import { colors } from '../theme/colors';
import { VoiceInputButton } from './VoiceInputButton';

type Props = {
  value: string;
  onChange: (next: string) => void;
};

export function InterventionsForm({ value, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return INTERVENTION_TEMPLATES;
    return INTERVENTION_TEMPLATES.filter(
      (t) => t.label.toLowerCase().includes(q) || t.text.toLowerCase().includes(q),
    );
  }, [query]);

  const appendTemplate = (text: string) => {
    const cur = value.trim();
    onChange(cur ? `${cur}\n${text}` : text);
    setPickerOpen(false);
    setQuery('');
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.voiceRow}>
        <Text style={styles.label}>Intervention Templates</Text>
        <VoiceInputButton value={value} onChange={onChange} />
      </View>

      <Pressable
        onPress={() => setPickerOpen(true)}
        style={({ pressed }) => [styles.select, pressed && { opacity: 0.9 }]}
        accessibilityRole="button"
        accessibilityLabel="Select intervention template to add"
      >
        <Text style={styles.selectPlaceholder} numberOfLines={1}>
          Select intervention template to add...
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>

      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Selected goals will appear here..."
        placeholderTextColor={colors.textMuted}
        multiline
        style={styles.goals}
        textAlignVertical="top"
      />

      <Modal
        visible={pickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setPickerOpen(false);
          setQuery('');
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Intervention Templates</Text>
              <Pressable
                onPress={() => {
                  setPickerOpen(false);
                  setQuery('');
                }}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search templates…"
              placeholderTextColor={colors.textMuted}
              style={styles.search}
              autoFocus
            />
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.label}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => appendTemplate(item.text)}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <Text style={styles.rowLabel}>{item.label}</Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.empty}>No templates match your search.</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  selectPlaceholder: {
    flex: 1,
    fontSize: 13,
    color: colors.textMuted,
  },
  goals: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
    backgroundColor: '#fff',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    maxHeight: '85%',
    paddingBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  list: { paddingHorizontal: 8 },
  row: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
  },
  rowPressed: { backgroundColor: '#F0F7FF' },
  rowLabel: { fontSize: 14, color: colors.text },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    paddingVertical: 24,
    fontSize: 13,
  },
});
