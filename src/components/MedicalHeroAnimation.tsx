import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { colors } from '../theme/colors';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  showBadges?: boolean;
}

export function MedicalHeroAnimation({ size = 'md', showBadges = true }: Props) {
  const [hasLottieError, setHasLottieError] = useState(false);
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const floatAnim2 = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Subtle float animation for orbiting badges
    const anim1 = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim1, {
          toValue: 1,
          duration: 2600,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(floatAnim1, {
          toValue: 0,
          duration: 2600,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );

    const anim2 = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim2, {
          toValue: 1,
          duration: 3200,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(floatAnim2, {
          toValue: 0,
          duration: 3200,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );

    // Heartbeat pulse micro-animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 1000,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );

    anim1.start();
    anim2.start();
    pulse.start();

    return () => {
      anim1.stop();
      anim2.stop();
      pulse.stop();
    };
  }, [floatAnim1, floatAnim2, pulseAnim]);

  const translateY1 = floatAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6],
  });

  const translateY2 = floatAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 6],
  });

  const lottieSize = size === 'sm' ? 120 : size === 'lg' ? 170 : 144;
  const containerHeight = size === 'sm' ? 140 : size === 'lg' ? 190 : 160;

  return (
    <View style={[styles.root, { height: containerHeight }]}>
      {/* Soft ambient background glow */}
      <View style={[styles.glowRing, { width: lottieSize + 30, height: lottieSize + 30 }]} />

      {/* Floating Medical Badges matching user reference */}
      {showBadges && (
        <>
          {/* Top Pill badge */}
          <Animated.View style={[styles.badge, styles.badgeTop, { transform: [{ translateY: translateY1 }] }]}>
            <View style={styles.badgeInner}>
              <Ionicons name="medical" size={15} color={colors.primary} />
            </View>
          </Animated.View>

          {/* Top Right Heartbeat / Pulse badge */}
          <Animated.View
            style={[
              styles.badge,
              styles.badgeTopRight,
              { transform: [{ translateY: translateY2 }, { scale: pulseAnim }] },
            ]}
          >
            <View style={[styles.badgeInner, { backgroundColor: colors.primary }]}>
              <Ionicons name="pulse" size={15} color="#FFFFFF" />
            </View>
          </Animated.View>

          {/* Left Medical Kit badge */}
          <Animated.View style={[styles.badge, styles.badgeLeft, { transform: [{ translateY: translateY2 }] }]}>
            <View style={styles.badgeInner}>
              <Ionicons name="briefcase" size={14} color={colors.secondary} />
            </View>
          </Animated.View>

          {/* Bottom Left Syringe / Care badge */}
          <Animated.View style={[styles.badge, styles.badgeBottomLeft, { transform: [{ translateY: translateY1 }] }]}>
            <View style={styles.badgeInner}>
              <Ionicons name="eyedrop" size={14} color={colors.primary} />
            </View>
          </Animated.View>

          {/* Bottom Right Chat Consultation badge */}
          <Animated.View style={[styles.badge, styles.badgeBottomRight, { transform: [{ translateY: translateY1 }] }]}>
            <View style={styles.badgeInner}>
              <Ionicons name="chatbubble-ellipses" size={14} color={colors.secondary} />
            </View>
          </Animated.View>
        </>
      )}

      {/* Main Doctor Animation / Fallback */}
      {!hasLottieError ? (
        <LottieView
          source={require('../../assets/lottie/doctor-hero.json')}
          autoPlay
          loop
          style={{ width: lottieSize, height: lottieSize }}
          onAnimationFailure={() => setHasLottieError(true)}
          renderMode={Platform.OS === 'web' ? 'HARDWARE' : 'AUTOMATIC'}
        />
      ) : (
        <View style={[styles.fallbackDoctor, { width: lottieSize, height: lottieSize }]}>
          <View style={styles.fallbackCoat}>
            <Ionicons name="person" size={lottieSize * 0.55} color={colors.secondary} />
          </View>
          <View style={styles.fallbackClip}>
            <Ionicons name="clipboard" size={26} color={colors.primary} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
    position: 'relative',
    width: '100%',
  },
  glowRing: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#FEE2E2',
    opacity: 0.55,
  },
  badge: {
    position: 'absolute',
    zIndex: 10,
  },
  badgeInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    boxShadow: '0px 3px 8px rgba(0, 0, 0, 0.08)',
    elevation: 3,
  },
  badgeTop: {
    top: 2,
    alignSelf: 'center',
  },
  badgeTopRight: {
    top: 14,
    right: '18%',
  },
  badgeLeft: {
    left: '16%',
    top: '38%',
  },
  badgeBottomLeft: {
    bottom: 8,
    left: '20%',
  },
  badgeBottomRight: {
    bottom: 8,
    right: '18%',
  },
  fallbackDoctor: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fallbackCoat: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackClip: {
    position: 'absolute',
    bottom: 12,
    right: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
});
