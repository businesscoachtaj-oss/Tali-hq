import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Button, ErrorText, Field, Screen, TaliSays, Title } from '@/components/ui';

export default function ResetPassword() {
  const { endRecovery, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setError('');
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== again) return setError("Those two don't match.");
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(err.message);
    endRecovery();
  }

  return (
    <Screen>
      <Title>Set a new password</Title>
      <TaliSays pose="think">Pick something you haven't used anywhere else.</TaliSays>
      <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <Field label="Type it again" value={again} onChangeText={setAgain} secureTextEntry autoComplete="new-password" onSubmitEditing={save} />
      <ErrorText>{error}</ErrorText>
      <Button title="Save new password" onPress={save} busy={busy} />
      <Button title="Cancel and sign out" kind="ghost" onPress={signOut} />
    </Screen>
  );
}
