import React from 'react';
import { Pressable, StyleSheet, Text, View, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { BrandLogo } from '../../components/BrandLogo';
import { MedicalHeroAnimation } from '../../components/MedicalHeroAnimation';
import { Screen } from '../../components/ui';
import { colors } from '../../theme/colors';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'RoleSelect'>;

export function RoleSelectScreen({ navigation }: Props) {
  return (
    <Screen style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.brand}>
          <BrandLogo size="md" tone="black" />
        </View>

        <MedicalHeroAnimation size="sm" />

        <View style={styles.hero}>
          <View style={styles.accentBar} />
          <Text style={styles.eyebrow}>CLICK TABS MOBILE</Text>
          <Text style={styles.title}>Welcome</Text>
          <Text style={styles.subtitle}>
            Patient care, clinical documentation, and electronic visit verification. Choose your portal to continue:
          </Text>
        </View>

        <View style={styles.cardsWrap}>
          {/* Staff & Caregiver Card */}
          <Pressable
            onPress={() => navigation.navigate('StaffLogin')}
            style={({ pressed }) => [styles.roleCard, pressed && styles.roleCardPressed]}
            accessibilityRole="button"
            accessibilityLabel="Staff and Caregiver Sign In"
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconWrap, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="medical" size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Staff / Caregiver</Text>
                <Text style={styles.cardSub}>Visits, EVV, charts & schedule</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </View>
            <View style={styles.cardBtnRed}>
              <Text style={styles.cardBtnRedText}>Sign in as Staff</Text>
            </View>
          </Pressable>

          {/* Patient Portal Card (Commented out per request)
          <Pressable
            onPress={() => navigation.navigate('PatientLogin')}
            style={({ pressed }) => [styles.roleCard, pressed && styles.roleCardPressed]}
            accessibilityRole="button"
            accessibilityLabel="Patient Sign In"
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconWrap, { backgroundColor: '#F1F5F9' }]}>
                <Ionicons name="person" size={24} color={colors.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Patient Portal</Text>
                <Text style={styles.cardSub}>Care plans, meds & appointments</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.secondary} />
            </View>
            <View style={styles.cardBtnBlack}>
              <Text style={styles.cardBtnBlackText}>Sign in as Patient</Text>
            </View>
          </Pressable>
          */}
        </View>

        <View style={styles.securityBadge}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.textMuted} />
          <Text style={styles.securityText}>HIPAA Compliant & Secure Medical System</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  scroll: { paddingBottom: 32 },
  brand: { marginBottom: 4, marginTop: 2 },
  hero: { marginBottom: 18, marginTop: 4 },
  accentBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
    backgroundColor: colors.primary,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: colors.primary,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.secondary,
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    maxWidth: 340,
  },
  cardsWrap: {
    gap: 14,
    marginBottom: 24,
  },
  roleCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.04)',
    elevation: 2,
  },
  roleCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.secondary,
    letterSpacing: -0.2,
  },
  cardSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  cardBtnRed: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBtnRedText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  cardBtnBlack: {
    backgroundColor: colors.secondary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBtnBlackText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  securityText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
