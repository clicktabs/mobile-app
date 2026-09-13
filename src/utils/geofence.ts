/** Staff must be within 0.1 miles of the patient address to clock in. */
export const GEOFENCE_MILES = 0.1;
export const METERS_PER_MILE = 1609.34;
export const METERS_PER_FOOT = 0.3048;
export const GEOFENCE_METERS = GEOFENCE_MILES * METERS_PER_MILE;
export const GEOFENCE_FEET = Math.round(GEOFENCE_MILES * 5280);

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

export function formatGeofenceMiss(meters: number): string {
  const miles = meters / METERS_PER_MILE;
  if (miles >= 0.2) {
    return `You are ${miles.toFixed(1)} miles from the patient's home (limit 0.1 miles). Move on site to clock in.`;
  }
  return `Geofence Check: Outside area (${formatMiles(meters)}; limit 0.1 miles)`;
}
