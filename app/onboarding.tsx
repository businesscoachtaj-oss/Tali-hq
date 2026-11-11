// 10 Nov 2026 (Taj): sign up starts with you, not the business. Tali is for your whole life, work
// included, so a business is asked about but never required.
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { radius, space } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Button, ErrorText, Field, Label, Screen } from '@/components/ui';
import { TaliAvatar } from '@/components/TaliAvatar';
import { BUSINESS_TYPES } from '@/constants/business';
import { ChipPicker } from '@/components/ChipPicker';
import { enablePush, pushSupported } from '@/lib/push';

// 11 Nov 2026: a last step asks for notifications, since her briefs and nudges rely on them.
// Skipped where this device can't have them.
const LAST = pushSupported ? 4 : 3;
const STEPS = LAST + 1;
const PLATE = ['My week and to-dos', 'My business', 'Money', 'Health and habits', 'The people in my life', 'Big goals'];

export default function Onboarding() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [aboutMe, setAboutMe] = useState('');
  const [plate, setPlate] = useState<string[]>([]);
  const [hasBusiness, setHasBusiness] = useState<boolean | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pushOn, setPushOn] = useState(false);
  const [pushNote, setPushNote] = useState('');

  // Their phone's own permission box only appears after this tap.
  async function turnOnPush() {
    setBusy(true);
    setPushNote('');
    const res = await enablePush();
    setBusy(false);
    if (res.ok) setPushOn(true);
    else setPushNote(res.message);
  }

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
        has_business: hasBusiness,
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

  // 10 Nov 2026: one question at a time in her sky, instead of one long form.
  function next() {
    setError('');
    if (step === 0 && !firstName.trim()) return setError('What should I call you?');
    if (step === 2 && hasBusiness === null) return setError('Do you run a business, or is it just you?');
    if (step === 2 && hasBusiness && !businessType) return setError('Pick the closest match for your business.');
    if (step < LAST) setStep(step + 1);
    else finish();
  }
  const name = firstName.trim();
  const Q = [
    { kicker: 'FIRST THINGS FIRST', q: "G'day. What should I call you?", sub: "I'm Tali. I'm an AI with a brain that grows with you." },
    { kicker: 'YOUR PLATE', q: `Nice to meet you${name ? `, ${name}` : ''}. What would you like a hand with?`, sub: 'Pick as many as you like. You can change it later.' },
    { kicker: 'YOUR WORK', q: 'Do you run a business?', sub: 'Either is fine. I look after your whole life, work included.' },
    { kicker: 'ONE LAST THING', q: 'Anything I should know from day one?', sub: 'Optional. Everything you tell me becomes a memory in my brain.' },
    { kicker: 'STAYING IN TOUCH', q: 'Can I tap you on the shoulder?', sub: 'I work in the background. Notifications are how I tell you the things worth knowing.' },
  ][step];

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: space.sm, marginBottom: space.xl }}>
        {Array.from({ length: STEPS }, (_, n) => n).map((n) => (
          <View key={n} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: n <= step ? '#B9A6FF' : 'rgba(255,255,255,0.18)' }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(185,166,255,0.18)', borderWidth: 1, borderColor: 'rgba(214,200,255,0.6)', shadowColor: '#B9A6FF', shadowOpacity: 1, shadowRadius: 22, shadowOffset: { width: 0, height: 0 } }}>
          <TaliAvatar pose="head" size={42} />
        </View>
        <Text style={{ color: '#B9A6FF', fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>{Q.kicker}  ·  {step + 1} OF {STEPS}</Text>
      </View>
      <Text style={{ color: '#FFFFFF', fontSize: 34, lineHeight: 38, marginTop: space.md, fontFamily: 'InstrumentSerif_400Regular', textShadowColor: 'rgba(185,166,255,0.8)', textShadowRadius: 18 }}>{Q.q}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, lineHeight: 21, marginTop: 8, marginBottom: space.lg }}>{Q.sub}</Text>

      {step === 0 ? <Field label="First name" value={firstName} onChangeText={setFirstName} autoComplete="given-name" onSubmitEditing={next} /> : null}

      {step === 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md }}>
          {PLATE.map((o) => {
            const on = plate.includes(o);
            return (
              <Pressable key={o} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => setPlate((p) => (on ? p.filter((x) => x !== o) : [...p, o]))}
                style={{ paddingVertical: 11, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? '#B9A6FF' : 'rgba(214,200,255,0.4)', backgroundColor: on ? '#B9A6FF' : 'rgba(255,255,255,0.07)' }}>
                <Text style={{ color: on ? '#0C0A24' : '#FFFFFF', fontWeight: '700', fontSize: 15 }}>{o}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {step === 2 ? (
        <>
          <ChipPicker options={['Yes', 'No, just me'] as const} value={hasBusiness === null ? null : hasBusiness ? 'Yes' : 'No, just me'} onChange={(v) => setHasBusiness(v === 'Yes')} />
          {hasBusiness ? (
            <>
              <Field label="Business name (optional)" value={businessName} onChangeText={setBusinessName} />
              <Label>What kind of business</Label>
              <ChipPicker options={BUSINESS_TYPES} value={businessType || null} onChange={setBusinessType} />
            </>
          ) : null}
        </>
      ) : null}

      {step === 3 ? (
        <Field
          label="Tell me in your own words"
          value={aboutMe}
          onChangeText={setAboutMe}
          multiline
          maxLength={1000}
          placeholder="For example: I'm hopeless at follow-ups, I want to be in bed by ten, and Mum's birthday is in December."
          style={{ minHeight: 120, textAlignVertical: 'top' }}
        />
      ) : null}

      {step === 4 ? (
        <>
          {[
            ['Your morning brief', 'One note a day with what needs you.'],
            ['Reminders you asked for', 'Only the ones you set or said yes to.'],
            ['Things worth knowing', 'Like when an invoice gets paid.'],
          ].map(([t, d]) => (
            <View key={t} style={{ borderRadius: 18, borderWidth: 1, borderColor: 'rgba(196,178,255,0.30)', backgroundColor: 'rgba(58,44,140,0.55)', padding: 14, marginBottom: 10 }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>{t}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 }}>{d}</Text>
            </View>
          ))}
          {pushOn ? (
            <Text style={{ color: '#7FE0B0', fontWeight: '700', marginBottom: space.md }}>Notifications are on.</Text>
          ) : (
            <Button title="Turn on notifications" onPress={turnOnPush} busy={busy} />
          )}
          {pushNote ? <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 19, marginBottom: space.md }}>{pushNote}</Text> : null}
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: space.md }}>Change it any time in Settings. I never send marketing.</Text>
        </>
      ) : null}

      <ErrorText>{error}</ErrorText>
      <Button title={step === LAST ? (step === 4 && !pushOn ? 'Not now, meet Tali' : 'Meet Tali') : 'Next'} kind={step === 4 && !pushOn ? 'ghost' : 'primary'} onPress={next} busy={busy && step !== 4} />
      {step > 0 ? <Button title="Back" kind="ghost" onPress={() => { setError(''); setStep(step - 1); }} disabled={busy} /> : null}
      {/* 4 Nov 2026: a way out if this isn't your account (shared device, wrong email). */}
      {step === 0 ? <Button title="Not you? Sign out" kind="ghost" onPress={signOut} disabled={busy} /> : null}
    </Screen>
  );
}
