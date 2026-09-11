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

/** Exact labels from design image */
const BLUE = '#2563EB';
const STAGES = ['Stage I', 'Stage II', 'Stage III', 'Stage IV', 'Unstageable', 'DTI'];
const PRIMARY_DRESSINGS = [
  'Alginate',
  'Foam',
  'Hydrogel',
  'Collagen',
  'Gauze',
  'Transparent Film',
  'Surgical Tape',
  'Coban Wrap',
];
const TOPICALS = ['Antimicrobial Ointment', 'Enzymatic Debrider', 'Barrier Cream'];
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

function SegRow({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.segRow}>
      {options.map((o) => {
        const on = value === o;
        return (
          <Pressable key={o} onPress={() => onChange(o)} style={[styles.segItem, on && styles.segItemOn]}>
            <Text style={[styles.segText, on && styles.segTextOn]} numberOfLines={1}>
              {o}
            </Text>
          </Pressable>
        );
      })}
    </View>
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
        <View style={styles.stepInputWrap}>
          <TextInput
            value={String(value)}
            keyboardType="decimal-pad"
            onChangeText={(t) => {
              const cleaned = t.replace(/[^0-9.]/g, '');
              const n = parseFloat(cleaned);
              onChange(Number.isFinite(n) ? n : 0);
            }}
            style={styles.stepInput}
            maxLength={6}
          />
        </View>
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

function toggleInList(list: string[], value: string) {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
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

  const initialPrimaries = useMemo(() => {
    const seed = [primaryDressing, secondaryDressing].filter(
      (v): v is string => !!v && PRIMARY_DRESSINGS.includes(v),
    );
    return seed.length ? seed : ['Foam', 'Surgical Tape'];
  }, [primaryDressing, secondaryDressing]);

  const [step, setStep] = useState(0); // 0 → 1 → 2 (screens 1, 2, 3)
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [stage, setStage] = useState('Stage II');
  const [length, setLength] = useState(2.5);
  const [width, setWidth] = useState(1.8);
  const [depth, setDepth] = useState(0.5);
  const [primaries, setPrimaries] = useState<string[]>(initialPrimaries);
  const [topical, setTopical] = useState(
    cleansing && TOPICALS.includes(cleansing) ? cleansing : 'Enzymatic Debrider',
  );
  const [dressingFreq, setDressingFreq] = useState(frequency || 'Q2 Days');
  const [orderFreq, setOrderFreq] = useState(frequency || 'Q2 Days');
  const [duration, setDuration] = useState('30 Days');
  const [instructions, setInstructions] = useState('Ensure offloading');
  const [signaturePath, setSignaturePath] = useState<string | null>(null);
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

  const signerName = staffUser?.name || 'Clinician';

  const onPinChange = (pin: BodyMapPin) => {
    setLocations((prev) => {
      const existing = prev.find((l) => l.pin.regionId === pin.regionId);
      if (existing) {
        setActiveId(existing.id);
        return prev.map((l) =>
          l.id === existing.id ? { ...l, pin, stage, length, width, depth } : l,
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

  const removeLocation = (id: string) => {
    setLocations((prev) => {
      const next = prev.filter((l) => l.id !== id);
      if (activeId === id) {
        const first = next[0] || null;
        setActiveId(first?.id || null);
        if (first) {
          setStage(first.stage);
          setLength(first.length);
          setWidth(first.width);
          setDepth(first.depth);
        }
      }
      return next;
    });
  };

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

  const canLeaveScreen1 = () => {
    if (!active?.pin.label) {
      showAlert('Location required', 'Tap the body map to drop a pin.');
      return false;
    }
    return true;
  };

  const canLeaveScreen2 = () => {
    if (!canLeaveScreen1()) return false;
    if (primaries.length === 0) {
      showAlert('Dressing required', 'Select at least one primary dressing.');
      return false;
    }
    return true;
  };

  const goBack = () => {
    if (step > 0) setStep((s) => s - 1);
    else navigation.goBack();
  };

  /** Footer blue button: screens 1–2 advance; screen 3 submits */
  const onSignSubmitPress = () => {
    if (step === 0) {
      if (!canLeaveScreen1()) return;
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!canLeaveScreen2()) return;
      setStep(2);
      return;
    }
    submit(true);
  };

  const submit = async (signed: boolean) => {
    if (!token) return;
    if (!canLeaveScreen2()) return;
    if (signed && !signaturePath) {
      showAlert('Signature required', 'TAP TO SIGN, then Sign & Submit.');
      return;
    }
    setSaving(true);
    try {
      const supplies = [
        `Primary dressing: ${primaries.join(', ')}`,
        topical ? `Topical: ${topical}` : '',
        `Secondary dressing: ${dressingFreq}`,
      ]
        .filter(Boolean)
        .join('\n');

      const notes = [
        instructions.trim(),
        `Duration: ${duration}`,
        `Frequency: ${orderFreq}`,
        `Body map: ${active!.pin.label}`,
        signed ? `Electronically signed by ${signerName}` : '',
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
        treatment_frequency: orderFreq,
        treatment_instructions: notes,
        supplies_needed: supplies,
        start_date: new Date().toISOString().slice(0, 10),
        end_date: endDateForDuration(),
        status: signed ? 'active' : 'draft',
        treatment_notes: JSON.stringify({
          signature_path: signaturePath,
          signed_by: signerName,
          signed_at: signed ? new Date().toISOString() : null,
          primary_dressings: primaries,
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
          ? { path: signaturePath, name: signerName, signed_at: new Date().toISOString() }
          : undefined,
      });

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
        actions={[{ icon: 'arrow-back', onPress: goBack }]}
      />
      <Text style={styles.patientSub}>{patientLine}</Text>

      <ScrollView
        key={`step-${step}`}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ——— SCREEN 1 ——— */}
        {step === 0 ? (
          <Section title="Section 1: Assessment">
            <AnatomicalBodyMap
              activePin={active?.pin || null}
              editable
              height={300}
              showHint={false}
              showLocationLabel={false}
              onPinChange={onPinChange}
            />
            <View style={styles.chipRow}>
              {STAGES.map((s) => (
                <Chip key={s} label={s} selected={stage === s} onPress={() => setStageAndSync(s)} />
              ))}
            </View>
            <View style={styles.measureRow}>
              <Stepper label="Length (cm)" value={length} onChange={setLengthAndSync} />
              <Stepper label="Width (cm)" value={width} onChange={setWidthAndSync} />
              <Stepper label="Depth (cm)" value={depth} onChange={setDepthAndSync} />
            </View>
          </Section>
        ) : null}

        {/* ——— SCREEN 2 ——— */}
        {step === 1 ? (
          <>
            <Section title="Section 1: Assessment">
              <View style={styles.locList}>
                {locations.map((row) => {
                  const on = row.id === activeId;
                  return (
                    <View key={row.id} style={[styles.locRow, on && styles.locRowOn]}>
                      <Pressable
                        onPress={() => selectLocation(row)}
                        style={styles.locMain}
                      >
                        <View style={styles.stageBadge}>
                          <Text style={styles.stageBadgeText}>{row.stage}</Text>
                        </View>
                        <Ionicons name="body-outline" size={16} color="#64748B" />
                        <Text style={styles.locLabel} numberOfLines={1}>
                          {row.pin.label}
                        </Text>
                      </Pressable>
                      {on ? (
                        <Ionicons name="checkmark-circle" size={22} color={BLUE} />
                      ) : (
                        <Pressable onPress={() => removeLocation(row.id)} hitSlop={8}>
                          <Ionicons name="close" size={20} color="#94A3B8" />
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            </Section>

            <Section title="Section 2: Dressings">
              <Text style={styles.fieldLabel}>Primary Dressing</Text>
              <View style={styles.chipRow}>
                {PRIMARY_DRESSINGS.map((d) => (
                  <Chip
                    key={d}
                    label={d}
                    selected={primaries.includes(d)}
                    onPress={() => setPrimaries((prev) => toggleInList(prev, d))}
                  />
                ))}
              </View>
              <Text style={styles.fieldLabel}>Topicals</Text>
              <View style={styles.chipRow}>
                {TOPICALS.map((d) => (
                  <Chip key={d} label={d} selected={topical === d} onPress={() => setTopical(d)} />
                ))}
              </View>
            </Section>
          </>
        ) : null}

        {/* ——— SCREEN 3 ——— */}
        {step === 2 ? (
          <>
            <Section title="Section 2: Dressings">
              <Text style={styles.fieldLabel}>Secondary Dressing</Text>
              <SegRow options={FREQS} value={dressingFreq} onChange={setDressingFreq} />
            </Section>

            <Section title="Section 3: Instructions">
              <Text style={styles.fieldLabel}>Frequency</Text>
              <View style={styles.freqSelect}>
                <Text style={styles.freqSelectText}>{orderFreq}</Text>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </View>
              <SegRow options={FREQS} value={orderFreq} onChange={setOrderFreq} />

              <Text style={styles.fieldLabel}>Treatment Duration</Text>
              <SegRow options={DURATIONS} value={duration} onChange={setDuration} />

              <Text style={styles.fieldLabel}>Special Instructions</Text>
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
              <SignaturePad onChange={setSignaturePath} height={140} />
            </Section>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          disabled={saving}
          onPress={() => {
            if (step === 0 && !canLeaveScreen1()) return;
            if (step >= 1 && !canLeaveScreen2()) return;
            setReviewOpen(true);
          }}
          style={({ pressed }) => [styles.reviewBtn, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.reviewBtnText}>Review Order</Text>
        </Pressable>
        <Pressable
          disabled={saving}
          onPress={onSignSubmitPress}
          style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.submitBtnText}>
            {saving ? 'Submitting…' : 'Sign & Submit'}
          </Text>
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
            <Text style={styles.reviewLine}>Location: {active?.pin.label || '—'}</Text>
            <Text style={styles.reviewLine}>Stage: {stage}</Text>
            <Text style={styles.reviewLine}>
              Size: {length} × {width} × {depth} cm
            </Text>
            <Text style={styles.reviewLine}>Dressing: {primaries.join(', ') || '—'}</Text>
            <Text style={styles.reviewLine}>Topical: {topical}</Text>
            <Text style={styles.reviewLine}>
              Secondary: {dressingFreq} · Freq: {orderFreq} · {duration}
            </Text>
            <Text style={styles.reviewLine}>Instructions: {instructions || '—'}</Text>
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
                if (step < 2) setStep(2);
                else submit(true);
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
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
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
  stepper: { flex: 1, minWidth: 0, gap: 4 },
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
    flexShrink: 0,
    flexGrow: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
    zIndex: 1,
  },
  stepBtnText: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  stepInputWrap: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  stepInput: {
    width: '100%',
    textAlign: 'center',
    fontWeight: '700',
    color: '#0F172A',
    paddingVertical: 8,
    paddingHorizontal: 4,
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
  locMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  stageBadge: {
    backgroundColor: BLUE,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stageBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  locLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: '#0F172A' },
  segRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
  },
  segItem: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segItemOn: { backgroundColor: BLUE },
  segText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  segTextOn: { color: '#fff' },
  freqSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  freqSelectText: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
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
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  reviewBtnText: { color: '#475569', fontWeight: '800', fontSize: 14 },
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
