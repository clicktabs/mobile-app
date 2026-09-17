import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  RoleSelect: undefined;
  StaffLogin: undefined;
  PatientLogin: undefined;
};

export type StaffPatientsStackParamList = {
  PatientsList: undefined;
  PatientDetail: { patientId: number };
  // Filed from the patient it concerns, so the report carries the patient without the
  // caregiver having to pick them again.
  IncidentReport: { patientId?: number; patientName?: string } | undefined;
};

export type StaffHomeStackParamList = {
  HomeMain: undefined;
  /** Aide supervision that has come due — the list behind the dashboard tile. */
  SupervisoryVisits: undefined;
  /**
   * A nurse's record of observing an aide in the home.
   *
   * The aide is carried in rather than picked, because the row that opened this names
   * both her and the patient — and the server refuses a visit whose supervisee is the
   * person filing it.
   */
  SupervisoryVisitForm: {
    patientId: number;
    patientName: string;
    aideId: number;
    aideName?: string | null;
  };
  RouteVisits: undefined;
  ElectronicIdBadge: undefined;
  AvailableShifts: undefined;
  ShiftOffers: undefined;
};

export type StaffMenuStackParamList = {
  MenuHome: undefined;
  MenuAccount: undefined;
  MenuCertification: undefined;
  MenuPay: undefined;
  MenuMileage: undefined;
  MenuEvv: { scheduleId?: number } | undefined;
  MenuEvvClockIn: { scheduleId: number };
  MenuEvvNursingNote: { scheduleId: number; patientId?: number; patientName?: string };
  MenuEvvClockOut: { scheduleId: number };
  MenuSwitchAgency: undefined;
};

export type StaffScheduleStackParamList = {
  ScheduleList: undefined;
  /**
   * Booking a visit.
   *
   * Reached from the Calendar tab by choosing a day and tapping Schedule, so the date
   * arrives already decided — the same move as clicking a square on the web calendar.
   * Only offered to someone the server says holds "Schedule Visits/Activities".
   */
  CreateSchedule: { date?: string } | undefined;
  SkilledNurseVisit: {
    scheduleId: number;
    patientId?: number;
    patientName?: string;
    startTime?: string;
    /** When true, note save/complete routes to EVV clock-out instead of schedule list. */
    evvFlow?: boolean;
  };
  /** Why a visit did not happen. */
  MissedVisitNote: {
    scheduleId: number;
    patientName?: string;
  };
  /** The Home Health Aide equivalent of SkilledNurseVisit. */
  HhaVisitNote: {
    scheduleId: number;
    patientId?: number;
    patientName?: string;
    startTime?: string;
  };
  PlanOfCareProfile: {
    patientId: number;
    patientName?: string;
  };
  AddProblemStatement: {
    patientId: number;
    patientName?: string;
    discipline: 'sn' | 'pt' | 'ot' | 'st';
    pocId?: number;
    takenLabels?: string[];
    preselectLabel?: string;
  };
  WoundManager: {
    patientId: number;
    patientName?: string;
    scheduleId?: number;
  };
  NewWoundOrder: {
    patientId: number;
    patientName?: string;
    patientMrn?: string;
    profileId?: number;
    profileName?: string;
    cleansing?: string;
    primaryDressing?: string;
    secondaryDressing?: string;
    frequency?: string;
  };
  WoundOrderProfiles: {
    patientId: number;
    patientName?: string;
  };
};

export type StaffTabParamList = {
  Home: NavigatorScreenParams<StaffHomeStackParamList> | undefined;
  Patients: NavigatorScreenParams<StaffPatientsStackParamList> | undefined;
  Schedule: NavigatorScreenParams<StaffScheduleStackParamList> | undefined;
  Messages: undefined;
  Menu: NavigatorScreenParams<StaffMenuStackParamList> | undefined;
};

export type PatientHomeStackParamList = {
  PatientHomeMain: undefined;
  PatientMeds: undefined;
  PatientCarePlans: undefined;
  PatientCareTeam: undefined;
  PatientNotifications: undefined;
  PatientGrievances: undefined;
  PatientProfile: undefined;
};

export type PatientTabParamList = {
  Home: undefined;
  Schedule: undefined;
  Meds: undefined;
  Messages: undefined;
  Profile: undefined;
};
