import { useCallback, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
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
const blank = (): Draft => ({ kind: 'journal', title: '', body: '', mood: null, private_to_tali: false });

function when(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function Journal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
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
        <Title>{draft.id ? 'Edit entry' : draft.kind === 'note' ? 'New note' : 'New journal entry'}</Title>
        <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
          {(['journal', 'note'] as const).map((k) => (
            <Pressable
              key={k}
              onPress={() => setDraft({ ...draft, kind: k })}
              style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: draft.kind === k ? colours.purple : colours.borderStrong, backgroundColor: draft.kind === k ? colours.purple : colours.surface }}>
              <Text style={{ color: draft.kind === k ? colours.onPurple : colours.text, fontWeight: '700' }}>{k === 'journal' ? 'Journal' : 'Note'}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="Title (optional)" value={draft.title} onChangeText={(t) => setDraft({ ...draft, title: t })} maxLength={120} />
        {draft.kind === 'journal' ? (
          <>
            <Label>How was today</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md }}>
              {MOODS.map((m, i) => {
                const on = draft.mood === i + 1;
                return (
                  <Pressable key={m} onPress={() => setDraft({ ...draft, mood: on ? null : i + 1 })} style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? colours.orange : colours.borderStrong, backgroundColor: on ? colours.orangeSoft : colours.surface }}>
                    <Text style={{ color: colours.text, fontWeight: '600' }}>{m}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
        <Field
          label={draft.kind === 'journal' ? "What's on your mind" : 'Note'}
          value={draft.body}
          onChangeText={(t) => setDraft({ ...draft, body: t })}
          multiline
          maxLength={20000}
          style={{ minHeight: 180, textAlignVertical: 'top' }}
        />
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
      <SkinHeader id="journal" title="Journal" sub={tab === 'mine' ? 'Your journal and notes. Tali learns from them unless you keep an entry private.' : 'Every Sunday evening Tali writes up her week working with you.'} />
      <View style={{ flexDirection: 'row', backgroundColor: colours.surface, borderRadius: radius.pill, padding: 4, marginBottom: space.md, ...elevation.tile }}>
        {(['mine', 'tali'] as const).map((k) => (
          <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}
            style={{ flex: 1, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: tab === k ? '#7A3B1E' : 'transparent', alignItems: 'center' }}>
            <Text style={{ fontWeight: '700', color: tab === k ? '#FFFFFF' : colours.muted }}>
              {k === 'mine' ? 'Yours' : "Tali's"}{k === 'tali' && hers.some((h) => !h.read_at) ? ' \u2022' : ''}
            </Text>
          </Pressable>
        ))}
      </View>
      {tab === 'tali' ? (
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
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}><Button title="New entry" onPress={() => openDraft(blank())} /></View>
        <View style={{ flex: 1 }}><Button title="New note" kind="ghost" onPress={() => openDraft({ ...blank(), kind: 'note' })} /></View>
      </View>
      <ErrorText>{error}</ErrorText>
      <View style={{ height: space.lg }} />
      {entries.length === 0 ? (
        <TaliSays pose="idle">Nothing here yet. A few lines a day about what happened and what's on your mind is plenty, and I'll learn from them.</TaliSays>
      ) : (
        entries.map((e) => (
          <Pressable
            key={e.id}
            onPress={() => openDraft({ id: e.id, kind: e.kind, title: e.title ?? '', body: e.body, mood: e.mood, private_to_tali: e.private_to_tali })}>
            <Card style={{ borderLeftWidth: 5, borderLeftColor: e.kind === 'note' ? colours.purple : '#D0814A' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: e.kind === 'note' ? colours.purpleSoft : '#F7EFE8', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={e.kind === 'note' ? 'document-text-outline' : 'book-outline'} size={16} color={e.kind === 'note' ? colours.purple : '#7A3B1E'} />
                </View>
                <Text style={{ flex: 1, fontSize: 12, color: colours.muted, fontWeight: '700', textTransform: 'uppercase' }}>
                  {e.kind === 'note' ? 'Note' : 'Journal'} {'·'} {when(e.created_at)}
                </Text>
                {e.mood ? <Text style={{ fontSize: 12, fontWeight: '800', color: '#7A3B1E', backgroundColor: '#F7EFE8', borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9, overflow: 'hidden' }}>{MOODS[e.mood - 1]}</Text> : null}
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
