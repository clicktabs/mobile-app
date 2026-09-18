import { apiRequest } from './client';

/**
 * Quality Assurance, on the phone.
 *
 * Two audiences share these calls because they share the data:
 *
 *   a clinician  asks "did my notes pass, and what am I being asked to fix"
 *   a reviewer   asks "what is waiting, and what have I taken"
 *
 * `can_access_qa` gets the first; `can_approve_qa` additionally gets the second. The
 * server decides both — the app only chooses what to render.
 *
 * Approve and reject are absent on purpose. A QA decision is made against the whole
 * document, which the web review screen shows and a summary card does not; approving from
 * a card would be approving something you did not read. What the phone can do honestly is
 * assign: take an item so the team knows it is yours, then open it on the web to decide.
 */

const BASE = 'mobile/staff/qa';

/** One of a clinician's own notes, and what QA said about it. */
export type MyNote = {
  id: number;
  patient_name: string;
  visit_date: string | null;
  visit_type: string | null;
  qa_status: string;
  /** Sent back for correction — this one is work. */
  needs_revision: boolean;
  /** Filed and waiting on a reviewer — nothing to do but wait. */
  awaiting: boolean;
  feedback: string | null;
  reviewer: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
};

/** A document waiting in the queue, reduced to what fits a card. */
export type QaItem = {
  id: number;
  type: string | null;
  type_label: string | null;
  patient_name: string;
  patient_mrn: string | null;
  detail: string | null;
  source: string | null;
  status_label: string | null;
  submitted_at: string | null;
  /** How long it has sat. The number a reviewer actually triages on. */
  waiting_days: number | null;
};

export type QaTypeSummary = {
  key: string;
  label: string;
  pending: number;
  /**
   * This type could not be read at all.
   *
   * Reported rather than shown as zero: "nothing waiting" and "this could not be read"
   * are different answers, and only one of them means there is no work.
   */
  unavailable: boolean;
  items?: QaItem[];
};

export type QaDashboard = {
  success: boolean;
  is_reviewer: boolean;
  mine: {
    total: number;
    needs_revision: number;
    awaiting: number;
    recent: MyNote[];
  };
  /** Absent entirely for a clinician who does not review — not an empty queue. */
  queue?: {
    pending_total: number;
    assigned_to_me: number;
    types: QaTypeSummary[];
  };
};

export function getDashboard(token: string) {
  return apiRequest<QaDashboard>(BASE, { token });
}

export function getMine(token: string) {
  return apiRequest<{ success: boolean; notes: MyNote[] }>(`${BASE}/mine`, { token });
}

export function getQueue(token: string) {
  return apiRequest<{
    success: boolean;
    pending_total: number;
    types: QaTypeSummary[];
    assigned_to_me: QaItem[];
  }>(`${BASE}/queue`, { token });
}

export function getQueueType(token: string, type: string) {
  return apiRequest<{ success: boolean; key: string; label: string; items: QaItem[] }>(
    `${BASE}/queue/${type}`,
    { token },
  );
}

export function assignItem(token: string, type: string, id: number) {
  return apiRequest<{ success: boolean; message: string }>(
    `${BASE}/items/${type}/${id}/assign`,
    { method: 'POST', token, body: {} },
  );
}

export function getHistory(token: string, type: string, id: number) {
  return apiRequest<{
    success: boolean;
    history: {
      action: string | null;
      detail: string | null;
      feedback: string | null;
      reviewer: string | null;
      at: string | null;
    }[];
  }>(`${BASE}/items/${type}/${id}/history`, { token });
}

/* ------------------------------------------------------------------- opening one item */

/** A headed block of the note, as the app rendered it when the nurse filed it. */
export type QaSection = {
  /** Null for the note's own header lines, which come before the first `[Section]`. */
  heading: string | null;
  lines: string[];
};

export type QaDocument = {
  success: boolean;
  id: number;
  type: string;
  type_label: string;
  patient_name: string;
  patient_mrn?: string | null;
  author?: string | null;
  visit_date?: string | null;
  visit_type?: string | null;
  qa_status?: string;
  submitted_at?: string | null;
  revision?: number | null;
  /** What QA asked for last time — the reviewer of a resubmission needs it. */
  prior_feedback?: string | null;
  prior_reviewer?: string | null;
  signed_by?: string | null;
  signed_at?: string | null;
  /**
   * Whether the note itself is in `sections`.
   *
   * False means the header is all there is — an OASIS assessment or a CMS-485 has no
   * readable rendering anywhere — and the server will refuse a decision on it. The screen
   * shows `reason` instead of a decision.
   */
  reviewable: boolean;
  reason?: string | null;
  sections: QaSection[];
  history: {
    action: string | null;
    detail: string | null;
    feedback: string | null;
    reviewer: string | null;
    at: string | null;
  }[];
};

export function getDocument(token: string, type: string, id: number) {
  return apiRequest<QaDocument>(`${BASE}/items/${type}/${id}`, { token });
}

/**
 * Approve the document, or send it back with feedback.
 *
 * Runs the same QaType::approve()/reject() the web console calls, so "approved" means
 * the same thing on both. A rejection must carry feedback — the server refuses one
 * without it, because a note sent back with no reason cannot be fixed.
 */
export function decide(
  token: string,
  type: string,
  id: number,
  body: { decision: 'approve' | 'reject'; feedback?: string; signature_pin?: string },
) {
  return apiRequest<{ success: boolean; message: string }>(
    `${BASE}/items/${type}/${id}/decide`,
    { method: 'POST', token, body },
  );
}
