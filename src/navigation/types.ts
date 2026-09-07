export type AuthStackParamList = {
  RoleSelect: undefined;
  StaffLogin: undefined;
  PatientLogin: undefined;
};

export type StaffPatientsStackParamList = {
  PatientsList: undefined;
  PatientDetail: { patientId: number };
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
  MenuBadge: undefined;
  MenuTime: undefined;
  MenuMileage: undefined;
  MenuEvv: undefined;
};

export type StaffTabParamList = {
  Home: undefined;
  Patients: undefined;
  Schedule: undefined;
  Messages: undefined;
  Menu: undefined;
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
