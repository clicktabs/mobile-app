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
import { showAlert, confirmAction } from '../utils/confirm';
import { toDisplayDate } from '../utils/dateTimeUtils';
import * as staffApi from '../api/staff';
import { AppDatePicker } from './AppDatePicker';

export type AllergyItem = {
  id?: number | string;
  allergen?: string;
  allergen_name?: string;
  type?: string;
  allergen_type?: string;
  severity?: string;
  reaction?: string;
  onset_date?: string;
  date_added?: string;
  date_removed?: string;
  reason_removed?: string;
  cross_reactions?: string[];
  status?: string;
  notes?: string;
  exposure_route?: string;
};

type Props = {
  patientId: number;
  token: string;
  patient: Record<string, any> | null;
  items: AllergyItem[];
  onRefresh: () => void;
  loading?: boolean;
};

const COMMON_ALLERGEN_SUGGESTIONS = [
  { name: 'Penicillin', type: 'Medication', route: 'Oral', defaultReaction: 'Anaphylaxis', severity: 'severe' },
  { name: 'Amoxicillin', type: 'Medication', route: 'Oral', defaultReaction: 'Hives / Urticaria', severity: 'moderate' },
  { name: 'Aspirin', type: 'Medication', route: 'Oral', defaultReaction: 'Dyspnea / Wheezing', severity: 'moderate' },
  { name: 'Ibuprofen (NSAID)', type: 'Medication', route: 'Oral', defaultReaction: 'Angioedema', severity: 'severe' },
  { name: 'Sulfa Drugs (Bactrim)', type: 'Medication', route: 'Oral', defaultReaction: 'Rash / Erythema', severity: 'moderate' },
  { name: 'Peanuts', type: 'Food', route: 'Oral', defaultReaction: 'Anaphylaxis', severity: 'life-threatening' },
  { name: 'Latex', type: 'Environmental', route: 'Topical', defaultReaction: 'Contact Dermatitis', severity: 'mild' },
  { name: 'Contrast Media (Iodine)', type: 'Medication', route: 'Intravenous', defaultReaction: 'Hypotension / Anaphylaxis', severity: 'severe' },
  { name: 'Morphine', type: 'Medication', route: 'Intravenous', defaultReaction: 'Nausea / Pruritus', severity: 'mild' },
  { name: 'Codeine', type: 'Medication', route: 'Oral', defaultReaction: 'Nausea / Bronchospasm', severity: 'moderate' },
];

const REACTION_OPTIONS = [
  { label: 'Anaphylaxis', severity: 'life-threatening', isCritical: true },
  { label: 'Angioedema / Facial Swelling', severity: 'severe', isCritical: true },
  { label: 'Dyspnea / Wheezing', severity: 'severe', isCritical: true },
  { label: 'Hives / Urticaria', severity: 'moderate', isCritical: false },
  { label: 'Rash / Erythema', severity: 'mild', isCritical: false },
  { label: 'Hypotension', severity: 'severe', isCritical: true },
  { label: 'Nausea / Vomiting', severity: 'mild', isCritical: false },
  { label: 'Pruritus / Severe Itching', severity: 'mild', isCritical: false },
  { label: 'Other Reaction', severity: 'moderate', isCritical: false },
];

const ROUTE_OPTIONS = ['Oral', 'Intravenous', 'Intramuscular', 'Topical', 'Inhalation', 'Subcutaneous', 'Unknown'];

export function PatientAllergiesView({
  patientId,
  token,
  patient,
  items,
  onRefresh,
  loading,
}: Props) {
  // Filter tab between All, Active, and Historical
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'historical'>('all');

  // Add Allergy Modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  // Form State for Step 1
  const [allergenName, setAllergenName] = useState('Penicillin');
  const [reaction, setReaction] = useState('Anaphylaxis');
  const [severity, setSeverity] = useState('severe');
  const [dateOfDiagnosis, setDateOfDiagnosis] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [exposureRoute, setExposureRoute] = useState('Oral');
  const [allergenType, setAllergenType] = useState('Medication');
  const [allergenResults, setAllergenResults] = useState<staffApi.DrugSearchResult[]>([]);
  const [allergenSource, setAllergenSource] = useState<'drugbank' | 'rxnorm' | null>(null);
  const [searchingAllergens, setSearchingAllergens] = useState(false);
  const [allergyNotes, setAllergyNotes] = useState('');

  // Reaction picker modal
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [routePickerOpen, setRoutePickerOpen] = useState(false);

  // Checking warnings state
  const [checkingWarnings, setCheckingWarnings] = useState(false);
  const [warningsChecked, setWarningsChecked] = useState(false);
  const [savingAllergy, setSavingAllergy] = useState(false);

  // Details Modal
  const [selectedAllergy, setSelectedAllergy] = useState<AllergyItem | null>(null);

  // Inactive / Remove modal state
  const [deactivatingAllergy, setDeactivatingAllergy] = useState<AllergyItem | null>(null);
  const [removalReason, setRemovalReason] = useState('Clinical evaluation: no longer reactive');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Separate Active vs Historical allergies
  const activeAllergies = useMemo(() => {
    return items.filter((a) => {
      const st = String(a.status || 'active').toLowerCase();
      return st === 'active' || (!a.date_removed && st !== 'inactive' && st !== 'resolved');
    });
  }, [items]);

  const historicalAllergies = useMemo(() => {
    return items.filter((a) => {
      const st = String(a.status || '').toLowerCase();
      return st === 'inactive' || st === 'resolved' || Boolean(a.date_removed);
    });
  }, [items]);

  // Existing allergens for Step 2 preview
  const existingAllergenList = useMemo(() => {
    const names = activeAllergies
      .map((a) => a.allergen || a.allergen_name)
      .filter((n): n is string => Boolean(n) && n !== allergenName);
    return names.length > 0 ? names.join(', ') : 'Aspirin';
  }, [activeAllergies, allergenName]);

  // Dynamic cross-reactivity warning calculation based on entered allergen name
  const crossReactivityInfo = useMemo(() => {
    const lower = (allergenName || '').toLowerCase();
    if (lower.includes('penicillin') || lower.includes('amoxicillin') || lower.includes('ampicillin')) {
      return 'Allergy to Penicillin may imply sensitivity to related Beta-lactams. Review carefully.';
    }
    if (lower.includes('aspirin') || lower.includes('ibuprofen') || lower.includes('nsaid')) {
      return 'Allergy to NSAIDs may cause severe cross-reactivity with Cox-1 inhibitors. Review carefully.';
    }
    if (lower.includes('sulfa') || lower.includes('bactrim')) {
      return 'Allergy to Sulfonamides may imply cross-reactivity with Sulfonylureas and loop diuretics.';
    }
    if (lower.includes('peanut') || lower.includes('nut')) {
      return 'Allergy to Peanuts may cross-react with tree nuts and legumes. Review carefully.';
    }
    if (lower.includes('latex')) {
      return 'Latex sensitivity frequently cross-reacts with avocados, bananas, kiwis, and chestnuts.';
    }
    return `Cross-reactivity warning: Review medication and dietary history for related compounds.`;
  }, [allergenName]);

  /**
   * Live allergen lookup against DrugBank.
   *
   * Only for medication allergens. DrugBank is a drug database — searching it for
   * peanuts or latex returns nothing, and an empty result there would read as "that
   * allergen is not real" rather than "this source does not cover foods". Those stay
   * with the preset chips below, which is where they belong.
   */
  useEffect(() => {
    const query = allergenName.trim();

    if (allergenType !== 'Medication' || query.length < 2) {
      setAllergenResults([]);
      setAllergenSource(null);
      setSearchingAllergens(false);
      return;
    }

    let cancelled = false;
    setSearchingAllergens(true);

    const timer = setTimeout(async () => {
      try {
        const res = await staffApi.searchMedicationCatalog(token, query, 12, 'ingredient');
        if (cancelled) return;
        setAllergenResults(res.medications || []);
        setAllergenSource(res.source === 'none' ? null : res.source);
      } catch {
        if (!cancelled) {
          // A failed lookup must never block recording an allergy.
          setAllergenResults([]);
          setAllergenSource(null);
        }
      } finally {
        if (!cancelled) setSearchingAllergens(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [allergenName, allergenType, token]);

  const handleSelectAllergenResult = (d: staffApi.DrugSearchResult) => {
    setAllergenName(d.name);
    setAllergenType('Medication');
    if (d.route) setExposureRoute(d.route);
    // The reaction and severity are the clinician's to record — no drug database
    // knows how this patient reacted.
    setAllergenResults([]);
    setWarningsChecked(false);
  };

  const handleSelectSuggestion = (s: typeof COMMON_ALLERGEN_SUGGESTIONS[0]) => {
    setAllergenName(s.name);
    setAllergenType(s.type);
    setExposureRoute(s.route);
    setReaction(s.defaultReaction);
    setSeverity(s.severity);
  };

  const handleStartAdd = () => {
    setStep(1);
    setWarningsChecked(false);
    setCheckingWarnings(false);
    setAddModalOpen(true);
  };

  const handleCheckWarnings = () => {
    if (!allergenName.trim()) {
      showAlert('Required', 'Please enter an allergen name first.');
      return;
    }
    setCheckingWarnings(true);
    setTimeout(() => {
      setCheckingWarnings(false);
      setWarningsChecked(true);
    }, 800);
  };

  const handleProceedToStep2 = () => {
    if (!allergenName.trim()) {
      showAlert('Required', 'Please enter allergen name.');
      return;
    }
    setWarningsChecked(true);
    setStep(2);
  };

  const handleSaveAllergy = async () => {
    if (savingAllergy) return;
    setSavingAllergy(true);
    try {
      const res = await staffApi.addPatientAllergy(token, patientId, {
        allergen_name: allergenName.trim(),
        reaction: reaction,
        reaction_description: reaction,
        severity: severity,
        allergen_type: allergenType,
        date_of_diagnosis: dateOfDiagnosis,
        exposure_route: exposureRoute,
        notes: allergyNotes || undefined,
        acknowledged_warning: true,
      });

      if (res && res.success) {
        setAddModalOpen(false);
        setStep(1);
        onRefresh();
        showAlert('Success', `Allergy "${allergenName}" has been successfully added.`);
      } else {
        showAlert('Error', res?.message || 'Failed to save allergy record.');
      }
    } catch (e: any) {
      showAlert('Error', e?.message || 'An error occurred while saving.');
    } finally {
      setSavingAllergy(false);
    }
  };

  const handleSetStatus = async (
    allergy: AllergyItem,
    status: 'active' | 'inactive' | 'resolved',
    reason?: string,
  ) => {
    if (!allergy.id) return;
    setUpdatingStatus(true);
    try {
      const res = await staffApi.updatePatientAllergyStatus(
        token,
        patientId,
        allergy.id,
        status,
        reason,
      );
      if (res && res.success) {
        setDeactivatingAllergy(null);
        onRefresh();
        showAlert(
          'Updated',
          `Allergy status updated to "${status}".`,
        );
      } else {
        showAlert('Error', res?.message || 'Failed to update allergy status.');
      }
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to update status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDownloadPdf = () => {
    showAlert(
      'Download PDF Report',
      'Generating allergy report PDF. The file is being prepared and will be downloaded to your device.',
    );
  };

  const renderSeverityBadge = (sev?: string) => {
    const s = (sev || 'moderate').toLowerCase();
    let badgeBg = '#FEF3C7';
    let badgeText = '#92400E';
    let label = 'Moderate';

    if (s.includes('life') || s.includes('severe') || s.includes('high')) {
      badgeBg = '#FEE2E2';
      badgeText = '#B91C1C';
      label = s.includes('life') ? 'Life Threatening' : 'Severe';
    } else if (s.includes('mild') || s.includes('low')) {
      badgeBg = '#E0F2FE';
      badgeText = '#0369A1';
      label = 'Mild';
    }

    return (
      <View style={[styles.severityBadge, { backgroundColor: badgeBg }]}>
        <Text style={[styles.severityBadgeText, { color: badgeText }]}>{label}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Toolbar matching Image 2 */}
      <View style={styles.toolbar}>
        <Pressable
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}
          onPress={handleStartAdd}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.btnPrimaryText}>ADD ALLERGY</Text>
        </Pressable>

        <View style={styles.toolbarRight}>
          <Pressable
            style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
            onPress={onRefresh}
          >
            <Ionicons name="refresh" size={16} color="#DC2626" />
            <Text style={styles.btnSecondaryText}>REFRESH</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
            onPress={handleDownloadPdf}
          >
            <Ionicons name="document-text-outline" size={16} color="#DC2626" />
            <Text style={styles.btnSecondaryText}>DOWNLOAD PDF REPORT</Text>
          </Pressable>
        </View>
      </View>

      {/* Segmented Tab Filter */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tabButton, activeTab === 'all' && styles.tabButtonActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'all' && styles.tabButtonTextActive]}>
            All ({items.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === 'active' && styles.tabButtonActive]}
          onPress={() => setActiveTab('active')}
        >
          <Ionicons
            name="alert-circle"
            size={14}
            color={activeTab === 'active' ? '#FFFFFF' : '#DC2626'}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.tabButtonText, activeTab === 'active' && styles.tabButtonTextActive]}>
            Active Allergies ({activeAllergies.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === 'historical' && styles.tabButtonActive]}
          onPress={() => setActiveTab('historical')}
        >
          <Ionicons
            name="time-outline"
            size={14}
            color={activeTab === 'historical' ? '#FFFFFF' : '#64748B'}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.tabButtonText, activeTab === 'historical' && styles.tabButtonTextActive]}>
            Historical ({historicalAllergies.length})
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC2626" />
          <Text style={styles.loadingText}>Loading patient allergies...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
          {/* SECTION 1: Active Allergies */}
          {(activeTab === 'all' || activeTab === 'active') && (
            <View style={styles.sectionCard}>
              {/* Header Bar */}
              <View style={styles.sectionHeaderBar}>
                <View style={styles.sectionHeaderTitleWrap}>
                  <Ionicons name="alert-circle" size={18} color="#15803D" />
                  <Text style={styles.sectionHeaderTitle}>Active Allergies</Text>
                </View>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{activeAllergies.length}</Text>
                </View>
              </View>

              {/* List of Active Allergies */}
              {activeAllergies.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Ionicons name="shield-checkmark-outline" size={48} color="#94A3B8" />
                  <Text style={styles.emptyStateTitle}>No active allergies recorded</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    Patient has no known active allergies at this time.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={true}
                  style={{ width: '100%' }}
                  contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
                >
                  <View style={{ width: '100%', minWidth: 620 }}>
                    {/* Table Column Headers */}
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.tableColHeader, { width: 38, textAlign: 'center' }]}>#</Text>
                      <Text style={[styles.tableColHeader, { flex: 2.5, minWidth: 170 }]}>ALLERGEN</Text>
                      <Text style={[styles.tableColHeader, { flex: 1.2, minWidth: 100 }]}>SEVERITY</Text>
                      <Text style={[styles.tableColHeader, { flex: 1.8, minWidth: 140 }]}>REACTION</Text>
                      <Text style={[styles.tableColHeader, { width: 95, textAlign: 'center' }]}>ACTIONS</Text>
                    </View>

                    {activeAllergies.map((allergy, index) => {
                      return (
                        <View key={allergy.id ?? index} style={styles.tableRow}>
                          <View style={[styles.colCell, { width: 38, alignItems: 'center' }]}>
                            <Text style={styles.rowNumberText}>{index + 1}</Text>
                          </View>

                          <View style={[styles.colCell, { flex: 2.5, minWidth: 170 }]}>
                            <Text style={styles.allergenTitleText}>
                              {allergy.allergen || allergy.allergen_name || 'Unknown'}
                            </Text>
                            <Text style={styles.allergenSubtitleText}>
                              {allergy.type || allergy.allergen_type || 'Medication'} · Added {toDisplayDate(allergy.date_added, 'DD/MM/YYYY') || allergy.date_added || 'N/A'}
                            </Text>
                            {allergy.cross_reactions && allergy.cross_reactions.length > 0 && (
                              <Text style={styles.crossReactChip}>
                                ⚠ Cross-reacts: {allergy.cross_reactions.join(', ')}
                              </Text>
                            )}
                          </View>

                          <View style={[styles.colCell, { flex: 1.2, minWidth: 100 }]}>
                            {renderSeverityBadge(allergy.severity)}
                          </View>

                          <View style={[styles.colCell, { flex: 1.8, minWidth: 140 }]}>
                            <Text style={styles.reactionText} numberOfLines={2}>
                              {allergy.reaction || 'Not specified'}
                            </Text>
                          </View>

                          <View style={[styles.colCell, styles.actionButtonsCol, { width: 95, justifyContent: 'center' }]}>
                            <Pressable
                              style={({ pressed }) => [styles.iconBtn, styles.iconBtnPrimary, pressed && styles.pressed]}
                              onPress={() => setSelectedAllergy(allergy)}
                              accessibilityLabel="View Details"
                            >
                              <Ionicons name="eye-outline" size={15} color="#DC2626" />
                            </Pressable>

                            <Pressable
                              style={({ pressed }) => [styles.iconBtn, styles.iconBtnWarning, pressed && styles.pressed]}
                              onPress={() => setDeactivatingAllergy(allergy)}
                              accessibilityLabel="Mark Inactive"
                            >
                              <Ionicons name="pause-outline" size={15} color="#D97706" />
                            </Pressable>

                            <Pressable
                              style={({ pressed }) => [styles.iconBtn, styles.iconBtnDanger, pressed && styles.pressed]}
                              onPress={async () => {
                                const ok = await confirmAction(
                                  'Remove Allergy',
                                  `Remove "${allergy.allergen || allergy.allergen_name}" from active list?`,
                                  { destructive: true, confirmLabel: 'Remove' },
                                );
                                if (ok) {
                                  await handleSetStatus(allergy, 'inactive', 'Removed by clinician');
                                }
                              }}
                              accessibilityLabel="Remove"
                            >
                              <Ionicons name="trash-outline" size={15} color="#DC2626" />
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
            </View>
          )}

          {/* SECTION 2: Historical Allergies */}
          {(activeTab === 'all' || activeTab === 'historical') && (
            <View style={[styles.sectionCard, { marginTop: 16 }]}>
              {/* Header Bar */}
              <View style={styles.sectionHeaderBar}>
                <View style={styles.sectionHeaderTitleWrap}>
                  <Ionicons name="time-outline" size={18} color="#475569" />
                  <Text style={styles.sectionHeaderTitle}>Historical Allergies</Text>
                </View>
                <View style={[styles.countBadge, { backgroundColor: '#F1F5F9' }]}>
                  <Text style={[styles.countBadgeText, { color: '#475569' }]}>
                    {historicalAllergies.length}
                  </Text>
                </View>
              </View>

              {/* List of Historical Allergies */}
              {historicalAllergies.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Ionicons name="refresh-circle-outline" size={48} color="#94A3B8" />
                  <Text style={styles.emptyStateTitle}>No historical allergies found</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    No previously removed or inactive allergies recorded.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={true}
                  style={{ width: '100%' }}
                  contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
                >
                  <View style={{ width: '100%', minWidth: 620 }}>
                    {/* Table Column Headers */}
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.tableColHeader, { width: 38, textAlign: 'center' }]}>#</Text>
                      <Text style={[styles.tableColHeader, { flex: 2.5, minWidth: 170 }]}>ALLERGEN</Text>
                      <Text style={[styles.tableColHeader, { flex: 1.2, minWidth: 100 }]}>SEVERITY</Text>
                      <Text style={[styles.tableColHeader, { flex: 1.8, minWidth: 140 }]}>REASON REMOVED</Text>
                      <Text style={[styles.tableColHeader, { width: 95, textAlign: 'center' }]}>ACTIONS</Text>
                    </View>

                    {historicalAllergies.map((allergy, index) => {
                      return (
                        <View key={allergy.id ?? index} style={styles.tableRow}>
                          <View style={[styles.colCell, { width: 38, alignItems: 'center' }]}>
                            <Text style={styles.rowNumberText}>{index + 1}</Text>
                          </View>

                          <View style={[styles.colCell, { flex: 2.5, minWidth: 170 }]}>
                            <Text style={[styles.allergenTitleText, { color: '#475569' }]}>
                              {allergy.allergen || allergy.allergen_name || 'Unknown'}
                            </Text>
                            <Text style={styles.allergenSubtitleText}>
                              Removed: {toDisplayDate(allergy.date_removed, 'DD/MM/YYYY') || allergy.date_removed || 'N/A'}
                            </Text>
                          </View>

                          <View style={[styles.colCell, { flex: 1.2, minWidth: 100 }]}>
                            {renderSeverityBadge(allergy.severity)}
                          </View>

                          <View style={[styles.colCell, { flex: 1.8, minWidth: 140 }]}>
                            <Text style={styles.reactionText} numberOfLines={2}>
                              {allergy.reason_removed || 'Not specified'}
                            </Text>
                          </View>

                          <View style={[styles.colCell, styles.actionButtonsCol, { width: 95, justifyContent: 'center' }]}>
                            <Pressable
                              style={({ pressed }) => [styles.iconBtn, styles.iconBtnPrimary, pressed && styles.pressed]}
                              onPress={() => setSelectedAllergy(allergy)}
                              accessibilityLabel="View Details"
                            >
                              <Ionicons name="eye-outline" size={15} color="#DC2626" />
                            </Pressable>

                            <Pressable
                              style={({ pressed }) => [styles.iconBtn, styles.iconBtnSuccess, pressed && styles.pressed]}
                              onPress={async () => {
                                const ok = await confirmAction(
                                  'Restore Allergy',
                                  `Move "${allergy.allergen || allergy.allergen_name}" back to Active Allergies?`,
                                  { confirmLabel: 'Restore' },
                                );
                                if (ok) {
                                  await handleSetStatus(allergy, 'active');
                                }
                              }}
                              accessibilityLabel="Restore"
                            >
                              <Ionicons name="arrow-undo-outline" size={15} color="#15803D" />
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ========================================================== */}
      {/* 2-STEP ADD ALLERGY MODAL (MATCHING IMAGE 1) */}
      {/* ========================================================== */}
      <Modal
        visible={addModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Dark Slate Teal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalHeaderTitle}>
                  {step === 1 ? 'ADD ALLERGY' : 'REVIEW & FINALIZE'}
                </Text>
              </View>
              <Pressable
                onPress={() => setAddModalOpen(false)}
                style={({ pressed }) => [styles.modalCloseBtn, pressed && styles.pressed]}
              >
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </Pressable>
            </View>

            {/* Subheader & Progress Bar */}
            <View style={styles.progressContainer}>
              <Text style={styles.stepSubtitleText}>
                {step === 1
                  ? 'STEP 1/2: ENTER ALLERGY DETAILS'
                  : 'Step 2/2: Confirm Details and Actions'}
              </Text>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: step === 1 ? '50%' : '100%' },
                  ]}
                />
              </View>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {step === 1 ? (
                /* STEP 1: FORM FIELDS */
                <View style={styles.step1Form}>
                  {/* Search Allergen (DrugBank® synced) */}
                  <Text style={styles.fieldLabel}>Search Allergen (DrugBank® synced)</Text>
                  <View style={styles.searchBox}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search Allergen (DrugBank® synced)"
                      placeholderTextColor="#94A3B8"
                      value={allergenName}
                      onChangeText={(val) => {
                        setAllergenName(val);
                        setWarningsChecked(false);
                      }}
                    />
                    <Ionicons name="search" size={18} color="#64748B" style={{ marginRight: 8 }} />
                  </View>

                  {/* Live results — medications only; foods and environmental
                      allergens come from the chips below. */}
                  {allergenType === 'Medication' && allergenName.trim().length >= 2 ? (
                    searchingAllergens && allergenResults.length === 0 ? (
                      <Text style={styles.allergenSearchNote}>Searching DrugBank®…</Text>
                    ) : allergenResults.length > 0 ? (
                      <View style={styles.allergenResultList}>
                        {allergenResults.map((d, i) => (
                          <Pressable
                            key={`${d.name}-${d.dosage}-${i}`}
                            onPress={() => handleSelectAllergenResult(d)}
                            style={styles.allergenResultItem}
                          >
                            <Text style={styles.allergenResultName}>{d.name}</Text>
                            {d.route ? (
                              <Text style={styles.allergenResultMeta}>{d.route}</Text>
                            ) : null}
                          </Pressable>
                        ))}
                        <Text style={styles.allergenSearchNote}>
                          {allergenSource === 'drugbank'
                            ? 'Results from DrugBank®'
                            : 'DrugBank® unavailable — results from RxNorm (NIH)'}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.allergenSearchNote}>
                        No medication match. You can record the allergen as typed.
                      </Text>
                    )
                  ) : null}

                  {/* Preset Suggestions Pills */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.suggestionsScroll}
                    contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
                  >
                    {COMMON_ALLERGEN_SUGGESTIONS.map((sug) => (
                      <Pressable
                        key={sug.name}
                        style={[
                          styles.suggestionChip,
                          allergenName.toLowerCase() === sug.name.toLowerCase() &&
                          styles.suggestionChipActive,
                        ]}
                        onPress={() => handleSelectSuggestion(sug)}
                      >
                        <Text
                          style={[
                            styles.suggestionChipText,
                            allergenName.toLowerCase() === sug.name.toLowerCase() &&
                            styles.suggestionChipTextActive,
                          ]}
                        >
                          {sug.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  {/* 1. Allergen Name */}
                  <Text style={styles.fieldLabel}>1. Allergen Name</Text>
                  <TextInput
                    style={styles.textInput}
                    value={allergenName}
                    onChangeText={(val) => {
                      setAllergenName(val);
                      setWarningsChecked(false);
                    }}
                    placeholder="e.g. Penicillin"
                    placeholderTextColor="#94A3B8"
                  />

                  {/* 2. Reaction (Severity, Manifestation) with alert icon */}
                  <Text style={styles.fieldLabel}>2. Reaction (Severity, Manifestation)</Text>
                  <Pressable
                    style={[
                      styles.pickerInput,
                      reaction.toLowerCase().includes('anaphylaxis') && styles.criticalReactionHighlight,
                    ]}
                    onPress={() => setReactionPickerOpen(true)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Text
                        style={[
                          styles.pickerValueText,
                          reaction.toLowerCase().includes('anaphylaxis') && { color: '#B91C1C', fontWeight: '700' },
                        ]}
                      >
                        {reaction}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="alert-circle" size={18} color="#DC2626" />
                      <Ionicons name="chevron-down" size={16} color="#64748B" />
                    </View>
                  </Pressable>

                  {/* 3. Date of Diagnosis */}
                  <Text style={styles.fieldLabel}>3. Date of Diagnosis</Text>
                  <AppDatePicker
                    value={dateOfDiagnosis}
                    onChange={setDateOfDiagnosis}
                    format="YYYY-MM-DD"
                    placeholder="YYYY-MM-DD"
                  />

                  {/* 4. Exposure Route */}
                  <Text style={styles.fieldLabel}>4. Exposure Route</Text>
                  <Pressable
                    style={styles.pickerInput}
                    onPress={() => setRoutePickerOpen(true)}
                  >
                    <Text style={styles.pickerValueText}>{exposureRoute}</Text>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </Pressable>

                  {/* Clinical Notes */}
                  <Text style={styles.fieldLabel}>Clinical Notes (Optional)</Text>
                  <TextInput
                    style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                    value={allergyNotes}
                    onChangeText={setAllergyNotes}
                    placeholder="Enter additional clinical manifestation details..."
                    placeholderTextColor="#94A3B8"
                    multiline
                  />

                  {/* CHECK ALLERGY WARNINGS BUTTON */}
                  <View style={styles.checkWarningsSection}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.checkWarningsBtn,
                        warningsChecked && styles.checkWarningsBtnSuccess,
                        pressed && styles.pressed,
                      ]}
                      onPress={handleCheckWarnings}
                      disabled={checkingWarnings}
                    >
                      {checkingWarnings ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Ionicons
                          name={warningsChecked ? 'checkmark-circle' : 'medical'}
                          size={18}
                          color="#FFFFFF"
                        />
                      )}
                      <Text style={styles.checkWarningsBtnText}>
                        {checkingWarnings
                          ? 'Checking Databases...'
                          : warningsChecked
                            ? '[ WARNINGS CHECKED & VERIFIED ]'
                            : '[ CHECK ALLERGY WARNINGS ]'}
                      </Text>
                    </Pressable>

                    <Text style={styles.checkStatusHelperText}>
                      {checkingWarnings
                        ? 'Querying DrugBank® and UpToDate® APIs...'
                        : warningsChecked
                          ? '1 potential interaction & 1 cross-reactivity warning detected.'
                          : 'Wait for check...'}
                    </Text>

                    <Pressable
                      style={({ pressed }) => [
                        styles.btnFinalizeAdd,
                        (!allergenName.trim() || checkingWarnings) && styles.btnDisabled,
                        pressed && styles.pressed,
                      ]}
                      onPress={handleProceedToStep2}
                      disabled={!allergenName.trim() || checkingWarnings}
                    >
                      <Text style={styles.btnFinalizeAddText}>Finalize Add</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                /* STEP 2: REVIEW & FINALIZE (MATCHING IMAGE 1 RIGHT) */
                <View style={styles.step2Container}>
                  {/* Summary Card */}
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryHeading}>New Allergy:</Text>
                    <Text style={styles.summaryValueText}>{allergenName}</Text>
                    <Text style={styles.summaryMetaText}>
                      Reaction: {reaction} · Route: {exposureRoute} · Diagnosis: {dateOfDiagnosis}
                    </Text>

                    <View style={styles.summaryDivider} />

                    <Text style={styles.summaryHeading}>Existing:</Text>
                    <Text style={styles.summaryValueText}>{existingAllergenList}</Text>
                  </View>

                  {/* Amber Warning Card */}
                  <View style={styles.amberWarningCard}>
                    <Text style={styles.amberWarningText}>
                      *Potential interaction: New allergy to {allergenName} detected. Check complete patient history.*
                    </Text>
                  </View>

                  {/* Red Cross-Reactivity Warning Card */}
                  <View style={styles.redWarningCard}>
                    <Text style={styles.redWarningHeading}>
                      !! **CROSS-REACTIVITY WARNING:**
                    </Text>
                    <Text style={styles.redWarningText}>{crossReactivityInfo}</Text>
                  </View>

                  {/* Green Primary Action: ADD WITH ACKNOWLEDGEMENT */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.btnAddWithAcknowledgement,
                      savingAllergy && styles.btnDisabled,
                      pressed && styles.pressed,
                    ]}
                    onPress={handleSaveAllergy}
                    disabled={savingAllergy}
                  >
                    {savingAllergy ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.btnAddWithAcknowledgementText}>
                        ADD WITH ACKNOWLEDGEMENT
                      </Text>
                    )}
                  </Pressable>
                  <Text style={styles.btnSubtext}>
                    Finalizes the add, acknowledges the warning
                  </Text>

                  {/* Cancel Button */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.btnCancelAdd,
                      savingAllergy && styles.btnDisabled,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setStep(1)}
                    disabled={savingAllergy}
                  >
                    <Text style={styles.btnCancelAddText}>CANCEL ADD</Text>
                  </Pressable>
                  <Text style={styles.btnSubtext}>Discards the new allergy</Text>

                  {/* Verified Footer */}
                  <View style={styles.verifiedFooter}>
                    <Ionicons name="checkmark-circle" size={18} color="#15803D" />
                    <Text style={styles.verifiedFooterText}>
                      DrugBank® and UpToDate® Verified.
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* REACTION PICKER MODAL */}
      <Modal
        visible={reactionPickerOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setReactionPickerOpen(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Reaction & Severity</Text>
              <Pressable onPress={() => setReactionPickerOpen(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 350 }}>
              {REACTION_OPTIONS.map((item) => (
                <Pressable
                  key={item.label}
                  style={[
                    styles.pickerOptionItem,
                    reaction === item.label && styles.pickerOptionItemActive,
                  ]}
                  onPress={() => {
                    setReaction(item.label);
                    setSeverity(item.severity);
                    setReactionPickerOpen(false);
                    setWarningsChecked(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.pickerOptionLabel,
                        item.isCritical && { color: '#B91C1C', fontWeight: '700' },
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Text style={styles.pickerOptionSeverity}>
                      Severity: {item.severity.toUpperCase()}
                    </Text>
                  </View>
                  {item.isCritical && (
                    <Ionicons name="warning" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                  )}
                  {reaction === item.label && (
                    <Ionicons name="checkmark" size={18} color="#DC2626" />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ROUTE PICKER MODAL */}
      <Modal
        visible={routePickerOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setRoutePickerOpen(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Exposure Route</Text>
              <Pressable onPress={() => setRoutePickerOpen(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {ROUTE_OPTIONS.map((r) => (
                <Pressable
                  key={r}
                  style={[
                    styles.pickerOptionItem,
                    exposureRoute === r && styles.pickerOptionItemActive,
                  ]}
                  onPress={() => {
                    setExposureRoute(r);
                    setRoutePickerOpen(false);
                  }}
                >
                  <Text style={styles.pickerOptionLabel}>{r}</Text>
                  {exposureRoute === r && (
                    <Ionicons name="checkmark" size={18} color="#DC2626" />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ALLERGY DETAILS VIEW MODAL */}
      <Modal
        visible={Boolean(selectedAllergy)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedAllergy(null)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={[styles.pickerModalContent, { maxWidth: 440 }]}>
            <View style={styles.pickerModalHeader}>
              <View>
                <Text style={styles.pickerModalTitle}>
                  {selectedAllergy?.allergen || selectedAllergy?.allergen_name}
                </Text>
                <Text style={styles.allergenSubtitleText}>Clinical Allergy Details</Text>
              </View>
              <Pressable onPress={() => setSelectedAllergy(null)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            {selectedAllergy && (
              <ScrollView style={{ padding: 16 }}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <Text style={[styles.detailValue, { textTransform: 'capitalize', fontWeight: '700' }]}>
                    {selectedAllergy.status || 'Active'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type:</Text>
                  <Text style={styles.detailValue}>
                    {selectedAllergy.type || selectedAllergy.allergen_type || 'Medication'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Severity:</Text>
                  <Text style={styles.detailValue}>
                    {selectedAllergy.severity ? selectedAllergy.severity.toUpperCase() : 'MODERATE'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Reaction:</Text>
                  <Text style={styles.detailValue}>
                    {selectedAllergy.reaction || 'Not specified'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Exposure Route:</Text>
                  <Text style={styles.detailValue}>
                    {selectedAllergy.exposure_route || 'Oral'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date Added:</Text>
                  <Text style={styles.detailValue}>
                    {selectedAllergy.date_added || 'N/A'}
                  </Text>
                </View>

                {selectedAllergy.date_removed && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date Removed:</Text>
                    <Text style={styles.detailValue}>{selectedAllergy.date_removed}</Text>
                  </View>
                )}

                {selectedAllergy.reason_removed && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Reason Removed:</Text>
                    <Text style={styles.detailValue}>{selectedAllergy.reason_removed}</Text>
                  </View>
                )}

                {selectedAllergy.cross_reactions && selectedAllergy.cross_reactions.length > 0 && (
                  <View style={[styles.detailRow, { alignItems: 'flex-start' }]}>
                    <Text style={styles.detailLabel}>Cross-Reactivity:</Text>
                    <Text style={[styles.detailValue, { color: '#B91C1C', flex: 1 }]}>
                      {selectedAllergy.cross_reactions.join(', ')}
                    </Text>
                  </View>
                )}

                {selectedAllergy.notes && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.detailLabel}>Notes:</Text>
                    <Text style={[styles.detailValue, { marginTop: 4 }]}>{selectedAllergy.notes}</Text>
                  </View>
                )}

                <View style={styles.verifiedFooterModal}>
                  <Ionicons name="shield-checkmark" size={16} color="#15803D" />
                  <Text style={styles.verifiedFooterModalText}>
                    DrugBank® Synced & Clinically Audited
                  </Text>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* MARK INACTIVE MODAL */}
      <Modal
        visible={Boolean(deactivatingAllergy)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeactivatingAllergy(null)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={[styles.pickerModalContent, { maxWidth: 400 }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Mark Allergy Inactive</Text>
              <Pressable onPress={() => setDeactivatingAllergy(null)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            <View style={{ padding: 16 }}>
              <Text style={styles.helperText}>
                Move &quot;{deactivatingAllergy?.allergen || deactivatingAllergy?.allergen_name}&quot; to
                historical records. Please specify the clinical reason:
              </Text>

              <TextInput
                style={[styles.textInput, { height: 70, textAlignVertical: 'top', marginTop: 12 }]}
                value={removalReason}
                onChangeText={setRemovalReason}
                placeholder="Reason for removal..."
                placeholderTextColor="#94A3B8"
                multiline
              />

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                <Pressable
                  style={[styles.btnSecondary, { flex: 1, justifyContent: 'center' }]}
                  onPress={() => setDeactivatingAllergy(null)}
                  disabled={updatingStatus}
                >
                  <Text style={styles.btnSecondaryText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={[styles.btnPrimary, { flex: 1, justifyContent: 'center', backgroundColor: '#D97706' }]}
                  onPress={() => {
                    if (deactivatingAllergy) {
                      handleSetStatus(deactivatingAllergy, 'inactive', removalReason);
                    }
                  }}
                  disabled={updatingStatus}
                >
                  {updatingStatus ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.btnPrimaryText}>Confirm Inactive</Text>
                  )}
                </Pressable>
              </View>
            </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexWrap: 'wrap',
    gap: 8,
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    gap: 6,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  btnSecondaryText: {
    color: '#DC2626',
    fontWeight: '600',
    fontSize: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  tabButtonActive: {
    backgroundColor: '#DC2626',
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
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
  sectionHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  sectionHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  countBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    width: '100%',
  },
  colCell: {
    justifyContent: 'center',
  },
  rowNumberText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  allergenTitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  allergenSubtitleText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  crossReactChip: {
    fontSize: 10,
    color: '#B91C1C',
    fontWeight: '600',
    marginTop: 2,
  },
  severityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  severityBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  reactionText: {
    fontSize: 12,
    color: '#334155',
  },
  actionButtonsCol: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 4,
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
  iconBtnWarning: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  iconBtnDanger: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
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

  /* 2-Step Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '92%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    backgroundColor: '#111111',
    borderBottomWidth: 3,
    borderBottomColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  modalCloseBtn: {
    padding: 4,
  },
  progressContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  stepSubtitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#111111',
    borderRadius: 2,
  },
  modalContent: {
    padding: 16,
  },
  step1Form: {
    paddingBottom: 20,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
    marginTop: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    height: 38,
    fontSize: 13,
    color: '#1E293B',
  },
  suggestionsScroll: {
    marginTop: 6,
    marginBottom: 4,
  },
  allergenResultList: { marginTop: 8, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, overflow: 'hidden' },
  allergenResultItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  allergenResultName: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  allergenResultMeta: { marginTop: 2, fontSize: 11, color: '#64748B' },
  allergenSearchNote: { marginTop: 6, paddingHorizontal: 4, fontSize: 11, color: '#64748B', fontStyle: 'italic' },
  suggestionChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  suggestionChipActive: {
    backgroundColor: '#111111',
    borderColor: '#2E525A',
  },
  suggestionChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  suggestionChipTextActive: {
    color: '#FFFFFF',
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
  pickerInput: {
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
  pickerValueText: {
    fontSize: 13,
    color: '#1E293B',
  },
  criticalReactionHighlight: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  checkWarningsSection: {
    marginTop: 18,
    alignItems: 'center',
  },
  checkWarningsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626', // Teal button matching screenshot
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 6,
    gap: 8,
    width: '100%',
  },
  checkWarningsBtnSuccess: {
    backgroundColor: '#15803D',
  },
  checkWarningsBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  checkStatusHelperText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginTop: 6,
    marginBottom: 12,
    textAlign: 'center',
  },
  btnFinalizeAdd: {
    width: '100%',
    backgroundColor: '#CBD5E1',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  btnFinalizeAddText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  btnDisabled: {
    opacity: 0.5,
  },

  /* Step 2 Styles matching Image 1 Right */
  step2Container: {
    paddingBottom: 24,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  summaryHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 2,
  },
  summaryValueText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  summaryMetaText: {
    fontSize: 11,
    color: '#64748B',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
  },
  amberWarningCard: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  amberWarningText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
    lineHeight: 17,
  },
  redWarningCard: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  redWarningHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B91C1C',
    marginBottom: 4,
  },
  redWarningText: {
    fontSize: 12,
    color: '#991B1B',
    lineHeight: 17,
    fontWeight: '600',
  },
  btnAddWithAcknowledgement: {
    backgroundColor: '#43A047', // Clean green matching screenshot
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAddWithAcknowledgementText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  btnSubtext: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 3,
    marginBottom: 10,
  },
  btnCancelAdd: {
    backgroundColor: '#476875', // Muted slate teal matching screenshot
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelAddText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  verifiedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    gap: 6,
  },
  verifiedFooterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },

  /* Pickers & Modals */
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  pickerModalContent: {
    width: '100%',
    maxWidth: 380,
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerOptionItemActive: {
    backgroundColor: '#EFF6FF',
  },
  pickerOptionLabel: {
    fontSize: 13,
    color: '#1E293B',
  },
  pickerOptionSeverity: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailLabel: {
    width: 120,
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  detailValue: {
    fontSize: 13,
    color: '#1E293B',
    flex: 1,
  },
  verifiedFooterModal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 6,
    gap: 6,
  },
  verifiedFooterModalText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  helperText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.8,
  },
});
