/** EVV geofence radius: 100–1,500 ft. Mobile uses the maximum. */
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

export function formatFeet(meters: number): string {
  return `${Math.round(metersToFeet(meters)).toLocaleString('en-US')} ft`;
}

export function formatGeofenceLimit(): string {
  return `${DEFAULT_GEOFENCE_FT.toLocaleString('en-US')} ft`;
}
