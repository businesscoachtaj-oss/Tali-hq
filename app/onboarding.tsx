import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Button, ErrorText, Field, Label, Screen, TaliSays, Title } from '@/components/ui';
import { BUSINESS_TYPES } from '@/constants/business';
import { ChipPicker } from '@/components/ChipPicker';

export default function Onboarding() {
  const { session, profile, refreshProfile } = useAuth();
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [aboutMe, setAboutMe] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function finish() {
    setError('');
    if (!firstName.trim()) return setError('What should I call you?');
    if (!businessType) return setError('Pick the closest match for your business.');
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
        business_name: businessName.trim() || null,
        business_type: businessType,
        about_me: aboutMe.trim() || null,
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
      <Title sub="Takes a minute. You can change any of it later.">Let's get you set up</Title>
      <TaliSays pose="wave">Tell me a bit about you and your business so I know where to start.</TaliSays>
      <Field label="First name" value={firstName} onChangeText={setFirstName} autoComplete="given-name" />
      <Field label="Business name (optional)" value={businessName} onChangeText={setBusinessName} />
      <Label>What kind of business</Label>
      <ChipPicker options={BUSINESS_TYPES} value={businessType || null} onChange={setBusinessType} />
      <Field
        label="Anything I should know? (optional)"
        value={aboutMe}
        onChangeText={setAboutMe}
        multiline
        maxLength={1000}
        placeholder="For example: I train 20 clients, I'm hopeless at follow-ups and I want more referrals."
        style={{ minHeight: 100, textAlignVertical: 'top' }}
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Meet Tali" onPress={finish} busy={busy} />
    </Screen>
  );
}
