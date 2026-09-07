import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Field, Screen, Subtitle, Title } from '../../components/ui';
import { BrandLogo } from '../../components/BrandLogo';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import type { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';

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
      await loginStaff(email, password);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Authentication failed';
      Alert.alert('Sign in failed', message);
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
          <Title>Staff sign in</Title>
          <Subtitle>Use your Click Tabs email and password.</Subtitle>
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
          <Button label="Patient login" onPress={() => navigation.navigate('PatientLogin')} variant="ghost" />
          <Button label="Back" onPress={() => navigation.goBack()} variant="ghost" />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { marginBottom: 18 },
  toggle: {
    color: colors.brandMagenta,
    marginBottom: 8,
    fontWeight: '600',
  },
});
