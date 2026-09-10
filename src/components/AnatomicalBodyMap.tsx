import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/** Clean front/back anatomical map (no baked-in pins). */
const BODY_MAP = require('../../assets/wound-body-map.png');
const IMG_W = 390;
const IMG_H = 386;
const IMG_ASPECT = IMG_W / IMG_H;

export type BodyMapRegion = {
  id: string;
  label: string;
  view: 'front' | 'back';
  x: number;
  y: number;
};

/** Hotspots as % of the image content (front left, back right). */
export const BODY_MAP_REGIONS: BodyMapRegion[] = [
  { id: 'front_head', label: 'Head (anterior)', view: 'front', x: 25, y: 8 },
  { id: 'front_neck', label: 'Neck (anterior)', view: 'front', x: 25, y: 16 },
  { id: 'front_chest', label: 'Chest', view: 'front', x: 25, y: 28 },
  { id: 'front_abdomen', label: 'Abdomen', view: 'front', x: 25, y: 40 },
  { id: 'front_r_arm', label: 'Right arm (ant.)', view: 'front', x: 12, y: 32 },
  { id: 'front_l_arm', label: 'Left arm (ant.)', view: 'front', x: 38, y: 32 },
  { id: 'front_r_hand', label: 'Right hand', view: 'front', x: 8, y: 48 },
  { id: 'front_l_hand', label: 'Left hand', view: 'front', x: 42, y: 48 },
  { id: 'front_r_hip', label: 'Right hip (ant.)', view: 'front', x: 19, y: 50 },
  { id: 'front_l_hip', label: 'Left hip (ant.)', view: 'front', x: 31, y: 50 },
  { id: 'front_r_thigh', label: 'Right thigh (ant.)', view: 'front', x: 19, y: 62 },
  { id: 'front_l_thigh', label: 'Left thigh (ant.)', view: 'front', x: 31, y: 62 },
  { id: 'front_r_knee', label: 'Right knee', view: 'front', x: 19, y: 74 },
  { id: 'front_l_knee', label: 'Left knee', view: 'front', x: 31, y: 74 },
  { id: 'front_r_lower', label: 'Right lower leg', view: 'front', x: 19, y: 86 },
  { id: 'front_l_lower', label: 'Left lower leg', view: 'front', x: 31, y: 86 },
  { id: 'front_r_foot', label: 'Right foot', view: 'front', x: 19, y: 96 },
  { id: 'front_l_foot', label: 'Left foot', view: 'front', x: 31, y: 96 },
  { id: 'back_head', label: 'Occiput', view: 'back', x: 75, y: 8 },
  { id: 'back_neck', label: 'Neck (posterior)', view: 'back', x: 75, y: 16 },
  { id: 'back_upper', label: 'Upper back', view: 'back', x: 75, y: 28 },
  { id: 'back_mid', label: 'Mid back', view: 'back', x: 75, y: 38 },
  { id: 'back_sacrum', label: 'Sacrum', view: 'back', x: 75, y: 49 },
  { id: 'back_r_scapula', label: 'Right scapula', view: 'back', x: 68, y: 28 },
  { id: 'back_l_scapula', label: 'Left scapula', view: 'back', x: 82, y: 28 },
  { id: 'back_r_arm', label: 'Right arm (post.)', view: 'back', x: 58, y: 32 },
  { id: 'back_l_arm', label: 'Left arm (post.)', view: 'back', x: 92, y: 32 },
  { id: 'back_r_hip', label: 'Right hip (post.)', view: 'back', x: 68, y: 49 },
  { id: 'back_l_hip', label: 'Left hip (post.)', view: 'back', x: 82, y: 49 },
  { id: 'back_r_buttock', label: 'Right buttock', view: 'back', x: 69, y: 54 },
  { id: 'back_l_buttock', label: 'Left buttock', view: 'back', x: 81, y: 54 },
  { id: 'back_r_thigh', label: 'Right thigh (post.)', view: 'back', x: 69, y: 66 },
  { id: 'back_l_thigh', label: 'Left thigh (post.)', view: 'back', x: 81, y: 66 },
  { id: 'back_r_knee', label: 'Right knee (post.)', view: 'back', x: 69, y: 75 },
  { id: 'back_l_knee', label: 'Left knee (post.)', view: 'back', x: 81, y: 75 },
  { id: 'back_r_lower', label: 'Right lower leg (post.)', view: 'back', x: 69, y: 85 },
  { id: 'back_l_lower', label: 'Left lower leg (post.)', view: 'back', x: 81, y: 85 },
  { id: 'back_r_heel', label: 'Right heel', view: 'back', x: 69, y: 96 },
  { id: 'back_l_heel', label: 'Left heel', view: 'back', x: 81, y: 96 },
];

export type BodyMapPin = {
  id: string | number;
  x: number;
  y: number;
  label?: string;
  regionId?: string;
  number?: string | number;
  multi?: boolean;
};

type Props = {
  pins?: BodyMapPin[];
  activePin?: BodyMapPin | null;
  editable?: boolean;
  defaultRegionId?: string;
  onPinChange?: (pin: BodyMapPin) => void;
  onPinPress?: (pin: BodyMapPin) => void;
  height?: number;
  showHint?: boolean;
  showLocationLabel?: boolean;
};

function contentRect(boxW: number, boxH: number) {
  const boxAspect = boxW / Math.max(boxH, 1);
  if (boxAspect > IMG_ASPECT) {
    const drawnH = boxH;
    const drawnW = boxH * IMG_ASPECT;
    return { offsetX: (boxW - drawnW) / 2, offsetY: 0, drawnW, drawnH };
  }
  const drawnW = boxW;
  const drawnH = boxW / IMG_ASPECT;
  return { offsetX: 0, offsetY: (boxH - drawnH) / 2, drawnW, drawnH };
}

function nearestRegion(x: number, y: number): BodyMapRegion {
  let best = BODY_MAP_REGIONS[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const r of BODY_MAP_REGIONS) {
    const d = (r.x - x) ** 2 + (r.y - y) ** 2;
    if (Number.isFinite(d) && d < bestDist) {
      bestDist = d;
      best = r;
    }
  }
  return best;
}

export function regionByExactLabel(label: string | undefined | null): BodyMapRegion | undefined {
  if (!label) return undefined;
  const needle = label.trim().toLowerCase();
  return BODY_MAP_REGIONS.find((r) => r.label.toLowerCase() === needle);
}

export function regionById(id: string | undefined | null): BodyMapRegion | undefined {
  if (!id) return undefined;
  return BODY_MAP_REGIONS.find((r) => r.id === id);
}

export function pinFromRegionId(regionId: string, id: string | number = 'active'): BodyMapPin {
  const r = regionById(regionId) || BODY_MAP_REGIONS.find((x) => x.id === 'back_sacrum')!;
  return { id, x: r.x, y: r.y, label: r.label, regionId: r.id };
}

export function AnatomicalBodyMap({
  pins = [],
  activePin = null,
  editable = true,
  onPinChange,
  onPinPress,
  height = 340,
  showHint = true,
  showLocationLabel = true,
}: Props) {
  const mapRef = useRef<View>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const displayPins = useMemo(() => {
    if (editable) return activePin ? [activePin] : [];

    const list = [...pins];
    const groups = new Map<string, BodyMapPin[]>();
    list.forEach((p) => {
      const key = `${Math.round(p.x)}:${Math.round(p.y)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    });
    const fanned: BodyMapPin[] = [];
    groups.forEach((group) => {
      if (group.length === 1) {
        fanned.push(group[0]);
        return;
      }
      group.forEach((p, i) => {
        const angle = (i / group.length) * Math.PI * 2;
        fanned.push({
          ...p,
          x: p.x + Math.cos(angle) * 2.4,
          y: p.y + Math.sin(angle) * 2.4,
          multi: true,
        });
      });
    });
    return fanned;
  }, [pins, activePin, editable]);

  const rect = useMemo(
    () => (size.w > 0 ? contentRect(size.w, size.h) : null),
    [size.w, size.h],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height: h } = e.nativeEvent.layout;
    if (width > 0 && h > 0) setSize({ w: width, h });
  };

  const placeAtLocal = useCallback(
    (localX: number, localY: number, boxW: number, boxH: number) => {
      if (!editable || !onPinChange || boxW <= 0 || boxH <= 0) return;
      if (!Number.isFinite(localX) || !Number.isFinite(localY)) return;

      const area = contentRect(boxW, boxH);
      if (
        localX < area.offsetX ||
        localX > area.offsetX + area.drawnW ||
        localY < area.offsetY ||
        localY > area.offsetY + area.drawnH
      ) {
        return;
      }

      const xPct = ((localX - area.offsetX) / area.drawnW) * 100;
      const yPct = ((localY - area.offsetY) / area.drawnH) * 100;
      if (!Number.isFinite(xPct) || !Number.isFinite(yPct)) return;

      const region = nearestRegion(xPct, yPct);
      onPinChange({
        id: 'active',
        x: region.x,
        y: region.y,
        label: region.label,
        regionId: region.id,
      });
    },
    [editable, onPinChange],
  );

  /**
   * Use pageX/pageY + measureInWindow.
   * Pressable locationX/locationY often returns 0/undefined on RN Web, which
   * made every tap snap to Head (anterior) — the first hotspot.
   */
  const handlePress = (evt: GestureResponderEvent) => {
    if (!editable || !onPinChange) return;
    const { pageX, pageY } = evt.nativeEvent;

    if (typeof pageX === 'number' && typeof pageY === 'number' && mapRef.current) {
      mapRef.current.measureInWindow((wx, wy, width, height) => {
        if (width > 0 && height > 0) {
          setSize({ w: width, h: height });
          placeAtLocal(pageX - wx, pageY - wy, width, height);
        }
      });
      return;
    }

    // Native fallback only when page coords missing
    const { locationX, locationY } = evt.nativeEvent;
    if (
      typeof locationX === 'number' &&
      typeof locationY === 'number' &&
      Number.isFinite(locationX) &&
      Number.isFinite(locationY) &&
      size.w > 0
    ) {
      placeAtLocal(locationX, locationY, size.w, size.h);
    }
  };

  const labelText = activePin?.label || (displayPins.length === 1 ? displayPins[0]?.label : undefined);

  return (
    <View style={styles.wrap}>
      <View ref={mapRef} onLayout={onLayout} style={[styles.mapBox, { height }]} collapsable={false}>
        <Pressable onPress={handlePress} style={StyleSheet.absoluteFill}>
          <View style={styles.image} pointerEvents="none">
            <Image source={BODY_MAP} style={styles.image} resizeMode="contain" />
          </View>
        </Pressable>

        {rect
          ? displayPins.map((pin) => {
              const left = rect.offsetX + (pin.x / 100) * rect.drawnW;
              const top = rect.offsetY + (pin.y / 100) * rect.drawnH;
              const color = pin.multi ? '#7C3AED' : '#16A34A';
              return (
                <View
                  key={String(pin.id)}
                  pointerEvents="none"
                  style={[styles.pinWrap, { left: left - 14, top: top - 30 }]}
                >
                  <Ionicons name="location-sharp" size={28} color={color} />
                  {pin.number != null ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{pin.number}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          : null}

        {/* Invisible hit targets for read-only pin press */}
        {!editable && rect
          ? displayPins.map((pin) => {
              const left = rect.offsetX + (pin.x / 100) * rect.drawnW;
              const top = rect.offsetY + (pin.y / 100) * rect.drawnH;
              return (
                <Pressable
                  key={`hit-${pin.id}`}
                  onPress={() => onPinPress?.(pin)}
                  style={[styles.pinHit, { left: left - 20, top: top - 36 }]}
                />
              );
            })
          : null}

        {editable && !activePin && showHint ? (
          <View style={styles.emptyOverlay} pointerEvents="none">
            <Text style={styles.emptyOverlayText}>Tap front or back to place pin</Text>
          </View>
        ) : null}
      </View>

      {showHint ? (
        <Text style={styles.hint}>
          {editable
            ? 'Tap once to place a pin. Tap another site to move it.'
            : displayPins.length
              ? `${displayPins.length} saved wound pin(s).`
              : 'No saved wound pins on this map yet.'}
        </Text>
      ) : null}

      {showLocationLabel && labelText ? (
        <View style={styles.locRow}>
          <Ionicons name="location" size={16} color="#16A34A" />
          <Text style={styles.locText}>{labelText}</Text>
        </View>
      ) : null}
    </View>
  );
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
  image: { width: '100%', height: '100%' },
  pinWrap: {
    position: 'absolute',
    width: 28,
    height: 32,
    alignItems: 'center',
    zIndex: 5,
  },
  pinHit: {
    position: 'absolute',
    width: 40,
    height: 44,
    zIndex: 6,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  emptyOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyOverlayText: {
    backgroundColor: 'rgba(15,23,42,0.6)',
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
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
