import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { markNightNoteRead, myCredits, nightNotes, nightSchool, saveNightSchool, type NightNote, type NightSchool } from '@/lib/data';
import { friendlyDate } from '@/lib/dates';
import { isPro } from '@/lib/plan';
import { ChipPicker } from '@/components/ChipPicker';
import { BackLink, Button, Card, ErrorText, Label, Screen, TaliSays, Title, Hint, goBack } from '@/components/ui';
import { ThemeHero, THEMES } from '@/components/PageTheme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import { Sky, night } from '@/components/NightSky';
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

  // 6 Nov 2026 (Taj): Night school wears the night, like Sleep. Midnight sky, glass cards, glowing accents.
  return (
    <Sky>
      <Screen bg="transparent" onRefresh={load}>
        <Pressable onPress={() => goBack('/me')} hitSlop={12} accessibilityRole="button">
          <Text style={{ color: night.accent, fontSize: 15, fontWeight: '700' }}>{'\u2039'} Me</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16 }}>
          <LinearGradient colors={[night.accent, night.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', shadowColor: night.accent2, shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } }}>
            <Ionicons name="school" size={28} color="#141033" />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={{ color: night.accent2, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>WHILE YOU SLEEP, SHE STUDIES</Text>
            <Text style={{ color: night.ink, fontSize: 30, fontWeight: '800', letterSpacing: -0.4 }}>Night school</Text>
          </View>
        </View>
        <Text style={{ color: night.muted, fontSize: 14, lineHeight: 20, marginTop: 12, marginBottom: 16 }}>Pick up to three things for Tali to study. Late at night she researches one, and her notes are here in the morning.</Text>

        <View style={ns_.row}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: night.ink, fontSize: 16, fontWeight: '800' }}>{ns.enabled ? 'Studying tonight' : 'Night school is off'}</Text>
            <Text style={{ color: night.muted, fontSize: 12, marginTop: 2 }}>{ns.nights === 'every' ? 'Every night' : 'Monday, Wednesday and Friday nights'}</Text>
          </View>
          <Switch value={ns.enabled} onValueChange={(v) => setNs({ ...ns, enabled: v })} trackColor={{ true: night.accent, false: 'rgba(255,255,255,0.2)' }} thumbColor="#FFFFFF" {...({ activeThumbColor: '#FFFFFF' } as object)} />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={ns_.label}>What she studies</Text>
          <Text style={{ color: night.faint, fontSize: 12, marginTop: 18 }}>{ns.topics.length} of 3</Text>
        </View>
        {ns.topics.map((t, i) => (
          <View key={t} style={[ns_.row, { marginTop: 0, marginBottom: 8 }]}>
            <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(185,166,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 16 }}>{['\u{1F4D8}', '\u{1F4D7}', '\u{1F4D9}'][i % 3]}</Text>
            </View>
            <Text style={{ flex: 1, color: night.ink, fontSize: 15, fontWeight: '700' }}>{t}</Text>
            <Pressable onPress={() => setNs({ ...ns, topics: ns.topics.filter((_, j) => j !== i) })} hitSlop={10} accessibilityLabel={`Remove ${t}`}>
              <Text style={{ color: night.faint, fontSize: 16, fontWeight: '800' }}>{'\u2715'}</Text>
            </Pressable>
          </View>
        ))}
        {ns.topics.length < 3 ? (
          <>
            <View style={[ns_.row, { marginTop: 0, paddingVertical: 4 }]}>
              <TextInput value={newTopic} onChangeText={setNewTopic} placeholder="Add a subject, e.g. Instagram ideas for cafes" placeholderTextColor={night.faint} maxLength={80}
                onSubmitEditing={() => addTopic(newTopic)} returnKeyType="done" style={{ flex: 1, color: night.ink, fontSize: 15, paddingVertical: 10 }} />
              <Pressable onPress={() => addTopic(newTopic)} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: night.accent }}>
                <Text style={{ color: '#1B1340', fontWeight: '800' }}>Add</Text>
              </Pressable>
            </View>
            {ns.topics.length === 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {IDEAS.map((idea) => (
                  <Pressable key={idea} onPress={() => addTopic(idea)} style={ns_.chip}><Text style={{ color: night.ink, fontWeight: '700', fontSize: 13 }}>{idea}</Text></Pressable>
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        <Text style={ns_.label}>How often</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['three', 'every'] as const).map((n) => {
            const on = (ns.nights === 'every' ? 'every' : 'three') === n;
            return (
              <Pressable key={n} onPress={() => setNs({ ...ns, nights: n })} style={[ns_.chip, on && { backgroundColor: night.accent, borderColor: night.accent }]}>
                <Text style={{ color: on ? '#1B1340' : night.ink, fontWeight: '700', fontSize: 13 }}>{n === 'every' ? 'Every night' : 'Mon, Wed and Fri'}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ color: night.faint, fontSize: 12, marginTop: 8, lineHeight: 18 }}>A few credits a night: 1 for the night plus 2 for each web search, usually 3 to 7 all up.</Text>

        <ErrorText>{error}</ErrorText>
        {done ? <Text style={{ color: '#9BE3B5', fontWeight: '700', marginTop: space.sm }}>{done}</Text> : null}
        <Pressable onPress={save} disabled={!changed || busy} accessibilityRole="button" style={[ns_.cta, (!changed || busy) && { opacity: 0.45 }]}>
          <LinearGradient colors={[night.accent, night.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />
          <Text style={{ color: '#141033', fontWeight: '800', fontSize: 16 }}>{busy ? 'Saving...' : 'Save'}</Text>
        </Pressable>

        <Text style={ns_.label}>What she learnt</Text>
        {notes.length === 0 ? (
          <View style={ns_.row}><Text style={{ color: night.muted, fontSize: 14 }}>{ns.topics.length ? 'Her first notes show up the morning after her first night.' : 'Add a subject and her notes land here.'}</Text></View>
        ) : (
          notes.map((n) => (
            <Pressable key={n.id} onPress={() => { setOpen(n); if (!n.read_at) markNightNoteRead(n.id).then(load); }} style={[ns_.row, { marginTop: 0, marginBottom: 8, flexDirection: 'column', alignItems: 'stretch' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ flex: 1, fontSize: 11, color: night.faint, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>{n.topic} · {friendlyDate(n.for_date)}</Text>
                {!n.read_at ? <Text style={{ fontSize: 10, fontWeight: '900', color: '#141033', backgroundColor: night.accent2, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' }}>NEW</Text> : null}
              </View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: night.ink, marginTop: 6, lineHeight: 24 }}>{n.headline}</Text>
            </Pressable>
          ))
        )}
      </Screen>
    </Sky>
  );
}

const ns_ = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: night.glass, borderWidth: 1, borderColor: night.line, borderRadius: 18, padding: 14, marginTop: 4 },
  label: { fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: night.faint, fontWeight: '800', marginTop: 20, marginBottom: 8 },
  chip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: night.line, backgroundColor: night.glass },
  cta: { marginTop: 16, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shadowColor: night.accent2, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 18, elevation: 6 },
});
