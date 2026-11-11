import { useCallback, useMemo, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { deleteJournalEntry, journalEntries, markBriefRead, myCredits, saveJournalEntry, taliJournal, type Brief, type JournalEntry } from '@/lib/data';
import { isPaid, isPro } from '@/lib/plan';
import { friendlyDate } from '@/lib/dates';
import { recentPatterns, type PatternsBrief } from '@/lib/patterns';
import { PatternsCard } from '@/components/PatternsCard';
import { BackLink, Body, Button, Card, ErrorText, Field, Label, Screen, TaliSays, Title, useConfirm } from '@/components/ui';
import { SkinHeader } from '@/components/PageSkin';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colours, elevation, radius, space } from '@/constants/theme';

const MOODS = ['Rough', 'Meh', 'Okay', 'Good', 'Great'];

type Draft = { id?: string; kind: 'journal' | 'note'; title: string; body: string; mood: number | null; private_to_tali: boolean };
const blank = (kind: 'journal' | 'note' = 'journal'): Draft => ({ kind, title: '', body: '', mood: null, private_to_tali: false });

function when(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}

// 11 Nov 2026 journal rework (Taj: the journal is your time and your place). Tali never speaks in it.
// The page comes first and the mood last, your own words come back on their date, and the month is a
// calendar coloured by how each day was. Notes live on their own screen (mode "notes").
const MOOD_COLOUR = ['#E7A6CF', '#FFB561', '#B9A6FF', '#7FE0B0', '#4FD39A'];
const PROMPTS = ["What's taking up the most room today?", 'What went well today?', 'What are you carrying that you could put down?', 'What do you want to remember about today?', 'What would make tomorrow easier?'];
const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const LOOK_BACK: [string, (d: Date) => void][] = [
  ['A year ago today', (d) => d.setFullYear(d.getFullYear() - 1)],
  ['Six months ago today', (d) => d.setMonth(d.getMonth() - 6)],
  ['Three months ago today', (d) => d.setMonth(d.getMonth() - 3)],
  ['A month ago today', (d) => d.setMonth(d.getMonth() - 1)],
  ['A week ago today', (d) => d.setDate(d.getDate() - 7)],
];

export default function Journal() {
  return <JournalScreen mode="journal" />;
}

export function JournalScreen({ mode }: { mode: 'journal' | 'notes' }) {
  const notesMode = mode === 'notes';
  const [all, setEntries] = useState<JournalEntry[]>([]);
  const [search, setSearch] = useState('');
  const entries = useMemo(() => {
    const mine = all.filter((e) => (e.kind === 'note') === notesMode);
    const q = search.trim().toLowerCase();
    return q ? mine.filter((e) => `${e.title ?? ''} ${e.body}`.toLowerCase().includes(q)) : mine;
  }, [all, notesMode, search]);
  const prompt = useMemo(() => PROMPTS[new Date().getDate() % PROMPTS.length], []);
  // Your own words from this date, the furthest back first. No commentary.
  const lookBack = useMemo(() => {
    if (notesMode) return null;
    for (const [label, shift] of LOOK_BACK) {
      const d = new Date();
      shift(d);
      const hit = all.find((e) => e.kind === 'journal' && localDay(new Date(e.created_at)) === localDay(d));
      if (hit) return { label, entry: hit };
    }
    return null;
  }, [all, notesMode]);
  // This month as a grid: one square per day, coloured by that day's mood.
  const month = useMemo(() => {
    const now = new Date();
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const lead = (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7;
    const byDay = new Map<number, JournalEntry>();
    for (const e of all) {
      const d = new Date(e.created_at);
      if (e.kind === 'journal' && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && !byDay.has(d.getDate())) byDay.set(d.getDate(), e);
    }
    return { days, lead, byDay, today: now.getDate(), name: now.toLocaleDateString('en-AU', { month: 'long' }) };
  }, [all]);
  const [draft, setDraft] = useState<Draft | null>(null);
  // 4 Nov 2026: what the editor opened with, so Cancel and Back can tell if anything changed.
  const [opened, setOpened] = useState<Draft | null>(null);
  const { armed, confirm } = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState<'mine' | 'tali'>('mine');
  const [hers, setHers] = useState<Brief[]>([]);
  // Patterns (Pro, 3 Nov 2026): Tali's monthly patterns sit on her tab too, above the journal.
  const [patterns, setPatterns] = useState<PatternsBrief[]>([]);
  const [paid, setPaid] = useState(false);
  const [pro, setPro] = useState(false);
  const [reading, setReading] = useState<Brief | null>(null);

  const load = useCallback(async () => {
    try {
      const [mine, c] = await Promise.all([journalEntries(), myCredits()]);
      setEntries(mine);
      setPaid(isPaid(c));
      setPro(isPro(c));
      setHers(await taliJournal().catch(() => []));
      setPatterns(isPro(c) ? await recentPatterns(3).catch(() => []) : []);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your journal.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Open the editor and remember the starting point.
  function openDraft(d: Draft) {
    setOpened(d);
    setDraft(d);
    setConfirmDelete(false);
    setError('');
  }

  function closeEditor() {
    setDraft(null);
    setOpened(null);
    setConfirmDelete(false);
    setError('');
  }

  // Unsaved changes get a two-tap confirm; a clean editor just closes.
  function cancel() {
    if (dirty) confirm('discard', closeEditor);
    else closeEditor();
  }

  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(opened);

  async function save() {
    if (!draft) return;
    setError('');
    if (!draft.body.trim()) return setError('Write something first.');
    setBusy(true);
    try {
      await saveJournalEntry({
        id: draft.id,
        kind: draft.kind,
        title: draft.title.trim() || null,
        body: draft.body.trim(),
        mood: draft.kind === 'journal' ? draft.mood : null,
        private_to_tali: draft.private_to_tali,
      });
      closeEditor();
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save.');
    }
    setBusy(false);
  }

  async function remove() {
    if (!draft?.id) return;
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    try {
      await deleteJournalEntry(draft.id);
      closeEditor();
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Could not delete.');
    }
    setBusy(false);
  }

  if (reading) {
    return (
      <Screen>
        <BackLink onPress={() => setReading(null)} label="Tali's journal" />
        <Text style={{ fontSize: 12, color: colours.muted, fontWeight: '700', textTransform: 'uppercase' }}>Week ending {friendlyDate(reading.for_date)}</Text>
        <Title>{reading.content.headline || "Tali's week"}</Title>
        {(reading.content.paragraphs ?? []).map((p, i) => (
          <Text key={i} style={{ fontSize: 16, lineHeight: 25, color: colours.text, marginBottom: space.md }}>{p}</Text>
        ))}
        <Text style={{ fontSize: 15, color: colours.purpleInk, fontWeight: '700', marginTop: space.sm }}>Tali</Text>
      </Screen>
    );
  }

  if (draft) {
    return (
      <Screen>
        <BackLink onPress={cancel} label={armed === 'discard' ? 'Sure?' : 'Back'} />
        {draft.kind === 'note' ? (
          <>
            <Title>{draft.id ? 'Edit note' : 'New note'}</Title>
            <Field label="Title (optional)" value={draft.title} onChangeText={(t) => setDraft({ ...draft, title: t })} maxLength={120} />
            <Field label="Note" value={draft.body} onChangeText={(t) => setDraft({ ...draft, body: t })} multiline maxLength={20000} style={{ minHeight: 180, textAlignVertical: 'top' }} />
          </>
        ) : (
          <>
            <Text style={{ color: colours.muted, fontSize: 13, fontWeight: '700', marginBottom: space.sm }}>
              {new Date(all.find((e) => e.id === draft.id)?.created_at ?? Date.now()).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
            {/* The page first. The prompt is only a placeholder, so it goes the moment they type. */}
            <TextInput
              value={draft.body}
              onChangeText={(t) => setDraft({ ...draft, body: t })}
              multiline
              autoFocus={!draft.id}
              maxLength={20000}
              placeholder={prompt}
              placeholderTextColor={colours.faint}
              accessibilityLabel="Your journal entry"
              style={{ minHeight: 260, textAlignVertical: 'top', backgroundColor: 'rgba(12,10,36,0.5)', borderWidth: 1, borderColor: colours.borderStrong, borderRadius: 16, padding: 16, color: colours.text, fontSize: 19, lineHeight: 27, fontFamily: 'InstrumentSerif_400Regular', marginBottom: space.md }}
            />
            <Label>How was today</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md }}>
              {MOODS.map((m, i) => {
                const on = draft.mood === i + 1;
                return (
                  <Pressable key={m} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setDraft({ ...draft, mood: on ? null : i + 1 })}
                    style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? MOOD_COLOUR[i] : colours.borderStrong, backgroundColor: on ? MOOD_COLOUR[i] : 'transparent' }}>
                    <Text style={{ color: on ? colours.onPurple : colours.text, fontWeight: '600' }}>{m}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: colours.text }}>Keep this from Tali</Text>
            <Text style={{ color: colours.muted, fontSize: 13, marginTop: 2 }}>When on, Tali never reads or learns from this entry.</Text>
          </View>
          <Switch value={draft.private_to_tali} onValueChange={(v) => setDraft({ ...draft, private_to_tali: v })} trackColor={{ true: colours.purple, false: colours.borderStrong }} thumbColor="#FFFFFF" {...({ activeThumbColor: "#FFFFFF" } as object)} />
        </Card>
        <ErrorText>{error}</ErrorText>
        <Button title="Save" onPress={save} busy={busy} />
        <Button title={armed === 'discard' ? 'Sure?' : dirty ? 'Discard changes?' : 'Cancel'} kind="ghost" onPress={cancel} />
        {draft.id ? <Button title={confirmDelete ? 'Tap again to delete for good' : 'Delete'} kind="danger" onPress={remove} disabled={busy} /> : null}
      </Screen>
    );
  }

  return (
    <Screen skin="journal" onRefresh={load}>
      {/* 9 Nov 2026: Journal gets the same banner and card style as the other pages. */}
      <SkinHeader id="journal" title={notesMode ? 'Notes' : 'Journal'} sub={notesMode ? 'Things to find again. Tali learns from them unless you keep a note private.' : tab === 'mine' ? 'Your time and your place. Tali learns from it quietly unless you keep an entry private.' : 'Every Sunday evening Tali writes up her week working with you.'} />
      <View style={{ flexDirection: 'row', backgroundColor: colours.surface, borderRadius: radius.pill, padding: 4, marginBottom: space.md, display: notesMode ? 'none' : 'flex', ...elevation.tile }}>
        {(['mine', 'tali'] as const).map((k) => (
          <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}
            style={{ flex: 1, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: tab === k ? '#5B1F4A' : 'transparent', alignItems: 'center' }}>
            <Text style={{ fontWeight: '700', color: tab === k ? '#FFFFFF' : colours.muted }}>
              {k === 'mine' ? 'Yours' : "Tali's"}{k === 'tali' && hers.some((h) => !h.read_at) ? ' \u2022' : ''}
            </Text>
          </Pressable>
        ))}
      </View>
      {tab === 'tali' && !notesMode ? (
        <>
          {!paid ? (
            <>
              <TaliSays pose="wave">My weekly journal is part of Tali HQ. Every Sunday I write up what we worked on, what I noticed and what I'm keeping an eye on.</TaliSays>
              <Button title="See plans" onPress={() => router.navigate('/plans')} />
            </>
          ) : null}
          {paid && patterns.length ? (
            <>
              <Label>Patterns</Label>
              {patterns.map((p) => <PatternsCard key={p.id} brief={p} compact onRead={load} />)}
              <Label>Her journal</Label>
            </>
          ) : null}
          {!paid ? null : hers.length === 0 ? (
            <TaliSays pose="think">My first entry lands Sunday evening. The more you tell me this week, the better it'll be.</TaliSays>
          ) : (
            hers.map((h) => (
              <Pressable key={h.id} onPress={() => { setReading(h); if (!h.read_at) markBriefRead(h.id).then(load); }}>
                <Card style={!h.read_at ? { borderLeftWidth: 5, borderLeftColor: colours.purple } : undefined}>
                  <Text style={{ fontSize: 12, color: colours.muted, fontWeight: '700', textTransform: 'uppercase' }}>Week ending {friendlyDate(h.for_date)}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text, marginTop: 4 }}>{h.content.headline || "Tali's week"}</Text>
                  <Text numberOfLines={2} style={{ fontSize: 15, color: colours.muted, marginTop: 4, lineHeight: 21 }}>{(h.content.paragraphs ?? [])[0]}</Text>
                </Card>
              </Pressable>
            ))
          )}
          {pro ? <Button title="Night school: pick what Tali studies" kind="ghost" onPress={() => router.navigate('/night-school')} /> : null}
        </>
      ) : (
      <>
      {notesMode ? (
        <>
          {all.filter((e) => e.kind === 'note').length > 4 ? (
            <TextInput value={search} onChangeText={setSearch} placeholder="Search your notes" placeholderTextColor={colours.faint}
              style={{ backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.borderStrong, borderRadius: radius.input, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, marginBottom: space.md, color: colours.text }} />
          ) : null}
          <Button title="New note" onPress={() => openDraft(blank('note'))} />
        </>
      ) : (
        <>
          {lookBack ? (
            <Pressable accessibilityRole="button" onPress={() => { const e = lookBack.entry; openDraft({ id: e.id, kind: e.kind, title: e.title ?? '', body: e.body, mood: e.mood, private_to_tali: e.private_to_tali }); }}
              style={{ backgroundColor: colours.paper, borderRadius: 16, padding: 16, marginBottom: space.md }}>
              <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: '#7A6A8E' }}>{lookBack.label} · {when(lookBack.entry.created_at)}</Text>
              <Text numberOfLines={5} style={{ color: colours.ink, fontSize: 19, lineHeight: 26, marginTop: 6, fontFamily: 'InstrumentSerif_400Regular' }}>{lookBack.entry.body}</Text>
            </Pressable>
          ) : null}
          <Button title="Write" onPress={() => openDraft(blank())} />
          {all.some((e) => e.kind === 'journal') ? (
            <Card>
              <Text style={{ fontWeight: '800', color: colours.text, fontSize: 16, marginBottom: space.sm }}>{month.name}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {Array.from({ length: month.lead + month.days }, (_, i) => {
                  const day = i - month.lead + 1;
                  const e = day > 0 ? month.byDay.get(day) : undefined;
                  const box = { width: '100%' as const, aspectRatio: 1, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: e ? (e.mood ? MOOD_COLOUR[e.mood - 1] : colours.purpleInk) : day > 0 ? 'rgba(255,255,255,0.07)' : 'transparent', borderWidth: day === month.today ? 2 : 0, borderColor: '#FFFFFF' };
                  const num = day > 0 ? <Text style={{ fontSize: 11, fontWeight: '700', color: e ? colours.onPurple : colours.faint }}>{day}</Text> : null;
                  return (
                    <View key={i} style={{ width: `${100 / 7}%`, padding: 2.5 }}>
                      {e ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={`Read ${when(e.created_at)}`} style={box}
                          onPress={() => openDraft({ id: e.id, kind: e.kind, title: e.title ?? '', body: e.body, mood: e.mood, private_to_tali: e.private_to_tali })}>{num}</Pressable>
                      ) : <View style={box}>{num}</View>}
                    </View>
                  );
                })}
              </View>
              <Text style={{ color: colours.muted, fontSize: 13, marginTop: space.sm }}>
                {month.byDay.size} day{month.byDay.size === 1 ? '' : 's'} written this month. Tap a day to read it.
              </Text>
            </Card>
          ) : null}
        </>
      )}
      <ErrorText>{error}</ErrorText>
      <View style={{ height: space.lg }} />
      {entries.length === 0 ? (
        <Card><Body muted>{notesMode ? (search ? 'No notes match that.' : 'No notes yet. Keep the things you want to find again here.') : 'Nothing written yet. A few lines is plenty.'}</Body></Card>
      ) : (
        entries.map((e) => (
          <Pressable
            key={e.id}
            onPress={() => openDraft({ id: e.id, kind: e.kind, title: e.title ?? '', body: e.body, mood: e.mood, private_to_tali: e.private_to_tali })}>
            <Card style={{ borderLeftWidth: 5, borderLeftColor: e.kind === 'note' ? colours.purple : '#B24D8C' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: e.kind === 'note' ? colours.purpleSoft : '#F6ECF2', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={e.kind === 'note' ? 'document-text-outline' : 'book-outline'} size={16} color={e.kind === 'note' ? colours.purple : '#5B1F4A'} />
                </View>
                <Text style={{ flex: 1, fontSize: 12, color: colours.muted, fontWeight: '700', textTransform: 'uppercase' }}>
                  {e.kind === 'note' ? 'Note' : 'Journal'} {'·'} {when(e.created_at)}
                </Text>
                {e.mood ? <Text style={{ fontSize: 12, fontWeight: '800', color: '#5B1F4A', backgroundColor: '#F6ECF2', borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9, overflow: 'hidden' }}>{MOODS[e.mood - 1]}</Text> : null}
                {e.private_to_tali ? <Ionicons name="lock-closed" size={14} color={colours.purpleInk} accessibilityLabel="Private" /> : null}
              </View>
              {e.title ? <Text style={{ fontSize: 17, fontWeight: '800', color: colours.text, marginTop: 8 }}>{e.title}</Text> : null}
              <Text numberOfLines={3} style={{ fontSize: 15, color: colours.text, marginTop: 4, lineHeight: 21 }}>{e.body}</Text>
            </Card>
          </Pressable>
        ))
      )}
      </>
      )}
    </Screen>
  );
}
