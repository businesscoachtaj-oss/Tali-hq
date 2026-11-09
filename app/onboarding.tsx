// 10 Nov 2026 (Taj): sign up starts with you, not the business. Tali is for your whole life, work
// included, so a business is asked about but never required.
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { colours, radius, space } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Button, ErrorText, Field, Label, Screen, TaliSays, Title } from '@/components/ui';
import { BUSINESS_TYPES } from '@/constants/business';
import { ChipPicker } from '@/components/ChipPicker';

const PLATE = ['My week and to-dos', 'My business', 'Money', 'Health and habits', 'The people in my life', 'Big goals'];

export default function Onboarding() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [aboutMe, setAboutMe] = useState('');
  const [plate, setPlate] = useState<string[]>([]);
  const [hasBusiness, setHasBusiness] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function finish() {
    setError('');
    if (!firstName.trim()) return setError('What should I call you?');
    if (hasBusiness === null) return setError('Do you run a business, or is it just you?');
    if (hasBusiness && !businessType) return setError('Pick the closest match for your business.');
    if (!session) return;
    setBusy(true);
    let timezone = 'Australia/Sydney';
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || timezone;
    } catch {}
    const { error: err } = await supabase
      .from('profiles')
      .update({
        first_name: firstName.trim(),
        business_name: hasBusiness ? businessName.trim() || null : null,
        business_type: hasBusiness ? businessType : null,
        // What they want a hand with goes in with the rest of what Tali reads before every chat.
        about_me: [plate.length ? `Wants a hand with: ${plate.join(', ').toLowerCase()}.` : '', aboutMe.trim()].filter(Boolean).join(' ') || null,
        timezone,
        onboarded_at: new Date().toISOString(),
      })
      .eq('id', session.user.id);
    if (err) {
      setBusy(false);
      return setError(err.message);
    }
    await refreshProfile();
  }

  return (
    <Screen>
      <Title sub="Takes a minute. You can change any of it later.">Let's get to know you</Title>
      <TaliSays pose="wave">Tell me a bit about you so I know where to start. Work, home, health, whatever is on your plate. I remember all of it.</TaliSays>
      <Field label="First name" value={firstName} onChangeText={setFirstName} autoComplete="given-name" />
      <Label>What would you like a hand with?</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md }}>
        {PLATE.map((o) => {
          const on = plate.includes(o);
          return (
            <Pressable key={o} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => setPlate((p) => (on ? p.filter((x) => x !== o) : [...p, o]))}
              style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? colours.purple : colours.borderStrong, backgroundColor: on ? colours.purple : colours.surface }}>
              <Text style={{ color: on ? colours.onPurple : colours.text, fontWeight: '600' }}>{o}</Text>
            </Pressable>
          );
        })}
      </View>
      <Label>Do you run a business?</Label>
      <ChipPicker options={['Yes', 'No, just me'] as const} value={hasBusiness === null ? null : hasBusiness ? 'Yes' : 'No, just me'} onChange={(v) => setHasBusiness(v === 'Yes')} />
      {hasBusiness ? (
        <>
          <Field label="Business name (optional)" value={businessName} onChangeText={setBusinessName} />
          <Label>What kind of business</Label>
          <ChipPicker options={BUSINESS_TYPES} value={businessType || null} onChange={setBusinessType} />
        </>
      ) : null}
      <Field
        label="Anything I should know? (optional)"
        value={aboutMe}
        onChangeText={setAboutMe}
        multiline
        maxLength={1000}
        placeholder="For example: I'm hopeless at follow-ups, I want to be in bed by ten, and Mum's birthday is in December."
        style={{ minHeight: 100, textAlignVertical: 'top' }}
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Meet Tali" onPress={finish} busy={busy} />
      {/* 4 Nov 2026: a way out if this isn't your account (shared device, wrong email). */}
      <Button title="Not you? Sign out" kind="ghost" onPress={signOut} disabled={busy} />
    </Screen>
  );
}
