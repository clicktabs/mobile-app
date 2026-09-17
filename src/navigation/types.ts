import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  RoleSelect: undefined;
  StaffLogin: undefined;
  PatientLogin: undefined;
};

export type StaffPatientsStackParamList = {
  PatientsList: undefined;
  PatientDetail: { patientId: number };
};

export type StaffHomeStackParamList = {
  HomeMain: undefined;
  RouteVisits: undefined;
  ElectronicIdBadge: undefined;
  AvailableShifts: undefined;
  ShiftOffers: undefined;
};

export type StaffMenuStackParamList = {
  MenuHome: undefined;
  MenuAccount: undefined;
  MenuCovid: undefined;
  MenuImmunizations: undefined;
  MenuCertification: undefined;
  MenuIncidentReport: undefined;
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
