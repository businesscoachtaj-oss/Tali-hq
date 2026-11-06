import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { markNightNoteRead, myCredits, nightNotes, nightSchool, saveNightSchool, type NightNote, type NightSchool } from '@/lib/data';
import { friendlyDate } from '@/lib/dates';
import { isPro } from '@/lib/plan';
import { ChipPicker } from '@/components/ChipPicker';
import { BackLink, Button, Card, ErrorText, Label, Screen, TaliSays, Title, Hint, goBack } from '@/components/ui';
import { ThemeHero, THEMES } from '@/components/PageTheme';
import { BusButton, ChalkBox, ChalkChip, ChalkDust, ChalkHeader, ChalkLabel, chalkStyle, school } from '@/components/SchoolTheme';
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
        <ThemeHero theme="nightschool" title="Night school" onBack={() => goBack('/me')} backLabel="Me" />
        <TaliSays pose="think">Night school is part of Tali HQ Pro. You pick what I study, I research it late at night and tell you what I learnt in the morning.</TaliSays>
        <Button title="See plans" onPress={() => router.navigate('/plans')} />
      </Screen>
    );
  }

  if (open) {
    return (
      <Screen bg={THEMES.nightschool.bg}>
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
    <Screen bg={school.board} onRefresh={load}>
      <ChalkDust />
      <ChalkHeader title="Night school" sub="Pick up to three things for Tali to study. Late at night she researches one, saves what she learns, and her notes land here." onBack={() => goBack('/me')} backLabel="Me" />

      <ChalkBox>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[chalkStyle, { fontSize: 18, fontWeight: '800', fontStyle: 'italic' }]}>{ns.enabled ? 'Class is on' : 'Class is off'}</Text>
          <Switch value={ns.enabled} onValueChange={(v) => setNs({ ...ns, enabled: v })} trackColor={{ true: '#2F8F5B', false: '#C9C3B5' }} thumbColor="#FFFFFF" {...({ activeThumbColor: "#FFFFFF" } as object)} />
        </View>
        <Text style={{ fontSize: 13, color: school.chalkSoft, marginTop: 4 }}>{ns.nights === 'every' ? 'Every night' : 'Monday, Wednesday and Friday nights'}</Text>
      </ChalkBox>

      <ChalkLabel right={<Text style={{ color: school.chalkFaint, fontSize: 12 }}>{ns.topics.length} of 3</Text>}>Her subjects</ChalkLabel>
      {ns.topics.map((t, i) => (
        <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(244,241,232,0.14)' }}>
          <Text style={[chalkStyle, { fontSize: 20, fontWeight: '800', fontStyle: 'italic', width: 24 }]}>{i + 1}.</Text>
          <Text style={[chalkStyle, { flex: 1, fontSize: 17, fontWeight: '700' }]}>{t}</Text>
          <Pressable onPress={() => setNs({ ...ns, topics: ns.topics.filter((_, j) => j !== i) })} hitSlop={8}>
            <Text style={{ color: '#F2A7A0', fontWeight: '800', fontSize: 13 }}>Rub out</Text>
          </Pressable>
        </View>
      ))}
      {ns.topics.length < 3 ? (
        <>
          <TextInput value={newTopic} onChangeText={setNewTopic} placeholder="Write a subject, e.g. Instagram ideas for cafes" placeholderTextColor={school.chalkFaint} maxLength={80}
            onSubmitEditing={() => addTopic(newTopic)} returnKeyType="done"
            style={{ borderBottomWidth: 1.5, borderBottomColor: school.chalkSoft, paddingHorizontal: 4, paddingVertical: 10, fontSize: 16, color: school.chalk, marginTop: 4, marginBottom: 6 }} />
          <BusButton title="Add subject" outline onPress={() => addTopic(newTopic)} />
          {ns.topics.length === 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {IDEAS.map((idea) => <ChalkChip key={idea} label={idea} on={false} onPress={() => addTopic(idea)} />)}
            </View>
          ) : null}
        </>
      ) : null}

      <ChalkLabel>Class nights</ChalkLabel>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <ChalkChip label="Mon, Wed and Fri" on={ns.nights !== 'every'} onPress={() => setNs({ ...ns, nights: 'three' })} />
        <ChalkChip label="Every night" on={ns.nights === 'every'} onPress={() => setNs({ ...ns, nights: 'every' })} />
      </View>
      <Text style={{ color: school.chalkFaint, fontSize: 12, marginTop: 8, lineHeight: 18 }}>A few credits a night: 1 for the class plus 2 for each web search, usually 3 to 7 all up.</Text>

      <ErrorText>{error}</ErrorText>
      {done ? <Text style={{ color: '#9BE3B5', fontWeight: '700', marginTop: space.sm }}>{done}</Text> : null}
      <BusButton title={busy ? 'Saving...' : 'Save'} onPress={save} disabled={!changed || busy} />

      <ChalkLabel>Her notes</ChalkLabel>
      {notes.length === 0 ? (
        <ChalkBox><Text style={{ color: school.chalkSoft, fontSize: 14, fontStyle: 'italic' }}>{ns.topics.length ? 'Her first notes show up the morning after her first class.' : 'Add a subject and her notes land here.'}</Text></ChalkBox>
      ) : (
        notes.map((n) => (
          <Pressable key={n.id} onPress={() => { setOpen(n); if (!n.read_at) markNightNoteRead(n.id).then(load); }}>
            <ChalkBox>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ flex: 1, fontSize: 11, color: school.chalkFaint, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>{n.topic} · {friendlyDate(n.for_date)}</Text>
                {!n.read_at ? <Text style={{ fontSize: 10, fontWeight: '900', color: '#FFFFFF', backgroundColor: '#D64A4A', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' }}>NEW</Text> : null}
              </View>
              <Text style={[chalkStyle, { fontSize: 18, fontWeight: '700', fontStyle: 'italic', marginTop: 6, lineHeight: 25 }]}>{n.headline}</Text>
            </ChalkBox>
          </Pressable>
        ))
      )}
    </Screen>
  );
}
