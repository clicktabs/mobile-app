import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Field, Screen } from '../../components/ui';
import { BrandLogo } from '../../components/BrandLogo';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import type { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { showAlert } from '../../utils/confirm';

type Props = NativeStackScreenProps<AuthStackParamList, 'PatientLogin'>;

export function PatientLoginScreen({ navigation }: Props) {
  const { loginPatient } = useAuth();
  const [email, setEmail] = useState('');
  const [credentialType, setCredentialType] = useState<'dob' | 'mrn'>('dob');
  const [credential, setCredential] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email.trim() || !credential.trim()) {
      showAlert('Missing fields', 'Email and credential are required.');
      return;
    }
    setLoading(true);
    try {
      await loginPatient(email, credential, credentialType);
    } catch (e) {
      showAlert('Sign in failed', e instanceof ApiError ? e.message : 'Invalid credentials');
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
            <LinearGradient
              colors={[...colors.brandGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.accentBar}
            />
            <Text style={styles.eyebrow}>PATIENT PORTAL</Text>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Sign in with your email plus date of birth or MRN to view your care schedule and messages.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="patient@email.com"
            />
            <Text style={styles.label}>Credential type</Text>
            <View style={styles.row}>
              {(['dob', 'mrn'] as const).map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setCredentialType(type)}
                  style={[styles.chip, credentialType === type && styles.chipActive]}
                >
                  <Text style={[styles.chipText, credentialType === type && styles.chipTextActive]}>
                    {type === 'dob' ? 'Date of birth' : 'MRN'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Field
              label={credentialType === 'dob' ? 'Date of birth (YYYY-MM-DD)' : 'MRN'}
              value={credential}
              onChangeText={setCredential}
              placeholder={credentialType === 'dob' ? '1990-01-15' : 'MRN123'}
              autoCapitalize="none"
            />
            <Button label="Sign In" onPress={onSubmit} loading={loading} />
          </View>

          <View style={styles.footerLinks}>
            <Button label="Staff login" onPress={() => navigation.navigate('StaffLogin')} variant="ghost" />
            <Button label="Back" onPress={() => navigation.goBack()} variant="ghost" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#FAF8F7' },
  brand: { marginBottom: 28, marginTop: 4 },
  hero: { marginBottom: 22 },
  accentBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: colors.brandMagenta,
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.ink,
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
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.04)',
    elevation: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    color: colors.text,
  },
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.brandPink,
    borderColor: colors.brandPink,
  },
  chipText: { color: colors.text, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  footerLinks: { marginTop: 8 },
});
