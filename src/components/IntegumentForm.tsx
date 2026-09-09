import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VoiceInputButton } from './VoiceInputButton';
import { colors } from '../theme/colors';
import type { WoundButtonState } from '../api/staff';
import { showAlert } from '../utils/confirm';

export type IntegumentState = {
  selected: Record<string, boolean>;
  optionNotes: Record<string, string>;
  ivTypes: Record<string, boolean>;
  ivTypeOther: string;
  ivLocation: string;
  ivSiteCondition: Record<string, boolean>;
  ivDressing: Record<string, boolean>;
  ivDressingOther: string;
  ivLastDressingDate: string;
  ivPhysicianNotified: boolean;
  ivClinicalManagerNotified: boolean;
  comments: string;
};

export function emptyIntegument(): IntegumentState {
  return {
    selected: {},
    optionNotes: {},
    ivTypes: {},
    ivTypeOther: '',
    ivLocation: '',
    ivSiteCondition: {},
    ivDressing: {},
    ivDressingOther: '',
    ivLastDressingDate: '',
    ivPhysicianNotified: false,
    ivClinicalManagerNotified: false,
    comments: '',
  };
}

const SIMPLE: Array<{ id: string; label: string }> = [
  { id: 'integumentary_no_problems', label: 'No Problems Identified' },
  { id: 'bruising', label: 'Bruising' },
  { id: 'skin_cool', label: 'Cool' },
  { id: 'skin_cyanotic', label: 'Cyanotic' },
  { id: 'skin_dry', label: 'Dry' },
  { id: 'skin_clammy', label: 'Clammy' },
  { id: 'skin_diaphoretic', label: 'Diaphoretic' },
  { id: 'skin_flushed', label: 'Flushed' },
  { id: 'skin_incision', label: 'Incision' },
  { id: 'skin_jaundice', label: 'Jaundice' },
  { id: 'skin_pallor', label: 'Pallor' },
  { id: 'skin_poor_turgor', label: 'Poor turgor' },
  { id: 'skin_pruritus', label: 'Pruritus' },
  { id: 'skin_rash', label: 'Rash' },
];

const LESION_OPTS = [
  'Pressure ulcer - sacrum',
  'Pressure ulcer - heel',
  'Pressure ulcer - hip',
  'Venous stasis ulcer',
  'Arterial ulcer',
  'Diabetic ulcer',
  'Skin tear',
  'Surgical wound',
];

const WOUND_OPTS = [
  'Stage 1',
  'Stage 2',
  'Stage 3',
  'Stage 4',
  'Unstageable',
  'Deep tissue injury',
  'Clean',
  'Infected',
  'Healing well',
];

const IV_TYPES = ['Med-A-Port', 'PICC Line', 'Port-A-Cath', 'Saline Lock', 'Other'];

const IV_LOCATIONS = [
  'Left antecubital',
  'Left forearm',
  'Left hand',
  'Left wrist',
  'Left upper arm',
  'Right antecubital',
  'Right forearm',
  'Right hand',
  'Right wrist',
  'Right upper arm',
  'Left PICC — upper arm',
  'Right PICC — upper arm',
  'Left subclavian',
  'Right subclavian',
  'Left internal jugular',
  'Right internal jugular',
  'Femoral',
  'Left chest port',
  'Right chest port',
  'Abdominal port',
  'Other',
];

const IV_SITE = [
  'No complications',
  'Redness/Erythema',
  'Swelling/Edema',
  'Tenderness/Pain',
  'Drainage/Exudate',
  'Phlebitis',
  'Infiltration',
];

const IV_DRESSING = ['Clean, dry & intact', 'Bloody', 'Soiled', 'Other'];

type Props = {
  value: IntegumentState;
  onChange: (next: IntegumentState) => void;
  patientId?: number;
  woundButtonState?: WoundButtonState;
  onOpenWoundManager?: () => void;
};

function OptionSelect({
  placeholder,
  options,
  onSelect,
}: {
  placeholder: string;
  options: string[];
  onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.select}>
        <Text style={styles.selectPlaceholder}>{placeholder}</Text>
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
              style={styles.selectOption}
            >
              <Text style={styles.selectOptionText}>{opt}</Text>
            </Pressable>
          ))
        : null}
    </View>
  );
}

function CheckRow({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.optionRow, on && styles.optionRowOn]}>
      <Ionicons
        name={on ? 'checkbox' : 'square-outline'}
        size={20}
        color={on ? colors.brandMagenta : colors.textMuted}
      />
      <Text style={[styles.optionLabel, on && styles.optionLabelOn]}>{label}</Text>
    </Pressable>
  );
}

export function IntegumentForm({
  value,
  onChange,
  patientId,
  woundButtonState = 'na',
  onOpenWoundManager,
}: Props) {
  const [locOpen, setLocOpen] = useState(false);
  const set = (patch: Partial<IntegumentState>) => onChange({ ...value, ...patch });

  const toggle = (id: string) => {
    const next = { ...value.selected, [id]: !value.selected[id] };
    const notes = { ...value.optionNotes };
    if (!next[id]) delete notes[id];
    set({ selected: next, optionNotes: notes });
  };

  const appendNotes = (id: string, v: string) => {
    if (!v) return;
    const cur = (value.optionNotes[id] || '').trim();
    set({ optionNotes: { ...value.optionNotes, [id]: cur ? `${cur}, ${v}` : v } });
  };

  const toggleMap = (
    key: 'ivTypes' | 'ivSiteCondition' | 'ivDressing',
    item: string,
  ) => {
    const map = { ...value[key], [item]: !value[key][item] };
    set({ [key]: map } as Partial<IntegumentState>);
  };

  const openWoundLog = () => {
    if (onOpenWoundManager) {
      onOpenWoundManager();
      return;
    }
    showAlert(
      'Wound Management',
      patientId
        ? `Open Wound Management on the web chart for patient #${patientId}.`
        : 'Open Wound Management on the web chart.',
    );
  };

  const woundBtnStyle =
    woundButtonState === 'complete'
      ? styles.woundBtnComplete
      : woundButtonState === 'needs_documentation'
        ? styles.woundBtnNeeds
        : styles.woundBtnNa;
  const woundBtnTextStyle =
    woundButtonState === 'complete'
      ? styles.woundBtnTextOn
      : woundButtonState === 'needs_documentation'
        ? styles.woundBtnTextOn
        : styles.woundBtnText;
  const woundIconColor =
    woundButtonState === 'na' ? '#475569' : '#fff';

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={openWoundLog}
        style={({ pressed }) => [styles.woundBtn, woundBtnStyle, pressed && { opacity: 0.9 }]}
      >
        <Ionicons name="medkit-outline" size={16} color={woundIconColor} />
        <Text style={woundBtnTextStyle}>Wound Management</Text>
      </Pressable>

      {SIMPLE.map((o) => (
        <CheckRow
          key={o.id}
          label={o.label}
          on={!!value.selected[o.id]}
          onPress={() => toggle(o.id)}
        />
      ))}

      <CheckRow
        label="Skin lesion requiring intervention"
        on={!!value.selected.skin_lesion}
        onPress={() => toggle('skin_lesion')}
      />
      {value.selected.skin_lesion ? (
        <View style={styles.detail}>
          <OptionSelect
            placeholder="Select type/location..."
            options={LESION_OPTS}
            onSelect={(v) => appendNotes('skin_lesion', v)}
          />
          <TextInput
            value={value.optionNotes.skin_lesion || ''}
            onChangeText={(t) => set({ optionNotes: { ...value.optionNotes, skin_lesion: t } })}
            multiline
            style={styles.notes}
            placeholder="Selected options will appear here..."
            placeholderTextColor={colors.textMuted}
          />
        </View>
      ) : null}

      <CheckRow
        label="Wound(s)"
        on={!!value.selected.wounds}
        onPress={() => toggle('wounds')}
      />
      {value.selected.wounds ? (
        <View style={styles.detail}>
          <OptionSelect
            placeholder="Select type/stage..."
            options={WOUND_OPTS}
            onSelect={(v) => appendNotes('wounds', v)}
          />
          <TextInput
            value={value.optionNotes.wounds || ''}
            onChangeText={(t) => set({ optionNotes: { ...value.optionNotes, wounds: t } })}
            multiline
            style={styles.notes}
            placeholder="Selected options will appear here..."
            placeholderTextColor={colors.textMuted}
          />
        </View>
      ) : null}

      <CheckRow
        label="IV access"
        on={!!value.selected.iv_access}
        onPress={() => toggle('iv_access')}
      />
      {value.selected.iv_access ? (
        <View style={styles.ivWrap}>
          <Text style={[styles.groupTitle, { color: '#1d4ed8' }]}>Type of Access *</Text>
          {IV_TYPES.map((t) => (
            <CheckRow
              key={t}
              label={t}
              on={!!value.ivTypes[t]}
              onPress={() => toggleMap('ivTypes', t)}
            />
          ))}
          {value.ivTypes.Other ? (
            <TextInput
              value={value.ivTypeOther}
              onChangeText={(t) => set({ ivTypeOther: t })}
              placeholder="specify..."
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
          ) : null}

          <Text style={[styles.groupTitle, { color: '#15803d' }]}>IV Location *</Text>
          <Pressable onPress={() => setLocOpen((o) => !o)} style={styles.select}>
            <Text style={value.ivLocation ? styles.selectText : styles.selectPlaceholder}>
              {value.ivLocation || '— Select location —'}
            </Text>
            <Ionicons name={locOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
          </Pressable>
          {locOpen
            ? IV_LOCATIONS.map((loc) => (
                <Pressable
                  key={loc}
                  onPress={() => {
                    set({ ivLocation: loc });
                    setLocOpen(false);
                  }}
                  style={[styles.selectOption, value.ivLocation === loc && { backgroundColor: '#006bb7' }]}
                >
                  <Text style={styles.selectOptionText}>{loc}</Text>
                </Pressable>
              ))
            : null}

          <Text style={[styles.groupTitle, { color: '#c2410c' }]}>Condition of IV Site *</Text>
          <Text style={styles.hint}>Select all that apply</Text>
          {IV_SITE.map((s) => (
            <CheckRow
              key={s}
              label={s}
              on={!!value.ivSiteCondition[s]}
              onPress={() => toggleMap('ivSiteCondition', s)}
            />
          ))}

          <Text style={[styles.groupTitle, { color: '#7e22ce' }]}>Condition of Dressing *</Text>
          {IV_DRESSING.map((d) => (
            <CheckRow
              key={d}
              label={d}
              on={!!value.ivDressing[d]}
              onPress={() => toggleMap('ivDressing', d)}
            />
          ))}
          {value.ivDressing.Other ? (
            <TextInput
              value={value.ivDressingOther}
              onChangeText={(t) => set({ ivDressingOther: t })}
              placeholder="specify..."
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
          ) : null}

          <Text style={[styles.groupTitle, { color: '#0369a1' }]}>Date of Last Dressing Change *</Text>
          <TextInput
            value={value.ivLastDressingDate}
            onChangeText={(t) => set({ ivLastDressingDate: t })}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />

          <CheckRow
            label="Physician notified: s/s of infection, complications with IV site"
            on={value.ivPhysicianNotified}
            onPress={() => set({ ivPhysicianNotified: !value.ivPhysicianNotified })}
          />
          <CheckRow
            label="Clinical Manager notified: s/s of infection, complications with IV site"
            on={value.ivClinicalManagerNotified}
            onPress={() => set({ ivClinicalManagerNotified: !value.ivClinicalManagerNotified })}
          />
        </View>
      ) : null}

      <View style={styles.commentBlock}>
        <View style={styles.voiceRow}>
          <Text style={styles.commentLabel}>Comments</Text>
          <VoiceInputButton value={value.comments} onChange={(t) => set({ comments: t })} />
        </View>
        <TextInput
          value={value.comments}
          onChangeText={(t) => set({ comments: t })}
          multiline
          style={styles.notes}
          placeholder="Integument comments..."
          placeholderTextColor={colors.textMuted}
        />
      </View>
    </View>
  );
}

export function integumentCount(v: IntegumentState): number {
  return Object.values(v.selected).filter(Boolean).length + (v.comments.trim() ? 1 : 0);
}

export function integumentToFormData(v: IntegumentState): Record<string, unknown> {
  const form: Record<string, unknown> = {};
  Object.entries(v.selected).forEach(([k, on]) => {
    if (on) form[k] = '1';
  });
  Object.entries(v.optionNotes).forEach(([k, notes]) => {
    if (notes.trim()) form[`${k}_notes`] = notes.trim();
  });
  if (v.selected.iv_access) {
    form.iv_type_access = Object.keys(v.ivTypes).filter((k) => v.ivTypes[k]);
    if (v.ivTypeOther.trim()) form.iv_type_access_other = v.ivTypeOther.trim();
    if (v.ivLocation) form.iv_location = v.ivLocation;
    form.iv_site_condition = Object.keys(v.ivSiteCondition).filter((k) => v.ivSiteCondition[k]);
    form.iv_dressing_condition = Object.keys(v.ivDressing).filter((k) => v.ivDressing[k]);
    if (v.ivDressingOther.trim()) form.iv_dressing_condition_other = v.ivDressingOther.trim();
    if (v.ivLastDressingDate.trim()) form.iv_last_dressing_date = v.ivLastDressingDate.trim();
    if (v.ivPhysicianNotified) form.iv_physician_notified = '1';
    if (v.ivClinicalManagerNotified) form.iv_clinical_manager_notified = '1';
  }
  if (v.comments.trim()) form.integument_comments = v.comments.trim();
  return form;
}

export function integumentToNoteLines(v: IntegumentState): string[] {
  const lines: string[] = [];
  const labels: Record<string, string> = Object.fromEntries([
    ...SIMPLE.map((s) => [s.id, s.label]),
    ['skin_lesion', 'Skin lesion requiring intervention'],
    ['wounds', 'Wound(s)'],
    ['iv_access', 'IV access'],
  ]);
  Object.entries(v.selected).forEach(([id, on]) => {
    if (!on) return;
    const notes = (v.optionNotes[id] || '').trim();
    lines.push(notes ? `- ${labels[id] || id}: ${notes}` : `- ${labels[id] || id}`);
  });
  if (v.selected.iv_access) {
    const types = Object.keys(v.ivTypes).filter((k) => v.ivTypes[k]);
    if (types.length) lines.push(`  Type: ${types.join(', ')}${v.ivTypeOther ? ` (${v.ivTypeOther})` : ''}`);
    if (v.ivLocation) lines.push(`  Location: ${v.ivLocation}`);
    const site = Object.keys(v.ivSiteCondition).filter((k) => v.ivSiteCondition[k]);
    if (site.length) lines.push(`  Site: ${site.join(', ')}`);
    const dress = Object.keys(v.ivDressing).filter((k) => v.ivDressing[k]);
    if (dress.length) lines.push(`  Dressing: ${dress.join(', ')}`);
    if (v.ivLastDressingDate) lines.push(`  Last dressing change: ${v.ivLastDressingDate}`);
  }
  if (v.comments.trim()) lines.push(`Comments: ${v.comments.trim()}`);
  return lines;
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  woundBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 4,
  },
  woundBtnNa: { backgroundColor: '#1E3A8A' },
  woundBtnNeeds: { backgroundColor: '#0D9488' },
  woundBtnComplete: { backgroundColor: '#16A34A' },
  woundBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  woundBtnTextOn: { color: '#fff', fontWeight: '700', fontSize: 12 },
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
  detail: {
    marginLeft: 8,
    marginBottom: 4,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
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
  selectOption: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#1e293b',
    marginTop: 4,
  },
  selectOptionText: { color: '#fff', fontSize: 13 },
  notes: {
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
  ivWrap: { gap: 6, marginLeft: 4, marginBottom: 4 },
  groupTitle: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 2,
  },
  hint: { fontSize: 11, color: colors.textMuted, marginBottom: 2 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
    backgroundColor: '#fff',
  },
  commentBlock: { gap: 6, marginTop: 8 },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  commentLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
});
