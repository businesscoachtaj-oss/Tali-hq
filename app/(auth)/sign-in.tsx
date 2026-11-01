import { useState } from 'react';
import { Link } from 'expo-router';
import { Platform, Text } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Button, ErrorText, Field, Screen, TaliSays, Title } from '@/components/ui';
import { colours } from '@/constants/theme';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  async function signIn() {
    setError('');
    setNote('');
    if (!email.trim() || !password) return setError('Pop in your email and password.');
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError(err.message);
  }

  async function forgot() {
    setError('');
    if (!email.trim()) return setError('Type your email above first, then tap this again.');
    // On web the link comes back to this site's reset screen. Native apps use the project's Site URL.
    const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined;
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), redirectTo ? { redirectTo } : undefined);
    if (err) setError(err.message);
    else setNote('Check your email for a link to set a new password.');
  }

  return (
    <Screen>
      <Title sub="Your business, run with an AI that has your back.">Tali HQ</Title>
      <TaliSays pose="wave">G'day. Sign in and I'll catch you up.</TaliSays>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" inputMode="email" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" onSubmitEditing={signIn} />
      <ErrorText>{error}</ErrorText>
      {note ? <Text style={{ color: colours.good, marginTop: 8 }}>{note}</Text> : null}
      <Button title="Sign in" onPress={signIn} busy={busy} />
      <Button title="Forgot password" kind="ghost" onPress={forgot} />
      <Link href="/sign-up" style={{ marginTop: 20, textAlign: 'center', color: colours.purple, fontWeight: '700', fontSize: 15 }}>
        New here? Make an account
      </Link>
    </Screen>
  );
}
