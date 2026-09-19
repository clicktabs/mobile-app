import { apiRequest } from './client';

/**
 * The Medication Administration Record, on the phone.
 *
 * Reads and writes the same `mar_records` the patient chart does, through the same schedule
 * builder — so a dose cannot be due at 09:00 in the office and 08:00 in somebody's hand, and
 * "given" cannot mean two different things.
 *
 * The shape differs from the chart's. The office reads a grid of a whole day; somebody
 * working a visit wants a list in time order, because the question is what is due next.
 *
 * Treatments are deliberately not here — see `tar.ts`. A wound dressing has a site, supplies
 * and a result worth writing down, none of which fits a medication row.
 */

/** What the mar_records CHECK constraint allows. */
export type MarStatus = 'pending' | 'given' | 'refused' | 'missed' | 'held' | 'discontinued';

export type MarDose = {
  id: number;
  /** HH:MM it was due. */
  time: string | null;
  medication: string;
  dose: string | null;
  route: string | null;
  instructions: string | null;
  status: MarStatus;
  /**
   * Past its time and still untouched.
   *
   * Late, not missed — missed is a judgement somebody has to make, and an hour's grace stops
   * the list crying wolf over a dose ten minutes out.
   */
  is_late: boolean;
  administered_at: string | null;
  administered_by: string | null;
  dose_given: string | null;
  reason: string | null;
  notes: string | null;
  is_prn: boolean;
  prn_reason: string | null;
  prn_response: string | null;
  /** Given, but nobody has said yet whether it worked. */
  awaiting_response: boolean;
};

export type PrnOrder = {
  order_id: number;
  medication: string;
  dose: string | null;
  route: string | null;
  instructions: string | null;
  doses_today: MarDose[];
};

export type MarDay = {
  success: boolean;
  date: string;
  patient: { id: number; name: string };
  doses: MarDose[];
  summary: { due: number; late: number; given: number; not_given: number };
  prn: PrnOrder[];
  /**
   * Ordered, but with a frequency nothing could turn into times.
   *
   * Surfaced here as well as on the chart: the caregiver is the one who will notice a
   * medication sitting in the pill box that is not on their list.
   */
  unscheduled: { medication: string; dose: string | null; frequency: string | null }[];
};

export function getDay(token: string, patientId: number, date?: string) {
  return apiRequest<MarDay>(`mobile/staff/patients/${patientId}/mar`, {
    token,
    query: date ? { date } : undefined,
  });
}

/** Record what happened to a scheduled dose. A reason is required unless it was given. */
export function recordDose(
  token: string,
  patientId: number,
  recordId: number,
  body: {
    status: 'given' | 'refused' | 'missed' | 'held';
    reason?: string;
    dose_given?: string;
    notes?: string;
  },
) {
  return apiRequest<{ success: boolean; message: string }>(
    `mobile/staff/patients/${patientId}/mar/doses/${recordId}`,
    { method: 'POST', token, body },
  );
}

/** A dose given because it was needed. The reason is the whole record. */
export function recordPrn(
  token: string,
  patientId: number,
  body: { patient_medication_id: number; prn_reason: string; dose_given?: string; notes?: string },
) {
  return apiRequest<{ success: boolean; message: string; dose: { id: number; awaiting_response: boolean } }>(
    `mobile/staff/patients/${patientId}/mar/prn`,
    { method: 'POST', token, body },
  );
}

/** Whether it helped — the follow-up that finishes a PRN entry. */
export function recordPrnResponse(token: string, patientId: number, recordId: number, prn_response: string) {
  return apiRequest<{ success: boolean; message: string }>(
    `mobile/staff/patients/${patientId}/mar/prn/${recordId}/response`,
    { method: 'POST', token, body: { prn_response } },
  );
}
