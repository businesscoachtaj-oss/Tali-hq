import { useState } from 'react';
import { Link } from 'expo-router';
import { Text } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Button, ErrorText, Field, Screen, TaliSays, Title } from '@/components/ui';
import { colours } from '@/constants/theme';

export default function SignUp() {
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function signUp() {
    setError('');
    if (!firstName.trim()) return setError('What should I call you?');
    if (!email.trim()) return setError('Pop in your email.');
    if (password.length < 8) return setError('Use at least 8 characters for your password.');
    setBusy(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { first_name: firstName.trim() } },
    });
    setBusy(false);
    if (err) return setError(err.message);
    // With email confirmation on, there is no session until they tap the link.
    if (!data.session) setSent(true);
  }

  if (sent) {
    return (
      <Screen>
        <Title>Check your email</Title>
        <TaliSays pose="celebrate">Nearly there, {firstName.trim()}. Tap the link I just emailed you, then come back and sign in.</TaliSays>
        <Link href="/sign-in" style={{ marginTop: 12, textAlign: 'center', color: colours.purple, fontWeight: '700', fontSize: 15 }}>
          Back to sign in
        </Link>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title sub="14 days of Tali HQ free. No card needed.">Make your account</Title>
      <Field label="First name" value={firstName} onChangeText={setFirstName} autoComplete="given-name" />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" inputMode="email" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <ErrorText>{error}</ErrorText>
      <Button title="Make my account" onPress={signUp} busy={busy} />
      <Text style={{ color: colours.muted, fontSize: 13, marginTop: 14, lineHeight: 19 }}>
        Tali is an AI. She drafts and suggests, and anything she wants to send, spend or change waits for your yes.
      </Text>
      <Link href="/sign-in" style={{ marginTop: 20, textAlign: 'center', color: colours.purple, fontWeight: '700', fontSize: 15 }}>
        Already have an account? Sign in
      </Link>
    </Screen>
  );
}
