import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
};

type Pending = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

let externalConfirm: ConfirmContextValue['confirm'] | null = null;

/** Works outside React components (replaces window.confirm / Alert.alert). */
export function requestConfirm(options: ConfirmOptions): Promise<boolean> {
  if (externalConfirm) {
    return externalConfirm(options);
  }
  // Fallback before provider mounts
  if (typeof window !== 'undefined') {
    const text = options.message
      ? `${options.title}\n\n${options.message}`
      : options.title;
    return Promise.resolve(window.confirm(text));
  }
  return Promise.resolve(true);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  useEffect(() => {
    externalConfirm = confirm;
    return () => {
      externalConfirm = null;
    };
  }, [confirm]);

  const close = useCallback((value: boolean) => {
    setPending((cur) => {
      cur?.resolve(value);
      return null;
    });
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  const destructive = !!pending?.destructive;
  const confirmLabel = pending?.confirmLabel || (destructive ? 'Confirm' : 'OK');
  const cancelLabel = pending?.cancelLabel || 'Cancel';
  const icon =
    pending?.icon ||
    (destructive ? 'warning-outline' : 'help-circle-outline');

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        visible={!!pending}
        transparent
        animationType="fade"
        onRequestClose={() => close(false)}
      >
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => close(false)} />
          <View style={styles.card}>
            <View
              style={[
                styles.iconWrap,
                destructive ? styles.iconWrapDanger : styles.iconWrapBrand,
              ]}
            >
              <Ionicons
                name={icon}
                size={28}
                color={destructive ? colors.danger : colors.primary}
              />
            </View>
            <Text style={styles.title}>{pending?.title}</Text>
            {pending?.message ? (
              <Text style={styles.message}>{pending.message}</Text>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                onPress={() => close(false)}
                style={({ pressed }) => [styles.btnCancel, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.btnCancelText}>{cancelLabel}</Text>
              </Pressable>

              {destructive ? (
                <Pressable
                  onPress={() => close(true)}
                  style={({ pressed }) => [styles.btnDanger, pressed && { opacity: 0.9 }]}
                >
                  <Text style={styles.btnPrimaryText}>{confirmLabel}</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => close(true)}
                  style={({ pressed }) => [styles.btnPrimaryWrap, pressed && { opacity: 0.92 }]}
                >
                  <View style={styles.btnPrimary}>
                    <Text style={styles.btnPrimaryText}>{confirmLabel}</Text>
                  </View>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,17,17,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0px 12px 24px rgba(0, 0, 0, 0.18)',
    elevation: 12,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    alignSelf: 'center',
  },
  iconWrapBrand: {
    backgroundColor: colors.primaryLight,
  },
  iconWrapDanger: {
    backgroundColor: '#FEF2F2',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btnCancel: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelText: {
    fontWeight: '700',
    fontSize: 15,
    color: colors.text,
  },
  btnPrimaryWrap: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  btnPrimary: {
    backgroundColor: colors.primary,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDanger: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: colors.danger,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
});
