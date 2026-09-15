/** Product rule: staff must be within 0.1 miles of the patient address. */
export const GEOFENCE_MILES = 0.1;
export const METERS_PER_MILE = 1609.34;
export const METERS_PER_FOOT = 0.3048;
export const GEOFENCE_METERS = GEOFENCE_MILES * METERS_PER_MILE;
export const GEOFENCE_FEET = Math.round(GEOFENCE_MILES * 5280);

/**
 * Extra meters for geocoder + phone GPS error. Street-center pins are often
 * 150–250 m from the actual house; 0.1 miles alone (161 m) still fails on-site.
 */
export const GEOCODE_UNCERTAINTY_METERS = 200;
export const MAX_GPS_ACCURACY_BUFFER_METERS = 100;

export function geofenceMatchMeters(gpsAccuracy?: number | null): number {
  const acc =
    typeof gpsAccuracy === 'number' && Number.isFinite(gpsAccuracy)
      ? Math.min(Math.max(gpsAccuracy, 0), MAX_GPS_ACCURACY_BUFFER_METERS)
      : 0;
  return GEOFENCE_METERS + GEOCODE_UNCERTAINTY_METERS + acc;
}

export function feetToMeters(feet: number): number {
  return feet * METERS_PER_FOOT;
}

export function metersToFeet(meters: number): number {
  return meters / METERS_PER_FOOT;
}

export function formatFeet(meters: number): string {
  return `${Math.round(metersToFeet(meters)).toLocaleString('en-US')} ft`;
}

export function formatMiles(meters: number): string {
  const miles = meters / METERS_PER_MILE;
  if (miles < 0.1) {
    return `${miles.toFixed(2)} miles`;
  }
  return `${miles.toFixed(1)} miles`;
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isWithinGeofence(
  lat: number,
  lng: number,
  targets: Array<{ latitude: number; longitude: number } | null | undefined>,
  maxMeters?: number,
): { match: boolean; meters: number } {
  const distances = targets
    .filter((t): t is { latitude: number; longitude: number } => {
      return !!t && Number.isFinite(t.latitude) && Number.isFinite(t.longitude);
    })
    .map((t) => haversineMeters(lat, lng, t.latitude, t.longitude));
  const meters = distances.length ? Math.min(...distances) : Number.POSITIVE_INFINITY;
  const limit = maxMeters ?? geofenceMatchMeters();
  return { match: meters <= limit, meters };
}

export function formatGeofenceMiss(meters: number): string {
  const miles = meters / METERS_PER_MILE;
  if (miles >= 0.2) {
    return `You are ${miles.toFixed(1)} miles from the patient's home (limit 0.1 miles). Move on site to clock in.`;
  }
  return `Geofence Check: Outside area (${formatMiles(meters)}; limit 0.1 miles)`;
}
