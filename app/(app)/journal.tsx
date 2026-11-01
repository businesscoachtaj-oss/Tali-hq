import { useCallback, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { deleteJournalEntry, journalEntries, saveJournalEntry, type JournalEntry } from '@/lib/data';
import { Body, Button, Card, ErrorText, Field, Label, Screen, Title } from '@/components/ui';
import { colours, radius, space } from '@/constants/theme';

const MOODS = ['Rough', 'Meh', 'Okay', 'Good', 'Great'];

type Draft = { id?: string; kind: 'journal' | 'note'; title: string; body: string; mood: number | null; private_to_tali: boolean };
const blank = (): Draft => ({ kind: 'journal', title: '', body: '', mood: null, private_to_tali: false });

function when(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function Journal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      setEntries(await journalEntries());
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your journal.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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
      setDraft(null);
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
      setDraft(null);
      setConfirmDelete(false);
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Could not delete.');
    }
    setBusy(false);
  }

  if (draft) {
    return (
      <Screen>
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
          <Switch value={draft.private_to_tali} onValueChange={(v) => setDraft({ ...draft, private_to_tali: v })} trackColor={{ true: colours.purple, false: colours.borderStrong }} thumbColor="#FFFFFF" />
        </Card>
        <ErrorText>{error}</ErrorText>
        <Button title="Save" onPress={save} busy={busy} />
        <Button title="Cancel" kind="ghost" onPress={() => { setDraft(null); setConfirmDelete(false); setError(''); }} />
        {draft.id ? <Button title={confirmDelete ? 'Tap again to delete for good' : 'Delete'} kind="danger" onPress={remove} disabled={busy} /> : null}
      </Screen>
    );
  }

  return (
    <Screen>
      <Title sub="Your journal and notes. Tali learns from them unless you keep an entry private.">Journal</Title>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}><Button title="New entry" onPress={() => setDraft(blank())} /></View>
        <View style={{ flex: 1 }}><Button title="New note" kind="ghost" onPress={() => setDraft({ ...blank(), kind: 'note' })} /></View>
      </View>
      <ErrorText>{error}</ErrorText>
      <View style={{ height: space.lg }} />
      {entries.length === 0 ? (
        <Card><Body muted>Nothing here yet. A few lines a day about what happened and what's on your mind is plenty.</Body></Card>
      ) : (
        entries.map((e) => (
          <Pressable
            key={e.id}
            onPress={() => setDraft({ id: e.id, kind: e.kind, title: e.title ?? '', body: e.body, mood: e.mood, private_to_tali: e.private_to_tali })}>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                <Text style={{ fontSize: 12, color: colours.muted, fontWeight: '700', textTransform: 'uppercase' }}>
                  {e.kind === 'note' ? 'Note' : 'Journal'} {'·'} {when(e.created_at)}
                </Text>
                {e.private_to_tali ? <Text style={{ fontSize: 12, color: colours.purpleInk, fontWeight: '700' }}>Private</Text> : null}
              </View>
              {e.title ? <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text, marginTop: 4 }}>{e.title}</Text> : null}
              <Text numberOfLines={3} style={{ fontSize: 15, color: colours.text, marginTop: 4, lineHeight: 21 }}>{e.body}</Text>
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}
