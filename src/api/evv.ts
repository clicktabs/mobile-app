import { apiRequest } from './client';
import type { EvvVisit } from '../types';
import { storageGet, storageSet } from '../utils/storage';

type EvvVisitsResponse = {
  success: boolean;
  visits: EvvVisit[];
  active_schedule_id?: number | null;
  message?: string;
};

export type EvvServiceRendered = {
  id: string;
  label: string;
  completed: boolean;
  exception_reason?: string | null;
};

/**
 * A clock-in or clock-out held on the device until there is a network.
 *
 * This carries the same evidence the online endpoints refuse to proceed without —
 * attestation, the patient signature, and the task list with a reason against
 * anything not done. Queueing a thinner event than the online call would send is
 * how an offline visit ends up closed with no signature and no attestation on it.
 */
export type OfflineEvvEvent = {
  /**
   * Generated here and echoed back by the server, so a result is matched to the
   * event it belongs to rather than to whatever sits at the same array index.
   */
  client_event_id: string;
  type: 'checkin' | 'checkout';
  patient_schedule_id: number;
  occurred_at: string;
  latitude: number;
  longitude: number;
  gps_accuracy?: number;
  verification_method?: string;
  notes?: string;
  device_id?: string;
  app_version?: string;
  platform?: string;
  /** Clock-out only. */
  services_rendered?: EvvServiceRendered[];
  patient_signature?: string;
  attestation_verified?: boolean;
  geofence_exception_reason?: string;
  location_type?: 'home' | 'community' | 'facility' | 'other';
};

type StoredEvent = OfflineEvvEvent & {
  /** Sync attempts so far. A transient failure must not retry without end. */
  attempts?: number;
};

export type RejectedEvvEvent = {
  event: StoredEvent;
  status: string;
  reason: string;
  rejected_at: string;
};

type OfflineSyncResult = {
  client_event_id?: string;
  patient_schedule_id?: number;
  status: string;
  reason?: string;
  /** The server's own word on whether sending this again could ever work. */
  retryable?: boolean;
};

type OfflineSyncResponse = {
  success: boolean;
  results?: OfflineSyncResult[];
};

export type FlushOutcome = {
  accepted: number;
  /** Still queued — a transient failure, or the server said nothing about it. */
  kept: number;
  /** Refused for a reason that resending cannot fix. Held for the office, never dropped. */
  rejected: number;
  rejections: RejectedEvvEvent[];
};

const OFFLINE_KEY = 'ct_evv_offline_queue';
const REJECTED_KEY = 'ct_evv_offline_rejected';

/** After this many failed attempts an event stops retrying and becomes visible instead. */
const MAX_SYNC_ATTEMPTS = 5;

const ACCEPTED_STATUSES = ['checkin_ok', 'checkout_ok'];

function newEventId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readList<T>(key: string): Promise<T[]> {
  const raw = (await storageGet(key)) || '[]';
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function writeList(key: string, list: unknown[]) {
  await storageSet(key, JSON.stringify(list));
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
    services_rendered?: EvvServiceRendered[];
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

export async function queueOfflineEvvEvent(event: Omit<OfflineEvvEvent, 'client_event_id'>) {
  const list = await readList<StoredEvent>(OFFLINE_KEY);
  list.push({ ...event, client_event_id: newEventId(), attempts: 0 });
  await writeList(OFFLINE_KEY, list);
}

/**
 * Send what is queued and keep whatever the server did not take.
 *
 * offline-sync answers 200 with a per-event verdict, so the response being OK says
 * nothing about any individual visit. Clearing the queue on a 200 is how a refused
 * clock-out disappears from the phone having never been written anywhere — the care
 * happened, and no record of it exists on either side.
 *
 * So each event is cleared only against its own verdict: accepted ones go, transient
 * failures stay queued, and a refusal that resending cannot fix moves to a rejected
 * list that is surfaced rather than deleted.
 */
export async function flushOfflineEvvQueue(token: string): Promise<FlushOutcome> {
  const queue = await readList<StoredEvent>(OFFLINE_KEY);

  if (!queue.length) {
    return { accepted: 0, kept: 0, rejected: 0, rejections: [] };
  }

  // A network or auth failure throws out of here, and the queue is left untouched.
  const res = await apiRequest<OfflineSyncResponse>('mobile/evv/offline-sync', {
    method: 'POST',
    token,
    body: { events: queue },
  });

  const verdicts = new Map<string, OfflineSyncResult>();
  (res.results || []).forEach((r, i) => {
    // Position is the fallback for a server that does not echo the id yet.
    const id = r.client_event_id || queue[i]?.client_event_id;
    if (id) verdicts.set(id, r);
  });

  const keep: StoredEvent[] = [];
  const rejections: RejectedEvvEvent[] = [];
  let accepted = 0;

  for (const event of queue) {
    const verdict = verdicts.get(event.client_event_id);
    const attempts = (event.attempts ?? 0) + 1;

    if (!verdict) {
      // No verdict means we cannot say it landed, so we keep it.
      keep.push({ ...event, attempts });
      continue;
    }

    if (ACCEPTED_STATUSES.includes(verdict.status)) {
      accepted += 1;
      continue;
    }

    const serverSaysRetry = verdict.retryable !== false;
    const gaveUp = attempts >= MAX_SYNC_ATTEMPTS;

    if (serverSaysRetry && !gaveUp) {
      keep.push({ ...event, attempts });
      continue;
    }

    rejections.push({
      event: { ...event, attempts },
      status: verdict.status,
      reason:
        (verdict.reason || verdict.status) +
        (serverSaysRetry && gaveUp ? ` (gave up after ${attempts} attempts)` : ''),
      rejected_at: new Date().toISOString(),
    });
  }

  await writeList(OFFLINE_KEY, keep);

  if (rejections.length) {
    const held = await readList<RejectedEvvEvent>(REJECTED_KEY);
    await writeList(REJECTED_KEY, [...held, ...rejections]);
  }

  return { accepted, kept: keep.length, rejected: rejections.length, rejections };
}

export async function pendingOfflineEvvCount() {
  return (await readList<StoredEvent>(OFFLINE_KEY)).length;
}

/** Events the server refused. They are kept until somebody deals with them. */
export async function rejectedOfflineEvvEvents(): Promise<RejectedEvvEvent[]> {
  return readList<RejectedEvvEvent>(REJECTED_KEY);
}

export async function rejectedOfflineEvvCount() {
  return (await readList<RejectedEvvEvent>(REJECTED_KEY)).length;
}

/** Discard the rejected list. Only ever on a deliberate acknowledgement by the user. */
export async function clearRejectedOfflineEvvEvents() {
  await writeList(REJECTED_KEY, []);
}

/** Flush, swallowing transport errors. The queue survives whatever this hides. */
export async function flushQueueEvvSafe(token: string): Promise<FlushOutcome> {
  try {
    return await flushOfflineEvvQueue(token);
  } catch {
    return { accepted: 0, kept: await pendingOfflineEvvCount(), rejected: 0, rejections: [] };
  }
}
