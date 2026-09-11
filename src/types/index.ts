export type UserRole = string;

export type StaffUser = {
  id: number;
  name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  role?: UserRole;
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
    verification_status?: string;
    sandata_sync_status?: string;
    duration_minutes?: number;
    gps_checkin?: { latitude?: number | null; longitude?: number | null } | null;
    gps_checkout?: { latitude?: number | null; longitude?: number | null } | null;
  } | null;
};
