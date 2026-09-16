import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  toIsoDate,
  toDisplayDate,
  to24hTime,
  to12hTime,
  getTodayIsoDate,
  getYesterdayIsoDate,
  getCurrent12hTime,
} from '../utils/dateTimeUtils';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const HOURS_12 = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MINUTES_5 = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

export interface AppDatePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  format?: 'DD/MM/YYYY' | 'YYYY-MM-DD';
}

export const AppDatePicker: React.FC<AppDatePickerProps> = ({
  value = '',
  onChange,
  placeholder = 'dd/mm/yyyy',
  minDate,
  maxDate,
  style,
  disabled = false,
  format = 'DD/MM/YYYY',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Local display text
  const displayVal = value ? toDisplayDate(value, format) : '';
  const [inputValue, setInputValue] = useState(displayVal);

  useEffect(() => {
    setInputValue(value ? toDisplayDate(value, format) : '');
  }, [value, format]);

  // Calendar view state
  const initialIso = toIsoDate(value) || getTodayIsoDate();
  const [initY, initM, initD] = initialIso.split('-').map((n) => parseInt(n, 10));

  const [viewYear, setViewYear] = useState(initY || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(initM ? initM - 1 : new Date().getMonth());
  const [selectedIso, setSelectedIso] = useState(toIsoDate(value));

  const handleOpen = () => {
    if (disabled) return;
    const curIso = toIsoDate(value) || getTodayIsoDate();
    const [y, m] = curIso.split('-').map((n) => parseInt(n, 10));
    setViewYear(y || new Date().getFullYear());
    setViewMonth(m ? m - 1 : new Date().getMonth());
    setSelectedIso(toIsoDate(value));
    setIsOpen(true);
  };

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const mStr = String(viewMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const newIso = `${viewYear}-${mStr}-${dStr}`;
    setSelectedIso(newIso);
    const formatted = format === 'DD/MM/YYYY' ? toDisplayDate(newIso, 'DD/MM/YYYY') : newIso;
    onChange(formatted);
    setIsOpen(false);
  };

  const handleQuickToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const iso = getTodayIsoDate();
    setSelectedIso(iso);
    const [y, m] = iso.split('-').map((n) => parseInt(n, 10));
    setViewYear(y);
    setViewMonth(m - 1);
    const formatted = format === 'DD/MM/YYYY' ? toDisplayDate(iso, 'DD/MM/YYYY') : iso;
    onChange(formatted);
    setIsOpen(false);
  };

  const handleQuickYesterday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const iso = getYesterdayIsoDate();
    setSelectedIso(iso);
    const [y, m] = iso.split('-').map((n) => parseInt(n, 10));
    setViewYear(y);
    setViewMonth(m - 1);
    const formatted = format === 'DD/MM/YYYY' ? toDisplayDate(iso, 'DD/MM/YYYY') : iso;
    onChange(formatted);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIso('');
    onChange('');
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    const parsedIso = toIsoDate(val);
    if (parsedIso) {
      setSelectedIso(parsedIso);
      onChange(format === 'DD/MM/YYYY' ? toDisplayDate(parsedIso, 'DD/MM/YYYY') : parsedIso);
    } else if (!val) {
      setSelectedIso('');
      onChange('');
    }
  };

  // Calendar math
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayWeekday = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday
  const todayIso = getTodayIsoDate();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        width: '100%',
      }}
    >
      <input
        type="text"
        value={inputValue}
        placeholder={placeholder}
        disabled={disabled}
        onChange={handleInputChange}
        onClick={handleOpen}
        onFocus={() => {
          setIsFocused(true);
          handleOpen();
        }}
        onBlur={() => setIsFocused(false)}
        style={{
          height: 38,
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: isFocused ? '#0D6EFD' : '#CBD5E1',
          borderRadius: 6,
          paddingLeft: 10,
          paddingRight: 34,
          fontSize: 13,
          color: '#1E293B',
          backgroundColor: disabled ? '#F8FAFC' : '#FFFFFF',
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          boxShadow: isFocused ? '0 0 0 2px rgba(13, 110, 253, 0.15)' : 'none',
          transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
          ...style,
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleOpen();
        }}
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          padding: 4,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#0D6EFD',
        }}
        aria-label="Open Calendar"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {/* Calendar Portal Modal */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            zIndex: 9999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            backdropFilter: 'blur(1px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              padding: 18,
              width: '100%',
              maxWidth: 340,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
              border: '1px solid #E2E8F0',
              userSelect: 'none',
              animation: 'fadeIn 0.15s ease-out',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: 10,
                borderBottom: '1px solid #F1F5F9',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0D6EFD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Select Date</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  fontSize: 18,
                  color: '#64748B',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Quick Action Chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '10px 0' }}>
              <button
                type="button"
                onClick={handleQuickToday}
                style={{
                  padding: '4px 10px',
                  borderRadius: 16,
                  backgroundColor: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  color: '#1D4ED8',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleQuickYesterday}
                style={{
                  padding: '4px 10px',
                  borderRadius: 16,
                  backgroundColor: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  color: '#1D4ED8',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={handleClear}
                style={{
                  padding: '4px 10px',
                  borderRadius: 16,
                  backgroundColor: '#F1F5F9',
                  border: '1px solid #E2E8F0',
                  color: '#64748B',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            </div>

            {/* Month & Year Navigation */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 0',
              }}
            >
              <button
                type="button"
                onClick={handlePrevMonth}
                style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#1E293B',
                }}
              >
                ‹
              </button>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#1E293B',
                }}
              >
                ›
              </button>
            </div>

            {/* Days of Week Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 2,
                marginTop: 6,
                marginBottom: 4,
                textAlign: 'center',
              }}
            >
              {DAYS_OF_WEEK.map((d) => (
                <span key={d} style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>
                  {d}
                </span>
              ))}
            </div>

            {/* Days Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 4,
              }}
            >
              {Array.from({ length: firstDayWeekday }).map((_, idx) => (
                <div key={`blank-${idx}`} style={{ height: 34 }} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const day = idx + 1;
                const mStr = String(viewMonth + 1).padStart(2, '0');
                const dStr = String(day).padStart(2, '0');
                const iso = `${viewYear}-${mStr}-${dStr}`;
                const isSelected = selectedIso === iso;
                const isToday = todayIso === iso;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleSelectDay(day)}
                    style={{
                      height: 34,
                      borderRadius: 6,
                      border: isSelected
                        ? '1px solid #0D6EFD'
                        : isToday
                        ? '1px solid #93C5FD'
                        : '1px solid transparent',
                      backgroundColor: isSelected
                        ? '#0D6EFD'
                        : isToday
                        ? '#EFF6FF'
                        : 'transparent',
                      color: isSelected ? '#FFFFFF' : '#1E293B',
                      fontSize: 13,
                      fontWeight: isSelected || isToday ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease-in-out',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = '#F1F5F9';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = isToday ? '#EFF6FF' : 'transparent';
                      }
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 14,
                paddingTop: 10,
                borderTop: '1px solid #F1F5F9',
              }}
            >
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#F8FAFC',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#64748B',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selectedIso) {
                    const formatted = format === 'DD/MM/YYYY' ? toDisplayDate(selectedIso, 'DD/MM/YYYY') : selectedIso;
                    onChange(formatted);
                  }
                  setIsOpen(false);
                }}
                style={{
                  padding: '6px 16px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: '#0D6EFD',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#FFFFFF',
                  cursor: 'pointer',
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export interface AppTimePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  format?: '12h' | '24h';
}

export const AppTimePicker: React.FC<AppTimePickerProps> = ({
  value = '',
  onChange,
  placeholder = 'hh:mm a',
  style,
  disabled = false,
  format = '12h',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const displayVal = value ? (format === '12h' ? to12hTime(value) : to24hTime(value)) : '';
  const [inputValue, setInputValue] = useState(displayVal);

  useEffect(() => {
    setInputValue(value ? (format === '12h' ? to12hTime(value) : to24hTime(value)) : '');
  }, [value, format]);

  // Internal time selection state
  const time12 = to12hTime(value) || getCurrent12hTime();
  const match = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  const [selectedHour, setSelectedHour] = useState(match ? String(parseInt(match[1], 10)).padStart(2, '0') : '09');
  const [selectedMin, setSelectedMin] = useState(match ? match[2] : '00');
  const [selectedAmPm, setSelectedAmPm] = useState<'AM' | 'PM'>(
    match && match[3] ? (match[3].toUpperCase() as 'AM' | 'PM') : 'AM'
  );

  const handleOpen = () => {
    if (disabled) return;
    const cur12 = to12hTime(value) || getCurrent12hTime();
    const m = cur12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (m) {
      setSelectedHour(String(parseInt(m[1], 10)).padStart(2, '0'));
      setSelectedMin(m[2]);
      setSelectedAmPm(m[3] ? (m[3].toUpperCase() as 'AM' | 'PM') : 'AM');
    }
    setIsOpen(true);
  };

  const handleQuickNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now12 = getCurrent12hTime();
    const m = now12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (m) {
      setSelectedHour(String(parseInt(m[1], 10)).padStart(2, '0'));
      setSelectedMin(m[2]);
      setSelectedAmPm(m[3] ? (m[3].toUpperCase() as 'AM' | 'PM') : 'AM');
      const val = format === '12h' ? `${m[1].padStart(2, '0')}:${m[2]} ${m[3]}` : to24hTime(now12);
      onChange(val);
    }
    setIsOpen(false);
  };

  const handleApply = () => {
    const timeStr = `${selectedHour}:${selectedMin} ${selectedAmPm}`;
    const result = format === '12h' ? timeStr : to24hTime(timeStr);
    onChange(result);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (format === '12h') {
      const converted = to12hTime(val);
      if (converted && /AM|PM/i.test(converted)) {
        onChange(converted);
      }
    } else {
      const converted24 = to24hTime(val);
      if (converted24) {
        onChange(converted24);
      }
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        width: '100%',
      }}
    >
      <input
        type="text"
        value={inputValue}
        placeholder={placeholder}
        disabled={disabled}
        onChange={handleInputChange}
        onClick={handleOpen}
        onFocus={() => {
          setIsFocused(true);
          handleOpen();
        }}
        onBlur={() => setIsFocused(false)}
        style={{
          height: 38,
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: isFocused ? '#0D6EFD' : '#CBD5E1',
          borderRadius: 6,
          paddingLeft: 10,
          paddingRight: 34,
          fontSize: 13,
          color: '#1E293B',
          backgroundColor: disabled ? '#F8FAFC' : '#FFFFFF',
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          boxShadow: isFocused ? '0 0 0 2px rgba(13, 110, 253, 0.15)' : 'none',
          transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
          ...style,
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleOpen();
        }}
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          padding: 4,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#0D6EFD',
        }}
        aria-label="Open Time Picker"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </button>

      {/* Time Portal Modal */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            zIndex: 9999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            backdropFilter: 'blur(1px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              padding: 18,
              width: '100%',
              maxWidth: 340,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
              border: '1px solid #E2E8F0',
              userSelect: 'none',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: 10,
                borderBottom: '1px solid #F1F5F9',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0D6EFD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Select Time</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  fontSize: 18,
                  color: '#64748B',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Quick Action */}
            <div style={{ margin: '10px 0' }}>
              <button
                type="button"
                onClick={handleQuickNow}
                style={{
                  padding: '4px 12px',
                  borderRadius: 16,
                  backgroundColor: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  color: '#1D4ED8',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Current Time (Now)
              </button>
            </div>

            {/* Digital Display */}
            <div
              style={{
                backgroundColor: '#F8FAFC',
                borderRadius: 8,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                margin: '10px 0',
                border: '1px solid #E2E8F0',
              }}
            >
              <span style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', letterSpacing: 1 }}>
                {selectedHour}:{selectedMin}
              </span>
              <span
                style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  backgroundColor: '#0D6EFD',
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {selectedAmPm}
              </span>
            </div>

            {/* AM / PM Toggle */}
            <div style={{ display: 'flex', gap: 8, margin: '10px 0' }}>
              <button
                type="button"
                onClick={() => setSelectedAmPm('AM')}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 6,
                  border: selectedAmPm === 'AM' ? '1px solid #0D6EFD' : '1px solid #E2E8F0',
                  backgroundColor: selectedAmPm === 'AM' ? '#0D6EFD' : '#F8FAFC',
                  color: selectedAmPm === 'AM' ? '#FFFFFF' : '#475569',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => setSelectedAmPm('PM')}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 6,
                  border: selectedAmPm === 'PM' ? '1px solid #0D6EFD' : '1px solid #E2E8F0',
                  backgroundColor: selectedAmPm === 'PM' ? '#0D6EFD' : '#F8FAFC',
                  color: selectedAmPm === 'PM' ? '#FFFFFF' : '#475569',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                PM
              </button>
            </div>

            {/* Hour Selector */}
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginTop: 10, marginBottom: 4 }}>
              Hour
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
              {HOURS_12.map((h) => {
                const isSel = selectedHour === h;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setSelectedHour(h)}
                    style={{
                      padding: '6px 0',
                      borderRadius: 6,
                      border: isSel ? '1px solid #0D6EFD' : '1px solid #E2E8F0',
                      backgroundColor: isSel ? '#0D6EFD' : '#FFFFFF',
                      color: isSel ? '#FFFFFF' : '#1E293B',
                      fontSize: 12,
                      fontWeight: isSel ? 700 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {h}
                  </button>
                );
              })}
            </div>

            {/* Minute Selector */}
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginTop: 12, marginBottom: 4 }}>
              Minute
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
              {MINUTES_5.map((m) => {
                const isSel = selectedMin === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSelectedMin(m)}
                    style={{
                      padding: '6px 0',
                      borderRadius: 6,
                      border: isSel ? '1px solid #0D6EFD' : '1px solid #E2E8F0',
                      backgroundColor: isSel ? '#0D6EFD' : '#FFFFFF',
                      color: isSel ? '#FFFFFF' : '#1E293B',
                      fontSize: 12,
                      fontWeight: isSel ? 700 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {m}
                  </button>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 14,
                paddingTop: 10,
                borderTop: '1px solid #F1F5F9',
              }}
            >
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#F8FAFC',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#64748B',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                style={{
                  padding: '6px 16px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: '#0D6EFD',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#FFFFFF',
                  cursor: 'pointer',
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
