import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeader, AppShell } from '../../components/chrome';
import {
  AnatomicalBodyMap,
  regionByExactLabel,
  regionById,
  type BodyMapPin,
} from '../../components/AnatomicalBodyMap';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import type { WoundCareRow, WoundButtonState } from '../../api/staff';
import { ApiError } from '../../api/client';
import type { StaffScheduleStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { showAlert } from '../../utils/confirm';

type Props = NativeStackScreenProps<StaffScheduleStackParamList, 'WoundManager'>;

type TabId = 'wounds' | 'document' | 'history' | 'resources';

const WOUND_TYPES = [
  'Pressure ulcer',
  'Venous stasis ulcer',
  'Arterial ulcer',
  'Diabetic ulcer',
  'Surgical wound — primary intention',
  'Surgical wound — secondary intention',
  'Skin tear',
  'Trauma / laceration',
  'Burn',
  'Other',
];

const STAGES = [
  'Stage 1',
  'Stage 2',
  'Stage 3',
  'Stage 4',
  'Unstageable',
  'Deep tissue injury',
  'Not applicable',
];

const CARE_NOT_PERFORMED_REASONS = [
  'Care not due this visit',
  'Patient refused',
  'Wound not accessible',
  'Orders changed — pending clarification',
  'Other',
];

const DEACTIVATE_REASONS = [
  'Wound healed',
  'Wound closed',
  'Transferred / discharged',
  'Entered in error',
  'Other',
];

const TISSUE_OPTS = ['Granulation', 'Slough', 'Eschar', 'Epithelial', 'Necrotic', 'Mixed'];
const DRAINAGE_OPTS = ['None', 'Serous', 'Serosanguineous', 'Sanguineous', 'Purulent', 'Other'];
const ODOR_OPTS = ['None', 'Faint', 'Moderate', 'Foul'];
const PAIN_OPTS = ['None', 'Mild', 'Moderate', 'Severe'];
const INFECTION_OPTS = ['None noted', 'Erythema', 'Warmth', 'Induration', 'Purulent drainage', 'Fever'];

function isActive(w: WoundCareRow) {
  const s = String(w.status || 'active').toLowerCase();
  return s !== 'inactive' && s !== 'historical' && s !== 'deactivated';
}

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

export function StaffWoundManagerScreen({ navigation, route }: Props) {
  const { token } = useAuth();
  const { patientId, patientName } = route.params;
  const [tab, setTab] = useState<TabId>('wounds');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [wounds, setWounds] = useState<WoundCareRow[]>([]);
  const [buttonState, setButtonState] = useState<WoundButtonState>('na');
  const [addOpen, setAddOpen] = useState(false);
  const [docWound, setDocWound] = useState<WoundCareRow | null>(null);
  const [careNpOpen, setCareNpOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [pickReason, setPickReason] = useState('');

  const [location, setLocation] = useState('');
  const [mapPin, setMapPin] = useState<BodyMapPin | null>(null);
  const [additionalLocation, setAdditionalLocation] = useState('Not Applicable');
  const [onsetDate, setOnsetDate] = useState(new Date().toISOString().slice(0, 10));
  const [poa, setPoa] = useState<'yes' | 'no' | ''>('yes');
  const [woundType, setWoundType] = useState('');
  const [stage, setStage] = useState('');
  const [treatmentPerformed, setTreatmentPerformed] = useState('');
  const [createNotes, setCreateNotes] = useState('');

  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [depth, setDepth] = useState('');
  const [woundMeasured, setWoundMeasured] = useState<'yes' | 'no' | ''>('');
  const [tissue, setTissue] = useState('');
  const [drainage, setDrainage] = useState('');
  const [odor, setOdor] = useState('');
  const [pain, setPain] = useState('');
  const [infection, setInfection] = useState('');
  const [response, setResponse] = useState('');
  const [docNotes, setDocNotes] = useState('');
  const [docTreatment, setDocTreatment] = useState('');

  const activeWounds = useMemo(() => wounds.filter(isActive), [wounds]);
  const historyWounds = useMemo(() => wounds.filter((w) => !isActive(w)), [wounds]);

  const mapPins: BodyMapPin[] = useMemo(() => {
    // Only show pins that were actually placed (saved map coords / region) — never invent sacrum
    const placed: BodyMapPin[] = [];
    activeWounds.forEach((w) => {
      const x = w.map_x != null ? Number(w.map_x) : NaN;
      const y = w.map_y != null ? Number(w.map_y) : NaN;
      if (Number.isFinite(x) && Number.isFinite(y)) {
        placed.push({
          id: w.id,
          x,
          y,
          label: w.location,
          regionId: w.map_region || undefined,
          number: w.wound_number ?? w.id,
        });
        return;
      }
      const byRegion = regionById(w.map_region);
      const byLabel = regionByExactLabel(w.location);
      const region = byRegion || byLabel;
      if (!region) return;
      placed.push({
        id: w.id,
        x: region.x,
        y: region.y,
        label: w.location || region.label,
        regionId: region.id,
        number: w.wound_number ?? w.id,
      });
    });
    return placed;
  }, [activeWounds]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!token || !patientId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await staffApi.getWoundCare(token, patientId);
        setWounds(res.data || []);
        setButtonState(res.meta?.button_state || 'na');
      } catch (e) {
        showAlert('Wound Manager', e instanceof ApiError ? e.message : 'Unable to load wounds.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, patientId],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const resetCreate = () => {
    setMapPin(null);
    setLocation('');
    setAdditionalLocation('Not Applicable');
    setOnsetDate(new Date().toISOString().slice(0, 10));
    setPoa('yes');
    setWoundType('');
    setStage('');
    setTreatmentPerformed('');
    setCreateNotes('');
  };

  const openDocument = (w: WoundCareRow) => {
    setDocWound(w);
    setLength(w.length != null ? String(w.length) : '');
    setWidth(w.width != null ? String(w.width) : '');
    setDepth(w.depth != null ? String(w.depth) : '');
    setWoundMeasured(w.length != null || w.width != null ? 'yes' : '');
    setTissue(String(w.tissue_type || ''));
    setDrainage(String(w.drainage || ''));
    setOdor(String(w.odor || ''));
    setPain(String(w.pain || ''));
    setInfection(String(w.infection_signs || ''));
    setResponse(String(w.response_to_treatment || ''));
    setDocNotes(String(w.notes || ''));
    setDocTreatment(String(w.treatment_performed || ''));
    setTab('document');
  };

  const createWound = async () => {
    if (!token) return;
    if (!mapPin || !location) {
      showAlert('Location required', 'Tap the body map to place a wound pin first.');
      return;
    }
    if (!woundType || !poa || !onsetDate) {
      showAlert('Required fields', 'Onset date, present on admission, and wound type are required.');
      return;
    }
    setSaving(true);
    try {
      await staffApi.createWoundCare(token, patientId, {
        location,
        wound_type: woundType,
        stage_grade: stage || undefined,
        onset_date: onsetDate,
        present_on_admission: poa === 'yes',
        additional_location: additionalLocation,
        treatment_performed: treatmentPerformed,
        notes: createNotes || undefined,
        map_x: mapPin.x,
        map_y: mapPin.y,
        map_region: mapPin.regionId,
      });
      setAddOpen(false);
      resetCreate();
      setTab('document');
      await load(true);
      showAlert('Wound created', 'Document the wound assessment on the Document tab.');
    } catch (e) {
      showAlert('Create failed', e instanceof ApiError ? e.message : 'Unable to create wound.');
    } finally {
      setSaving(false);
    }
  };

  const saveDocument = async (validate: boolean) => {
    if (!token || !docWound) return;
    if (validate) {
      const missing: string[] = [];
      if (!woundMeasured) missing.push('Wound Measurement');
      if (woundMeasured === 'yes' && (!length || !width)) missing.push('Length / Width');
      if (!tissue) missing.push('Tissue type');
      if (!drainage) missing.push('Drainage');
      if (!odor) missing.push('Odor');
      if (!pain) missing.push('Pain');
      if (!infection) missing.push('Infection signs');
      if (missing.length) {
        showAlert('Validation', `Complete required fields: ${missing.join(', ')}`);
        return;
      }
    }
    setSaving(true);
    try {
      const surface =
        woundMeasured === 'yes' && length && width
          ? Number(length) * Number(width)
          : null;
      await staffApi.updateWoundCare(token, patientId, docWound.id, {
        length: woundMeasured === 'yes' && length ? Number(length) : undefined,
        width: woundMeasured === 'yes' && width ? Number(width) : undefined,
        depth: woundMeasured === 'yes' && depth ? Number(depth) : undefined,
        wound_measured: woundMeasured,
        tissue_type: tissue,
        drainage,
        odor,
        pain,
        infection_signs: infection,
        response_to_treatment: response,
        treatment_performed: docTreatment,
        notes: docNotes,
        wound_score: surface != null ? Math.round(surface * 10) / 10 : null,
        validated: validate,
        care_not_performed: false,
      });
      setDocWound(null);
      await load(true);
      showAlert(validate ? 'Validated' : 'Saved', validate ? 'Wound documentation validated.' : 'Progress saved.');
    } catch (e) {
      showAlert('Save failed', e instanceof ApiError ? e.message : 'Unable to save.');
    } finally {
      setSaving(false);
    }
  };

  const applyCareNotPerformed = async () => {
    if (!token || !docWound || !pickReason) {
      showAlert('Reason required', 'Select why care was not performed.');
      return;
    }
    setSaving(true);
    try {
      await staffApi.updateWoundCare(token, patientId, docWound.id, {
        care_not_performed: true,
        care_not_performed_reason: pickReason,
        validated: true,
      });
      setCareNpOpen(false);
      setPickReason('');
      setDocWound(null);
      await load(true);
      showAlert('Updated', 'Care not performed recorded. Validations cleared for this wound.');
    } catch (e) {
      showAlert('Update failed', e instanceof ApiError ? e.message : 'Unable to update.');
    } finally {
      setSaving(false);
    }
  };

  const applyDeactivate = async () => {
    if (!token || !docWound || !pickReason) {
      showAlert('Reason required', 'Select a deactivation reason.');
      return;
    }
    setSaving(true);
    try {
      await staffApi.updateWoundCare(token, patientId, docWound.id, {
        deactivate: true,
        deactivate_reason: pickReason,
        status: 'inactive',
      });
      setDeactivateOpen(false);
      setPickReason('');
      setDocWound(null);
      setTab('history');
      await load(true);
      showAlert('Deactivated', 'Wound moved to History.');
    } catch (e) {
      showAlert('Update failed', e instanceof ApiError ? e.message : 'Unable to deactivate.');
    } finally {
      setSaving(false);
    }
  };

  const loadPrevious = async () => {
    if (!token || !activeWounds.length) {
      showAlert('Load Previous', 'No active wounds to update.');
      return;
    }
    setSaving(true);
    try {
      for (const w of activeWounds) {
        if (w.validated || w.care_not_performed) continue;
        await staffApi.updateWoundCare(token, patientId, w.id, {
          tissue_type: w.tissue_type || undefined,
          drainage: w.drainage || undefined,
          odor: w.odor || undefined,
          pain: w.pain || undefined,
          infection_signs: w.infection_signs || undefined,
          response_to_treatment: w.response_to_treatment || undefined,
          treatment_performed: w.treatment_performed || undefined,
          notes: w.notes || undefined,
          length: w.length != null ? Number(w.length) : undefined,
          width: w.width != null ? Number(w.width) : undefined,
          depth: w.depth != null ? Number(w.depth) : undefined,
        });
      }
      await load(true);
      showAlert('Load Previous', 'Prior documentation fields were carried forward (wound score not copied).');
    } catch (e) {
      showAlert('Load failed', e instanceof ApiError ? e.message : 'Unable to load previous.');
    } finally {
      setSaving(false);
    }
  };

  const completeManager = async () => {
    const invalid = activeWounds.filter((w) => !w.validated && !w.care_not_performed);
    if (invalid.length) {
      showAlert(
        'Incomplete',
        `${invalid.length} wound(s) still need documentation. Open each wound and Validate, or mark Care Not Performed.`,
      );
      setTab('document');
      return;
    }
    navigation.goBack();
  };

  const stateHint =
    buttonState === 'complete'
      ? 'All active wounds validated'
      : buttonState === 'needs_documentation'
        ? 'Wound care documentation needed'
        : 'No active wounds';

  const tabs: Array<{ id: TabId; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { id: 'wounds', label: 'Wounds', icon: 'body-outline' },
    { id: 'document', label: 'Document', icon: 'document-text-outline' },
    { id: 'history', label: 'History', icon: 'time-outline' },
    { id: 'resources', label: 'Resources', icon: 'library-outline' },
  ];

  return (
    <AppShell>
      <AppHeader
        title="Wound Manager"
        actions={[{ icon: 'arrow-back', onPress: () => navigation.goBack() }]}
      />
      <Text style={styles.subline}>
        {patientName || 'Patient'} · {stateHint}
      </Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandMagenta} />
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          >
            {tab === 'wounds' ? (
              <View style={styles.section}>
                <AnatomicalBodyMap
                  pins={mapPins}
                  editable={false}
                  height={340}
                  showHint
                  onPinPress={(p) => {
                    const wound = activeWounds.find((w) => String(w.id) === String(p.id));
                    if (wound) openDocument(wound);
                  }}
                />

                <View style={styles.rowActions}>
                  <Pressable
                    onPress={() => {
                      resetCreate();
                      setAddOpen(true);
                    }}
                    style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
                  >
                    <Ionicons name="add-circle-outline" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>Add Wound Location</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      navigation.navigate('WoundOrderProfiles', {
                        patientId,
                        patientName,
                      })
                    }
                    style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}
                  >
                    <Ionicons name="clipboard-outline" size={16} color="#0F766E" />
                    <Text style={styles.secondaryBtnText}>Wound Orders Profile</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      navigation.navigate('NewWoundOrder', {
                        patientId,
                        patientName,
                      })
                    }
                    style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.9 }]}
                  >
                    <Ionicons name="medkit-outline" size={16} color="#1D4ED8" />
                    <Text style={styles.ghostBtnText}>Physician Order</Text>
                  </Pressable>
                </View>

                <Text style={styles.listHeading}>Active locations</Text>
                {activeWounds.length === 0 ? (
                  <Text style={styles.empty}>No wounds yet. Tap Add Wound Location.</Text>
                ) : (
                  activeWounds.map((w) => (
                    <Pressable key={w.id} onPress={() => openDocument(w)} style={styles.card}>
                      <View style={styles.cardTop}>
                        <Text style={styles.cardTitle}>
                          #{w.wound_number ?? w.id} · {w.location || 'Location'}
                        </Text>
                        <StatusPill wound={w} />
                      </View>
                      <Text style={styles.cardMeta}>
                        {[w.wound_type, w.stage].filter(Boolean).join(' · ') || 'Type / stage not set'}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            ) : null}

            {tab === 'document' ? (
              <View style={styles.section}>
                {!docWound ? (
                  <>
                    <View style={styles.rowActions}>
                      <Pressable
                        onPress={loadPrevious}
                        style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}
                      >
                        <Ionicons name="download-outline" size={16} color="#0F766E" />
                        <Text style={styles.secondaryBtnText}>Load Previous</Text>
                      </Pressable>
                      <Pressable
                        onPress={completeManager}
                        style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
                      >
                        <Ionicons name="checkmark-done-outline" size={18} color="#fff" />
                        <Text style={styles.primaryBtnText}>Complete</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.listHeading}>Active wounds</Text>
                    {activeWounds.length === 0 ? (
                      <Text style={styles.empty}>No active wounds to document.</Text>
                    ) : (
                      activeWounds.map((w) => (
                        <Pressable key={w.id} onPress={() => openDocument(w)} style={styles.card}>
                          <View style={styles.cardTop}>
                            <Text style={styles.cardTitle}>
                              #{w.wound_number ?? w.id} · {w.location}
                            </Text>
                            <StatusPill wound={w} />
                          </View>
                          <Text style={styles.cardMeta}>
                            {w.care_not_performed
                              ? `Care not performed: ${w.care_not_performed_reason || '—'}`
                              : w.treatment_performed || w.wound_type || 'Tap to document'}
                          </Text>
                        </Pressable>
                      ))
                    )}
                  </>
                ) : (
                  <View style={styles.docPanel}>
                    <View style={styles.cardTop}>
                      <Text style={styles.docTitle}>
                        Wound #{docWound.wound_number ?? docWound.id} — {docWound.location}
                      </Text>
                      <Pressable onPress={() => setDocWound(null)}>
                        <Text style={styles.link}>Back to list</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.hint}>
                      Tip: Measure at least weekly. Surface area (L × W) feeds the wound score when measurement is Yes.
                    </Text>

                    <Text style={styles.label}>Wound Measurement</Text>
                    <View style={styles.chipRow}>
                      {(['yes', 'no'] as const).map((v) => (
                        <Chip key={v} label={v === 'yes' ? 'Yes' : 'No'} selected={woundMeasured === v} onPress={() => setWoundMeasured(v)} />
                      ))}
                    </View>
                    {woundMeasured === 'yes' ? (
                      <View style={styles.measureRow}>
                        <Field label="Length (cm)" value={length} onChangeText={setLength} />
                        <Field label="Width (cm)" value={width} onChangeText={setWidth} />
                        <Field label="Depth (cm)" value={depth} onChangeText={setDepth} />
                      </View>
                    ) : null}

                    <Text style={styles.label}>Tissue type</Text>
                    <View style={styles.chipRow}>
                      {TISSUE_OPTS.map((o) => (
                        <Chip key={o} label={o} selected={tissue === o} onPress={() => setTissue(o)} />
                      ))}
                    </View>
                    <Text style={styles.label}>Drainage</Text>
                    <View style={styles.chipRow}>
                      {DRAINAGE_OPTS.map((o) => (
                        <Chip key={o} label={o} selected={drainage === o} onPress={() => setDrainage(o)} />
                      ))}
                    </View>
                    <Text style={styles.label}>Odor</Text>
                    <View style={styles.chipRow}>
                      {ODOR_OPTS.map((o) => (
                        <Chip key={o} label={o} selected={odor === o} onPress={() => setOdor(o)} />
                      ))}
                    </View>
                    <Text style={styles.label}>Pain</Text>
                    <View style={styles.chipRow}>
                      {PAIN_OPTS.map((o) => (
                        <Chip key={o} label={o} selected={pain === o} onPress={() => setPain(o)} />
                      ))}
                    </View>
                    <Text style={styles.label}>Infection signs</Text>
                    <View style={styles.chipRow}>
                      {INFECTION_OPTS.map((o) => (
                        <Chip key={o} label={o} selected={infection === o} onPress={() => setInfection(o)} />
                      ))}
                    </View>

                    <Field
                      label="Treatment performed"
                      value={docTreatment}
                      onChangeText={setDocTreatment}
                      multiline
                    />
                    <Field
                      label="Response to treatment"
                      value={response}
                      onChangeText={setResponse}
                      multiline
                    />
                    <Field label="Comments" value={docNotes} onChangeText={setDocNotes} multiline />

                    <View style={styles.rowActions}>
                      <Pressable
                        disabled={saving}
                        onPress={() => saveDocument(false)}
                        style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}
                      >
                        <Text style={styles.secondaryBtnText}>Save & Continue</Text>
                      </Pressable>
                      <Pressable
                        disabled={saving}
                        onPress={() => saveDocument(true)}
                        style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
                      >
                        <Text style={styles.primaryBtnText}>{saving ? 'Saving…' : 'Validate'}</Text>
                      </Pressable>
                    </View>
                    <View style={styles.rowActions}>
                      <Pressable
                        onPress={() => {
                          setPickReason('');
                          setCareNpOpen(true);
                        }}
                        style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.9 }]}
                      >
                        <Text style={styles.ghostBtnText}>Care Not Performed</Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          navigation.navigate('WoundOrderProfiles', {
                            patientId,
                            patientName,
                          })
                        }
                        style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.9 }]}
                      >
                        <Text style={styles.ghostBtnText}>Change Wound Order</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setPickReason('');
                          setDeactivateOpen(true);
                        }}
                        style={({ pressed }) => [styles.dangerBtn, pressed && { opacity: 0.9 }]}
                      >
                        <Text style={styles.dangerBtnText}>Deactivate Wound</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            ) : null}

            {tab === 'history' ? (
              <View style={styles.section}>
                <Text style={styles.listHeading}>Inactive / historical</Text>
                {historyWounds.length === 0 ? (
                  <Text style={styles.empty}>No inactive wounds yet.</Text>
                ) : (
                  historyWounds.map((w) => (
                    <View key={w.id} style={styles.card}>
                      <View style={styles.cardTop}>
                        <Text style={styles.cardTitle}>
                          #{w.wound_number ?? w.id} · {w.location}
                        </Text>
                        <View style={[styles.pill, styles.pillMuted]}>
                          <Text style={styles.pillText}>Inactive</Text>
                        </View>
                      </View>
                      <Text style={styles.cardMeta}>
                        {[w.wound_type, w.stage, w.updated_at].filter(Boolean).join(' · ')}
                      </Text>
                      <Pressable
                        onPress={() =>
                          showAlert(
                            'Wound Flowsheet',
                            `Visit-by-visit measurements and assessments for wound #${w.wound_number ?? w.id} will appear here as documentation accumulates.`,
                          )
                        }
                      >
                        <Text style={styles.link}>View flowsheet</Text>
                      </Pressable>
                    </View>
                  ))
                )}
                <Text style={[styles.listHeading, { marginTop: 16 }]}>All wounds</Text>
                {wounds.map((w) => (
                  <View key={`all-${w.id}`} style={styles.card}>
                    <Text style={styles.cardTitle}>
                      #{w.wound_number ?? w.id} · {w.location} ({w.status || 'active'})
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {tab === 'resources' ? (
              <View style={styles.section}>
                <Text style={styles.listHeading}>Training resources</Text>
                <ResourceRow
                  title="Watch — Mobile Wound Manager"
                  subtitle="Video tutorials for documenting and tracking wounds"
                  onPress={() => Linking.openURL('https://www.axxess.com/help/agencycore/mobile-and-evv/')}
                />
                <ResourceRow
                  title="Learn More"
                  subtitle="Axxess Mobile Wound Manager help article"
                  onPress={() => Linking.openURL('https://www.axxess.com/help/agencycore/mobile-and-evv/')}
                />
                <ResourceRow
                  title="Toolbox"
                  subtitle="Wound assessment skills and wound vac training library"
                  onPress={() =>
                    showAlert(
                      'Toolbox',
                      'Use agency clinical education resources for wound staging (WOCN), skin tear classification, and wound vac competencies.',
                    )
                  }
                />
                <Text style={styles.hint}>
                  Wound Manager validates documentation for consistency. Complete wounds the day of the visit so orders and assessments flow to subsequent visits.
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.tabBar}>
            {tabs.map((t) => {
              const on = tab === t.id;
              return (
                <Pressable key={t.id} onPress={() => setTab(t.id)} style={styles.tabItem}>
                  <Ionicons name={t.icon} size={20} color={on ? colors.brandMagenta : colors.textMuted} />
                  <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <Modal visible={addOpen} animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <AppShell>
          <AppHeader
            title="Add Wound Location"
            actions={[{ icon: 'close', onPress: () => setAddOpen(false) }]}
          />
          <Text style={styles.subline}>{patientName || 'Patient'}</Text>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.addModalContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            <ReqLabel>Drop pin on body map</ReqLabel>
            <AnatomicalBodyMap
              activePin={mapPin}
              editable
              height={300}
              showHint
              showLocationLabel={!!mapPin}
              onPinChange={(p) => {
                setMapPin(p);
                setLocation(p.label || '');
              }}
            />

            <Field
              label="Additional location description"
              required
              value={additionalLocation}
              onChangeText={setAdditionalLocation}
              placeholder="Not Applicable"
            />
            <Field
              label="Onset date (YYYY-MM-DD)"
              required
              value={onsetDate}
              onChangeText={setOnsetDate}
              placeholder="YYYY-MM-DD"
            />

            <ReqLabel>Present on admission</ReqLabel>
            <View style={styles.yesNoRow}>
              <Pressable
                onPress={() => setPoa('yes')}
                style={[styles.yesNoBtn, poa === 'yes' && styles.yesNoBtnOn]}
              >
                <Text style={[styles.yesNoText, poa === 'yes' && styles.yesNoTextOn]}>Yes</Text>
              </Pressable>
              <Pressable
                onPress={() => setPoa('no')}
                style={[styles.yesNoBtn, poa === 'no' && styles.yesNoBtnOn]}
              >
                <Text style={[styles.yesNoText, poa === 'no' && styles.yesNoTextOn]}>No</Text>
              </Pressable>
            </View>

            <ReqLabel>Wound type / tissue injury level</ReqLabel>
            <View style={styles.chipRow}>
              {WOUND_TYPES.map((o) => (
                <Chip key={o} label={o} selected={woundType === o} onPress={() => setWoundType(o)} />
              ))}
            </View>

            <Text style={styles.addLabel}>Stage / grade</Text>
            <View style={styles.chipRow}>
              {STAGES.map((o) => (
                <Chip key={o} label={o} selected={stage === o} onPress={() => setStage(o)} />
              ))}
            </View>

            <Field
              label="Treatment performed"
              value={treatmentPerformed}
              onChangeText={setTreatmentPerformed}
              multiline
              placeholder="Clear asterisks from associated order text and document what was performed"
            />
            <Field label="Notes" value={createNotes} onChangeText={setCreateNotes} multiline />
          </ScrollView>

          <View style={styles.createFooter}>
            <Pressable disabled={saving} onPress={createWound}>
              {({ pressed }) => (
                <LinearGradient
                  colors={[...colors.brandGradient]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.createWoundBtn, pressed && { opacity: 0.92 }]}
                >
                  <Text style={styles.createWoundBtnText}>
                    {saving ? 'Creating…' : 'Create Wound'}
                  </Text>
                </LinearGradient>
              )}
            </Pressable>
          </View>
        </AppShell>
      </Modal>

      <ReasonModal
        visible={careNpOpen}
        title="Care Not Performed"
        options={CARE_NOT_PERFORMED_REASONS}
        value={pickReason}
        onChange={setPickReason}
        onCancel={() => setCareNpOpen(false)}
        onConfirm={applyCareNotPerformed}
        saving={saving}
      />
      <ReasonModal
        visible={deactivateOpen}
        title="Deactivate Wound"
        options={DEACTIVATE_REASONS}
        value={pickReason}
        onChange={setPickReason}
        onCancel={() => setDeactivateOpen(false)}
        onConfirm={applyDeactivate}
        saving={saving}
      />
    </AppShell>
  );
}

function StatusPill({ wound }: { wound: WoundCareRow }) {
  if (wound.care_not_performed) {
    return (
      <View style={[styles.pill, styles.pillTeal]}>
        <Text style={styles.pillText}>Care N/P</Text>
      </View>
    );
  }
  if (wound.validated) {
    return (
      <View style={[styles.pill, styles.pillGreen]}>
        <Text style={styles.pillText}>Valid</Text>
      </View>
    );
  }
  return (
    <View style={[styles.pill, styles.pillWarn]}>
      <Text style={styles.pillText}>Invalid</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  multiline?: boolean;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.addLabel}>
        {label}
        {required ? <Text style={styles.reqStar}> *</Text> : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMulti]}
      />
    </View>
  );
}

function ReqLabel({ children }: { children: string }) {
  return (
    <Text style={styles.addLabel}>
      {children}
      <Text style={styles.reqStar}> *</Text>
    </Text>
  );
}

function ResourceRow({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardMeta}>{subtitle}</Text>
    </Pressable>
  );
}

function ReasonModal({
  visible,
  title,
  options,
  value,
  onChange,
  onCancel,
  onConfirm,
  saving,
}: {
  visible: boolean;
  title: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  saving: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.docTitle}>{title}</Text>
          <View style={styles.chipRow}>
            {options.map((o) => (
              <Chip key={o} label={o} selected={value === o} onPress={() => onChange(o)} />
            ))}
          </View>
          <View style={styles.rowActions}>
            <Pressable onPress={onCancel} style={styles.ghostBtn}>
              <Text style={styles.ghostBtnText}>Cancel</Text>
            </Pressable>
            <Pressable disabled={saving} onPress={onConfirm} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subline: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    color: colors.textMuted,
    fontSize: 13,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  section: { gap: 10 },
  figure: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  figureTitle: { marginTop: 8, fontWeight: '700', color: colors.ink, fontSize: 16 },
  figureSub: { marginTop: 4, color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  dotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, justifyContent: 'center' },
  dot: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  dotMulti: { backgroundColor: '#7C3AED' },
  dotText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brandMagenta,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  secondaryBtnText: { color: '#0F766E', fontWeight: '700', fontSize: 13 },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  ghostBtnText: { color: '#1D4ED8', fontWeight: '700', fontSize: 13 },
  dangerBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  dangerBtnText: { color: '#B91C1C', fontWeight: '700', fontSize: 13 },
  listHeading: { fontWeight: '700', color: colors.ink, fontSize: 14, marginTop: 4 },
  empty: { color: colors.textMuted, fontSize: 13 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    gap: 4,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, fontWeight: '700', color: colors.ink, fontSize: 14 },
  cardMeta: { color: colors.textMuted, fontSize: 12 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  pillGreen: { backgroundColor: '#16A34A' },
  pillTeal: { backgroundColor: '#0D9488' },
  pillWarn: { backgroundColor: '#DC2626' },
  pillMuted: { backgroundColor: '#64748B' },
  docPanel: { gap: 8 },
  docTitle: { flex: 1, fontWeight: '700', fontSize: 15, color: colors.ink },
  link: { color: colors.brandMagenta, fontWeight: '600', fontSize: 13 },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginTop: 4 },
  addLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginTop: 6,
    marginBottom: 2,
  },
  reqStar: { color: '#DC2626', fontWeight: '800' },
  yesNoRow: { flexDirection: 'row', gap: 10 },
  yesNoBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  yesNoBtnOn: {
    backgroundColor: '#FFE4EC',
    borderColor: colors.brandMagenta,
  },
  yesNoText: { fontSize: 14, fontWeight: '600', color: colors.ink },
  yesNoTextOn: { color: colors.brandMagenta, fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipOn: { backgroundColor: '#FFE4EC', borderColor: colors.brandMagenta },
  chipText: { fontSize: 12, color: colors.text },
  chipTextOn: { fontWeight: '700', color: colors.ink },
  measureRow: { gap: 6 },
  field: { gap: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: '#fff',
    color: colors.ink,
    fontSize: 14,
  },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
    paddingBottom: 6,
    paddingTop: 6,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 2 },
  tabLabel: { fontSize: 11, color: colors.textMuted },
  tabLabelOn: { color: colors.brandMagenta, fontWeight: '700' },
  modalContent: { padding: 16, gap: 8, paddingBottom: 40 },
  addModalContent: { padding: 16, gap: 10, paddingBottom: 28 },
  createFooter: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  createWoundBtn: {
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createWoundBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    gap: 12,
  },
});
