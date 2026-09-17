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
  /** How many times we have tried to send this. Absent on events queued before this. */
  attempts?: number;
};

const OFFLINE_KEY = 'ct_evv_offline_queue';

/**
 * Events the server refused for a reason retrying cannot fix.
 *
 * Kept rather than discarded: a clock-in rejected for being outside the geofence is
 * still the only evidence that the caregiver was there, and the office has to see it.
 */
const REJECTED_KEY = 'ct_evv_offline_rejected';

/** Give up re-sending after this many attempts, and park the event for review. */
const MAX_ATTEMPTS = 5;

type OfflineSyncResult = {
  patient_schedule_id: number;
  status: string;
  reason?: string;
  evv_visit_id?: number;
};

export type RejectedEvvEvent = OfflineEvvEvent & {
  rejected_reason: string;
  rejected_at: string;
};

/**
 * Reasons the server will give the same answer to no matter how often we ask.
 *
 * Anything not listed here — a timeout, a 500, an unrecognised reason — is treated as
 * worth retrying, because assuming otherwise throws away real work.
 */
const PERMANENT_REASONS = new Set([
  'unauthorized',
  'outside_geofence',
  'no_evv_provider_configured',
  'active_visit_exists',
  'no_active_checkin',
]);

/** The server already has this event. Not an error — the outcome we wanted. */
const ALREADY_DONE = new Set(['checkin_ok', 'checkout_ok', 'already_checked_in']);

async function readList<T>(key: string): Promise<T[]> {
  const raw = (await storageGet(key)) || '[]';
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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
  const list = await readList<OfflineEvvEvent>(OFFLINE_KEY);
  list.push({ ...event, attempts: 0 });
  await storageSet(OFFLINE_KEY, JSON.stringify(list));
}

/**
 * Send queued events, and remove only the ones the server actually took.
 *
 * This used to clear the whole queue the moment the request returned 200, regardless of
 * what was in the response. The endpoint reports per-event outcomes and a 200 means "I
 * processed the batch", not "I accepted everything" — so a clock-in rejected for a
 * geofence or a duplicate was silently destroyed, leaving the visit with no EVV record
 * and nobody any the wiser.
 *
 * Now each event is matched to its own result and one of three things happens: accepted
 * events are dropped, permanently refused events are parked for the office to see, and
 * anything that might yet succeed stays in the queue.
 */
export async function flushOfflineEvvQueue(token: string) {
  const list = await readList<OfflineEvvEvent>(OFFLINE_KEY);

  if (!list.length) {
    return { success: true, results: [], flushed: 0, rejected: 0, retrying: 0 };
  }

  const res = await apiRequest<{ success: boolean; results: OfflineSyncResult[] }>(
    'mobile/evv/offline-sync',
    {
      method: 'POST',
      token,
      body: { events: list.map(({ attempts, ...event }) => event) },
      // Queued work is the last copy of a visit that already happened; give it longer
      // than an interactive request before deciding the network is gone.
      timeoutMs: 30_000,
    },
  );

  const results = Array.isArray(res.results) ? res.results : [];

  const keep: OfflineEvvEvent[] = [];
  const rejected: RejectedEvvEvent[] = [];
  let flushed = 0;

  list.forEach((event, index) => {
    // Results come back in the order the events were sent. Matching on schedule id
    // alone would be ambiguous: a clock-in and its clock-out share one.
    const result = results[index];

    if (!result) {
      // The server said nothing about this event, so nothing is known. Keep it.
      keep.push({ ...event, attempts: (event.attempts ?? 0) + 1 });
      return;
    }

    if (ALREADY_DONE.has(result.status)) {
      flushed += 1;
      return;
    }

    const reason = result.status === 'unauthorized' ? 'unauthorized' : result.reason ?? 'unknown';
    const attempts = (event.attempts ?? 0) + 1;

    if (PERMANENT_REASONS.has(reason) || attempts >= MAX_ATTEMPTS) {
      rejected.push({
        ...event,
        rejected_reason: reason,
        rejected_at: new Date().toISOString(),
      });
      return;
    }

    keep.push({ ...event, attempts });
  });

  await storageSet(OFFLINE_KEY, JSON.stringify(keep));

  if (rejected.length) {
    const existing = await readList<RejectedEvvEvent>(REJECTED_KEY);
    await storageSet(REJECTED_KEY, JSON.stringify([...existing, ...rejected]));
  }

  return { ...res, flushed, rejected: rejected.length, retrying: keep.length };
}

export async function pendingOfflineEvvCount() {
  return (await readList<OfflineEvvEvent>(OFFLINE_KEY)).length;
}

/**
 * What this device knows about a visit that has not reached the server yet.
 *
 * Derived from the queue rather than tracked separately, so there is one source of truth
 * and it cleans itself up: once an event is accepted it leaves the queue, and the server
 * becomes the answer again.
 *
 * This exists because documentation was gated on server state alone. Offline, a queued
 * clock-in is real to the caregiver standing in the patient's house, and invisible to the
 * server — so the app refused to let them document the visit they were on.
 */
export async function localVisitState(scheduleId: number): Promise<{
  checkedIn: boolean;
  checkedInAt: string | null;
  checkedOut: boolean;
}> {
  const queue = await readList<OfflineEvvEvent>(OFFLINE_KEY);
  const mine = queue.filter((e) => Number(e.patient_schedule_id) === Number(scheduleId));

  const checkin = mine.filter((e) => e.type === 'checkin').pop();
  const checkout = mine.filter((e) => e.type === 'checkout').pop();

  return {
    checkedIn: !!checkin,
    checkedInAt: checkin?.occurred_at ?? null,
    checkedOut: !!checkout,
  };
}

/** Events the server refused outright. These need a person, not another retry. */
export async function rejectedOfflineEvvEvents(): Promise<RejectedEvvEvent[]> {
  return readList<RejectedEvvEvent>(REJECTED_KEY);
}

export async function clearRejectedOfflineEvvEvents() {
  await storageSet(REJECTED_KEY, '[]');
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
