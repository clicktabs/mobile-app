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

export function staffWeekSchedule(token: string, start_date?: string) {
  return apiRequest<ApiEnvelope<ScheduleItem[]> & { count?: number; week?: { start: string; end: string } }>(
    'mobile/staff/schedule/week',
    { token, query: { start_date } },
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
    }
  >('mobile/staff/schedule/upcoming', { token, query: { days, days_back } });
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

export function getMedicationSchedule(token: string, patientId: number) {
  return apiRequest<ApiEnvelope<Record<string, unknown>[]>>(
    `mobile/staff/patients/${patientId}/medication-schedule`,
    { token },
  );
}

export function administerMedication(token: string, patientId: number, body: Record<string, unknown>) {
  return apiRequest<ApiEnvelope<{ id: number }>>(`mobile/staff/patients/${patientId}/medication-admin`, {
    method: 'POST',
    token,
    body,
  });
}

export function getPatientAllergies(token: string, patientId: number) {
  return apiRequest<ApiEnvelope<Record<string, unknown>[]>>(
    `mobile/staff/patients/${patientId}/allergies`,
    { token },
  );
}

export function getCommNotes(token: string, patientId: number) {
  return apiRequest<ApiEnvelope<Record<string, unknown>[]>>(
    `mobile/staff/patients/${patientId}/comm-notes`,
    { token },
  );
}

export function createCommNote(token: string, patientId: number, note: string, type = 'general') {
  return apiRequest<ApiEnvelope<{ id: number }>>(`mobile/staff/patients/${patientId}/comm-notes`, {
    method: 'POST',
    token,
    body: { note, type },
  });
}

export function getStaffMessages(token: string, folder = 'inbox') {
  return apiRequest<ApiEnvelope<Record<string, unknown>[]>>('mobile/staff/messages', {
    token,
    query: { folder },
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

