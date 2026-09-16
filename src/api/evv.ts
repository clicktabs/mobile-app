import { apiRequest } from './client';
import type { EvvVisit } from '../types';
import { storageGet, storageSet } from '../utils/storage';

type EvvVisitsResponse = {
  success: boolean;
  visits: EvvVisit[];
  active_schedule_id?: number | null;
  message?: string;
};

type OfflineEvvEvent = {
  type: 'checkin' | 'checkout';
  patient_schedule_id: number;
  occurred_at: string;
  latitude: number;
  longitude: number;
  gps_accuracy?: number;
  verification_method?: string;
  notes?: string;
};

const OFFLINE_KEY = 'ct_evv_offline_queue';

export function getEvvVisits(
  token: string,
  opts?: { from?: string; to?: string; days_past?: number; days_ahead?: number; schedule_id?: number },
) {
  return apiRequest<EvvVisitsResponse>('mobile/evv/visits', {
    token,
    query: {
      from: opts?.from,
      to: opts?.to,
      days_past: opts?.days_past,
      days_ahead: opts?.days_ahead,
      schedule_id: opts?.schedule_id,
    },
  });
}

export function getEvvVisit(token: string, scheduleId: number) {
  return apiRequest<{ success: boolean; visit: EvvVisit; message?: string }>(
    `mobile/evv/visits/${scheduleId}`,
    { token },
  );
}

export function evvCheckin(
  token: string,
  scheduleId: number,
  body: {
    latitude: number;
    longitude: number;
    gps_accuracy?: number;
    verification_method?: string;
    device_id?: string;
    app_version?: string;
    platform?: string;
    biometric_attestation?: string;
    telephony_session_id?: string;
  },
) {
  return apiRequest<{
    success: boolean;
    message?: string;
    evv_visit_id?: number;
    check_in_time?: string;
    gps?: unknown;
  }>(`mobile/evv/visits/${scheduleId}/checkin`, {
    method: 'POST',
    token,
    body,
  });
}

export function evvCheckout(
  token: string,
  scheduleId: number,
  body: {
    latitude: number;
    longitude: number;
    gps_accuracy?: number;
    notes?: string;
    verification_method?: string;
    device_id?: string;
    app_version?: string;
    platform?: string;
    services_rendered?: {
      id: string;
      label: string;
      completed: boolean;
      exception_reason?: string | null;
    }[];
    patient_signature?: string;
    attestation_verified?: boolean;
    geofence_exception_reason?: string;
    location_type?: 'home' | 'community' | 'facility' | 'other';
  },
) {
  return apiRequest<{
    success: boolean;
    message?: string;
    check_out_time?: string;
    duration_minutes?: number;
    verification_status?: string;
    compliance_issues?: unknown;
    compliance_score?: number;
    gps?: unknown;
    sandata_queued?: boolean;
    requires_geofence_exception?: boolean;
  }>(`mobile/evv/visits/${scheduleId}/checkout`, {
    method: 'POST',
    token,
    body,
  });
}

export function initiateTelephony(token: string, scheduleId: number) {
  return apiRequest<{ success: boolean; session_id?: string; message?: string }>(
    `mobile/evv/visits/${scheduleId}/telephony`,
    { method: 'POST', token, body: {} },
  );
}

export async function queueOfflineEvvEvent(event: OfflineEvvEvent) {
  const raw = (await storageGet(OFFLINE_KEY)) || '[]';
  let list: OfflineEvvEvent[] = [];
  try {
    list = JSON.parse(raw);
  } catch {
    list = [];
  }
  list.push(event);
  await storageSet(OFFLINE_KEY, JSON.stringify(list));
}

export async function flushOfflineEvvQueue(token: string) {
  const raw = (await storageGet(OFFLINE_KEY)) || '[]';
  let list: OfflineEvvEvent[] = [];
  try {
    list = JSON.parse(raw);
  } catch {
    list = [];
  }
  if (!list.length) {
    return { success: true, results: [], flushed: 0 };
  }

  const res = await apiRequest<{ success: boolean; results: unknown[] }>('mobile/evv/offline-sync', {
    method: 'POST',
    token,
    body: { events: list },
  });
  await storageSet(OFFLINE_KEY, '[]');
  return { ...res, flushed: list.length };
}

export async function pendingOfflineEvvCount() {
  const raw = (await storageGet(OFFLINE_KEY)) || '[]';
  try {
    return JSON.parse(raw).length || 0;
  } catch {
    return 0;
  }
}

/** Flush offline queue; returns count flushed (0 on empty/error). */
export async function flushQueueEvvSafe(token: string): Promise<number> {
  try {
    const res = await flushOfflineEvvQueue(token);
    return res.flushed || 0;
  } catch {
    return 0;
  }
}
