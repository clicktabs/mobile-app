import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export type TempHrRow = { temperature: string; temp_route: string; heart_rate: string; pulse_type: string };
export type OxBpRow = { pulse_oximetry: string; ox_method: string; blood_pressure: string; bp_position: string };

export type VitalSignsState = {
  tempHrRows: TempHrRow[];
  oxBpRows: OxBpRow[];
  respirations: string;
  weight: string;
  weight_method: string;
  unable_to_collect_vitals: boolean;
  physician_notified: boolean;
  clinical_manager_notified: boolean;
  showAdditional: boolean;
  pain_level: string;
  blood_glucose: string;
  glucose_timing: string;
  height: string;
  bmi: string;
  o2_delivery_device: string;
  o2_flow_rate: string;
  capillary_refill: string;
  gcs_score: string;
  edema_additional: string;
  edema_location: string;
};

export function emptyVitalSigns(): VitalSignsState {
  return {
    tempHrRows: [{ temperature: '', temp_route: '', heart_rate: '', pulse_type: '' }],
    oxBpRows: [{ pulse_oximetry: '', ox_method: '', blood_pressure: '', bp_position: '' }],
    respirations: '',
    weight: '',
    weight_method: '',
    unable_to_collect_vitals: false,
    physician_notified: false,
    clinical_manager_notified: false,
    showAdditional: false,
    pain_level: '',
    blood_glucose: '',
    glucose_timing: '',
    height: '',
    bmi: '',
    o2_delivery_device: '',
    o2_flow_rate: '',
    capillary_refill: '',
    gcs_score: '',
    edema_additional: '',
    edema_location: '',
  };
}

const TEMP_ROUTES = ['Oral', 'Rectal', 'Axillary', 'Tympanic', 'Temporal', 'Forehead'];
const PULSE_TYPES = ['Regular', 'Irregular', 'Strong', 'Weak', 'Bounding', 'Thready'];
const WEIGHT_METHODS = ['Actual', 'Estimated', 'Bed Scale', 'Standing Scale', 'Wheelchair Scale', 'Lift Scale'];
const OX_METHODS = ['On Oxygen', 'On Room', 'Finger Probe', 'Toe Probe', 'Ear Probe', 'Forehead Sensor', 'Nasal Sensor'];
const BP_POSITIONS = ['Sitting', 'Standing', 'Lying', 'Left Arm', 'Right Arm', 'Left Leg', 'Right Leg'];
const GLUCOSE_TIMING = ['Fasting', 'Pre-meal', 'Post-meal', 'Bedtime', 'Random'];
const O2_DEVICES = ['Room Air', 'Nasal Cannula', 'Simple Mask', 'Non-rebreather Mask', 'Venturi Mask', 'CPAP', 'BiPAP', 'Ventilator'];
const CAP_REFILL = ['< 2 seconds (Normal)', '2–3 seconds (Borderline)', '> 3 seconds (Delayed)'];
const EDEMA = ['None', '1+ Trace', '2+ Mild', '3+ Moderate', '4+ Severe'];
const EDEMA_LOC = ['Bilateral ankles', 'Left ankle', 'Right ankle', 'Bilateral legs', 'Sacral', 'Generalized'];

function SelectChips({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {options.map((opt) => {
          const on = value === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(on ? '' : opt)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

function CheckRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable onPress={() => onChange(!value)} style={[styles.checkRow, value && styles.checkRowOn]}>
      <Ionicons
        name={value ? 'checkbox' : 'square-outline'}
        size={20}
        color={value ? '#1D4ED8' : colors.textMuted}
      />
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

export function VitalSignsForm({
  value,
  onChange,
}: {
  value: VitalSignsState;
  onChange: (next: VitalSignsState) => void;
}) {
  const set = (patch: Partial<VitalSignsState>) => onChange({ ...value, ...patch });

  const updateTempHr = (idx: number, patch: Partial<TempHrRow>) => {
    const rows = value.tempHrRows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    set({ tempHrRows: rows });
  };

  const updateOxBp = (idx: number, patch: Partial<OxBpRow>) => {
    const rows = value.oxBpRows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    set({ oxBpRows: rows });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>No previous vitals on record</Text>

      {value.tempHrRows.map((row, idx) => (
        <View key={`th-${idx}`} style={styles.card}>
          <InputField
            label="Temperature"
            value={row.temperature}
            onChange={(v) => updateTempHr(idx, { temperature: v })}
            placeholder="°F"
            keyboardType="decimal-pad"
          />
          <SelectChips
            label="Route"
            value={row.temp_route}
            options={TEMP_ROUTES}
            onChange={(v) => updateTempHr(idx, { temp_route: v })}
          />
          <InputField
            label="Heart Rate"
            value={row.heart_rate}
            onChange={(v) => updateTempHr(idx, { heart_rate: v })}
            placeholder="/min"
            keyboardType="numeric"
          />
          <SelectChips
            label="Pulse"
            value={row.pulse_type}
            options={PULSE_TYPES}
            onChange={(v) => updateTempHr(idx, { pulse_type: v })}
          />
        </View>
      ))}
      <Pressable
        style={styles.addBtn}
        onPress={() =>
          set({
            tempHrRows: [
              ...value.tempHrRows,
              { temperature: '', temp_route: '', heart_rate: '', pulse_type: '' },
            ],
          })
        }
      >
        <Text style={styles.addBtnText}>+ Add More (Temp / HR)</Text>
      </Pressable>

      <View style={styles.card}>
        <InputField
          label="Respirations"
          value={value.respirations}
          onChange={(v) => set({ respirations: v })}
          placeholder="/min"
          keyboardType="numeric"
        />
        <InputField
          label="Weight"
          value={value.weight}
          onChange={(v) => set({ weight: v })}
          placeholder="lbs"
          keyboardType="decimal-pad"
        />
        <SelectChips
          label="Measurement"
          value={value.weight_method}
          options={WEIGHT_METHODS}
          onChange={(v) => set({ weight_method: v })}
        />
      </View>

      {value.oxBpRows.map((row, idx) => (
        <View key={`ob-${idx}`} style={styles.card}>
          <InputField
            label="Pulse Oximetry"
            value={row.pulse_oximetry}
            onChange={(v) => updateOxBp(idx, { pulse_oximetry: v })}
            placeholder="%"
            keyboardType="numeric"
          />
          <SelectChips
            label="Method"
            value={row.ox_method}
            options={OX_METHODS}
            onChange={(v) => updateOxBp(idx, { ox_method: v })}
          />
          <InputField
            label="Blood Pressure"
            value={row.blood_pressure}
            onChange={(v) => updateOxBp(idx, { blood_pressure: v })}
            placeholder="mmHg"
          />
          <SelectChips
            label="Position"
            value={row.bp_position}
            options={BP_POSITIONS}
            onChange={(v) => updateOxBp(idx, { bp_position: v })}
          />
        </View>
      ))}
      <Pressable
        style={styles.addBtn}
        onPress={() =>
          set({
            oxBpRows: [
              ...value.oxBpRows,
              { pulse_oximetry: '', ox_method: '', blood_pressure: '', bp_position: '' },
            ],
          })
        }
      >
        <Text style={styles.addBtnText}>+ Add More (SpO2 / BP)</Text>
      </Pressable>

      <CheckRow
        label="Unable to collect all vitals"
        value={value.unable_to_collect_vitals}
        onChange={(v) => set({ unable_to_collect_vitals: v })}
      />
      <Pressable
        style={styles.additionalBtn}
        onPress={() => set({ showAdditional: !value.showAdditional })}
      >
        <Text style={styles.additionalBtnText}>
          {value.showAdditional ? 'Hide Additional Vital Signs' : 'Additional Vital Signs'}
        </Text>
      </Pressable>
      <CheckRow
        label="Physician notified of abnormal vital sign parameters"
        value={value.physician_notified}
        onChange={(v) => set({ physician_notified: v })}
      />
      <CheckRow
        label="Clinical Manager notified of abnormal vital sign parameters"
        value={value.clinical_manager_notified}
        onChange={(v) => set({ clinical_manager_notified: v })}
      />

      {value.showAdditional ? (
        <View style={styles.card}>
          <Text style={styles.additionalTitle}>Additional Vital Signs</Text>
          <InputField
            label="Pain Level (0–10)"
            value={value.pain_level}
            onChange={(v) => set({ pain_level: v })}
            placeholder="0–10"
            keyboardType="numeric"
          />
          <InputField
            label="Blood Glucose"
            value={value.blood_glucose}
            onChange={(v) => set({ blood_glucose: v })}
            placeholder="mg/dL"
            keyboardType="decimal-pad"
          />
          <SelectChips
            label="Timing"
            value={value.glucose_timing}
            options={GLUCOSE_TIMING}
            onChange={(v) => set({ glucose_timing: v })}
          />
          <InputField
            label="Height"
            value={value.height}
            onChange={(v) => set({ height: v })}
            placeholder="in"
            keyboardType="decimal-pad"
          />
          <InputField
            label="BMI"
            value={value.bmi}
            onChange={(v) => set({ bmi: v })}
            placeholder="kg/m²"
            keyboardType="decimal-pad"
          />
          <SelectChips
            label="O2 Delivery Device"
            value={value.o2_delivery_device}
            options={O2_DEVICES}
            onChange={(v) => set({ o2_delivery_device: v })}
          />
          <InputField
            label="Flow Rate"
            value={value.o2_flow_rate}
            onChange={(v) => set({ o2_flow_rate: v })}
            placeholder="L/min"
            keyboardType="decimal-pad"
          />
          <SelectChips
            label="Capillary Refill"
            value={value.capillary_refill}
            options={CAP_REFILL}
            onChange={(v) => set({ capillary_refill: v })}
          />
          <InputField
            label="GCS Score"
            value={value.gcs_score}
            onChange={(v) => set({ gcs_score: v })}
            placeholder="3–15"
            keyboardType="numeric"
          />
          <SelectChips
            label="Edema"
            value={value.edema_additional}
            options={EDEMA}
            onChange={(v) => set({ edema_additional: v })}
          />
          <SelectChips
            label="Edema Location"
            value={value.edema_location}
            options={EDEMA_LOC}
            onChange={(v) => set({ edema_location: v })}
          />
        </View>
      ) : null}
    </View>
  );
}

/** Map vitals state into production nurse-note form_data field names. */
export function vitalsToFormData(v: VitalSignsState): Record<string, unknown> {
  return {
    temperature: v.tempHrRows.map((r) => r.temperature),
    temp_route: v.tempHrRows.map((r) => r.temp_route),
    heart_rate: v.tempHrRows.map((r) => r.heart_rate),
    pulse_type: v.tempHrRows.map((r) => r.pulse_type),
    respirations: v.respirations,
    weight: v.weight,
    weight_method: v.weight_method,
    pulse_oximetry: v.oxBpRows.map((r) => r.pulse_oximetry),
    ox_method: v.oxBpRows.map((r) => r.ox_method),
    blood_pressure: v.oxBpRows.map((r) => r.blood_pressure),
    bp_position: v.oxBpRows.map((r) => r.bp_position),
    unable_to_collect_vitals: v.unable_to_collect_vitals ? '1' : '',
    physician_notified: v.physician_notified ? '1' : '',
    clinical_manager_notified: v.clinical_manager_notified ? '1' : '',
    pain_level: v.pain_level,
    blood_glucose: v.blood_glucose,
    glucose_timing: v.glucose_timing,
    height: v.height,
    bmi: v.bmi,
    o2_delivery_device: v.o2_delivery_device,
    o2_flow_rate: v.o2_flow_rate,
    capillary_refill: v.capillary_refill,
    gcs_score: v.gcs_score,
    edema_additional: v.edema_additional,
    edema_location: v.edema_location,
  };
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: 2 },
  card: {
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  fieldBlock: { gap: 6 },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1D4ED8',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 8,
    fontSize: 15,
    color: colors.ink,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  chipText: { fontSize: 12, color: colors.text },
  chipTextOn: { color: '#fff', fontWeight: '700' },
  addBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F0F7FF',
  },
  checkRowOn: { backgroundColor: '#DBEAFE' },
  checkLabel: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 18 },
  additionalBtn: {
    backgroundColor: '#1E40AF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  additionalBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  additionalTitle: { fontWeight: '800', color: '#1E3A8A', marginBottom: 4 },
});
