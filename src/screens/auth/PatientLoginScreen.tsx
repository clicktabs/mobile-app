import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Field, Screen, Subtitle, Title } from '../../components/ui';
import { BrandLogo } from '../../components/BrandLogo';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import type { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<AuthStackParamList, 'PatientLogin'>;

export function PatientLoginScreen({ navigation }: Props) {
  const { loginPatient } = useAuth();
  const [email, setEmail] = useState('');
  const [credentialType, setCredentialType] = useState<'dob' | 'mrn'>('dob');
  const [credential, setCredential] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email.trim() || !credential.trim()) {
      Alert.alert('Missing fields', 'Email and credential are required.');
      return;
    }
    setLoading(true);
    try {
      await loginPatient(email, credential, credentialType);
    } catch (e) {
      Alert.alert('Sign in failed', e instanceof ApiError ? e.message : 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.brand}>
            <BrandLogo size="sm" tone="black" />
          </View>
          <Title>Patient sign in</Title>
          <Subtitle>Sign in with email plus date of birth or MRN.</Subtitle>
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
          <Button label="Staff login" onPress={() => navigation.navigate('StaffLogin')} variant="ghost" />
          <Button label="Back" onPress={() => navigation.goBack()} variant="ghost" />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { marginBottom: 18 },
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
});
