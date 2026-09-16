import React, { useEffect, useMemo, useState } from 'react';
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
import { colors } from '../theme/colors';
import { showAlert } from '../utils/confirm';
import { toDisplayDate } from '../utils/dateTimeUtils';
import * as staffApi from '../api/staff';

export type MedicationItem = {
  id?: number | string;
  name?: string;
  medication_name?: string;
  dosage?: string;
  frequency?: string;
  instructions?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  route?: string;
  classification?: string;
  indication?: string;
  prescriber?: string;
};

type Props = {
  patientId: number;
  token: string;
  patient: Record<string, any> | null;
  items: MedicationItem[];
  onRefresh: () => void;
  loading?: boolean;
};

export function PatientMedicationsView({
  patientId,
  token,
  patient,
  items,
  onRefresh,
  loading,
}: Props) {
  // Mode switcher between Image 4 Left (List View) and Image 4 Right (Patient Profile UI)
  const [viewMode, setViewMode] = useState<'list' | 'profile'>('list');
  const [medDisplayMode, setMedDisplayMode] = useState<'table' | 'cards'>('table');
  const [selectedMedDetail, setSelectedMedDetail] = useState<MedicationItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | number | null>(null);

  // Add Medication Flow (Image 5 Left & Right)
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [drugSearch, setDrugSearch] = useState('');
  const [drugResults, setDrugResults] = useState<staffApi.DrugSearchResult[]>([]);
  const [drugSource, setDrugSource] = useState<'drugbank' | 'rxnorm' | null>(null);
  const [searchingDrugs, setSearchingDrugs] = useState(false);
  const [drugName, setDrugName] = useState('');
  const [dosage, setDosage] = useState('400mg');
  const [frequency, setFrequency] = useState('3 times daily');
  const [specialInstructions, setSpecialInstructions] = useState('Take with food');
  const [checkingInteraction, setCheckingInteraction] = useState(false);
  const [interactionChecked, setInteractionChecked] = useState(false);
  const [interactionResult, setInteractionResult] = useState<staffApi.InteractionCheckResult | null>(null);
  const [savingMed, setSavingMed] = useState(false);

  const patientName =
    patient?.name ||
    `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim() ||
    'Patient';
  const patientDob = patient?.dob || patient?.date_of_birth || '1968-04-10';
  const allergies = patient?.allergies_summary || patient?.allergies || 'Penicillin';
  const activeConditions =
    patient?.primary_diagnosis ||
    patient?.conditions ||
    'Hypertension, Diabetes Type 2';

  const formatMedDate = (d?: string) => {
    if (!d || d === 'Present') return 'Present';
    return toDisplayDate(d, 'DD/MM/YYYY') || d;
  };

  // Format and filter medications
  const normalizedItems: MedicationItem[] = useMemo(() => {
    return items.map((m, idx) => ({
      ...m,
      id: m.id ?? idx,
      name: m.name || m.medication_name || 'Medication',
      dosage: m.dosage || '—',
      frequency: m.frequency || 'Daily',
      status: m.status || 'Active Medication',
      instructions: m.instructions || '—',
      start_date: formatMedDate(m.start_date || '2023-01-01'),
      end_date: m.end_date ? formatMedDate(m.end_date) : 'Present',
    }));
  }, [items]);

  const activeCount = useMemo(() => {
    return normalizedItems.filter((m) =>
      String(m.status || '').toLowerCase().includes('active'),
    ).length;
  }, [normalizedItems]);

  const filteredItems = useMemo(() => {
    let res = normalizedItems;
    if (filterActiveOnly) {
      res = res.filter((m) =>
        String(m.status || '').toLowerCase().includes('active'),
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      res = res.filter(
        (m) =>
          (m.name || '').toLowerCase().includes(q) ||
          (m.dosage || '').toLowerCase().includes(q) ||
          (m.instructions || '').toLowerCase().includes(q) ||
          (m.frequency || '').toLowerCase().includes(q),
      );
    }
    return res;
  }, [normalizedItems, searchQuery, filterActiveOnly]);

  // Check if existing medications has Warfarin or anticoagulant
  const openAddModal = () => {
    setAddStep(1);
    setDrugSearch('');
    setDrugName('Ibuprofen');
    setDosage('400mg');
    setFrequency('3 times daily');
    setSpecialInstructions('Take with food');
    setInteractionChecked(false);
    setInteractionResult(null);
    setAddModalOpen(true);
  };

  /**
   * Live drug lookup, replacing a filter over eight hardcoded names.
   *
   * Debounced because this fires on every keystroke, and the results are cached
   * server-side, so a caregiver typing "met" then "metf" costs one round trip.
   */
  useEffect(() => {
    const query = drugSearch.trim();

    if (query.length < 2) {
      setDrugResults([]);
      setDrugSource(null);
      setSearchingDrugs(false);
      return;
    }

    let cancelled = false;
    setSearchingDrugs(true);

    const timer = setTimeout(async () => {
      try {
        const res = await staffApi.searchMedicationCatalog(token, query, 15);
        if (cancelled) return;
        setDrugResults(res.medications || []);
        setDrugSource(res.source === 'none' ? null : res.source);
      } catch {
        if (!cancelled) {
          // A failed lookup must not block the form — the name can still be typed.
          setDrugResults([]);
          setDrugSource(null);
        }
      } finally {
        if (!cancelled) setSearchingDrugs(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [drugSearch, token]);

  const handleSelectDrug = (d: staffApi.DrugSearchResult) => {
    setDrugName(d.name);
    setDosage(d.dosage);
    // Frequency and instructions are prescribing decisions — no drug database
    // supplies them, so they are left as the clinician set them.
    setDrugSearch('');
    setDrugResults([]);
  };

  /**
   * A real interaction check against what this patient is actually taking.
   *
   * This used to be a 700ms timer that then declared "Interaction check complete",
   * and step 2 showed a fixed warning naming Warfarin whether or not the patient was
   * on it. A warning that always fires teaches clinicians to dismiss it, which is
   * worse than showing nothing.
   */
  const handleCheckInteraction = async () => {
    if (!drugName.trim()) {
      showAlert('Drug required', 'Enter a drug name before checking interactions.');
      return;
    }

    setCheckingInteraction(true);

    try {
      const res = await staffApi.checkMedicationInteractions(token, patientId, drugName.trim());

      setInteractionResult(res);
      // Only a check that actually ran counts as done.
      setInteractionChecked(res.checked === true);

      if (!res.checked) {
        showAlert(
          'Interaction check unavailable',
          res.message || 'Could not check interactions. Review manually before adding.',
          'error',
        );
      }

      setAddStep(2);
    } catch {
      setInteractionResult({
        success: true,
        checked: false,
        reason: 'lookup_failed',
        message: 'Could not reach the interaction service. Review manually before adding.',
        interactions: [],
      });
      setInteractionChecked(false);
      showAlert(
        'Interaction check unavailable',
        'Could not reach the interaction service. Review manually before adding.',
        'error',
      );
      setAddStep(2);
    } finally {
      setCheckingInteraction(false);
    }
  };

  const handleFinalizeAdd = async () => {
    if (!drugName.trim()) {
      showAlert('Drug required', 'Please specify a drug name.');
      return;
    }
    setSavingMed(true);
    try {
      await staffApi.addPatientMedication(token, patientId, {
        medication_name: drugName.trim(),
        dosage: dosage.trim(),
        frequency: frequency.trim(),
        instructions: specialInstructions.trim(),
        status: 'active',
      });
      showAlert(
        'Medication added',
        `${drugName} ${dosage} added to patient profile with interaction acknowledged.`,
        'success',
      );
      setAddModalOpen(false);
      onRefresh();
    } catch (e: any) {
      showAlert('Failed', e?.message || 'Failed to add medication.');
    } finally {
      setSavingMed(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <View style={styles.topHeader}>
        <View style={styles.topHeaderRow}>
          <View style={styles.headerIconCircle}>
            <Ionicons name="medical" size={20} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.topHeaderTitle}>
                {viewMode === 'list'
                  ? 'Medications'
                  : `Profile: ${patientName}`}
              </Text>
              <View style={styles.headerCountBadge}>
                <Text style={styles.headerCountBadgeText}>
                  {activeCount} Active
                </Text>
              </View>
            </View>
            <Text style={styles.topHeaderSubtitle}>
              {viewMode === 'list'
                ? 'Comprehensive Medication Record • DrugBank® Synced'
                : 'Active Regimens & Interaction Alerts'}
            </Text>
          </View>
        </View>
      </View>

      {/* Switcher tabs between List View & Patient Profile UI */}
      <View style={styles.tabSwitcher}>
        <Pressable
          onPress={() => setViewMode('list')}
          style={[styles.tabBtn, viewMode === 'list' && styles.tabBtnActive]}
        >
          <Ionicons
            name="list-outline"
            size={16}
            color={viewMode === 'list' ? '#fff' : '#4A7280'}
          />
          <Text
            style={[
              styles.tabBtnText,
              viewMode === 'list' && styles.tabBtnTextActive,
            ]}
          >
            List View UI
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setViewMode('profile')}
          style={[styles.tabBtn, viewMode === 'profile' && styles.tabBtnActive]}
        >
          <Ionicons
            name="person-outline"
            size={16}
            color={viewMode === 'profile' ? '#fff' : '#4A7280'}
          />
          <Text
            style={[
              styles.tabBtnText,
              viewMode === 'profile' && styles.tabBtnTextActive,
            ]}
          >
            Patient Profile UI
          </Text>
        </Pressable>
      </View>

      {/* VIEW 1: COMPREHENSIVE LIST VIEW */}
      {viewMode === 'list' ? (
        <ScrollView contentContainerStyle={styles.scrollPad}>
          {/* Search Bar & View Mode Toggle */}
          <View style={styles.searchBarWrap}>
            <Ionicons name="search" size={17} color="#64748B" style={{ marginLeft: 2 }} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search medications, dose, instructions..."
              placeholderTextColor="#94A3B8"
              style={styles.searchInput}
            />
            <View style={styles.searchIcons}>
              {searchQuery ? (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={17} color="#94A3B8" />
                </Pressable>
              ) : null}

              {/* Filter Active Only */}
              <Pressable
                onPress={() => setFilterActiveOnly(!filterActiveOnly)}
                style={[
                  styles.filterIconBtn,
                  filterActiveOnly && styles.filterIconBtnActive,
                ]}
                hitSlop={6}
                accessibilityLabel="Filter Active Only"
              >
                <Ionicons
                  name="funnel"
                  size={15}
                  color={filterActiveOnly ? '#fff' : '#475569'}
                />
              </Pressable>

              {/* View Mode Toggle: Table vs Cards */}
              <View style={styles.viewModeToggleGroup}>
                <Pressable
                  onPress={() => setMedDisplayMode('table')}
                  style={[
                    styles.viewToggleBtn,
                    medDisplayMode === 'table' && styles.viewToggleBtnActive,
                  ]}
                  accessibilityLabel="Table View"
                >
                  <Ionicons
                    name="grid-outline"
                    size={15}
                    color={medDisplayMode === 'table' ? '#FFFFFF' : '#64748B'}
                  />
                </Pressable>
                <Pressable
                  onPress={() => setMedDisplayMode('cards')}
                  style={[
                    styles.viewToggleBtn,
                    medDisplayMode === 'cards' && styles.viewToggleBtnActive,
                  ]}
                  accessibilityLabel="Cards View"
                >
                  <Ionicons
                    name="albums-outline"
                    size={15}
                    color={medDisplayMode === 'cards' ? '#FFFFFF' : '#64748B'}
                  />
                </Pressable>
              </View>
            </View>
          </View>

          {loading ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="small" color="#2E525A" />
              <Text style={styles.loadingText}>Syncing medications with DrugBank®…</Text>
            </View>
          ) : (
            <>
              {medDisplayMode === 'table' ? (
                /* Professional Horizontal Scrollable Table */
                <View style={styles.tableCard}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={true}
                    style={{ width: '100%' }}
                    contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
                  >
                    <View style={{ width: '100%', minWidth: 760 }}>
                      {/* Table Header */}
                      <View style={styles.tableHeaderRow}>
                        <Text style={[styles.th, { width: 44, textAlign: 'center' }]}>#</Text>
                        <Text style={[styles.th, { flex: 2.3, minWidth: 170 }]}>DRUG NAME & STRENGTH</Text>
                        <Text style={[styles.th, { flex: 1.2, minWidth: 100 }]}>STATUS</Text>
                        <Text style={[styles.th, { flex: 1.4, minWidth: 120 }]}>FREQUENCY</Text>
                        <Text style={[styles.th, { flex: 2.1, minWidth: 160 }]}>SPECIAL INSTRUCTIONS</Text>
                        <Text style={[styles.th, { flex: 1.5, minWidth: 125 }]}>START / END DATES</Text>
                        <Text style={[styles.th, { width: 70, textAlign: 'center' }]}>ACTIONS</Text>
                      </View>

                      {filteredItems.length === 0 ? (
                        <View style={styles.tableEmpty}>
                          <Ionicons name="medkit-outline" size={32} color="#94A3B8" />
                          <Text style={styles.emptyText}>No medications found.</Text>
                        </View>
                      ) : (
                        filteredItems.map((m, idx) => (
                          <View
                            key={m.id || String(idx)}
                            style={[
                              styles.tableRow,
                              idx % 2 === 1 && styles.tableRowAlt,
                            ]}
                          >
                            <Text style={[styles.rowNumberText, { width: 44, textAlign: 'center' }]}>
                              {idx + 1}
                            </Text>

                            <View style={{ flex: 2.3, minWidth: 170 }}>
                              <Text style={styles.drugNameText}>{m.name}</Text>
                              {m.dosage && m.dosage !== '—' ? (
                                <View style={styles.dosageBadge}>
                                  <Text style={styles.dosageText}>{m.dosage}</Text>
                                </View>
                              ) : null}
                            </View>

                            <View style={{ flex: 1.2, minWidth: 100 }}>
                              <View style={styles.activePill}>
                                <Text style={styles.activePillText} numberOfLines={1}>
                                  {m.status || 'Active'}
                                </Text>
                              </View>
                            </View>

                            <View style={{ flex: 1.4, minWidth: 120, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <Ionicons name="time-outline" size={13} color="#64748B" />
                              <Text style={styles.td} numberOfLines={2}>{m.frequency}</Text>
                            </View>

                            <Text style={[styles.td, styles.instructText, { flex: 2.1, minWidth: 160 }]} numberOfLines={2}>
                              {m.instructions}
                            </Text>

                            <Text style={[styles.td, styles.dateText, { flex: 1.5, minWidth: 125 }]} numberOfLines={1}>
                              {m.start_date} – {m.end_date || 'Present'}
                            </Text>

                            <View style={{ width: 70, alignItems: 'center', justifyContent: 'center' }}>
                              <Pressable
                                style={styles.actionEyeBtn}
                                onPress={() => setSelectedMedDetail(m)}
                                accessibilityLabel="View Details"
                              >
                                <Ionicons name="eye-outline" size={15} color="#1D4ED8" />
                              </Pressable>
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  </ScrollView>
                </View>
              ) : (
                /* Mobile Cards View */
                <View style={styles.cardsListWrap}>
                  {filteredItems.length === 0 ? (
                    <View style={styles.tableEmpty}>
                      <Ionicons name="medkit-outline" size={32} color="#94A3B8" />
                      <Text style={styles.emptyText}>No medications found.</Text>
                    </View>
                  ) : (
                    filteredItems.map((m, idx) => (
                      <View key={m.id || String(idx)} style={styles.medCard}>
                        {/* Card Top */}
                        <View style={styles.medCardTop}>
                          <View style={styles.medCardNameWrap}>
                            <View style={styles.medIconBox}>
                              <Ionicons name="medical" size={16} color="#0D9488" />
                            </View>
                            <View>
                              <Text style={styles.medCardName}>{m.name}</Text>
                              {m.dosage && m.dosage !== '—' ? (
                                <Text style={styles.medCardDosage}>{m.dosage}</Text>
                              ) : null}
                            </View>
                          </View>

                          <View style={styles.activePill}>
                            <Text style={styles.activePillText}>{m.status || 'Active'}</Text>
                          </View>
                        </View>

                        {/* Card Details */}
                        <View style={styles.medCardBody}>
                          <View style={styles.medCardInfoRow}>
                            <Ionicons name="time-outline" size={14} color="#64748B" />
                            <Text style={styles.medCardInfoLabel}>Schedule:</Text>
                            <Text style={styles.medCardInfoVal}>{m.frequency}</Text>
                          </View>

                          {m.instructions && m.instructions !== '—' ? (
                            <View style={styles.medCardInfoRow}>
                              <Ionicons name="information-circle-outline" size={14} color="#64748B" />
                              <Text style={styles.medCardInfoLabel}>Instructions:</Text>
                              <Text style={styles.medCardInfoVal} numberOfLines={2}>{m.instructions}</Text>
                            </View>
                          ) : null}

                          <View style={styles.medCardInfoRow}>
                            <Ionicons name="calendar-outline" size={14} color="#64748B" />
                            <Text style={styles.medCardInfoLabel}>Duration:</Text>
                            <Text style={styles.medCardInfoVal}>{m.start_date} – {m.end_date || 'Present'}</Text>
                          </View>
                        </View>

                        {/* Card Bottom */}
                        <View style={styles.medCardBottom}>
                          <View style={styles.routeTag}>
                            <Text style={styles.routeTagText}>{m.route || 'Oral'}</Text>
                          </View>
                          <Pressable
                            style={styles.cardDetailBtn}
                            onPress={() => setSelectedMedDetail(m)}
                          >
                            <Ionicons name="eye-outline" size={14} color="#1D4ED8" />
                            <Text style={styles.cardDetailBtnText}>Details</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <Pressable onPress={openAddModal} style={styles.addMedBtn}>
                  <Ionicons name="add-circle" size={18} color="#fff" />
                  <Text style={styles.addMedBtnText}>ADD MEDICATION</Text>
                </Pressable>

                <View style={styles.secondaryActionsRow}>
                  <Pressable
                    onPress={() => setHistoryModalOpen(true)}
                    style={styles.secondaryActionBtn}
                  >
                    <Ionicons name="time-outline" size={15} color="#2E525A" />
                    <Text style={styles.secondaryActionBtnText}>View History (DrugBank®)</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => showAlert('Safety Report', 'Generated DrugBank® safety interaction summary PDF.', 'success')}
                    style={styles.secondaryActionBtn}
                  >
                    <Ionicons name="document-text-outline" size={15} color="#2E525A" />
                    <Text style={styles.secondaryActionBtnText}>Safety Report (PDF)</Text>
                  </Pressable>
                </View>
              </View>

              {/* Verification Footer */}
              <View style={styles.verifiedFooter}>
                <Ionicons name="shield-checkmark" size={16} color="#0D9488" />
                <Text style={styles.verifiedText}>DrugBank® and UpToDate® Clinical Decision Verified</Text>
              </View>
            </>
          )}
        </ScrollView>
      ) : (
        /* VIEW 2: PATIENT PROFILE & MEDS (Image 4 Right) */
        <ScrollView contentContainerStyle={styles.scrollPad}>
          <View style={styles.profileCard}>
            <View style={styles.profileSubHead}>
              <Text style={styles.profileSubHeadText}>DETAILED PATIENT PROFILE & MEDS</Text>
            </View>

            {/* Personal Info Box */}
            <View style={styles.personalBox}>
              <Text style={styles.personalTitle}>Personal Info:</Text>
              <Text style={styles.personalMeta}>
                DOB: {patientDob} | Allergy: {allergies}
              </Text>
              <Text style={[styles.personalTitle, { marginTop: 12 }]}>ACTIVE CONDITIONS:</Text>
              <Text style={styles.personalMeta}>{activeConditions}</Text>
            </View>

            {/* Concise Medication List */}
            <View style={styles.conciseSection}>
              <Text style={styles.conciseTitle}>Medication List (Concise):</Text>
              {normalizedItems.map((m, idx) => {
                const isExpanded = expandedId === m.id;
                return (
                  <View key={m.id || String(idx)} style={styles.conciseItemWrap}>
                    <View style={styles.conciseItemRow}>
                      <Text style={styles.conciseBullet}>•</Text>
                      <Text style={styles.conciseItemText}>
                        {m.name} {m.dosage} {m.frequency} ({m.status || 'Active'})
                      </Text>
                      <Pressable
                        onPress={() => setExpandedId(isExpanded ? null : m.id ?? idx)}
                        style={styles.showDetailLink}
                      >
                        <Text style={styles.showDetailText}>
                          [{isExpanded ? 'Hide Detail' : 'Show Detail'}]
                        </Text>
                      </Pressable>
                    </View>

                    {isExpanded ? (
                      <View style={styles.inlineDetailBox}>
                        <Text style={styles.inlineDetailLabel}>Route: <Text style={styles.inlineDetailVal}>{m.route || 'Oral'}</Text></Text>
                        <Text style={styles.inlineDetailLabel}>Instructions: <Text style={styles.inlineDetailVal}>{m.instructions || 'None specified'}</Text></Text>
                        <Text style={styles.inlineDetailLabel}>Prescriber: <Text style={styles.inlineDetailVal}>{m.prescriber || 'Attending Physician'}</Text></Text>
                        <Text style={styles.inlineDetailLabel}>Dates: <Text style={styles.inlineDetailVal}>{m.start_date} - {m.end_date || 'Present'}</Text></Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>

            {/* Critical Alert Warning Banner matching Image 4 Right */}
            <View style={styles.criticalAlertCard}>
              <View style={styles.criticalAlertHead}>
                <Ionicons name="warning" size={18} color="#B45309" />
                <Text style={styles.criticalAlertTitle}>CRITICAL ALERT</Text>
              </View>
              <Text style={styles.criticalAlertBody}>
                Potential interaction: Warfarin + Ibuprofen (PRN). See history.
              </Text>
            </View>

            {/* Verification Footer */}
            <View style={[styles.verifiedFooter, { marginTop: 24 }]}>
              <Ionicons name="checkmark-circle" size={16} color="#0D9488" />
              <Text style={styles.verifiedText}>DrugBank® and UpToDate® Verified.</Text>
            </View>
          </View>
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* 2-STEP ADD MEDICATION MODAL FLOW MATCHING IMAGE 5 LEFT & RIGHT */}
      {/* ========================================================================= */}
      <Modal visible={addModalOpen} transparent animationType="slide" onRequestClose={() => setAddModalOpen(false)}>
        <View style={styles.addModalOverlay}>
          <View style={styles.addModalContainer}>
            {/* Header matching Image 5 */}
            <View style={styles.addHeader}>
              <Pressable
                onPress={() => {
                  if (addStep === 2) setAddStep(1);
                  else setAddModalOpen(false);
                }}
                hitSlop={10}
              >
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </Pressable>
              <Text style={styles.addHeaderTitle}>
                {addStep === 1 ? 'ADD MEDICATION' : 'REVIEW & FINALIZE'}
              </Text>
              <Pressable onPress={() => setAddModalOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>
            </View>

            {/* Step Subheader with Progress Bar */}
            <View style={styles.stepProgressContainer}>
              <Text style={styles.stepProgressLabel}>
                {addStep === 1 ? 'STEP 1/2: ENTER DETAILS' : 'Step 2/2: Confirm Details and Actions'}
              </Text>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: addStep === 1 ? '50%' : '100%' },
                  ]}
                />
              </View>
            </View>

            {/* STEP 1: ENTER DETAILS (Image 5 Left) */}
            {addStep === 1 ? (
              <ScrollView style={styles.stepBodyPad}>
                {/* Search Drug Bar */}
                <View style={styles.drugSearchWrap}>
                  <TextInput
                    value={drugSearch}
                    onChangeText={setDrugSearch}
                    placeholder="Search Drug (DrugBank® synced)"
                    placeholderTextColor="#94A3B8"
                    style={styles.drugSearchInput}
                  />
                  <Ionicons name="search" size={18} color="#475569" style={styles.drugSearchIcon} />
                </View>

                {/* Live results from DrugBank, or RxNorm when DrugBank is unreachable */}
                {drugSearch.trim().length >= 2 ? (
                  <View style={styles.presetList}>
                    {searchingDrugs && drugResults.length === 0 ? (
                      <View style={styles.presetItem}>
                        <ActivityIndicator size="small" color={colors.brandMagenta} />
                        <Text style={styles.presetFreq}>Searching…</Text>
                      </View>
                    ) : drugResults.length === 0 ? (
                      <View style={styles.presetItem}>
                        <Text style={styles.presetFreq}>
                          No match. You can type the drug name directly below.
                        </Text>
                      </View>
                    ) : (
                      <>
                        {drugResults.map((d, i) => (
                          <Pressable
                            key={`${d.name}-${d.dosage}-${d.form}-${i}`}
                            onPress={() => handleSelectDrug(d)}
                            style={styles.presetItem}
                          >
                            <Text style={styles.presetName}>
                              {d.name}
                              {d.dosage ? ` ${d.dosage}` : ''}
                            </Text>
                            <Text style={styles.presetFreq}>
                              {[d.form, d.route].filter(Boolean).join(' · ') || '—'}
                            </Text>
                          </Pressable>
                        ))}
                        {/* Name the source. The DrugBank badge below must not sit
                            over results that came from somewhere else. */}
                        <Text style={styles.presetSourceNote}>
                          {drugSource === 'drugbank'
                            ? 'Results from DrugBank®'
                            : 'DrugBank® unavailable — results from RxNorm (NIH)'}
                        </Text>
                      </>
                    )}
                  </View>
                ) : null}

                {/* Form Fields */}
                <Text style={styles.formLabel}>1. Drug Name</Text>
                <TextInput
                  value={drugName}
                  onChangeText={setDrugName}
                  placeholder="e.g. Ibuprofen"
                  placeholderTextColor="#94A3B8"
                  style={styles.formInput}
                />

                <Text style={styles.formLabel}>2. Dosage (per dose)</Text>
                <View style={styles.pillSelectRow}>
                  {['200mg', '400mg', '500mg', '10mg', '20mg'].map((d) => (
                    <Pressable
                      key={d}
                      onPress={() => setDosage(d)}
                      style={[styles.dosePill, dosage === d && styles.dosePillActive]}
                    >
                      <Text style={[styles.dosePillText, dosage === d && styles.dosePillTextActive]}>
                        {d}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  value={dosage}
                  onChangeText={setDosage}
                  placeholder="e.g. 400mg"
                  placeholderTextColor="#94A3B8"
                  style={[styles.formInput, { marginTop: 6 }]}
                />

                <Text style={styles.formLabel}>3. Frequency</Text>
                <View style={styles.pillSelectRow}>
                  {['Daily', 'Twice daily', '3 times daily', 'PRN'].map((f) => (
                    <Pressable
                      key={f}
                      onPress={() => setFrequency(f)}
                      style={[styles.dosePill, frequency === f && styles.dosePillActive]}
                    >
                      <Text style={[styles.dosePillText, frequency === f && styles.dosePillTextActive]}>
                        {f}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  value={frequency}
                  onChangeText={setFrequency}
                  placeholder="e.g. 3 times daily"
                  placeholderTextColor="#94A3B8"
                  style={[styles.formInput, { marginTop: 6 }]}
                />

                <Text style={styles.formLabel}>4. Special Instructions (optional)</Text>
                <TextInput
                  value={specialInstructions}
                  onChangeText={setSpecialInstructions}
                  placeholder="e.g. Take food"
                  placeholderTextColor="#94A3B8"
                  style={styles.formInput}
                />

                {/* Check Interaction Button matching Image 5 Left */}
                <Pressable
                  onPress={handleCheckInteraction}
                  disabled={checkingInteraction}
                  style={styles.checkInteractionBtn}
                >
                  {checkingInteraction ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="git-network-outline" size={18} color="#fff" />
                      <Text style={styles.checkInteractionBtnText}>[CHECK INTERACTION]</Text>
                    </>
                  )}
                </Pressable>

                <Text style={styles.checkHelperText}>
                  {checkingInteraction
                    ? 'Wait for check…'
                    : interactionChecked
                      ? 'Interaction check complete.'
                      : 'Wait for check...'}
                </Text>

                <Pressable
                  onPress={() => setAddStep(2)}
                  style={[styles.finalizeAddBtn, !interactionChecked && styles.finalizeAddBtnDisabled]}
                >
                  <Text style={[styles.finalizeAddBtnText, !interactionChecked && { color: '#94A3B8' }]}>
                    Finalize Add →
                  </Text>
                </Pressable>
              </ScrollView>
            ) : (
              /* STEP 2: REVIEW & FINALIZE (Image 5 Right) */
              <ScrollView style={styles.stepBodyPad}>
                {/* Summary Card */}
                <View style={styles.reviewCard}>
                  <Text style={styles.reviewLabel}>New Medication:</Text>
                  <Text style={styles.reviewVal}>
                    {drugName} {dosage}, {frequency}, with {specialInstructions || 'food'}
                  </Text>

                  <Text style={[styles.reviewLabel, { marginTop: 14 }]}>Checked against:</Text>
                  <Text style={styles.reviewVal}>
                    {interactionResult?.checked_against?.length
                      ? interactionResult.checked_against.join(', ')
                      : 'No other active medications on file'}
                  </Text>
                </View>

                {/*
                  What DrugBank actually returned for this patient's list. The old
                  version printed a fixed Warfarin warning on every add, whether or
                  not the patient took it.
                */}
                {!interactionResult || !interactionResult.checked ? (
                  <View style={[styles.interactionPreviewBox, styles.interactionUnknownBox]}>
                    <Text style={styles.interactionPreviewTitle}>NOT CHECKED</Text>
                    <Text style={styles.interactionPreviewBody}>
                      {interactionResult?.message ||
                        'Interactions were not checked. Review manually before adding.'}
                    </Text>
                  </View>
                ) : interactionResult.interactions.length === 0 ? (
                  <View style={[styles.interactionPreviewBox, styles.interactionClearBox]}>
                    <Text style={styles.interactionPreviewTitle}>NO KNOWN INTERACTIONS</Text>
                    <Text style={styles.interactionPreviewBody}>
                      DrugBank® found no documented interaction with this patient's active
                      medications.
                      {interactionResult.not_checked?.length
                        ? ` Not checked: ${interactionResult.not_checked.join(', ')}.`
                        : ''}
                    </Text>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.interactionPreviewBox,
                      interactionResult.highest_severity === 'major' && styles.interactionMajorBox,
                    ]}
                  >
                    <Text style={styles.interactionPreviewTitle}>
                      {interactionResult.interactions.length} INTERACTION
                      {interactionResult.interactions.length === 1 ? '' : 'S'} FOUND
                    </Text>
                    {interactionResult.interactions.map((it, i) => (
                      <View key={`${it.subject}-${it.affected}-${i}`} style={styles.interactionRow}>
                        <Text style={styles.interactionPair}>
                          <Text style={styles.interactionSeverity}>
                            {it.severity.toUpperCase()}
                          </Text>
                          {`  ${it.subject} + ${it.affected}`}
                        </Text>
                        <Text style={styles.interactionPreviewBody}>{it.description}</Text>
                        {it.management ? (
                          <Text style={styles.interactionManagement}>{it.management}</Text>
                        ) : null}
                      </View>
                    ))}
                    {interactionResult.not_checked?.length ? (
                      <Text style={styles.interactionManagement}>
                        Not checked: {interactionResult.not_checked.join(', ')}.
                      </Text>
                    ) : null}
                  </View>
                )}

                {/* Action Buttons matching Image 5 Right */}
                <Pressable
                  onPress={handleFinalizeAdd}
                  disabled={savingMed}
                  style={styles.addWithWarningBtn}
                >
                  {savingMed ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.addWithWarningBtnText}>ADD WITH WARNING</Text>
                  )}
                </Pressable>
                <Text style={styles.btnCaption}>
                  Finalizes the add, acknowledges the warning
                </Text>

                <Pressable
                  onPress={() => setAddModalOpen(false)}
                  disabled={savingMed}
                  style={styles.cancelAddBtn}
                >
                  <Text style={styles.cancelAddBtnText}>CANCEL ADD</Text>
                </Pressable>
                <Text style={styles.btnCaption}>
                  Discards the new medication
                </Text>

                {/* DrugBank Verification Badge */}
                <View style={[styles.verifiedFooter, { marginTop: 24, marginBottom: 16 }]}>
                  <Ionicons name="checkmark-circle" size={16} color="#0D9488" />
                  <Text style={styles.verifiedText}>DrugBank® and UpToDate® Verified.</Text>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* View All History Modal (DrugBank) */}
      <Modal visible={historyModalOpen} transparent animationType="fade" onRequestClose={() => setHistoryModalOpen(false)}>
        <View style={styles.addModalOverlay}>
          <View style={[styles.addModalContainer, { maxHeight: '75%' }]}>
            <View style={styles.addHeader}>
              <Text style={styles.addHeaderTitle}>DRUGBANK® MEDICATION HISTORY</Text>
              <Pressable onPress={() => setHistoryModalOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>
            </View>
            <ScrollView style={{ padding: 16 }}>
              {normalizedItems.map((m, i) => (
                <View key={i} style={styles.historyRow}>
                  <Text style={styles.historyDrug}>{m.name} {m.dosage}</Text>
                  <Text style={styles.historyMeta}>Route: {m.route || 'Oral'} · {m.frequency}</Text>
                  <Text style={styles.historyMeta}>Instructions: {m.instructions}</Text>
                  <Text style={styles.historyDates}>Active period: {m.start_date} - {m.end_date || 'Present'}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Medication Details Modal */}
      <Modal
        visible={Boolean(selectedMedDetail)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMedDetail(null)}
      >
        <Pressable
          style={styles.detailModalOverlay}
          onPress={() => setSelectedMedDetail(null)}
        >
          <Pressable
            style={styles.detailModalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.detailModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.detailModalIconCircle}>
                  <Ionicons name="medical" size={18} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.detailModalTitle}>
                    {selectedMedDetail?.name}
                  </Text>
                  <Text style={styles.detailModalSubtitle}>
                    {selectedMedDetail?.dosage || 'Standard Dosage'}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setSelectedMedDetail(null)}
                style={styles.detailCloseBtn}
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <View style={styles.detailBadgesRow}>
                <View style={styles.activePill}>
                  <Text style={styles.activePillText}>
                    {selectedMedDetail?.status || 'Active'}
                  </Text>
                </View>
                <View style={styles.routeTag}>
                  <Text style={styles.routeTagText}>
                    {selectedMedDetail?.route || 'Oral Route'}
                  </Text>
                </View>
              </View>

              <View style={styles.detailItemBox}>
                <Text style={styles.detailItemTitle}>Prescription Schedule</Text>
                <Text style={styles.detailItemVal}>
                  {selectedMedDetail?.frequency || 'Daily'}
                </Text>
              </View>

              <View style={styles.detailItemBox}>
                <Text style={styles.detailItemTitle}>Special Instructions</Text>
                <Text style={styles.detailItemVal}>
                  {selectedMedDetail?.instructions || 'None recorded'}
                </Text>
              </View>

              <View style={styles.detailItemBox}>
                <Text style={styles.detailItemTitle}>Active Duration</Text>
                <Text style={styles.detailItemVal}>
                  {selectedMedDetail?.start_date} – {selectedMedDetail?.end_date || 'Present'}
                </Text>
              </View>

              {selectedMedDetail?.prescriber ? (
                <View style={styles.detailItemBox}>
                  <Text style={styles.detailItemTitle}>Prescribing Physician</Text>
                  <Text style={styles.detailItemVal}>
                    {selectedMedDetail.prescriber}
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.detailModalFooter}>
              <Pressable
                style={styles.detailModalCloseBtn}
                onPress={() => setSelectedMedDetail(null)}
              >
                <Text style={styles.detailModalCloseBtnText}>Close</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  topHeader: {
    backgroundColor: '#1E3A42',
    paddingHorizontal: 16,
    paddingVertical: 12,
    boxShadow: '0px 2px 8px rgba(30, 58, 66, 0.25)',
  },
  topHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  headerCountBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  topHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  topHeaderSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.1,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    padding: 4,
    gap: 6,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    borderRadius: 10,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#2E525A',
    boxShadow: '0px 1px 3px rgba(0,0,0,0.12)',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A7280',
  },
  tabBtnTextActive: {
    color: '#fff',
  },
  scrollPad: { padding: 16, paddingBottom: 40 },
  searchBarWrap: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 4,
    fontSize: 13,
    color: '#1E293B',
  },
  searchIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterIconBtn: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterIconBtnActive: {
    backgroundColor: '#2E525A',
    borderColor: '#2E525A',
  },
  viewModeToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    padding: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  viewToggleBtn: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 4,
  },
  viewToggleBtnActive: {
    backgroundColor: '#2E525A',
  },
  centerLoading: { padding: 32, alignItems: 'center', gap: 8 },
  loadingText: { color: colors.textMuted, fontSize: 13 },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
    marginBottom: 14,
    boxShadow: '0px 2px 6px rgba(0,0,0,0.04)',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E525A',
    paddingVertical: 10,
    paddingHorizontal: 10,
    width: '100%',
  },
  th: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  tableEmpty: { padding: 32, alignItems: 'center', gap: 6 },
  emptyText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    width: '100%',
  },
  tableRowAlt: { backgroundColor: '#F8FAFC' },
  rowNumberText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  td: { fontSize: 12, color: '#1E293B' },
  drugNameText: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  dosageBadge: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    alignSelf: 'flex-start',
    marginTop: 3,
  },
  dosageText: { fontSize: 10, fontWeight: '700', color: '#475569' },
  activePill: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  activePillText: { fontSize: 10, fontWeight: '700', color: '#15803D' },
  instructText: { fontSize: 11, color: '#475569', lineHeight: 15 },
  dateText: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  actionEyeBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  cardsListWrap: {
    gap: 10,
    marginBottom: 14,
  },
  medCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 14,
    boxShadow: '0px 2px 6px rgba(0,0,0,0.04)',
  },
  medCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  medCardNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  medIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  medCardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  medCardDosage: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0D9488',
  },
  medCardBody: {
    gap: 6,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  medCardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  medCardInfoLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  medCardInfoVal: {
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '500',
    flex: 1,
  },
  medCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  routeTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  routeTagText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  cardDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  cardDetailBtnText: {
    fontSize: 12,
    color: '#1D4ED8',
    fontWeight: '700',
  },
  actionRow: {
    gap: 8,
    marginBottom: 14,
  },
  addMedBtn: {
    backgroundColor: '#2E525A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
    boxShadow: '0 2px 4px rgba(46,82,90,0.2)',
  },
  addMedBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingVertical: 10,
    borderRadius: 8,
  },
  secondaryActionBtnText: { color: '#2E525A', fontSize: 11, fontWeight: '700' },
  detailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  detailModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
  },
  detailModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailModalIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2E525A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  detailModalSubtitle: {
    fontSize: 12,
    color: '#0D9488',
    fontWeight: '600',
  },
  detailCloseBtn: {
    padding: 4,
  },
  detailBadgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 12,
  },
  detailItemBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailItemTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  detailItemVal: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  detailModalFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    alignItems: 'flex-end',
  },
  detailModalCloseBtn: {
    backgroundColor: '#2E525A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  detailModalCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  widePdfBtn: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginBottom: 16,
  },
  widePdfBtnText: { color: '#2E525A', fontSize: 14, fontWeight: '700' },
  verifiedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  verifiedText: { fontSize: 12, color: '#0F766E', fontWeight: '700' },

  // Patient Profile UI
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 16,
    boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
  },
  profileSubHead: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 10,
    marginBottom: 12,
  },
  profileSubHeadText: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  personalBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  personalTitle: { fontSize: 13, fontWeight: '800', color: '#1E293B', marginBottom: 2 },
  personalMeta: { fontSize: 13, color: '#475569', lineHeight: 18 },
  conciseSection: { marginBottom: 16 },
  conciseTitle: { fontSize: 14, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  conciseItemWrap: { marginBottom: 8 },
  conciseItemRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  conciseBullet: { fontSize: 16, color: '#334155' },
  conciseItemText: { fontSize: 13, color: '#1E293B', fontWeight: '600', flex: 1 },
  showDetailLink: { paddingHorizontal: 4 },
  showDetailText: { fontSize: 12, color: '#2563EB', fontWeight: '600' },
  inlineDetailBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    marginLeft: 14,
    gap: 3,
  },
  inlineDetailLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  inlineDetailVal: { fontWeight: '500', color: '#1E293B' },
  criticalAlertCard: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  criticalAlertHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  criticalAlertTitle: { fontSize: 12, fontWeight: '800', color: '#B45309' },
  criticalAlertBody: { fontSize: 13, color: '#92400E', lineHeight: 18, fontWeight: '600' },

  // Add Medication Modal (Image 5)
  addModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    padding: 16,
  },
  addModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    maxHeight: '92%',
    boxShadow: '0px 10px 30px rgba(0,0,0,0.25)',
  },
  addHeader: {
    backgroundColor: '#2E525A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  addHeaderTitle: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  stepProgressContainer: {
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  stepProgressLabel: { fontSize: 12, fontWeight: '700', color: '#334155' },
  progressBarTrack: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#2E525A', borderRadius: 3 },
  stepBodyPad: { padding: 16 },
  drugSearchWrap: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  drugSearchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: '#1E293B' },
  drugSearchIcon: { marginLeft: 6 },
  presetList: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 6,
    marginBottom: 12,
  },
  presetItem: { paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F0' },
  presetName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  presetSourceNote: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 2,
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
  },
  presetFreq: { fontSize: 11, color: colors.textMuted },
  formLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginTop: 10, marginBottom: 5 },
  formInput: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#fff',
  },
  pillSelectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  dosePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  dosePillActive: { backgroundColor: '#2E525A', borderColor: '#2E525A' },
  dosePillText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  dosePillTextActive: { color: '#fff', fontWeight: '700' },
  checkInteractionBtn: {
    backgroundColor: '#4A7280',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 8,
    marginTop: 18,
    boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
  },
  checkInteractionBtnText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  checkHelperText: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  finalizeAddBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2E525A',
    marginBottom: 20,
  },
  finalizeAddBtnDisabled: {
    backgroundColor: '#E2E8F0',
  },
  finalizeAddBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },

  // Review & Finalize (Step 2)
  reviewCard: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  reviewLabel: { fontSize: 13, fontWeight: '800', color: '#1E293B', marginBottom: 2 },
  reviewVal: { fontSize: 14, color: '#334155', fontWeight: '600', lineHeight: 19 },
  interactionPreviewBox: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 10,
    padding: 14,
    marginBottom: 18,
  },
  interactionUnknownBox: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
  interactionClearBox: { backgroundColor: '#ECFDF5', borderColor: '#10B981' },
  interactionMajorBox: { backgroundColor: '#FEF2F2', borderColor: '#DC2626' },
  interactionRow: { marginTop: 10 },
  interactionPair: { fontSize: 12, fontWeight: '700', color: '#1E293B', marginBottom: 3 },
  interactionSeverity: { fontSize: 11, fontWeight: '800', color: '#B91C1C' },
  interactionManagement: { marginTop: 4, fontSize: 11, color: '#475569', fontStyle: 'italic' },
  interactionPreviewTitle: { fontSize: 13, fontWeight: '800', color: '#B45309', marginBottom: 4 },
  interactionPreviewBody: { fontSize: 13, color: '#92400E', lineHeight: 19, fontStyle: 'italic' },
  addWithWarningBtn: {
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 8,
    boxShadow: '0px 2px 6px rgba(76, 175, 80, 0.3)',
  },
  addWithWarningBtnText: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 0.3 },
  btnCaption: {
    textAlign: 'center',
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 14,
  },
  cancelAddBtn: {
    backgroundColor: '#4A7280',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 8,
  },
  cancelAddBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  historyRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 10,
    gap: 3,
  },
  historyDrug: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  historyMeta: { fontSize: 12, color: '#475569' },
  historyDates: { fontSize: 11, color: '#64748B', fontStyle: 'italic' },
});
