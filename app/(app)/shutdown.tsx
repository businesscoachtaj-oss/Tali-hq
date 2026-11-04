// End of day shutdown (3 Nov 2026). Free and up, 1 credit. Reached from Today's card and from the
// evening push (/shutdown). One scrolling screen: how today went, one thing that went well, anything
// on your mind, tomorrow's three, Done. Tali signs off with one line and the day is closed.
import { useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { MOODS, finishDay, todaysShutdown, tomorrowSuggestions, type Shutdown } from '@/lib/rhythm';
import { BackLink, Body, Button, Card, ErrorText, Field, Label, Loading, Screen, TaliSays, Title } from '@/components/ui';
import { colours, elevation, radius, space } from '@/constants/theme';

export default function ShutdownScreen() {
  const { profile } = useAuth();
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState<Shutdown | null>(null);
  const [editing, setEditing] = useState(false);
  const [mood, setMood] = useState<number | null>(null);
  const [wentWell, setWentWell] = useState('');
  const [note, setNote] = useState('');
  const [three, setThree] = useState<string[]>(['', '', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const existing = await todaysShutdown();
      if (existing?.tali_line) {
        setDone(existing);
      } else {
        const lines = await tomorrowSuggestions().catch(() => [] as string[]);
        setThree([lines[0] ?? '', lines[1] ?? '', lines[2] ?? '']);
        if (existing) {
          setMood(existing.mood);
          setWentWell(existing.went_well ?? '');
          setNote(existing.note ?? '');
        }
      }
    } finally {
      setReady(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function startAgain() {
    if (!done) return;
    setMood(done.mood);
    setWentWell(done.went_well ?? '');
    setNote(done.note ?? '');
    const t = done.tomorrow.map((x) => x.text);
    setThree([t[0] ?? '', t[1] ?? '', t[2] ?? '']);
    setEditing(true);
  }

  async function finish() {
    setError('');
    if (!mood) return setError('Pick how today went first.');
    setBusy(true);
    const res = await finishDay({ mood, went_well: wentWell, note, tomorrow: three });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setDone(res.shutdown);
    setEditing(false);
  }

  if (!ready) return <Loading />;

  const name = profile?.first_name || 'mate';

  if (done && !editing) {
    const m = MOODS.find((x) => x.value === done.mood);
    const lines = done.tomorrow.map((t) => t.text).filter(Boolean);
    return (
      <Screen>
        <BackLink onPress={() => router.navigate('/')} label="Today" />
        <Title sub="Day closed. See you in the morning.">G'night, {name} 😊</Title>
        <TaliSays pose={(done.mood ?? 3) >= 4 ? 'celebrate' : 'idle'}>{done.tali_line}</TaliSays>
        <Card>
          <Label>Today</Label>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colours.text }}>
            {m ? `${m.emoji}  ${m.label}` : 'Closed'}
          </Text>
          {done.went_well ? <Body muted>Went well: {done.went_well}</Body> : null}
        </Card>
        {lines.length ? (
          <Card>
            <Label>Tomorrow's three</Label>
            {lines.map((l, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: space.sm, paddingVertical: 4 }}>
                <Text style={{ color: colours.purple, fontWeight: '800', width: 18 }}>{i + 1}</Text>
                <Text style={{ fontSize: 15, lineHeight: 22, color: colours.text, flex: 1 }}>{l}</Text>
              </View>
            ))}
            <Text style={{ fontSize: 12, color: colours.faint, marginTop: space.sm }}>Set as reminders for 9am tomorrow.</Text>
          </Card>
        ) : null}
        <Button title="G'night 😊"onPress={() => router.navigate('/')} />
        <Button title="Change my answers" kind="ghost" onPress={startAgain} />
      </Screen>
    );
  }

  return (
    <Screen>
      <BackLink onPress={() => router.navigate('/')} label="Today" />
      <Title sub="Two minutes, then switch off.">Shut the day down</Title>
      <TaliSays pose="idle">Right, {name}. How did today go? Be honest, I'm not marking it.</TaliSays>

      <Label>How did today go?</Label>
      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.lg }}>
        {MOODS.map((m) => {
          const on = mood === m.value;
          return (
            <Pressable
              key={m.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={m.label}
              onPress={() => setMood(m.value)}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 10,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: on ? colours.purple : colours.borderStrong,
                backgroundColor: on ? colours.purple : colours.surface,
                ...(on ? elevation.button(colours.purple) : elevation.tile),
              }}>
              <Text style={{ fontSize: 22 }}>{m.emoji}</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', marginTop: 4, color: on ? colours.onPurple : colours.muted }}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Field label="One thing that went well" value={wentWell} onChangeText={setWentWell} maxLength={500} placeholder="Even a small one counts" />
      <Field
        label="Anything on your mind (optional)"
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={2000}
        placeholder="Get it out of your head and into your journal"
        style={{ minHeight: 90, textAlignVertical: 'top' }}
      />

      <Label>Tomorrow's three</Label>
      <Card style={{ paddingVertical: space.sm }}>
        {three.map((line, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colours.border }}>
            <Text style={{ color: colours.purple, fontWeight: '800', width: 18, fontSize: 15 }}>{i + 1}</Text>
            <TextInput
              value={line}
              onChangeText={(v) => setThree((t) => t.map((x, j) => (j === i ? v : x)))}
              placeholder={i === 0 ? 'The one thing that matters most' : 'Optional'}
              placeholderTextColor={colours.faint}
              maxLength={300}
              style={{ flex: 1, fontSize: 15, color: colours.text, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: colours.sunk, borderRadius: radius.input }}
            />
          </View>
        ))}
      </Card>
      <Text style={{ fontSize: 12, color: colours.faint, marginTop: -4, marginBottom: space.sm }}>
        Prefilled from what's due tomorrow and this week's commitments. Each line becomes a 9am reminder.
      </Text>

      <ErrorText>{error}</ErrorText>
      <Button title="Done" onPress={finish} busy={busy} />
      {editing ? <Button title="Keep what I had" kind="ghost" onPress={() => setEditing(false)} /> : null}
    </Screen>
  );
}
