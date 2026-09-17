import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { AppHeader, AppShell } from '../../components/chrome';
import { EmptyState, ErrorBanner, LoadingBlock } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';

/**
 * Aide supervision that has come due.
 *
 * Medicare §484.80(h): a registered nurse observes an aide in the patient's home every 14
 * days where skilled services are also in place, and every 60 days for an aide-only
 * patient. State waivers set their own figures again, which is why each row carries the
 * interval that produced its date rather than leaving the reader to assume one.
 *
 * Read-only. The supervisory visit is booked in the office against a nurse's calendar,
 * and this screen exists so the requirement is visible to the people it falls on — not so
 * it can be closed from a phone, which would let somebody mark an observation done
 * without having made one.
 */
export function StaffSupervisoryVisitsScreen() {
  const { token, handleUnauthorized } = useAuth();
  const navigation = useNavigation<any>();

  const [rows, setRows] = useState<staffApi.SupervisoryVisitRow[]>([]);
  const [agencyWide, setAgencyWide] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      const res = await staffApi.getSupervisoryVisits(token);
      setRows(res.data ?? []);
      setAgencyWide(!!res.sees_whole_agency);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await handleUnauthorized();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Failed to load supervisory visits');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const overdue = rows.filter((r) => r.is_overdue).length;

  return (
    <AppShell>
      <AppHeader
        title="Supervisory Visits"
        actions={[
          {
            icon: 'refresh-outline',
            onPress: () => {
              setRefreshing(true);
              load();
            },
          },
        ]}
      />

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {loading ? (
        <LoadingBlock />
      ) : (
        <ScrollView
          contentContainerStyle={rows.length === 0 ? styles.empty : styles.pad}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
        >
          {rows.length === 0 ? (
            <EmptyState message="No aide supervision is due." />
          ) : (
            <>
              <Text style={styles.lead}>
                {agencyWide
                  ? 'Aide supervision due across the agency.'
                  : 'Your aide supervision, as it stands.'}
                {overdue > 0 ? ` ${overdue} past its date.` : ''}
              </Text>

              {rows.map((r) => (
                <View key={r.id} style={[styles.row, r.is_overdue && styles.rowOverdue]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.patient} numberOfLines={1}>
                      {r.patient_name}
                    </Text>

                    {/* On an aide's own list this repeats her name, so it is shown only
                        when the list spans more than one person. */}
                    {agencyWide && r.aide_name ? (
                      <View style={styles.metaRow}>
                        <Ionicons name="person-outline" size={12} color="#64748B" />
                        <Text style={styles.meta} numberOfLines={1}>
                          {r.aide_name}
                        </Text>
                      </View>
                    ) : null}

                    <Text style={styles.meta}>
                      Due {formatDate(r.next_due_date)}
                      {r.interval ? ` · ${r.interval}` : ''}
                    </Text>

                    {/* Absent on a first supervision, and saying so beats a blank. */}
                    <Text style={styles.metaFaint}>
                      {r.last_completed_date
                        ? `Last observed ${formatDate(r.last_completed_date)}`
                        : 'Not yet observed'}
                    </Text>
                  </View>

                  <View style={styles.rightCol}>
                    <View style={[styles.badge, r.is_overdue ? styles.badgeOverdue : styles.badgeDue]}>
                      <Text style={[styles.badgeText, r.is_overdue && styles.badgeTextOverdue]}>
                        {r.is_overdue ? overdueLabel(r.days_overdue) : 'Due today'}
                      </Text>
                    </View>

                    {r.patient_id ? (
                      <Pressable
                        hitSlop={8}
                        style={styles.openPatient}
                        accessibilityLabel="Open patient"
                        onPress={() =>
                          navigation.navigate('Patients', {
                            screen: 'PatientDetail',
                            params: { patientId: r.patient_id },
                          })
                        }
                      >
                        <Text style={styles.openPatientText}>Open patient</Text>
                        <Ionicons name="chevron-forward" size={14} color="#0F172A" />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))}

              <Text style={styles.footnote}>
                Supervision is scheduled in the office. This list is here so nothing lapses
                unnoticed.
              </Text>
            </>
          )}
        </ScrollView>
      )}
    </AppShell>
  );
}

/** "16 Sep 2026" — unambiguous, unlike a numeric order that differs by country. */
function formatDate(iso?: string | null) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;

  return new Date(y, m - 1, d).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function overdueLabel(days: number) {
  if (days >= 14) return `${Math.floor(days / 7)} wks overdue`;
  return days === 1 ? '1 day overdue' : `${days} days overdue`;
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40 },
  empty: { flexGrow: 1, justifyContent: 'center' },
  lead: { fontSize: 13, color: '#475569', marginBottom: 14, lineHeight: 19 },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  rowOverdue: { borderLeftWidth: 4, borderLeftColor: '#B91C1C', backgroundColor: '#FEF2F2' },

  patient: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  meta: { fontSize: 12, color: '#475569', marginTop: 3 },
  metaFaint: { fontSize: 12, color: '#94A3B8', marginTop: 3 },

  rightCol: { alignItems: 'flex-end', gap: 8 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeDue: { backgroundColor: '#FEF3C7' },
  badgeOverdue: { backgroundColor: '#B91C1C' },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#854D0E' },
  badgeTextOverdue: { color: '#fff' },

  openPatient: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  openPatientText: { fontSize: 11, fontWeight: '700', color: '#0F172A' },

  footnote: { fontSize: 11, color: '#94A3B8', marginTop: 8, lineHeight: 16 },
});
