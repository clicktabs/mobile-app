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
};

export type StaffMenuStackParamList = {
  MenuHome: undefined;
  MenuAccount: undefined;
  MenuNva: undefined;
  MenuCovid: undefined;
  MenuImmunizations: undefined;
  MenuContact: undefined;
  MenuCertification: undefined;
  MenuUpdates: undefined;
  MenuTime: undefined;
  MenuMileage: undefined;
  MenuEvv: undefined;
  MenuSwitchAgency: undefined;
};

export type StaffScheduleStackParamList = {
  ScheduleList: undefined;
  SkilledNurseVisit: {
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
