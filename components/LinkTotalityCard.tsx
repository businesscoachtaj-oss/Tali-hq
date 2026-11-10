// Use Totality too? (10 Nov 2026, one brain, asked for by Taj). For someone who also uses Totality
// or Totality Nutrition: bring across what they told Tali there, so they don't have to say it twice.
// Opt in, proved by signing in to Totality, one way into Tali HQ, and Unlink takes it all back out.
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, ErrorText, Field, useConfirm } from '@/components/ui';
import { colours, space } from '@/constants/theme';
import { linkTotality, myAppLink, unlinkTotality, type AppLink } from '@/lib/appLinks';

const when = (iso: string) => {
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? '' : t.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
};

export function LinkTotalityCard({ onChanged }: { onChanged?: () => void }) {
  const [link, setLink] = useState<AppLink | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { armed, confirm } = useConfirm();
  const load = () => myAppLink().then(setLink).catch(() => setLink(null));
  useEffect(() => {
    void load();
  }, []);
  if (link === undefined || hidden) return null;

  const go = async () => {
    if (!email.trim() || !password) return setError('Enter the email and password you use for Totality.');
    setBusy(true);
    setError(null);
    const res = await linkTotality(email, password);
    setBusy(false);
    setPassword('');
    if (!res.ok) return setError(res.message ?? 'That did not work. Check your Totality email and password.');
    setOpen(false);
    await load();
    onChanged?.();
  };

  // Tap once to arm, tap again to do it (the same pattern as Forget on a memory).
  const unlink = () =>
    confirm('unlink', async () => {
      setBusy(true);
      await unlinkTotality();
      setBusy(false);
      await load();
      onChanged?.();
    });

  if (link) {
    return (
      <Card style={{ marginBottom: space.lg }}>
        <Text style={{ color: colours.purple, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>TOTALITY IS LINKED</Text>
        <Text style={{ color: colours.text, fontSize: 15, lineHeight: 22, marginTop: 6 }}>
          I brought across {link.brought} {link.brought === 1 ? 'thing' : 'things'} you told me in Totality{when(link.linked_at) ? ` on ${when(link.linked_at)}` : ''}. They sit in your brain like any other memory, so you can read or forget each one.
        </Text>
        <Pressable onPress={unlink} disabled={busy} accessibilityRole="button" hitSlop={8} style={{ marginTop: space.sm, alignSelf: 'flex-start' }}>
          <Text style={{ color: colours.muted, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' }}>{busy ? 'Unlinking' : armed === 'unlink' ? 'Tap again to unlink. Those memories go too.' : 'Unlink Totality'}</Text>
        </Pressable>
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom: space.lg }}>
      <Text style={{ color: colours.text, fontSize: 22, fontFamily: 'InstrumentSerif_400Regular' }}>Use Totality too?</Text>
      <Text style={{ color: colours.muted, fontSize: 15, lineHeight: 22, marginTop: 6 }}>
        If you use Totality or Totality Nutrition, I can bring across what you told me there, so you don't have to tell me twice.
      </Text>
      {open ? (
        <View style={{ marginTop: space.md }}>
          <Text style={{ color: colours.text, fontSize: 13, lineHeight: 19, marginBottom: space.md }}>
            <Text style={{ fontWeight: '800' }}>Comes across: </Text>the goals and training preferences you picked at sign-up, and your plan.{'\n'}
            <Text style={{ fontWeight: '800' }}>Never comes across: </Text>your clients, health details, food logs, weight, payments or anything you typed in your own words.
          </Text>
          <Field label="Your Totality email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" />
          <Field label="Your Totality password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="off" />
          <Text style={{ color: colours.faint, fontSize: 12, lineHeight: 17, marginBottom: space.md }}>
            Signing in proves it's you. Your password is used once and never kept. It only goes one way, into your brain here, and you can unlink any time.
          </Text>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button title="Bring it across" onPress={go} busy={busy} />
          <Pressable onPress={() => { setOpen(false); setError(null); }} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: space.md }}>
            <Text style={{ color: colours.muted, fontWeight: '700' }}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md }}>
          <View style={{ flex: 1 }}>
            <Button title="Link Totality" onPress={() => setOpen(true)} />
          </View>
          <Pressable onPress={() => setHidden(true)} accessibilityRole="button" hitSlop={8}>
            <Text style={{ color: colours.muted, fontWeight: '700' }}>Not now</Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
}
