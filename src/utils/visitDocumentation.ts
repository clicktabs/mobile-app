/**
 * Which documentation form a visit gets.
 *
 * Every entry point used to name 'SkilledNurseVisit' outright, so a home health aide
 * clocking in was handed a skilled-nursing assessment — vital signs, wound assessment,
 * integument — and signing it would have meant attesting to observations outside their
 * scope of practice. The discipline is a property of the visit, recorded on the
 * schedule as task_type, so it is read rather than assumed.
 */

export type VisitDocRoute = 'SkilledNurseVisit' | 'HhaVisitNote';

/** task_type values that mean an aide visit rather than a clinical one. */
const HHA_TASK_TYPES = ['hha_visit', 'hha_client_intake'];

export function documentationRouteFor(taskType?: string | null): VisitDocRoute {
  const type = (taskType || '').trim().toLowerCase();

  // Default to the nursing form: it is what every visit got before this existed, and
  // an unrecognised task_type is safer pointed at the richer form than at one that
  // silently omits clinical fields.
  return HHA_TASK_TYPES.includes(type) ? 'HhaVisitNote' : 'SkilledNurseVisit';
}

export function isHhaVisit(taskType?: string | null): boolean {
  return documentationRouteFor(taskType) === 'HhaVisitNote';
}
