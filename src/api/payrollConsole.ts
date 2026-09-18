import { apiRequest } from './client';

/**
 * The Payroll Console, on the phone.
 *
 * Every rule behind these calls is the web console's — the server hands both surfaces to
 * the same HoursApprovalService, ComplianceGateService and EVVPayrollIntegrationService.
 * What differs is shape: figures already reduced to what fits a phone, rather than a
 * six-column table.
 *
 * Payout and sync are absent on purpose. They commit a batch to an external payer and
 * cannot be recalled, so they stay on the web where everything being committed is on
 * screen at once.
 */

export type PayrollPeriodRow = {
  id: number;
  name: string;
  period_start: string | null;
  period_end: string | null;
  pay_date: string | null;
  status: 'draft' | 'processing' | 'approved' | 'paid' | 'closed' | string;
  /** False once paid, closed or locked — a settled period is a record, not a form. */
  is_open: boolean;
  entries: number;
  /**
   * What this period currently amounts to — Stage 01's figures.
   *
   * Read from the calculated entries rather than recomputed from EVV, so the phone and
   * the web console cannot report different totals for the same period. Zeroes until the
   * period is priced, which is itself the answer to "where is this up to".
   */
  figures?: {
    people: number;
    gross: number;
    net: number;
    hours: number;
    overtime: number;
    visits: number;
  };
};

export type HoursTotals = {
  pending: number;
  pending_hours: number;
  approved_hours: number;
  rejected: number;
  incomplete: number;
  /** Waiting hours whose visit note is unwritten or still a draft. */
  undocumented: number;
};

export type QueueVisit = {
  id: number;
  service_date: string | null;
  start_time: string | null;
  patient_name: string;
  hours: number | null;
  approval_status: 'pending' | 'approved' | 'rejected' | string;
  approval_note: string | null;
  approved_by: string | null;
  documentation: string;
  documentation_label: string;
  /** True when the note is expected and unfinished, so approving needs the override. */
  blocks_approval: boolean;
};

export type QueueGroup = {
  caregiver_id: number;
  caregiver_name: string;
  pending: number;
  pending_hours: number;
  approved_hours: number;
  visits: QueueVisit[];
};

export type BatchEntry = {
  id: number;
  caregiver_name: string;
  regular_hours: number;
  overtime_hours: number;
  gross_pay: number;
  net_pay: number;
  pay_type: string | null;
};

export type GateSummary = {
  people: number;
  blocked: number;
  held: number;
  ready_people: number;
  ready_net: number;
  total_net: number;
  /** The batch may only be approved when this is true. */
  open: boolean;
};

export type GateFinding = {
  id: number;
  caregiver_name: string;
  check_type: string;
  check_label: string;
  severity: 'block' | 'hold' | 'pass' | string;
  finding: string | null;
  released: boolean;
  released_by: string | null;
  release_reason: string | null;
  /** A block has no release path by design — the app must not offer one. */
  releasable: boolean;
};

const BASE = 'mobile/staff/payroll/console';

export function getPeriods(token: string) {
  return apiRequest<{
    success: boolean;
    data: PayrollPeriodRow[];
    orphaned: { count: number; hours: number; from: string | null; to: string | null };
  }>(`${BASE}/periods`, { token });
}

export function createPeriod(
  token: string,
  body: { period_start: string; period_end: string; pay_date?: string; period_name?: string },
) {
  return apiRequest<{ success: boolean; message?: string; data?: PayrollPeriodRow }>(
    `${BASE}/periods`,
    { method: 'POST', token, body },
  );
}

export function getHours(token: string, periodId?: number) {
  return apiRequest<{
    success: boolean;
    period: PayrollPeriodRow | null;
    data: QueueGroup[];
    totals: HoursTotals;
  }>(`${BASE}/hours`, { token, query: periodId ? { period: periodId } : undefined });
}

export function approveHours(
  token: string,
  body: { visit_ids: number[]; note?: string; allow_undocumented?: boolean },
) {
  return apiRequest<{
    success: boolean;
    approved: number;
    without_hours: number;
    undocumented: number;
    message: string;
  }>(`${BASE}/hours/approve`, { method: 'POST', token, body });
}

export function rejectHours(token: string, body: { visit_ids: number[]; note: string }) {
  return apiRequest<{ success: boolean; rejected: number; message: string }>(
    `${BASE}/hours/reject`,
    { method: 'POST', token, body },
  );
}

export function getBatch(token: string, periodId?: number) {
  return apiRequest<{
    success: boolean;
    period: PayrollPeriodRow | null;
    data: BatchEntry[];
    totals: { people: number; hours: number; gross: number; net: number };
  }>(`${BASE}/batch`, { token, query: periodId ? { period: periodId } : undefined });
}

export function calculate(token: string, periodId: number, preview = false) {
  return apiRequest<{
    success: boolean;
    preview: boolean;
    generated: number;
    /** Named rather than counted: "no active pay rate" says what to go and fix. */
    skipped: string[];
    warnings: string[];
    message: string;
  }>(`${BASE}/periods/${periodId}/calculate`, { method: 'POST', token, body: { preview } });
}

export function getGate(token: string, periodId?: number) {
  return apiRequest<{
    success: boolean;
    period: PayrollPeriodRow | null;
    summary: GateSummary | null;
    data: GateFinding[];
  }>(`${BASE}/gate`, { token, query: periodId ? { period: periodId } : undefined });
}

export function runGate(token: string, periodId: number) {
  return apiRequest<{ success: boolean; summary: GateSummary; message: string }>(
    `${BASE}/periods/${periodId}/gate`,
    { method: 'POST', token, body: {} },
  );
}

export function releaseCheck(token: string, checkId: number, reason: string) {
  return apiRequest<{ success: boolean; message: string }>(
    `${BASE}/gate-checks/${checkId}/release`,
    { method: 'POST', token, body: { reason } },
  );
}

export function approveBatch(token: string, periodId: number) {
  return apiRequest<{ success: boolean; message: string; data?: PayrollPeriodRow }>(
    `${BASE}/periods/${periodId}/approve`,
    { method: 'POST', token, body: {} },
  );
}
