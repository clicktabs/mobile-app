import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View, StyleSheet } from 'react-native';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  LoadingBlock,
  Screen,
  SectionTitle,
  Subtitle,
  Title,
} from '../../components/ui';
import { BrandLogo } from '../../components/BrandLogo';
import { useAuth } from '../../context/AuthContext';
import * as staffApi from '../../api/staff';
import { ApiError } from '../../api/client';
import { colors } from '../../theme/colors';
import { confirmAction, showAlert } from '../../utils/confirm';

export function StaffMoreScreen() {
  const { token, staffUser, logout, handleUnauthorized } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [tab, setTab] = useState<'menu' | 'messages' | 'time' | 'mileage' | 'password'>('menu');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, any>[]>([]);
  const [entries, setEntries] = useState<Record<string, any>[]>([]);
  const [mileage, setMileage] = useState<Record<string, any>[]>([]);
  const [totalMiles, setTotalMiles] = useState(0);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [miles, setMiles] = useState('');
  const [patientId, setPatientId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const openMessages = useCallback(async () => {
    if (!token) return;
    setTab('messages');
    setLoading(true);
    setError(null);
    try {
      const res = await staffApi.getStaffMessages(token);
      setMessages(res.data || []);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await handleUnauthorized();
      else setError(e instanceof ApiError ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [token, handleUnauthorized]);

  const openTime = useCallback(async () => {
    if (!token) return;
    setTab('time');
    setLoading(true);
    try {
      const res = await staffApi.getTimeEntries(token);
      setEntries(res.data || []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const openMileage = useCallback(async () => {
    if (!token) return;
    setTab('mileage');
    setLoading(true);
    try {
      const res = await staffApi.getMileage(token);
      setMileage(res.data || []);
      setTotalMiles(Number(res.total_miles || 0));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [token]);

  if (tab === 'menu') {
    return (
      <Screen scroll>
        <View style={styles.brandRow}>
          <BrandLogo size="sm" />
        </View>
        <Title>More</Title>
        <Subtitle>{staffUser?.email}</Subtitle>
        <Button label="Messages" onPress={openMessages} />
        <Button label="Time clock" onPress={openTime} variant="secondary" />
        <Button label="Mileage" onPress={openMileage} variant="secondary" />
        <Button label="Change password" onPress={() => setTab('password')} variant="ghost" />
        <Button
          label="Log out"
          variant="danger"
          loading={loggingOut}
          onPress={async () => {
            const ok = await confirmAction('Log out?', 'You will need to sign in again.');
            if (!ok) return;
            setLoggingOut(true);
            try {
              await logout();
            } finally {
              setLoggingOut(false);
            }
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Button label="← Back" onPress={() => setTab('menu')} variant="ghost" />
      {error ? <ErrorBanner message={error} /> : null}
      {loading ? (
        <LoadingBlock />
      ) : (
        <ScrollView refreshControl={<RefreshControl refreshing={false} onRefresh={() => {
          if (tab === 'messages') openMessages();
          if (tab === 'time') openTime();
          if (tab === 'mileage') openMileage();
        }} />}>
          {tab === 'messages' && (
            <>
              <Title>Messages</Title>
              <Field label="Recipient user ID" value={recipientId} onChangeText={setRecipientId} keyboardType="number-pad" />
              <Field label="Subject" value={subject} onChangeText={setSubject} />
              <Field label="Body" value={body} onChangeText={setBody} multiline style={{ minHeight: 80 }} />
              <Button
                label="Send"
                onPress={async () => {
                  if (!token) return;
                  try {
                    await staffApi.sendStaffMessage(token, {
                      recipient_ids: [Number(recipientId)],
                      subject,
                      body,
                    });
                    showAlert('Sent');
                    setSubject('');
                    setBody('');
                    openMessages();
                  } catch (e) {
                    showAlert('Failed', e instanceof ApiError ? e.message : 'Error');
                  }
                }}
              />
              {messages.length === 0 ? (
                <EmptyState message="Inbox empty" />
              ) : (
                messages.map((m) => (
                  <Card key={String(m.id)}>
                    <Text style={{ fontWeight: '700' }}>{String(m.subject)}</Text>
                    <Text style={{ color: colors.textMuted }}>{String(m.body)}</Text>
                  </Card>
                ))
              )}
            </>
          )}
          {tab === 'time' && (
            <>
              <Title>Time clock</Title>
              <Button
                label="Clock in"
                onPress={async () => {
                  if (!token) return;
                  try {
                    await staffApi.clockIn(token);
                    showAlert('Clocked in');
                    openTime();
                  } catch (e) {
                    showAlert('Failed', e instanceof ApiError ? e.message : 'Error');
                  }
                }}
              />
              <Button
                label="Clock out"
                variant="secondary"
                onPress={async () => {
                  if (!token) return;
                  try {
                    await staffApi.clockOut(token);
                    showAlert('Clocked out');
                    openTime();
                  } catch (e) {
                    showAlert('Failed', e instanceof ApiError ? e.message : 'Error');
                  }
                }}
              />
              {entries.map((e) => (
                <Card key={String(e.id)}>
                  <Text>
                    {String(e.clock_in)} → {String(e.clock_out || 'open')}
                  </Text>
                  <Text style={{ color: colors.textMuted }}>Hours: {String(e.hours ?? '—')}</Text>
                </Card>
              ))}
            </>
          )}
          {tab === 'mileage' && (
            <>
              <Title>Mileage</Title>
              <Subtitle>Total: {totalMiles} miles</Subtitle>
              <Field label="Patient ID" value={patientId} onChangeText={setPatientId} keyboardType="number-pad" />
              <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
              <Field label="Miles" value={miles} onChangeText={setMiles} keyboardType="decimal-pad" />
              <Button
                label="Record mileage"
                onPress={async () => {
                  if (!token) return;
                  try {
                    await staffApi.recordMileage(token, {
                      patient_id: Number(patientId),
                      date,
                      miles: Number(miles),
                    });
                    showAlert('Saved');
                    openMileage();
                  } catch (e) {
                    showAlert('Failed', e instanceof ApiError ? e.message : 'Error');
                  }
                }}
              />
              {mileage.map((m) => (
                <Card key={String(m.id)}>
                  <Text>
                    {String(m.date)} · {String(m.miles)} mi
                  </Text>
                </Card>
              ))}
            </>
          )}
          {tab === 'password' && (
            <>
              <SectionTitle>Change password</SectionTitle>
              <Text style={{ color: colors.textMuted, marginBottom: 18, lineHeight: 20, fontSize: 14 }}>
                Use a strong password you do not reuse elsewhere.
              </Text>
              <Field label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
              <Field label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
              <Field label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
              <Button
                label="Update password"
                onPress={async () => {
                  if (!token) return;
                  try {
                    await staffApi.staffChangePassword(token, currentPassword, newPassword, confirmPassword);
                    showAlert('Password changed');
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setTab('menu');
                  } catch (e) {
                    showAlert('Failed', e instanceof ApiError ? e.message : 'Error');
                  }
                }}
              />
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: {
    marginBottom: 12,
  },
});
