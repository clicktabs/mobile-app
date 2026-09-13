import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
  TextInputProps,
  ScrollView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

export function Screen({
  children,
  style,
  scroll,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  scroll?: boolean;
}) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.screenPad, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenPad, { flex: 1 }, style]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {body}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function Card({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={styles.card}>{children}</View>;
}

export function Button({
  label,
  onPress,
  loading,
  variant = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void | Promise<void>;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
}) {
  const isPrimary = variant === 'primary';
  const bg =
    variant === 'secondary'
      ? colors.ink
      : variant === 'danger'
        ? colors.danger
        : variant === 'ghost'
          ? 'transparent'
          : colors.brandPink;
  const textColor = variant === 'ghost' ? colors.brandMagenta : '#fff';

  const content = loading ? (
    <ActivityIndicator color={textColor} />
  ) : (
    <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>
  );

  if (isPrimary) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.buttonOuter,
          { opacity: disabled || loading ? 0.55 : pressed ? 0.9 : 1 },
        ]}
      >
        <LinearGradient
          colors={[...colors.brandGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.buttonFill}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled || loading ? 0.55 : pressed ? 0.88 : 1 },
        variant === 'ghost' && styles.ghostButton,
      ]}
    >
      {content}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string; error?: string }) {
  const { label, error, style, ...rest } = props;
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

export function EmptyState({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{message}</Text>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="ghost" /> : null}
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorBannerText}>{message}</Text>
      {onRetry ? <Button label="Retry" onPress={onRetry} variant="ghost" /> : null}
    </View>
  );
}

export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function LoadingBlock() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.brandPink} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  screenPad: {
    padding: 20,
    paddingBottom: Platform.OS === 'web' ? 32 : 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 8,
    letterSpacing: -0.25,
    lineHeight: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 6,
    letterSpacing: -0.1,
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 16,
    lineHeight: 21,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)',
    elevation: 1,
  },
  buttonOuter: {
    marginTop: 10,
    borderRadius: 14,
    overflow: 'hidden',
  },
  buttonFill: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  fieldWrap: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 8,
    letterSpacing: 0.15,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    color: colors.danger,
    marginTop: 4,
    fontSize: 12,
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorBannerText: {
    color: colors.danger,
    marginBottom: 4,
  },
  stat: {
    flex: 1,
    minWidth: 96,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.brandMagenta,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: colors.bg,
  },
});
