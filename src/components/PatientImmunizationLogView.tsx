import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { showAlert, confirmAction } from '../utils/confirm';
import * as staffApi from '../api/staff';
import { AppDatePicker } from './AppDatePicker';
import { toDisplayDate } from '../utils/dateTimeUtils';

export type ImmunizationRecord = {
  id?: string | number;
  vaccine: string;
  date?: string;
  dose?: string;
  route?: string;
  site?: string;
  source?: string;
  lot?: string;
  status?: 'administered' | 'declined' | 'contraindicated' | string;
  reason?: string;
  active?: boolean;
};

type Props = {
  patientId: number;
  token: string;
  items: ImmunizationRecord[];
  onRefresh: () => void;
  loading?: boolean;
};

const VACCINE_OPTIONS = [
  { value: '', label: '— Select vaccine —' },
  { value: 'Influenza (Flu)', label: 'Influenza (Flu)' },
  { value: 'Pneumococcal (PCV13 / Prevnar)', label: 'Pneumococcal (PCV13 / Prevnar)' },
  { value: 'Pneumococcal (PPSV23 / Pneumovax)', label: 'Pneumococcal (PPSV23 / Pneumovax)' },
  { value: 'Zoster (Shingles / Shingrix)', label: 'Zoster (Shingles / Shingrix)' },
  { value: 'COVID-19', label: 'COVID-19' },
  { value: 'Tdap / Td (Tetanus)', label: 'Tdap / Td (Tetanus)' },
  { value: 'Hepatitis B', label: 'Hepatitis B' },
  { value: 'Other', label: 'Other' },
];

const ROUTE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'IM (Intramuscular)', label: 'IM (Intramuscular)' },
  { value: 'SubQ (Subcutaneous)', label: 'SubQ (Subcutaneous)' },
  { value: 'Intranasal', label: 'Intranasal' },
  { value: 'Oral', label: 'Oral' },
];

const SITE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'Left deltoid', label: 'Left deltoid' },
  { value: 'Right deltoid', label: 'Right deltoid' },
  { value: 'Left thigh', label: 'Left thigh' },
  { value: 'Right thigh', label: 'Right thigh' },
  { value: 'Other', label: 'Other' },
];

const SOURCE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'Administered by agency staff', label: 'Administered by agency staff' },
  { value: 'Administered by other provider', label: 'Administered by other provider' },
  { value: 'Patient / caregiver report', label: 'Patient / caregiver report' },
];

const DECLINE_TYPES = [
  { value: 'declined', label: 'Declined by patient' },
  { value: 'contraindicated', label: 'Medically contraindicated' },
];

function getInitialDate() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  return `${d}/${m}/${y}`;
}

export function PatientImmunizationLogView({
  patientId,
  token,
  items,
  onRefresh,
  loading,
}: Props) {
  // Add Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [vaccine, setVaccine] = useState('');
  const [date, setDate] = useState(getInitialDate);
  const [dose, setDose] = useState('');
  const [route, setRoute] = useState('');
  const [site, setSite] = useState('');
  const [source, setSource] = useState('');
  const [lot, setLot] = useState('');

  // Decline Modal
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [declineVaccine, setDeclineVaccine] = useState('');
  const [declineType, setDeclineType] = useState('declined');
  const [declineDate, setDeclineDate] = useState(getInitialDate);
  const [declineReason, setDeclineReason] = useState('');

  // Pickers Modals
  const [vaccinePickerOpen, setVaccinePickerOpen] = useState(false);
  const [routePickerOpen, setRoutePickerOpen] = useState(false);
  const [sitePickerOpen, setSitePickerOpen] = useState(false);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [declineVaccinePickerOpen, setDeclineVaccinePickerOpen] = useState(false);
  const [declineTypePickerOpen, setDeclineTypePickerOpen] = useState(false);

  // Details Modal & Actions
  const [selectedRecord, setSelectedRecord] = useState<ImmunizationRecord | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | number | null>(null);
  const [saving, setSaving] = useState(false);
  const [displayMode, setDisplayMode] = useState<'cards' | 'table'>('table');

  const activeItems = useMemo(() => {
    return items.filter((i) => i.active !== false);
  }, [items]);

  const inactiveItems = useMemo(() => {
    return items.filter((i) => i.active === false);
  }, [items]);

  const openAdd = () => {
    setVaccine('');
    setDate(getInitialDate());
    setDose('');
    setRoute('');
    setSite('');
    setSource('');
    setLot('');
    setAddModalOpen(true);
  };

  const openDecline = () => {
    setDeclineVaccine('');
    setDeclineType('declined');
    setDeclineDate(getInitialDate());
    setDeclineReason('');
    setDeclineModalOpen(true);
  };

  const handleSaveAdd = async () => {
    if (!vaccine.trim()) {
      showAlert('Required', 'Please select a vaccine.');
      return;
    }
    setSaving(true);
    try {
      await staffApi.savePatientImmunization(token, patientId, {
        vaccine: vaccine.trim(),
        date: date.trim(),
        dose: dose.trim() || undefined,
        route: route.trim() || undefined,
        site: site.trim() || undefined,
        source: source.trim() || undefined,
        lot: lot.trim() || undefined,
        status: 'administered',
        active: true,
      });
      setAddModalOpen(false);
      onRefresh();
      showAlert('Success', 'Immunization recorded successfully');
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to save immunization.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDecline = async () => {
    if (!declineVaccine.trim()) {
      showAlert('Required', 'Please select a vaccine.');
      return;
    }
    setSaving(true);
    try {
      await staffApi.savePatientImmunization(token, patientId, {
        vaccine: declineVaccine.trim(),
        date: declineDate.trim(),
        status: declineType,
        reason: declineReason.trim() || undefined,
        active: true,
      });
      setDeclineModalOpen(false);
      onRefresh();
      showAlert('Success', 'Declination recorded successfully');
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to save record.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: ImmunizationRecord, targetActive: boolean) => {
    if (!item.id) return;
    setActionLoadingId(item.id);
    try {
      await staffApi.updatePatientImmunization(token, patientId, item.id, {
        active: targetActive,
      });
      onRefresh();
      showAlert(
        'Status Updated',
        targetActive ? 'Immunization moved to Active.' : 'Immunization moved to Inactive.',
      );
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to update immunization status.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemove = async (item: ImmunizationRecord) => {
    if (!item.id) return;
    const ok = await confirmAction(
      'Remove Record',
      `Are you sure you want to remove "${item.vaccine}" from immunization log?`,
      { confirmLabel: 'Remove' },
    );
    if (!ok) return;

    setActionLoadingId(item.id);
    try {
      await staffApi.deletePatientImmunization(token, patientId, item.id);
      onRefresh();
      showAlert('Removed', 'Immunization record removed.');
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to remove immunization.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const renderStatusBadge = (r: ImmunizationRecord) => {
    const s = (r.status || 'administered').toLowerCase();
    if (s === 'declined') {
      return (
        <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7' }]}>
          <Ionicons name="time" size={11} color="#B45309" />
          <Text style={[styles.statusBadgeText, { color: '#B45309' }]}>Declined</Text>
        </View>
      );
    }
    if (s === 'contraindicated') {
      return (
        <View style={[styles.statusBadge, { backgroundColor: '#FEE2E2' }]}>
          <Ionicons name="ban" size={11} color="#DC2626" />
          <Text style={[styles.statusBadgeText, { color: '#DC2626' }]}>Contraindicated</Text>
        </View>
      );
    }
    return (
      <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7' }]}>
        <Ionicons name="checkmark" size={11} color="#15803D" />
        <Text style={[styles.statusBadgeText, { color: '#15803D' }]}>Administered</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Action Toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.toolbarMainRow}>
          <Pressable
            style={({ pressed }) => [styles.btnToolbar, pressed && styles.pressed]}
            onPress={openAdd}
          >
            <Ionicons name="add-circle" size={16} color="#FFFFFF" />
            <Text style={styles.btnToolbarText}>ADD IMMUNIZATION</Text>
          </Pressable>

          {/* View Mode Toggle: Table vs Cards */}
          <View style={styles.viewModeToggleGroup}>
            <Pressable
              onPress={() => setDisplayMode('table')}
              style={[
                styles.viewToggleBtn,
                displayMode === 'table' && styles.viewToggleBtnActive,
              ]}
              accessibilityLabel="Table View"
            >
              <Ionicons
                name="grid-outline"
                size={14}
                color={displayMode === 'table' ? '#DC2626' : '#FFFFFF'}
              />
              <Text
                style={[
                  styles.viewToggleBtnText,
                  displayMode === 'table' && styles.viewToggleBtnTextActive,
                ]}
              >
                Table
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setDisplayMode('cards')}
              style={[
                styles.viewToggleBtn,
                displayMode === 'cards' && styles.viewToggleBtnActive,
              ]}
              accessibilityLabel="Cards View"
            >
              <Ionicons
                name="albums-outline"
                size={14}
                color={displayMode === 'cards' ? '#DC2626' : '#FFFFFF'}
              />
              <Text
                style={[
                  styles.viewToggleBtnText,
                  displayMode === 'cards' && styles.viewToggleBtnTextActive,
                ]}
              >
                Cards
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC2626" />
          <Text style={styles.loadingText}>Loading immunization records...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
          {/* ========================================================================= */}
          {/* 1. ACTIVE IMMUNIZATIONS                                                   */}
          {/* ========================================================================= */}
          <View style={styles.sectionCard}>
            {/* Header */}
            <View style={styles.sectionHeaderWhite}>
              <View style={styles.sectionHeaderTitleRow}>
                <Ionicons name="eyedrop" size={16} color="#DC2626" />
                <Text style={styles.sectionHeaderTitleBlue}>Active Immunizations</Text>
                <View style={styles.countBadgeBlue}>
                  <Text style={styles.countBadgeBlueText}>{activeItems.length}</Text>
                </View>
              </View>
            </View>

            {activeItems.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Ionicons name="eyedrop-outline" size={40} color="#64748B" style={{ transform: [{ rotate: '-45deg' }] }} />
                <Text style={styles.emptyStateItalicText}>No Active Immunizations to Display</Text>
              </View>
            ) : displayMode === 'table' ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={true}
                style={{ width: '100%' }}
                contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
              >
                <View style={{ width: '100%', minWidth: 760 }}>
                  {/* Table Column Headers (Blue #1D4ED8) */}
                  <View style={styles.tableHeaderRowBlue}>
                    <Text style={[styles.tableColHeader, { width: 38, textAlign: 'center' }]}>#</Text>
                    <Text style={[styles.tableColHeader, { width: 105 }]}>DATE</Text>
                    <Text style={[styles.tableColHeader, { flex: 2, minWidth: 175 }]}>IMMUNIZATION</Text>
                    <Text style={[styles.tableColHeader, { flex: 1.2, minWidth: 110 }]}>ROUTE / SITE</Text>
                    <Text style={[styles.tableColHeader, { flex: 1, minWidth: 90 }]}>DOSE / LOT</Text>
                    <Text style={[styles.tableColHeader, { flex: 1.2, minWidth: 115 }]}>STATUS</Text>
                    <Text style={[styles.tableColHeader, { width: 125, textAlign: 'center' }]}>ACTIONS</Text>
                  </View>

                  {/* Active Rows */}
                  {activeItems.map((item, index) => (
                    <View key={item.id ?? index} style={[styles.tableRow, index % 2 === 1 && styles.tableRowEven]}>
                      <Text style={[styles.rowNumberText, { width: 38, textAlign: 'center' }]}>{index + 1}</Text>
                      <Text style={[styles.cellText, { width: 105 }]}>{toDisplayDate(item.date) || '—'}</Text>
                      <View style={{ flex: 2, minWidth: 175, paddingRight: 8 }}>
                        <Text style={styles.cellTextBold} numberOfLines={2}>
                          {item.vaccine}
                        </Text>
                        {item.reason ? (
                          <Text style={styles.cellSubtext} numberOfLines={1}>
                            {item.reason}
                          </Text>
                        ) : null}
                      </View>
                      <View style={{ flex: 1.2, minWidth: 110, paddingRight: 4 }}>
                        <Text style={styles.cellText}>{item.route || '—'}</Text>
                        {item.site ? <Text style={styles.cellSubtext}>{item.site}</Text> : null}
                      </View>
                      <View style={{ flex: 1, minWidth: 90, paddingRight: 4 }}>
                        <Text style={styles.cellText}>{item.dose || '—'}</Text>
                        {item.lot ? <Text style={styles.cellSubtext}>Lot: {item.lot}</Text> : null}
                      </View>
                      <View style={{ flex: 1.2, minWidth: 115 }}>{renderStatusBadge(item)}</View>
                      <View style={[styles.actionButtonsCol, { width: 125, justifyContent: 'center' }]}>
                        <Pressable
                          style={({ pressed }) => [styles.iconBtn, styles.iconBtnPrimary, pressed && styles.pressed]}
                          onPress={() => setSelectedRecord(item)}
                          accessibilityLabel="View"
                        >
                          <Ionicons name="eye-outline" size={14} color="#DC2626" />
                        </Pressable>

                        <Pressable
                          style={({ pressed }) => [styles.btnActionOutline, pressed && styles.pressed]}
                          onPress={() => handleToggleActive(item, false)}
                        >
                          <Ionicons name="stop-circle-outline" size={12} color="#475569" />
                          <Text style={styles.btnActionOutlineText}>Inactivate</Text>
                        </Pressable>

                        <Pressable
                          style={({ pressed }) => [styles.iconBtn, styles.iconBtnDanger, pressed && styles.pressed]}
                          onPress={() => handleRemove(item)}
                          accessibilityLabel="Remove"
                        >
                          <Ionicons name="trash-outline" size={14} color="#DC2626" />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : (
              /* Cards View for Active Immunizations */
              <View style={styles.cardsContainer}>
                {activeItems.map((item, index) => (
                  <View key={item.id ?? index} style={styles.immunizationCard}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <View style={styles.cardIndexBadge}>
                          <Text style={styles.cardIndexText}>#{index + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardVaccineTitle}>{item.vaccine}</Text>
                          {item.reason ? (
                            <Text style={styles.cardReasonText}>{item.reason}</Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.cardHeaderRight}>
                        {renderStatusBadge(item)}
                      </View>
                    </View>

                    <View style={styles.cardGrid}>
                      <View style={styles.cardGridItem}>
                        <Ionicons name="calendar-outline" size={13} color="#DC2626" />
                        <Text style={styles.cardGridLabel}>Date:</Text>
                        <Text style={styles.cardGridValue}>{toDisplayDate(item.date) || '—'}</Text>
                      </View>

                      {(item.route || item.site) && (
                        <View style={styles.cardGridItem}>
                          <Ionicons name="medical-outline" size={13} color="#059669" />
                          <Text style={styles.cardGridLabel}>Route/Site:</Text>
                          <Text style={styles.cardGridValue} numberOfLines={1}>
                            {[item.route, item.site].filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                      )}

                      {(item.dose || item.lot) && (
                        <View style={styles.cardGridItem}>
                          <Ionicons name="flask-outline" size={13} color="#D97706" />
                          <Text style={styles.cardGridLabel}>Dose/Lot:</Text>
                          <Text style={styles.cardGridValue} numberOfLines={1}>
                            {[item.dose, item.lot ? `Lot #${item.lot}` : null].filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                      )}

                      {item.source && (
                        <View style={styles.cardGridItem}>
                          <Ionicons name="shield-checkmark-outline" size={13} color="#6366F1" />
                          <Text style={styles.cardGridLabel}>Source:</Text>
                          <Text style={styles.cardGridValue} numberOfLines={1}>{item.source}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.cardFooter}>
                      <Pressable
                        style={({ pressed }) => [styles.cardActionBtn, styles.cardActionBtnPrimary, pressed && styles.pressed]}
                        onPress={() => setSelectedRecord(item)}
                      >
                        <Ionicons name="eye-outline" size={14} color="#DC2626" />
                        <Text style={styles.cardActionBtnPrimaryText}>View Details</Text>
                      </Pressable>

                      <View style={styles.cardFooterRight}>
                        <Pressable
                          style={({ pressed }) => [styles.cardActionBtn, styles.cardActionBtnOutline, pressed && styles.pressed]}
                          onPress={() => handleToggleActive(item, false)}
                        >
                          <Ionicons name="stop-circle-outline" size={12} color="#475569" />
                          <Text style={styles.cardActionBtnOutlineText}>Inactivate</Text>
                        </Pressable>

                        <Pressable
                          style={({ pressed }) => [styles.iconBtnDangerSmall, pressed && styles.pressed]}
                          onPress={() => handleRemove(item)}
                          accessibilityLabel="Remove"
                        >
                          <Ionicons name="trash-outline" size={14} color="#DC2626" />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ========================================================================= */}
          {/* 2. INACTIVE IMMUNIZATIONS                                                 */}
          {/* ========================================================================= */}
          <View style={[styles.sectionCard, { marginTop: 18 }]}>
            {/* Header */}
            <View style={styles.sectionHeaderWhite}>
              <View style={styles.sectionHeaderTitleRow}>
                <Ionicons name="archive" size={16} color="#475569" />
                <Text style={[styles.sectionHeaderTitleBlue, { color: '#334155' }]}>Inactive Immunizations</Text>
                <View style={styles.countBadgeGray}>
                  <Text style={styles.countBadgeGrayText}>{inactiveItems.length}</Text>
                </View>
              </View>
            </View>

            {inactiveItems.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Ionicons name="archive-outline" size={40} color="#64748B" />
                <Text style={styles.emptyStateItalicText}>No Inactive Immunizations to Display</Text>
              </View>
            ) : displayMode === 'table' ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={true}
                style={{ width: '100%' }}
                contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
              >
                <View style={{ width: '100%', minWidth: 760 }}>
                  {/* Table Column Headers */}
                  <View style={[styles.tableHeaderRowBlue, { backgroundColor: '#475569' }]}>
                    <Text style={[styles.tableColHeader, { width: 38, textAlign: 'center' }]}>#</Text>
                    <Text style={[styles.tableColHeader, { width: 105 }]}>DATE</Text>
                    <Text style={[styles.tableColHeader, { flex: 2, minWidth: 175 }]}>IMMUNIZATION</Text>
                    <Text style={[styles.tableColHeader, { flex: 1.2, minWidth: 110 }]}>ROUTE / SITE</Text>
                    <Text style={[styles.tableColHeader, { flex: 1, minWidth: 90 }]}>DOSE / LOT</Text>
                    <Text style={[styles.tableColHeader, { flex: 1.2, minWidth: 115 }]}>STATUS</Text>
                    <Text style={[styles.tableColHeader, { width: 125, textAlign: 'center' }]}>ACTIONS</Text>
                  </View>

                  {/* Inactive Rows */}
                  {inactiveItems.map((item, index) => (
                    <View key={item.id ?? index} style={[styles.tableRow, index % 2 === 1 && styles.tableRowEven]}>
                      <Text style={[styles.rowNumberText, { width: 38, textAlign: 'center' }]}>{index + 1}</Text>
                      <Text style={[styles.cellText, { width: 105 }]}>{toDisplayDate(item.date) || '—'}</Text>
                      <View style={{ flex: 2, minWidth: 175, paddingRight: 8 }}>
                        <Text style={[styles.cellTextBold, { color: '#64748B' }]} numberOfLines={2}>
                          {item.vaccine}
                        </Text>
                        {item.reason ? (
                          <Text style={styles.cellSubtext} numberOfLines={1}>
                            {item.reason}
                          </Text>
                        ) : null}
                      </View>
                      <View style={{ flex: 1.2, minWidth: 110, paddingRight: 4 }}>
                        <Text style={styles.cellText}>{item.route || '—'}</Text>
                        {item.site ? <Text style={styles.cellSubtext}>{item.site}</Text> : null}
                      </View>
                      <View style={{ flex: 1, minWidth: 90, paddingRight: 4 }}>
                        <Text style={styles.cellText}>{item.dose || '—'}</Text>
                        {item.lot ? <Text style={styles.cellSubtext}>Lot: {item.lot}</Text> : null}
                      </View>
                      <View style={{ flex: 1.2, minWidth: 115 }}>{renderStatusBadge(item)}</View>
                      <View style={[styles.actionButtonsCol, { width: 125, justifyContent: 'center' }]}>
                        <Pressable
                          style={({ pressed }) => [styles.iconBtn, styles.iconBtnPrimary, pressed && styles.pressed]}
                          onPress={() => setSelectedRecord(item)}
                          accessibilityLabel="View"
                        >
                          <Ionicons name="eye-outline" size={14} color="#DC2626" />
                        </Pressable>

                        <Pressable
                          style={({ pressed }) => [styles.btnActionOutline, pressed && styles.pressed]}
                          onPress={() => handleToggleActive(item, true)}
                        >
                          <Ionicons name="refresh-outline" size={12} color="#DC2626" />
                          <Text style={[styles.btnActionOutlineText, { color: '#0F172A' }]}>Reactivate</Text>
                        </Pressable>

                        <Pressable
                          style={({ pressed }) => [styles.iconBtn, styles.iconBtnDanger, pressed && styles.pressed]}
                          onPress={() => handleRemove(item)}
                          accessibilityLabel="Remove"
                        >
                          <Ionicons name="trash-outline" size={14} color="#DC2626" />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : (
              /* Cards View for Inactive Immunizations */
              <View style={styles.cardsContainer}>
                {inactiveItems.map((item, index) => (
                  <View key={item.id ?? index} style={[styles.immunizationCard, { opacity: 0.9 }]}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <View style={[styles.cardIndexBadge, { backgroundColor: '#F1F5F9' }]}>
                          <Text style={[styles.cardIndexText, { color: '#64748B' }]}>#{index + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.cardVaccineTitle, { color: '#475569' }]}>{item.vaccine}</Text>
                          {item.reason ? (
                            <Text style={styles.cardReasonText}>{item.reason}</Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.cardHeaderRight}>
                        {renderStatusBadge(item)}
                      </View>
                    </View>

                    <View style={styles.cardGrid}>
                      <View style={styles.cardGridItem}>
                        <Ionicons name="calendar-outline" size={13} color="#64748B" />
                        <Text style={styles.cardGridLabel}>Date:</Text>
                        <Text style={styles.cardGridValue}>{toDisplayDate(item.date) || '—'}</Text>
                      </View>

                      {(item.route || item.site) && (
                        <View style={styles.cardGridItem}>
                          <Ionicons name="medical-outline" size={13} color="#64748B" />
                          <Text style={styles.cardGridLabel}>Route/Site:</Text>
                          <Text style={styles.cardGridValue} numberOfLines={1}>
                            {[item.route, item.site].filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.cardFooter}>
                      <Pressable
                        style={({ pressed }) => [styles.cardActionBtn, styles.cardActionBtnPrimary, pressed && styles.pressed]}
                        onPress={() => setSelectedRecord(item)}
                      >
                        <Ionicons name="eye-outline" size={14} color="#DC2626" />
                        <Text style={styles.cardActionBtnPrimaryText}>View Details</Text>
                      </Pressable>

                      <View style={styles.cardFooterRight}>
                        <Pressable
                          style={({ pressed }) => [styles.cardActionBtn, styles.cardActionBtnOutline, pressed && styles.pressed]}
                          onPress={() => handleToggleActive(item, true)}
                        >
                          <Ionicons name="refresh-outline" size={12} color="#DC2626" />
                          <Text style={[styles.cardActionBtnOutlineText, { color: '#0F172A' }]}>Reactivate</Text>
                        </Pressable>

                        <Pressable
                          style={({ pressed }) => [styles.iconBtnDangerSmall, pressed && styles.pressed]}
                          onPress={() => handleRemove(item)}
                          accessibilityLabel="Remove"
                        >
                          <Ionicons name="trash-outline" size={14} color="#DC2626" />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* ADD IMMUNIZATION MODAL (MATCHING WEB SCREENSHOT 2 EXACTLY)                */}
      {/* ========================================================================= */}
      <Modal
        visible={addModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Blue Header with Syringe Icon */}
            <View style={styles.modalHeaderBlue}>
              <View style={styles.modalHeaderTitleWrap}>
                <Ionicons name="eyedrop" size={18} color="#FFFFFF" />
                <Text style={styles.modalHeaderTitle}>Add Immunization</Text>
              </View>
              <Pressable
                onPress={() => setAddModalOpen(false)}
                style={({ pressed }) => [styles.modalCloseBtn, pressed && styles.pressed]}
              >
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Immunization / Vaccine * */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>
                  Immunization / Vaccine <Text style={{ color: '#DC2626' }}>*</Text>
                </Text>
                <Pressable
                  style={styles.selectBox}
                  onPress={() => setVaccinePickerOpen(true)}
                >
                  <Text style={[styles.selectBoxText, !vaccine && { color: '#94A3B8' }]} numberOfLines={1}>
                    {vaccine || '— Select vaccine —'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#64748B" />
                </Pressable>
              </View>

              {/* Row 2: Date Administered * & Dose / Amount */}
              <View style={[styles.twoColRow, { marginTop: 12 }]}>
                {/* Date Administered * */}
                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>
                    Date Administered <Text style={{ color: '#DC2626' }}>*</Text>
                  </Text>
                  <AppDatePicker
                    value={date}
                    onChange={setDate}
                    format="DD/MM/YYYY"
                    placeholder="dd/mm/yyyy"
                  />
                </View>

                {/* Dose / Amount */}
                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Dose / Amount</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. 0.5 mL"
                    placeholderTextColor="#94A3B8"
                    value={dose}
                    onChangeText={setDose}
                  />
                </View>
              </View>

              {/* Row 3: Route & Site */}
              <View style={[styles.twoColRow, { marginTop: 12 }]}>
                {/* Route */}
                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Route</Text>
                  <Pressable
                    style={styles.selectBox}
                    onPress={() => setRoutePickerOpen(true)}
                  >
                    <Text style={[styles.selectBoxText, !route && { color: '#94A3B8' }]} numberOfLines={1}>
                      {route || '—'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </Pressable>
                </View>

                {/* Site */}
                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Site</Text>
                  <Pressable
                    style={styles.selectBox}
                    onPress={() => setSitePickerOpen(true)}
                  >
                    <Text style={[styles.selectBoxText, !site && { color: '#94A3B8' }]} numberOfLines={1}>
                      {site || '—'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </Pressable>
                </View>
              </View>

              {/* Row 4: Source & Lot # */}
              <View style={[styles.twoColRow, { marginTop: 12 }]}>
                {/* Source */}
                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Source</Text>
                  <Pressable
                    style={styles.selectBox}
                    onPress={() => setSourcePickerOpen(true)}
                  >
                    <Text style={[styles.selectBoxText, !source && { color: '#94A3B8' }]} numberOfLines={1}>
                      {source || '—'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </Pressable>
                </View>

                {/* Lot # */}
                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Lot #</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="optional"
                    placeholderTextColor="#94A3B8"
                    value={lot}
                    onChangeText={setLot}
                  />
                </View>
              </View>

              <View style={{ height: 16 }} />
            </ScrollView>

            {/* Modal Footer: Cancel & Save Immunization */}
            <View style={styles.modalFooter}>
              <Pressable
                style={({ pressed }) => [styles.btnCancelTextOnly, pressed && styles.pressed]}
                onPress={() => setAddModalOpen(false)}
              >
                <Text style={styles.btnCancelTextOnlyLabel}>Cancel</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.btnSaveImmunization,
                  saving && styles.btnDisabled,
                  pressed && styles.pressed,
                ]}
                onPress={handleSaveAdd}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="save" size={16} color="#FFFFFF" />
                    <Text style={styles.btnSaveImmunizationText}>Save Immunization</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* DECLINE / CONTRAINDICATE MODAL                                            */}
      {/* ========================================================================= */}
      <Modal
        visible={declineModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDeclineModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.modalHeaderBlue}>
              <View style={styles.modalHeaderTitleWrap}>
                <Ionicons name="ban" size={18} color="#FFFFFF" />
                <Text style={styles.modalHeaderTitle}>Decline / Contraindicate Immunization</Text>
              </View>
              <Pressable
                onPress={() => setDeclineModalOpen(false)}
                style={({ pressed }) => [styles.modalCloseBtn, pressed && styles.pressed]}
              >
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Vaccine */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>
                  Immunization / Vaccine <Text style={{ color: '#DC2626' }}>*</Text>
                </Text>
                <Pressable
                  style={styles.selectBox}
                  onPress={() => setDeclineVaccinePickerOpen(true)}
                >
                  <Text style={[styles.selectBoxText, !declineVaccine && { color: '#94A3B8' }]} numberOfLines={1}>
                    {declineVaccine || '— Select vaccine —'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#64748B" />
                </Pressable>
              </View>

              {/* Row: Type & Date */}
              <View style={[styles.twoColRow, { marginTop: 12 }]}>
                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>
                    Type <Text style={{ color: '#DC2626' }}>*</Text>
                  </Text>
                  <Pressable
                    style={styles.selectBox}
                    onPress={() => setDeclineTypePickerOpen(true)}
                  >
                    <Text style={styles.selectBoxText} numberOfLines={1}>
                      {DECLINE_TYPES.find((t) => t.value === declineType)?.label || declineType}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </Pressable>
                </View>

                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Date</Text>
                  <AppDatePicker
                    value={declineDate}
                    onChange={setDeclineDate}
                    format="DD/MM/YYYY"
                    placeholder="dd/mm/yyyy"
                  />
                </View>
              </View>

              {/* Reason */}
              <View style={{ marginTop: 12 }}>
                <Text style={styles.fieldLabel}>Reason</Text>
                <TextInput
                  style={[styles.textInput, { height: 75, textAlignVertical: 'top' }]}
                  placeholder="Reason for declining or contraindication"
                  placeholderTextColor="#94A3B8"
                  multiline
                  value={declineReason}
                  onChangeText={setDeclineReason}
                />
              </View>

              <View style={{ height: 16 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                style={({ pressed }) => [styles.btnCancelTextOnly, pressed && styles.pressed]}
                onPress={() => setDeclineModalOpen(false)}
              >
                <Text style={styles.btnCancelTextOnlyLabel}>Cancel</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.btnSaveImmunization,
                  saving && styles.btnDisabled,
                  pressed && styles.pressed,
                ]}
                onPress={handleSaveDecline}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="save" size={16} color="#FFFFFF" />
                    <Text style={styles.btnSaveImmunizationText}>Save Record</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* VACCINE PICKER MODAL                                                      */}
      {/* ========================================================================= */}
      <Modal
        visible={vaccinePickerOpen || declineVaccinePickerOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setVaccinePickerOpen(false);
          setDeclineVaccinePickerOpen(false);
        }}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={[styles.pickerModalContent, { maxWidth: 380 }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Vaccine</Text>
              <Pressable onPress={() => {
                setVaccinePickerOpen(false);
                setDeclineVaccinePickerOpen(false);
              }}>
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 380 }}>
              {VACCINE_OPTIONS.map((v) => {
                const currentVal = vaccinePickerOpen ? vaccine : declineVaccine;
                const isSelected = currentVal === v.value;
                return (
                  <Pressable
                    key={v.value}
                    style={[styles.pickerOptionItem, isSelected && styles.pickerOptionItemActive]}
                    onPress={() => {
                      if (vaccinePickerOpen) setVaccine(v.value);
                      else setDeclineVaccine(v.value);
                      setVaccinePickerOpen(false);
                      setDeclineVaccinePickerOpen(false);
                    }}
                  >
                    <Text style={[styles.pickerOptionText, isSelected && styles.pickerOptionTextActive]}>
                      {v.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={18} color="#DC2626" />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* ROUTE PICKER MODAL                                                        */}
      {/* ========================================================================= */}
      <Modal
        visible={routePickerOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setRoutePickerOpen(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={[styles.pickerModalContent, { maxWidth: 340 }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Route</Text>
              <Pressable onPress={() => setRoutePickerOpen(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>
            {ROUTE_OPTIONS.map((r) => (
              <Pressable
                key={r.value}
                style={[styles.pickerOptionItem, route === r.value && styles.pickerOptionItemActive]}
                onPress={() => {
                  setRoute(r.value);
                  setRoutePickerOpen(false);
                }}
              >
                <Text style={[styles.pickerOptionText, route === r.value && styles.pickerOptionTextActive]}>
                  {r.label}
                </Text>
                {route === r.value && <Ionicons name="checkmark" size={18} color="#DC2626" />}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* SITE PICKER MODAL                                                         */}
      {/* ========================================================================= */}
      <Modal
        visible={sitePickerOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSitePickerOpen(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={[styles.pickerModalContent, { maxWidth: 340 }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Site</Text>
              <Pressable onPress={() => setSitePickerOpen(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>
            {SITE_OPTIONS.map((s) => (
              <Pressable
                key={s.value}
                style={[styles.pickerOptionItem, site === s.value && styles.pickerOptionItemActive]}
                onPress={() => {
                  setSite(s.value);
                  setSitePickerOpen(false);
                }}
              >
                <Text style={[styles.pickerOptionText, site === s.value && styles.pickerOptionTextActive]}>
                  {s.label}
                </Text>
                {site === s.value && <Ionicons name="checkmark" size={18} color="#DC2626" />}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* SOURCE PICKER MODAL                                                       */}
      {/* ========================================================================= */}
      <Modal
        visible={sourcePickerOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSourcePickerOpen(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={[styles.pickerModalContent, { maxWidth: 380 }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Source</Text>
              <Pressable onPress={() => setSourcePickerOpen(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>
            {SOURCE_OPTIONS.map((s) => (
              <Pressable
                key={s.value}
                style={[styles.pickerOptionItem, source === s.value && styles.pickerOptionItemActive]}
                onPress={() => {
                  setSource(s.value);
                  setSourcePickerOpen(false);
                }}
              >
                <Text style={[styles.pickerOptionText, source === s.value && styles.pickerOptionTextActive]}>
                  {s.label}
                </Text>
                {source === s.value && <Ionicons name="checkmark" size={18} color="#DC2626" />}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* DECLINE TYPE PICKER MODAL                                                 */}
      {/* ========================================================================= */}
      <Modal
        visible={declineTypePickerOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeclineTypePickerOpen(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={[styles.pickerModalContent, { maxWidth: 340 }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Type</Text>
              <Pressable onPress={() => setDeclineTypePickerOpen(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>
            {DECLINE_TYPES.map((t) => (
              <Pressable
                key={t.value}
                style={[styles.pickerOptionItem, declineType === t.value && styles.pickerOptionItemActive]}
                onPress={() => {
                  setDeclineType(t.value);
                  setDeclineTypePickerOpen(false);
                }}
              >
                <Text style={[styles.pickerOptionText, declineType === t.value && styles.pickerOptionTextActive]}>
                  {t.label}
                </Text>
                {declineType === t.value && <Ionicons name="checkmark" size={18} color="#DC2626" />}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* DETAILS MODAL                                                             */}
      {/* ========================================================================= */}
      <Modal
        visible={Boolean(selectedRecord)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedRecord(null)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={[styles.pickerModalContent, { maxWidth: 440 }]}>
            <View style={styles.pickerModalHeader}>
              <View>
                <Text style={styles.pickerModalTitle}>Immunization Details</Text>
                <Text style={styles.subReadingText}>
                  Date: {selectedRecord?.date || '—'}
                </Text>
              </View>
              <Pressable onPress={() => setSelectedRecord(null)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            {selectedRecord && (
              <ScrollView style={{ padding: 16 }}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Vaccine:</Text>
                  <Text style={[styles.detailValue, { fontWeight: '700' }]}>
                    {selectedRecord.vaccine}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date Administered:</Text>
                  <Text style={styles.detailValue}>{selectedRecord.date || '—'}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Dose / Amount:</Text>
                  <Text style={styles.detailValue}>{selectedRecord.dose || '—'}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Route:</Text>
                  <Text style={styles.detailValue}>{selectedRecord.route || '—'}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Site:</Text>
                  <Text style={styles.detailValue}>{selectedRecord.site || '—'}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Source:</Text>
                  <Text style={styles.detailValue}>{selectedRecord.source || '—'}</Text>
                </View>

                {selectedRecord.lot ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Lot #:</Text>
                    <Text style={styles.detailValue}>{selectedRecord.lot}</Text>
                  </View>
                ) : null}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <View style={{ flex: 1 }}>{renderStatusBadge(selectedRecord)}</View>
                </View>

                {selectedRecord.reason ? (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.detailLabel}>Reason / Notes:</Text>
                    <Text style={[styles.detailValue, { marginTop: 4 }]}>
                      {selectedRecord.reason}
                    </Text>
                  </View>
                ) : null}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  toolbar: {
    backgroundColor: '#111111',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 2.5,
    borderBottomColor: '#DC2626',
  },
  toolbarMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  toolbarActionsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 6,
  },
  btnToolbar: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
    elevation: 2,
  },
  btnToolbarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.3,
  },
  btnToolbarSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  viewModeToggleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
    borderRadius: 7,
    padding: 3,
  },
  viewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  viewToggleBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  viewToggleBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  viewToggleBtnTextActive: {
    color: '#DC2626',
    fontWeight: '800',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  scrollArea: {
    flex: 1,
    padding: 14,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
  },
  sectionHeaderWhite: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  sectionHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeaderTitleBlue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  countBadgeBlue: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  countBadgeBlueText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
  },
  countBadgeGray: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  countBadgeGrayText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  tableHeaderRowBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    paddingVertical: 9,
    paddingHorizontal: 10,
    width: '100%',
  },
  tableColHeader: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    width: '100%',
  },
  tableRowEven: {
    backgroundColor: '#F8FAFC',
  },
  rowNumberText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  cellText: {
    fontSize: 12,
    color: '#1E293B',
  },
  cellTextBold: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  cellSubtext: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  actionButtonsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  iconBtn: {
    width: 26,
    height: 26,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  iconBtnPrimary: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  iconBtnDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  btnActionOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  btnActionOutlineText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },

  /* Cards View Styles */
  cardsContainer: {
    padding: 10,
    gap: 10,
    backgroundColor: '#F8FAFC',
  },
  immunizationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    padding: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flex: 1,
  },
  cardIndexBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 1,
  },
  cardIndexText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
  },
  cardVaccineTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 18,
  },
  cardReasonText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  cardHeaderRight: {
    alignItems: 'flex-end',
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 10,
  },
  cardGridItem: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardGridLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  cardGridValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
    flexShrink: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  cardActionBtnPrimary: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  cardActionBtnPrimaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardActionBtnOutline: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  cardActionBtnOutlineText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  iconBtnDangerSmall: {
    width: 26,
    height: 26,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  emptyStateItalicText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#64748B',
    marginTop: 10,
  },

  /* MODAL STYLES */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 580,
    maxHeight: '94%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeaderBlue: {
    backgroundColor: '#111111',
    borderBottomWidth: 3,
    borderBottomColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalContent: {
    padding: 16,
    flex: 1,
  },
  fieldWrap: {
    marginBottom: 0,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
  },
  colHalf: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  selectBox: {
    height: 38,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectBoxText: {
    fontSize: 13,
    color: '#1E293B',
  },
  textInput: {
    height: 38,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#1E293B',
  },
  iconInputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  trailingIcon: {
    position: 'absolute',
    right: 10,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  btnCancelTextOnly: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnCancelTextOnlyLabel: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 13,
  },
  btnSaveImmunization: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DC2626',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 6,
  },
  btnSaveImmunizationText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  btnDisabled: {
    opacity: 0.5,
  },

  /* Pickers */
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  pickerModalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  pickerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  pickerModalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  pickerOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerOptionItemActive: {
    backgroundColor: '#FEE2E2',
  },
  pickerOptionText: {
    fontSize: 13,
    color: '#334155',
  },
  pickerOptionTextActive: {
    color: '#DC2626',
    fontWeight: '700',
  },

  /* Details Modal */
  subReadingText: {
    fontSize: 11,
    color: '#64748B',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailLabel: {
    width: 140,
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  detailValue: {
    fontSize: 13,
    color: '#1E293B',
    flex: 1,
  },
  pressed: {
    opacity: 0.8,
  },
});
