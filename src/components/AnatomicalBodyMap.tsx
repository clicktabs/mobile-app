import React, { useMemo, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const BODY_MAP = require('../../assets/body-map.png');

/** Anatomical hotspots calibrated to front (left) / back (right) of body-map.png */
export type BodyMapRegion = {
  id: string;
  label: string;
  view: 'front' | 'back';
  /** 0–100 relative to map width */
  x: number;
  /** 0–100 relative to map height */
  y: number;
};

export const BODY_MAP_REGIONS: BodyMapRegion[] = [
  // Front (left figure)
  { id: 'front_head', label: 'Head (anterior)', view: 'front', x: 26, y: 8 },
  { id: 'front_neck', label: 'Neck (anterior)', view: 'front', x: 26, y: 16 },
  { id: 'front_chest', label: 'Chest', view: 'front', x: 26, y: 28 },
  { id: 'front_abdomen', label: 'Abdomen', view: 'front', x: 26, y: 40 },
  { id: 'front_r_arm', label: 'Right arm (ant.)', view: 'front', x: 12, y: 34 },
  { id: 'front_l_arm', label: 'Left arm (ant.)', view: 'front', x: 40, y: 34 },
  { id: 'front_r_hand', label: 'Right hand', view: 'front', x: 8, y: 48 },
  { id: 'front_l_hand', label: 'Left hand', view: 'front', x: 44, y: 48 },
  { id: 'front_r_hip', label: 'Right hip (ant.)', view: 'front', x: 20, y: 50 },
  { id: 'front_l_hip', label: 'Left hip (ant.)', view: 'front', x: 32, y: 50 },
  { id: 'front_r_thigh', label: 'Right thigh (ant.)', view: 'front', x: 20, y: 62 },
  { id: 'front_l_thigh', label: 'Left thigh (ant.)', view: 'front', x: 32, y: 62 },
  { id: 'front_r_knee', label: 'Right knee', view: 'front', x: 20, y: 72 },
  { id: 'front_l_knee', label: 'Left knee', view: 'front', x: 32, y: 72 },
  { id: 'front_r_lower', label: 'Right lower leg', view: 'front', x: 20, y: 84 },
  { id: 'front_l_lower', label: 'Left lower leg', view: 'front', x: 32, y: 84 },
  { id: 'front_r_foot', label: 'Right foot', view: 'front', x: 20, y: 95 },
  { id: 'front_l_foot', label: 'Left foot', view: 'front', x: 32, y: 95 },
  // Back (right figure)
  { id: 'back_head', label: 'Occiput', view: 'back', x: 74, y: 8 },
  { id: 'back_neck', label: 'Neck (posterior)', view: 'back', x: 74, y: 16 },
  { id: 'back_upper', label: 'Upper back', view: 'back', x: 74, y: 28 },
  { id: 'back_mid', label: 'Mid back', view: 'back', x: 74, y: 38 },
  { id: 'back_sacrum', label: 'Sacrum', view: 'back', x: 74, y: 50 },
  { id: 'back_r_scapula', label: 'Right scapula', view: 'back', x: 66, y: 28 },
  { id: 'back_l_scapula', label: 'Left scapula', view: 'back', x: 82, y: 28 },
  { id: 'back_r_arm', label: 'Right arm (post.)', view: 'back', x: 58, y: 34 },
  { id: 'back_l_arm', label: 'Left arm (post.)', view: 'back', x: 90, y: 34 },
  { id: 'back_r_hip', label: 'Right hip (post.)', view: 'back', x: 66, y: 50 },
  { id: 'back_l_hip', label: 'Left hip (post.)', view: 'back', x: 82, y: 50 },
  { id: 'back_r_buttock', label: 'Right buttock', view: 'back', x: 68, y: 54 },
  { id: 'back_l_buttock', label: 'Left buttock', view: 'back', x: 80, y: 54 },
  { id: 'back_r_thigh', label: 'Right thigh (post.)', view: 'back', x: 68, y: 66 },
  { id: 'back_l_thigh', label: 'Left thigh (post.)', view: 'back', x: 80, y: 66 },
  { id: 'back_r_heel', label: 'Right heel', view: 'back', x: 68, y: 95 },
  { id: 'back_l_heel', label: 'Left heel', view: 'back', x: 80, y: 95 },
];

export type BodyMapPin = {
  id: string | number;
  /** percent 0–100 */
  x: number;
  /** percent 0–100 */
  y: number;
  label?: string;
  regionId?: string;
  number?: string | number;
  multi?: boolean;
};

type Props = {
  pins?: BodyMapPin[];
  /** Active / editable pin (single selection mode) */
  activePin?: BodyMapPin | null;
  editable?: boolean;
  /** Default pin when empty (matches reference: sacrum on back) */
  defaultRegionId?: string;
  onPinChange?: (pin: BodyMapPin) => void;
  onPinPress?: (pin: BodyMapPin) => void;
  height?: number;
  showHint?: boolean;
};

function nearestRegion(x: number, y: number): BodyMapRegion {
  let best = BODY_MAP_REGIONS[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const r of BODY_MAP_REGIONS) {
    const dx = r.x - x;
    const dy = r.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = r;
    }
  }
  return best;
}

export function AnatomicalBodyMap({
  pins = [],
  activePin = null,
  editable = true,
  defaultRegionId = 'back_sacrum',
  onPinChange,
  onPinPress,
  height = 320,
  showHint = true,
}: Props) {
  const [size, setSize] = useState({ w: 1, h: 1 });

  const displayPins = useMemo(() => {
    if (pins.length) return pins;
    if (activePin) return [activePin];
    const def = BODY_MAP_REGIONS.find((r) => r.id === defaultRegionId) || BODY_MAP_REGIONS.find((r) => r.id === 'back_sacrum')!;
    return [
      {
        id: 'default',
        x: def.x,
        y: def.y,
        label: def.label,
        regionId: def.id,
      },
    ];
  }, [pins, activePin, defaultRegionId]);

  const onLayout = (e: LayoutChangeEvent) => {
    setSize({
      w: e.nativeEvent.layout.width,
      h: e.nativeEvent.layout.height,
    });
  };

  const handlePress = (evt: { nativeEvent: { locationX: number; locationY: number } }) => {
    if (!editable || !onPinChange) return;
    const x = Math.max(2, Math.min(98, (evt.nativeEvent.locationX / size.w) * 100));
    const y = Math.max(2, Math.min(98, (evt.nativeEvent.locationY / size.h) * 100));
    const region = nearestRegion(x, y);
    onPinChange({
      id: 'active',
      x,
      y,
      label: region.label,
      regionId: region.id,
    });
  };

  return (
    <View style={styles.wrap}>
      <Pressable onPress={handlePress} onLayout={onLayout} style={[styles.mapBox, { height }]}>
        <Image source={BODY_MAP} style={styles.image} resizeMode="contain" />
        {displayPins.map((pin) => {
          const left = (pin.x / 100) * size.w;
          const top = (pin.y / 100) * size.h;
          const isActive = activePin ? String(activePin.id) === String(pin.id) : pin.id === 'active' || pin.id === 'default';
          const pinColor = pin.multi ? '#7C3AED' : '#22C55E';
          return (
            <Pressable
              key={String(pin.id)}
              onPress={(e) => {
                e.stopPropagation?.();
                onPinPress?.(pin);
              }}
              style={[
                styles.pinWrap,
                {
                  left: left - 18,
                  top: top - 36,
                },
              ]}
            >
              <View style={[styles.glow, { backgroundColor: pin.multi ? 'rgba(124,58,237,0.28)' : 'rgba(34,197,94,0.28)' }]} />
              <Ionicons name="location-sharp" size={36} color={pinColor} style={styles.pinIcon} />
              {pin.number != null ? (
                <View style={[styles.badge, isActive && styles.badgeOn]}>
                  <Text style={styles.badgeText}>{pin.number}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </Pressable>
      {showHint ? (
        <Text style={styles.hint}>
          {editable ? 'Tap the body map to drop a pin (front left · back right).' : 'Wound locations marked on the body map.'}
        </Text>
      ) : null}
      {(activePin || displayPins[0])?.label ? (
        <View style={styles.locRow}>
          <Ionicons name="location" size={16} color="#16A34A" />
          <Text style={styles.locText}>{(activePin || displayPins[0])?.label}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function regionById(id: string | undefined | null): BodyMapRegion | undefined {
  if (!id) return undefined;
  return BODY_MAP_REGIONS.find((r) => r.id === id);
}

export function pinFromRegionId(regionId: string, id: string | number = 'active'): BodyMapPin {
  const r = regionById(regionId) || BODY_MAP_REGIONS.find((x) => x.id === 'back_sacrum')!;
  return { id, x: r.x, y: r.y, label: r.label, regionId: r.id };
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  mapBox: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  pinWrap: {
    position: 'absolute',
    width: 36,
    height: 44,
    alignItems: 'center',
    zIndex: 5,
  },
  glow: {
    position: 'absolute',
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  pinIcon: {
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeOn: { backgroundColor: '#166534' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  hint: { fontSize: 12, color: '#64748B', lineHeight: 17 },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  locText: { flex: 1, color: '#166534', fontWeight: '700', fontSize: 13 },
});
