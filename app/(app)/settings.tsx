import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { deleteAccount } from '@/lib/data';
import { BRIEF_TIMES, BUSINESS_TYPES, prettyTime } from '@/constants/business';
import { ChipPicker } from '@/components/ChipPicker';
import { BackLink, Body, Button, Card, ErrorText, Field, Label, Screen, Title } from '@/components/ui';
import { colours, space } from '@/constants/theme';

export default function Settings() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [businessName, setBusinessName] = useState(profile?.business_name ?? '');
  const [businessType, setBusinessType] = useState<string | null>(profile?.business_type ?? null);
  const [aboutMe, setAboutMe] = useState(profile?.about_me ?? '');
  const [briefTime, setBriefTime] = useState<string>((profile?.brief_time ?? '07:00').slice(0, 5));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [showDelete, setShowDelete] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  async function save() {
    if (!session) return;
    setError('');
    setSaved(false);
    if (!firstName.trim()) return setError('What should Tali call you?');
    setBusy(true);
    const { error: err } = await supabase
      .from('profiles')
      .update({
        first_name: firstName.trim(),
        business_name: businessName.trim() || null,
        business_type: businessType,
        about_me: aboutMe.trim() || null,
        brief_time: `${briefTime}:00`,
      })
      .eq('id', session.user.id);
    setBusy(false);
    if (err) return setError(err.message);
    await refreshProfile();
    setSaved(true);
  }

  async function removeAccount() {
    setDeleteError('');
    if (confirm.trim().toUpperCase() !== 'DELETE') return setDeleteError('Type DELETE to confirm.');
    setDeleting(true);
    const res = await deleteAccount(confirm);
    setDeleting(false);
    if (!res.ok) return setDeleteError(res.message ?? 'Could not delete your account.');
    await signOut();
  }

  return (
    <Screen>
      <BackLink onPress={() => router.navigate('/me')} />
      <Title sub="Tali reads this before every chat and brief.">Settings</Title>

      <Field label="First name" value={firstName} onChangeText={setFirstName} autoComplete="given-name" />
      <Field label="Business name" value={businessName} onChangeText={setBusinessName} />
      <Label>What kind of business</Label>
      <ChipPicker options={BUSINESS_TYPES} value={businessType} onChange={setBusinessType} />
      <Field
        label="About you and your business"
        value={aboutMe}
        onChangeText={setAboutMe}
        multiline
        maxLength={1000}
        style={{ minHeight: 100, textAlignVertical: 'top' }}
      />

      <Label>Morning brief time</Label>
      <ChipPicker options={BRIEF_TIMES} value={briefTime} onChange={setBriefTime} label={prettyTime} />
      <Text style={{ color: colours.muted, fontSize: 13, marginTop: -4, marginBottom: space.md }}>
        On the Free plan this is when your Friday check-in arrives.
      </Text>

      <ErrorText>{error}</ErrorText>
      {saved ? <Text style={{ color: colours.good, marginTop: 6 }}>Saved.</Text> : null}
      <Button title="Save" onPress={save} busy={busy} />

      <View style={{ height: space.xxl }} />
      <Label>Danger zone</Label>
      <Card>
        <Body muted>
          Deleting your account removes your profile, chats, journal, drafts and everything Tali has learnt about you. It can't be undone.
        </Body>
        {showDelete ? (
          <>
            <Field label="Type DELETE to confirm" value={confirm} onChangeText={setConfirm} autoCapitalize="characters" />
            <ErrorText>{deleteError}</ErrorText>
            <Button title="Delete my account for good" kind="danger" onPress={removeAccount} busy={deleting} />
            <Button title="Keep my account" kind="ghost" onPress={() => { setShowDelete(false); setConfirm(''); setDeleteError(''); }} />
          </>
        ) : (
          <Button title="Delete account" kind="danger" onPress={() => setShowDelete(true)} />
        )}
      </Card>
    </Screen>
  );
}
