import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/ui';
import { BrandLogo } from '../../components/BrandLogo';
import { colors } from '../../theme/colors';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'RoleSelect'>;

export function RoleSelectScreen({ navigation }: Props) {
  return (
    <LinearGradient colors={[...colors.brandGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.hero}>
          <View style={styles.logoCard}>
            <BrandLogo size="lg" tone="black" />
          </View>
          <Text style={styles.tagline}>Patient care, reimagined.</Text>
        </View>
        <View style={styles.panel}>
          <Text style={styles.welcome}>Welcome</Text>
          <Text style={styles.hint}>Choose how you want to sign in.</Text>
          <Button label="Staff / Caregiver" onPress={() => navigation.navigate('StaffLogin')} />
          <Button label="Patient" onPress={() => navigation.navigate('PatientLogin')} variant="secondary" />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  hero: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  logoCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 22,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  tagline: {
    marginTop: 18,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontSize: 12,
    textAlign: 'center',
  },
  panel: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  welcome: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  hint: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 18,
  },
});
