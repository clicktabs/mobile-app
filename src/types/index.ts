export type UserRole = string;

export type StaffUser = {
  id: number;
  name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  role?: UserRole;
  /** Human-readable role, from the org role's display name — "Home Health Aide". */
  role_label?: string;
  /**
   * Whether this person's patient and schedule lists cover the whole agency.
   *
   * Decided by the server, which owns the rule. Used for labelling: a Director of
   * Nursing sees "Patients", a caregiver sees "My Patients".
   */
  sees_whole_agency?: boolean;
  /**
   * Whether this person may book a visit — "Schedule Visits/Activities" in the web app's
   * role settings, which the Scheduler role exists to carry.
   *
   * Stored from login so the calendar icon is right on first paint, then corrected by
   * every schedule load: this payload is written once at sign-in and never refreshed, so
   * on its own it would go stale the moment a permission changed.
   */
  can_create_schedules?: boolean;
  /**
   * Whether this person may open the Payroll Console.
   *
   * The console stays a web screen — its stages move money and want the whole batch in
   * view — so the app links out to it rather than rebuilding it. This decides whether the
   * link is offered, since following it without the permission only produces an error in
   * a browser the user then has to close.
   */
  can_manage_payroll?: boolean;
  is_super_admin?: boolean;
  department?: string;
  organization_id?: number;
  organization_name?: string;
};

export type PatientUser = {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  mrn?: string;
};

export type AuthPersona = 'staff' | 'patient';

export type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
  error?: string;
  count?: number;
  pagination?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
};

export type ScheduleItem = {
  id: number;
  patient_id?: number;
  patient_name?: string;
  patient_phone?: string;
  patient_address?: string;
  title?: string;
  task_type?: string;
  start_time?: string;
  end_time?: string;
  status?: string;
  priority?: string;
  special_instructions?: string;
  staff_name?: string;
  employee_id?: number;
  employee_name?: string;
  is_assigned?: boolean;
  documentation_completed?: boolean;
  needs_documentation?: boolean;
  is_late?: boolean;
  minutes_late?: number;
  has_clock_out?: boolean;
};

export type PatientListItem = {
  id: number;
  name?: string;
  first_name?: string;
  last_name?: string;
  mrn?: string;
  dob?: string;
  age?: number;
  phone?: string;
  address?: string;
  status?: string;
};

export type EvvVisit = {
  id: number;
  status?: string;
  start_datetime?: string;
  end_datetime?: string;
  service_type?: string;
  task_type?: string;
  patient?: {
    id: number;
    name?: string;
    address?: string;
    status?: string;
    latitude?: number | null;
    longitude?: number | null;
    photo_url?: string | null;
  };
  evv?: {
    id: number;
    check_in_time?: string;
    check_out_time?: string;
    is_open_session?: boolean;
    verification_status?: string;
    sandata_sync_status?: string;
    duration_minutes?: number;
    gps_checkin?: { latitude?: number | null; longitude?: number | null } | null;
    gps_checkout?: { latitude?: number | null; longitude?: number | null } | null;
  } | null;
  /** Who the visit is scheduled for. Null when the office has not assigned it yet. */
  assigned_to?: { id: number; name?: string | null } | null;
  /**
   * Whether this user may clock into this visit.
   *
   * A manager's list is the whole agency, but clocking in attests that you personally
   * delivered the care, so only the assigned caregiver may do it. The server decides and
   * sends the answer; offering a button it will refuse would read as a broken app.
   */
  can_clock_in?: boolean;
};
