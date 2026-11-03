import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { deleteAccount } from '@/lib/data';
import { enablePush, pushSupported, sendTestPush } from '@/lib/push';
import { REVIEW_DAYS, REVIEW_TIMES, SHUTDOWN_TIMES, rhythmSettings } from '@/lib/rhythm';
import { BRIEF_TIMES, BUSINESS_TYPES, prettyTime } from '@/constants/business';
import { ChipPicker } from '@/components/ChipPicker';
import { GoogleConnectCard } from '@/components/GoogleConnectCard';
import { MicrosoftConnectCard } from '@/components/MicrosoftConnectCard';
import { StripeConnectCard } from '@/components/StripeConnectCard';
import { TaliAddressCard } from '@/components/TaliAddressCard';
import { BackLink, Body, Button, Card, ErrorText, Field, Label, Screen, Title } from '@/components/ui';
import { colours, space } from '@/constants/theme';

export default function Settings() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [businessName, setBusinessName] = useState(profile?.business_name ?? '');
  const [businessType, setBusinessType] = useState<string | null>(profile?.business_type ?? null);
  const [aboutMe, setAboutMe] = useState(profile?.about_me ?? '');
  const [briefTime, setBriefTime] = useState<string>((profile?.brief_time ?? '07:00').slice(0, 5));
  const [briefPush, setBriefPush] = useState<boolean>(profile?.brief_push ?? true);
  // The owner's rhythm (3 Nov 2026): shutdown time and nudge, review day and time. Loaded here
  // rather than through the profile in useAuth so this screen owns them.
  const [shutdownTime, setShutdownTime] = useState<string>('21:00');
  const [shutdownPush, setShutdownPush] = useState<boolean>(true);
  const [reviewDay, setReviewDay] = useState<string>(REVIEW_DAYS[0]);
  const [reviewTime, setReviewTime] = useState<string>('17:00');
  useEffect(() => {
    rhythmSettings()
      .then((r) => {
        setShutdownTime(r.shutdown_time.slice(0, 5));
        setShutdownPush(r.shutdown_push);
        setReviewDay(REVIEW_DAYS[r.review_day] ?? REVIEW_DAYS[0]);
        setReviewTime(r.review_time.slice(0, 5));
      })
      .catch(() => {});
  }, []);
  const [pushNote, setPushNote] = useState('');
  const [pushBusy, setPushBusy] = useState(false);
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
        brief_push: briefPush,
        shutdown_time: `${shutdownTime}:00`,
        shutdown_push: shutdownPush,
        review_day: Math.max(0, REVIEW_DAYS.indexOf(reviewDay)),
        review_time: `${reviewTime}:00`,
      })
      .eq('id', session.user.id);
    setBusy(false);
    if (err) return setError(err.message);
    await refreshProfile();
    setSaved(true);
  }

  async function turnOnPush() {
    setPushNote('');
    setPushBusy(true);
    const res = await enablePush();
    if (!res.ok) {
      setPushBusy(false);
      return setPushNote(res.message);
    }
    // Prove it works straight away.
    const test = await sendTestPush();
    setPushBusy(false);
    setPushNote(test.ok ? "Done. A test just went to this device, and you'll get a nudge when your brief lands." : "Done. You'll get a nudge when your brief lands.");
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

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', color: colours.text }}>Notify me when my brief lands</Text>
          <Text style={{ color: colours.muted, fontSize: 13, marginTop: 2 }}>A short notification when your brief lands, an email needs you, a reminder is due or a health check turns amber. Nothing else, ever.</Text>
        </View>
        <Switch value={briefPush} onValueChange={setBriefPush} trackColor={{ true: colours.purple, false: colours.borderStrong }} thumbColor="#FFFFFF" {...({ activeThumbColor: "#FFFFFF" } as object)} />
      </Card>
      {pushSupported ? (
        <Button title="Turn on notifications on this device" kind="ghost" onPress={turnOnPush} busy={pushBusy} />
      ) : null}
      {pushNote ? <Text style={{ color: colours.muted, fontSize: 13, marginTop: 6 }}>{pushNote}</Text> : null}

      <View style={{ height: space.lg }} />
      <Label>Shut the day down</Label>
      <ChipPicker options={SHUTDOWN_TIMES} value={shutdownTime} onChange={setShutdownTime} label={prettyTime} />
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', color: colours.text }}>Nudge me to shut down</Text>
          <Text style={{ color: colours.muted, fontSize: 13, marginTop: 2 }}>One notification at that time if the day isn't closed yet. Two minutes: how it went and tomorrow's three.</Text>
        </View>
        <Switch value={shutdownPush} onValueChange={setShutdownPush} trackColor={{ true: colours.purple, false: colours.borderStrong }} thumbColor="#FFFFFF" {...({ activeThumbColor: "#FFFFFF" } as object)} />
      </Card>

      <Label>Weekly review day</Label>
      <ChipPicker options={REVIEW_DAYS} value={reviewDay} onChange={setReviewDay} label={(d) => d.slice(0, 3)} />
      <Label>Weekly review time</Label>
      <ChipPicker options={REVIEW_TIMES} value={reviewTime} onChange={setReviewTime} label={prettyTime} />
      <Text style={{ color: colours.muted, fontSize: 13, marginTop: -4, marginBottom: space.md }}>
        Tali nudges you then, and the review looks back at the week that ended the day before. Part of Tali HQ.
      </Text>

      <ErrorText>{error}</ErrorText>
      {saved ? <Text style={{ color: colours.good, marginTop: 6 }}>Saved.</Text> : null}
      <Button title="Save" onPress={save} busy={busy} />

      <View style={{ height: space.xl }} />
      <Label>Connections</Label>
      <Text style={{ color: colours.muted, fontSize: 13, marginTop: -4, marginBottom: space.md, lineHeight: 19 }}>
        Connect the apps you already use. Tali reads what she needs and drafts the rest. Nothing goes out without your yes.
      </Text>
      <GoogleConnectCard />
      <View style={{ height: space.md }} />
      <MicrosoftConnectCard />
      <View style={{ height: space.md }} />
      <StripeConnectCard />
      <View style={{ height: space.md }} />
      <TaliAddressCard />

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
