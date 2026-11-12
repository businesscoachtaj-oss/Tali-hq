// Decision log (3 Nov 2026). Free reads and writes the log. "Ask Tali why" opens Talk with a
// prefilled question and is Tali HQ and up. No credits for the log itself.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { myCredits, type Credits } from '@/lib/data';
import { isPaid } from '@/lib/plan';
import { askWhyQuestion, decisions as loadDecisions, deleteDecision, saveDecision, type Decision } from '@/lib/decisions';
import { addDays, friendlyDate, isoDate, today } from '@/lib/dates';
import { ChipPicker } from '@/components/ChipPicker';
import { BackLink, Body, Button, Card, ErrorText, Field, Label, Screen, TaliSays, Title } from '@/components/ui';
import { SkinHeader } from '@/components/PageSkin';
import { colours, space } from '@/constants/theme';

type Draft = { id?: string; decision: string; reasoning: string; decided_at: string };
const WHEN = [
  { label: 'Today', days: 0 },
  { label: 'Yesterday', days: -1 },
  { label: 'Last week', days: -7 },
  { label: 'Last month', days: -30 },
] as const;

// 4 Nov 2026: a typed date has to be YYYY-MM-DD and a real day (so 2026-02-31 is out).
function validDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00`);
  return !Number.isNaN(d.getTime()) && isoDate(d) === s;
}

export default function Decisions() {
  const [credits, setCredits] = useState<Credits | null>(null);
  const [list, setList] = useState<Decision[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [planHint, setPlanHint] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [c, d] = await Promise.all([myCredits(), loadDecisions()]);
      setCredits(c);
      setList(d);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your decisions.');
    }
  }, []);

  useFocusLoad(load); // Speed pass (13 Nov 2026): see lib/useFocusLoad.ts

  const paid = isPaid(credits);

  async function save() {
    if (!draft) return;
    setError('');
    if (!draft.decision.trim()) return setError('What did you decide?');
    if (!validDate(draft.decided_at.trim())) return setError("I can't read that date. Use the format 2026-11-04.");
    setBusy(true);
    try {
      await saveDecision({ ...draft, decided_at: draft.decided_at.trim() });
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
      await deleteDecision(draft.id);
      setDraft(null);
      setConfirmDelete(false);
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Could not delete.');
    }
    setBusy(false);
  }

  function edit(d: Decision) {
    setConfirmDelete(false);
    setError('');
    setDraft({ id: d.id, decision: d.decision, reasoning: d.reasoning ?? '', decided_at: d.decided_at });
  }

  function askWhy(d: Decision) {
    if (!paid) return setPlanHint(true);
    router.navigate({ pathname: '/talk', params: { ask: askWhyQuestion(d.decision) } } as any);
  }

  if (draft) {
    return (
      <Screen skin="crossroads">
        <BackLink onPress={() => { setDraft(null); setConfirmDelete(false); setError(''); }} />
        <Title>{draft.id ? 'Edit decision' : 'Log a decision'}</Title>
        <Field label="What did you decide?" value={draft.decision} onChangeText={(t) => setDraft({ ...draft, decision: t })} maxLength={400} multiline
          placeholder="Raise prices to A$90 a session from January" style={{ minHeight: 70, textAlignVertical: 'top' }} />
        <Field label="Why" value={draft.reasoning} onChangeText={(t) => setDraft({ ...draft, reasoning: t })} maxLength={2000} multiline
          placeholder="The reasoning, so future you remembers." style={{ minHeight: 110, textAlignVertical: 'top' }} />
        <Label>When</Label>
        <ChipPicker options={WHEN.map((w) => w.label)} value={WHEN.find((w) => isoDate(addDays(new Date(), w.days)) === draft.decided_at)?.label ?? null}
          onChange={(l) => setDraft({ ...draft, decided_at: isoDate(addDays(new Date(), WHEN.find((w) => w.label === l)!.days)) })} />
        <Field label="Or a date (YYYY-MM-DD)" value={draft.decided_at} onChangeText={(t) => setDraft({ ...draft, decided_at: t })} autoCapitalize="none" maxLength={10} />
        <ErrorText>{error}</ErrorText>
        <Button title="Save" onPress={save} busy={busy} />
        {draft.id ? <Button title={confirmDelete ? 'Tap again to delete' : 'Delete'} kind="danger" onPress={remove} disabled={busy} /> : null}
      </Screen>
    );
  }

  return (
    <Screen skin="crossroads" onRefresh={load}>
      <SkinHeader id="crossroads" title="Decisions" sub="What you decided and why, so you stop relitigating it. Tali reads this too." onBack={() => router.navigate('/me')} backLabel="Back" />
      <Button title="Log a decision" onPress={() => setDraft({ decision: '', reasoning: '', decided_at: today() })} />
      {planHint ? (
        <Card style={{ backgroundColor: colours.purpleSoft, borderColor: colours.purpleSoft }}>
          <Text style={{ color: colours.purpleInk, fontWeight: '700' }}>Ask Tali why is part of Tali HQ</Text>
          <Text style={{ color: colours.purpleInk, fontSize: 13, marginTop: 2 }}>She'll remind you of your reasoning and tell you whether it still holds.</Text>
          <Button title="See plans" kind="ghost" onPress={() => router.navigate('/plans')} />
        </Card>
      ) : null}
      <ErrorText>{error}</ErrorText>
      <View style={{ height: space.md }} />

      {list.length === 0 ? (
        <TaliSays pose="idle">No decisions logged yet. Next time you settle something, put it here with the why. Or tell me in Talk, "I've decided to..." and I'll log it.</TaliSays>
      ) : (
        list.map((d) => (
          // 4 Nov 2026: the whole card opens the editor, not just the small Edit link.
          <Pressable key={d.id} onPress={() => edit(d)} accessibilityRole="button" accessibilityLabel={`Edit decision: ${d.decision}`}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
              <Text style={{ fontSize: 12, color: colours.muted, fontWeight: '700' }}>{friendlyDate(d.decided_at)}{d.source_ref?.startsWith('messages/') ? ' · from Talk' : ''}</Text>
              <Pressable onPress={() => edit(d)} accessibilityRole="button" hitSlop={8}>
                <Text style={{ color: colours.purple, fontWeight: '700', fontSize: 13 }}>Edit</Text>
              </Pressable>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text, marginTop: 4, lineHeight: 22 }}>{d.decision}</Text>
            {d.reasoning ? <Text style={{ fontSize: 14, color: colours.muted, marginTop: 4, lineHeight: 20 }}>{d.reasoning}</Text> : null}
            <Pressable onPress={() => askWhy(d)} accessibilityRole="button" accessibilityState={{ disabled: !paid }}
              style={{ alignSelf: 'flex-start', marginTop: space.md, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1,
                borderColor: paid ? colours.purple : colours.border, backgroundColor: paid ? colours.purpleSoft : colours.sunk, opacity: paid ? 1 : 0.7 }}>
              <Text style={{ color: paid ? colours.purpleInk : colours.faint, fontWeight: '700', fontSize: 13 }}>Ask Tali why{paid ? '' : ' · Tali HQ'}</Text>
            </Pressable>
          </Card>
          </Pressable>
        ))
      )}
      {!paid && list.length ? <Body muted>Logging is free. Ask Tali why is part of Tali HQ.</Body> : null}
    </Screen>
  );
}
