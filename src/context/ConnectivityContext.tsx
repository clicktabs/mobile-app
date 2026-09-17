import NetInfo from '@react-native-community/netinfo';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';

// On Web, NetInfo's internal reachability check triggers unhandled AbortError
// rejections because it cancels CORS-blocked fetch calls without catching the promise.
// We disable its reachability runner on web and rely on our own mobile/ping probe.
if (Platform.OS === 'web') {
  NetInfo.configure({
    reachabilityShouldRun: () => false,
  });

  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('unhandledrejection', (event) => {
      if (
        event.reason?.name === 'AbortError' ||
        event.reason?.message?.includes('aborted')
      ) {
        event.preventDefault();
      }
    });
  }
}

import { apiRequest } from '../api/client';
import { flushDocumentQueue, pendingDocumentCount } from '../api/docQueue';
import * as evvApi from '../api/evv';
import { showAlert } from '../utils/confirm';
import { useAuth } from './AuthContext';
import {
  ConnectivityState,
  getConnectivityState,
  onConnectivityChange,
  probeNow,
  registerProbe,
  reportNetworkAvailable,
  reportNetworkLost,
} from '../utils/connectivity';
import { storageDelete } from '../utils/storage';

type ConnectivityValue = {
  state: ConnectivityState;
  /** Whether the app should behave as offline. Detected, never chosen. */
  offline: boolean;
  /** Check now rather than waiting for the next event or timer. */
  refresh: () => Promise<boolean>;
};

const ConnectivityContext = createContext<ConnectivityValue | undefined>(undefined);

/**
 * How long the reachability probe waits.
 *
 * Shorter than a normal request: this runs while the user is waiting to find out whether
 * they are back, and a wrong "still offline" costs only one more probe cycle.
 */
const PROBE_TIMEOUT_MS = 5_000;

export function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConnectivityState>(getConnectivityState());
  const { token } = useAuth();

  // The token as of now, readable from callbacks that were created earlier.
  const tokenRef = useRef(token);
  tokenRef.current = token;

  // Guards against two flushes overlapping — a NetInfo event and a probe can both
  // decide we are back within a few milliseconds of each other.
  const flushing = useRef(false);
  const wasOnline = useRef(getConnectivityState() === 'online');

  // What "reachable" means: our API answered. Anything at all counts — a 401 proves the
  // server is there just as well as a 200 — so only a network-level failure is offline.
  useEffect(() => {
    registerProbe(async () => {
      try {
        await apiRequest('mobile/ping', { timeoutMs: PROBE_TIMEOUT_MS, silent: true });
        return true;
      } catch (e) {
        const status = (e as { status?: number })?.status ?? 0;
        return status !== 0;
      }
    });
  }, []);

  /**
   * Coming back online is the whole point: queued work goes up on its own, rather than
   * waiting for the caregiver to open the one screen that used to trigger a sync.
   */
  const flushQueues = useCallback(async () => {
    const authToken = tokenRef.current;

    if (!authToken || flushing.current) return;

    flushing.current = true;
    try {
      let uploaded = 0;
      let refused = 0;

      // EVV first, always. A note for a visit the server has never heard of is rejected,
      // so the clock-in has to land before the documentation that belongs to it.
      if ((await evvApi.pendingOfflineEvvCount()) > 0) {
        const evvRes = await evvApi.flushOfflineEvvQueue(authToken);
        uploaded += evvRes.flushed;
        refused += evvRes.rejected;
      }

      if ((await pendingDocumentCount()) > 0) {
        const docRes = await flushDocumentQueue(authToken);
        uploaded += docRes.flushed;
        refused += docRes.rejected;
      }

      if (uploaded > 0) {
        showAlert('Back online', `${uploaded} item(s) uploaded from this device.`, 'success');
      }

      // Refusals are not a sync failure to shrug at — somebody has to look at them.
      if (refused > 0) {
        showAlert(
          'Some items need attention',
          `${refused} item(s) were not accepted and are kept for review.`,
          'error',
        );
      }
    } catch {
      // Still offline, or the server refused the batch. The queue is intact either way,
      // and the next probe will try again.
    } finally {
      flushing.current = false;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onConnectivityChange((next) => {
      setState(next);

      const nowOnline = next === 'online';

      if (nowOnline && !wasOnline.current) {
        void flushQueues();
      }

      wasOnline.current = nowOnline;
    });

    return unsubscribe;
  }, [flushQueues]);

  /**
   * Clear what the old manual toggle left behind.
   *
   * A device that was switched to "work offline" before this version still has that flag
   * stored. There is no longer a button to turn it off, so honouring it would strand the
   * caregiver offline permanently. The cached-visit keys go too: they were only ever
   * written by that button and nothing ever read them back.
   */
  useEffect(() => {
    (async () => {
      await Promise.all([
        storageDelete('ct_work_offline'),
        storageDelete('ct_offline_visits'),
        storageDelete('ct_offline_visits_at'),
      ]);
    })();
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((netState) => {
      // isInternetReachable is null while unknown; treat that as "maybe" and let the
      // probe decide rather than declaring either way.
      const connected =
        netState.isConnected === true &&
        (Platform.OS === 'web' || netState.isInternetReachable !== false);

      if (connected) {
        reportNetworkAvailable();
      } else if (netState.isConnected === false) {
        reportNetworkLost();
      }
    });

    return unsubscribe;
  }, []);

  // Coming back to the app is the other moment worth checking: the phone may have moved
  // a mile since it was last in the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active' && getConnectivityState() !== 'online') {
        void probeNow();
      }
    });

    return () => sub.remove();
  }, []);

  const value = useMemo<ConnectivityValue>(
    () => ({
      state,
      offline: state === 'offline',
      refresh: probeNow,
    }),
    [state],
  );

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}

export function useConnectivity(): ConnectivityValue {
  const ctx = useContext(ConnectivityContext);

  if (!ctx) {
    throw new Error('useConnectivity must be used inside ConnectivityProvider');
  }

  return ctx;
}
