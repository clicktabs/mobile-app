import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppHeader, AppShell } from '../../components/chrome';
import { AppDatePicker } from '../../components/AppDatePicker';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';
import { showAlert } from '../../utils/confirm';
import type { StaffPatientsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<StaffPatientsStackParamList, 'NewReferral'>;

const SOURCE_TYPES: { key: staffApi.ReferralSourceType; label: string }[] = [
  { key: 'hospital', label: 'Hospital' },
  { key: 'physician', label: 'Physician' },
  { key: 'snf', label: 'Skilled nursing facility' },
  { key: 'alf', label: 'Assisted living' },
  { key: 'rehab', label: 'Rehab' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'family', label: 'Family' },
  { key: 'self', label: 'Self' },
  { key: 'other', label: 'Other' },
];

/**
 * Taking a referral.
 *
 * Not an admission, and the screen says so twice — at the top and in the message it closes
 * with. Somebody has asked the agency to take this person on; the office verifies insurance
 * and eligibility, and converting the referral is what opens a chart and sets an admission
 * date. A form here that wrote a patient would assert all of that had happened.
 *
 * Five things are required: the name, who referred them, when, and how urgent. Everything
 * else is optional on purpose. This gets filled in at a bedside or on a phone call with a
 * discharge planner, and a form that demanded a date of birth and a ZIP before it would
 * save is a form that ends up as a note in somebody's pocket instead.
 */
export function StaffNewReferralScreen({ navigation }: Props) {
  const { token, handleUnauthorized } = useAuth();

  const today = new Date().toISOString().slice(0, 10);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');

  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [insurance, setInsurance] = useState('');

  const [sourceType, setSourceType] = useState<staffApi.ReferralSourceType>('hospital');
  const [sourceName, setSourceName] = useState('');
  const [sourcePhone, setSourcePhone] = useState('');
  const [sourceSheet, setSourceSheet] = useState(false);

  const [referralDate, setReferralDate] = useState(today);
  const [startDate, setStartDate] = useState('');
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'emergent'>('routine');
  const [reason, setReason] = useState('');

  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<staffApi.ExistingMatch | null>(null);

  const complete =
    firstName.trim() !== '' && lastName.trim() !== '' && sourceName.trim() !== '' && referralDate !== '';

  const save = async (override = false) => {
    if (!token || !complete) return;

    setSaving(true);
    try {
      const res = await staffApi.createReferral(token, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        date_of_birth: dob || undefined,
        phone: phone.trim() || undefined,

        address_line1: line1.trim() || undefined,
        address_line2: line2.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() ? state.trim().toUpperCase() : undefined,
        zip: zip.trim() || undefined,
        insurance: insurance.trim() || undefined,

        referral_source_type: sourceType,
        referral_source_name: sourceName.trim(),
        referral_source_phone: sourcePhone.trim() || undefined,

        referral_date: referralDate,
        requested_start_date: startDate || undefined,
        reason_for_referral: reason.trim() || undefined,

        priority,
        allow_duplicate: override || undefined,
      });

      showAlert(`Referral taken — ${res.referral.name}`, res.message);
      navigation.goBack();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }

      const payload = (e as ApiError)?.payload as { duplicate?: staffApi.ExistingMatch } | undefined;

      if (e instanceof ApiError && e.status === 422 && payload?.duplicate) {
        setExisting(payload.duplicate);
        return;
      }

      showAlert('Not saved', e instanceof ApiError ? e.message : 'That referral could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <AppHeader title="New Referral" showBack onBackPress={() => navigation.goBack()} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          {/*
            Said before anything is typed, not after it is saved. Somebody taking a referral
            at a bedside should not leave this screen thinking the patient is on the books.
          */}
          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={19} color="#0369A1" />
            <Text style={styles.noticeText}>
              This records a referral, not an admission. The office verifies insurance and
              eligibility, then converts it into a patient chart.
            </Text>
          </View>

          <Text style={styles.section}>Who has been referred</Text>

          <Label text="First name" required />
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            placeholderTextColor="#94A3B8"
          />

          <Label text="Last name" required />
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            placeholderTextColor="#94A3B8"
          />

          <Label text="Date of birth" />
          <AppDatePicker
            value={dob}
            onChange={setDob}
            format="YYYY-MM-DD"
            maxDate={today}
            placeholder="If known"
          />

          <Label text="Phone" />
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="Patient or family number"
            placeholderTextColor="#94A3B8"
          />

          <Label text="Insurance" />
          <TextInput
            style={styles.input}
            value={insurance}
            onChangeText={setInsurance}
            placeholder="Medicare, Medicaid, plan name"
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.section}>Where they will be seen</Text>
          {/*
            Not required, but worth asking: whether the address falls in the service area is
            one of the first things the office checks, and a referral with no address sits
            until somebody phones back for it.
          */}
          <Text style={styles.hint}>
            The office checks the address against the service area, so a referral without one
            usually waits on a phone call.
          </Text>

          <Label text="Street address" />
          <TextInput
            style={styles.input}
            value={line1}
            onChangeText={setLine1}
            placeholderTextColor="#94A3B8"
          />

          <Label text="Apartment, unit" />
          <TextInput
            style={styles.input}
            value={line2}
            onChangeText={setLine2}
            placeholderTextColor="#94A3B8"
          />

          <Label text="City" />
          <TextInput
            style={styles.input}
            value={city}
            onChangeText={setCity}
            autoCapitalize="words"
            placeholderTextColor="#94A3B8"
          />

          <View style={styles.row}>
            <View style={styles.stateBox}>
              <Label text="State" />
              <TextInput
                style={styles.input}
                value={state}
                onChangeText={(v) => setState(v.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase())}
                autoCapitalize="characters"
                maxLength={2}
                placeholder="OH"
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={styles.grow}>
              <Label text="ZIP" />
              <TextInput
                style={styles.input}
                value={zip}
                onChangeText={setZip}
                keyboardType="number-pad"
                maxLength={10}
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <Text style={styles.section}>Who referred them</Text>

          <Label text="Source" />
          <Pressable style={styles.picker} onPress={() => setSourceSheet(true)}>
            <Text style={styles.pickerValue}>
              {SOURCE_TYPES.find((s) => s.key === sourceType)?.label}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#64748B" />
          </Pressable>

          <Label text="Name" required />
          <TextInput
            style={styles.input}
            value={sourceName}
            onChangeText={setSourceName}
            placeholder="Hospital, facility or physician"
            placeholderTextColor="#94A3B8"
          />

          <Label text="Their phone" />
          <TextInput
            style={styles.input}
            value={sourcePhone}
            onChangeText={setSourcePhone}
            keyboardType="phone-pad"
            placeholder="To call back with questions"
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.section}>Timing</Text>

          <Label text="Referral date" required />
          <AppDatePicker
            value={referralDate}
            onChange={setReferralDate}
            format="YYYY-MM-DD"
            placeholder="Select date"
          />

          <Label text="Requested start of care" />
          <AppDatePicker
            value={startDate}
            onChange={setStartDate}
            format="YYYY-MM-DD"
            placeholder="If they asked for one"
          />

          {/*
            Asked, not assumed. Priority is what decides how fast the office works the
            referral, and the person taking it is the one who just heard how urgent it is.
          */}
          <Label text="Priority" required />
          <View style={styles.choices}>
            {(['routine', 'urgent', 'emergent'] as const).map((p) => (
              <Pressable
                key={p}
                style={[styles.choice, priority === p && styles.choiceOn]}
                onPress={() => setPriority(p)}
              >
                <Text style={[styles.choiceText, priority === p && styles.choiceTextOn]}>
                  {p === 'routine' ? 'Routine' : p === 'urgent' ? 'Urgent' : 'Emergent'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Label text="Reason for referral" />
          <TextInput
            style={[styles.input, styles.multiline]}
            value={reason}
            onChangeText={setReason}
            multiline
            placeholder="Diagnosis, what they need, anything the office should know"
            placeholderTextColor="#94A3B8"
          />

          {!complete ? (
            <Text style={styles.warn}>
              Needed before saving: name, who referred them, and the referral date.
            </Text>
          ) : null}

          <Pressable
            style={[styles.save, (!complete || saving) && styles.saveOff]}
            disabled={!complete || saving}
            onPress={() => save()}
          >
            <Text style={styles.saveText}>{saving ? 'Saving…' : 'Take referral'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <SourceSheet
        open={sourceSheet}
        selected={sourceType}
        onSelect={(k) => {
          setSourceType(k);
          setSourceSheet(false);
        }}
        onClose={() => setSourceSheet(false)}
      />

      <ExistingSheet
        match={existing}
        onTakeAnyway={() => {
          setExisting(null);
          save(true);
        }}
        onClose={() => setExisting(null)}
      />
    </AppShell>
  );
}

/**
 * Somebody already in the system under this name.
 *
 * The two cases read differently on purpose. An open referral means this one arrived twice
 * and the office would have to reconcile them — usually the right move is to stop. An
 * existing chart usually means a readmission, which is a real referral worth taking; the
 * point of showing it is that the person taking it should know, not that they should stop.
 */
function ExistingSheet({
  match,
  onTakeAnyway,
  onClose,
}: {
  match: staffApi.ExistingMatch | null;
  onTakeAnyway: () => void;
  onClose: () => void;
}) {
  const isReferral = match?.kind === 'referral';

  return (
    <Modal visible={!!match} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>
              {isReferral ? 'Already referred' : 'Already a patient here'}
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color="#0F172A" />
            </Pressable>
          </View>

          <Text style={styles.sheetBody}>
            {isReferral
              ? 'A referral for this person is already open and someone is working it. Taking a second one means the office has to reconcile them.'
              : 'This person already has a chart with this agency. A readmission is a real referral — but the office will want to know there is a chart.'}
          </Text>

          <View style={styles.existing}>
            <Text style={styles.existingName}>{match?.name}</Text>
            <Text style={styles.existingMeta}>
              {[match?.dob ? `DOB ${match.dob}` : null, match?.detail].filter(Boolean).join(' · ')}
            </Text>
          </View>

          <Pressable style={styles.save} onPress={onClose}>
            <Text style={styles.saveText}>
              {isReferral ? 'Leave it with the existing referral' : 'Cancel'}
            </Text>
          </Pressable>

          <Pressable style={styles.quiet} onPress={onTakeAnyway}>
            <Text style={styles.quietText}>Take this referral anyway</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function SourceSheet({
  open,
  selected,
  onSelect,
  onClose,
}: {
  open: boolean;
  selected: staffApi.ReferralSourceType;
  onSelect: (k: staffApi.ReferralSourceType) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Referral source</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color="#0F172A" />
            </Pressable>
          </View>

          {SOURCE_TYPES.map((s) => (
            <Pressable key={s.key} style={styles.optionRow} onPress={() => onSelect(s.key)}>
              <Text style={[styles.optionText, selected === s.key && styles.optionTextOn]}>
                {s.label}
              </Text>
              {selected === s.key ? (
                <Ionicons name="checkmark" size={19} color="#B4006E" />
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <Text style={styles.label}>
      {text}
      {required ? <Text style={styles.required}> *</Text> : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 56 },

  notice: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    padding: 12,
  },
  noticeText: { flex: 1, fontSize: 12.5, color: '#075985', lineHeight: 18 },

  section: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#94A3B8',
    marginTop: 24,
    marginBottom: 2,
  },
  label: { fontSize: 12.5, fontWeight: '700', color: '#334155', marginTop: 12, marginBottom: 5 },
  required: { color: '#B4006E' },
  hint: { fontSize: 11.5, color: '#94A3B8', marginTop: 4, lineHeight: 17 },
  warn: { fontSize: 12.5, color: '#B45309', marginTop: 18, lineHeight: 18 },

  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    backgroundColor: '#fff',
    color: '#0F172A',
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },

  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  pickerValue: { fontSize: 15, color: '#0F172A' },

  row: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1 },
  stateBox: { width: 88 },

  choices: { flexDirection: 'row', gap: 8 },
  choice: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  choiceOn: { borderColor: '#B4006E', backgroundColor: '#FDF2F8' },
  choiceText: { fontSize: 13.5, fontWeight: '600', color: '#475569' },
  choiceTextOn: { color: '#B4006E', fontWeight: '800' },

  save: {
    marginTop: 22,
    backgroundColor: '#B4006E',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveOff: { backgroundColor: '#CBD5E1' },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  quiet: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  quietText: { color: '#334155', fontWeight: '600', fontSize: 13.5 },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 34,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  sheetBody: { fontSize: 13.5, color: '#475569', lineHeight: 20 },

  existing: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#F8FAFC',
  },
  existingName: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  existingMeta: { fontSize: 12.5, color: '#64748B', marginTop: 3 },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  optionText: { fontSize: 15, color: '#334155' },
  optionTextOn: { color: '#B4006E', fontWeight: '700' },
});
