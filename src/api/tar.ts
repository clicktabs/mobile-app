import { apiRequest } from './client';

/**
 * The Treatment Administration Record, on the phone.
 *
 * Its own module rather than a corner of the MAR, because a treatment is not a dose. A wound
 * dressing has a site, supplies to bring and a result worth writing down — how the wound
 * looked, how the patient tolerated it — and none of that fits a medication row.
 *
 * The vocabulary differs too: a treatment is `completed`, not `given`.
 */

export type TarStatus = 'scheduled' | 'pending' | 'completed' | 'refused' | 'missed';

export type TarTreatment = {
  id: number;
  /** HH:MM it was due. */
  time: string | null;
  treatment: string;
  type: string | null;
  description: string | null;
  /** What to bring — the difference between arriving prepared and not. */
  supplies: string | null;
  wound_stage: string | null;
  status: TarStatus;
  is_late: boolean;
  administered_at: string | null;
  administered_by: string | null;
  reason: string | null;
  /** How the patient tolerated it. */
  patient_response: string | null;
  notes: string | null;
  /**
   * What was actually done, as against `description`, which is the order's words.
   *
   * Usually the same thing said twice. The times it is not are exactly the times a
   * treatment record needs to be able to say so.
   */
  performed: string | null;
  /**
   * The order behind this treatment has moved since it was recorded.
   *
   * Null in the ordinary case. A TAR row is an attestation, so it is never rewritten once
   * somebody has acted on it — which means the order can change underneath it. This says
   * so, rather than letting the row read as though it still matches what was ordered.
   */
  order_changed: {
    state: 'changed' | 'order_missing';
    changes: { field: string; recorded: string | null; ordered: string | null }[];
  } | null;
};

export type TarDay = {
  success: boolean;
  date: string;
  patient: { id: number; name: string };
  treatments: TarTreatment[];
  summary: { due: number; late: number; completed: number; not_done: number };
  /**
   * Ordered, but not on anyone's list.
   *
   * "3x Weekly" says how often without saying which days, and nothing picks them — so the
   * treatment is invisible until the office names the days. The person in the home should
   * know that rather than assume it was never ordered.
   */
  unscheduled: { treatment: string; frequency: string; reason: string }[];
  /**
   * Wounds on the chart that no treatment order covers.
   *
   * Different from `unscheduled`: those are ordered and cannot be placed on a day, these
   * are not ordered at all. Both produce nothing, and in the home both look identical to
   * a patient with no wound — which is the reason to say so.
   */
  unordered_wounds: { wound: string; reason: string }[];
};

export function getDay(token: string, patientId: number, date?: string) {
  return apiRequest<TarDay>(`mobile/staff/patients/${patientId}/tar`, {
    token,
    query: date ? { date } : undefined,
  });
}

/** Record what happened to a treatment. A reason is required unless it was completed. */
export function recordTreatment(
  token: string,
  patientId: number,
  recordId: number,
  body: {
    status: 'completed' | 'refused' | 'missed';
    reason?: string;
    patient_response?: string;
    notes?: string;
  },
) {
  return apiRequest<{ success: boolean; message: string }>(
    `mobile/staff/patients/${patientId}/tar/treatments/${recordId}`,
    { method: 'POST', token, body },
  );
}
