import { apiRequest } from './client';
import type { ApiEnvelope, PatientListItem, ScheduleItem, StaffUser } from '../types';

export function staffLogin(email: string, password: string, deviceName = 'android-app') {
  return apiRequest<ApiEnvelope<{ user: StaffUser; token: string }>>('mobile/auth/login', {
    method: 'POST',
    body: { email, password, device_name: deviceName },
  });
}

export function staffProfile(token: string) {
  return apiRequest<ApiEnvelope<StaffUser>>('mobile/staff/profile', { token });
}

export function staffLogout(token: string) {
  return apiRequest<ApiEnvelope<null>>('mobile/staff/logout', { method: 'POST', token });
}

export function staffChangePassword(
  token: string,
  current_password: string,
  new_password: string,
  new_password_confirmation: string,
) {
  return apiRequest<ApiEnvelope<null>>('mobile/staff/change-password', {
    method: 'POST',
    token,
    body: { current_password, new_password, new_password_confirmation },
  });
}

export type SignaturePinStatus = {
  has_pin: boolean;
  pin_set_at?: string | null;
  is_locked?: boolean;
  locked_until?: string | null;
};

export function getSignaturePinStatus(token: string) {
  return apiRequest<ApiEnvelope<SignaturePinStatus>>('mobile/staff/signature-pin', {
    method: 'GET',
    token,
  });
}

export function updateSignaturePin(
  token: string,
  data: {
    pin: string;
    pin_confirmation: string;
    current_pin?: string;
    password?: string;
  },
) {
  return apiRequest<ApiEnvelope<{ has_pin: boolean; pin_set_at?: string | null }>>(
    'mobile/staff/signature-pin',
    {
      method: 'POST',
      token,
      body: data,
    },
  );
}

export function staffDashboard(token: string) {
  return apiRequest<
    ApiEnvelope<{
      stats: {
        today_visits: number;
        completed_today: number;
        assigned_patients: number;
        pending_tasks: number;
        shift_offers?: number;
        available_shifts?: number;
        licenses?: number;
        licenses_on_file?: number;
        licenses_pending?: number;
        payroll_hours?: number;
        payroll_hours_label?: string;
        /**
         * Aide supervision that has come due — §484.80(h), every 14 days alongside
         * skilled care and every 60 for an aide-only patient.
         *
         * Scoped server-side like every other list: the agency's for a manager, their
         * own rows for a field clinician. Overdue is the subset of due that is already
         * a compliance problem.
         */
        supervisory_visits_due?: number;
        supervisory_visits_overdue?: number;
        /**
         * Permissions, sent here as well as at login.
         *
         * The stored login payload is written once and never refreshed, so a flag added
         * to it later is absent for everyone already signed in — and absent reads as
         * false, hiding the control from exactly the people who hold the permission. The
         * dashboard is fetched on every visit, so it corrects the record.
         */
        can_manage_payroll?: boolean;
        can_create_schedules?: boolean;
      };
      upcoming_visits: ScheduleItem[];
    }>
  >('mobile/staff/dashboard', { token });
}

export function staffPatients(
  token: string,
  params: { search?: string; status?: string; page?: number; limit?: number } = {},
) {
  return apiRequest<ApiEnvelope<PatientListItem[]>>('mobile/staff/patients', {
    token,
    query: params,
  });
}

export function staffPatientDetail(token: string, patientId: number) {
  return apiRequest<ApiEnvelope<Record<string, unknown>>>(`mobile/staff/patients/${patientId}`, {
    token,
  });
}

export function staffTodaySchedule(token: string) {
  return apiRequest<ApiEnvelope<ScheduleItem[]> & { count?: number }>('mobile/staff/schedule/today', {
    token,
  });
}

export function staffWeekSchedule(
  token: string,
  opts?: { start_date?: string; days_past?: number; days_ahead?: number },
) {
  return apiRequest<ApiEnvelope<ScheduleItem[]> & { count?: number; week?: { start: string; end: string } }>(
    'mobile/staff/schedule/week',
    {
      token,
      query: {
        start_date: opts?.start_date,
        days_past: opts?.days_past,
        days_ahead: opts?.days_ahead,
      },
    },
  );
}

/**
 * A rolling window rather than a calendar week, so the schedule screen can see past
 * Sunday. Defaults on the server are 7 days back and 30 ahead; the look-back exists
 * because the same list feeds the Past Due and Completed tabs.
 */
export function staffUpcomingSchedule(token: string, days?: number, days_back?: number) {
  return apiRequest<
    ApiEnvelope<ScheduleItem[]> & {
      count?: number;
      window?: { from: string; to: string; days: number; days_back: number };
      /*
        Whether this person may book a visit — "Schedule Visits/Activities" in the web
        app's role settings. It rides along with the list rather than being read from the
        stored login payload, which is written once at sign-in and never refreshed: a
        permission granted this morning would otherwise stay invisible until the person
        signed out and back in.
      */
      can_create_schedules?: boolean;
    }
  >('mobile/staff/schedule/upcoming', { token, query: { days, days_back } });
}

/**
 * An explicit span, for the month calendar.
 *
 * The rolling window above is right for a caregiver's own list. A calendar the user can
 * page through needs whichever month they turned to, which may be a year out — so the
 * dates are named rather than counted from today. The server caps the span.
 */
export function staffScheduleBetween(token: string, span: { from: string; to: string }) {
  return apiRequest<
    ApiEnvelope<ScheduleItem[]> & {
      count?: number;
      window?: { from: string; to: string };
      can_create_schedules?: boolean;
    }
  >('mobile/staff/schedule/upcoming', { token, query: span });
}

/* ------------------------------------------------------------- aide supervision */

export type SupervisoryVisitRow = {
  id: number;
  patient_id?: number | null;
  patient_name: string;
  /** Who is being supervised. On a manager's list this is the point of the row. */
  aide_id?: number | null;
  aide_name?: string | null;
  next_due_date?: string | null;
  is_overdue: boolean;
  days_overdue: number;
  last_completed_date?: string | null;
  /** "every 14 days" — says why this date and not another. */
  interval?: string | null;
  compliance_type?: string | null;
};

export type SupervisoryFormOptions = {
  /** The 15 observations, in the order the agency's form asks them. */
  items: string[];
  ratings: { value: string; label: string }[];
  care_types: { value: string; label: string }[];
};

export type SupervisoryVisitPayload = {
  patient_id: number;
  /** The aide being observed. The server refuses a visit whose supervisee is the caller. */
  supervisee_id: number;
  visit_date: string;
  staff_present?: 'yes' | 'no';
  care_type?: string[];
  evaluations: { rating?: string | null; comment?: string | null }[];
  care_plan_meets_needs?: boolean;
  care_plan_revised?: boolean;
  care_plan_date_revised?: string;
  supervisor_comments?: string;
  strengths_observed?: string;
  areas_for_improvement?: string;
  /**
   * The patient's signature, as an SVG path — the same shape as every other signature
   * in this app. It is what attests the observation happened in the home.
   *
   * The server requires this or a reason, never neither, and never both silently: a
   * patient who cannot hold a stylus should produce a truthful record, not a signature
   * somebody else made for them.
   */
  patient_signature?: string;
  patient_signature_name?: string;
  patient_unable_to_sign_reason?: string;
};

export function getSupervisoryFormOptions(token: string) {
  return apiRequest<ApiEnvelope<SupervisoryFormOptions>>('mobile/staff/supervisory-visits/options', {
    token,
  });
}

export function saveSupervisoryVisit(token: string, payload: SupervisoryVisitPayload) {
  return apiRequest<{ success: boolean; message?: string; data?: { id: number } }>(
    'mobile/staff/supervisory-visits',
    { method: 'POST', token, body: payload },
  );
}

export function getSupervisoryVisits(token: string) {
  return apiRequest<
    ApiEnvelope<SupervisoryVisitRow[]> & {
      count?: number;
      overdue_count?: number;
      sees_whole_agency?: boolean;
    }
  >('mobile/staff/supervisory-visits', { token });
}

/* ------------------------------------------------------------------ booking a visit */

export type SchedulePickerOption = {
  id: number;
  name: string;
  subtitle?: string | null;
};

export type ScheduleOptions = {
  patients: SchedulePickerOption[];
  /** Only staff who can actually be sent: active account, employee record behind it. */
  staff: SchedulePickerOption[];
  task_types: { value: string; label: string }[];
  priorities: { value: string; label: string }[];
};

export type NewSchedulePayload = {
  patient_id: number;
  employee_id: number;
  task_type: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24h */
  start_time: string;
  end_time: string;
  title?: string;
  priority?: string;
  special_instructions?: string;
  /**
   * Both default to off and are sent only after the user is shown what is wrong and says
   * to go ahead anyway. Sending either by default would turn a real check off on the
   * phone while leaving it in place on the web.
   */
  override_credentials?: boolean;
  override_hours?: boolean;
};

export function getScheduleOptions(token: string) {
  return apiRequest<ApiEnvelope<ScheduleOptions>>('mobile/staff/schedule/options', { token });
}

export function createSchedule(token: string, payload: NewSchedulePayload) {
  return apiRequest<{
    success: boolean;
    message?: string;
    warning?: string | null;
    schedule?: { id: number };
  }>('mobile/staff/schedule', { method: 'POST', token, body: payload });
}

export function completeVisit(
  token: string,
  scheduleId: number,
  body: { completion_notes?: string; actual_start_time?: string; actual_end_time?: string } = {},
) {
  return apiRequest<ApiEnvelope<null>>(`mobile/staff/schedule/${scheduleId}/complete`, {
    method: 'POST',
    token,
    body,
  });
}

export function createStaffSchedule(
  token: string,
  body: {
    patient_id: number;
    title: string;
    start_datetime: string;
    end_datetime?: string;
    task_type?: string;
    priority?: string;
    special_instructions?: string;
    description?: string;
  },
) {
  return apiRequest<ApiEnvelope<ScheduleItem>>('mobile/staff/schedule', {
    method: 'POST',
    token,
    body,
  });
}

export function getPatientVitals(token: string, patientId: number, limit = 20) {
  return apiRequest<ApiEnvelope<Record<string, unknown>[]>>(`mobile/staff/patients/${patientId}/vitals`, {
    token,
    query: { limit },
  });
}

export function recordVitals(token: string, patientId: number, body: Record<string, unknown>) {
  return apiRequest<ApiEnvelope<{ id: number }>>(`mobile/staff/patients/${patientId}/vitals`, {
    method: 'POST',
    token,
    body,
  });
}

export function getVisitNotes(token: string, patientId: number, limit = 20) {
  return apiRequest<ApiEnvelope<Record<string, unknown>[]>>(
    `mobile/staff/patients/${patientId}/visit-notes`,
    { token, query: { limit } },
  );
}

export function createVisitNote(
  token: string,
  patientId: number,
  body: { visit_type: string; note: string; visit_date?: string },
) {
  return apiRequest<ApiEnvelope<{ id: number }>>(`mobile/staff/patients/${patientId}/visit-notes`, {
    method: 'POST',
    token,
    body,
  });
}

export function saveNursingNote(
  token: string,
  body: {
    patient_id: number;
    schedule_id?: number;
    status?: 'draft' | 'completed';
    signature_pin?: string;
    form_data: Record<string, unknown>;
    note_text?: string;
  },
) {
  return apiRequest<ApiEnvelope<{ id: number; status?: string }>>('mobile/staff/nursing-notes', {
    method: 'POST',
    token,
    body,
  });
}

export type HhaNotePayload = {
  patient_id: number;
  schedule_id?: number;
  status: 'draft' | 'completed';
  visit_date?: string;
  visit_start_time?: string;
  visit_end_time?: string;
  total_hours?: number;
  /** Keyed by the task keys in src/data/hhaTasks.ts. */
  tasks: Record<string, 'completed' | 'refused' | 'na'>;
  comments: Record<string, string>;
  signature_pin?: string;
};

export type HhaNote = {
  id: number;
  status: 'draft' | 'completed';
  visit_date?: string;
  visit_start_time?: string;
  visit_end_time?: string;
  total_hours?: number | string | null;
  tasks: Record<string, 'completed' | 'refused' | 'na'>;
  comments: Record<string, string>;
};

/** The aide's shift note. Writes the same record the web HHA form writes. */
export function saveHhaNote(token: string, body: HhaNotePayload) {
  return apiRequest<ApiEnvelope<{ id: number; status: string; task_count: number }>>(
    'mobile/staff/hha-notes',
    { method: 'POST', token, body },
  );
}

/** The latest note for a schedule, so a draft can be picked back up. */
export function getHhaNote(token: string, scheduleId: number) {
  return apiRequest<{ success: boolean; note: HhaNote | null }>(
    `mobile/staff/hha-notes/schedule/${scheduleId}`,
    { token },
  );
}

export type MissedVisitNote = {
  id: number;
  status: 'missed' | 'pending' | 'rescheduled' | 'resolved' | string;
  reason: string | null;
  comments: string | null;
  visit_date: string | null;
  /** False while the record still carries only the automatic flag. */
  documented: boolean;
};

export type MissedVisitContext = {
  success: boolean;
  visit: {
    schedule_id: number;
    patient_id: number;
    patient_name: string;
    scheduled_at: string | null;
    task: string | null;
  };
  note: MissedVisitNote | null;
  reasons: string[];
};

/** The flagged record for a schedule, plus the reason list to choose from. */
export function getMissedVisitNote(token: string, scheduleId: number) {
  return apiRequest<MissedVisitContext>(
    `mobile/staff/missed-visits/schedule/${scheduleId}`,
    { token },
  );
}

/** Record why the visit did not happen. Signed, like any note about care. */
export function saveMissedVisitNote(
  token: string,
  scheduleId: number,
  body: {
    reason: string;
    comments: string;
    physician_notified: boolean;
    will_reschedule: boolean;
    signature_pin: string;
  },
) {
  return apiRequest<ApiEnvelope<{ id: number; status: string }>>(
    `mobile/staff/missed-visits/schedule/${scheduleId}`,
    { method: 'POST', token, body },
  );
}

export function verifySignaturePin(token: string, pin: string) {
  return apiRequest<ApiEnvelope<{ verified: boolean }>>('mobile/staff/verify-pin', {
    method: 'POST',
    token,
    body: { pin },
  });
}

export function getMedicationSchedule(token: string, patientId: number) {
  return apiRequest<ApiEnvelope<Record<string, unknown>[]>>(
    `mobile/staff/patients/${patientId}/medication-schedule`,
    { token },
  );
}

export type DrugSearchResult = {
  name: string;
  dosage: string;
  route: string;
  form: string;
  full_name: string;
  generic: boolean;
  otc: boolean;
  drugbank_id?: string | null;
  rxcui?: string | null;
  frequency: string;
  instructions: string;
  source: 'drugbank' | 'rxnorm';
};

/**
 * Drug-name lookup for the medication form.
 *
 * `source` says who answered — DrugBank, or RxNorm when DrugBank could not be
 * reached. The screen shows a DrugBank badge, and it must not show it over RxNorm
 * data.
 */
export function searchMedicationCatalog(
  token: string,
  query: string,
  limit = 15,
  /**
   * 'ingredient' collapses to one row per drug, dropping strength and form — what
   * an allergy list wants, since a patient is allergic to the drug and not to the
   * 500mg tablet. 'product' keeps the detail a medication order needs.
   */
  mode: 'product' | 'ingredient' = 'product',
) {
  return apiRequest<{
    success: boolean;
    source: 'drugbank' | 'rxnorm' | 'none';
    medications: DrugSearchResult[];
  }>('mobile/staff/medications/search', {
    token,
    query: { q: query, limit, mode },
  });
}

export type DrugInteraction = {
  subject: string;
  affected: string;
  severity: 'major' | 'moderate' | 'minor' | string;
  description: string;
  extended_description: string;
  management: string;
  evidence_level: string;
};

export type InteractionCheckResult = {
  success: boolean;
  /**
   * Whether the check actually ran. False means DrugBank could not be reached or a
   * drug could not be resolved — which is NOT the same as finding nothing, and must
   * never be displayed as a clean result.
   */
  checked: boolean;
  reason?: string;
  message?: string;
  source?: string;
  medication?: string;
  checked_against?: string[];
  /** Drugs on file that could not be resolved, so were not part of the check. */
  not_checked?: string[];
  interactions: DrugInteraction[];
  highest_severity?: string | null;
};

export function checkMedicationInteractions(
  token: string,
  patientId: number,
  medicationName: string,
) {
  return apiRequest<InteractionCheckResult>(
    `mobile/staff/patients/${patientId}/medications/check-interactions`,
    { method: 'POST', token, body: { medication_name: medicationName } },
  );
}

export function addPatientMedication(
  token: string,
  patientId: number,
  data: {
    medication_name: string;
    dosage: string;
    frequency: string;
    route?: string;
    instructions?: string;
    status?: string;
    start_date?: string;
  },
) {
  return apiRequest<ApiEnvelope<Record<string, unknown>>>(
    `mobile/staff/patients/${patientId}/medications`,
    {
      method: 'POST',
      token,
      body: data,
    },
  );
}

export function administerMedication(token: string, patientId: number, body: Record<string, unknown>) {
  return apiRequest<ApiEnvelope<{ id: number }>>(`mobile/staff/patients/${patientId}/medication-admin`, {
    method: 'POST',
    token,
    body,
  });
}

export function getPatientImmunizations(token: string, patientId: number) {
  return apiRequest<ApiEnvelope<Record<string, unknown>[]>>(
    `mobile/staff/patients/${patientId}/immunizations`,
    { token },
  );
}

export function savePatientImmunization(
  token: string,
  patientId: number,
  data: {
    vaccine: string;
    date?: string;
    dose?: string;
    route?: string;
    site?: string;
    source?: string;
    lot?: string;
    status?: string;
    reason?: string;
    active?: boolean;
  },
) {
  return apiRequest<ApiEnvelope<Record<string, unknown>>>(
    `mobile/staff/patients/${patientId}/immunizations`,
    {
      method: 'POST',
      token,
      body: data,
    },
  );
}

export function updatePatientImmunization(
  token: string,
  patientId: number,
  id: string | number,
  data: {
    active?: boolean;
    status?: string;
  },
) {
  return apiRequest<ApiEnvelope<Record<string, unknown>>>(
    `mobile/staff/patients/${patientId}/immunizations/${id}`,
    {
      method: 'PATCH',
      token,
      body: data,
    },
  );
}

export function deletePatientImmunization(
  token: string,
  patientId: number,
  id: string | number,
) {
  return apiRequest<ApiEnvelope<Record<string, unknown>>>(
    `mobile/staff/patients/${patientId}/immunizations/${id}`,
    {
      method: 'DELETE',
      token,
    },
  );
}

export function getPatientAllergies(token: string, patientId: number) {
  return apiRequest<ApiEnvelope<Record<string, unknown>[]>>(
    `mobile/staff/patients/${patientId}/allergies`,
    { token },
  );
}

export function addPatientAllergy(
  token: string,
  patientId: number,
  data: {
    allergen_name: string;
    reaction?: string;
    reaction_description?: string;
    severity?: string;
    allergen_type?: string;
    allergy_type?: string;
    date_of_diagnosis?: string;
    onset_date?: string;
    exposure_route?: string;
    notes?: string;
    acknowledged_warning?: boolean;
  },
) {
  return apiRequest<ApiEnvelope<Record<string, unknown>>>(
    `mobile/staff/patients/${patientId}/allergies`,
    {
      method: 'POST',
      token,
      body: data,
    },
  );
}

export function updatePatientAllergyStatus(
  token: string,
  patientId: number,
  allergyId: number | string,
  status: 'active' | 'inactive' | 'resolved',
  reason?: string,
) {
  return apiRequest<ApiEnvelope<Record<string, unknown>>>(
    `mobile/staff/patients/${patientId}/allergies/${allergyId}/status`,
    {
      method: 'PATCH',
      token,
      body: { status, reason },
    },
  );
}

export function getPatientInfections(token: string, patientId: number) {
  return apiRequest<ApiEnvelope<Record<string, unknown>[]>>(
    `mobile/staff/patients/${patientId}/infections`,
    { token },
  );
}

export function addPatientInfection(
  token: string,
  patientId: number,
  data: {
    infection_type: string;
    organism?: string;
    site?: string;
    infection_site?: string;
    risk_level?: string;
    severity?: string;
    isolation_precautions?: string;
    isolation_type?: string;
    status?: string;
    date_identified?: string;
    culture_results?: string;
    culture_info?: string;
    notes?: string;
    additional_notes?: string;
    precaution_type?: string;
  },
) {
  return apiRequest<ApiEnvelope<Record<string, unknown>>>(
    `mobile/staff/patients/${patientId}/infections`,
    {
      method: 'POST',
      token,
      body: data,
    },
  );
}

export function updatePatientInfectionStatus(
  token: string,
  patientId: number,
  infectionId: number | string,
  status: 'active' | 'resolved' | 'inactive',
) {
  return apiRequest<ApiEnvelope<Record<string, unknown>>>(
    `mobile/staff/patients/${patientId}/infections/${infectionId}/status`,
    {
      method: 'PATCH',
      token,
      body: { status },
    },
  );
}

export type CommNotePayload = {
  note_content?: string;
  note?: string;
  patient_status?: string;
  episode_id?: number | string;
  physician_id?: number | string;
  note_date?: string;
  send_as_message?: boolean;
  status?: 'draft' | 'completed';
  signature_pin?: string;
  pin?: string;
  signature_date?: string;
  signature_time?: string;
  type?: string;
};

export function getCommNotes(token: string, patientId: number) {
  return apiRequest<ApiEnvelope<Record<string, any>[]>>(
    `mobile/staff/patients/${patientId}/comm-notes`,
    { token },
  );
}

export function createCommNote(
  token: string,
  patientId: number,
  payload: CommNotePayload | string,
  type = 'general'
) {
  const body = typeof payload === 'string'
    ? { note: payload, note_content: payload, type }
    : { ...payload, type: payload.type || type };

  return apiRequest<ApiEnvelope<{ id: number }>>(`mobile/staff/patients/${patientId}/comm-notes`, {
    method: 'POST',
    token,
    body,
  });
}

export function updateCommNote(
  token: string,
  patientId: number,
  noteId: string | number,
  body: Partial<CommNotePayload>
) {
  return apiRequest<ApiEnvelope<Record<string, unknown>>>(
    `mobile/staff/patients/${patientId}/comm-notes/${noteId}`,
    {
      method: 'PATCH',
      token,
      body,
    }
  );
}

export function deleteCommNote(token: string, patientId: number, noteId: string | number) {
  return apiRequest<ApiEnvelope<Record<string, unknown>>>(
    `mobile/staff/patients/${patientId}/comm-notes/${noteId}`,
    {
      method: 'DELETE',
      token,
    }
  );
}

export type PhysicianItem = {
  id: number;
  name: string;
  specialty?: string;
  npi?: string;
  phone?: string;
};

export function getPhysicians(token: string, search?: string) {
  return apiRequest<ApiEnvelope<PhysicianItem[]>>('mobile/staff/physicians', {
    token,
    query: search ? { q: search } : undefined,
  });
}

export function createPhysician(
  token: string,
  body: {
    first_name: string;
    last_name: string;
    specialty?: string;
    npi_number?: string;
    phone?: string;
  }
) {
  return apiRequest<ApiEnvelope<PhysicianItem>>('mobile/staff/physicians', {
    method: 'POST',
    token,
    body,
  });
}

export type PatientEpisodeItem = {
  id: number;
  start_date?: string;
  end_date?: string;
  status?: string;
  type?: string;
  episode_number?: string;
};

export function getPatientEpisodes(token: string, patientId: number) {
  return apiRequest<ApiEnvelope<PatientEpisodeItem[]>>(
    `mobile/staff/patients/${patientId}/episodes`,
    { token }
  );
}

export function getStaffMessages(token: string, folder = 'inbox') {
  return apiRequest<ApiEnvelope<Record<string, unknown>[]>>('mobile/staff/messages', {
    token,
    query: { folder },
  });
}

export function getStaffMessage(token: string, messageId: number) {
  return apiRequest<ApiEnvelope<Record<string, unknown>>>(`mobile/staff/messages/${messageId}`, {
    token,
  });
}

export function markStaffMessageRead(token: string, messageId: number) {
  return apiRequest<ApiEnvelope<{ success: boolean }>>(`mobile/staff/messages/${messageId}/read`, {
    method: 'PATCH',
    token,
  });
}

export function markStaffMessageUnread(token: string, messageId: number) {
  return apiRequest<ApiEnvelope<{ success: boolean }>>(`mobile/staff/messages/${messageId}/unread`, {
    method: 'PATCH',
    token,
  });
}

export function sendStaffMessage(
  token: string,
  body: {
    recipient_ids?: number[];
    recipient_email?: string;
    to?: string;
    subject: string;
    body: string;
    reply_to_id?: number;
    thread_id?: number;
  },
) {
  return apiRequest<ApiEnvelope<{ id: number }>>('mobile/staff/messages', {
    method: 'POST',
    token,
    body,
  });
}

export function getMileage(token: string, from?: string, to?: string) {
  return apiRequest<ApiEnvelope<Record<string, unknown>[]> & { total_miles?: number }>(
    'mobile/staff/mileage',
    { token, query: { from, to } },
  );
}

export function recordMileage(token: string, body: Record<string, unknown>) {
  return apiRequest<ApiEnvelope<{ id: number }>>('mobile/staff/mileage', {
    method: 'POST',
    token,
    body,
  });
}

export function clockIn(token: string, notes?: string) {
  return apiRequest<ApiEnvelope<{ id: number; clock_in: string }>>('mobile/staff/time/clock-in', {
    method: 'POST',
    token,
    body: { notes },
  });
}

export function clockOut(token: string, notes?: string) {
  return apiRequest<ApiEnvelope<{ id: number; clock_in: string; clock_out: string }>>(
    'mobile/staff/time/clock-out',
    { method: 'POST', token, body: { notes } },
  );
}

export function getTimeEntries(token: string, from?: string, to?: string) {
  return apiRequest<ApiEnvelope<Record<string, unknown>[]>>('mobile/staff/time/entries', {
    token,
    query: { from, to },
  });
}

export function orgDashboard(token: string) {
  return apiRequest<ApiEnvelope<Record<string, unknown>>>('mobile/org/dashboard', { token });
}

export function adminDashboard(token: string) {
  return apiRequest<ApiEnvelope<Record<string, unknown>>>('mobile/admin/dashboard', { token });
}

export type PocOrderRow = {
  poc_id?: number | null;
  section_key: string;
  field_key: string;
  order: string;
  type: string;
  value: string | boolean;
  description: string;
  clinician?: string;
  effective_date?: string;
  goal_status?: string;
};

export type PocOrdersPayload = {
  rows: PocOrderRow[];
  poc_id: number | null;
  cms485_id?: number | null;
  pending_qa?: boolean;
  next_episode?: boolean;
  assessment_date?: string;
};

export function getPlanOfCareOrders(
  token: string,
  patientId: number,
  discipline: 'sn' | 'pt' | 'ot' | 'st' = 'sn',
) {
  return apiRequest<ApiEnvelope<PocOrdersPayload>>(`mobile/staff/patients/${patientId}/plan-of-care/orders`, {
    token,
    query: { discipline },
  });
}

export function upsertPlanOfCareSection(
  token: string,
  patientId: number,
  body: {
    section_key: string;
    label: string;
    plan_of_care?: string;
    interventions?: Array<{ field: string; label: string; notes?: string }>;
    goals?: Array<{ field: string; label: string; notes?: string }>;
    plan_of_care_id?: number | null;
  },
) {
  return apiRequest<ApiEnvelope<{ plan_of_care_id: number; section_key: string }>>(
    `mobile/staff/patients/${patientId}/plan-of-care/sections`,
    { method: 'POST', token, body },
  );
}

export function updatePlanOfCareOrder(
  token: string,
  pocId: number,
  body: {
    section_key: string;
    field_key: string;
    description?: string;
    clinician?: string;
    effective_date?: string;
    discontinued?: boolean;
    goal_status?: string;
  },
) {
  return apiRequest<ApiEnvelope<Record<string, unknown>>>(`mobile/staff/plan-of-care/${pocId}/orders`, {
    method: 'PATCH',
    token,
    body,
  });
}

export type WoundButtonState = 'na' | 'needs_documentation' | 'complete';

export type WoundCareRow = {
  id: number;
  wound_number?: number | string;
  wound_type?: string;
  location?: string;
  additional_location?: string;
  stage?: string;
  length?: number | string | null;
  width?: number | string | null;
  depth?: number | string | null;
  onset_date?: string;
  present_on_admission?: boolean | null;
  status?: string;
  care_not_performed?: boolean;
  care_not_performed_reason?: string;
  map_x?: number | null;
  map_y?: number | null;
  map_region?: string | null;
  tissue_type?: string;
  drainage?: string;
  odor?: string;
  pain?: string;
  infection_signs?: string;
  response_to_treatment?: string;
  treatment_performed?: string;
  wound_score?: number | null;
  validated?: boolean;
  assessed_at?: string;
  updated_at?: string;
  notes?: string;
  description?: string;
};

export type WoundCareListResponse = ApiEnvelope<WoundCareRow[]> & {
  meta?: {
    active_count?: number;
    button_state?: WoundButtonState;
  };
};

export function getWoundCare(token: string, patientId: number) {
  return apiRequest<WoundCareListResponse>(`mobile/staff/patients/${patientId}/wound-care`, { token });
}

export function createWoundCare(
  token: string,
  patientId: number,
  body: {
    location: string;
    wound_type: string;
    stage_grade?: string;
    onset_date?: string;
    present_on_admission?: boolean;
    additional_location?: string;
    description?: string;
    notes?: string;
    treatment_performed?: string;
    map_x?: number;
    map_y?: number;
    map_region?: string;
  },
) {
  return apiRequest<ApiEnvelope<{ id: number; wound_number?: number }>>(
    `mobile/staff/patients/${patientId}/wound-care`,
    { method: 'POST', token, body },
  );
}

export function updateWoundCare(
  token: string,
  patientId: number,
  woundId: number,
  body: Record<string, unknown>,
) {
  return apiRequest<ApiEnvelope<{ id: number }>>(
    `mobile/staff/patients/${patientId}/wound-care/${woundId}`,
    { method: 'PATCH', token, body },
  );
}

export type WoundOrderRow = {
  id: number;
  wound_location?: string;
  wound_type?: string;
  wound_stage?: string;
  length?: number | string | null;
  width?: number | string | null;
  depth?: number | string | null;
  treatment_frequency?: string;
  treatment_instructions?: string;
  supplies_needed?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  signed?: boolean;
  created_at?: string;
};

export function getWoundOrders(token: string, patientId: number) {
  return apiRequest<ApiEnvelope<WoundOrderRow[]>>(`mobile/staff/patients/${patientId}/wound-orders`, {
    token,
  });
}

export function createWoundOrder(
  token: string,
  patientId: number,
  body: {
    wound_location: string;
    wound_type?: string;
    wound_stage?: string;
    length?: number;
    width?: number;
    depth?: number;
    undermining_tunneling?: string;
    treatment_frequency?: string;
    treatment_instructions?: string;
    supplies_needed?: string;
    start_date?: string;
    end_date?: string | null;
    status?: string;
    treatment_notes?: string;
    electronic_signature?: {
      path: string | null;
      name: string;
      signed_at: string;
    };
  },
) {
  return apiRequest<ApiEnvelope<{ id: number; status?: string }>>(
    `mobile/staff/patients/${patientId}/wound-orders`,
    { method: 'POST', token, body },
  );
}

export type WoundOrderProfileRow = {
  id: number;
  name: string;
  cleansing?: string | null;
  primary_dressing?: string | null;
  secondary_dressing?: string | null;
  frequency?: string | null;
  notes?: string | null;
  is_default?: boolean;
};

export type WoundOrderProfilesResponse = ApiEnvelope<WoundOrderProfileRow[]> & {
  clinician?: {
    id: number;
    name: string;
    title?: string;
    avatar_url?: string | null;
  };
};

export function getWoundOrderProfiles(token: string) {
  return apiRequest<WoundOrderProfilesResponse>('mobile/staff/wound-order-profiles', { token });
}

export function createWoundOrderProfile(
  token: string,
  body: {
    name: string;
    cleansing?: string;
    primary_dressing?: string;
    secondary_dressing?: string;
    frequency?: string;
    notes?: string;
  },
) {
  return apiRequest<ApiEnvelope<WoundOrderProfileRow>>('mobile/staff/wound-order-profiles', {
    method: 'POST',
    token,
    body,
  });
}

export function updateWoundOrderProfile(
  token: string,
  profileId: number,
  body: Partial<{
    name: string;
    cleansing: string;
    primary_dressing: string;
    secondary_dressing: string;
    frequency: string;
    notes: string;
  }>,
) {
  return apiRequest<ApiEnvelope<WoundOrderProfileRow>>(`mobile/staff/wound-order-profiles/${profileId}`, {
    method: 'PATCH',
    token,
    body,
  });
}

export function deleteWoundOrderProfile(token: string, profileId: number) {
  return apiRequest<ApiEnvelope<null>>(`mobile/staff/wound-order-profiles/${profileId}`, {
    method: 'DELETE',
    token,
  });
}

export function removePlanOfCareSection(token: string, pocId: number, section_key: string) {
  return apiRequest<ApiEnvelope<Record<string, unknown>>>(`mobile/staff/plan-of-care/${pocId}/sections`, {
    method: 'DELETE',
    token,
    body: { section_key },
  });
}

export type StaffShiftItem = {
  id: number;
  patient_id?: number;
  patient_name?: string;
  patient_phone?: string;
  patient_address?: string;
  mrn?: string;
  title?: string;
  task_type?: string;
  start_time?: string;
  end_time?: string;
  start_display?: string;
  end_display?: string;
  status?: string;
  priority?: string;
  required_role?: string | null;
  notes?: string | null;
  special_instructions?: string;
  source?: string;
  is_open?: boolean;
  awaiting_admin_approval?: boolean;
  is_admin_offer?: boolean;
};

export function staffAvailableShifts(token: string, days?: number) {
  return apiRequest<ApiEnvelope<StaffShiftItem[]> & { count?: number }>('mobile/staff/shifts/available', {
    token,
    query: days != null ? { days } : undefined,
  });
}

export function staffShiftOffers(token: string) {
  return apiRequest<ApiEnvelope<StaffShiftItem[]> & { count?: number }>('mobile/staff/shifts/offers', {
    token,
  });
}

export function claimAvailableShift(token: string, scheduleId: number) {
  return apiRequest<ApiEnvelope<StaffShiftItem>>(`mobile/staff/shifts/${scheduleId}/claim`, {
    method: 'POST',
    token,
  });
}

export function acceptShiftOffer(token: string, scheduleId: number) {
  return apiRequest<ApiEnvelope<StaffShiftItem>>(`mobile/staff/shifts/${scheduleId}/accept`, {
    method: 'POST',
    token,
  });
}

export function declineShiftOffer(token: string, scheduleId: number) {
  return apiRequest<ApiEnvelope<StaffShiftItem>>(`mobile/staff/shifts/${scheduleId}/decline`, {
    method: 'POST',
    token,
  });
}

export function withdrawShiftClaim(token: string, scheduleId: number) {
  return apiRequest<ApiEnvelope<StaffShiftItem>>(`mobile/staff/shifts/${scheduleId}/withdraw-claim`, {
    method: 'POST',
    token,
  });
}

export type StaffLicenseItem = {
  code: string;
  name: string;
  document_type?: string;
  document_id?: number | null;
  issue_date?: string | null;
  expiration_date?: string | null;
  notes?: string | null;
  verification_status?: 'empty' | 'pending' | 'verified' | 'rejected' | string;
  rejection_reason?: string | null;
  verified_at?: string | null;
  has_document?: boolean;
  file_name?: string | null;
};

export function staffLicenses(token: string) {
  return apiRequest<
    ApiEnvelope<StaffLicenseItem[]> & { meta?: { pending?: number; verified?: number; total?: number } }
  >('mobile/staff/licenses', { token });
}

export function updateStaffLicense(
  token: string,
  code: string,
  body: { issue_date?: string | null; expiration_date?: string | null; notes?: string | null },
) {
  return apiRequest<ApiEnvelope<StaffLicenseItem>>(`mobile/staff/licenses/${encodeURIComponent(code)}`, {
    method: 'PUT',
    token,
    body,
  });
}

export function uploadStaffLicenseDocument(
  token: string,
  code: string,
  body: {
    file_base64: string;
    file_name?: string;
    mime_type?: string;
    issue_date?: string | null;
    expiration_date?: string | null;
    notes?: string | null;
  },
) {
  return apiRequest<ApiEnvelope<StaffLicenseItem>>(
    `mobile/staff/licenses/${encodeURIComponent(code)}/document`,
    {
      method: 'POST',
      token,
      body,
    },
  );
}

export type StaffPayPeriodRow = {
  id: number;
  name?: string;
  start?: string;
  end?: string;
  status?: string;
  gross?: number;
  net?: number;
  regular_hours?: number;
  overtime_hours?: number;
  processing_route?: string;
  sync_status?: string | null;
  paid_at?: string | null;
};

export function staffPayrollPeriods(token: string) {
  return apiRequest<
    ApiEnvelope<StaffPayPeriodRow[]> & { ytd?: { gross: number; net: number } }
  >('mobile/staff/payroll/periods', { token });
}

export function staffPayrollPeriodDetail(token: string, periodId: number) {
  return apiRequest<ApiEnvelope<Record<string, unknown>>>(`mobile/staff/payroll/periods/${periodId}`, {
    token,
  });
}

export function disputeStaffPayrollPeriod(token: string, periodId: number, reason: string) {
  return apiRequest<ApiEnvelope<null>>(`mobile/staff/payroll/periods/${periodId}/dispute`, {
    method: 'POST',
    token,
    body: { reason },
  });
}


/* ── Incident reporting ──────────────────────────────────────────────────── */

export type IncidentReportOptions = {
  types: Record<string, string>;
  severities: Record<string, string>;
  injury_levels: Record<string, string>;
  yes_no_na: Record<string, string>;
};

export type IncidentReportRow = {
  id: number;
  report_number: string;
  incident_date: string | null;
  incident_time: string | null;
  location: string;
  severity: string;
  status: string;
  description: string;
  types: string[];
};

export type IncidentReportPayload = {
  incident_date: string;
  incident_time?: string;
  location: string;
  severity: string;
  description: string;
  types: string[];
  patient_id?: number;
  /** The visit it happened during, when the caregiver was clocked in. */
  schedule_id?: number;
  injury_level?: string;
  witnessed?: string;
  witness_names?: string;
  sentinel_event?: string;
  interventions_provided?: string;
  family_notified?: boolean;
  physician_notified?: boolean;
  follow_up_details?: string;
};

/** The lists the form offers, served so they cannot drift from the web form. */
export function getIncidentReportOptions(token: string) {
  return apiRequest<{ success: boolean } & IncidentReportOptions>(
    'mobile/staff/incident-reports/options',
    { token },
  );
}

export function getIncidentReports(token: string) {
  return apiRequest<ApiEnvelope<IncidentReportRow[]>>('mobile/staff/incident-reports', { token });
}

export function saveIncidentReport(token: string, payload: IncidentReportPayload) {
  return apiRequest<ApiEnvelope<{ id: number; report_number: string; status: string }>>(
    'mobile/staff/incident-reports',
    { method: 'POST', token, body: payload },
  );
}
