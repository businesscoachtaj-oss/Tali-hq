// People memory (3 Nov 2026): one client, what Tali knows about them, notes, contact dates.
// Opened from a Clients row as /person?id=<client id>. Tali HQ and up, 0 credits.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { forgetMemory, myCredits, type Client, type Credits, type Memory } from '@/lib/data';
import { isPaid } from '@/lib/plan';
import { client as loadClient, memoriesAbout, saveContact } from '@/lib/people';
import { addDays, FOLLOW_UP_PICKS, friendlyDate, isoDate, today } from '@/lib/dates';
import { ChipPicker } from '@/components/ChipPicker';
import { BackLink, Body, Button, Card, ErrorText, goBack, Label, Loading, Screen, TaliSays, Title } from '@/components/ui';
import { colours, space } from '@/constants/theme';

// 4 Nov 2026: which quick pick matches a saved follow-up date, so the chip row shows the right one.
// "None" for no date, the matching label when one lines up with today's picks, otherwise null.
function followUpPickFor(iso: string | null | undefined): string | null {
  if (!iso) return 'None';
  const now = new Date();
  const hit = FOLLOW_UP_PICKS.find((p) => p.days !== null && isoDate(addDays(now, p.days)) === iso);
  return hit ? hit.label : null;
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Active', quiet: 'Gone quiet', paused: 'Paused', past: 'Past client',
  new: 'New', talking: 'Talking', won: 'Won', lost: 'Lost',
};

export default function Person() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [credits, setCredits] = useState<Credits | null | undefined>(undefined);
  const [person, setPerson] = useState<Client | null>(null);
  const [mems, setMems] = useState<Memory[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editingDates, setEditingDates] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  // 4 Nov 2026: the page used to be blank until the data arrived. Now it shows a spinner first.
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setError('');
    if (!id) return setNotFound(true);
    try {
      const c = await myCredits();
      setCredits(c);
      const p = await loadClient(id);
      if (!p) return setNotFound(true);
      setPerson(p);
      if (isPaid(c)) setMems(await memoriesAbout(p.name).catch(() => []));
    } catch (e: any) {
      setError(e?.message ?? 'Could not load this person.');
    } finally {
      setLoaded(true);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function forget(mid: string) {
    if (confirmId !== mid) return setConfirmId(mid);
    setConfirmId(null);
    try {
      if (await forgetMemory(mid)) setMems((m) => m.filter((x) => x.id !== mid));
    } catch (e: any) {
      setError(e?.message ?? 'Could not forget that.');
    }
  }

  async function setDates(patch: { last_contact_at?: string | null; next_follow_up?: string | null }) {
    if (!person) return;
    setBusy(true);
    try {
      await saveContact(person.id, patch);
      setPerson({ ...person, ...patch });
    } catch (e: any) {
      setError(e?.message ?? 'Could not save.');
    }
    setBusy(false);
  }

  const ask = () => person && router.navigate({ pathname: '/talk', params: { ask: `What do I know about ${person.name}?` } } as any);

  if (notFound) {
    return (
      <Screen>
        <BackLink onPress={() => goBack('/clients')} label="Clients" />
        <Title>Person</Title>
        <TaliSays pose="think">I can't find that person. They may have been deleted.</TaliSays>
      </Screen>
    );
  }

  if (!loaded && !person) return <Loading />;

  if (!person) {
    return (
      <Screen onRefresh={load}>
        <BackLink onPress={() => goBack('/clients')} label="Clients" />
        {error ? <Card><Body muted>{error}</Body></Card> : null}
      </Screen>
    );
  }

  const paid = isPaid(credits);
  const due = person.next_follow_up && person.next_follow_up <= today();

  return (
    <Screen onRefresh={load}>
      <BackLink onPress={() => goBack('/clients')} label="Clients" />
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginBottom: space.lg }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: colours.text }}>{person.name}</Text>
          <Text style={{ fontSize: 15, color: colours.muted, marginTop: 4 }}>
            {person.kind === 'lead' ? 'Lead' : 'Client'} {'·'} {STATUS_LABEL[person.status] ?? person.status}
            {person.email ? ` ${'·'} ${person.email}` : ''}
          </Text>
        </View>
        <Pressable onPress={() => router.navigate({ pathname: '/clients', params: { edit: person.id, from: 'person' } } as any)} accessibilityRole="button" hitSlop={8}
          style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colours.borderStrong, backgroundColor: colours.surface }}>
          <Text style={{ color: colours.purple, fontWeight: '700', fontSize: 14 }}>Edit</Text>
        </Pressable>
      </View>
      {error ? <Card><Body muted>{error}</Body></Card> : null}

      <Label>What Tali knows</Label>
      {!paid ? (
        <Card>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text }}>People memory is part of Tali HQ</Text>
          <Body muted>Everything Tali has picked up about {person.name.split(' ')[0]} from your chats, in one place, with a nudge before you meet.</Body>
          <Button title="See plans" kind="ghost" onPress={() => router.navigate('/plans')} />
        </Card>
      ) : mems.length === 0 ? (
        <TaliSays pose="idle">Nothing about {person.name.split(' ')[0]} yet. Mention them in Talk and I'll start remembering.</TaliSays>
      ) : (
        <Card>
          {mems.map((m, i) => (
            <View key={m.id} style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start', paddingVertical: space.md, borderTopWidth: i ? 1 : 0, borderTopColor: colours.border }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: colours.purpleInk, fontWeight: '700', textTransform: 'uppercase' }}>{m.kind}</Text>
                <Text style={{ fontSize: 14, color: colours.text, lineHeight: 20, marginTop: 2 }}>{m.content}</Text>
              </View>
              <Pressable onPress={() => forget(m.id)} accessibilityRole="button" hitSlop={8}>
                <Text style={{ color: confirmId === m.id ? colours.danger : colours.muted, fontWeight: '700', fontSize: 13 }}>
                  {confirmId === m.id ? 'Sure?' : 'Forget this'}
                </Text>
              </Pressable>
            </View>
          ))}
        </Card>
      )}
      {paid ? <Button title="Ask Tali" onPress={ask} /> : null}
      <View style={{ height: space.md }} />

      <Label>Notes</Label>
      <Card>
        {person.notes ? <Body>{person.notes}</Body> : <Body muted>No notes yet. Tap Edit to add some.</Body>}
      </Card>

      <Label>Contact</Label>
      <Card>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colours.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Last contact</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text, marginTop: 4 }}>{person.last_contact_at ? friendlyDate(person.last_contact_at) : 'Not yet'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colours.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Next follow up</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: due ? colours.orange : colours.text, marginTop: 4 }}>{person.next_follow_up ? friendlyDate(person.next_follow_up) : 'None'}</Text>
          </View>
        </View>
        {editingDates ? (
          <View style={{ marginTop: space.md }}>
            <Label>Follow up</Label>
            <ChipPicker options={FOLLOW_UP_PICKS.map((p) => p.label)} value={followUpPickFor(person.next_follow_up)}
              onChange={(l) => { const d = FOLLOW_UP_PICKS.find((p) => p.label === l)!.days; setDates({ next_follow_up: d === null ? null : isoDate(addDays(new Date(), d)) }); }} />
            <Button title="Contacted today" kind="ghost" onPress={() => setDates({ last_contact_at: today() })} disabled={busy} />
            <Button title="Done" kind="ghost" onPress={() => setEditingDates(false)} />
          </View>
        ) : (
          <Button title="Change" kind="ghost" onPress={() => setEditingDates(true)} />
        )}
        <ErrorText>{error}</ErrorText>
      </Card>
    </Screen>
  );
}
