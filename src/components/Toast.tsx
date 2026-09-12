import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

export type ToastType = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  title: string;
  message?: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (title: string, message?: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let externalShow: ToastContextValue['showToast'] | null = null;

/** Works outside React components (and replaces window.alert). */
export function showToast(title: string, message?: string, type: ToastType = 'info') {
  if (externalShow) {
    externalShow(title, message, type);
    return;
  }
  // Fallback before provider mounts
  if (typeof window !== 'undefined') {
    window.alert(message ? `${title}\n\n${message}` : title);
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -12, duration: 180, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [opacity, translateY]);

  const showToastFn = useCallback(
    (title: string, message?: string, type: ToastType = 'info') => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ id: Date.now(), title, message, type });
      opacity.setValue(0);
      translateY.setValue(-12);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
      timer.current = setTimeout(hide, message ? 3500 : 2500);
    },
    [hide, opacity, translateY],
  );

  useEffect(() => {
    externalShow = showToastFn;
    return () => {
      externalShow = null;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [showToastFn]);

  const value = useMemo(() => ({ showToast: showToastFn }), [showToastFn]);

  const palette =
    toast?.type === 'success'
      ? { bg: '#ECFDF5', border: '#6EE7B7', icon: 'checkmark-circle' as const, tint: colors.success }
      : toast?.type === 'error'
        ? { bg: '#FEF2F2', border: '#FECACA', icon: 'alert-circle' as const, tint: colors.danger }
        : { bg: '#FFF7ED', border: '#FDBA74', icon: 'information-circle' as const, tint: '#EA580C' };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrap,
            {
              top: Math.max(insets.top, 12) + 8,
              opacity,
              transform: [{ translateY }],
            },
          ]}
        >
          <Pressable onPress={hide} style={[styles.toast, { backgroundColor: palette.bg, borderColor: palette.border }]}>
            <Ionicons name={palette.icon} size={22} color={palette.tint} />
            <View style={styles.textCol}>
              <Text style={[styles.title, { color: colors.ink }]}>{toast.title}</Text>
              {toast.message ? <Text style={styles.message}>{toast.message}</Text> : null}
            </View>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 20,
    alignItems: 'center',
  },
  toast: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    boxShadow: '0px 6px 16px rgba(0, 0, 0, 0.12)',
  },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontWeight: '800', fontSize: 14 },
  message: { marginTop: 2, color: colors.textMuted, fontSize: 13, lineHeight: 18 },
});
