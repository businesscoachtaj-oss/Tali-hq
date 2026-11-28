// components/AiConsent.tsx (22 Nov 2026, App Review guidelines 5.1.1(i) and 5.1.2(i))
//
// "Tali and your data". Says plainly what is sent, who it goes to and why, and asks for a yes before
// anything about the person reaches an AI company. Shown once after sign in (app/ai-consent.tsx) and
// any time from Me (app/(app)/ai-data.tsx), where it can be turned off again.
import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { space } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { AI_COMPANIES, AI_SENT, notNow, setAiConsent } from '@/lib/aiConsent';
import { Button, ErrorText } from '@/components/ui';
import { TaliAvatar } from '@/components/TaliAvatar';

const PRIVACY_URL = 'https://totality360.com.au/privacy.html#tali-hq-ai';

const box = { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(28,26,23,0.18)', backgroundColor: '#FFFDF8', padding: 14, marginBottom: 10 } as const;
const head = { color: '#1C1A17', fontWeight: '800' as const, fontSize: 15, marginBottom: 6 };
const body = { color: 'rgba(28,26,23,0.8)', fontSize: 14, lineHeight: 20 };

export function AiConsent({ onDone, gate }: { onDone: () => void; gate: boolean }) {
  const { session, profile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState<'yes' | 'off' | 'later' | null>(null);
  const [error, setError] = useState('');
  const on = !!profile?.ai_consent_at;
  const userId = session?.user.id;

  async function answer(yes: boolean) {
    if (!userId) return;
    setBusy(yes ? 'yes' : 'off');
    setError('');
    try {
      await setAiConsent(userId, yes);
      await refreshProfile();
      onDone();
    } catch (e: any) {
      setError(e?.message ?? "That didn't save. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function later() {
    if (!userId) return;
    setBusy('later');
    await notNow(userId);
    setBusy(null);
    onDone();
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: gate ? space.lg : 0 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(59,63,158,0.18)', borderWidth: 1, borderColor: 'rgba(28,26,23,0.30)' }}>
          <TaliAvatar pose="head" size={42} />
        </View>
        <Text style={{ color: '#3B3F9E', fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>TALI AND YOUR DATA</Text>
      </View>
      <Text style={{ color: '#1C1A17', fontSize: 34, lineHeight: 38, marginTop: space.md, fontFamily: 'EBGaramond_500Medium' }}>
        {gate ? 'Before we start, a yes from you.' : 'How Tali uses AI'}
      </Text>
      <Text style={{ color: 'rgba(28,26,23,0.75)', fontSize: 15, lineHeight: 21, marginTop: 8, marginBottom: space.lg }}>
        {"I'm an AI. To think, write and remember for you, Learnéd sends some of your information to the AI companies that run my thinking. Nothing goes to them until you say yes."}
      </Text>

      <View style={box}>
        <Text style={head}>What is sent</Text>
        {AI_SENT.map((x) => (
          <Text key={x} style={[body, { marginBottom: 4 }]}>{'•'}  {x}</Text>
        ))}
        <Text style={[body, { marginTop: 4 }]}>Only what is needed for the thing you asked for, or for the brief, review or reminder you switched on.</Text>
      </View>

      <View style={box}>
        <Text style={head}>Who it goes to</Text>
        <Text style={body}>{AI_COMPANIES.join(', ')}. They process it to give Tali her answer, under their own privacy terms, which the privacy policy links to.</Text>
      </View>

      <View style={box}>
        <Text style={head}>Never sent</Text>
        <Text style={body}>Your password and card details. Payments go straight to the store or the payment provider.</Text>
      </View>

      <View style={box}>
        <Text style={head}>Your choice</Text>
        <Text style={body}>{"Without a yes you can still use your lists, notes, journal and the rest of the app, but Tali can't chat, write your brief, sort email or study at night. You can change this any time in Me, then Tali and your data."}</Text>
      </View>

      <Text onPress={() => Linking.openURL(PRIVACY_URL)} style={{ color: '#3B3F9E', fontWeight: '800', fontSize: 14, marginBottom: space.lg }}>
        Read the privacy policy
      </Text>

      <ErrorText>{error}</ErrorText>
      {on ? (
        <>
          <Text style={{ color: 'rgba(28,26,23,0.7)', fontSize: 13, textAlign: 'center', marginBottom: space.sm }}>
            You said yes on {new Date(profile!.ai_consent_at!).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}.
          </Text>
          <Button title="Turn Tali's AI off" kind="danger" onPress={() => answer(false)} busy={busy === 'off'} disabled={!!busy} />
        </>
      ) : (
        <>
          <Button title="Yes, Tali can use AI" onPress={() => answer(true)} busy={busy === 'yes'} disabled={!!busy} />
          <Button title="Not now" kind="ghost" onPress={gate ? later : onDone} busy={busy === 'later'} disabled={!!busy} />
        </>
      )}
    </View>
  );
}
