import { apiRequest } from './client';
import type { ApiEnvelope, PatientUser, ScheduleItem } from '../types';

export function patientLogin(
  email: string,
  credential: string,
  credential_type: 'dob' | 'mrn',
) {
  return apiRequest<ApiEnvelope<{ patient: PatientUser; token: string }>>('mobile/patient/auth', {
    method: 'POST',
    body: { email, credential, credential_type },
  });
}

export function patientProfile(token: string) {
  return apiRequest<ApiEnvelope<Record<string, unknown>>>('mobile/patient/profile', { token });
}

export function updatePatientProfile(token: string, body: Record<string, unknown>) {
  return apiRequest<ApiEnvelope<Record<string, unknown>>>('mobile/patient/profile', {
    method: 'PUT',
    token,
    body,
  });
}

export function patientLogout(token: string) {
  return apiRequest<ApiEnvelope<null>>('mobile/patient/logout', { method: 'POST', token });
}

export function patientMedications(token: string, status = 'active') {
  return apiRequest<ApiEnvelope<Record<string, unknown>[]>>('mobile/patient/medications', {
    token,
    query: { status },
  });
}

export function patientMedicationDetail(token: string, medicationId: number) {
  return apiRequest<ApiEnvelope<Record<string, unknown>>>(
    `mobile/patient/medications/${medicationId}`,
    { token },
  );
}

export function patientCarePlans(token: string) {
  return apiRequest<ApiEnvelope<Record<string, unknown>[]>>('mobile/patient/care-plans', { token });
}

export function patientSchedule(token: string, status = 'upcoming', limit = 20) {
  return apiRequest<ApiEnvelope<ScheduleItem[]>>('mobile/patient/schedule', {
    token,
    query: { status, limit },
  });
}

export function patientVitals(token: string, limit = 20) {
  return apiRequest<ApiEnvelope<Record<string, unknown>[]>>('mobile/patient/vitals', {
    token,
    query: { limit },
  });
}

export function patientMessages(token: string, folder = 'inbox') {
  return apiRequest<ApiEnvelope<Record<string, unknown>[]>>('mobile/patient/messages', {
    token,
    query: { folder },
  });
}

export function sendPatientMessage(
  token: string,
  body: { recipient_ids: number[]; subject: string; body: string },
) {
  return apiRequest<ApiEnvelope<{ id: number }>>('mobile/patient/messages', {
    method: 'POST',
    token,
    body,
  });
}

export function markMessageRead(token: string, messageId: number) {
  return apiRequest<ApiEnvelope<null>>(`mobile/patient/messages/${messageId}/read`, {
    method: 'PATCH',
    token,
  });
}

export function starMessage(token: string, messageId: number, starred = true) {
  return apiRequest<ApiEnvelope<null>>(`mobile/patient/messages/${messageId}/star`, {
    method: 'PATCH',
    token,
    body: { starred },
  });
}

export function deleteMessage(token: string, messageId: number) {
  return apiRequest<ApiEnvelope<null>>(`mobile/patient/messages/${messageId}`, {
    method: 'DELETE',
    token,
  });
}

export function patientCareTeam(token: string) {
  return apiRequest<ApiEnvelope<Record<string, unknown>[]>>('mobile/patient/care-team', { token });
}

export function patientNotifications(token: string) {
  return apiRequest<ApiEnvelope<Record<string, unknown>[]> & { unread?: number }>(
    'mobile/patient/notifications',
    { token },
  );
}

export function markNotificationRead(token: string, notificationId: number) {
  return apiRequest<ApiEnvelope<null>>(`mobile/patient/notifications/${notificationId}/read`, {
    method: 'PATCH',
    token,
  });
}

export function patientGrievances(token: string) {
  return apiRequest<ApiEnvelope<Record<string, unknown>[]>>('mobile/patient/grievances', { token });
}

export function submitGrievance(
  token: string,
  body: { subject: string; description: string; category?: string },
) {
  return apiRequest<ApiEnvelope<{ id: number }>>('mobile/patient/grievances', {
    method: 'POST',
    token,
    body,
  });
}

export function patientAllergies(token: string) {
  return apiRequest<ApiEnvelope<Record<string, unknown>[]>>('mobile/patient/allergies', { token });
}

export function patientDocuments(token: string) {
  return apiRequest<ApiEnvelope<Record<string, unknown>[]>>('mobile/patient/documents', { token });
}
