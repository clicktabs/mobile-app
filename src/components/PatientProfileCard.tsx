import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const PROFILE_NAVY = '#0D2A4A';
const CREAM = '#F4F0E4';
const LABEL = '#3A3A3A';
const VALUE = '#111111';
const ICON = '#5B6570';

export type PatientProfileData = Record<string, any>;

function dash(v: unknown) {
  const s = String(v ?? '').trim();
  return s || '—';
}

function parseDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(String(iso).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatMdY(iso?: string | null) {
  const d = parseDate(iso);
  if (!d) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function formatPretty(iso?: string | null) {
  const d = parseDate(iso);
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function formatPhone(raw?: string | null) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return dash(raw);
}

function formatDob(iso?: string | null, age?: number | null) {
  const date = formatMdY(iso);
  if (!date && (age == null || age === undefined)) return '—';
  if (!date) return `${age} yrs`;
  if (age == null || age === undefined) return date;
  return `${date} - ${age} yrs`;
}

function formatEpisode(ep?: { start_date?: string; end_date?: string } | null) {
  if (!ep?.start_date && !ep?.end_date) return '—';
  const a = formatMdY(ep?.start_date) || '—';
  const b = formatMdY(ep?.end_date) || '—';
  return `${a} - ${b}`;
}

function formatTriage(level?: number | string | null) {
  if (level == null || level === '') return '—';
  const n = String(level).replace(/^level\s*/i, '');
  return `Level ${n}`;
}

function formatPhysician(name?: string | null) {
  const s = String(name || '').trim();
  if (!s) return '—';
  if (/^dr\.?\s/i.test(s)) return s;
  return `Dr. ${s}`;
}

function formatStatus(status?: string | null) {
  const s = String(status || 'active').replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function addressLines(p: PatientProfileData) {
  if (p.address_line || p.address_city_line) {
    return { line1: dash(p.address_line), line2: p.address_city_line ? String(p.address_city_line) : '' };
  }
  const addr = p.address;
  if (addr && typeof addr === 'object') {
    const line1 = dash(addr.line1);
    const line2 = trimJoin([addr.city, trimJoin([addr.state, addr.zip], ' ')], ', ');
    return { line1, line2 };
  }
  if (typeof addr === 'string' && addr.trim()) {
    const parts = addr.split(',').map((x: string) => x.trim()).filter(Boolean);
    return { line1: parts[0] || '—', line2: parts.slice(1).join(', ') };
  }
  return { line1: '—', line2: '' };
}

function trimJoin(parts: unknown[], sep: string) {
  return parts.map((p) => String(p ?? '').trim()).filter(Boolean).join(sep);
}

function initials(name?: string) {
  return (name || 'PT')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
}

export function patientProfileHeaderOffset(insets: { top: number }) {
  return Math.max(insets.top, 8) + 44 + 12;
}

export function PatientProfileHeader({
  title = 'Patient Profile',
  showBack,
  onBack,
  onMenu,
}: {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  onMenu?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
      <View style={styles.headerRow}>
        {showBack ? (
          <Pressable onPress={onBack} hitSlop={8} style={styles.headerBtn} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
        ) : (
          <View style={styles.headerBtn} />
        )}
        <Text style={styles.headerTitle}>{title}</Text>
        {onMenu ? (
          <Pressable onPress={onMenu} hitSlop={8} style={styles.headerBtn} accessibilityLabel="More options">
            <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
          </Pressable>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  multiline,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={ICON} style={styles.infoIcon} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, multiline && styles.infoValueMulti]}>{value}</Text>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

export function PatientProfileCard({ patient }: { patient: PatientProfileData }) {
  const name = dash(patient.name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim());
  const status = formatStatus(patient.status);
  const isActive = String(patient.status || 'active').toLowerCase() === 'active';
  const addr = addressLines(patient);
  const ec = (patient.emergency_contact || {}) as Record<string, unknown>;
  const contactName = String(ec.name || '').trim();
  const contactRel = String(ec.relationship || '').trim();
  const primaryContact = contactName
    ? contactRel
      ? `${contactName} (${contactRel})`
      : contactName
    : '—';
  const photo = patient.photo_url ? String(patient.photo_url) : '';
  const dob = patient.dob || patient.date_of_birth;

  return (
    <View>
      <View style={styles.hero}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarText}>{initials(name)}</Text>
          </View>
        )}
        <View style={styles.heroText}>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          <View style={[styles.badge, isActive ? styles.badgeActive : styles.badgeMuted]}>
            <Text style={[styles.badgeText, isActive ? styles.badgeTextActive : styles.badgeTextMuted]}>
              {status}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Patient Information</Text>
        <InfoRow icon="person-outline" label="Full Name" value={name} />
        <InfoRow icon="calendar-outline" label="Date of Birth" value={formatDob(dob, patient.age)} />
        <InfoRow icon="card-outline" label="MRN" value={dash(patient.mrn)} />
        <InfoRow icon="call-outline" label="Phone" value={formatPhone(patient.phone)} />
        <InfoRow
          icon="location-outline"
          label="Address"
          value={[addr.line1, addr.line2].filter(Boolean).join('\n')}
          multiline
        />

        <Text style={[styles.cardTitle, styles.cardTitleSpaced]}>Clinical Summary</Text>
        <SummaryRow label="Episode:" value={formatEpisode(patient.episode)} />
        <SummaryRow label="Start of Care:" value={formatPretty(patient.start_of_care_date || patient.admission_date)} />
        <SummaryRow label="Emergency Triage:" value={formatTriage(patient.emergency_triage_level)} />
        <SummaryRow label="Primary Contact:" value={primaryContact} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Care Team</Text>
        <SummaryRow label="Clinical Manager:" value={dash(patient.clinical_manager)} />
        <SummaryRow label="Attending Physician:" value={formatPhysician(patient.attending_physician)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: PROFILE_NAVY,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    minHeight: 44,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 16,
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#E8EEF5',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#D5DEE8',
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: PROFILE_NAVY },
  heroText: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111',
    letterSpacing: -0.4,
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeActive: { backgroundColor: '#DDF4E4' },
  badgeMuted: { backgroundColor: '#EEE' },
  badgeText: { fontSize: 13, fontWeight: '700' },
  badgeTextActive: { color: '#2F9E5F' },
  badgeTextMuted: { color: '#6B7280' },
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: CREAM,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111',
    marginBottom: 10,
  },
  cardTitleSpaced: { marginTop: 14 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 7,
    gap: 8,
  },
  infoIcon: { marginTop: 1, width: 20 },
  infoLabel: { width: 108, color: LABEL, fontSize: 14, fontWeight: '500' },
  infoValue: { flex: 1, textAlign: 'right', color: VALUE, fontSize: 14, fontWeight: '500' },
  infoValueMulti: { lineHeight: 20 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    gap: 10,
  },
  summaryLabel: { color: LABEL, fontSize: 14, fontWeight: '600' },
  summaryValue: { flex: 1, textAlign: 'right', color: VALUE, fontSize: 14, fontWeight: '500' },
});
