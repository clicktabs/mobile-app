/**
 * Whether the app can reach the server, decided automatically.
 *
 * There is no manual switch. Two detectors decide it, because neither is sufficient alone:
 *
 *   - Failed requests are the truth. Every call goes through apiRequest(), which already
 *     throws ApiError(status 0) when fetch rejects, so the app learns it is offline from
 *     the work it was doing anyway. This is what tells us we have LOST the network.
 *   - The OS connectivity event tells us we may have REGAINED it. Request failures
 *     cannot: once offline the app stops calling, so nothing fails and nothing succeeds.
 *
 * The OS saying "connected" is not the server being reachable — hotel wifi and captive
 * portals report connected and answer every request with a login page — so a regained
 * network is probed before it is believed.
 *
 * Deliberately free of React and of the API layer, so apiRequest() can report into it
 * without an import cycle.
 */

export type ConnectivityState = 'online' | 'offline' | 'probing';

/**
 * One failure is not offline. A single timeout happens on healthy networks, and flipping
 * the whole app on it would be worse than the manual toggle this replaced.
 */
const FAILURES_BEFORE_OFFLINE = 2;

/** How often to re-probe while offline, when the OS gives us no event to work with. */
const PROBE_INTERVAL_MS = 30_000;

type Listener = (state: ConnectivityState) => void;

let state: ConnectivityState = 'online';
let consecutiveFailures = 0;
let probeTimer: ReturnType<typeof setTimeout> | null = null;
let probeFn: (() => Promise<boolean>) | null = null;

const listeners = new Set<Listener>();

function setState(next: ConnectivityState) {
  if (state === next) return;
  state = next;
  listeners.forEach((listener) => listener(state));
}

/** Subscribe to changes. Returns an unsubscribe function. */
export function onConnectivityChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getConnectivityState(): ConnectivityState {
  return state;
}

/** Should the app behave as offline right now? */
export function isOffline(): boolean {
  return state === 'offline';
}

/**
 * The probe: something cheap that proves the server answers. Registered by the app so
 * this module stays independent of the API layer.
 */
export function registerProbe(fn: () => Promise<boolean>) {
  probeFn = fn;
}

/** A request succeeded, so the server is reachable. Nothing else needs to be consulted. */
export function reportSuccess() {
  consecutiveFailures = 0;
  stopProbing();
  setState('online');
}

/**
 * A request failed at the network layer (ApiError status 0).
 *
 * An HTTP error is NOT a failure here: a 422 or a 500 proves the server answered.
 */
export function reportNetworkFailure() {
  consecutiveFailures += 1;

  if (consecutiveFailures >= FAILURES_BEFORE_OFFLINE && state !== 'offline') {
    setState('offline');
    scheduleProbe();
  }
}

/** The OS says a network appeared. That is a reason to check, not to believe. */
export function reportNetworkAvailable() {
  if (state === 'online') return;
  void probeNow();
}

export function reportNetworkLost() {
  consecutiveFailures = FAILURES_BEFORE_OFFLINE;
  setState('offline');
  scheduleProbe();
}

/** Probe immediately. Safe to call at any time. */
export async function probeNow(): Promise<boolean> {
  if (!probeFn) return false;

  setState('probing');

  let reachable = false;
  try {
    reachable = await probeFn();
  } catch {
    reachable = false;
  }

  if (reachable) {
    consecutiveFailures = 0;
    stopProbing();
    setState('online');
    return true;
  }

  setState('offline');
  scheduleProbe();
  return false;
}

function scheduleProbe() {
  if (probeTimer) return;

  probeTimer = setTimeout(() => {
    probeTimer = null;
    void probeNow();
  }, PROBE_INTERVAL_MS);
}

function stopProbing() {
  if (probeTimer) {
    clearTimeout(probeTimer);
    probeTimer = null;
  }
}

/** Test seam: return the module to its initial state. */
export function resetConnectivity() {
  stopProbing();
  state = 'online';
  consecutiveFailures = 0;
  listeners.clear();
  probeFn = null;
}
