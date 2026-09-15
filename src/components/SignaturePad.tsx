import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Polyline } from 'react-native-svg';
import { colors } from '../theme/colors';

type Props = {
  onChange: (svgPath: string | null) => void;
  height?: number;
};

/**
 * Lightweight electronic signature capture (draw + clear).
 * Stores strokes as an SVG path string for persistence / review.
 */
export function SignaturePad({ onChange, height = 160 }: Props) {
  const [strokes, setStrokes] = useState<string[][]>([]);
  const [current, setCurrent] = useState<string[]>([]);
  const sizeRef = useRef({ w: 1, h: 1 });
  const strokesRef = useRef<string[][]>([]);
  const currentRef = useRef<string[]>([]);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const all = [...strokes];
    if (current.length > 1) all.push(current);
    const path = all
      .filter((s) => s.length > 1)
      .map((s) => `M ${s.join(' L ')}`)
      .join(' ');
    onChangeRef.current(path || null);
  }, [strokes, current]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        const pt = `${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        currentRef.current = [pt];
        setCurrent([pt]);
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        const pt = `${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        const next = [...currentRef.current, pt];
        currentRef.current = next;
        setCurrent(next);
      },
      onPanResponderRelease: () => {
        const prev = currentRef.current;
        const stroke = prev.length === 1 ? [prev[0], prev[0]] : prev;
        currentRef.current = [];
        setCurrent([]);
        if (stroke.length > 1) {
          const next = [...strokesRef.current, stroke];
          strokesRef.current = next;
          setStrokes(next);
        }
      },
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    sizeRef.current = {
      w: e.nativeEvent.layout.width,
      h: e.nativeEvent.layout.height,
    };
  };

  const clear = () => {
    strokesRef.current = [];
    currentRef.current = [];
    setStrokes([]);
    setCurrent([]);
  };

  const hasInk = strokes.length > 0 || current.length > 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.label}>Signature</Text>
        {hasInk ? (
          <Pressable onPress={clear} hitSlop={8}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      <View
        style={[styles.pad, { height }]}
        onLayout={onLayout}
        {...pan.panHandlers}
      >
        {!hasInk ? <Text style={styles.placeholder}>DRAW TO SIGN</Text> : null}
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          {strokes.map((s, i) => (
            <Polyline
              key={`s-${i}`}
              points={s.join(' ')}
              fill="none"
              stroke="#0F172A"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {current.length > 1 ? (
            <Polyline
              points={current.join(' ')}
              fill="none"
              stroke="#0F172A"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {/* baseline */}
          <Path d={`M 16 ${height - 28} H ${Math.max(40, sizeRef.current.w - 16)}`} stroke="#CBD5E1" strokeWidth={1} />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  clear: { fontSize: 12, fontWeight: '700', color: colors.brandMagenta },
  pad: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    position: 'absolute',
    zIndex: 1,
    color: '#94A3B8',
    fontWeight: '800',
    letterSpacing: 1,
    fontSize: 13,
  },
});
