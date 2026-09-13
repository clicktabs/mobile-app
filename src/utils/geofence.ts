/** EVV geofence radius: org admins set 100–1,500 ft in dashboard EVV Settings. */
export const GEOFENCE_MIN_FT = 100;
export const GEOFENCE_MAX_FT = 1500;
export const METERS_PER_FOOT = 0.3048;

export function feetToMeters(feet: number): number {
  return feet * METERS_PER_FOOT;
}

export function metersToFeet(meters: number): number {
  return meters / METERS_PER_FOOT;
}

export const DEFAULT_GEOFENCE_FT = GEOFENCE_MAX_FT;
export const DEFAULT_GEOFENCE_M = Math.round(feetToMeters(DEFAULT_GEOFENCE_FT));

export function clampGeofenceFeet(feet?: number | null): number {
  const n = Number(feet);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_GEOFENCE_FT;
  return Math.max(GEOFENCE_MIN_FT, Math.min(GEOFENCE_MAX_FT, Math.round(n)));
}

export function geofenceMetersFromFeet(feet?: number | null): number {
  return Math.round(feetToMeters(clampGeofenceFeet(feet)));
}

export function formatFeet(meters: number): string {
  return `${Math.round(metersToFeet(meters)).toLocaleString('en-US')} ft`;
}

export function formatGeofenceLimit(feet?: number | null): string {
  return `${clampGeofenceFeet(feet).toLocaleString('en-US')} ft`;
}
