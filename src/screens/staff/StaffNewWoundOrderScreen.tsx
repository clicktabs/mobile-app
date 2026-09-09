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
import Svg, { Circle, Ellipse, Path, Text as SvgText } from 'react-native-svg';
import { AppHeader, AppShell } from '../../components/chrome';
import { SignaturePad } from '../../components/SignaturePad';
import { VoiceInputButton } from '../../components/VoiceInputButton';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';
import type { StaffScheduleStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { showAlert } from '../../utils/confirm';

type Props = NativeStackScreenProps<StaffScheduleStackParamList, 'NewWoundOrder'>;

type BodySite = {
  id: string;
  label: string;
  view: 'front' | 'back';
  cx: number;
  cy: number;
};

const BODY_SITES: BodySite[] = [
  { id: 'face', label: 'Face', view: 'front', cx: 70, cy: 28 },
  { id: 'chest', label: 'Chest', view: 'front', cx: 70, cy: 78 },
  { id: 'abdomen', label: 'Abdomen', view: 'front', cx: 70, cy: 112 },
  { id: 'r_hip_f', label: 'Right hip', view: 'front', cx: 48, cy: 138 },
  { id: 'l_hip_f', label: 'Left hip', view: 'front', cx: 92, cy: 138 },
  { id: 'r_knee_f', label: 'Right knee', view: 'front', cx: 52, cy: 188 },
  { id: 'l_knee_f', label: 'Left knee', view: 'front', cx: 88, cy: 188 },
  { id: 'r_heel_f', label: 'Right heel', view: 'front', cx: 50, cy: 238 },
  { id: 'l_heel_f', label: 'Left heel', view: 'front', cx: 90, cy: 238 },
  { id: 'occiput', label: 'Occiput', view: 'back', cx: 200, cy: 28 },
  { id: 'scapula', label: 'Scapula', view: 'back', cx: 200, cy: 78 },
  { id: 'sacrum', label: 'Sacrum', view: 'back', cx: 200, cy: 130 },
  { id: 'r_hip_b', label: 'Right hip (post.)', view: 'back', cx: 178, cy: 138 },
  { id: 'l_hip_b', label: 'Left hip (post.)', view: 'back', cx: 222, cy: 138 },
  { id: 'r_heel_b', label: 'Right heel (post.)', view: 'back', cx: 180, cy: 238 },
  { id: 'l_heel_b', label: 'Left heel (post.)', view: 'back', cx: 220, cy: 238 },
];

const STAGES = ['Stage I', 'Stage II', 'Stage III', 'Stage IV', 'Unstageable', 'DTI'];
const PRIMARY_DRESSINGS = ['Alginate', 'Foam', 'Hydrogel', 'Collagen', 'Gauze'];
const TOPICALS = [
  'Transparent Film',
  'Surgical Tape',
  'Coban Wrap',
  'Antimicrobial Ointment',
  'Enzymatic Debrider',
  'Barrier Cream',
  'Normal Saline',
];
const FREQUENCIES = ['Daily', 'Q2 Days', 'Q3 Days', 'QW'];
const DURATIONS = ['30 Days', '60 Days', 'Until Healed'];

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipOn]}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const bump = (delta: number) => {
    const next = Math.max(0, Math.round((value + delta) * 10) / 10);
    onChange(next);
  };
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <Pressable onPress={() => bump(-0.1)} style={styles.stepBtn}>
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <TextInput
          value={String(value)}
          keyboardType="decimal-pad"
          onChangeText={(t) => {
            const n = parseFloat(t);
            onChange(Number.isFinite(n) ? n : 0);
          }}
          style={styles.stepInput}
        />
        <Pressable onPress={() => bump(0.1)} style={styles.stepBtn}>
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function BodyFigure({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (site: BodySite) => void;
}) {
  const selected = BODY_SITES.find((s) => s.id === selectedId);
  return (
    <View style={styles.bodyWrap}>
      <Svg width="100%" height={280} viewBox="0 0 280 260">
        {/* Front silhouette */}
        <Ellipse cx="70" cy="28" rx="16" ry="18" fill="#E2E8F0" stroke="#94A3B8" strokeWidth={2} />
        <Path
          d="M54 48 C54 48 42 70 42 100 C42 120 48 130 52 140 L52 220 L62 220 L62 150 L70 150 L78 150 L78 220 L88 220 L88 140 C92 130 98 120 98 100 C98 70 86 48 86 48 Z"
          fill="#F1F5F9"
          stroke="#94A3B8"
          strokeWidth={2}
        />
        <SvgText x={70} y={255} textAnchor="middle" fontSize="11" fill="#64748B">
          Front
        </SvgText>
        {/* Back silhouette */}
        <Ellipse cx="200" cy="28" rx="16" ry="18" fill="#E2E8F0" stroke="#94A3B8" strokeWidth={2} />
        <Path
          d="M184 48 C184 48 172 70 172 100 C172 120 178 130 182 140 L182 220 L192 220 L192 150 L200 150 L208 150 L208 220 L218 220 L218 140 C222 130 228 120 228 100 C228 70 216 48 216 48 Z"
          fill="#F1F5F9"
          stroke="#94A3B8"
          strokeWidth={2}
        />
        <SvgText x={200} y={255} textAnchor="middle" fontSize="11" fill="#64748B">
          Back
        </SvgText>
        {BODY_SITES.map((s) => (
          <Circle
            key={s.id}
            cx={s.cx}
            cy={s.cy}
            r={selectedId === s.id ? 9 : 6}
            fill={selectedId === s.id ? '#16A34A' : '#CBD5E1'}
            stroke={selectedId === s.id ? '#166534' : '#64748B'}
            strokeWidth={1.5}
            onPress={() => onSelect(s)}
          />
        ))}
        {selected ? (
          <>
            <Circle cx={selected.cx} cy={selected.cy} r={11} fill="none" stroke="#16A34A" strokeWidth={2} />
            <Path
              d={`M ${selected.cx} ${selected.cy - 18} L ${selected.cx - 7} ${selected.cy - 6} L ${selected.cx + 7} ${selected.cy - 6} Z`}
              fill="#16A34A"
            />
          </>
        ) : null}
      </Svg>
      <View style={styles.siteGrid}>
        {BODY_SITES.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => onSelect(s)}
            style={[styles.siteChip, selectedId === s.id && styles.siteChipOn]}
          >
            <Text style={[styles.siteChipText, selectedId === s.id && styles.siteChipTextOn]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function StaffNewWoundOrderScreen({ navigation, route }: Props) {
  const { token, staffUser } = useAuth();
  const { patientId, patientName, patientMrn } = route.params;

  const [siteId, setSiteId] = useState<string | null>('sacrum');
  const [stage, setStage] = useState('Stage II');
  const [length, setLength] = useState(2.4);
  const [width, setWidth] = useState(1.8);
  const [depth, setDepth] = useState(0.5);
  const [tunneling, setTunneling] = useState('');
  const [primary, setPrimary] = useState<string[]>(['Foam']);
  const [topicals, setTopicals] = useState<string[]>(['Surgical Tape', 'Enzymatic Debrider']);
  const [dressingFreq, setDressingFreq] = useState('Q2 Days');
  const [orderFreq, setOrderFreq] = useState('Q2 Days');
  const [duration, setDuration] = useState('30 Days');
  const [instructions, setInstructions] = useState('');
  const [signaturePath, setSignaturePath] = useState<string | null>(null);
  const [signerName, setSignerName] = useState(staffUser?.name || '');
  const [saving, setSaving] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const site = useMemo(() => BODY_SITES.find((s) => s.id === siteId) || null, [siteId]);
  const woundIdPreview = useMemo(() => {
    const loc = (site?.label || 'LOC').replace(/\s+/g, '').slice(0, 6).toUpperCase();
    return `W-${patientId}-${loc}`;
  }, [patientId, site]);

  const toggleMulti = (list: string[], item: string, set: (v: string[]) => void) => {
    set(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  };

  const buildSupplies = () => {
    const parts = [
      primary.length ? `Primary: ${primary.join(', ')}` : '',
      topicals.length ? `Topicals/securement: ${topicals.join(', ')}` : '',
      dressingFreq ? `Dressing change: ${dressingFreq}` : '',
    ].filter(Boolean);
    return parts.join('\n');
  };

  const buildInstructions = () => {
    const parts = [
      instructions.trim(),
      duration ? `Duration: ${duration}` : '',
      orderFreq ? `Frequency: ${orderFreq}` : '',
      tunneling.trim() ? `Tunneling/undermining (clock): ${tunneling.trim()}` : '',
      signaturePath ? `Electronically signed by ${signerName || 'clinician'}` : '',
    ].filter(Boolean);
    return parts.join('\n');
  };

  const validate = (requireSign: boolean) => {
    if (!site) {
      showAlert('Location required', 'Drop a pin / select a body location.');
      return false;
    }
    if (!stage) {
      showAlert('Stage required', 'Select wound stage.');
      return false;
    }
    if (primary.length === 0) {
      showAlert('Dressing required', 'Select at least one primary dressing.');
      return false;
    }
    if (requireSign && !signaturePath) {
      showAlert('Signature required', 'Draw your electronic signature, then Sign & Submit.');
      return false;
    }
    if (requireSign && !signerName.trim()) {
      showAlert('Signer name', 'Enter the signing clinician name.');
      return false;
    }
    return true;
  };

  const endDateForDuration = () => {
    if (duration === 'Until Healed') return null;
    const days = duration === '60 Days' ? 60 : 30;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const submit = async (signed: boolean) => {
    if (!token) return;
    if (!validate(signed)) return;
    setSaving(true);
    try {
      await staffApi.createWoundOrder(token, patientId, {
        wound_location: site!.label,
        wound_type: 'Pressure Ulcer',
        wound_stage: stage,
        length,
        width,
        depth,
        undermining_tunneling: tunneling || undefined,
        treatment_frequency: orderFreq,
        treatment_instructions: buildInstructions(),
        supplies_needed: buildSupplies(),
        start_date: new Date().toISOString().slice(0, 10),
        end_date: endDateForDuration(),
        status: signed ? 'active' : 'draft',
        treatment_notes: signed
          ? JSON.stringify({
              signature_path: signaturePath,
              signed_by: signerName.trim(),
              signed_at: new Date().toISOString(),
              wound_id_preview: woundIdPreview,
              primary_dressings: primary,
              topicals,
              dressing_frequency: dressingFreq,
              duration,
            })
          : undefined,
        electronic_signature: signed
          ? {
              path: signaturePath,
              name: signerName.trim(),
              signed_at: new Date().toISOString(),
            }
          : undefined,
      });
      showAlert(
        signed ? 'Order signed' : 'Draft saved',
        signed
          ? 'Wound order submitted with electronic signature.'
          : 'Wound order saved as draft for review.',
      );
      navigation.goBack();
    } catch (e) {
      showAlert('Submit failed', e instanceof ApiError ? e.message : 'Unable to save wound order.');
    } finally {
      setSaving(false);
    }
  };

  const subtitle = `${patientName || 'Patient'}${patientMrn ? `, #${patientMrn}` : ''}`;

  return (
    <AppShell>
      <AppHeader
        title="New Wound Order"
        actions={[{ icon: 'arrow-back', onPress: () => navigation.goBack() }]}
      />
      <Text style={styles.subline}>{subtitle}</Text>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>Assessment</Text>
        <Text style={styles.hint}>Tap a site on the body map to drop a pin. Wound ID auto-assigns.</Text>
        <BodyFigure
          selectedId={siteId}
          onSelect={(s) => setSiteId(s.id)}
        />
        {site ? (
          <View style={styles.locCard}>
            <Ionicons name="location" size={16} color="#16A34A" />
            <Text style={styles.locText}>
              {woundIdPreview} · {stage} at {site.label}
            </Text>
          </View>
        ) : null}

        <Text style={styles.label}>Wound stage</Text>
        <View style={styles.chipRow}>
          {STAGES.map((s) => (
            <Chip key={s} label={s} selected={stage === s} onPress={() => setStage(s)} />
          ))}
        </View>

        <Text style={styles.label}>Measurements (cm)</Text>
        <View style={styles.measureRow}>
          <Stepper label="Length" value={length} onChange={setLength} />
          <Stepper label="Width" value={width} onChange={setWidth} />
          <Stepper label="Depth" value={depth} onChange={setDepth} />
        </View>

        <Text style={styles.label}>Tunneling / undermining (clock position)</Text>
        <TextInput
          value={tunneling}
          onChangeText={setTunneling}
          placeholder="e.g. Tunneling 3 cm at 7 o'clock"
          placeholderTextColor="#94A3B8"
          style={styles.input}
        />

        <Text style={styles.section}>Dressings</Text>
        <Text style={styles.label}>Primary dressing</Text>
        <View style={styles.chipRow}>
          {PRIMARY_DRESSINGS.map((d) => (
            <Chip
              key={d}
              label={d}
              selected={primary.includes(d)}
              onPress={() => toggleMulti(primary, d, setPrimary)}
            />
          ))}
        </View>
        <Text style={styles.label}>Topicals / secondary securement</Text>
        <View style={styles.chipRow}>
          {TOPICALS.map((d) => (
            <Chip
              key={d}
              label={d}
              selected={topicals.includes(d)}
              onPress={() => toggleMulti(topicals, d, setTopicals)}
            />
          ))}
        </View>
        <Text style={styles.label}>Dressing change frequency</Text>
        <View style={styles.chipRow}>
          {FREQUENCIES.map((f) => (
            <Chip key={f} label={f} selected={dressingFreq === f} onPress={() => setDressingFreq(f)} />
          ))}
        </View>

        <Text style={styles.section}>Instructions</Text>
        <Text style={styles.label}>Order frequency</Text>
        <View style={styles.chipRow}>
          {FREQUENCIES.map((f) => (
            <Chip key={f} label={f} selected={orderFreq === f} onPress={() => setOrderFreq(f)} />
          ))}
        </View>
        <Text style={styles.label}>Treatment duration</Text>
        <View style={styles.chipRow}>
          {DURATIONS.map((d) => (
            <Chip key={d} label={d} selected={duration === d} onPress={() => setDuration(d)} />
          ))}
        </View>
        <View style={styles.instrHeader}>
          <Text style={styles.label}>Special instructions</Text>
          <VoiceInputButton value={instructions} onChange={setInstructions} />
        </View>
        <TextInput
          value={instructions}
          onChangeText={setInstructions}
          multiline
          placeholder="Ensure offloading..."
          placeholderTextColor="#94A3B8"
          style={[styles.input, styles.inputMulti]}
        />

        <Text style={styles.section}>Electronic signature</Text>
        <TextInput
          value={signerName}
          onChangeText={setSignerName}
          placeholder="Signer full name"
          placeholderTextColor="#94A3B8"
          style={styles.input}
        />
        <SignaturePad onChange={setSignaturePath} />
        <Text style={styles.hint}>Draw your signature above. Required for Sign & Submit.</Text>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          disabled={saving}
          onPress={() => {
            if (!validate(false)) return;
            setReviewOpen(true);
          }}
          style={({ pressed }) => [styles.reviewBtn, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.reviewBtnText}>Review Order</Text>
        </Pressable>
        <Pressable
          disabled={saving}
          onPress={() => submit(true)}
          style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.submitBtnText}>{saving ? 'Submitting…' : 'Sign & Submit'}</Text>
        </Pressable>
      </View>

      <Modal visible={reviewOpen} animationType="slide" onRequestClose={() => setReviewOpen(false)}>
        <AppShell>
          <AppHeader
            title="Review Wound Order"
            actions={[{ icon: 'close', onPress: () => setReviewOpen(false) }]}
          />
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.reviewLine}>Wound ID: {woundIdPreview}</Text>
            <Text style={styles.reviewLine}>Location: {site?.label || '—'}</Text>
            <Text style={styles.reviewLine}>Stage: {stage}</Text>
            <Text style={styles.reviewLine}>
              Size: {length} × {width} × {depth} cm
            </Text>
            <Text style={styles.reviewLine}>Primary: {primary.join(', ') || '—'}</Text>
            <Text style={styles.reviewLine}>Topicals: {topicals.join(', ') || '—'}</Text>
            <Text style={styles.reviewLine}>
              Frequency: {orderFreq} · Duration: {duration}
            </Text>
            <Text style={styles.reviewLine}>Instructions: {instructions}</Text>
            <Text style={styles.reviewLine}>
              Signature: {signaturePath ? 'Captured' : 'Not signed yet'}
            </Text>
            <Pressable
              onPress={() => {
                setReviewOpen(false);
                submit(false);
              }}
              style={({ pressed }) => [styles.reviewBtn, { marginTop: 16 }, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.reviewBtnText}>Save Draft</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setReviewOpen(false);
                submit(true);
              }}
              style={({ pressed }) => [styles.submitBtn, { marginTop: 10 }, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.submitBtnText}>Sign & Submit</Text>
            </Pressable>
          </ScrollView>
        </AppShell>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  subline: { paddingHorizontal: 16, paddingBottom: 6, color: colors.textMuted, fontSize: 13 },
  content: { padding: 16, paddingBottom: 28, gap: 8 },
  section: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipOn: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { fontSize: 12, color: '#334155', fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  bodyWrap: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
  },
  siteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 4, paddingBottom: 8 },
  siteChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  siteChipOn: { backgroundColor: '#DCFCE7', borderColor: '#16A34A' },
  siteChipText: { fontSize: 11, color: '#475569' },
  siteChipTextOn: { color: '#166534', fontWeight: '700' },
  locCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 10,
  },
  locText: { flex: 1, color: '#166534', fontWeight: '700', fontSize: 13 },
  measureRow: { flexDirection: 'row', gap: 8 },
  stepper: { flex: 1, gap: 4 },
  stepperLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  stepBtn: {
    width: 34,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
  },
  stepBtnText: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  stepInput: {
    flex: 1,
    textAlign: 'center',
    color: colors.ink,
    fontWeight: '700',
    paddingVertical: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    color: colors.ink,
    fontSize: 14,
  },
  inputMulti: { minHeight: 88, textAlignVertical: 'top' },
  instrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  reviewBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  reviewBtnText: { color: '#2563EB', fontWeight: '800', fontSize: 14 },
  submitBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  reviewLine: { fontSize: 14, color: colors.ink, marginBottom: 6, lineHeight: 20 },
});
