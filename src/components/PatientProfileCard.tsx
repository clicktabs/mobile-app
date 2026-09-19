import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

export const PROFILE_NAVY = colors.secondary;

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
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
        ) : (
          <View style={styles.headerBtn} />
        )}
        <Text style={styles.headerTitle}>{title}</Text>
        {onMenu ? (
          <Pressable onPress={onMenu} hitSlop={8} style={styles.headerBtn} accessibilityLabel="More options">
            <Ionicons name="ellipsis-vertical" size={20} color="#FFFFFF" />
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
  isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  multiline?: boolean;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.infoRow, isLast && styles.noBorder]}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, multiline && styles.infoValueMulti]}>{value}</Text>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  isLast,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.summaryRow, isLast && styles.noBorder]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

export function PatientProfileCard({ patient }: { patient: PatientProfileData }) {
  const name = dash(patient.name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim());
  const status = formatStatus(patient.status);
  const statusLower = String(patient.status || 'active').toLowerCase();
  const isActive = statusLower === 'active';
  const isPending = statusLower === 'pending';
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
    <View style={styles.root}>
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
          <View
            style={[
              styles.badge,
              isActive ? styles.badgeActive : isPending ? styles.badgePending : styles.badgeMuted,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                isActive ? styles.badgeTextActive : isPending ? styles.badgeTextPending : styles.badgeTextMuted,
              ]}
            >
              {status}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.accentBar} />
          <Text style={styles.cardTitle}>Patient Information</Text>
        </View>
        <InfoRow icon="person-outline" label="Full Name" value={name} />
        <InfoRow icon="calendar-outline" label="Date of Birth" value={formatDob(dob, patient.age)} />
        <InfoRow icon="card-outline" label="MRN" value={dash(patient.mrn)} />
        <InfoRow icon="call-outline" label="Phone" value={formatPhone(patient.phone)} />
        <InfoRow
          icon="location-outline"
          label="Address"
          value={[addr.line1, addr.line2].filter(Boolean).join('\n')}
          multiline
          isLast
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.accentBar} />
          <Text style={styles.cardTitle}>Clinical Summary</Text>
        </View>
        <SummaryRow label="Episode:" value={formatEpisode(patient.episode)} />
        <SummaryRow label="Start of Care:" value={formatPretty(patient.start_of_care_date || patient.admission_date)} />
        <SummaryRow label="Emergency Triage:" value={formatTriage(patient.emergency_triage_level)} />
        <SummaryRow label="Primary Contact:" value={primaryContact} isLast />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.accentBar} />
          <Text style={styles.cardTitle}>Care Team</Text>
        </View>
        <SummaryRow label="Clinical Manager:" value={dash(patient.clinical_manager)} />
        <SummaryRow label="Attending Physician:" value={formatPhysician(patient.attending_physician)} isLast />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.bg,
    paddingBottom: 24,
  },
  header: {
    backgroundColor: colors.primary, // Signature Medical Red (#DC2626)
    borderBottomWidth: 1,
    borderBottomColor: '#B91C1C',
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
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    gap: 16,
    backgroundColor: colors.bg,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FFFFFF',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: colors.primary,
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 4px 10px rgba(220, 38, 38, 0.12)',
    elevation: 3,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.secondary,
    letterSpacing: -0.5,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 23,
    fontWeight: '800',
    color: colors.secondary,
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  badgeMuted: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeTextActive: {
    color: '#15803D',
  },
  badgeTextPending: {
    color: '#B45309',
  },
  badgeTextMuted: {
    color: '#64748B',
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: '#FFFFFF', // Clean White Card (replaces old yellow-cream)
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0px 3px 12px rgba(0, 0, 0, 0.04)',
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  accentBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: colors.primary, // Red indicator bar
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.secondary,
    letterSpacing: -0.2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    gap: 10,
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    width: 104,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    color: colors.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  infoValueMulti: {
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    gap: 10,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  summaryValue: {
    flex: 1,
    textAlign: 'right',
    color: colors.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
