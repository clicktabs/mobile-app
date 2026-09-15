import { Platform } from 'react-native';
import * as Location from 'expo-location';

export type GpsFix = {
  latitude: number;
  longitude: number;
  gps_accuracy?: number;
};

class LocationFixError extends Error {
  code: 'services_off' | 'permission' | 'unknown' | 'failed';
  constructor(code: LocationFixError['code'], message: string) {
    super(message);
    this.code = code;
    this.name = 'LocationFixError';
  }
}

function isUnknownFix(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  return /kCLErrorLocationUnknown|location unknown|current location is unknown|location is currently unavailable/i.test(
    msg,
  );
}

function toFix(loc: Location.LocationObject): GpsFix {
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    gps_accuracy: loc.coords.accuracy ?? undefined,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Read GPS for EVV. iOS often throws kCLErrorLocationUnknown on the first High-accuracy
 * request (no lock yet). Try Balanced first, retry, then last-known position.
 */
export async function getGpsFix(): Promise<GpsFix> {
  const enabled = await Location.hasServicesEnabledAsync();
  if (!enabled) {
    throw new LocationFixError(
      'services_off',
      'Location Services are turned off. Enable them in Settings, then tap Retry.',
    );
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new LocationFixError(
      'permission',
      'Location permission is required for EVV clock-in and clock-out.',
    );
  }

  if (Platform.OS === 'android') {
    try {
      await Location.enableNetworkProviderAsync();
    } catch {
      // User can still get a GPS fix without this.
    }
  }

  const attempts: { accuracy: Location.LocationAccuracy; waitMs: number }[] = [
    { accuracy: Location.Accuracy.High, waitMs: 0 },
    { accuracy: Location.Accuracy.High, waitMs: 1500 },
    { accuracy: Location.Accuracy.Balanced, waitMs: 800 },
    { accuracy: Location.Accuracy.Low, waitMs: 400 },
  ];

  let lastError: unknown;
  let best: GpsFix | null = null;
  for (const attempt of attempts) {
    if (attempt.waitMs) await sleep(attempt.waitMs);
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: attempt.accuracy });
      if (Number.isFinite(loc.coords.latitude) && Number.isFinite(loc.coords.longitude)) {
        const fix = toFix(loc);
        if (!best || (fix.gps_accuracy ?? 999) < (best.gps_accuracy ?? 999)) {
          best = fix;
        }
        // Good enough lock — don't wait for later coarse fallbacks.
        if ((fix.gps_accuracy ?? 999) <= 50) {
          return fix;
        }
      }
    } catch (e) {
      lastError = e;
    }
  }
  if (best) {
    return best;
  }

  try {
    const last = await Location.getLastKnownPositionAsync({
      maxAge: 2 * 60 * 1000,
      requiredAccuracy: 80,
    });
    if (last && Number.isFinite(last.coords.latitude) && Number.isFinite(last.coords.longitude)) {
      return toFix(last);
    }
  } catch (e) {
    lastError = lastError ?? e;
  }

  if (isUnknownFix(lastError) || lastError instanceof LocationFixError) {
    throw new LocationFixError('unknown', friendlyUnknownMessage());
  }

  throw new LocationFixError(
    'failed',
    lastError instanceof Error ? lastError.message : 'Unable to read GPS. Tap Retry.',
  );
}

export function formatLocationError(e: unknown): string {
  if (e instanceof LocationFixError) return e.message;
  if (isUnknownFix(e)) return friendlyUnknownMessage();
  return e instanceof Error ? e.message : 'Unable to read GPS. Tap Retry.';
}

function friendlyUnknownMessage() {
  if (Platform.OS === 'ios') {
    return 'GPS could not get a lock yet. Move near a window, wait a few seconds, then tap Retry. On the iOS Simulator, set Features → Location to a city or custom location.';
  }
  return 'GPS could not get a lock yet. Move outdoors or near a window, then tap Retry.';
}
