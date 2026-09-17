import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { BrandMark } from './BrandLogo';
import { canNavigateBack, safeGoBack } from '../utils/navigation';

export function AppShell({ children }: { children: React.ReactNode }) {
  return <View style={styles.shell}>{children}</View>;
}

export function AppHeader({
  title,
  actions,
  showLogo = true,
  showBack,
  onLogoPress,
  onBackPress,
}: {
  title: string;
  actions?: { icon: keyof typeof Ionicons.glyphMap; label?: string; onPress: () => void }[];
  /** White CT mark next to the title (default on) */
  showLogo?: boolean;
  /** Left back control. Default: show whenever any parent navigator has history. */
  showBack?: boolean;
  /** Defaults to navigating to the Home tab */
  onLogoPress?: () => void;
  onBackPress?: () => void;
}) {
  const navigation = useNavigation<any>();
  useNavigationState((s) => `${s?.key ?? ''}:${s?.index ?? 0}:${s?.routes?.length ?? 0}`);
  const insets = useSafeAreaInsets();
  // Equal padding above/below the logo row (status bar inset sits above that).
  const barPad = 12;
  const topPad = Math.max(insets.top, 0) + barPad;
  const backVisible = showBack ?? (Boolean(onBackPress) || canNavigateBack(navigation));
  const rightActions = (actions || []).filter(
    (a) => !(backVisible && (a.icon === 'arrow-back' || a.icon === 'close')),
  );
  const goHome = () => {
    if (onLogoPress) {
      onLogoPress();
      return;
    }
    navigation.navigate('Home');
  };
  const goBack = () => {
    if (onBackPress) {
      onBackPress();
      return;
    }
    safeGoBack(navigation);
  };

  return (
    <LinearGradient colors={[...colors.brandGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
      <View style={{ paddingTop: topPad, paddingBottom: barPad }}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {backVisible ? (
              <Pressable
                onPress={goBack}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={8}
                style={({ pressed }) => [
                  styles.headerAction,
                  styles.headerActionRound,
                  pressed && styles.headerActionPressed,
                ]}
              >
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </Pressable>
            ) : showLogo ? (
              <Pressable
                onPress={goHome}
                accessibilityRole="link"
                accessibilityLabel="Go to Home"
                hitSlop={8}
                style={({ pressed }) => [styles.logoBadge, pressed && { opacity: 0.85 }]}
              >
                <BrandMark size={22} tone="black" />
              </Pressable>
            ) : null}
            {backVisible && showLogo ? (
              <Pressable
                onPress={goHome}
                accessibilityRole="link"
                accessibilityLabel="Go to Home"
                hitSlop={8}
                style={({ pressed }) => [styles.logoBadge, pressed && { opacity: 0.85 }]}
              >
                <BrandMark size={22} tone="black" />
              </Pressable>
            ) : null}
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
          </View>
          {rightActions.length > 0 ? (
            <View style={styles.headerActions}>
              {rightActions.map((a, i) => (
                <Pressable
                  key={`${a.icon}-${i}`}
                  onPress={a.onPress}
                  style={({ pressed }) => [
                    styles.headerAction,
                    a.label ? styles.headerActionWide : styles.headerActionRound,
                    pressed && styles.headerActionPressed,
                  ]}
                >
                  <Ionicons name={a.icon} size={a.label ? 18 : 20} color="#fff" />
                  {a.label ? <Text style={styles.headerActionLabel}>{a.label}</Text> : null}
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </LinearGradient>
  );
}

export function LastUpdatedBar({ at }: { at: Date | null }) {
  const label = at
    ? `Last Updated at ${at.toLocaleString([], {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : 'Last Updated —';
  return (
    <LinearGradient colors={[...colors.brandGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.updatedBar}>
      <Text style={styles.updatedText}>{label}</Text>
    </LinearGradient>
  );
}

export function SearchBar({
  value,
  onChangeText,
  placeholder,
  onSubmit,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  onSubmit?: () => void;
}) {
  return (
    <View style={styles.searchWrap}>
      <Ionicons name="search" size={18} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.searchInput}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        autoCapitalize="none"
      />
    </View>
  );
}

export function SegmentTabs<T extends string>({
  tabs,
  value,
  onChange,
  colorsFor,
}: {
  tabs: { key: T; label: string; tint?: string }[];
  value: T;
  onChange: (key: T) => void;
  colorsFor?: (key: T, active: boolean) => string;
}) {
  return (
    <View style={styles.segments}>
      {tabs.map((t, idx) => {
        const active = t.key === value;
        const color =
          colorsFor?.(t.key, active) ||
          (active ? t.tint || colors.brandMagenta : colors.textMuted);
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={[
              styles.segment,
              idx < tabs.length - 1 && styles.segmentBorder,
              active && { borderBottomColor: color, borderBottomWidth: 2 },
            ]}
          >
            <Text style={[styles.segmentText, { color }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function OutlineButton({
  label,
  color,
  onPress,
  style,
}: {
  label: string;
  color: string;
  onPress: () => void;
  style?: ViewStyle;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.outlineBtn, { borderColor: color }, style]}>
      <Text style={[styles.outlineBtnText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function MenuRow({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: '#FAFAFA' }]}
    >
      <Ionicons name={icon} size={24} color={danger ? colors.danger : colors.ink} />
      <Text style={[styles.menuLabel, danger && { color: colors.danger }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export function OfflineCard({
  offline,
  onToggle,
  onDownload,
  downloading,
}: {
  offline: boolean;
  onToggle: (v: boolean) => void;
  onDownload: () => void;
  downloading?: boolean;
}) {
  return (
    <View style={styles.offlineCard}>
      <Text style={styles.offlineHint}>Going offline? Download all available visits.</Text>
      <Pressable onPress={onDownload} style={styles.downloadBtn} disabled={downloading}>
        <Ionicons name="cloud-download-outline" size={20} color={colors.brandMagenta} />
        <Text style={styles.downloadText}>{downloading ? 'Downloading…' : 'Download Visits'}</Text>
      </Pressable>
      <View style={styles.offlineToggleRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.offlineLabel}>Work Offline</Text>
          <Ionicons name="information-circle-outline" size={16} color={colors.brandMagenta} />
        </View>
        <Switch
          value={offline}
          onValueChange={onToggle}
          trackColor={{ false: '#d1d5db', true: '#f9a8d4' }}
          thumbColor={offline ? colors.brandMagenta : '#f4f3f4'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.surface },
  headerRow: {
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flexShrink: 1,
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerAction: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  headerActionRound: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerActionWide: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 20,
  },
  headerActionPressed: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  headerActionLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  updatedBar: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  updatedText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  searchWrap: {
    marginHorizontal: 14,
    marginVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, padding: 0 },
  segments: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: '#FAFAFA',
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  segmentBorder: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  segmentText: { fontWeight: '700', fontSize: 13 },
  outlineBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  outlineBtnText: { fontWeight: '700', fontSize: 15 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 58,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    color: colors.ink,
    fontWeight: '500',
    letterSpacing: -0.1,
    lineHeight: 22,
  },
  offlineCard: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  offlineHint: { color: colors.text, marginBottom: 12, fontSize: 14 },
  downloadBtn: {
    borderWidth: 1.5,
    borderColor: colors.brandMagenta,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#fff',
  },
  downloadText: { color: colors.brandMagenta, fontWeight: '700', fontSize: 15 },
  offlineToggleRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  offlineLabel: { fontSize: 15, fontWeight: '600', color: colors.ink },
});
