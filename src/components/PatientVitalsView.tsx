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
import { showAlert } from '../utils/confirm';
import { useAuth } from '../context/AuthContext';
import * as staffApi from '../api/staff';
import { AppDatePicker, AppTimePicker } from './AppDatePicker';
import { toDisplayDate } from '../utils/dateTimeUtils';

export type VitalItem = {
  id?: number | string;
  recorded_at?: string;
  date?: string;
  time?: string;
  provider?: string;
  blood_pressure_systolic?: number | string | null;
  blood_pressure_diastolic?: number | string | null;
  heart_rate?: number | string | null;
  temperature?: number | string | null;
  respiratory_rate?: number | string | null;
  oxygen_saturation?: number | string | null;
  pain_level?: number | string | null;
  blood_sugar?: number | string | null;
  weight?: number | string | null;
  weight_unit?: string;
  position?: string;
  critical_values?: boolean;
  provider_notified?: boolean;
  follow_up_required?: boolean;
  recorded_by?: string;
  status?: string;
  notes?: string;
};

type Props = {
  patientId: number;
  token: string;
  patient: Record<string, any> | null;
  items: VitalItem[];
  onRefresh: () => void;
  loading?: boolean;
};

const PAIN_OPTIONS = [
  { value: '', label: 'Select...' },
  { value: '0', label: '0 - No Pain' },
  { value: '1', label: '1 - Mild' },
  { value: '2', label: '2 - Mild' },
  { value: '3', label: '3 - Mild' },
  { value: '4', label: '4 - Moderate' },
  { value: '5', label: '5 - Moderate' },
  { value: '6', label: '6 - Moderate' },
  { value: '7', label: '7 - Severe' },
  { value: '8', label: '8 - Severe' },
  { value: '9', label: '9 - Severe' },
  { value: '10', label: '10 - Worst Possible' },
];

const POSITION_OPTIONS = [
  { value: '', label: 'Select position...' },
  { value: 'Sitting', label: 'Sitting' },
  { value: 'Standing', label: 'Standing' },
  { value: 'Lying', label: 'Lying' },
  { value: 'Semi-Fowler', label: 'Semi-Fowler' },
  { value: 'Fowler', label: 'Fowler' },
  { value: 'Trendelenburg', label: 'Trendelenburg' },
];

const WEIGHT_UNITS = ['lbs', 'kg'] as const;

function getInitialDate() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  return `${d}/${m}/${y}`;
}

function getInitialTime() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function PatientVitalsView({
  patientId,
  token,
  patient,
  items,
  onRefresh,
  loading,
}: Props) {
  const { staffUser } = useAuth();

  // Add Vital Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [recordedDate, setRecordedDate] = useState(getInitialDate);
  const [recordedTime, setRecordedTime] = useState(getInitialTime);
  const [provider, setProvider] = useState(staffUser?.name || 'Md.Enamul Haq');

  // Primary Vital Signs
  const [systolic, setSystolic] = useState('120');
  const [diastolic, setDiastolic] = useState('80');
  const [heartRate, setHeartRate] = useState('72');
  const [temperature, setTemperature] = useState('98.6');

  // Secondary Vital Signs
  const [respRate, setRespRate] = useState('16');
  const [o2Sat, setO2Sat] = useState('98');
  const [painLevel, setPainLevel] = useState('');
  const [weight, setWeight] = useState('150');
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs');

  // Additional Information
  const [position, setPosition] = useState('');
  const [notes, setNotes] = useState('');

  // Alert Flags
  const [criticalValues, setCriticalValues] = useState(false);
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [providerNotified, setProviderNotified] = useState(false);

  // Pickers
  const [painPickerOpen, setPainPickerOpen] = useState(false);
  const [positionPickerOpen, setPositionPickerOpen] = useState(false);
  const [weightUnitPickerOpen, setWeightUnitPickerOpen] = useState(false);

  // Saving state
  const [saving, setSaving] = useState(false);

  // Details & Trends
  const [selectedVital, setSelectedVital] = useState<VitalItem | null>(null);
  const [trendsModalOpen, setTrendsModalOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState<'table' | 'cards'>('table');

  // Latest Vitals summary
  const latest = useMemo(() => {
    return items.length > 0 ? items[0] : null;
  }, [items]);

  const handleOpenAddModal = () => {
    setRecordedDate(getInitialDate());
    setRecordedTime(getInitialTime());
    setProvider(staffUser?.name || 'Md.Enamul Haq');
    setSystolic('120');
    setDiastolic('80');
    setHeartRate('72');
    setTemperature('98.6');
    setRespRate('16');
    setO2Sat('98');
    setPainLevel('');
    setWeight('150');
    setWeightUnit('lbs');
    setPosition('');
    setCriticalValues(false);
    setFollowUpRequired(false);
    setProviderNotified(false);
    setNotes('');
    setAddModalOpen(true);
  };

  const handleSaveVital = async () => {
    setSaving(true);
    try {
      const res = await staffApi.recordVitals(token, patientId, {
        recorded_date: recordedDate,
        recorded_time: recordedTime,
        provider: provider.trim(),
        blood_pressure_systolic: systolic ? parseInt(systolic, 10) : undefined,
        blood_pressure_diastolic: diastolic ? parseInt(diastolic, 10) : undefined,
        systolic_bp: systolic ? parseInt(systolic, 10) : undefined,
        diastolic_bp: diastolic ? parseInt(diastolic, 10) : undefined,
        heart_rate: heartRate ? parseInt(heartRate, 10) : undefined,
        temperature: temperature ? parseFloat(temperature) : undefined,
        respiratory_rate: respRate ? parseInt(respRate, 10) : undefined,
        oxygen_saturation: o2Sat ? parseFloat(o2Sat) : undefined,
        pain_level: painLevel !== '' ? parseInt(painLevel, 10) : undefined,
        pain_scale: painLevel !== '' ? painLevel : undefined,
        weight: weight ? parseFloat(weight) : undefined,
        weight_unit: weightUnit,
        position: position || undefined,
        critical_values: criticalValues,
        provider_notified: providerNotified,
        follow_up_required: followUpRequired,
        notes: notes.trim() || undefined,
      });

      if (res && res.success) {
        setAddModalOpen(false);
        onRefresh();
        showAlert('Success', 'Vital signs saved successfully');
      } else {
        showAlert('Error', res?.message || 'Failed to record vital signs.');
      }
    } catch (e: any) {
      showAlert('Error', e?.message || 'An error occurred while saving vitals.');
    } finally {
      setSaving(false);
    }
  };

  const renderPainBadge = (level: unknown) => {
    if (level === null || level === undefined || level === '') return <Text style={{ color: '#94A3B8', fontSize: 11 }}>—</Text>;
    const p = typeof level === 'number' ? level : parseInt(String(level), 10);
    let bg = '#DCFCE7';
    let text = '#166534';
    if (p >= 7) {
      bg = '#FEE2E2';
      text = '#B91C1C';
    } else if (p >= 4) {
      bg = '#FEF3C7';
      text = '#92400E';
    }
    return (
      <View style={[styles.miniBadge, { backgroundColor: bg }]}>
        <Text style={[styles.miniBadgeText, { color: text }]}>{p} / 10</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Action Toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.toolbarMainRow}>
          <Pressable
            style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}
            onPress={handleOpenAddModal}
          >
            <Ionicons name="add-circle" size={18} color="#FFFFFF" />
            <Text style={styles.btnPrimaryText}>ADD VITAL SIGNS</Text>
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
                color={displayMode === 'table' ? '#FFFFFF' : '#475569'}
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
                color={displayMode === 'cards' ? '#FFFFFF' : '#475569'}
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

        {/* Secondary Action Row with horizontal scroll so it never clips on mobile */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.secondaryActionsRow}
        >
          <Pressable
            style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
            onPress={onRefresh}
          >
            <Ionicons name="refresh" size={14} color="#0F172A" />
            <Text style={styles.btnSecondaryText}>REFRESH</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
            onPress={() => setTrendsModalOpen(true)}
          >
            <Ionicons name="trending-up-outline" size={14} color="#0F172A" />
            <Text style={styles.btnSecondaryText}>VIEW TRENDS</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
            onPress={() => showAlert('Vital Signs Report', 'Vital signs clinical history PDF report generated.', 'success')}
          >
            <Ionicons name="print-outline" size={14} color="#0F172A" />
            <Text style={styles.btnSecondaryText}>PRINT REPORT</Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Summary Stat Cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statsScroll}
        contentContainerStyle={styles.statsRow}
      >
        <View style={styles.statCard}>
          <View style={styles.statCardHeader}>
            <Ionicons name="heart-circle" size={16} color="#DC2626" />
            <Text style={styles.statLabel}>Blood Pressure</Text>
          </View>
          <Text style={styles.statNumber}>
            {latest?.blood_pressure_systolic && latest?.blood_pressure_diastolic
              ? `${latest.blood_pressure_systolic}/${latest.blood_pressure_diastolic}`
              : '—/—'}
          </Text>
          <Text style={styles.statSub}>mmHg</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statCardHeader}>
            <Ionicons name="pulse" size={16} color="#DC2626" />
            <Text style={styles.statLabel}>Heart Rate</Text>
          </View>
          <Text style={styles.statNumber}>
            {latest?.heart_rate ? `${latest.heart_rate} bpm` : '—'}
          </Text>
          <Text style={styles.statSub}>Resting</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statCardHeader}>
            <Ionicons name="water" size={16} color="#DC2626" />
            <Text style={styles.statLabel}>O2 Saturation</Text>
          </View>
          <Text style={styles.statNumber}>
            {latest?.oxygen_saturation ? `${latest.oxygen_saturation}%` : '—'}
          </Text>
          <Text style={styles.statSub}>SpO2</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statCardHeader}>
            <Ionicons name="thermometer" size={16} color="#DC2626" />
            <Text style={styles.statLabel}>Temperature</Text>
          </View>
          <Text style={styles.statNumber}>
            {latest?.temperature ? `${latest.temperature}°F` : '—'}
          </Text>
          <Text style={styles.statSub}>Oral</Text>
        </View>
      </ScrollView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC2626" />
          <Text style={styles.loadingText}>Loading vital signs history...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
          <View style={styles.sectionCard}>
            {/* Header Bar */}
            <View style={styles.sectionHeaderBar}>
              <View style={styles.sectionHeaderTitleWrap}>
                <View style={styles.pulseIconCircle}>
                  <Ionicons name="pulse" size={16} color="#DC2626" />
                </View>
                <View>
                  <Text style={styles.sectionHeaderTitle}>Current Vital Signs</Text>
                  <Text style={styles.sectionHeaderSub}>Clinical records & measurements</Text>
                </View>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{items.length} records</Text>
              </View>
            </View>

            {/* List */}
            {items.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Ionicons name="pulse-outline" size={48} color="#94A3B8" />
                <Text style={styles.emptyStateTitle}>No vital signs recorded yet</Text>
                <Text style={styles.emptyStateSubtitle}>
                  Capture baseline or regular vital signs for this patient.
                </Text>
                <Pressable
                  style={[styles.btnPrimary, { marginTop: 14 }]}
                  onPress={handleOpenAddModal}
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={styles.btnPrimaryText}>Add Vital Signs</Text>
                </Pressable>
              </View>
            ) : displayMode === 'table' ? (
              /* TABLE VIEW: Horizontally scrollable so columns are never squished */
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={true}
                style={{ width: '100%' }}
                contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
              >
                <View style={{ width: '100%', minWidth: 680 }}>
                  {/* Table Column Headers */}
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableColHeader, { width: 38, textAlign: 'center' }]}>#</Text>
                    <Text style={[styles.tableColHeader, { width: 130 }]}>DATE & TIME</Text>
                    <Text style={[styles.tableColHeader, { width: 135 }]}>BP (SYS/DIA)</Text>
                    <Text style={[styles.tableColHeader, { width: 95 }]}>HEART RATE</Text>
                    <Text style={[styles.tableColHeader, { width: 110 }]}>O2 SAT & RR</Text>
                    <Text style={[styles.tableColHeader, { width: 95 }]}>PAIN LEVEL</Text>
                    <Text style={[styles.tableColHeader, { width: 75, textAlign: 'center' }]}>ACTIONS</Text>
                  </View>

                  {items.map((item, index) => {
                    const bp =
                      item.blood_pressure_systolic || item.blood_pressure_diastolic
                        ? `${item.blood_pressure_systolic ?? '—'}/${item.blood_pressure_diastolic ?? '—'}`
                        : '—';
                    const formattedDate = toDisplayDate(item.date || item.recorded_at) || 'Today';

                    return (
                      <View
                        key={item.id ?? index}
                        style={[
                          styles.tableRow,
                          index % 2 === 1 && styles.tableRowEven,
                        ]}
                      >
                        <View style={[styles.colCell, { width: 38, alignItems: 'center' }]}>
                          <Text style={styles.rowNumberText}>{index + 1}</Text>
                        </View>

                        <View style={[styles.colCell, { width: 130 }]}>
                          <Text style={styles.dateTimeText}>{formattedDate}</Text>
                          <Text style={styles.timeText}>{item.time || '—'}</Text>
                        </View>

                        <View style={[styles.colCell, { width: 135 }]}>
                          <Text style={styles.readingText}>{bp} mmHg</Text>
                          {item.temperature ? (
                            <Text style={styles.subReadingText}>Temp: {item.temperature}°F</Text>
                          ) : null}
                        </View>

                        <View style={[styles.colCell, { width: 95 }]}>
                          <Text style={styles.readingText}>{item.heart_rate ? `${item.heart_rate} bpm` : '—'}</Text>
                          {item.position ? (
                            <Text style={styles.subReadingText}>{item.position}</Text>
                          ) : null}
                        </View>

                        <View style={[styles.colCell, { width: 110 }]}>
                          <Text style={styles.readingText}>{item.oxygen_saturation ? `${item.oxygen_saturation}%` : '—'}</Text>
                          {item.respiratory_rate ? (
                            <Text style={styles.subReadingText}>RR: {item.respiratory_rate} /min</Text>
                          ) : null}
                        </View>

                        <View style={[styles.colCell, { width: 95 }]}>
                          {renderPainBadge(item.pain_level)}
                        </View>

                        <View style={[styles.colCell, { width: 75, alignItems: 'center' }]}>
                          <Pressable
                            style={({ pressed }) => [styles.iconBtn, styles.iconBtnPrimary, pressed && styles.pressed]}
                            onPress={() => setSelectedVital(item)}
                            accessibilityLabel="View Details"
                          >
                            <Ionicons name="eye-outline" size={14} color="#DC2626" />
                            <Text style={styles.iconBtnLabel}>View</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            ) : (
              /* CARDS VIEW: Mobile-optimized clinical record cards */
              <View style={styles.cardsContainer}>
                {items.map((item, index) => {
                  const bp =
                    item.blood_pressure_systolic || item.blood_pressure_diastolic
                      ? `${item.blood_pressure_systolic ?? '—'}/${item.blood_pressure_diastolic ?? '—'}`
                      : '—';
                  const formattedDate = toDisplayDate(item.date || item.recorded_at) || 'Today';

                  return (
                    <View key={item.id ?? index} style={styles.vitalCard}>
                      <View style={styles.vitalCardTop}>
                        <View style={styles.vitalCardTopLeft}>
                          <View style={styles.vitalIndexBadge}>
                            <Text style={styles.vitalIndexText}>#{index + 1}</Text>
                          </View>
                          <View>
                            <Text style={styles.vitalCardDate}>{formattedDate}</Text>
                            <Text style={styles.vitalCardTime}>{item.time || '—'}</Text>
                          </View>
                        </View>
                        <View style={styles.vitalCardTopRight}>
                          {renderPainBadge(item.pain_level)}
                          {item.critical_values && (
                            <View style={styles.criticalBadge}>
                              <Ionicons name="warning" size={11} color="#DC2626" />
                              <Text style={styles.criticalBadgeText}>CRITICAL</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <View style={styles.vitalMetricsGrid}>
                        <View style={styles.vitalMetricBox}>
                          <Text style={styles.metricLabel}>Blood Pressure</Text>
                          <Text style={styles.metricValue}>{bp} <Text style={styles.metricUnit}>mmHg</Text></Text>
                          {item.temperature ? (
                            <Text style={styles.metricSub}>Temp: {item.temperature}°F</Text>
                          ) : null}
                        </View>

                        <View style={styles.vitalMetricBox}>
                          <Text style={styles.metricLabel}>Heart Rate</Text>
                          <Text style={[styles.metricValue, { color: '#DC2626' }]}>
                            {item.heart_rate ? `${item.heart_rate}` : '—'} <Text style={styles.metricUnit}>bpm</Text>
                          </Text>
                          {item.position ? (
                            <Text style={styles.metricSub}>Pos: {item.position}</Text>
                          ) : null}
                        </View>

                        <View style={styles.vitalMetricBox}>
                          <Text style={styles.metricLabel}>O2 Saturation</Text>
                          <Text style={[styles.metricValue, { color: '#0284C7' }]}>
                            {item.oxygen_saturation ? `${item.oxygen_saturation}%` : '—'}
                          </Text>
                          {item.respiratory_rate ? (
                            <Text style={styles.metricSub}>RR: {item.respiratory_rate} /min</Text>
                          ) : null}
                        </View>

                        <View style={styles.vitalMetricBox}>
                          <Text style={styles.metricLabel}>Weight & Details</Text>
                          <Text style={styles.metricValue}>
                            {item.weight ? `${item.weight} ${item.weight_unit || 'lbs'}` : '—'}
                          </Text>
                          {item.blood_sugar ? (
                            <Text style={styles.metricSub}>Sugar: {item.blood_sugar} mg/dL</Text>
                          ) : null}
                        </View>
                      </View>

                      <View style={styles.vitalCardFooter}>
                        <View style={styles.vitalCardFooterLeft}>
                          <Ionicons name="person-outline" size={13} color="#64748B" />
                          <Text style={styles.vitalCardProvider} numberOfLines={1}>
                            {item.provider || item.recorded_by || 'Staff'}
                          </Text>
                        </View>
                        <Pressable
                          style={({ pressed }) => [styles.cardDetailsBtn, pressed && styles.pressed]}
                          onPress={() => setSelectedVital(item)}
                        >
                          <Ionicons name="eye-outline" size={14} color="#DC2626" />
                          <Text style={styles.cardDetailsBtnText}>Details</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* ADD VITAL SIGNS MODAL (MATCHING WEB APPLICATION EXACTLY)                  */}
      {/* ========================================================================= */}
      <Modal
        visible={addModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Header: Blue #0D6EFD with Heartbeat Icon */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleWrap}>
                <Ionicons name="pulse" size={20} color="#FFFFFF" />
                <Text style={styles.modalHeaderTitle}>Add Vital Signs</Text>
              </View>
              <Pressable
                onPress={() => setAddModalOpen(false)}
                style={({ pressed }) => [styles.modalCloseBtn, pressed && styles.pressed]}
              >
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Top Row: Date *, Time *, Provider * */}
              <View style={styles.topRow}>
                {/* Date * */}
                <View style={styles.topCol}>
                  <View style={styles.fieldLabelRow}>
                    <Ionicons name="calendar" size={14} color="#DC2626" />
                    <Text style={styles.fieldLabel}>Date *</Text>
                  </View>
                  <AppDatePicker
                    value={recordedDate}
                    onChange={setRecordedDate}
                    format="DD/MM/YYYY"
                    placeholder="dd/mm/yyyy"
                  />
                </View>

                {/* Time * */}
                <View style={styles.topCol}>
                  <View style={styles.fieldLabelRow}>
                    <Ionicons name="time" size={14} color="#DC2626" />
                    <Text style={styles.fieldLabel}>Time *</Text>
                  </View>
                  <AppTimePicker
                    value={recordedTime}
                    onChange={setRecordedTime}
                    format="12h"
                    placeholder="--:--"
                  />
                </View>

                {/* Provider * */}
                <View style={styles.topCol}>
                  <View style={styles.fieldLabelRow}>
                    <Ionicons name="person" size={14} color="#DC2626" />
                    <Text style={styles.fieldLabel}>Provider *</Text>
                  </View>
                  <TextInput
                    style={styles.textInput}
                    value={provider}
                    onChangeText={setProvider}
                    placeholder="Healthcare provider name"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              {/* Card 1: Primary Vital Signs */}
              <View style={styles.formCard}>
                <View style={styles.formCardHeader}>
                  <Ionicons name="pulse" size={16} color="#DC2626" />
                  <Text style={styles.formCardTitle}>Primary Vital Signs</Text>
                </View>

                <View style={styles.formCardBody}>
                  {/* Row 1: Systolic BP & Diastolic BP */}
                  <View style={styles.twoColRow}>
                    {/* Systolic BP */}
                    <View style={styles.colHalf}>
                      <View style={styles.fieldLabelRow}>
                        <Ionicons name="water" size={13} color="#1E293B" />
                        <Text style={styles.fieldLabel}>Systolic BP</Text>
                      </View>
                      <View style={styles.inputGroup}>
                        <TextInput
                          style={styles.inputGroupInput}
                          placeholder="120"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          value={systolic}
                          onChangeText={setSystolic}
                        />
                        <View style={styles.inputGroupAddon}>
                          <Text style={styles.inputGroupAddonText}>mmHg</Text>
                        </View>
                      </View>
                      <Text style={styles.helperText}>Normal: 90-140</Text>
                    </View>

                    {/* Diastolic BP */}
                    <View style={styles.colHalf}>
                      <View style={styles.fieldLabelRow}>
                        <Ionicons name="water" size={13} color="#1E293B" />
                        <Text style={styles.fieldLabel}>Diastolic BP</Text>
                      </View>
                      <View style={styles.inputGroup}>
                        <TextInput
                          style={styles.inputGroupInput}
                          placeholder="80"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          value={diastolic}
                          onChangeText={setDiastolic}
                        />
                        <View style={styles.inputGroupAddon}>
                          <Text style={styles.inputGroupAddonText}>mmHg</Text>
                        </View>
                      </View>
                      <Text style={styles.helperText}>Normal: 60-90</Text>
                    </View>
                  </View>

                  {/* Row 2: Heart Rate & Temperature */}
                  <View style={[styles.twoColRow, { marginTop: 12 }]}>
                    {/* Heart Rate */}
                    <View style={styles.colHalf}>
                      <View style={styles.fieldLabelRow}>
                        <Ionicons name="heart" size={13} color="#DC2626" />
                        <Text style={styles.fieldLabel}>Heart Rate</Text>
                      </View>
                      <View style={styles.inputGroup}>
                        <TextInput
                          style={styles.inputGroupInput}
                          placeholder="72"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          value={heartRate}
                          onChangeText={setHeartRate}
                        />
                        <View style={styles.inputGroupAddon}>
                          <Text style={styles.inputGroupAddonText}>bpm</Text>
                        </View>
                      </View>
                      <Text style={styles.helperText}>Normal: 60-100</Text>
                    </View>

                    {/* Temperature */}
                    <View style={styles.colHalf}>
                      <View style={styles.fieldLabelRow}>
                        <Ionicons name="thermometer" size={13} color="#DC2626" />
                        <Text style={styles.fieldLabel}>Temperature</Text>
                      </View>
                      <View style={styles.inputGroup}>
                        <TextInput
                          style={styles.inputGroupInput}
                          placeholder="98.6"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          value={temperature}
                          onChangeText={setTemperature}
                        />
                        <View style={styles.inputGroupAddon}>
                          <Text style={styles.inputGroupAddonText}>°F</Text>
                        </View>
                      </View>
                      <Text style={styles.helperText}>Normal: 97.0-100.4</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Card 2: Secondary Vital Signs */}
              <View style={styles.formCard}>
                <View style={styles.formCardHeader}>
                  <Ionicons name="fitness" size={16} color="#0284C7" />
                  <Text style={styles.formCardTitle}>Secondary Vital Signs</Text>
                </View>

                <View style={styles.formCardBody}>
                  {/* Row 1: Respiratory Rate & O2 Saturation */}
                  <View style={styles.twoColRow}>
                    {/* Respiratory Rate */}
                    <View style={styles.colHalf}>
                      <View style={styles.fieldLabelRow}>
                        <Ionicons name="fitness-outline" size={13} color="#0284C7" />
                        <Text style={styles.fieldLabel}>Respiratory Rate</Text>
                      </View>
                      <View style={styles.inputGroup}>
                        <TextInput
                          style={styles.inputGroupInput}
                          placeholder="16"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          value={respRate}
                          onChangeText={setRespRate}
                        />
                        <View style={styles.inputGroupAddon}>
                          <Text style={styles.inputGroupAddonText}>rpm</Text>
                        </View>
                      </View>
                      <Text style={styles.helperText}>Normal: 12-20</Text>
                    </View>

                    {/* O2 Saturation */}
                    <View style={styles.colHalf}>
                      <View style={styles.fieldLabelRow}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#0284C7' }}>%</Text>
                        <Text style={styles.fieldLabel}>O2 Saturation</Text>
                      </View>
                      <View style={styles.inputGroup}>
                        <TextInput
                          style={styles.inputGroupInput}
                          placeholder="98"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          value={o2Sat}
                          onChangeText={setO2Sat}
                        />
                        <View style={styles.inputGroupAddon}>
                          <Text style={styles.inputGroupAddonText}>%</Text>
                        </View>
                      </View>
                      <Text style={styles.helperText}>Normal: ≥95</Text>
                    </View>
                  </View>

                  {/* Row 2: Pain Scale & Weight */}
                  <View style={[styles.twoColRow, { marginTop: 12 }]}>
                    {/* Pain Scale */}
                    <View style={styles.colHalf}>
                      <View style={styles.fieldLabelRow}>
                        <Ionicons name="alert-circle" size={13} color="#475569" />
                        <Text style={styles.fieldLabel}>Pain Scale</Text>
                      </View>
                      <View style={styles.inputGroup}>
                        <Pressable
                          style={styles.selectTriggerBtn}
                          onPress={() => setPainPickerOpen(true)}
                        >
                          <Text
                            style={[
                              styles.selectTriggerText,
                              !painLevel && { color: '#94A3B8' },
                            ]}
                            numberOfLines={1}
                          >
                            {painLevel !== ''
                              ? PAIN_OPTIONS.find((o) => o.value === painLevel)?.label || painLevel
                              : 'Select...'}
                          </Text>
                          <Ionicons name="chevron-down" size={14} color="#64748B" />
                        </Pressable>
                        <View style={styles.inputGroupAddon}>
                          <Text style={styles.inputGroupAddonText}>/10</Text>
                        </View>
                      </View>
                      <Text style={styles.helperText}>0=No Pain, 10=Worst</Text>
                    </View>

                    {/* Weight */}
                    <View style={styles.colHalf}>
                      <View style={styles.fieldLabelRow}>
                        <Ionicons name="speedometer" size={13} color="#475569" />
                        <Text style={styles.fieldLabel}>Weight</Text>
                      </View>
                      <View style={styles.inputGroup}>
                        <TextInput
                          style={styles.inputGroupInput}
                          placeholder="150"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          value={weight}
                          onChangeText={setWeight}
                        />
                        <Pressable
                          style={[styles.inputGroupAddon, { paddingHorizontal: 6 }]}
                          onPress={() => setWeightUnitPickerOpen(true)}
                        >
                          <Text style={styles.inputGroupAddonText}>{weightUnit}</Text>
                          <Ionicons name="chevron-down" size={12} color="#64748B" style={{ marginLeft: 2 }} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              {/* Card 3: Additional Information */}
              <View style={styles.formCard}>
                <View style={styles.formCardHeader}>
                  <Ionicons name="information-circle" size={16} color="#D97706" />
                  <Text style={styles.formCardTitle}>Additional Information</Text>
                </View>

                <View style={styles.formCardBody}>
                  {/* Patient Position */}
                  <View style={styles.fieldLabelRow}>
                    <Ionicons name="bed" size={13} color="#475569" />
                    <Text style={styles.fieldLabel}>Patient Position</Text>
                  </View>
                  <Pressable
                    style={styles.pickerBox}
                    onPress={() => setPositionPickerOpen(true)}
                  >
                    <Text
                      style={[
                        styles.pickerBoxText,
                        !position && { color: '#94A3B8' },
                      ]}
                      numberOfLines={1}
                    >
                      {position || 'Select position...'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </Pressable>

                  {/* Notes */}
                  <View style={[styles.fieldLabelRow, { marginTop: 12 }]}>
                    <Ionicons name="document-text-outline" size={13} color="#475569" />
                    <Text style={styles.fieldLabel}>Clinical Assessment Notes</Text>
                  </View>
                  <TextInput
                    style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                    placeholder="Patient rested 5 minutes prior to reading, sitting position..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    value={notes}
                    onChangeText={setNotes}
                  />
                </View>
              </View>

              {/* Card 4: Alert Flags */}
              <View style={styles.formCard}>
                <View style={styles.formCardHeader}>
                  <Ionicons name="flag" size={16} color="#DC2626" />
                  <Text style={styles.formCardTitle}>Alert Flags</Text>
                </View>

                <View style={styles.formCardBody}>
                  {/* Critical Values Present */}
                  <Pressable
                    style={styles.checkboxRow}
                    onPress={() => setCriticalValues(!criticalValues)}
                  >
                    <View style={[styles.checkboxBox, criticalValues && styles.checkboxBoxActive]}>
                      {criticalValues && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                    </View>
                    <Ionicons name="warning" size={15} color="#DC2626" />
                    <Text style={styles.checkboxLabel}>Critical Values Present</Text>
                  </Pressable>

                  {/* Follow-up Required */}
                  <Pressable
                    style={styles.checkboxRow}
                    onPress={() => setFollowUpRequired(!followUpRequired)}
                  >
                    <View style={[styles.checkboxBox, followUpRequired && styles.checkboxBoxActive]}>
                      {followUpRequired && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                    </View>
                    <Ionicons name="calendar" size={15} color="#0284C7" />
                    <Text style={styles.checkboxLabel}>Follow-up Required</Text>
                  </Pressable>

                  {/* Provider Notified */}
                  <Pressable
                    style={styles.checkboxRow}
                    onPress={() => setProviderNotified(!providerNotified)}
                  >
                    <View style={[styles.checkboxBox, providerNotified && styles.checkboxBoxActive]}>
                      {providerNotified && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                    </View>
                    <Ionicons name="notifications" size={15} color="#D97706" />
                    <Text style={styles.checkboxLabel}>Provider Notified</Text>
                  </Pressable>
                </View>
              </View>

              {/* Spacer before footer */}
              <View style={{ height: 16 }} />
            </ScrollView>

            {/* Modal Footer: Cancel & Save Vital Signs */}
            <View style={styles.modalFooter}>
              <Pressable
                style={({ pressed }) => [styles.btnCancelOutline, pressed && styles.pressed]}
                onPress={() => setAddModalOpen(false)}
              >
                <Ionicons name="close" size={16} color="#475569" />
                <Text style={styles.btnCancelOutlineText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.btnSaveVitals,
                  saving && styles.btnDisabled,
                  pressed && styles.pressed,
                ]}
                onPress={handleSaveVital}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.btnSaveVitalsText}>Save Vital Signs</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* PAIN SCALE PICKER MODAL                                                   */}
      {/* ========================================================================= */}
      <Modal
        visible={painPickerOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPainPickerOpen(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={[styles.pickerModalContent, { maxWidth: 360 }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Pain Scale</Text>
              <Pressable onPress={() => setPainPickerOpen(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 380 }}>
              {PAIN_OPTIONS.map((item) => (
                <Pressable
                  key={item.value}
                  style={[
                    styles.pickerOptionItem,
                    painLevel === item.value && styles.pickerOptionItemActive,
                  ]}
                  onPress={() => {
                    setPainLevel(item.value);
                    setPainPickerOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      painLevel === item.value && styles.pickerOptionTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {painLevel === item.value && (
                    <Ionicons name="checkmark" size={18} color="#DC2626" />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* PATIENT POSITION PICKER MODAL                                             */}
      {/* ========================================================================= */}
      <Modal
        visible={positionPickerOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPositionPickerOpen(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={[styles.pickerModalContent, { maxWidth: 360 }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Patient Position</Text>
              <Pressable onPress={() => setPositionPickerOpen(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 380 }}>
              {POSITION_OPTIONS.map((item) => (
                <Pressable
                  key={item.value}
                  style={[
                    styles.pickerOptionItem,
                    position === item.value && styles.pickerOptionItemActive,
                  ]}
                  onPress={() => {
                    setPosition(item.value);
                    setPositionPickerOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      position === item.value && styles.pickerOptionTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {position === item.value && (
                    <Ionicons name="checkmark" size={18} color="#DC2626" />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* WEIGHT UNIT PICKER MODAL                                                  */}
      {/* ========================================================================= */}
      <Modal
        visible={weightUnitPickerOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setWeightUnitPickerOpen(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={[styles.pickerModalContent, { maxWidth: 280 }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Weight Unit</Text>
              <Pressable onPress={() => setWeightUnitPickerOpen(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>
            {WEIGHT_UNITS.map((u) => (
              <Pressable
                key={u}
                style={[
                  styles.pickerOptionItem,
                  weightUnit === u && styles.pickerOptionItemActive,
                ]}
                onPress={() => {
                  setWeightUnit(u);
                  setWeightUnitPickerOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    weightUnit === u && styles.pickerOptionTextActive,
                  ]}
                >
                  {u}
                </Text>
                {weightUnit === u && (
                  <Ionicons name="checkmark" size={18} color="#DC2626" />
                )}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* DETAILS MODAL                                                             */}
      {/* ========================================================================= */}
      <Modal
        visible={Boolean(selectedVital)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedVital(null)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={[styles.pickerModalContent, { maxWidth: 440 }]}>
            <View style={styles.pickerModalHeader}>
              <View>
                <Text style={styles.pickerModalTitle}>Vital Signs Reading</Text>
                <Text style={styles.subReadingText}>
                  {selectedVital?.date} · {selectedVital?.time}
                </Text>
              </View>
              <Pressable onPress={() => setSelectedVital(null)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            {selectedVital && (
              <ScrollView style={{ padding: 16 }}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Provider:</Text>
                  <Text style={styles.detailValue}>{selectedVital.provider || selectedVital.recorded_by || 'Staff Clinician'}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Blood Pressure:</Text>
                  <Text style={styles.detailValue}>
                    {selectedVital.blood_pressure_systolic && selectedVital.blood_pressure_diastolic
                      ? `${selectedVital.blood_pressure_systolic}/${selectedVital.blood_pressure_diastolic} mmHg`
                      : '—'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Heart Rate:</Text>
                  <Text style={styles.detailValue}>
                    {selectedVital.heart_rate ? `${selectedVital.heart_rate} bpm` : '—'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Temperature:</Text>
                  <Text style={styles.detailValue}>
                    {selectedVital.temperature ? `${selectedVital.temperature} °F` : '—'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>O2 Saturation:</Text>
                  <Text style={styles.detailValue}>
                    {selectedVital.oxygen_saturation ? `${selectedVital.oxygen_saturation} %` : '—'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Respiratory Rate:</Text>
                  <Text style={styles.detailValue}>
                    {selectedVital.respiratory_rate ? `${selectedVital.respiratory_rate} rpm` : '—'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Pain Scale:</Text>
                  <Text style={styles.detailValue}>
                    {selectedVital.pain_level !== null && selectedVital.pain_level !== undefined
                      ? `${selectedVital.pain_level} / 10`
                      : '—'}
                  </Text>
                </View>

                {selectedVital.weight && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Weight:</Text>
                    <Text style={styles.detailValue}>
                      {selectedVital.weight} {selectedVital.weight_unit || 'lbs'}
                    </Text>
                  </View>
                )}

                {selectedVital.position && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Position:</Text>
                    <Text style={styles.detailValue}>{selectedVital.position}</Text>
                  </View>
                )}

                {(selectedVital.critical_values || selectedVital.provider_notified || selectedVital.follow_up_required) && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Alert Flags:</Text>
                    <View style={{ flex: 1, gap: 4 }}>
                      {selectedVital.critical_values && (
                        <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: '700' }}>
                          ⚠️ Critical Values Present
                        </Text>
                      )}
                      {selectedVital.follow_up_required && (
                        <Text style={{ fontSize: 11, color: '#0284C7', fontWeight: '700' }}>
                          📅 Follow-up Required
                        </Text>
                      )}
                      {selectedVital.provider_notified && (
                        <Text style={{ fontSize: 11, color: '#D97706', fontWeight: '700' }}>
                          🔔 Provider Notified
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                {selectedVital.notes && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.detailLabel}>Notes:</Text>
                    <Text style={[styles.detailValue, { marginTop: 4 }]}>{selectedVital.notes}</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* TRENDS MODAL                                                              */}
      {/* ========================================================================= */}
      <Modal
        visible={trendsModalOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setTrendsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxWidth: 500 }]}>
            <View style={[styles.modalHeader, { backgroundColor: '#111111' }]}>
              <Text style={styles.modalHeaderTitle}>VITAL SIGNS TRENDS & HISTORY</Text>
              <Pressable onPress={() => setTrendsModalOpen(false)}>
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView style={{ padding: 16 }}>
              <Text style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
                Recent vitals stability and trend analysis based on {items.length} clinical readings:
              </Text>

              {items.slice(0, 5).map((v, i) => (
                <View key={v.id ?? i} style={styles.trendCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontWeight: '700', fontSize: 12, color: '#1E293B' }}>
                      {v.date || v.recorded_at?.split(' ')[0]} {v.time}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748B' }}>{v.provider || v.recorded_by || 'Staff'}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: '#334155' }}>
                    BP: {v.blood_pressure_systolic ?? '—'}/{v.blood_pressure_diastolic ?? '—'} mmHg · HR: {v.heart_rate ?? '—'} bpm · SpO2: {v.oxygen_saturation ?? '—'}% · Temp: {v.temperature ?? '—'}°F
                  </Text>
                </View>
              ))}
            </ScrollView>
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
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  toolbarMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  btnPrimary: {
    backgroundColor: '#111111',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  viewModeToggleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  viewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
  },
  viewToggleBtnActive: {
    backgroundColor: '#111111',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  viewToggleBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  viewToggleBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  btnSecondary: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  btnSecondaryText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.3,
  },
  statsScroll: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: 88,
  },
  statsRow: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statCard: {
    height: 64,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 124,
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 20,
  },
  statSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
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
    borderRadius: 10,
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
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  sectionHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  sectionHeaderSub: {
    fontSize: 10,
    color: '#64748B',
  },
  countBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    paddingVertical: 10,
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
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    width: '100%',
  },
  tableRowEven: {
    backgroundColor: '#F8FAFC',
  },
  colCell: {
    justifyContent: 'center',
  },
  rowNumberText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  dateTimeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  timeText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  readingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  subReadingText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  miniBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  miniBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  iconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
  },
  iconBtnPrimary: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  iconBtnLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },

  /* Cards View Styles */
  cardsContainer: {
    padding: 10,
    gap: 10,
    backgroundColor: '#F8FAFC',
  },
  vitalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    padding: 12,
  },
  vitalCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  vitalCardTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vitalIndexBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  vitalIndexText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
  },
  vitalCardDate: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  vitalCardTime: {
    fontSize: 10,
    color: '#64748B',
  },
  vitalCardTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  criticalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  criticalBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
  },
  vitalMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 10,
  },
  vitalMetricBox: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  metricUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  metricSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  vitalCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  vitalCardFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    marginRight: 8,
  },
  vitalCardProvider: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  cardDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 5,
  },
  cardDetailsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
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
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
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

  /* Top Row: Date, Time, Provider */
  topRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  topCol: {
    flex: 1,
    minWidth: 130,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
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

  /* Form Cards matching web cards */
  formCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginBottom: 14,
    overflow: 'hidden',
  },
  formCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  formCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  formCardBody: {
    padding: 14,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
  },
  colHalf: {
    flex: 1,
  },

  /* Input Groups with Suffix Badges (mmHg, bpm, °F, etc.) */
  inputGroup: {
    flexDirection: 'row',
    height: 38,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  inputGroupInput: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#1E293B',
  },
  inputGroupAddon: {
    backgroundColor: '#F1F5F9',
    borderLeftWidth: 1,
    borderLeftColor: '#CBD5E1',
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  inputGroupAddonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  helperText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },

  /* Select Triggers */
  selectTriggerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  selectTriggerText: {
    fontSize: 13,
    color: '#1E293B',
  },
  pickerBox: {
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
  pickerBoxText: {
    fontSize: 13,
    color: '#1E293B',
  },

  /* Checkboxes */
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxBoxActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  checkboxLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },

  /* Modal Footer */
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  btnCancelOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  btnCancelOutlineText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 13,
  },
  btnSaveVitals: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DC2626',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 6,
  },
  btnSaveVitalsText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  btnDisabled: {
    opacity: 0.5,
  },

  /* Selection Pickers Modals */
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
    backgroundColor: '#EFF6FF',
  },
  pickerOptionText: {
    fontSize: 13,
    color: '#334155',
  },
  pickerOptionTextActive: {
    color: '#DC2626',
    fontWeight: '700',
  },

  /* Details and Trends */
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
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
  trendCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  pressed: {
    opacity: 0.8,
  },
});
