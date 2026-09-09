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

export function removePlanOfCareSection(token: string, pocId: number, section_key: string) {
  return apiRequest<ApiEnvelope<Record<string, unknown>>>(`mobile/staff/plan-of-care/${pocId}/sections`, {
    method: 'DELETE',
    token,
    body: { section_key },
  });
}

