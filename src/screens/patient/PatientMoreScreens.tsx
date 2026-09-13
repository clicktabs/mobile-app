import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  LoadingBlock,
  Screen,
  Subtitle,
  Title,
} from '../../components/ui';
import { PatientProfileCard, PatientProfileHeader } from '../../components/PatientProfileCard';
import { SlideDownMenu } from '../../components/SlideDownMenu';
import { useAuth } from '../../context/AuthContext';
import * as patientApi from '../../api/patient';
import { ApiError } from '../../api/client';
import { colors } from '../../theme/colors';
import { confirmAction, showAlert } from '../../utils/confirm';

export function PatientMessagesScreen() {
  const { token, handleUnauthorized } = useAuth();
  const [items, setItems] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compose, setCompose] = useState(false);
  const [recipientId, setRecipientId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const res = await patientApi.patientMessages(token);
      setItems(res.data || []);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await handleUnauthorized();
      else setError(e instanceof ApiError ? e.message : 'Failed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  if (loading) return <LoadingBlock />;

  return (
    <Screen>
      <Title>Messages</Title>
      <Button label={compose ? 'Close compose' : 'Compose'} onPress={() => setCompose((v) => !v)} variant="secondary" />
      {compose && (
        <>
          <Field label="Recipient user ID" value={recipientId} onChangeText={setRecipientId} keyboardType="number-pad" />
          <Field label="Subject" value={subject} onChangeText={setSubject} />
          <Field label="Body" value={body} onChangeText={setBody} multiline style={{ minHeight: 80 }} />
          <Button
            label="Send"
            loading={sending}
            onPress={async () => {
              if (!token) return;
              setSending(true);
              try {
                await patientApi.sendPatientMessage(token, {
                  recipient_ids: [Number(recipientId)],
                  subject,
                  body,
                });
                showAlert('Message sent');
                setCompose(false);
                setSubject('');
                setBody('');
                load();
              } catch (e) {
                showAlert('Failed', e instanceof ApiError ? e.message : 'Error');
              } finally {
                setSending(false);
              }
            }}
          />
        </>
      )}
      {error ? <ErrorBanner message={error} onRetry={load} /> : null}
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
      >
        {items.length === 0 ? (
          <EmptyState message="Inbox empty" />
        ) : (
          items.map((m) => (
            <Card
              key={String(m.id)}
              onPress={async () => {
                if (!token) return;
                await patientApi.markMessageRead(token, Number(m.id));
                load();
              }}
            >
              <Text style={{ fontWeight: '700' }}>
                {m.is_read ? '' : '• '}
                {String(m.subject)}
              </Text>
              <Text style={{ color: colors.textMuted }} numberOfLines={2}>
                {String(m.body)}
              </Text>
              <Button
                label={m.is_starred ? 'Unstar' : 'Star'}
                variant="ghost"
                onPress={async () => {
                  if (!token) return;
                  await patientApi.starMessage(token, Number(m.id), !m.is_starred);
                  load();
                }}
              />
              <Button
                label="Delete"
                variant="danger"
                onPress={async () => {
                  if (!token) return;
                  await patientApi.deleteMessage(token, Number(m.id));
                  load();
                }}
              />
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

export function PatientProfileScreen() {
  const { token, logout, handleUnauthorized } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [patient, setPatient] = useState<Record<string, any> | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [mobile, setMobile] = useState('');
  const [ecName, setEcName] = useState('');
  const [ecPhone, setEcPhone] = useState('');
  const [ecRel, setEcRel] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await patientApi.patientProfile(token);
      const d = res.data || {};
      setPatient(d);
      setEmail(String(d.email || ''));
      setPhone(String(d.phone || d.primary_phone || ''));
      setMobile(String(d.mobile_phone || ''));
      const ec = (d.emergency_contact as Record<string, unknown>) || {};
      setEcName(String(ec.name || ''));
      setEcPhone(String(ec.phone || ''));
      setEcRel(String(ec.relationship || ''));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await handleUnauthorized();
      else showAlert('Error', e instanceof ApiError ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [token, handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
      <PatientProfileHeader
        title={editing ? 'Edit Profile' : 'Patient Profile'}
        showBack={editing}
        onBack={() => setEditing(false)}
        onMenu={editing ? undefined : () => setMenuOpen((open) => !open)}
      />
      {loading && !patient ? (
        <LoadingBlock />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
          {editing ? (
            <View style={{ padding: 16 }}>
              <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
              <Field label="Primary phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              <Field label="Mobile phone" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" />
              <Field label="Emergency contact name" value={ecName} onChangeText={setEcName} />
              <Field label="Emergency contact phone" value={ecPhone} onChangeText={setEcPhone} keyboardType="phone-pad" />
              <Field label="Relationship" value={ecRel} onChangeText={setEcRel} />
              <Button
                label="Save"
                loading={saving}
                onPress={async () => {
                  if (!token) return;
                  setSaving(true);
                  try {
                    await patientApi.updatePatientProfile(token, {
                      email,
                      primary_phone: phone,
                      mobile_phone: mobile,
                      emergency_contact_name: ecName,
                      emergency_contact_phone: ecPhone,
                      emergency_contact_relationship: ecRel,
                    });
                    showAlert('Profile updated');
                    setEditing(false);
                    await load();
                  } catch (e) {
                    showAlert('Failed', e instanceof ApiError ? e.message : 'Error');
                  } finally {
                    setSaving(false);
                  }
                }}
              />
            </View>
          ) : patient ? (
            <PatientProfileCard patient={patient} />
          ) : null}
        </ScrollView>
      )}
      <SlideDownMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={[
          {
            key: 'edit',
            label: 'Edit contact',
            icon: 'create-outline',
            onPress: () => setEditing(true),
          },
          {
            key: 'logout',
            label: loggingOut ? 'Logging out…' : 'Log out',
            icon: 'log-out-outline',
            danger: true,
            onPress: async () => {
              const ok = await confirmAction('Log out?', 'You will need to sign in again.');
              if (!ok) return;
              setLoggingOut(true);
              try {
                await logout();
              } finally {
                setLoggingOut(false);
              }
            },
          },
        ]}
      />
    </View>
  );
}

export function PatientCareTeamScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (!token) return;
        setLoading(true);
        try {
          const res = await patientApi.patientCareTeam(token);
          setItems(res.data || []);
        } finally {
          setLoading(false);
        }
      })();
    }, [token]),
  );

  if (loading) return <LoadingBlock />;
  return (
    <Screen>
      <Title>Care team</Title>
      <ScrollView>
        {items.length === 0 ? (
          <EmptyState message="No care team members listed" />
        ) : (
          items.map((m) => (
            <Card key={String(m.id) + String(m.role)}>
              <Text style={{ fontWeight: '700' }}>{String(m.name)}</Text>
              <Text style={{ color: colors.textMuted }}>
                {String(m.role)} · {String(m.phone || m.email || '')}
              </Text>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

export function PatientCarePlansScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (!token) return;
        setLoading(true);
        try {
          const res = await patientApi.patientCarePlans(token);
          setItems(res.data || []);
        } finally {
          setLoading(false);
        }
      })();
    }, [token]),
  );

  if (loading) return <LoadingBlock />;
  return (
    <Screen>
      <Title>Care plans</Title>
      <ScrollView>
        {items.length === 0 ? (
          <EmptyState message="No care plans" />
        ) : (
          items.map((p) => (
            <Card key={String(p.id)}>
              <Text style={{ fontWeight: '700' }}>Plan {String(p.plan_date || p.id)}</Text>
              <Text style={{ color: colors.textMuted }}>Status: {String(p.status)}</Text>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

export function PatientNotificationsScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<Record<string, any>[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await patientApi.patientNotifications(token);
      setItems(res.data || []);
      setUnread(res.unread || 0);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) return <LoadingBlock />;
  return (
    <Screen>
      <Title>Notifications</Title>
      <Subtitle>{unread} unread</Subtitle>
      <ScrollView>
        {items.length === 0 ? (
          <EmptyState message="You’re all caught up" />
        ) : (
          items.map((n) => (
            <Card
              key={String(n.id)}
              onPress={async () => {
                if (!token) return;
                await patientApi.markNotificationRead(token, Number(n.id));
                load();
              }}
            >
              <Text style={{ fontWeight: '700' }}>
                {n.is_read ? '' : '• '}
                {String(n.title)}
              </Text>
              <Text style={{ color: colors.textMuted }}>{String(n.message)}</Text>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

export function PatientGrievancesScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await patientApi.patientGrievances(token);
      setItems(res.data || []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <Screen>
      <ScrollView>
        <Title>Grievances</Title>
        <Field label="Subject" value={subject} onChangeText={setSubject} />
        <Field label="Description" value={description} onChangeText={setDescription} multiline style={{ minHeight: 100 }} />
        <Button
          label="Submit grievance"
          loading={saving}
          onPress={async () => {
            if (!token) return;
            setSaving(true);
            try {
              await patientApi.submitGrievance(token, { subject, description });
              showAlert('Submitted');
              setSubject('');
              setDescription('');
              load();
            } catch (e) {
              showAlert('Failed', e instanceof ApiError ? e.message : 'Error');
            } finally {
              setSaving(false);
            }
          }}
        />
        {loading ? (
          <LoadingBlock />
        ) : items.length === 0 ? (
          <EmptyState message="No grievances filed" />
        ) : (
          items.map((g) => (
            <Card key={String(g.id)}>
              <Text style={{ fontWeight: '700' }}>{String(g.subject)}</Text>
              <Text style={{ color: colors.textMuted }}>Status: {String(g.status)}</Text>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
