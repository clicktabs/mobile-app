import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthPersona, PatientUser, StaffUser } from '../types';
import * as staffApi from '../api/staff';
import * as patientApi from '../api/patient';
import { ApiError } from '../api/client';
import { storageDelete, storageGet, storageSet } from '../utils/storage';

const TOKEN_KEY = 'ct_token';
const PERSONA_KEY = 'ct_persona';
const USER_KEY = 'ct_user';

type AuthState = {
  ready: boolean;
  token: string | null;
  persona: AuthPersona | null;
  staffUser: StaffUser | null;
  patientUser: PatientUser | null;
  loginStaff: (email: string, password: string) => Promise<void>;
  loginPatient: (email: string, credential: string, type: 'dob' | 'mrn') => Promise<void>;
  /**
   * Merge fresher facts into the stored staff user.
   *
   * The login payload is written once at sign-in and never refreshed, so anything it
   * carries goes stale the moment it changes on the server — and anything *added* to it
   * later is simply absent for everyone already signed in. That has now hidden two
   * permission-gated controls from the people who hold the permission, because an
   * undefined flag reads as false.
   *
   * So a screen that learns something newer — the dashboard, which asks the server on
   * every visit — writes it back here, and the rest of the app sees it without anybody
   * having to sign out.
   */
  updateStaffUser: (patch: Partial<StaffUser>) => Promise<void>;
  logout: () => Promise<void>;
  handleUnauthorized: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function saveSession(persona: AuthPersona, token: string, user: unknown) {
  await storageSet(TOKEN_KEY, token);
  await storageSet(PERSONA_KEY, persona);
  await storageSet(USER_KEY, JSON.stringify(user));
}

async function clearSession() {
  await storageDelete(TOKEN_KEY);
  await storageDelete(PERSONA_KEY);
  await storageDelete(USER_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [persona, setPersona] = useState<AuthPersona | null>(null);
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null);
  const [patientUser, setPatientUser] = useState<PatientUser | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedPersona, storedUser] = await Promise.all([
          storageGet(TOKEN_KEY),
          storageGet(PERSONA_KEY),
          storageGet(USER_KEY),
        ]);
        if (storedToken && storedPersona && storedUser) {
          setToken(storedToken);
          setPersona(storedPersona as AuthPersona);
          const parsed = JSON.parse(storedUser);
          if (storedPersona === 'staff') setStaffUser(parsed);
          else setPatientUser(parsed);
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const loginStaff = useCallback(async (email: string, password: string) => {
    const res = await staffApi.staffLogin(email.trim(), password);
    if (!res.success || !res.data?.token) {
      throw new ApiError(res.message || 'Login failed', 401, res);
    }
    await saveSession('staff', res.data.token, res.data.user);
    setToken(res.data.token);
    setPersona('staff');
    setStaffUser(res.data.user);
    setPatientUser(null);
  }, []);

  const loginPatient = useCallback(
    async (email: string, credential: string, type: 'dob' | 'mrn') => {
      const res = await patientApi.patientLogin(email.trim(), credential.trim(), type);
      if (!res.success || !res.data?.token) {
        throw new ApiError(res.message || 'Login failed', 401, res);
      }
      await saveSession('patient', res.data.token, res.data.patient);
      setToken(res.data.token);
      setPersona('patient');
      setPatientUser(res.data.patient);
      setStaffUser(null);
    },
    [],
  );

  const logout = useCallback(async () => {
    // Clear local session first so UI always returns to Role Select even if
    // the revoke API hangs, fails CORS, or is unreachable (common on web).
    const revokeToken = token;
    const revokePersona = persona;
    await clearSession();
    setToken(null);
    setPersona(null);
    setStaffUser(null);
    setPatientUser(null);

    if (!revokeToken) return;
    try {
      const revoke =
        revokePersona === 'staff'
          ? staffApi.staffLogout(revokeToken)
          : revokePersona === 'patient'
            ? patientApi.patientLogout(revokeToken)
            : null;
      if (revoke) {
        await Promise.race([
          revoke,
          new Promise((resolve) => setTimeout(resolve, 2500)),
        ]);
      }
    } catch {
      // Local session already cleared
    }
  }, [token, persona]);

  const handleUnauthorized = useCallback(async () => {
    await clearSession();
    setToken(null);
    setPersona(null);
    setStaffUser(null);
    setPatientUser(null);
  }, []);

  const updateStaffUser = useCallback(async (patch: Partial<StaffUser>) => {
    setStaffUser((current) => {
      if (!current) return current;

      // Nothing actually newer — return the same object so this cannot loop a screen
      // that calls it from an effect.
      const changed = Object.keys(patch).some(
        (key) => (current as any)[key] !== (patch as any)[key],
      );
      if (!changed) return current;

      const next = { ...current, ...patch };
      // Persisted too, or the correction lasts only until the app is reopened.
      storageSet(USER_KEY, JSON.stringify(next)).catch(() => {});

      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      ready,
      token,
      persona,
      staffUser,
      patientUser,
      loginStaff,
      loginPatient,
      updateStaffUser,
      logout,
      handleUnauthorized,
    }),
    [
      ready,
      token,
      persona,
      staffUser,
      patientUser,
      loginStaff,
      loginPatient,
      updateStaffUser,
      logout,
      handleUnauthorized,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
