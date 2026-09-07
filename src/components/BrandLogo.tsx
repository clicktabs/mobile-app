import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';

export type LogoTone = 'black' | 'white';

type Props = {
  size?: 'sm' | 'md' | 'lg';
  /** black on white/light screens; white on colored/dark screens */
  tone?: LogoTone;
  markOnly?: boolean;
  style?: StyleProp<ViewStyle>;
};

const SIZES = {
  sm: { h: 36, mark: 28 },
  md: { h: 52, mark: 40 },
  lg: { h: 72, mark: 56 },
};

function toneColor(tone: LogoTone) {
  return tone === 'white' ? '#FFFFFF' : '#111111';
}

/** CT monogram mark (SVG) */
export function BrandMark({
  size = 40,
  tone = 'black',
  style,
}: {
  size?: number;
  tone?: LogoTone;
  style?: StyleProp<ViewStyle>;
}) {
  const color = toneColor(tone);
  return (
    <View style={style} accessibilityLabel="Click Tabs">
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Path
          fill={color}
          d="M32 6c-14.36 0-26 11.64-26 26s11.64 26 26 26 26-11.64 26-26c0-3.2-.58-6.26-1.64-9.08l-7.9 2.7A18.1 18.1 0 0 1 50 32c0 9.94-8.06 18-18 18S14 41.94 14 32 22.06 14 32 14c3.42 0 6.6.96 9.32 2.62l4.7-6.48A25.8 25.8 0 0 0 32 6z"
        />
        <Path fill={color} d="M24 22h22v7.2H37.2V48h-8.4V29.2H24V22z" />
      </Svg>
    </View>
  );
}

/** Full Click Tabs TECHNOLOGY lockup (SVG) */
export function BrandLogo({ size = 'md', tone = 'black', markOnly = false, style }: Props) {
  const s = SIZES[size];
  const color = toneColor(tone);

  if (markOnly) {
    return <BrandMark size={s.mark} tone={tone} style={style} />;
  }

  const width = s.h * 2.7;
  const height = s.h;

  return (
    <View style={[styles.wrap, style]} accessibilityLabel="Click Tabs TECHNOLOGY">
      <Svg width={width} height={height} viewBox="0 0 320 120">
        <Path
          fill={color}
          d="M52 12c-24.3 0-44 19.7-44 44s19.7 44 44 44 44-19.7 44-44c0-5.4-1-10.6-2.8-15.4l-13.4 4.6A30.6 30.6 0 0 1 82.6 56c0 16.8-13.6 30.4-30.4 30.4S21.8 72.8 21.8 56 35.4 25.6 52.2 25.6c5.8 0 11.2 1.6 15.8 4.4l8-11A43.7 43.7 0 0 0 52 12z"
        />
        <Path fill={color} d="M38.5 39h37.2v12.2H60.8V82H46.6V51.2H38.5V39z" />
        <SvgText
          x="112"
          y="58"
          fill={color}
          fontSize="36"
          fontWeight="800"
          fontFamily="System"
          letterSpacing={-0.5}
        >
          Click Tabs
        </SvgText>
        <SvgText
          x="112"
          y="86"
          fill={color}
          fontSize="14"
          fontWeight="600"
          fontFamily="System"
          letterSpacing={4.5}
        >
          TECHNOLOGY
        </SvgText>
      </Svg>
    </View>
  );
}

export function BrandWordmark({ tone = 'black' }: { tone?: LogoTone }) {
  const titleColor = toneColor(tone);
  const subColor = tone === 'white' ? 'rgba(255,255,255,0.85)' : '#6B7280';
  return (
    <View style={styles.wordmark}>
      <BrandMark size={40} tone={tone} />
      <View>
        <Text style={[styles.wordmarkTitle, { color: titleColor }]}>Click Tabs</Text>
        <Text style={[styles.wordmarkSub, { color: subColor }]}>TECHNOLOGY</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-start',
  },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wordmarkTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  wordmarkSub: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2.4,
    marginTop: 1,
  },
});
