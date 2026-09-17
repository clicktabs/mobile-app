import type { StaffUser } from '../types';

/**
 * Label lists by whose they are.
 *
 * "My Patients" is right for a caregiver and wrong for a Director of Nursing — the list
 * she sees is the agency's, not hers. Both the patient and the schedule scope turn on the
 * same server-side rule, and the login response reports it as `sees_whole_agency`, so the
 * labels follow the data rather than a guess about the role.
 *
 * Deliberately not keyed on the role name: org admin, DON, clinical manager and whatever
 * administrative role gets added next all see the whole agency, and a list of role names
 * in the app would go stale the first time somebody adds one.
 */
export type ScopeLabels = {
  patients: string;
  schedule: string;
};

const AGENCY_WIDE: ScopeLabels = { patients: 'Patients', schedule: 'Schedules' };
const OWN: ScopeLabels = { patients: 'My Patients', schedule: 'My Schedule' };

export function scopeLabels(user?: Pick<StaffUser, 'sees_whole_agency'> | null): ScopeLabels {
  // Defaults to the narrower wording: on an older session with no flag stored, "My
  // Patients" understates a manager's reach, whereas "Patients" would overstate a
  // caregiver's and imply access they do not have.
  return user?.sees_whole_agency ? AGENCY_WIDE : OWN;
}
