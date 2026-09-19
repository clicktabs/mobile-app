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

export type InfectionItem = {
  id?: number | string;
  infection_type?: string;
  precaution_type?: string;
  isolation_precautions?: string;
  isolation_status?: string;
  organism?: string;
  site?: string;
  risk_level?: string;
  severity?: string;
  culture_results?: string;
  date_identified?: string;
  start_date?: string;
  date_resolved?: string;
  end_date?: string;
  status?: string;
  ordered_by?: string;
  notes?: string;
};

type Props = {
  patientId: number;
  token: string;
  patient: Record<string, any> | null;
  items: InfectionItem[];
  onRefresh: () => void;
  loading?: boolean;
};

const INFECTION_TYPES = [
  { value: '', label: 'Select infection type' },
  { value: 'Healthcare-Associated Pneumonia', label: 'Healthcare-Associated Pneumonia' },
  { value: 'Central Line-Associated BSI', label: 'Central Line-Associated BSI' },
  { value: 'Surgical Site Infection', label: 'Surgical Site Infection' },
  { value: 'Catheter-Associated UTI', label: 'Catheter-Associated UTI' },
  { value: 'C. difficile Infection', label: 'C. difficile Infection' },
  { value: 'Other', label: 'Other' },
];

const INFECTION_SITES = [
  { value: '', label: 'Select site' },
  { value: 'Respiratory Tract', label: 'Respiratory Tract' },
  { value: 'Bloodstream', label: 'Bloodstream' },
  { value: 'Urinary Tract', label: 'Urinary Tract' },
  { value: 'Surgical Wound', label: 'Surgical Wound' },
  { value: 'Skin/Soft Tissue', label: 'Skin/Soft Tissue' },
  { value: 'Other', label: 'Other' },
];

const RISK_LEVELS = [
  { value: '', label: 'Select risk level' },
  { value: '1 - Very Low', label: '1 - Very Low' },
  { value: '2 - Low', label: '2 - Low' },
  { value: '3 - Low', label: '3 - Low' },
  { value: '4 - Medium', label: '4 - Medium' },
  { value: '5 - Medium', label: '5 - Medium' },
  { value: '6 - Medium', label: '6 - Medium' },
  { value: '7 - High', label: '7 - High' },
  { value: '8 - High', label: '8 - High' },
  { value: '9 - Very High', label: '9 - Very High' },
  { value: '10 - Critical', label: '10 - Critical' },
];

const ISOLATION_PRECAUTIONS = [
  { value: '', label: 'Select isolation type' },
  { value: 'Standard Precautions', label: 'Standard Precautions' },
  { value: 'Contact Precautions', label: 'Contact Precautions' },
  { value: 'Droplet Precautions', label: 'Droplet Precautions' },
  { value: 'Airborne Precautions', label: 'Airborne Precautions' },
  { value: 'Protective Environment', label: 'Protective Environment' },
];

function getInitialDate() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  return `${d}/${m}/${y}`;
}

export function PatientInfectionsView({
  patientId,
  token,
  patient,
  items,
  onRefresh,
  loading,
}: Props) {
  // Add Infection Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [infectionType, setInfectionType] = useState('Healthcare-Associated Pneumonia');
  const [organism, setOrganism] = useState('');
  const [infectionSite, setInfectionSite] = useState('Respiratory Tract');
  const [riskLevel, setRiskLevel] = useState('3 - Low');
  const [isolationType, setIsolationType] = useState('Standard Precautions');
  const [dateIdentified, setDateIdentified] = useState(getInitialDate);
  const [cultureInfo, setCultureInfo] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Pickers Modals
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [sitePickerOpen, setSitePickerOpen] = useState(false);
  const [riskPickerOpen, setRiskPickerOpen] = useState(false);
  const [isolationPickerOpen, setIsolationPickerOpen] = useState(false);

  // Details Modal & Actions
  const [selectedInfection, setSelectedInfection] = useState<InfectionItem | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | number | null>(null);

  const activeItems = useMemo(() => {
    return items.filter((i) => {
      const s = String(i.status || 'active').toLowerCase();
      return s === 'active' && !i.date_resolved;
    });
  }, [items]);

  const resolvedItems = useMemo(() => {
    return items.filter((i) => {
      const s = String(i.status || '').toLowerCase();
      return s === 'resolved' || s === 'inactive' || Boolean(i.date_resolved);
    });
  }, [items]);

  const handleOpenAddModal = () => {
    setInfectionType('Healthcare-Associated Pneumonia');
    setOrganism('');
    setInfectionSite('Respiratory Tract');
    setRiskLevel('3 - Low');
    setIsolationType('Standard Precautions');
    setDateIdentified(getInitialDate());
    setCultureInfo('');
    setNotes('');
    setAddModalOpen(true);
  };

  const handleSaveInfection = async () => {
    if (!infectionType.trim()) {
      showAlert('Required', 'Please select an infection type.');
      return;
    }
    if (!organism.trim()) {
      showAlert('Required', 'Please enter organism (e.g. MRSA, E. coli).');
      return;
    }
    if (!infectionSite.trim()) {
      showAlert('Required', 'Please select an infection site.');
      return;
    }
    if (!riskLevel.trim()) {
      showAlert('Required', 'Please select a risk level.');
      return;
    }
    if (!isolationType.trim()) {
      showAlert('Required', 'Please select isolation precautions.');
      return;
    }

    setSaving(true);
    try {
      const res = await staffApi.addPatientInfection(token, patientId, {
        infection_type: infectionType,
        organism: organism.trim(),
        site: infectionSite,
        infection_site: infectionSite,
        risk_level: riskLevel,
        severity: riskLevel,
        isolation_precautions: isolationType,
        isolation_type: isolationType,
        date_identified: dateIdentified,
        culture_results: cultureInfo.trim() || undefined,
        culture_info: cultureInfo.trim() || undefined,
        notes: notes.trim() || undefined,
        additional_notes: notes.trim() || undefined,
        status: 'active',
      });

      if (res && res.success) {
        setAddModalOpen(false);
        onRefresh();
        showAlert('Success', 'Infection record saved successfully');
      } else {
        showAlert('Error', res?.message || 'Failed to save infection record.');
      }
    } catch (e: any) {
      showAlert('Error', e?.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (item: InfectionItem, targetStatus: 'active' | 'resolved') => {
    if (!item.id) return;
    setActionLoadingId(item.id);
    try {
      const res = await staffApi.updatePatientInfectionStatus(
        token,
        patientId,
        item.id,
        targetStatus,
      );
      if (res && res.success) {
        onRefresh();
        showAlert('Status Updated', `Infection record marked as ${targetStatus}.`);
      } else {
        showAlert('Error', res?.message || 'Failed to update status.');
      }
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to update status.');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Toolbar matching Web Screenshot 2 */}
      <View style={styles.toolbar}>
        <Pressable
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}
          onPress={handleOpenAddModal}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.btnPrimaryText}>ADD INFECTION</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
          onPress={onRefresh}
        >
          <Ionicons name="refresh" size={16} color="#0F172A" />
          <Text style={styles.btnSecondaryText}>REFRESH</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC2626" />
          <Text style={styles.loadingText}>Loading infection control records...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
          {/* ========================================================================= */}
          {/* 1. ACTIVE INFECTIONS SECTION (MATCHING WEB SCREENSHOT 2)                  */}
          {/* ========================================================================= */}
          <View style={styles.sectionCard}>
            {/* Header: Red Banner with Virus Icon + Badge Counter */}
            <View style={styles.sectionHeaderRed}>
              <View style={styles.sectionHeaderTitleWrap}>
                <Ionicons name="bug" size={18} color="#DC2626" />
                <Text style={styles.sectionHeaderTitleWhite}>Active Infections</Text>
              </View>
              <View style={styles.countBadgeWhite}>
                <Text style={styles.countBadgeWhiteText}>{activeItems.length}</Text>
              </View>
            </View>

            {activeItems.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Ionicons name="shield-checkmark" size={48} color="#94A3B8" />
                <Text style={styles.emptyStateTitle}>No active infections</Text>
                <Text style={styles.emptyStateSubtitle}>
                  No infection control records found for this patient.
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={true}
                style={{ width: '100%' }}
                contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
              >
                <View style={{ width: '100%', minWidth: 920 }}>
                  {/* Table Column Headers (Blue #2563EB Background) */}
                  <View style={styles.tableHeaderRowBlue}>
                    <Text style={[styles.tableColHeader, { width: 44, textAlign: 'center' }]}>#</Text>
                    <Text style={[styles.tableColHeader, { flex: 2.5, minWidth: 170 }]}>INFECTION TYPE</Text>
                    <Text style={[styles.tableColHeader, { flex: 1.4, minWidth: 120 }]}>ORGANISM</Text>
                    <Text style={[styles.tableColHeader, { flex: 1.4, minWidth: 120 }]}>SITE</Text>
                    <Text style={[styles.tableColHeader, { flex: 1.1, minWidth: 95 }]}>RISK LEVEL</Text>
                    <Text style={[styles.tableColHeader, { flex: 1.6, minWidth: 130 }]}>ISOLATION STATUS</Text>
                    <Text style={[styles.tableColHeader, { flex: 1.4, minWidth: 120 }]}>CULTURE RESULTS</Text>
                    <Text style={[styles.tableColHeader, { flex: 1.2, minWidth: 105 }]}>DATE IDENTIFIED</Text>
                    <Text style={[styles.tableColHeader, { width: 85, textAlign: 'center' }]}>ACTIONS</Text>
                  </View>

                  {/* Active Rows */}
                  {activeItems.map((item, index) => (
                    <View key={item.id ?? index} style={styles.tableRow}>
                      <Text style={[styles.rowNumberText, { width: 44, textAlign: 'center' }]}>{index + 1}</Text>
                      <Text style={[styles.cellTextBold, { flex: 2.5, minWidth: 170 }]} numberOfLines={2}>
                        {item.infection_type || 'Healthcare-Associated Pneumonia'}
                      </Text>
                      <Text style={[styles.cellTextRed, { flex: 1.4, minWidth: 120 }]} numberOfLines={1}>
                        {item.organism || '—'}
                      </Text>
                      <Text style={[styles.cellText, { flex: 1.4, minWidth: 120 }]} numberOfLines={1}>
                        {item.site || '—'}
                      </Text>
                      <View style={{ flex: 1.1, minWidth: 95 }}>
                        <View style={styles.riskBadge}>
                          <Text style={styles.riskBadgeText}>{item.risk_level || item.severity || '3 - Low'}</Text>
                        </View>
                      </View>
                      <View style={{ flex: 1.6, minWidth: 130 }}>
                        <View style={styles.isolationBadge}>
                          <Text style={styles.isolationBadgeText} numberOfLines={1}>
                            {item.isolation_status || item.isolation_precautions || 'Standard'}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.cellTextMuted, { flex: 1.4, minWidth: 120 }]} numberOfLines={1}>
                        {item.culture_results || '—'}
                      </Text>
                      <Text style={[styles.cellText, { flex: 1.2, minWidth: 105 }]}>
                        {item.date_identified || 'N/A'}
                      </Text>
                      <View style={[styles.actionButtonsCol, { width: 85, justifyContent: 'center' }]}>
                        <Pressable
                          style={({ pressed }) => [styles.iconBtn, styles.iconBtnPrimary, pressed && styles.pressed]}
                          onPress={() => setSelectedInfection(item)}
                          accessibilityLabel="View Details"
                        >
                          <Ionicons name="eye-outline" size={15} color="#0F172A" />
                        </Pressable>

                        <Pressable
                          style={({ pressed }) => [styles.iconBtn, styles.iconBtnSuccess, pressed && styles.pressed]}
                          onPress={async () => {
                            const ok = await confirmAction(
                              'Resolve Infection',
                              `Mark "${item.infection_type}" as resolved?`,
                              { confirmLabel: 'Mark Resolved' },
                            );
                            if (ok) {
                              await handleToggleStatus(item, 'resolved');
                            }
                          }}
                          accessibilityLabel="Mark Resolved"
                        >
                          {actionLoadingId === item.id ? (
                            <ActivityIndicator size="small" color="#15803D" />
                          ) : (
                            <Ionicons name="checkmark-done" size={15} color="#15803D" />
                          )}
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>

          {/* ========================================================================= */}
          {/* 2. RECENTLY RESOLVED INFECTIONS (MATCHING WEB SCREENSHOT 2)               */}
          {/* ========================================================================= */}
          <View style={[styles.sectionCard, { marginTop: 20 }]}>
            {/* Header: Red Banner with Checkmark Icon + Badge Counter */}
            <View style={styles.sectionHeaderRed}>
              <View style={styles.sectionHeaderTitleWrap}>
                <Ionicons name="checkmark-circle" size={18} color="#15803D" />
                <Text style={styles.sectionHeaderTitleWhite}>Recently Resolved Infections</Text>
              </View>
              <View style={styles.countBadgeWhite}>
                <Text style={styles.countBadgeWhiteText}>{resolvedItems.length}</Text>
              </View>
            </View>

            {resolvedItems.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Ionicons name="checkmark-circle-outline" size={48} color="#94A3B8" />
                <Text style={styles.emptyStateTitle}>No resolved infections</Text>
                <Text style={styles.emptyStateSubtitle}>
                  No recently resolved infection records found.
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={true}
                style={{ width: '100%' }}
                contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
              >
                <View style={{ width: '100%', minWidth: 840 }}>
                  {/* Table Column Headers (Blue #2563EB Background) */}
                  <View style={styles.tableHeaderRowBlue}>
                    <Text style={[styles.tableColHeader, { width: 44, textAlign: 'center' }]}>#</Text>
                    <Text style={[styles.tableColHeader, { flex: 2.6, minWidth: 180 }]}>INFECTION TYPE</Text>
                    <Text style={[styles.tableColHeader, { flex: 1.6, minWidth: 130 }]}>ORGANISM</Text>
                    <Text style={[styles.tableColHeader, { flex: 1.6, minWidth: 130 }]}>SITE</Text>
                    <Text style={[styles.tableColHeader, { flex: 1.3, minWidth: 110 }]}>DATE IDENTIFIED</Text>
                    <Text style={[styles.tableColHeader, { flex: 1.3, minWidth: 110 }]}>DATE RESOLVED</Text>
                    <Text style={[styles.tableColHeader, { width: 85, textAlign: 'center' }]}>ACTIONS</Text>
                  </View>

                  {/* Resolved Rows */}
                  {resolvedItems.map((item, index) => (
                    <View key={item.id ?? index} style={styles.tableRow}>
                      <Text style={[styles.rowNumberText, { width: 44, textAlign: 'center' }]}>{index + 1}</Text>
                      <Text style={[styles.cellTextBold, { flex: 2.6, minWidth: 180 }]} numberOfLines={2}>
                        {item.infection_type || 'Healthcare-Associated Pneumonia'}
                      </Text>
                      <Text style={[styles.cellTextMuted, { flex: 1.6, minWidth: 130 }]} numberOfLines={1}>
                        {item.organism || '—'}
                      </Text>
                      <Text style={[styles.cellText, { flex: 1.6, minWidth: 130 }]} numberOfLines={1}>
                        {item.site || '—'}
                      </Text>
                      <Text style={[styles.cellText, { flex: 1.3, minWidth: 110 }]}>
                        {item.date_identified || 'N/A'}
                      </Text>
                      <Text style={[styles.cellTextSuccess, { flex: 1.3, minWidth: 110 }]}>
                        {item.date_resolved || 'Resolved'}
                      </Text>
                      <View style={[styles.actionButtonsCol, { width: 85, justifyContent: 'center' }]}>
                        <Pressable
                          style={({ pressed }) => [styles.iconBtn, styles.iconBtnPrimary, pressed && styles.pressed]}
                          onPress={() => setSelectedInfection(item)}
                          accessibilityLabel="View Details"
                        >
                          <Ionicons name="eye-outline" size={15} color="#0F172A" />
                        </Pressable>

                        <Pressable
                          style={({ pressed }) => [styles.iconBtn, styles.iconBtnPrimary, pressed && styles.pressed]}
                          onPress={async () => {
                            const ok = await confirmAction(
                              'Reactivate Infection',
                              `Re-activate "${item.infection_type}"?`,
                              { confirmLabel: 'Reactivate' },
                            );
                            if (ok) {
                              await handleToggleStatus(item, 'active');
                            }
                          }}
                          accessibilityLabel="Reactivate"
                        >
                          <Ionicons name="arrow-undo-outline" size={15} color="#0F172A" />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* ADD NEW INFECTION MODAL (MATCHING WEB SCREENSHOT 1 EXACTLY)               */}
      {/* ========================================================================= */}
      <Modal
        visible={addModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Red Header Bar with Virus Icon */}
            <View style={styles.modalHeaderRed}>
              <View style={styles.modalHeaderTitleWrap}>
                <Ionicons name="bug" size={20} color="#FFFFFF" />
                <Text style={styles.modalHeaderTitle}>Add New Infection</Text>
              </View>
              <Pressable
                onPress={() => setAddModalOpen(false)}
                style={({ pressed }) => [styles.modalCloseBtn, pressed && styles.pressed]}
              >
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Row 1: Infection Type * & Organism * */}
              <View style={styles.twoColRow}>
                {/* Infection Type * */}
                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Infection Type *</Text>
                  <Pressable
                    style={styles.selectBox}
                    onPress={() => setTypePickerOpen(true)}
                  >
                    <Text style={styles.selectBoxText} numberOfLines={1}>
                      {infectionType || 'Select infection type'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </Pressable>
                </View>

                {/* Organism * */}
                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Organism *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g., MRSA, E. coli, Pseudomonas"
                    placeholderTextColor="#94A3B8"
                    value={organism}
                    onChangeText={setOrganism}
                  />
                </View>
              </View>

              {/* Row 2: Infection Site * & Risk Level * */}
              <View style={[styles.twoColRow, { marginTop: 12 }]}>
                {/* Infection Site * */}
                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Infection Site *</Text>
                  <Pressable
                    style={styles.selectBox}
                    onPress={() => setSitePickerOpen(true)}
                  >
                    <Text style={styles.selectBoxText} numberOfLines={1}>
                      {infectionSite || 'Select site'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </Pressable>
                </View>

                {/* Risk Level * */}
                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Risk Level *</Text>
                  <Pressable
                    style={styles.selectBox}
                    onPress={() => setRiskPickerOpen(true)}
                  >
                    <Text style={styles.selectBoxText} numberOfLines={1}>
                      {riskLevel || 'Select risk level'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </Pressable>
                </View>
              </View>

              {/* Row 3: Isolation Precautions * & Date Identified * */}
              <View style={[styles.twoColRow, { marginTop: 12 }]}>
                {/* Isolation Precautions * */}
                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Isolation Precautions *</Text>
                  <Pressable
                    style={[styles.selectBox, { borderColor: '#3B82F6' }]}
                    onPress={() => setIsolationPickerOpen(true)}
                  >
                    <Text style={styles.selectBoxText} numberOfLines={1}>
                      {isolationType || 'Select isolation type'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </Pressable>
                </View>

                {/* Date Identified * */}
                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>Date Identified *</Text>
                  <AppDatePicker
                    value={dateIdentified}
                    onChange={setDateIdentified}
                    format="DD/MM/YYYY"
                    placeholder="dd/mm/yyyy"
                  />
                </View>
              </View>

              {/* Culture Information */}
              <View style={{ marginTop: 12 }}>
                <Text style={styles.fieldLabel}>Culture Information</Text>
                <TextInput
                  style={[styles.textInput, { height: 75, textAlignVertical: 'top' }]}
                  placeholder="Enter culture type, results, and sensitivity information"
                  placeholderTextColor="#94A3B8"
                  multiline
                  value={cultureInfo}
                  onChangeText={setCultureInfo}
                />
              </View>

              {/* Additional Notes */}
              <View style={{ marginTop: 12 }}>
                <Text style={styles.fieldLabel}>Additional Notes</Text>
                <TextInput
                  style={[styles.textInput, { height: 75, textAlignVertical: 'top' }]}
                  placeholder="Enter any additional notes about the infection"
                  placeholderTextColor="#94A3B8"
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>

              <View style={{ height: 16 }} />
            </ScrollView>

            {/* Modal Footer: Cancel & Save Infection */}
            <View style={styles.modalFooter}>
              <Pressable
                style={({ pressed }) => [styles.btnCancelOutline, pressed && styles.pressed]}
                onPress={() => setAddModalOpen(false)}
              >
                <Text style={styles.btnCancelOutlineText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.btnSaveInfection,
                  saving && styles.btnDisabled,
                  pressed && styles.pressed,
                ]}
                onPress={handleSaveInfection}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="save" size={16} color="#FFFFFF" />
                    <Text style={styles.btnSaveInfectionText}>Save Infection</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* INFECTION TYPE PICKER MODAL                                               */}
      {/* ========================================================================= */}
      <Modal
        visible={typePickerOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setTypePickerOpen(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={[styles.pickerModalContent, { maxWidth: 380 }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Infection Type</Text>
              <Pressable onPress={() => setTypePickerOpen(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 380 }}>
              {INFECTION_TYPES.map((t) => (
                <Pressable
                  key={t.value}
                  style={[
                    styles.pickerOptionItem,
                    infectionType === t.value && styles.pickerOptionItemActive,
                  ]}
                  onPress={() => {
                    setInfectionType(t.value);
                    setTypePickerOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      infectionType === t.value && styles.pickerOptionTextActive,
                    ]}
                  >
                    {t.label}
                  </Text>
                  {infectionType === t.value && (
                    <Ionicons name="checkmark" size={18} color="#DC2626" />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* INFECTION SITE PICKER MODAL                                               */}
      {/* ========================================================================= */}
      <Modal
        visible={sitePickerOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSitePickerOpen(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={[styles.pickerModalContent, { maxWidth: 380 }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Infection Site</Text>
              <Pressable onPress={() => setSitePickerOpen(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 380 }}>
              {INFECTION_SITES.map((s) => (
                <Pressable
                  key={s.value}
                  style={[
                    styles.pickerOptionItem,
                    infectionSite === s.value && styles.pickerOptionItemActive,
                  ]}
                  onPress={() => {
                    setInfectionSite(s.value);
                    setSitePickerOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      infectionSite === s.value && styles.pickerOptionTextActive,
                    ]}
                  >
                    {s.label}
                  </Text>
                  {infectionSite === s.value && (
                    <Ionicons name="checkmark" size={18} color="#DC2626" />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* RISK LEVEL PICKER MODAL                                                   */}
      {/* ========================================================================= */}
      <Modal
        visible={riskPickerOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setRiskPickerOpen(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={[styles.pickerModalContent, { maxWidth: 380 }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Risk Level</Text>
              <Pressable onPress={() => setRiskPickerOpen(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 380 }}>
              {RISK_LEVELS.map((r) => (
                <Pressable
                  key={r.value}
                  style={[
                    styles.pickerOptionItem,
                    riskLevel === r.value && styles.pickerOptionItemActive,
                  ]}
                  onPress={() => {
                    setRiskLevel(r.value);
                    setRiskPickerOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      riskLevel === r.value && styles.pickerOptionTextActive,
                    ]}
                  >
                    {r.label}
                  </Text>
                  {riskLevel === r.value && (
                    <Ionicons name="checkmark" size={18} color="#DC2626" />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* ISOLATION PRECAUTIONS PICKER MODAL                                        */}
      {/* ========================================================================= */}
      <Modal
        visible={isolationPickerOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsolationPickerOpen(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={[styles.pickerModalContent, { maxWidth: 380 }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Isolation Precautions</Text>
              <Pressable onPress={() => setIsolationPickerOpen(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 380 }}>
              {ISOLATION_PRECAUTIONS.map((iso) => (
                <Pressable
                  key={iso.value}
                  style={[
                    styles.pickerOptionItem,
                    isolationType === iso.value && styles.pickerOptionItemActive,
                  ]}
                  onPress={() => {
                    setIsolationType(iso.value);
                    setIsolationPickerOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      isolationType === iso.value && styles.pickerOptionTextActive,
                    ]}
                  >
                    {iso.label}
                  </Text>
                  {isolationType === iso.value && (
                    <Ionicons name="checkmark" size={18} color="#DC2626" />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* DETAILS MODAL                                                             */}
      {/* ========================================================================= */}
      <Modal
        visible={Boolean(selectedInfection)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedInfection(null)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={[styles.pickerModalContent, { maxWidth: 440 }]}>
            <View style={styles.pickerModalHeader}>
              <View>
                <Text style={styles.pickerModalTitle}>Infection Record Details</Text>
                <Text style={styles.subReadingText}>
                  Identified: {selectedInfection?.date_identified || 'N/A'}
                </Text>
              </View>
              <Pressable onPress={() => setSelectedInfection(null)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            {selectedInfection && (
              <ScrollView style={{ padding: 16 }}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Infection Type:</Text>
                  <Text style={[styles.detailValue, { fontWeight: '700' }]}>
                    {selectedInfection.infection_type || '—'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Organism:</Text>
                  <Text style={[styles.detailValue, { color: '#DC2626', fontWeight: '700' }]}>
                    {selectedInfection.organism || '—'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Site:</Text>
                  <Text style={styles.detailValue}>{selectedInfection.site || '—'}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Risk Level:</Text>
                  <Text style={styles.detailValue}>
                    {selectedInfection.risk_level || selectedInfection.severity || '—'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Isolation Status:</Text>
                  <Text style={styles.detailValue}>
                    {selectedInfection.isolation_status || selectedInfection.isolation_precautions || selectedInfection.precaution_type || 'Standard'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <Text
                    style={[
                      styles.detailValue,
                      {
                        color:
                          (selectedInfection.status || 'active').toLowerCase() === 'active'
                            ? '#DC2626'
                            : '#15803D',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                      },
                    ]}
                  >
                    {selectedInfection.status || 'Active'}
                  </Text>
                </View>

                {selectedInfection.culture_results && selectedInfection.culture_results !== '—' && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.detailLabel}>Culture Information:</Text>
                    <Text style={[styles.detailValue, { marginTop: 4 }]}>
                      {selectedInfection.culture_results}
                    </Text>
                  </View>
                )}

                {selectedInfection.notes ? (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.detailLabel}>Additional Notes:</Text>
                    <Text style={[styles.detailValue, { marginTop: 4 }]}>
                      {selectedInfection.notes}
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  btnPrimary: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  btnSecondary: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  btnSecondaryText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.3,
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
    padding: 16,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
  },
  sectionHeaderRed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sectionHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeaderTitleWhite: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  countBadgeWhite: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeWhiteText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  tableHeaderRowBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    paddingVertical: 9,
    paddingHorizontal: 12,
    width: '100%',
  },
  tableColHeader: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    width: '100%',
  },
  rowNumberText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
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
  cellTextRed: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  cellTextSuccess: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  cellTextMuted: {
    fontSize: 12,
    color: '#64748B',
  },
  riskBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  riskBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  isolationBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  isolationBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
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
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  iconBtnSuccess: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
  },
  emptyStateSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
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
    maxWidth: 620,
    maxHeight: '94%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeaderRed: {
    backgroundColor: '#DC2626',
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
    fontWeight: '800',
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
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  btnCancelOutline: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  btnCancelOutlineText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 13,
  },
  btnSaveInfection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DC2626',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 6,
  },
  btnSaveInfectionText: {
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
    width: 130,
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
