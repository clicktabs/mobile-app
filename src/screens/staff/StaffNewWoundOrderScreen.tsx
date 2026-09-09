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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, AppShell } from '../../components/chrome';
import { AnatomicalBodyMap, pinFromRegionId, type BodyMapPin } from '../../components/AnatomicalBodyMap';
import { SignaturePad } from '../../components/SignaturePad';
import { VoiceInputButton } from '../../components/VoiceInputButton';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';
import type { StaffScheduleStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { showAlert } from '../../utils/confirm';

/** New Wound Order — uses AnatomicalBodyMap (no BODY_SITES). */
type Props = NativeStackScreenProps<StaffScheduleStackParamList, 'NewWoundOrder'>;

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

export function StaffNewWoundOrderScreen({ navigation, route }: Props) {
  const { token, staffUser } = useAuth();
  const { patientId, patientName, patientMrn } = route.params;

  const [pin, setPin] = useState<BodyMapPin>(() => pinFromRegionId('back_sacrum'));
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

  const woundIdPreview = useMemo(() => {
    const loc = (pin.label || 'LOC').replace(/\s+/g, '').slice(0, 6).toUpperCase();
    return `W-${patientId}-${loc}`;
  }, [patientId, pin.label]);

  const toggleMulti = (list: string[], item: string, set: (v: string[]) => void) => {
    set(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  };

  const buildSupplies = () =>
    [
      primary.length ? `Primary: ${primary.join(', ')}` : '',
      topicals.length ? `Topicals/securement: ${topicals.join(', ')}` : '',
      dressingFreq ? `Dressing change: ${dressingFreq}` : '',
    ]
      .filter(Boolean)
      .join('\n');

  const buildInstructions = () =>
    [
      instructions.trim(),
      duration ? `Duration: ${duration}` : '',
      orderFreq ? `Frequency: ${orderFreq}` : '',
      tunneling.trim() ? `Tunneling/undermining (clock): ${tunneling.trim()}` : '',
      `Body map: ${pin.label} (${pin.x.toFixed(1)}%, ${pin.y.toFixed(1)}%)`,
      signaturePath ? `Electronically signed by ${signerName || 'clinician'}` : '',
    ]
      .filter(Boolean)
      .join('\n');

  const validate = (requireSign: boolean) => {
    if (!pin.label) {
      showAlert('Location required', 'Tap the body map to drop a pin.');
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
        wound_location: pin.label || 'Unspecified',
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
        treatment_notes: JSON.stringify({
          signature_path: signaturePath,
          signed_by: signerName.trim(),
          signed_at: signed ? new Date().toISOString() : null,
          wound_id_preview: woundIdPreview,
          primary_dressings: primary,
          topicals,
          dressing_frequency: dressingFreq,
          duration,
          map_x: pin.x,
          map_y: pin.y,
          map_region: pin.regionId,
        }),
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
        <Text style={styles.hint}>
          Tap the anatomical map to drop a green pin. Wound ID auto-assigns from the location.
        </Text>
        <AnatomicalBodyMap
          activePin={pin}
          editable
          defaultRegionId="back_sacrum"
          height={340}
          showHint={false}
          onPinChange={setPin}
        />
        <Text style={styles.locPreview}>
          {woundIdPreview} · {stage} at {pin.label}
        </Text>

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
            <Text style={styles.reviewLine}>Location: {pin.label || '—'}</Text>
            <Text style={styles.reviewLine}>Stage: {stage}</Text>
            <Text style={styles.reviewLine}>
              Size: {length} × {width} × {depth} cm
            </Text>
            <Text style={styles.reviewLine}>Primary: {primary.join(', ') || '—'}</Text>
            <Text style={styles.reviewLine}>Topicals: {topicals.join(', ') || '—'}</Text>
            <Text style={styles.reviewLine}>
              Frequency: {orderFreq} · Duration: {duration}
            </Text>
            <Text style={styles.reviewLine}>Instructions: {instructions || '—'}</Text>
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
  section: { marginTop: 10, fontSize: 16, fontWeight: '800', color: colors.ink },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  locPreview: {
    color: '#166534',
    fontWeight: '700',
    fontSize: 13,
    backgroundColor: '#F0FDF4',
    padding: 10,
    borderRadius: 8,
  },
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
