import React, { useMemo, useState } from 'react';
import {
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
import { Button } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';
import {
  PROBLEM_STATEMENT_TEMPLATES,
  templatesForDiscipline,
  type ProblemStatementTemplate,
} from '../../data/problemStatements';
import type { StaffScheduleStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { showAlert } from '../../utils/confirm';

type Props = NativeStackScreenProps<StaffScheduleStackParamList, 'AddProblemStatement'>;

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function StaffAddProblemStatementScreen({ navigation, route }: Props) {
  const { token } = useAuth();
  const { patientId, patientName, discipline, pocId, takenLabels = [], preselectLabel } =
    route.params;

  const available = useMemo(() => {
    const taken = new Set((takenLabels || []).map(norm));
    return templatesForDiscipline(discipline).filter((t) => !taken.has(norm(t.label)));
  }, [discipline, takenLabels]);

  const groups = useMemo(() => {
    const map = new Map<string, ProblemStatementTemplate[]>();
    available.forEach((t) => {
      if (!map.has(t.group)) map.set(t.group, []);
      map.get(t.group)!.push(t);
    });
    return Array.from(map.entries());
  }, [available]);

  const initial =
    available.find((t) => t.label === preselectLabel) ||
    available[0] ||
    PROBLEM_STATEMENT_TEMPLATES[0];

  const seedNotes = (t: ProblemStatementTemplate | undefined) => {
    const iNotes: Record<string, string> = {};
    const gNotes: Record<string, string> = {};
    (t?.interventions || []).forEach((opt) => {
      iNotes[opt.field] = opt.defaultNotes;
    });
    (t?.goals || []).forEach((opt) => {
      gNotes[opt.field] = opt.defaultNotes;
    });
    return { iNotes, gNotes };
  };

  const seeded = seedNotes(initial);
  const [selectedKey, setSelectedKey] = useState(initial?.sectionKey || '');
  const selected = available.find((t) => t.sectionKey === selectedKey) || initial;

  const [planOfCare, setPlanOfCare] = useState(selected?.defaultPlanOfCare || '');
  const [intervOn, setIntervOn] = useState<Record<string, boolean>>({});
  const [intervNotes, setIntervNotes] = useState<Record<string, string>>(seeded.iNotes);
  const [goalOn, setGoalOn] = useState<Record<string, boolean>>({});
  const [goalNotes, setGoalNotes] = useState<Record<string, string>>(seeded.gNotes);
  const [saving, setSaving] = useState(false);

  const applyTemplate = (t: ProblemStatementTemplate) => {
    setSelectedKey(t.sectionKey);
    setPlanOfCare(t.defaultPlanOfCare);
    const { iNotes, gNotes } = seedNotes(t);
    setIntervOn({});
    setIntervNotes(iNotes);
    setGoalOn({});
    setGoalNotes(gNotes);
  };

  const save = async () => {
    if (!token || !patientId || !selected) {
      showAlert('Missing data', 'Patient or problem statement is missing.');
      return;
    }
    setSaving(true);
    try {
      const interventions = selected.interventions
        .filter((opt) => intervOn[opt.field])
        .map((opt) => ({
          field: opt.field,
          label: opt.label,
          notes: (intervNotes[opt.field] || '').trim(),
        }));
      const goals = selected.goals
        .filter((opt) => goalOn[opt.field])
        .map((opt) => ({
          field: opt.field,
          label: opt.label,
          notes: (goalNotes[opt.field] || '').trim(),
        }));

      await staffApi.upsertPlanOfCareSection(token, patientId, {
        section_key: selected.sectionKey,
        label: selected.label,
        plan_of_care: planOfCare.trim(),
        interventions,
        goals,
        plan_of_care_id: pocId ?? null,
      });
      showAlert('Saved', 'Problem statement added to Plan of Care.');
      navigation.goBack();
    } catch (e) {
      showAlert('Save failed', e instanceof ApiError ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <AppHeader
        title="Add Problem Statement"
        actions={[{ icon: 'arrow-back', onPress: () => navigation.goBack() }]}
      />
      <Text style={styles.subtitle}>
        {patientName || `Patient #${patientId}`} · {discipline.toUpperCase()}
      </Text>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Problem Statement</Text>
        {!available.length ? (
          <Text style={styles.empty}>All problem statements for this discipline are already on the plan.</Text>
        ) : (
          groups.map(([group, items]) => (
            <View key={group} style={styles.group}>
              <Text style={styles.groupTitle}>{group}</Text>
              {items.map((t) => {
                const on = selected?.sectionKey === t.sectionKey;
                return (
                  <Pressable
                    key={t.sectionKey}
                    onPress={() => applyTemplate(t)}
                    style={[styles.option, on && styles.optionOn]}
                  >
                    <Ionicons
                      name={on ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={on ? '#2c5aa0' : colors.textMuted}
                    />
                    <Text style={[styles.optionText, on && styles.optionTextOn]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))
        )}

        {selected ? (
          <>
            <Text style={[styles.label, styles.sectionLabel]}>Plan of Care</Text>
            <TextInput
              value={planOfCare}
              onChangeText={setPlanOfCare}
              multiline
              style={styles.textarea}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.label, styles.sectionLabel]}>Select intervention(s)</Text>
            {selected.interventions.map((opt) => {
              const on = !!intervOn[opt.field];
              return (
                <View key={opt.field} style={styles.checkBlock}>
                  <Pressable
                    onPress={() => setIntervOn((prev) => ({ ...prev, [opt.field]: !prev[opt.field] }))}
                    style={styles.checkRow}
                  >
                    <Ionicons
                      name={on ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={on ? colors.brandMagenta : colors.textMuted}
                    />
                    <Text style={styles.checkLabel}>{opt.label}</Text>
                  </Pressable>
                  {on ? (
                    <TextInput
                      value={intervNotes[opt.field] || ''}
                      onChangeText={(t) => setIntervNotes((prev) => ({ ...prev, [opt.field]: t }))}
                      multiline
                      style={styles.notes}
                      placeholder="Intervention notes…"
                      placeholderTextColor={colors.textMuted}
                    />
                  ) : null}
                </View>
              );
            })}

            <Text style={[styles.label, styles.sectionLabel]}>Select goal(s)</Text>
            {selected.goals.map((opt) => {
              const on = !!goalOn[opt.field];
              return (
                <View key={opt.field} style={styles.checkBlock}>
                  <Pressable
                    onPress={() => setGoalOn((prev) => ({ ...prev, [opt.field]: !prev[opt.field] }))}
                    style={styles.checkRow}
                  >
                    <Ionicons
                      name={on ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={on ? colors.brandMagenta : colors.textMuted}
                    />
                    <Text style={styles.checkLabel}>{opt.label}</Text>
                  </Pressable>
                  {on ? (
                    <TextInput
                      value={goalNotes[opt.field] || ''}
                      onChangeText={(t) => setGoalNotes((prev) => ({ ...prev, [opt.field]: t }))}
                      multiline
                      style={styles.notes}
                      placeholder="Goal notes…"
                      placeholderTextColor={colors.textMuted}
                    />
                  ) : null}
                </View>
              );
            })}
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Cancel" variant="ghost" onPress={() => navigation.goBack()} />
        <Button
          label={saving ? 'Saving…' : 'Add to Plan of Care'}
          loading={saving}
          onPress={save}
          disabled={!available.length}
        />
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    color: colors.textMuted,
    fontSize: 13,
  },
  content: { paddingHorizontal: 14, paddingBottom: 120, gap: 6 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginTop: 8, marginBottom: 4 },
  sectionLabel: {
    marginTop: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#0f766e',
    paddingLeft: 8,
  },
  group: { marginBottom: 8 },
  groupTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
    marginTop: 6,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    marginBottom: 4,
  },
  optionOn: { backgroundColor: '#E8F1FF' },
  optionText: { flex: 1, fontSize: 13, color: colors.text },
  optionTextOn: { fontWeight: '700', color: '#1e3a5f' },
  empty: { color: colors.textMuted, fontSize: 13, paddingVertical: 12 },
  textarea: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 10,
    fontSize: 13,
    color: colors.text,
    backgroundColor: '#fff',
    textAlignVertical: 'top',
  },
  checkBlock: { marginBottom: 6 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  checkLabel: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  notes: {
    marginLeft: 30,
    minHeight: 64,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 8,
    fontSize: 12,
    color: colors.text,
    backgroundColor: '#fff',
    textAlignVertical: 'top',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
