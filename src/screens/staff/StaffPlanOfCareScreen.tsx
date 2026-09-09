import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeader, AppShell } from '../../components/chrome';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import type { PocOrderRow } from '../../api/staff';
import { ApiError } from '../../api/client';
import type { StaffScheduleStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { showAlert } from '../../utils/confirm';

type Props = NativeStackScreenProps<StaffScheduleStackParamList, 'PlanOfCareProfile'>;

type Discipline = 'sn' | 'pt' | 'ot' | 'st';

const DISCIPLINES: Array<{ id: Discipline; label: string; empty: string }> = [
  { id: 'sn', label: 'SN', empty: 'No Skilled Nursing orders found. Use Add Problem Statement to get started.' },
  { id: 'pt', label: 'PT', empty: 'No Physical Therapy orders found.' },
  { id: 'ot', label: 'OT', empty: 'No Occupational Therapy orders found.' },
  { id: 'st', label: 'ST', empty: 'No Speech Therapy orders found.' },
];

type SectionGroup = {
  sectionKey: string;
  title: string;
  rows: PocOrderRow[];
};

function groupRows(rows: PocOrderRow[]): SectionGroup[] {
  const map = new Map<string, SectionGroup>();
  rows.forEach((row) => {
    const key = row.section_key || 'other';
    if (!map.has(key)) {
      map.set(key, { sectionKey: key, title: row.order || key, rows: [] });
    }
    map.get(key)!.rows.push(row);
  });
  return Array.from(map.values());
}

export function StaffPlanOfCareScreen({ navigation, route }: Props) {
  const { token } = useAuth();
  const { patientId, patientName } = route.params;
  const [discipline, setDiscipline] = useState<Discipline>('sn');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingQa, setPendingQa] = useState(false);
  const [pocId, setPocId] = useState<number | null>(null);
  const [rows, setRows] = useState<PocOrderRow[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!token || !patientId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await staffApi.getPlanOfCareOrders(token, patientId, discipline);
        const data = res.data;
        setRows(data?.rows || []);
        setPocId(data?.poc_id ?? null);
        setPendingQa(!!data?.pending_qa);
        const groups = groupRows(data?.rows || []);
        setExpanded((prev) => {
          const next = { ...prev };
          groups.forEach((g) => {
            if (next[g.sectionKey] === undefined) next[g.sectionKey] = true;
          });
          return next;
        });
      } catch (e) {
        showAlert('Unable to load orders', e instanceof ApiError ? e.message : 'Error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, patientId, discipline],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const sections = useMemo(() => groupRows(rows), [rows]);
  const takenLabels = useMemo(
    () => new Set(sections.map((s) => s.title.trim().toLowerCase())),
    [sections],
  );

  const removeSection = async (sectionKey: string, title: string) => {
    if (!token || !pocId) {
      showAlert('Unavailable', 'No plan of care record is linked yet.');
      return;
    }
    try {
      await staffApi.removePlanOfCareSection(token, pocId, sectionKey);
      showAlert('Removed', `${title} was removed.`);
      load(true);
    } catch (e) {
      showAlert('Remove failed', e instanceof ApiError ? e.message : 'Error');
    }
  };

  const openAdd = (templateLabel?: string) => {
    setAddOpen(false);
    navigation.navigate('AddProblemStatement', {
      patientId,
      patientName,
      discipline,
      pocId: pocId ?? undefined,
      takenLabels: Array.from(takenLabels),
      preselectLabel: templateLabel,
    });
  };

  return (
    <AppShell>
      <AppHeader
        title="Plan of Care Profile"
        actions={[{ icon: 'arrow-back', onPress: () => navigation.goBack() }]}
      />
      <View style={styles.subHeader}>
        <Text style={styles.patientLabel}>Patient</Text>
        <Text style={styles.patientName}>{patientName || `Patient #${patientId}`}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Active Treatment Orders</Text>
          <Pressable
            onPress={() => setAddOpen(true)}
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.addBtnText}>Add Problem Statement</Text>
          </Pressable>
        </View>

        {pendingQa ? (
          <View style={styles.qaBanner}>
            <Ionicons name="time-outline" size={16} color="#92400e" />
            <Text style={styles.qaText}>
              These orders are awaiting CMS-485 QA approval and will appear here once approved.
            </Text>
          </View>
        ) : null}

        <View style={styles.tabs}>
          {DISCIPLINES.map((d) => {
            const on = discipline === d.id;
            return (
              <Pressable
                key={d.id}
                onPress={() => setDiscipline(d.id)}
                style={[styles.tab, on && styles.tabOn]}
              >
                <Text style={[styles.tabText, on && styles.tabTextOn]}>{d.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginVertical: 28 }} color={colors.brandMagenta} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          >
            {!sections.length ? (
              <View style={styles.empty}>
                <Ionicons name="medkit-outline" size={36} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>
                  {DISCIPLINES.find((d) => d.id === discipline)?.empty}
                </Text>
              </View>
            ) : (
              sections.map((sec) => {
                const open = !!expanded[sec.sectionKey];
                return (
                  <View key={sec.sectionKey} style={styles.section}>
                    <Pressable
                      onPress={() =>
                        setExpanded((prev) => ({ ...prev, [sec.sectionKey]: !prev[sec.sectionKey] }))
                      }
                      style={styles.sectionHeader}
                    >
                      <Ionicons
                        name={open ? 'chevron-down' : 'chevron-forward'}
                        size={16}
                        color="#1e3a5f"
                      />
                      <Text style={styles.sectionTitle}>{sec.title}</Text>
                      <Pressable
                        hitSlop={8}
                        onPress={() => removeSection(sec.sectionKey, sec.title)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#b91c1c" />
                      </Pressable>
                    </Pressable>
                    {open
                      ? sec.rows.map((row, idx) => (
                          <View key={`${row.field_key}-${idx}`} style={styles.row}>
                            <Text style={styles.rowType}>{row.type}</Text>
                            <Text style={styles.rowValue}>
                              {typeof row.value === 'string' && row.value && row.type !== 'Plan of Care'
                                ? row.value
                                : row.description || '—'}
                            </Text>
                            {row.type !== 'Plan of Care' &&
                            row.description &&
                            row.description !== row.value ? (
                              <Text style={styles.rowDesc}>{row.description}</Text>
                            ) : null}
                            <View style={styles.metaRow}>
                              <Text style={styles.meta}>
                                {row.clinician ? row.clinician : '—'}
                              </Text>
                              <Text style={styles.meta}>{row.effective_date || '—'}</Text>
                            </View>
                          </View>
                        ))
                      : null}
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </View>

      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setAddOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Add Problem Statement</Text>
            <Text style={styles.modalHint}>
              Choose a problem statement to add to the {discipline.toUpperCase()} plan of care.
            </Text>
            <Pressable
              onPress={() => openAdd()}
              style={({ pressed }) => [styles.modalPrimary, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.modalPrimaryText}>Continue</Text>
            </Pressable>
            <Pressable onPress={() => setAddOpen(false)} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  subHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  patientLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  patientName: { fontSize: 16, color: colors.ink, fontWeight: '700', marginTop: 2 },
  card: {
    flex: 1,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  cardHeader: {
    backgroundColor: '#2c5aa0',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  cardTitle: { color: '#fff', fontWeight: '700', fontSize: 13, flex: 1 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  qaBanner: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#fffbeb',
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  qaText: { flex: 1, color: '#92400e', fontSize: 12, lineHeight: 17 },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#eef2f7',
  },
  tabOn: { backgroundColor: '#1e3a5f' },
  tabText: { fontWeight: '700', color: '#334155', fontSize: 13 },
  tabTextOn: { color: '#fff' },
  list: { padding: 12, paddingBottom: 40, gap: 10 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10, paddingHorizontal: 16 },
  emptyTitle: { textAlign: 'center', color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  section: {
    borderWidth: 1,
    borderColor: '#dbe3ef',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  sectionTitle: { flex: 1, fontWeight: '700', color: '#1e3a5f', fontSize: 13 },
  row: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
    gap: 4,
  },
  rowType: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  rowValue: { fontSize: 13, color: colors.ink, fontWeight: '600' },
  rowDesc: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  meta: { fontSize: 11, color: colors.textMuted },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    gap: 10,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  modalHint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  modalPrimary: {
    backgroundColor: '#2c5aa0',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  modalPrimaryText: { color: '#fff', fontWeight: '700' },
  modalCancel: { alignItems: 'center', paddingVertical: 8 },
  modalCancelText: { color: colors.textMuted, fontWeight: '600' },
});
