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
import { AnatomicalBodyMap, type BodyMapPin } from '../../components/AnatomicalBodyMap';
import { SignaturePad } from '../../components/SignaturePad';
import { VoiceInputButton } from '../../components/VoiceInputButton';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';
import type { StaffScheduleStackParamList } from '../../navigation/types';
import { showAlert } from '../../utils/confirm';

type Props = NativeStackScreenProps<StaffScheduleStackParamList, 'NewWoundOrder'>;

type LocationRow = {
  id: string;
  pin: BodyMapPin;
  stage: string;
  length: number;
  width: number;
  depth: number;
};

const BLUE = '#2563EB';
const STAGES = ['Stage I', 'Stage II', 'Stage III', 'Stage IV', 'Unstageable', 'DTI'];
const PRIMARY = ['Alginate', 'Foam', 'Hydrogel', 'Collagen', 'Gauze'];
const SECUREMENT = ['Transparent Film', 'Surgical Tape', 'Coban Wrap'];
const TOPICALS = ['Antimicrobial Ointment', 'Enzymatic Debrider', 'Barrier Cream', 'Normal Saline'];
const FREQS = ['Daily', 'Q2 Days', 'Q3 Days', 'QW'];
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
  const bump = (d: number) => onChange(Math.max(0, Math.round((value + d) * 10) / 10));
  return (
    <View style={styles.stepper}>
      <Text style={styles.fieldLabel}>{label}</Text>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function StaffNewWoundOrderScreen({ navigation, route }: Props) {
  const { token, staffUser } = useAuth();
  const {
    patientId,
    patientName,
    patientMrn,
    cleansing,
    primaryDressing,
    secondaryDressing,
    frequency,
  } = route.params;

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [stage, setStage] = useState('Stage II');
  const [length, setLength] = useState(2.5);
  const [width, setWidth] = useState(1.8);
  const [depth, setDepth] = useState(0.5);
  const [tunneling, setTunneling] = useState('');
  const [primary, setPrimary] = useState(primaryDressing || 'Foam');
  const [securement, setSecurement] = useState(secondaryDressing || 'Surgical Tape');
  const [topical, setTopical] = useState(
    cleansing && TOPICALS.includes(cleansing) ? cleansing : 'Enzymatic Debrider',
  );
  const [dressingFreq, setDressingFreq] = useState(frequency || 'Q2 Days');
  const [orderFreq, setOrderFreq] = useState(frequency || 'Q2 Days');
  const [duration, setDuration] = useState('30 Days');
  const [instructions, setInstructions] = useState('');
  const [signaturePath, setSignaturePath] = useState<string | null>(null);
  const [signerName, setSignerName] = useState(staffUser?.name || '');
  const [saving, setSaving] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const active = useMemo(
    () => locations.find((l) => l.id === activeId) || null,
    [locations, activeId],
  );

  const patientLine = useMemo(() => {
    const name = patientName?.trim() || 'Patient';
    return patientMrn?.trim() ? `${name}, #${patientMrn.trim()}` : name;
  }, [patientName, patientMrn]);

  const woundId = useMemo(() => {
    const loc = (active?.pin.label || 'LOC').replace(/\s+/g, '').slice(0, 6).toUpperCase();
    return `W-${patientId}-${loc}`;
  }, [patientId, active?.pin.label]);

  const onPinChange = (pin: BodyMapPin) => {
    setLocations((prev) => {
      const existing = prev.find((l) => l.pin.regionId === pin.regionId);
      if (existing) {
        setActiveId(existing.id);
        return prev.map((l) =>
          l.id === existing.id
            ? { ...l, pin, stage, length, width, depth }
            : l,
        );
      }
      const id = `loc-${Date.now()}`;
      setActiveId(id);
      return [...prev, { id, pin, stage, length, width, depth }];
    });
  };

  const selectLocation = (row: LocationRow) => {
    setActiveId(row.id);
    setStage(row.stage);
    setLength(row.length);
    setWidth(row.width);
    setDepth(row.depth);
  };

  // Keep active row in sync when stage/measures change
  const syncActive = (patch: Partial<LocationRow>) => {
    if (!activeId) return;
    setLocations((prev) => prev.map((l) => (l.id === activeId ? { ...l, ...patch } : l)));
  };

  const setStageAndSync = (s: string) => {
    setStage(s);
    syncActive({ stage: s });
  };
  const setLengthAndSync = (n: number) => {
    setLength(n);
    syncActive({ length: n });
  };
  const setWidthAndSync = (n: number) => {
    setWidth(n);
    syncActive({ width: n });
  };
  const setDepthAndSync = (n: number) => {
    setDepth(n);
    syncActive({ depth: n });
  };

  const endDateForDuration = () => {
    if (duration === 'Until Healed') return null;
    const days = duration === '60 Days' ? 60 : 30;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const validate = (requireSign: boolean) => {
    if (!active?.pin.label) {
      showAlert('Location required', 'Tap the body map to drop a pin.');
      return false;
    }
    if (!stage) {
      showAlert('Stage required', 'Select wound stage.');
      return false;
    }
    if (!primary) {
      showAlert('Dressing required', 'Select a primary dressing.');
      return false;
    }
    if (requireSign && !signaturePath) {
      showAlert('Signature required', 'Draw your signature, then Sign & Submit.');
      return false;
    }
    if (requireSign && !signerName.trim()) {
      showAlert('Signer name', 'Enter the signing clinician name.');
      return false;
    }
    return true;
  };

  const submit = async (signed: boolean) => {
    if (!token || !validate(signed)) return;
    setSaving(true);
    try {
      const supplies = [
        `Primary: ${primary}`,
        securement ? `Securement: ${securement}` : '',
        topical ? `Topical/cleansing: ${topical}` : '',
        `Dressing change: ${dressingFreq}`,
      ]
        .filter(Boolean)
        .join('\n');

      const notes = [
        instructions.trim(),
        `Duration: ${duration}`,
        `Frequency: ${orderFreq}`,
        tunneling.trim() ? `Tunneling/undermining: ${tunneling.trim()}` : '',
        `Body map: ${active!.pin.label}`,
        signed ? `Electronically signed by ${signerName.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      await staffApi.createWoundOrder(token, patientId, {
        wound_location: active!.pin.label || 'Unspecified',
        wound_type: 'Pressure Ulcer',
        wound_stage: stage,
        length,
        width,
        depth,
        undermining_tunneling: tunneling || undefined,
        treatment_frequency: orderFreq,
        treatment_instructions: notes,
        supplies_needed: supplies,
        start_date: new Date().toISOString().slice(0, 10),
        end_date: endDateForDuration(),
        status: signed ? 'active' : 'draft',
        treatment_notes: JSON.stringify({
          wound_id: woundId,
          signature_path: signaturePath,
          signed_by: signerName.trim(),
          signed_at: signed ? new Date().toISOString() : null,
          primary,
          securement,
          topical,
          dressing_frequency: dressingFreq,
          duration,
          map_x: active!.pin.x,
          map_y: active!.pin.y,
          map_region: active!.pin.regionId,
          locations: locations.map((l) => ({
            label: l.pin.label,
            stage: l.stage,
            regionId: l.pin.regionId,
            map_x: l.pin.x,
            map_y: l.pin.y,
          })),
        }),
        electronic_signature: signed
          ? { path: signaturePath, name: signerName.trim(), signed_at: new Date().toISOString() }
          : undefined,
      });

      // Also create wound care record with map pin for Wound Manager
      try {
        await staffApi.createWoundCare(token, patientId, {
          location: active!.pin.label || 'Unspecified',
          wound_type: 'Pressure Ulcer',
          stage_grade: stage,
          onset_date: new Date().toISOString().slice(0, 10),
          present_on_admission: true,
          treatment_performed: supplies,
          notes,
          map_x: active!.pin.x,
          map_y: active!.pin.y,
          map_region: active!.pin.regionId,
        });
      } catch {
        /* order still saved */
      }

      showAlert(
        signed ? 'Order signed' : 'Draft saved',
        signed ? 'Wound order submitted.' : 'Saved as draft.',
      );
      navigation.goBack();
    } catch (e) {
      showAlert('Submit failed', e instanceof ApiError ? e.message : 'Unable to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <AppHeader
        title="New Wound Order"
        showLogo={false}
        actions={[{ icon: 'arrow-back', onPress: () => navigation.goBack() }]}
      />
      <Text style={styles.patientSub}>{patientLine}</Text>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Section title="Section 1: Assessment">
          <AnatomicalBodyMap
            activePin={active?.pin || null}
            editable
            height={300}
            showHint={false}
            showLocationLabel={false}
            onPinChange={onPinChange}
          />
          <Text style={styles.quietHint}>Tap body map to drop pin · Wound ID auto-assigns</Text>
          {active ? <Text style={styles.woundId}>{woundId}</Text> : null}

          <Text style={styles.fieldLabel}>Stage</Text>
          <View style={styles.chipRow}>
            {STAGES.map((s) => (
              <Chip key={s} label={s} selected={stage === s} onPress={() => setStageAndSync(s)} />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Measurements (cm)</Text>
          <View style={styles.measureRow}>
            <Stepper label="Length (cm)" value={length} onChange={setLengthAndSync} />
            <Stepper label="Width (cm)" value={width} onChange={setWidthAndSync} />
            <Stepper label="Depth (cm)" value={depth} onChange={setDepthAndSync} />
          </View>

          <Text style={styles.fieldLabel}>Tunneling / undermining (clock)</Text>
          <TextInput
            value={tunneling}
            onChangeText={setTunneling}
            placeholder="e.g. 3 cm at 7 o'clock"
            placeholderTextColor="#94A3B8"
            style={styles.input}
          />

          {locations.length > 0 ? (
            <>
              <Text style={styles.fieldLabel}>Location</Text>
              <View style={styles.locList}>
                {locations.map((row) => {
                  const on = row.id === activeId;
                  return (
                    <Pressable
                      key={row.id}
                      onPress={() => selectLocation(row)}
                      style={[styles.locRow, on && styles.locRowOn]}
                    >
                      <View style={styles.stageBadge}>
                        <Text style={styles.stageBadgeText}>{row.stage}</Text>
                      </View>
                      <Ionicons name="body-outline" size={16} color="#64748B" />
                      <Text style={styles.locLabel} numberOfLines={1}>
                        {row.pin.label}
                      </Text>
                      <Ionicons
                        name={on ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={on ? BLUE : '#CBD5E1'}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
        </Section>

        <Section title="Section 2: Dressings">
          <Text style={styles.fieldLabel}>Primary dressing</Text>
          <View style={styles.chipRow}>
            {PRIMARY.map((d) => (
              <Chip key={d} label={d} selected={primary === d} onPress={() => setPrimary(d)} />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Securement</Text>
          <View style={styles.chipRow}>
            {SECUREMENT.map((d) => (
              <Chip key={d} label={d} selected={securement === d} onPress={() => setSecurement(d)} />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Topicals / cleansing</Text>
          <View style={styles.chipRow}>
            {TOPICALS.map((d) => (
              <Chip key={d} label={d} selected={topical === d} onPress={() => setTopical(d)} />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Secondary dressing frequency</Text>
          <View style={styles.chipRow}>
            {FREQS.map((f) => (
              <Chip key={f} label={f} selected={dressingFreq === f} onPress={() => setDressingFreq(f)} />
            ))}
          </View>
        </Section>

        <Section title="Section 3: Instructions">
          <Text style={styles.fieldLabel}>Frequency</Text>
          <View style={styles.chipRow}>
            {FREQS.map((f) => (
              <Chip key={f} label={f} selected={orderFreq === f} onPress={() => setOrderFreq(f)} />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Treatment duration</Text>
          <View style={styles.chipRow}>
            {DURATIONS.map((d) => (
              <Chip key={d} label={d} selected={duration === d} onPress={() => setDuration(d)} />
            ))}
          </View>

          <View style={styles.instrHead}>
            <Text style={styles.fieldLabel}>Special instructions</Text>
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
        </Section>

        <Section title="Section 4: Authentication">
          <TextInput
            value={signerName}
            onChangeText={setSignerName}
            placeholder="Signer full name"
            placeholderTextColor="#94A3B8"
            style={styles.input}
          />
          <SignaturePad onChange={setSignaturePath} height={140} />
        </Section>
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
            showLogo={false}
            actions={[{ icon: 'close', onPress: () => setReviewOpen(false) }]}
          />
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.reviewLine}>Patient: {patientLine}</Text>
            <Text style={styles.reviewLine}>Wound ID: {woundId}</Text>
            <Text style={styles.reviewLine}>Location: {active?.pin.label || '—'}</Text>
            <Text style={styles.reviewLine}>Stage: {stage}</Text>
            <Text style={styles.reviewLine}>
              Size: {length} × {width} × {depth} cm
            </Text>
            <Text style={styles.reviewLine}>
              Dressing: {primary} · {securement} · {topical}
            </Text>
            <Text style={styles.reviewLine}>
              Freq: {orderFreq} · Duration: {duration}
            </Text>
            <Text style={styles.reviewLine}>Instructions: {instructions || '—'}</Text>
            <Text style={styles.reviewLine}>
              Signature: {signaturePath ? 'Captured' : 'Not signed'}
            </Text>
            <Pressable
              onPress={() => {
                setReviewOpen(false);
                submit(false);
              }}
              style={[styles.reviewBtn, { marginTop: 16 }]}
            >
              <Text style={styles.reviewBtnText}>Save Draft</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setReviewOpen(false);
                submit(true);
              }}
              style={[styles.submitBtn, { marginTop: 10 }]}
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
  patientSub: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  content: { padding: 14, paddingBottom: 28, gap: 12 },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  quietHint: { fontSize: 11, color: '#94A3B8' },
  woundId: { fontSize: 12, fontWeight: '700', color: '#166534' },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 6,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipOn: { backgroundColor: BLUE, borderColor: BLUE },
  chipText: { fontSize: 12, color: '#334155', fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  measureRow: { flexDirection: 'row', gap: 8 },
  stepper: { flex: 1, gap: 4 },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
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
    fontWeight: '700',
    color: '#0F172A',
    paddingVertical: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    color: '#0F172A',
    fontSize: 14,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  instrHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locList: { gap: 6 },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  locRowOn: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  stageBadge: {
    backgroundColor: BLUE,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stageBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  locLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: '#0F172A' },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  reviewBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: BLUE,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  reviewBtnText: { color: BLUE, fontWeight: '800', fontSize: 14 },
  submitBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: BLUE,
  },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  reviewLine: { fontSize: 14, color: '#0F172A', marginBottom: 6, lineHeight: 20 },
});
