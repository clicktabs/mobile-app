import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  toIsoDate,
  toDisplayDate,
  to24hTime,
  to12hTime,
  getTodayIsoDate,
  getCurrent12hTime,
  getCurrent24hTime,
} from '../utils/dateTimeUtils';

export interface AppDatePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
  style?: any;
  disabled?: boolean;
  format?: 'DD/MM/YYYY' | 'YYYY-MM-DD';
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const AppDatePicker: React.FC<AppDatePickerProps> = ({
  value = '',
  onChange,
  placeholder = 'Select date...',
  minDate,
  maxDate,
  style,
  disabled = false,
  format = 'DD/MM/YYYY',
}) => {
  const [modalOpen, setModalOpen] = useState(false);

  // Parse current value or fallback to today for calendar view
  const isoVal = toIsoDate(value) || getTodayIsoDate();
  const [initialY, initialM, initialD] = isoVal.split('-').map((n) => parseInt(n, 10));

  const [viewYear, setViewYear] = useState(initialY || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState((initialM ? initialM - 1 : new Date().getMonth()));
  const [selectedIso, setSelectedIso] = useState(toIsoDate(value));

  const handleOpen = () => {
    if (disabled) return;
    const curIso = toIsoDate(value) || getTodayIsoDate();
    const [y, m] = curIso.split('-').map((n) => parseInt(n, 10));
    setViewYear(y);
    setViewMonth(m - 1);
    setSelectedIso(toIsoDate(value));
    setModalOpen(true);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  /**
   * Whether a day is inside the caller's bounds.
   *
   * minDate and maxDate were accepted and then ignored: every caller passing them —
   * the incident report barring a future date, a booking barring a past one — was
   * relying on a limit the picker did not apply, and each had to catch the bad value
   * afterwards with its own warning line. ISO dates compare correctly as strings.
   */
  const isOutOfRange = (iso: string) =>
    (!!minDate && iso < (toIsoDate(minDate) || minDate)) ||
    (!!maxDate && iso > (toIsoDate(maxDate) || maxDate));

  const handleSelectDay = (day: number) => {
    const mStr = String(viewMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const newIso = `${viewYear}-${mStr}-${dStr}`;

    if (isOutOfRange(newIso)) return;

    setSelectedIso(newIso);
  };

  const handleApply = () => {
    if (!selectedIso) {
      onChange('');
    } else if (format === 'DD/MM/YYYY') {
      onChange(toDisplayDate(selectedIso, 'DD/MM/YYYY'));
    } else {
      onChange(selectedIso);
    }
    setModalOpen(false);
  };

  /** Jump the grid to a date and select it — unless the caller's bounds exclude it. */
  const jumpTo = (iso: string) => {
    const [y, m] = iso.split('-').map((n) => parseInt(n, 10));
    setViewYear(y);
    setViewMonth(m - 1);
    if (!isOutOfRange(iso)) setSelectedIso(iso);
  };

  const yesterdayIso = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
  })();

  const handleQuickToday = () => jumpTo(getTodayIsoDate());
  const handleQuickYesterday = () => jumpTo(yesterdayIso);

  // Calendar math
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayWeekday = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday

  const displayVal = value ? toDisplayDate(value, format) : '';
  const todayIso = getTodayIsoDate();

  return (
    <>
      <Pressable
        style={[
          styles.triggerBox,
          disabled && styles.triggerBoxDisabled,
          style,
        ]}
        onPress={handleOpen}
      >
        <Text
          style={[
            styles.triggerText,
            !displayVal && styles.placeholderText,
          ]}
          numberOfLines={1}
        >
          {displayVal || placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={16} color="#0D6EFD" />
      </Pressable>

      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalOpen(false)}>
          <Pressable style={styles.calendarModalContent} onPress={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="calendar" size={18} color="#0D6EFD" />
                <Text style={styles.modalTitle}>Select Date</Text>
              </View>
              <Pressable onPress={() => setModalOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            {/* Quick Action Chips */}
            <View style={styles.quickChipsRow}>
              {/* A shortcut to a date the caller has excluded is not a shortcut. */}
              {!isOutOfRange(getTodayIsoDate()) ? (
                <Pressable style={styles.quickChip} onPress={handleQuickToday}>
                  <Text style={styles.quickChipText}>Today</Text>
                </Pressable>
              ) : null}
              {!isOutOfRange(yesterdayIso) ? (
                <Pressable style={styles.quickChip} onPress={handleQuickYesterday}>
                  <Text style={styles.quickChipText}>Yesterday</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.quickChip} onPress={() => setSelectedIso('')}>
                <Text style={styles.quickChipText}>Clear</Text>
              </Pressable>
            </View>

            {/* Month & Year Navigation */}
            <View style={styles.monthNavRow}>
              <Pressable style={styles.navBtn} onPress={handlePrevMonth}>
                <Ionicons name="chevron-back" size={18} color="#1E293B" />
              </Pressable>
              <Text style={styles.monthYearText}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </Text>
              <Pressable style={styles.navBtn} onPress={handleNextMonth}>
                <Ionicons name="chevron-forward" size={18} color="#1E293B" />
              </Pressable>
            </View>

            {/* Days of Week Header */}
            <View style={styles.weekHeaderRow}>
              {DAYS_OF_WEEK.map((d) => (
                <Text key={d} style={styles.weekHeaderText}>
                  {d}
                </Text>
              ))}
            </View>

            {/* Days Grid */}
            <View style={styles.daysGrid}>
              {Array.from({ length: firstDayWeekday }).map((_, idx) => (
                <View key={`empty-${idx}`} style={styles.dayCell} />
              ))}

              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const day = idx + 1;
                const mStr = String(viewMonth + 1).padStart(2, '0');
                const dStr = String(day).padStart(2, '0');
                const thisIso = `${viewYear}-${mStr}-${dStr}`;
                const isSelected = selectedIso === thisIso;
                const isToday = todayIso === thisIso;
                const disabledDay = isOutOfRange(thisIso);

                return (
                  <Pressable
                    key={day}
                    style={[
                      styles.dayCell,
                      isToday && styles.todayCell,
                      isSelected && styles.selectedDayCell,
                    ]}
                    disabled={disabledDay}
                    onPress={() => handleSelectDay(day)}
                  >
                    <Text
                      style={[
                        styles.dayCellText,
                        isToday && styles.todayCellText,
                        isSelected && styles.selectedDayCellText,
                        // Greyed rather than hidden: the day is still part of the month,
                        // and a gap in the grid would read as a rendering fault.
                        disabledDay && styles.disabledDayCellText,
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActionsRow}>
              <Pressable style={styles.cancelBtn} onPress={() => setModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.applyBtn} onPress={handleApply}>
                <Text style={styles.applyBtnText}>Set Date</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

export interface AppTimePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: any;
  disabled?: boolean;
  format?: '12h' | '24h';
}

const HOURS_12 = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MINUTES_5 = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

export const AppTimePicker: React.FC<AppTimePickerProps> = ({
  value = '',
  onChange,
  placeholder = 'Select time...',
  style,
  disabled = false,
  format = '12h',
}) => {
  const [modalOpen, setModalOpen] = useState(false);

  // Parse time into hour, minute, ampm
  const initialTime12 = to12hTime(value) || getCurrent12hTime();
  const match = initialTime12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  const curHour = match ? String(parseInt(match[1], 10)).padStart(2, '0') : '09';
  const curMin = match ? match[2] : '00';
  const curAmPm = (match && match[3] ? match[3].toUpperCase() : 'AM') as 'AM' | 'PM';

  const [selectedHour, setSelectedHour] = useState(curHour);
  const [selectedMin, setSelectedMin] = useState(curMin);
  const [selectedAmPm, setSelectedAmPm] = useState<'AM' | 'PM'>(curAmPm);

  const handleOpen = () => {
    if (disabled) return;
    const time12 = to12hTime(value) || getCurrent12hTime();
    const m = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (m) {
      setSelectedHour(String(parseInt(m[1], 10)).padStart(2, '0'));
      setSelectedMin(m[2]);
      setSelectedAmPm((m[3]?.toUpperCase() || 'AM') as 'AM' | 'PM');
    }
    setModalOpen(true);
  };

  const handleQuickNow = () => {
    const now12 = getCurrent12hTime();
    const m = now12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (m) {
      setSelectedHour(String(parseInt(m[1], 10)).padStart(2, '0'));
      setSelectedMin(m[2]);
      setSelectedAmPm((m[3]?.toUpperCase() || 'AM') as 'AM' | 'PM');
    }
  };

  const handleApply = () => {
    const time12 = `${selectedHour}:${selectedMin} ${selectedAmPm}`;
    if (format === '24h') {
      onChange(to24hTime(time12));
    } else {
      onChange(time12);
    }
    setModalOpen(false);
  };

  const displayVal = value ? (format === '24h' ? to24hTime(value) : to12hTime(value)) : '';

  return (
    <>
      <Pressable
        style={[
          styles.triggerBox,
          disabled && styles.triggerBoxDisabled,
          style,
        ]}
        onPress={handleOpen}
      >
        <Text
          style={[
            styles.triggerText,
            !displayVal && styles.placeholderText,
          ]}
          numberOfLines={1}
        >
          {displayVal || placeholder}
        </Text>
        <Ionicons name="time-outline" size={16} color="#0D6EFD" />
      </Pressable>

      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalOpen(false)}>
          <Pressable style={styles.timeModalContent} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="time" size={18} color="#0D6EFD" />
                <Text style={styles.modalTitle}>Select Time</Text>
              </View>
              <Pressable onPress={() => setModalOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            {/* Quick Action */}
            <View style={styles.quickChipsRow}>
              <Pressable style={styles.quickChip} onPress={handleQuickNow}>
                <Text style={styles.quickChipText}>Current Time (Now)</Text>
              </Pressable>
            </View>

            {/* Digital Display */}
            <View style={styles.timeDisplayCard}>
              <Text style={styles.timeDisplayDigits}>
                {selectedHour}:{selectedMin}
              </Text>
              <View style={styles.amPmBadge}>
                <Text style={styles.amPmBadgeText}>{selectedAmPm}</Text>
              </View>
            </View>

            {/* AM / PM Toggle */}
            <View style={styles.amPmToggleRow}>
              <Pressable
                style={[
                  styles.amPmToggleBtn,
                  selectedAmPm === 'AM' && styles.amPmToggleBtnActive,
                ]}
                onPress={() => setSelectedAmPm('AM')}
              >
                <Text
                  style={[
                    styles.amPmToggleText,
                    selectedAmPm === 'AM' && styles.amPmToggleTextActive,
                  ]}
                >
                  AM
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.amPmToggleBtn,
                  selectedAmPm === 'PM' && styles.amPmToggleBtnActive,
                ]}
                onPress={() => setSelectedAmPm('PM')}
              >
                <Text
                  style={[
                    styles.amPmToggleText,
                    selectedAmPm === 'PM' && styles.amPmToggleTextActive,
                  ]}
                >
                  PM
                </Text>
              </Pressable>
            </View>

            {/* Hour Selector */}
            <Text style={styles.pickerSubhead}>Hour</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gridScroll}>
              <View style={styles.rowGrid}>
                {HOURS_12.map((h) => {
                  const isSel = selectedHour === h;
                  return (
                    <Pressable
                      key={h}
                      style={[styles.timeUnitBtn, isSel && styles.timeUnitBtnActive]}
                      onPress={() => setSelectedHour(h)}
                    >
                      <Text style={[styles.timeUnitText, isSel && styles.timeUnitTextActive]}>
                        {h}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {/* Minute Selector */}
            <Text style={[styles.pickerSubhead, { marginTop: 12 }]}>Minute</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gridScroll}>
              <View style={styles.rowGrid}>
                {MINUTES_5.map((m) => {
                  const isSel = selectedMin === m;
                  return (
                    <Pressable
                      key={m}
                      style={[styles.timeUnitBtn, isSel && styles.timeUnitBtnActive]}
                      onPress={() => setSelectedMin(m)}
                    >
                      <Text style={[styles.timeUnitText, isSel && styles.timeUnitTextActive]}>
                        {m}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActionsRow}>
              <Pressable style={styles.cancelBtn} onPress={() => setModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.applyBtn} onPress={handleApply}>
                <Text style={styles.applyBtnText}>Set Time</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  triggerBox: {
    height: 38,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerBoxDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  triggerText: {
    fontSize: 13,
    color: '#1E293B',
    flex: 1,
  },
  placeholderText: {
    color: '#94A3B8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  calendarModalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  timeModalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  quickChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 10,
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  navBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
  },
  monthYearText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  weekHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 4,
  },
  weekHeaderText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    marginVertical: 1,
  },
  dayCellText: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '500',
  },
  todayCell: {
    borderWidth: 1,
    borderColor: '#0D6EFD',
  },
  disabledDayCellText: {
    color: '#CBD5E1',
    fontWeight: '400',
  },
  todayCellText: {
    color: '#0D6EFD',
    fontWeight: '700',
  },
  selectedDayCell: {
    backgroundColor: '#0D6EFD',
  },
  selectedDayCellText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  timeDisplayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 12,
    marginVertical: 10,
    gap: 10,
  },
  timeDisplayDigits: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 1,
  },
  amPmBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#0D6EFD',
  },
  amPmBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  amPmToggleRow: {
    flexDirection: 'row',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
    marginBottom: 10,
  },
  amPmToggleBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  amPmToggleBtnActive: {
    backgroundColor: '#0D6EFD',
  },
  amPmToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  amPmToggleTextActive: {
    color: '#FFFFFF',
  },
  pickerSubhead: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  gridScroll: {
    marginBottom: 4,
  },
  rowGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  timeUnitBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    minWidth: 38,
    alignItems: 'center',
  },
  timeUnitBtnActive: {
    backgroundColor: '#0D6EFD',
  },
  timeUnitText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  timeUnitTextActive: {
    color: '#FFFFFF',
  },
  modalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelBtnText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  applyBtn: {
    backgroundColor: '#0D6EFD',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 6,
  },
  applyBtnText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
