import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BrandLogo } from '../../components/BrandLogo';
import { Button, Field, Screen } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import type { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { showAlert } from '../../utils/confirm';

type Props = NativeStackScreenProps<AuthStackParamList, 'StaffLogin'>;

export function StaffLoginScreen({ navigation }: Props) {
  const { loginStaff } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const onSubmit = async () => {
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter a valid email';
    if (!password) next.password = 'Password is required';
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await loginStaff(email.trim(), password);
    } catch (err: unknown) {
      const e = err as ApiError;
      showAlert('Sign In Failed', e.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.brand}>
            <BrandLogo size="md" tone="black" />
          </View>

          <View style={styles.hero}>
            <View style={styles.accentBar} />
            <Text style={styles.eyebrow}>STAFF / CAREGIVER</Text>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Sign in with your Click Tabs work email and password to access visits, patients, and messaging.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              error={errors.email}
              placeholder="name@organization.com"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              error={errors.password}
              placeholder="••••••••"
            />
            <Text onPress={() => setShowPassword((v) => !v)} style={styles.toggle}>
              {showPassword ? 'Hide password' : 'Show password'}
            </Text>
            <Button label="Sign In" onPress={onSubmit} loading={loading} />
          </View>

          <View style={styles.footerLinks}>
            {/* <Button label="Patient login" onPress={() => navigation.navigate('PatientLogin')} variant="ghost" /> */}
            <Button label="Back" onPress={() => navigation.goBack()} variant="ghost" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  brand: { marginBottom: 8, marginTop: 2 },
  hero: { marginBottom: 18, marginTop: 8 },
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
    fontSize: 30,
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
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.04)',
    elevation: 2,
  },
  toggle: {
    color: colors.primary,
    marginBottom: 4,
    marginTop: -4,
    fontWeight: '600',
    fontSize: 14,
  },
  footerLinks: { marginTop: 8 },
});
