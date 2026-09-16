import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { patientProfileHeaderOffset } from './PatientProfileCard';

export type SlideDownMenuItem = {
  key: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  danger?: boolean;
  onPress: () => void;
};

export function SlideDownMenu({
  visible,
  onClose,
  items,
}: {
  visible: boolean;
  onClose: () => void;
  items: SlideDownMenuItem[];
}) {
  const insets = useSafeAreaInsets();
  const headerOffset = patientProfileHeaderOffset(insets);
  const [mounted, setMounted] = useState(visible);
  const [sheetHeight, setSheetHeight] = useState(240);
  const translateY = useRef(new Animated.Value(-240)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);

  const animateIn = (height: number) => {
    closing.current = false;
    translateY.setValue(-height);
    backdrop.setValue(0);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateOut = (then?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -sheetHeight,
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      closing.current = false;
      if (!finished) return;
      setMounted(false);
      then?.();
    });
  };

  useEffect(() => {
    if (visible) {
      setMounted(true);
    } else if (mounted) {
      animateOut();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (mounted && visible) {
      animateIn(sheetHeight);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const requestClose = () => {
    if (!visible) return;
    animateOut(onClose);
  };

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={requestClose}>
      <View style={styles.root} pointerEvents="box-none">
        <Pressable style={{ height: headerOffset }} onPress={requestClose} />
        <Animated.View
          pointerEvents="box-none"
          style={[styles.dim, { top: headerOffset, opacity: backdrop }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { top: headerOffset, transform: [{ translateY }] },
          ]}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0 && Math.abs(h - sheetHeight) > 1) setSheetHeight(h);
          }}
        >
          {items.map((item) => (
            <Pressable
              key={item.key}
              style={styles.row}
              onPress={() => {
                animateOut(() => {
                  onClose();
                  item.onPress();
                });
              }}
            >
              {item.icon ? (
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={item.danger ? colors.danger : colors.ink}
                />
              ) : null}
              <Text style={[styles.label, item.danger && styles.labelDanger]}>{item.label}</Text>
            </Pressable>
          ))}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingTop: 8,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  label: { fontSize: 16, fontWeight: '600', color: colors.ink },
  labelDanger: { color: colors.danger },
});
