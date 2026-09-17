import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { AppHeader, AppShell } from '../../components/chrome';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';
import { isOffline } from '../../utils/connectivity';
import { showAlert, confirmAction } from '../../utils/confirm';
import { AppDatePicker, AppTimePicker } from '../../components/AppDatePicker';
import { colors } from '../../theme/colors';
import type { ScheduleItem } from '../../types';
import type { StaffScheduleStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<StaffScheduleStackParamList, 'CreateSchedule'>;

/**
 * Booking a visit from the phone.
 *
 * Only reachable for someone the server says holds "Schedule Visits/Activities" — the
 * Scheduler role and everyone above it. The server checks again on both requests here,
 * because a hidden button is a courtesy, not a permission.
 *
 * Deliberately not offline-capable, unlike the documentation screens. A note describes
 * something that already happened and only has to reach the office eventually; a booking
 * is a claim on somebody's day that the server has to validate against credentials, hours
 * caps and other visits. Queueing one would mean telling a scheduler a visit exists when
 * it may yet be refused, and the person expected at the door would never know.
 */
export function StaffCreateScheduleScreen({ navigation, route }: Props) {
  const { token, handleUnauthorized } = useAuth();

  const [options, setOptions] = useState<staffApi.ScheduleOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const [patientId, setPatientId] = useState<number | null>(null);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [taskType, setTaskType] = useState<string>('');
  // The day tapped on the calendar. Still editable here — the picker is a correction,
  // not the main way in.
  const [date, setDate] = useState(route.params?.date ?? today);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('normal');
  const [instructions, setInstructions] = useState('');

  // Which picker is open, if any.
  const [picking, setPicking] = useState<'patient' | 'staff' | 'task' | null>(null);

  const load = useCallback(async () => {
    if (!token) return;

    setLoadError(null);

    try {
      const res = await staffApi.getScheduleOptions(token);
      const data = res.data ?? null;

      setOptions(data);
      // No patient or caregiver is pre-selected: a wrong one chosen for them is worse
      // than a tap. The visit type is, because every visit has one.
      setTaskType((prev) => prev || data?.task_types[0]?.value || '');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }

      setLoadError(
        e instanceof ApiError && e.status === 403
          ? 'Your role does not include scheduling visits.'
          : 'Could not load patients and staff.',
      );
    } finally {
      setLoading(false);
    }
  }, [token, handleUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  /*
    What the chosen caregiver already has that day.

    Booking blind is how a caregiver ends up with two visits at once, or a day that only
    the weekly hours cap notices — as an error, after the scheduler has filled the whole
    form. The web calendar shows the day's events before you click into it; this is the
    same information, arriving as soon as there is a person and a date to ask about.
  */
  const [dayLoad, setDayLoad] = useState<ScheduleItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!token || !employeeId || !date) {
      setDayLoad(null);
      return;
    }

    staffApi
      .staffScheduleBetween(token, { from: date, to: date })
      .then((res) => {
        if (cancelled) return;
        setDayLoad(
          (res.data ?? [])
            .filter((v) => v.employee_id === employeeId)
            .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? '')),
        );
      })
      // Silent: this is context, not a gate. The server still applies the real rules.
      .catch(() => {
        if (!cancelled) setDayLoad(null);
      });

    return () => {
      cancelled = true;
    };
  }, [token, employeeId, date]);

  const patient = useMemo(
    () => options?.patients.find((p) => p.id === patientId) ?? null,
    [options, patientId],
  );
  const staffMember = useMemo(
    () => options?.staff.find((s) => s.id === employeeId) ?? null,
    [options, employeeId],
  );
  const taskLabel = useMemo(
    () => options?.task_types.find((t) => t.value === taskType)?.label ?? null,
    [options, taskType],
  );

  const endsAfterStart = endTime > startTime;
  const inThePast = date < today;

  const canSubmit =
    !!patientId && !!employeeId && !!taskType && !!date && endsAfterStart && !inThePast && !saving;

  const buildPayload = (
    overrides: { credentials?: boolean; hours?: boolean } = {},
  ): staffApi.NewSchedulePayload => ({
    patient_id: patientId!,
    employee_id: employeeId!,
    task_type: taskType,
    date,
    start_time: startTime,
    end_time: endTime,
    // The visit type already names the visit; a typed title replaces it.
    ...(title.trim() ? { title: title.trim() } : {}),
    priority,
    ...(instructions.trim() ? { special_instructions: instructions.trim() } : {}),
    ...(overrides.credentials ? { override_credentials: true } : {}),
    ...(overrides.hours ? { override_hours: true } : {}),
  });

  const submit = async (overrides: { credentials?: boolean; hours?: boolean } = {}) => {
    if (!token || !patientId || !employeeId) return;

    if (isOffline()) {
      showAlert(
        'You are offline',
        'A visit has to be checked against the assigned caregiver and their hours before it can be booked. Try again when you have signal.',
        'info',
      );
      return;
    }

    setSaving(true);

    try {
      const res = await staffApi.createSchedule(token, buildPayload(overrides));

      showAlert(
        'Visit scheduled',
        res.warning ??
          `${taskLabel ?? 'Visit'} for ${patient?.name ?? 'the patient'} on ${date} at ${startTime}.`,
        res.warning ? 'info' : 'success',
      );
      navigation.goBack();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }

      const problems = validationMessages(e);
      const blocker = problems.find(isCredentialProblem) ?? problems.find(isHoursProblem);

      /*
        The two blocks the office is allowed to accept anyway.

        Shown with the server's own wording — which names the credentials or the hours —
        and booked only on a second, explicit yes. The alternative, sending the override
        with the first request so the screen never has to show an error, would quietly
        switch off a check that still applies on the web.
      */
      if (blocker && !overrides.credentials && !overrides.hours) {
        setSaving(false);

        const proceed = await confirmAction(
          isCredentialProblem(blocker) ? 'Credentials not in order' : 'Over the hours cap',
          `${blocker}\n\nSchedule this visit anyway?`,
          { confirmLabel: 'Schedule anyway', destructive: true },
        );

        if (proceed) {
          await submit(
            isCredentialProblem(blocker) ? { credentials: true } : { hours: true },
          );
        }
        return;
      }

      showAlert(
        'Could not schedule',
        problems.length
          ? problems.join('\n\n')
          : e instanceof ApiError
            ? e.message
            : 'The visit was not created.',
        'error',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <Header navigation={navigation} />
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </AppShell>
    );
  }

  if (loadError || !options) {
    return (
      <AppShell>
        <Header navigation={navigation} />
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={28} color="#B45309" />
          <Text style={styles.errorText}>{loadError ?? 'Could not load the form.'}</Text>
          <Pressable style={styles.retry} onPress={load}>
            <Text style={styles.retryText}>TRY AGAIN</Text>
          </Pressable>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Header navigation={navigation} />

      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>
          The visit is created in the office system straight away and appears on the assigned
          caregiver&rsquo;s schedule.
        </Text>

        <Text style={styles.section}>Who</Text>

        <Text style={styles.label}>Patient</Text>
        <PickerField
          value={patient?.name}
          subtitle={patient?.subtitle}
          placeholder="Choose a patient"
          onPress={() => setPicking('patient')}
        />

        <Text style={styles.label}>Caregiver</Text>
        <PickerField
          value={staffMember?.name}
          subtitle={staffMember?.subtitle}
          placeholder="Choose who is going"
          onPress={() => setPicking('staff')}
        />
        {/*
          Said here rather than discovered at the door: this is the person the EVV record
          will name, and only they can clock into the visit.
        */}
        {staffMember ? (
          <Text style={styles.hint}>
            Only {staffMember.name.split(' ')[0]} can clock into this visit.
          </Text>
        ) : null}

        <Text style={styles.section}>What</Text>

        <Text style={styles.label}>Visit type</Text>
        <PickerField
          value={taskLabel}
          placeholder="Choose a visit type"
          onPress={() => setPicking('task')}
        />

        <Text style={styles.label}>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={taskLabel ?? 'Optional'}
          style={styles.input}
        />
        <Text style={styles.hint}>Left blank, the visit is titled &ldquo;{taskLabel}&rdquo;.</Text>

        <Text style={styles.section}>When</Text>

        <Text style={styles.label}>Date</Text>
        <AppDatePicker
          value={date}
          onChange={setDate}
          format="YYYY-MM-DD"
          minDate={today}
          placeholder="Select date"
        />
        {/*
          The picker greys out days before minDate, so this catches only a date arriving
          another way — a stale calendar selection carried in through the route. A visit
          scheduled into the past cannot be worked.
        */}
        {inThePast ? <Text style={styles.warn}>Choose today or a later date.</Text> : null}

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Starts</Text>
            <AppTimePicker value={startTime} onChange={setStartTime} format="24h" />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Ends</Text>
            <AppTimePicker value={endTime} onChange={setEndTime} format="24h" />
          </View>
        </View>
        {!endsAfterStart ? (
          <Text style={styles.warn}>The visit has to end after it starts.</Text>
        ) : null}

        {/*
          The caregiver's day as it already stands.

          Shown here rather than left to the server, because an overlap is the scheduler's
          decision to make — two visits at the same hour is sometimes a correction in
          progress and sometimes a mistake, and only the person booking knows which.
        */}
        {employeeId && dayLoad ? (
          <View style={styles.dayLoad}>
            <Text style={styles.dayLoadHead}>
              {staffMember?.name ?? 'This caregiver'} on {date}
            </Text>

            {dayLoad.length === 0 ? (
              <Text style={styles.dayLoadEmpty}>Nothing else booked.</Text>
            ) : (
              dayLoad.map((v) => {
                const clash = overlaps(v, startTime, endTime);
                return (
                  <View key={v.id} style={styles.dayLoadRow}>
                    <Ionicons
                      name={clash ? 'alert-circle' : 'time-outline'}
                      size={14}
                      color={clash ? '#B45309' : '#64748B'}
                    />
                    <Text style={[styles.dayLoadText, clash && styles.dayLoadClash]}>
                      {clockRange(v)} · {v.patient_name ?? 'Visit'}
                      {clash ? '  — overlaps' : ''}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        ) : null}

        <Text style={styles.section}>Priority</Text>
        <View style={styles.chips}>
          {options.priorities.map((p) => {
            const on = priority === p.value;
            return (
              <Pressable
                key={p.value}
                onPress={() => setPriority(p.value)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Instructions for the caregiver</Text>
        <TextInput
          value={instructions}
          onChangeText={setInstructions}
          placeholder="Anything they need to know before they arrive"
          multiline
          style={styles.textarea}
        />

        <Pressable
          style={[styles.submit, !canSubmit && styles.submitOff]}
          disabled={!canSubmit}
          onPress={() => submit()}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>SCHEDULE VISIT</Text>
          )}
        </Pressable>
      </ScrollView>

      <OptionSheet
        title={picking === 'patient' ? 'Patient' : picking === 'staff' ? 'Caregiver' : 'Visit type'}
        open={picking !== null}
        onClose={() => setPicking(null)}
        rows={
          picking === 'patient'
            ? options.patients.map((p) => ({ key: String(p.id), label: p.name, subtitle: p.subtitle }))
            : picking === 'staff'
              ? options.staff.map((s) => ({ key: String(s.id), label: s.name, subtitle: s.subtitle }))
              : options.task_types.map((t) => ({ key: t.value, label: t.label }))
        }
        selectedKey={
          picking === 'patient'
            ? patientId === null
              ? null
              : String(patientId)
            : picking === 'staff'
              ? employeeId === null
                ? null
                : String(employeeId)
              : taskType
        }
        onSelect={(key) => {
          if (picking === 'patient') setPatientId(Number(key));
          else if (picking === 'staff') setEmployeeId(Number(key));
          else setTaskType(key);
          setPicking(null);
        }}
      />
    </AppShell>
  );
}

function Header({ navigation }: { navigation: Props['navigation'] }) {
  return (
    <AppHeader
      title="Schedule a Visit"
      actions={[{ icon: 'arrow-back', onPress: () => navigation.goBack() }]}
    />
  );
}

function PickerField({
  value,
  subtitle,
  placeholder,
  onPress,
}: {
  value?: string | null;
  subtitle?: string | null;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.field} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={value ? styles.fieldValue : styles.fieldPlaceholder}>
          {value ?? placeholder}
        </Text>
        {value && subtitle ? <Text style={styles.fieldSubtitle}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-down" size={18} color="#64748B" />
    </Pressable>
  );
}

type SheetRow = { key: string; label: string; subtitle?: string | null };

/**
 * One list, in a sheet.
 *
 * A patient list can run to hundreds of names, so it scrolls and the current choice is
 * marked — a wheel picker would make finding a name at the end of the alphabet a chore.
 */
function OptionSheet({
  title,
  open,
  rows,
  selectedKey,
  onSelect,
  onClose,
}: {
  title: string;
  open: boolean;
  rows: SheetRow[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.label.toLowerCase().includes(q) || (r.subtitle ?? '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color="#0F172A" />
            </Pressable>
          </View>

          {rows.length > 8 ? (
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search"
              style={styles.sheetSearch}
              autoCorrect={false}
            />
          ) : null}

          <ScrollView keyboardShouldPersistTaps="handled">
            {filtered.length === 0 ? (
              <Text style={styles.sheetEmpty}>Nothing matches &ldquo;{search.trim()}&rdquo;.</Text>
            ) : (
              filtered.map((r) => {
                const on = r.key === selectedKey;
                return (
                  <Pressable
                    key={r.key}
                    style={[styles.sheetRow, on && styles.sheetRowOn]}
                    onPress={() => {
                      setSearch('');
                      onSelect(r.key);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sheetRowLabel}>{r.label}</Text>
                      {r.subtitle ? <Text style={styles.sheetRowSub}>{r.subtitle}</Text> : null}
                    </View>
                    {on ? (
                      <Ionicons name="checkmark" size={18} color={colors.brandMagenta ?? '#B4006E'} />
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/**
 * The reasons a booking was refused, in the server's own words.
 *
 * The web controller answers a rejected booking with `errors` keyed by field and no
 * top-level message, so ApiError.message is only "Request failed (422)". The sentence
 * that names the expired credential or the hours cap is inside the payload, and it is the
 * only part worth showing.
 */
function validationMessages(e: unknown): string[] {
  if (!(e instanceof ApiError)) return [];

  const errors = (e.payload as { errors?: Record<string, string[] | string> } | null)?.errors;
  if (!errors) {
    const message = (e.payload as { message?: string } | null)?.message;
    return message ? [message] : [];
  }

  return Object.values(errors).flatMap((v) => (Array.isArray(v) ? v : [v]));
}

const isCredentialProblem = (m: string) => /credential/i.test(m);
const isHoursProblem = (m: string) => /\bOT\b|hours/i.test(m);

/** "09:00–10:00" from an existing visit's stored datetimes. */
function clockRange(v: ScheduleItem) {
  const at = (s?: string) => (s ? s.slice(11, 16) : '--:--');
  return `${at(v.start_time)}–${at(v.end_time)}`;
}

/**
 * Whether an existing visit runs into the one being booked.
 *
 * Touching ends do not overlap: a visit ending at 10:00 and the next starting at 10:00
 * is a normal back-to-back day, and flagging it would train the scheduler to ignore the
 * warning that matters.
 */
function overlaps(v: ScheduleItem, startTime: string, endTime: string) {
  const from = v.start_time?.slice(11, 16);
  const to = v.end_time?.slice(11, 16);
  if (!from || !to) return false;

  return from < endTime && to > startTime;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  errorText: { fontSize: 14, color: '#334155', textAlign: 'center' },
  retry: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: '#0F172A' },

  pad: { padding: 16, paddingBottom: 48 },
  lead: { fontSize: 13, color: '#475569', marginBottom: 6, lineHeight: 19 },
  section: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#0F172A',
    marginTop: 22,
    marginBottom: 4,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginTop: 10, marginBottom: 4 },
  hint: { fontSize: 12, color: '#64748B', marginTop: 4 },
  warn: { fontSize: 12, color: '#B45309', marginTop: 4 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  fieldValue: { fontSize: 15, color: '#0F172A', fontWeight: '600' },
  fieldPlaceholder: { fontSize: 15, color: '#94A3B8' },
  fieldSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },

  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  textarea: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 90,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
  },

  dayLoad: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F8FAFC',
    gap: 6,
  },
  dayLoadHead: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  dayLoadEmpty: { fontSize: 12, color: '#64748B' },
  dayLoadRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayLoadText: { flex: 1, fontSize: 12, color: '#334155' },
  dayLoadClash: { color: '#B45309', fontWeight: '700' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  chipOn: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  chipText: { fontSize: 13, color: '#334155' },
  chipTextOn: { color: '#fff', fontWeight: '600' },

  submit: {
    marginTop: 26,
    backgroundColor: '#B4006E',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitOff: { backgroundColor: '#CBD5E1' },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 24,
    maxHeight: '75%',
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  sheetSearch: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  sheetEmpty: { fontSize: 13, color: '#64748B', paddingVertical: 18, textAlign: 'center' },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sheetRowOn: { backgroundColor: '#FDF2F8' },
  sheetRowLabel: { fontSize: 15, color: '#0F172A' },
  sheetRowSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
});
