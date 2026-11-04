import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { markNightNoteRead, myCredits, nightNotes, nightSchool, saveNightSchool, type NightNote, type NightSchool } from '@/lib/data';
import { friendlyDate } from '@/lib/dates';
import { isPro } from '@/lib/plan';
import { ChipPicker } from '@/components/ChipPicker';
import { BackLink, Button, Card, ErrorText, Label, Screen, TaliSays, Title, Hint, goBack } from '@/components/ui';
import { colours, radius, space } from '@/constants/theme';

const IDEAS = ['Instagram for my business', 'Getting more Google reviews', 'Pricing my services', 'Keeping clients longer', 'Small business tax basics'];

export default function NightSchoolScreen() {
  const [pro, setPro] = useState<boolean | null>(null);
  const [ns, setNs] = useState<NightSchool>({ enabled: true, topics: [], nights: 'three' });
  const [saved, setSaved] = useState<NightSchool | null>(null);
  const [notes, setNotes] = useState<NightNote[]>([]);
  const [newTopic, setNewTopic] = useState('');
  const [open, setOpen] = useState<NightNote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  // The form is seeded from the server once. Later loads (focus, marking a note read) refresh the
  // notes but leave whatever you're typing alone (4 Nov 2026).
  const seeded = useRef(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const c = await myCredits();
      setPro(isPro(c));
      if (!isPro(c)) return;
      const [n, list] = await Promise.all([nightSchool(), nightNotes()]);
      if (n && !seeded.current) setNs(n);
      seeded.current = true;
      setSaved(n);
      setNotes(list);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load night school.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // "Saved." only holds while the form matches what's saved.
  useEffect(() => {
    setDone('');
  }, [ns]);

  function addTopic(t: string) {
    const topic = t.trim();
    if (topic.length < 3) return setError('Give her a bit more to go on.');
    if (ns.topics.length >= 3) return setError('Three topics at a time. Remove one first.');
    if (ns.topics.some((x) => x.toLowerCase() === topic.toLowerCase())) return;
    setError('');
    setNs({ ...ns, topics: [...ns.topics, topic.slice(0, 80)] });
    setNewTopic('');
  }

  async function save() {
    setBusy(true);
    setError('');
    setDone('');
    try {
      await saveNightSchool(ns);
      setSaved(ns);
      setDone(ns.enabled && ns.topics.length ? "Saved. I'll hit the books tonight." : 'Saved.');
    } catch (e: any) {
      setError(e?.message ?? 'Could not save.');
    }
    setBusy(false);
  }

  if (pro === false) {
    return (
      <Screen>
        <BackLink onPress={() => goBack('/me')} />
        <Title>Night school</Title>
        <TaliSays pose="think">Night school is part of Tali HQ Pro. You pick what I study, I research it late at night and tell you what I learnt in the morning.</TaliSays>
        <Button title="See plans" onPress={() => router.navigate('/plans')} />
      </Screen>
    );
  }

  if (open) {
    return (
      <Screen>
        <BackLink onPress={() => setOpen(null)} label="Night school" />
        <Text style={{ fontSize: 12, color: colours.muted, fontWeight: '700', textTransform: 'uppercase' }}>{open.topic} · {friendlyDate(open.for_date)}</Text>
        <Title>{open.headline}</Title>
        {open.learnt.map((l, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
            <Text style={{ color: colours.purple, fontWeight: '800', fontSize: 16 }}>{i + 1}.</Text>
            <Text style={{ flex: 1, fontSize: 16, lineHeight: 24, color: colours.text }}>{l}</Text>
          </View>
        ))}
        {open.sources.length ? (
          <>
            <Label>Where I read it</Label>
            {open.sources.map((s, i) => (
              <Pressable key={i} onPress={() => Linking.openURL(s.url)} style={{ paddingVertical: 6 }}>
                <Text style={{ color: colours.purple, fontWeight: '600', textDecorationLine: 'underline' }}>{s.title || s.url}</Text>
              </Pressable>
            ))}
          </>
        ) : null}
        <Text style={{ color: colours.muted, fontSize: 13, marginTop: space.lg, lineHeight: 19 }}>I've saved these to what I know about you, so I can use them in chats and briefs.</Text>
      </Screen>
    );
  }

  const changed = JSON.stringify(saved ?? { enabled: true, topics: [], nights: 'three' }) !== JSON.stringify(ns);

  return (
    <Screen onRefresh={load}>
      <BackLink onPress={() => goBack('/me')} />
      <Title sub="Pick up to three things for Tali to study. Late at night she researches one, saves what she learns, and you'll find her notes here.">Night school</Title>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text }}>{ns.enabled ? 'Night school is on' : 'Night school is off'}</Text>
          <Switch value={ns.enabled} onValueChange={(v) => setNs({ ...ns, enabled: v })} trackColor={{ true: colours.purple, false: colours.borderStrong }} thumbColor="#FFFFFF" {...({ activeThumbColor: "#FFFFFF" } as object)} />
        </View>
      </Card>

      <Label>What she studies</Label>
      {ns.topics.map((t, i) => (
        <Card key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md }}>
          <Text style={{ flex: 1, fontSize: 15, color: colours.text, fontWeight: '600' }}>{t}</Text>
          <Pressable onPress={() => setNs({ ...ns, topics: ns.topics.filter((_, j) => j !== i) })} hitSlop={8}>
            <Text style={{ color: colours.danger, fontWeight: '700', fontSize: 13 }}>Remove</Text>
          </Pressable>
        </Card>
      ))}
      {ns.topics.length < 3 ? (
        <>
          <TextInput value={newTopic} onChangeText={setNewTopic} placeholder="e.g. Instagram ideas for cafes" placeholderTextColor={colours.faint} maxLength={80}
            onSubmitEditing={() => addTopic(newTopic)} returnKeyType="done"
            style={{ backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.borderStrong, borderRadius: radius.input, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16, color: colours.text, marginBottom: space.sm }} />
          <Button title="Add topic" kind="ghost" onPress={() => addTopic(newTopic)} />
          {ns.topics.length === 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md }}>
              {IDEAS.map((idea) => (
                <Pressable key={idea} onPress={() => addTopic(idea)} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colours.purpleSoft }}>
                  <Text style={{ color: colours.purpleInk, fontWeight: '600' }}>{idea}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      <View style={{ height: space.md }} />
      <Label>How often</Label>
      <ChipPicker options={['three', 'every'] as const} value={ns.nights} label={(n) => (n === 'every' ? 'Every night' : 'Mon, Wed and Fri')} onChange={(n) => setNs({ ...ns, nights: n })} />
      <Text style={{ color: colours.muted, fontSize: 13, marginTop: -6, marginBottom: space.md, lineHeight: 19 }}>
        Each night uses a few credits: 1 for the night plus 2 for each web search, usually 3 to 7 all up.
      </Text>

      <ErrorText>{error}</ErrorText>
      {done ? <Text style={{ color: colours.good, fontWeight: '700', marginTop: space.sm }}>{done}</Text> : null}
      <Button title="Save" onPress={save} busy={busy} disabled={!changed} />

      <View style={{ height: space.lg }} />
      <Label>What I learnt</Label>
      {notes.length === 0 ? (
        <Hint>{ns.topics.length ? 'Her first notes show up the morning after her first night.' : 'Add a topic and her notes land here.'}</Hint>
      ) : (
        notes.map((n) => (
          <Pressable key={n.id} onPress={() => { setOpen(n); if (!n.read_at) markNightNoteRead(n.id).then(load); }}>
            <Card style={!n.read_at ? { borderLeftWidth: 5, borderLeftColor: colours.purple } : undefined}>
              <Text style={{ fontSize: 12, color: colours.muted, fontWeight: '700', textTransform: 'uppercase' }}>{n.topic} · {friendlyDate(n.for_date)}</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text, marginTop: 4 }}>{n.headline}</Text>
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}
