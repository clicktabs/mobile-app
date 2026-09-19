import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { showAlert, confirmAction } from '../utils/confirm';
import { useAuth } from '../context/AuthContext';
import * as staffApi from '../api/staff';
import { AppDatePicker, AppTimePicker } from './AppDatePicker';
import {
  getTodayDisplayDate,
  getCurrent12hTime,
  toDisplayDate,
  toIsoDate,
} from '../utils/dateTimeUtils';

export type CommNoteItem = {
  id?: number | string;
  raw_id?: number | string;
  note?: string;
  note_content?: string;
  content?: string;
  type?: string;
  patient_status?: string;
  episode_id?: number | string;
  episode_number?: string;
  physician_id?: number | string;
  physician_name?: string;
  physician_spec?: string;
  physician_npi?: string;
  send_as_message?: boolean;
  signature_date?: string;
  signature_time?: string;
  signed_by?: string;
  signed_at?: string;
  created_by?: string;
  created_at?: string;
  date?: string;
  status?: string;
};

type Props = {
  patientId: number;
  token: string;
  patient: Record<string, any> | null;
  items: CommNoteItem[];
  onRefresh: () => void;
  loading?: boolean;
};

const PATIENT_STATUS_OPTIONS = ['Active', 'Inactive', 'Discharged'] as const;

export function PatientCommNotesView({
  patientId,
  token,
  patient,
  items,
  onRefresh,
  loading,
}: Props) {
  const { staffUser } = useAuth();

  // Add / Create Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [noteDate, setNoteDate] = useState(getTodayDisplayDate);
  const [patientStatus, setPatientStatus] = useState<'Active' | 'Inactive' | 'Discharged'>('Active');
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);

  // Episode state
  const [episodes, setEpisodes] = useState<staffApi.PatientEpisodeItem[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | number>('1');
  const [episodePickerOpen, setEpisodePickerOpen] = useState(false);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  // Physician state
  const [physicians, setPhysicians] = useState<staffApi.PhysicianItem[]>([]);
  const [physicianSearch, setPhysicianSearch] = useState('');
  const [selectedPhysician, setSelectedPhysician] = useState<staffApi.PhysicianItem | null>(null);
  const [physicianDropdownOpen, setPhysicianDropdownOpen] = useState(false);
  const [loadingPhysicians, setLoadingPhysicians] = useState(false);

  // New Physician Modal
  const [newPhysicianModalOpen, setNewPhysicianModalOpen] = useState(false);
  const [newPhyFirstName, setNewPhyFirstName] = useState('');
  const [newPhyLastName, setNewPhyLastName] = useState('');
  const [newPhySpecialty, setNewPhySpecialty] = useState('');
  const [newPhyNpi, setNewPhyNpi] = useState('');
  const [newPhyPhone, setNewPhyPhone] = useState('');
  const [savingPhysician, setSavingPhysician] = useState(false);

  // Note text & Voice dictation
  const [noteContent, setNoteContent] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const speechRecRef = useRef<any>(null);

  // Send as message toggle
  const [sendAsMessage, setSendAsMessage] = useState(false);

  // Electronic Signature
  const [pin, setPin] = useState('');
  const [pinVerified, setPinVerified] = useState(false);
  const [pinVerifying, setPinVerifying] = useState(false);
  const [pinFeedback, setPinFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const [signatureDate, setSignatureDate] = useState(getTodayDisplayDate);
  const [signatureTime, setSignatureTime] = useState(getCurrent12hTime);

  // Detail Modal
  const [selectedNote, setSelectedNote] = useState<CommNoteItem | null>(null);

  // Saving state
  const [saving, setSaving] = useState(false);

  const patientFullName = useMemo(() => {
    if (!patient) return 'Aladdin Mccarty';
    return (
      patient.full_name ||
      patient.name ||
      `${patient.first_name || ''} ${patient.last_name || ''}`.trim() ||
      'Aladdin Mccarty'
    );
  }, [patient]);

  // Load episodes & physicians when opening modal
  const handleOpenAddModal = async () => {
    setNoteDate(getTodayDisplayDate());
    setPatientStatus('Active');
    setNoteContent('');
    setSendAsMessage(false);
    setPin('');
    setPinVerified(false);
    setPinFeedback(null);
    setSignatureDate(getTodayDisplayDate());
    setSignatureTime(getCurrent12hTime());
    setSelectedPhysician(null);
    setPhysicianSearch('');
    setIsRecording(false);
    setModalOpen(true);

    // Fetch episodes
    try {
      setLoadingEpisodes(true);
      const epRes = await staffApi.getPatientEpisodes(token, patientId);
      if (epRes?.success && epRes.data && epRes.data.length > 0) {
        setEpisodes(epRes.data);
        setSelectedEpisodeId(epRes.data[0].id);
      } else {
        setEpisodes([]);
        setSelectedEpisodeId('1');
      }
    } catch {
      setSelectedEpisodeId('1');
    } finally {
      setLoadingEpisodes(false);
    }

    // Fetch physicians
    try {
      setLoadingPhysicians(true);
      const phyRes = await staffApi.getPhysicians(token);
      if (phyRes?.success && phyRes.data) {
        setPhysicians(phyRes.data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingPhysicians(false);
    }
  };

  // Voice Dictation
  const handleToggleDictation = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      showAlert('Notice', 'Voice dictation is supported in Chrome or Edge browser.');
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      showAlert('Notice', 'Speech recognition is not supported in this browser.');
      return;
    }

    if (isRecording) {
      try {
        speechRecRef.current?.stop();
      } catch {}
      speechRecRef.current = null;
      setIsRecording(false);
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      let baseText = noteContent;
      rec.onresult = (e: any) => {
        let interim = '';
        let final = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0]?.transcript || '';
          if (e.results[i].isFinal) {
            final += t + ' ';
          } else {
            interim += t;
          }
        }
        if (final) baseText += final;
        setNoteContent(baseText + interim);
      };

      rec.onerror = () => {
        setIsRecording(false);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      speechRecRef.current = rec;
      rec.start();
      setIsRecording(true);
    } catch {
      setIsRecording(false);
    }
  };

  // Verify PIN
  const handleVerifyPin = async () => {
    if (!pin || pin.length < 4) {
      setPinFeedback({ text: 'PIN must be at least 4 digits.', error: true });
      return;
    }
    setPinVerifying(true);
    setPinFeedback(null);
    try {
      const res = await staffApi.verifySignaturePin(token, pin);
      if (res?.success) {
        setPinVerified(true);
        setPinFeedback({ text: 'PIN verified — ready to sign', error: false });
      } else {
        setPinVerified(false);
        setPinFeedback({
          text: res?.message || 'Invalid PIN. 4 attempts remaining.',
          error: true,
        });
      }
    } catch (e: any) {
      setPinVerified(false);
      setPinFeedback({
        text: e?.message || 'Invalid PIN. 4 attempts remaining.',
        error: true,
      });
    } finally {
      setPinVerifying(false);
    }
  };

  // Submit Note
  const handleSubmitNote = async (status: 'draft' | 'completed') => {
    if (!noteContent.trim()) {
      showAlert('Required', 'Please enter the communication note content before saving.');
      return;
    }

    if (status === 'completed' && !pinVerified) {
      showAlert('PIN Required', 'Please verify your signature PIN before completing the note.');
      return;
    }

    setSaving(true);
    try {
      const res = await staffApi.createCommNote(token, patientId, {
        note_content: noteContent.trim(),
        patient_status: patientStatus.toLowerCase(),
        episode_id: selectedEpisodeId,
        physician_id: selectedPhysician?.id,
        note_date: toIsoDate(noteDate) || undefined,
        send_as_message: sendAsMessage,
        status,
        signature_pin: pin,
        signature_date: toIsoDate(signatureDate) || undefined,
        signature_time: signatureTime,
      });

      if (res?.success) {
        setModalOpen(false);
        onRefresh();
        showAlert(
          'Success',
          status === 'completed'
            ? 'Communication note completed and signed successfully.'
            : 'Communication note saved as draft.'
        );
      } else {
        showAlert('Error', res?.message || 'Failed to save communication note.');
      }
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to save communication note.');
    } finally {
      setSaving(false);
    }
  };

  // Quick Add Physician
  const handleSaveNewPhysician = async () => {
    if (!newPhyFirstName.trim() || !newPhyLastName.trim()) {
      showAlert('Required', 'First and last name are required for the physician.');
      return;
    }
    setSavingPhysician(true);
    try {
      const res = await staffApi.createPhysician(token, {
        first_name: newPhyFirstName.trim(),
        last_name: newPhyLastName.trim(),
        specialty: newPhySpecialty.trim() || undefined,
        npi_number: newPhyNpi.trim() || undefined,
        phone: newPhyPhone.trim() || undefined,
      });

      if (res?.success && res.data) {
        const added = res.data;
        setPhysicians((prev) => [added, ...prev]);
        setSelectedPhysician(added);
        setPhysicianSearch(added.name);
        setNewPhysicianModalOpen(false);
        setNewPhyFirstName('');
        setNewPhyLastName('');
        setNewPhySpecialty('');
        setNewPhyNpi('');
        setNewPhyPhone('');
        showAlert('Success', 'Physician added and selected.');
      } else {
        showAlert('Error', res?.message || 'Failed to create physician.');
      }
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to create physician.');
    } finally {
      setSavingPhysician(false);
    }
  };

  // Delete Note
  const handleDeleteNote = async (note: CommNoteItem) => {
    const id = note.raw_id || String(note.id || '').replace('note-', '');
    const ok = await confirmAction(
      'Delete Communication Note',
      'Are you sure you want to delete this communication note? This cannot be undone.',
      { destructive: true }
    );
    if (!ok) return;

    try {
      const res = await staffApi.deleteCommNote(token, patientId, id);
      if (res?.success) {
        onRefresh();
        showAlert('Deleted', 'Communication note deleted successfully.');
      } else {
        showAlert('Error', res?.message || 'Failed to delete communication note.');
      }
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to delete communication note.');
    }
  };

  // Filtered physicians for search
  const filteredPhysicians = useMemo(() => {
    const q = physicianSearch.trim().toLowerCase();
    if (!q) return physicians.slice(0, 8);
    return physicians
      .filter((p) => {
        return (
          (p.name || '').toLowerCase().includes(q) ||
          (p.specialty || '').toLowerCase().includes(q) ||
          (p.npi || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 10);
  }, [physicians, physicianSearch]);

  const charCount = noteContent.length;
  const charRemaining = Math.max(0, 5000 - charCount);
  const charPct = Math.min(100, (charCount / 5000) * 100);

  return (
    <View style={styles.container}>
      {/* Top Banner Toolbar */}
      <View style={styles.bannerHeader}>
        <View style={styles.bannerTitleGroup}>
          <Ionicons name="chatbubbles" size={18} color="#FFFFFF" />
          <Text style={styles.bannerTitleText}>Communication Notes</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.bannerAddBtn, pressed && styles.pressed]}
          onPress={handleOpenAddModal}
        >
          <Ionicons name="add-circle" size={16} color="#FFFFFF" />
          <Text style={styles.bannerAddBtnText}>NEW NOTE</Text>
        </Pressable>
      </View>

      {/* Main Content Area */}
      {loading ? (
        <View style={styles.centerArea}>
          <ActivityIndicator size="large" color="#DC2626" />
          <Text style={styles.loadingText}>Loading communication notes...</Text>
        </View>
      ) : items.length === 0 ? (
        /* Empty State matching second screenshot */
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="chatbubble-ellipses-outline" size={54} color="#94A3B8" />
            <View style={styles.emptySlashLine} />
          </View>
          <Text style={styles.emptyMessageText}>
            No communication notes on file for this patient.
          </Text>
          <Pressable
            style={styles.emptyActionBtn}
            onPress={handleOpenAddModal}
          >
            <Ionicons name="add" size={16} color="#DC2626" />
            <Text style={styles.emptyActionText}>New Communication Note</Text>
          </Pressable>
        </View>
      ) : (
        /* Data Table */
        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
          <View style={styles.tableContainer}>
            {/* Header */}
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.thText, { width: 45 }]}>#</Text>
              <Text style={[styles.thText, { width: 110 }]}>DATE</Text>
              <Text style={[styles.thText, { width: 140 }]}>AUTHOR</Text>
              <Text style={[styles.thText, { width: 140 }]}>PHYSICIAN</Text>
              <Text style={[styles.thText, { width: 90 }]}>EPISODE</Text>
              <Text style={[styles.thText, { width: 280 }]}>NOTE CONTENT</Text>
              <Text style={[styles.thText, { width: 100 }]}>STATUS</Text>
              <Text style={[styles.thText, { width: 90, textAlign: 'center' }]}>ACTIONS</Text>
            </View>

            {/* Rows */}
            <ScrollView style={{ maxHeight: 600 }}>
              {items.map((note, idx) => {
                const isDraft = (note.status || '').toLowerCase() === 'draft';
                const dateDisplay = note.date || note.created_at?.split('T')[0] || '—';
                const textSnippet = note.note_content || note.note || note.content || '—';

                return (
                  <View key={note.id || idx} style={styles.tableDataRow}>
                    <Text style={[styles.tdText, { width: 45 }]}>{idx + 1}</Text>
                    <Text style={[styles.tdText, { width: 110, fontWeight: '600' }]}>
                      {dateDisplay}
                    </Text>
                    <Text style={[styles.tdText, { width: 140 }]} numberOfLines={1}>
                      {note.created_by || staffUser?.name || 'Staff'}
                    </Text>
                    <Text style={[styles.tdText, { width: 140 }]} numberOfLines={1}>
                      {note.physician_name || '—'}
                    </Text>
                    <Text style={[styles.tdText, { width: 90 }]}>
                      {note.episode_number || (note.episode_id ? `#${note.episode_id}` : '1')}
                    </Text>
                    <Text style={[styles.tdText, { width: 280 }]} numberOfLines={2}>
                      {textSnippet}
                    </Text>
                    <View style={{ width: 100 }}>
                      <View
                        style={[
                          styles.statusBadge,
                          isDraft ? styles.statusBadgeDraft : styles.statusBadgeCompleted,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            isDraft ? styles.statusBadgeTextDraft : styles.statusBadgeTextCompleted,
                          ]}
                        >
                          {isDraft ? 'DRAFT' : 'COMPLETED'}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.actionsCell, { width: 90 }]}>
                      <Pressable
                        style={styles.actionIconBtn}
                        onPress={() => setSelectedNote(note)}
                        hitSlop={6}
                      >
                        <Ionicons name="eye-outline" size={16} color="#DC2626" />
                      </Pressable>
                      <Pressable
                        style={styles.actionIconBtn}
                        onPress={() => handleDeleteNote(note)}
                        hitSlop={6}
                      >
                        <Ionicons name="trash-outline" size={16} color="#DC2626" />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT COMMUNICATION NOTE MODAL (Matches Screenshot 1) */}
      {/* ========================================================================= */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="chatbubbles" size={20} color="#FFFFFF" />
                <Text style={styles.modalTitle}>Communication Note</Text>
              </View>
              <Pressable onPress={() => setModalOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScrollBody} showsVerticalScrollIndicator={false}>
              {/* Row 1: Patient Information & Attending Physician */}
              <View style={styles.twoCardRow}>
                {/* Card 1: Patient Information */}
                <View style={styles.sectionCard}>
                  <View style={styles.sectionCardHeader}>
                    <Ionicons name="person" size={15} color="#FFFFFF" />
                    <Text style={styles.sectionCardTitle}>Patient Information</Text>
                  </View>
                  <View style={styles.sectionCardBody}>
                    <View style={styles.twoColRow}>
                      {/* Patient Name */}
                      <View style={styles.colHalf}>
                        <Text style={styles.fieldLabel}>PATIENT NAME</Text>
                        <TextInput
                          style={[styles.inputBox, styles.inputBoxReadonly]}
                          value={patientFullName}
                          editable={false}
                        />
                      </View>

                      {/* Date * */}
                      <View style={styles.colHalf}>
                        <Text style={styles.fieldLabel}>
                          DATE <Text style={{ color: '#DC2626' }}>*</Text>
                        </Text>
                        <AppDatePicker
                          value={noteDate}
                          onChange={setNoteDate}
                          format="DD/MM/YYYY"
                          placeholder="dd/mm/yyyy"
                        />
                      </View>
                    </View>

                    <View style={[styles.twoColRow, { marginTop: 12 }]}>
                      {/* Patient Status * */}
                      <View style={styles.colHalf}>
                        <Text style={styles.fieldLabel}>
                          PATIENT STATUS <Text style={{ color: '#DC2626' }}>*</Text>
                        </Text>
                        <Pressable
                          style={styles.selectBox}
                          onPress={() => setStatusPickerOpen(true)}
                        >
                          <Text style={styles.selectBoxText}>{patientStatus}</Text>
                          <Ionicons name="chevron-down" size={15} color="#64748B" />
                        </Pressable>
                      </View>

                      {/* Episode Associated * */}
                      <View style={styles.colHalf}>
                        <Text style={styles.fieldLabel}>
                          EPISODE ASSOCIATED <Text style={{ color: '#DC2626' }}>*</Text>
                        </Text>
                        <Pressable
                          style={styles.selectBox}
                          onPress={() => setEpisodePickerOpen(true)}
                        >
                          <Text style={styles.selectBoxText}>
                            {episodes.find((e) => String(e.id) === String(selectedEpisodeId))
                              ?.episode_number || selectedEpisodeId || '1'}
                          </Text>
                          <Ionicons name="chevron-down" size={15} color="#64748B" />
                        </Pressable>
                        <Text style={styles.episodeHintText}>Active episode loaded.</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Card 2: Attending Physician */}
                <View style={styles.sectionCard}>
                  <View style={styles.sectionCardHeader}>
                    <Ionicons name="medkit" size={15} color="#FFFFFF" />
                    <Text style={styles.sectionCardTitle}>Attending Physician</Text>
                  </View>
                  <View style={styles.sectionCardBody}>
                    <Text style={styles.fieldLabel}>SEARCH PHYSICIAN</Text>
                    <View style={styles.searchWrap}>
                      <Ionicons name="search" size={15} color="#64748B" style={styles.searchIcon} />
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Name, NPI, or specialty..."
                        placeholderTextColor="#94A3B8"
                        value={physicianSearch}
                        onChangeText={(t) => {
                          setPhysicianSearch(t);
                          setPhysicianDropdownOpen(true);
                        }}
                        onFocus={() => setPhysicianDropdownOpen(true)}
                      />
                      {Boolean(physicianSearch || selectedPhysician) && (
                        <Pressable
                          onPress={() => {
                            setPhysicianSearch('');
                            setSelectedPhysician(null);
                            setPhysicianDropdownOpen(false);
                          }}
                          hitSlop={6}
                        >
                          <Ionicons name="close-circle" size={16} color="#94A3B8" />
                        </Pressable>
                      )}
                    </View>

                    {/* Autocomplete Dropdown */}
                    {physicianDropdownOpen && (
                      <View style={styles.physicianDropdown}>
                        <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
                          {filteredPhysicians.length > 0 ? (
                            filteredPhysicians.map((p) => (
                              <Pressable
                                key={p.id}
                                style={styles.physicianItem}
                                onPress={() => {
                                  setSelectedPhysician(p);
                                  setPhysicianSearch(p.name);
                                  setPhysicianDropdownOpen(false);
                                }}
                              >
                                <Text style={styles.physicianItemName}>{p.name}</Text>
                                <Text style={styles.physicianItemMeta}>
                                  {[p.specialty, p.npi ? `NPI: ${p.npi}` : ''].filter(Boolean).join(' · ')}
                                </Text>
                              </Pressable>
                            ))
                          ) : (
                            <View style={{ padding: 10 }}>
                              <Text style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>
                                No physicians found
                              </Text>
                            </View>
                          )}
                        </ScrollView>
                      </View>
                    )}

                    {/* Selected Physician Badge */}
                    {selectedPhysician && (
                      <View style={styles.physicianChip}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.physicianChipName}>{selectedPhysician.name}</Text>
                          <Text style={styles.physicianChipMeta}>
                            {[selectedPhysician.specialty, selectedPhysician.npi ? `NPI: ${selectedPhysician.npi}` : '']
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                        </View>
                        <Ionicons name="checkmark-circle" size={18} color="#DC2626" />
                      </View>
                    )}

                    <Text style={styles.helperTextItalic}>Type at least 1 character to search</Text>

                    {/* + New Physician Link */}
                    <Pressable
                      style={styles.newPhysicianBtn}
                      onPress={() => setNewPhysicianModalOpen(true)}
                    >
                      <Ionicons name="add" size={16} color="#475569" />
                      <Text style={styles.newPhysicianBtnText}>New Physician</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* Section 2: Communication Text Card */}
              <View style={[styles.sectionCard, { marginTop: 16 }]}>
                <View style={[styles.sectionCardHeader, { justifyContent: 'space-between' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="document-text" size={16} color="#FFFFFF" />
                    <Text style={styles.sectionCardTitle}>Communication Text</Text>
                  </View>

                  <Pressable
                    style={[
                      styles.dictateBtn,
                      isRecording && styles.dictateBtnActive,
                    ]}
                    onPress={handleToggleDictation}
                  >
                    <Ionicons
                      name={isRecording ? 'stop-circle' : 'mic'}
                      size={15}
                      color={isRecording ? '#FFFFFF' : '#DC2626'}
                    />
                    <Text
                      style={[
                        styles.dictateBtnText,
                        isRecording && styles.dictateBtnTextActive,
                      ]}
                    >
                      {isRecording ? 'Stop' : 'Dictate'}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.sectionCardBody}>
                  {/* Voice recording in progress banner */}
                  {isRecording && (
                    <View style={styles.recordingBanner}>
                      <View style={styles.recordingDot} />
                      <Text style={styles.recordingBannerText}>
                        Recording in progress — speak clearly
                      </Text>
                    </View>
                  )}

                  <Text style={styles.fieldLabel}>
                    NOTE CONTENT <Text style={{ color: '#DC2626' }}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.textArea}
                    placeholder="Type your communication note here, or click Dictate to use your microphone..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    maxLength={5000}
                    value={noteContent}
                    onChangeText={setNoteContent}
                  />

                  {/* Character progress bar */}
                  <View style={styles.charBarWrap}>
                    <View
                      style={[
                        styles.charBarFill,
                        {
                          width: `${charPct}%`,
                          backgroundColor:
                            charPct > 90 ? '#EF4444' : charPct > 70 ? '#F59E0B' : '#DC2626',
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.charCountRow}>
                    <Text style={styles.charCountText}>
                      {charCount.toLocaleString()} / 5,000 characters
                    </Text>
                    <Text style={styles.charCountText}>
                      {charRemaining.toLocaleString()} remaining
                    </Text>
                  </View>
                </View>
              </View>

              {/* Section 3: Send note as Message Card */}
              <View style={styles.sendAsMessageCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <Ionicons name="paper-plane" size={18} color="#DC2626" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sendAsMessageTitle}>Send note as Message</Text>
                    <Text style={styles.sendAsMessageSubtitle}>
                      Deliver this note as an internal message to the care team
                    </Text>
                  </View>
                </View>

                <Pressable
                  style={[
                    styles.checkboxBox,
                    sendAsMessage && styles.checkboxBoxChecked,
                  ]}
                  onPress={() => setSendAsMessage(!sendAsMessage)}
                >
                  {sendAsMessage && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </Pressable>
              </View>

              {/* Section 4: Electronic Signature Card (Dark Navy) */}
              <View style={styles.signatureCard}>
                <View style={styles.signatureCardHeader}>
                  <Ionicons name="shield-checkmark" size={15} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.signatureCardTitle}>ELECTRONIC SIGNATURE</Text>
                </View>

                <View style={styles.signatureRow}>
                  {/* Staff Signature PIN * */}
                  <View style={styles.sigColPin}>
                    <Text style={styles.sigLabel}>
                      STAFF SIGNATURE PIN <Text style={{ color: '#F87171' }}>*</Text>
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TextInput
                        style={[
                          styles.pinInput,
                          pinVerified && styles.pinInputVerified,
                          pinFeedback?.error && styles.pinInputError,
                        ]}
                        placeholder="••••••"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        secureTextEntry
                        maxLength={12}
                        value={pin}
                        onChangeText={(t) => {
                          setPin(t);
                          if (pinVerified) {
                            setPinVerified(false);
                            setPinFeedback(null);
                          }
                        }}
                      />
                      <Pressable
                        style={[
                          styles.verifyPinBtn,
                          pinVerified && styles.verifyPinBtnVerified,
                          pinVerifying && { opacity: 0.7 },
                        ]}
                        onPress={handleVerifyPin}
                        disabled={pinVerifying}
                      >
                        {pinVerifying ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons
                              name={pinVerified ? 'checkmark-circle' : 'key-outline'}
                              size={14}
                              color="#FFFFFF"
                            />
                            <Text style={styles.verifyPinBtnText} numberOfLines={1}>
                              {pinVerified ? 'Verified' : 'Verify'}
                            </Text>
                          </>
                        )}
                      </Pressable>
                    </View>

                    {pinFeedback && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Ionicons
                          name={pinFeedback.error ? 'close-circle' : 'checkmark-circle'}
                          size={13}
                          color={pinFeedback.error ? '#F87171' : '#4ADE80'}
                        />
                        <Text
                          style={[
                            styles.pinFeedbackText,
                            { color: pinFeedback.error ? '#F87171' : '#4ADE80' },
                          ]}
                        >
                          {pinFeedback.text}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Signature Date */}
                  <View style={styles.sigCol}>
                    <Text style={styles.sigLabel}>SIGNATURE DATE</Text>
                    <AppDatePicker
                      value={signatureDate}
                      onChange={setSignatureDate}
                      format="DD/MM/YYYY"
                    />
                  </View>

                  {/* Signature Time */}
                  <View style={styles.sigCol}>
                    <Text style={styles.sigLabel}>SIGNATURE TIME</Text>
                    <AppTimePicker
                      value={signatureTime}
                      onChange={setSignatureTime}
                      format="12h"
                    />
                  </View>
                </View>

                <View style={styles.policyRow}>
                  <Ionicons name="lock-closed" size={12} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.policyText}>
                    By signing, you confirm this note is accurate and complete per organisational policy.
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Modal Footer Buttons */}
            <View style={styles.modalFooter}>
              <Pressable
                style={styles.footerCancelBtn}
                onPress={() => setModalOpen(false)}
                disabled={saving}
              >
                <Text style={styles.footerCancelBtnText}>Cancel</Text>
              </Pressable>

              <View style={styles.footerActionGroup}>
                <Pressable
                  style={[styles.saveDraftBtn, saving && { opacity: 0.6 }]}
                  onPress={() => handleSubmitNote('draft')}
                  disabled={saving}
                >
                  <Ionicons name="save-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.saveDraftBtnText}>Save Draft</Text>
                </Pressable>

                <Pressable
                  style={[styles.completeSignBtn, saving && { opacity: 0.6 }]}
                  onPress={() => handleSubmitNote('completed')}
                  disabled={saving}
                >
                  <Ionicons name="checkmark-circle-outline" size={17} color="#FFFFFF" />
                  <Text style={styles.completeSignBtnText}>Complete & Sign</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* QUICK ADD NEW PHYSICIAN MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={newPhysicianModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNewPhysicianModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: 450 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="person-add" size={18} color="#FFFFFF" />
                <Text style={styles.modalTitle}>Add New Physician</Text>
              </View>
              <Pressable onPress={() => setNewPhysicianModalOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </Pressable>
            </View>

            <View style={{ padding: 16 }}>
              <View style={styles.twoColRow}>
                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>
                    FIRST NAME <Text style={{ color: '#DC2626' }}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.inputBox}
                    placeholder="e.g. John"
                    placeholderTextColor="#94A3B8"
                    value={newPhyFirstName}
                    onChangeText={setNewPhyFirstName}
                  />
                </View>

                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>
                    LAST NAME <Text style={{ color: '#DC2626' }}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.inputBox}
                    placeholder="e.g. Smith"
                    placeholderTextColor="#94A3B8"
                    value={newPhyLastName}
                    onChangeText={setNewPhyLastName}
                  />
                </View>
              </View>

              <View style={{ marginTop: 10 }}>
                <Text style={styles.fieldLabel}>SPECIALTY</Text>
                <TextInput
                  style={styles.inputBox}
                  placeholder="e.g. Cardiologist, Internal Medicine"
                  placeholderTextColor="#94A3B8"
                  value={newPhySpecialty}
                  onChangeText={setNewPhySpecialty}
                />
              </View>

              <View style={[styles.twoColRow, { marginTop: 10 }]}>
                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>NPI NUMBER</Text>
                  <TextInput
                    style={styles.inputBox}
                    placeholder="10-digit NPI"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={newPhyNpi}
                    onChangeText={setNewPhyNpi}
                  />
                </View>

                <View style={styles.colHalf}>
                  <Text style={styles.fieldLabel}>PHONE</Text>
                  <TextInput
                    style={styles.inputBox}
                    placeholder="(555) 000-0000"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    value={newPhyPhone}
                    onChangeText={setNewPhyPhone}
                  />
                </View>
              </View>

              <View style={[styles.modalActionsRow, { marginTop: 16 }]}>
                <Pressable
                  style={styles.footerCancelBtn}
                  onPress={() => setNewPhysicianModalOpen(false)}
                  disabled={savingPhysician}
                >
                  <Text style={styles.footerCancelBtnText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={[styles.saveDraftBtn, savingPhysician && { opacity: 0.6 }]}
                  onPress={handleSaveNewPhysician}
                  disabled={savingPhysician}
                >
                  {savingPhysician ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      <Text style={styles.saveDraftBtnText}>Save Physician</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* STATUS PICKER MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={statusPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusPickerOpen(false)}
      >
        <Pressable style={styles.pickerOverlay} onPress={() => setStatusPickerOpen(false)}>
          <View style={styles.pickerDialog}>
            <Text style={styles.pickerDialogTitle}>Select Patient Status</Text>
            {PATIENT_STATUS_OPTIONS.map((st) => (
              <Pressable
                key={st}
                style={[
                  styles.pickerOptionItem,
                  patientStatus === st && styles.pickerOptionItemActive,
                ]}
                onPress={() => {
                  setPatientStatus(st);
                  setStatusPickerOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    patientStatus === st && styles.pickerOptionTextActive,
                  ]}
                >
                  {st}
                </Text>
                {patientStatus === st && (
                  <Ionicons name="checkmark" size={16} color="#DC2626" />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* ========================================================================= */}
      {/* EPISODE PICKER MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={episodePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setEpisodePickerOpen(false)}
      >
        <Pressable style={styles.pickerOverlay} onPress={() => setEpisodePickerOpen(false)}>
          <View style={styles.pickerDialog}>
            <Text style={styles.pickerDialogTitle}>Select Episode Associated</Text>
            {episodes.length > 0 ? (
              episodes.map((ep) => (
                <Pressable
                  key={ep.id}
                  style={[
                    styles.pickerOptionItem,
                    String(selectedEpisodeId) === String(ep.id) && styles.pickerOptionItemActive,
                  ]}
                  onPress={() => {
                    setSelectedEpisodeId(ep.id);
                    setEpisodePickerOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      String(selectedEpisodeId) === String(ep.id) && styles.pickerOptionTextActive,
                    ]}
                  >
                    {ep.episode_number || `Episode #${ep.id}`}
                    {ep.start_date ? ` (${ep.start_date})` : ''}
                  </Text>
                  {String(selectedEpisodeId) === String(ep.id) && (
                    <Ionicons name="checkmark" size={16} color="#DC2626" />
                  )}
                </Pressable>
              ))
            ) : (
              <Pressable
                style={[styles.pickerOptionItem, styles.pickerOptionItemActive]}
                onPress={() => {
                  setSelectedEpisodeId('1');
                  setEpisodePickerOpen(false);
                }}
              >
                <Text style={[styles.pickerOptionText, styles.pickerOptionTextActive]}>
                  Episode #1 (Active)
                </Text>
                <Ionicons name="checkmark" size={16} color="#DC2626" />
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* ========================================================================= */}
      {/* NOTE DETAIL MODAL */}
      {/* ========================================================================= */}
      {selectedNote && (
        <Modal
          visible={Boolean(selectedNote)}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedNote(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { maxWidth: 600 }]}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="document-text" size={18} color="#FFFFFF" />
                  <Text style={styles.modalTitle}>Communication Note Details</Text>
                </View>
                <Pressable onPress={() => setSelectedNote(null)} hitSlop={8}>
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                </Pressable>
              </View>

              <ScrollView style={{ padding: 18, maxHeight: 500 }} showsVerticalScrollIndicator={false}>
                <View style={styles.detailGrid}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date:</Text>
                    <Text style={styles.detailValue}>
                      {selectedNote.date || selectedNote.created_at?.split('T')[0] || '—'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Author:</Text>
                    <Text style={styles.detailValue}>{selectedNote.created_by || 'Staff'}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Patient Status:</Text>
                    <Text style={styles.detailValue}>
                      {selectedNote.patient_status || 'Active'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Episode:</Text>
                    <Text style={styles.detailValue}>
                      {selectedNote.episode_number || (selectedNote.episode_id ? `#${selectedNote.episode_id}` : '1')}
                    </Text>
                  </View>

                  {selectedNote.physician_name && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Physician:</Text>
                      <Text style={styles.detailValue}>
                        {selectedNote.physician_name}
                        {selectedNote.physician_spec ? ` (${selectedNote.physician_spec})` : ''}
                      </Text>
                    </View>
                  )}

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status:</Text>
                    <Text style={[styles.detailValue, { fontWeight: '700', textTransform: 'uppercase' }]}>
                      {selectedNote.status || 'Completed'}
                    </Text>
                  </View>

                  {selectedNote.signed_by && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Signed By:</Text>
                      <Text style={styles.detailValue}>
                        {selectedNote.signed_by} on {selectedNote.signature_date || '—'} {selectedNote.signature_time || ''}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={{ marginTop: 14 }}>
                  <Text style={[styles.fieldLabel, { fontSize: 13, marginBottom: 6 }]}>Note Content:</Text>
                  <View style={styles.noteContentBox}>
                    <Text style={styles.noteContentText}>
                      {selectedNote.note_content || selectedNote.note || selectedNote.content || '—'}
                    </Text>
                  </View>
                </View>
              </ScrollView>

              <View style={[styles.modalFooter, { justifyContent: 'flex-end' }]}>
                <Pressable
                  style={[styles.saveDraftBtn, { paddingHorizontal: 20 }]}
                  onPress={() => setSelectedNote(null)}
                >
                  <Text style={styles.saveDraftBtnText}>Close</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  pressed: {
    opacity: 0.85,
  },

  /* Top Banner Bar matching second screenshot */
  bannerHeader: {
    backgroundColor: '#111111',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  bannerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerTitleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  bannerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  bannerAddBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  /* Loading State */
  centerArea: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
  },

  /* Empty State matching Screenshot 2 */
  emptyCard: {
    margin: 16,
    paddingVertical: 80,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptySlashLine: {
    position: 'absolute',
    width: 48,
    height: 2.5,
    backgroundColor: '#94A3B8',
    transform: [{ rotate: '-45deg' }],
  },
  emptyMessageText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 14,
    textAlign: 'center',
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  emptyActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },

  /* Table View */
  tableScroll: {
    margin: 16,
  },
  tableContainer: {
    minWidth: 1000,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  thText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tableDataRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tdText: {
    fontSize: 13,
    color: '#1E293B',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusBadgeCompleted: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeDraft: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  statusBadgeTextCompleted: {
    color: '#166534',
  },
  statusBadgeTextDraft: {
    color: '#92400E',
  },
  actionsCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  actionIconBtn: {
    padding: 4,
  },

  /* Modal Backdrop & Container */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 960,
    maxHeight: '92%',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  modalHeader: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalScrollBody: {
    padding: 16,
  },

  /* Section Cards matching Screenshot 1 */
  twoCardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  sectionCard: {
    flex: 1,
    minWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  sectionCardHeader: {
    backgroundColor: '#111111',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  sectionCardTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionCardBody: {
    padding: 14,
  },

  /* Input fields & Labels */
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
  },
  colHalf: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 5,
    letterSpacing: 0.2,
  },
  inputBox: {
    height: 38,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
  },
  inputBoxReadonly: {
    backgroundColor: '#F1F5F9',
    color: '#475569',
  },
  selectBox: {
    height: 38,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  selectBoxText: {
    fontSize: 13,
    color: '#1E293B',
  },
  episodeHintText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#16A34A',
    marginTop: 4,
    fontWeight: '500',
  },

  /* Physician Search & Autocomplete */
  searchWrap: {
    height: 38,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
    paddingVertical: 0,
  },
  physicianDropdown: {
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  physicianItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  physicianItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  physicianItemMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  physicianChip: {
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  physicianChipName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  physicianChipMeta: {
    fontSize: 11,
    color: '#64748B',
  },
  helperTextItalic: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#94A3B8',
    marginTop: 6,
  },
  newPhysicianBtn: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  newPhysicianBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },

  /* Dictate Button & Banner */
  dictateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  dictateBtnActive: {
    backgroundColor: '#DC2626',
  },
  dictateBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  dictateBtnTextActive: {
    color: '#FFFFFF',
  },
  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  recordingBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B91C1C',
  },

  /* Text Area & Character Count */
  textArea: {
    height: 140,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    padding: 10,
    fontSize: 13,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
    textAlignVertical: 'top',
  },
  charBarWrap: {
    height: 3,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 6,
  },
  charBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  charCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  charCountText: {
    fontSize: 11,
    color: '#64748B',
  },

  /* Send as Message Card */
  sendAsMessageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sendAsMessageTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  sendAsMessageSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },

  /* Electronic Signature Card (Dark Navy) */
  signatureCard: {
    backgroundColor: '#0D1B2A',
    borderRadius: 8,
    padding: 16,
    marginTop: 14,
  },
  signatureCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  signatureCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 0.8,
  },
  signatureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  sigCol: {
    flex: 1,
    minWidth: 140,
  },
  /**
   * The PIN column holds a field AND a button, so 140 leaves the input about 40px
   * once the button has its width — legible for neither. Only this column needs the
   * extra room; the date and time columns are fine as they are.
   */
  sigColPin: {
    flex: 1,
    minWidth: 210,
  },
  sigLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.65)',
    marginBottom: 5,
    letterSpacing: 0.5,
  },
  pinInput: {
    flex: 1,
    height: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 6,
    paddingHorizontal: 10,
    color: '#FFFFFF',
    fontSize: 14,
    letterSpacing: 2,
  },
  pinInputVerified: {
    borderColor: '#4ADE80',
  },
  pinInputError: {
    borderColor: '#F87171',
  },
  verifyPinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 12,
    height: 38,
    // The PIN field beside this is flex: 1 and the whole column is one of three
    // sharing a row, so on a phone there is very little width to go round. Without
    // these the button keeps React Native's default flexShrink: 1, loses the fight
    // with the input, and is squeezed to zero — present in the tree, invisible on
    // screen, and the note can never be signed because nothing can verify the PIN.
    flexShrink: 0,
    minWidth: 92,
  },
  verifyPinBtnVerified: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  verifyPinBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  pinFeedbackText: {
    fontSize: 11,
    fontWeight: '600',
  },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
  },
  policyText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
  },

  /* Modal Footer */
  modalFooter: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  footerCancelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  footerCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  footerActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    justifyContent: 'flex-end',
  },
  saveDraftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveDraftBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  completeSignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B981',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 6,
  },
  completeSignBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  modalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },

  /* Options Pickers (Status & Episodes) */
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerDialog: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  pickerDialogTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
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

  /* Details View */
  detailGrid: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  detailValue: {
    fontSize: 13,
    color: '#0F172A',
  },
  noteContentBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  noteContentText: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 19,
  },
});
