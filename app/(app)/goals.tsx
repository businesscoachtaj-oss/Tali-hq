// Goals Tali holds you to (3 Nov 2026). Tali HQ and Pro (and the trial), no credits. Active goals
// with progress, add and edit, mark done or dropped, update the number, and "Ask Tali about this
// goal" opens Talk with a prefilled message. Tali can also add and update goals from chat.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { myCredits, type Credits } from '@/lib/data';
import { isPaid } from '@/lib/plan';
import { addDays, friendlyDate, isoDate } from '@/lib/dates';
import { behindPace, daysLeft, fmtNum, goalLine, goalProgress, goals as loadGoals, saveGoal, setGoalProgress, setGoalStatus, type Goal } from '@/lib/rhythm';
import { ChipPicker } from '@/components/ChipPicker';
import { BackLink, Body, Button, Card, ErrorText, Field, Label, Loading, Screen, TaliSays, Title } from '@/components/ui';
import { SkinHeader } from '@/components/PageSkin';
import { colours, elevation, radius, space } from '@/constants/theme';

type Draft = { id?: string; title: string; target: string; current: string; unit: string; due_date: string | null; notes: string };
const blank = (): Draft => ({ title: '', target: '', current: '', unit: '', due_date: null, notes: '' });

const DUE_PICKS = [
  { label: 'No date', days: null },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
  { label: '6 months', days: 182 },
  { label: 'End of year', days: -1 },
] as const;
type DuePick = (typeof DUE_PICKS)[number]['label'];

function pickToDate(label: DuePick): string | null {
  const p = DUE_PICKS.find((x) => x.label === label);
  if (!p || p.days === null) return null;
  if (p.days === -1) return `${new Date().getFullYear()}-12-31`;
  return isoDate(addDays(new Date(), p.days));
}

export default function GoalsScreen() {
  const [ready, setReady] = useState(false);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [tab, setTab] = useState<'active' | 'done' | 'dropped'>('active');
  const [list, setList] = useState<Goal[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [duePick, setDuePick] = useState<DuePick>('No date');
  const [progressFor, setProgressFor] = useState<{ id: string; value: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const c = await myCredits().catch(() => null);
      setCredits(c);
      if (isPaid(c)) setList(await loadGoals('all'));
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your goals.');
    } finally {
      setReady(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function startEdit(g?: Goal) {
    setError('');
    if (!g) {
      setDraft(blank());
      setDuePick('No date');
      return;
    }
    setDraft({ id: g.id, title: g.title, target: g.target_number === null ? '' : String(g.target_number), current: String(g.current_number), unit: g.unit ?? '', due_date: g.due_date, notes: g.notes ?? '' });
    setDuePick(g.due_date ? ('Custom' as DuePick) : 'No date');
  }

  async function save() {
    if (!draft) return;
    setError('');
    if (!draft.title.trim()) return setError('Give the goal a name.');
    const target = draft.target.trim() ? Number(draft.target.replace(/[^0-9.]/g, '')) : null;
    const current = draft.current.trim() ? Number(draft.current.replace(/[^0-9.]/g, '')) : 0;
    if (target !== null && !(target > 0)) return setError('The target needs to be a number above zero.');
    if (!(current >= 0)) return setError('Where you are now needs to be a number.');
    setBusy(true);
    try {
      await saveGoal({ id: draft.id, title: draft.title, target_number: target, current_number: current, unit: draft.unit, due_date: draft.due_date, notes: draft.notes });
      setDraft(null);
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save that.');
    } finally {
      setBusy(false);
    }
  }

  async function status(g: Goal, s: Goal['status']) {
    setError('');
    setBusy(true);
    try {
      await setGoalStatus(g.id, s);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Couldn't change that goal.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProgress() {
    if (!progressFor) return;
    setError('');
    const n = Number(progressFor.value.replace(/[^0-9.]/g, ''));
    if (!(n >= 0)) return setError('Needs to be a number.');
    setBusy(true);
    try {
      await setGoalProgress(progressFor.id, n);
      setProgressFor(null);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Couldn't save that number.");
    } finally {
      setBusy(false);
    }
  }

  function askTali(g: Goal) {
    const text = `Can we talk about my goal "${g.title}"? I'm at ${goalLine(g)}${g.due_date ? `, due ${friendlyDate(g.due_date)}` : ''}. What should I do this week to move it?`;
    // 4 Nov 2026: Talk reads `ask` (see person.tsx), not `text`.
    router.push({ pathname: '/talk', params: { ask: text } } as any);
  }

  if (!ready) return <Loading />;

  if (!isPaid(credits)) {
    return (
      <Screen skin="finish" onRefresh={load}>
        <SkinHeader id="finish" title="Goals" sub="The numbers you're chasing, and Tali holding you to them." onBack={() => router.navigate('/')} backLabel="Today" />
        <TaliSays pose="think">Goals are part of Tali HQ. Tell me what you're chasing, I'll track it on Today, mention it in your brief when you're behind pace, and ask about it in your weekly review.</TaliSays>
        <Button title="See plans" onPress={() => router.navigate('/plans')} />
      </Screen>
    );
  }

  const shown = list.filter((g) => g.status === tab);
  const active = list.filter((g) => g.status === 'active');

  if (draft) {
    return (
      <Screen skin="finish" onRefresh={load}>
        <BackLink onPress={() => setDraft(null)} label="Goals" />
        <Title sub="A number and a date make it real. Both are optional.">{draft.id ? 'Edit goal' : 'New goal'}</Title>
        <Field label="Goal" value={draft.title} onChangeText={(v) => setDraft({ ...draft, title: v })} placeholder="5 more regular clients" maxLength={120} autoFocus={!draft.id} />
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Field label="Target" value={draft.target} onChangeText={(v) => setDraft({ ...draft, target: v })} placeholder="5" keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Now" value={draft.current} onChangeText={(v) => setDraft({ ...draft, current: v })} placeholder="0" keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Unit" value={draft.unit} onChangeText={(v) => setDraft({ ...draft, unit: v })} placeholder="clients" maxLength={20} />
          </View>
        </View>
        <Label>Due</Label>
        <ChipPicker
          options={DUE_PICKS.map((p) => p.label)}
          value={duePick === ('Custom' as DuePick) ? null : duePick}
          onChange={(v) => {
            setDuePick(v);
            setDraft({ ...draft, due_date: pickToDate(v) });
          }}
        />
        <Field label="Or a date (YYYY-MM-DD)" value={draft.due_date ?? ''} onChangeText={(v) => { setDraft({ ...draft, due_date: v.trim() || null }); setDuePick('Custom' as DuePick); }} placeholder="2027-02-28" autoCapitalize="none" />
        <Field label="Notes (optional)" value={draft.notes} onChangeText={(v) => setDraft({ ...draft, notes: v })} multiline maxLength={1000} placeholder="Why it matters, how you'll get there" style={{ minHeight: 80, textAlignVertical: 'top' }} />
        <ErrorText>{error}</ErrorText>
        <Button title={draft.id ? 'Save changes' : 'Add goal'} onPress={save} busy={busy} />
        <Button title="Cancel" kind="ghost" onPress={() => setDraft(null)} />
      </Screen>
    );
  }

  return (
    <Screen skin="finish" onRefresh={load}>
      <SkinHeader id="finish" title="Goals" sub="The numbers you're chasing, and Tali holding you to them." onBack={() => router.navigate('/')} backLabel="Today" />

      {active.length === 0 && tab === 'active' ? (
        <TaliSays pose="think">No goals yet. Give me one with a number and a date, like "5 more regular clients by the end of February", and I'll keep it in front of you.</TaliSays>
      ) : (
        <TaliSays pose="idle">{taliLine(active)}</TaliSays>
      )}

      <Button title="Add a goal" onPress={() => startEdit()} />
      <View style={{ height: space.md }} />
      <ChipPicker options={['active', 'done', 'dropped'] as const} value={tab} onChange={setTab} label={(o) => o[0].toUpperCase() + o.slice(1)} />
      <ErrorText>{error}</ErrorText>

      {shown.length === 0 && tab !== 'active' ? (
        <Card>
          <Body muted>Nothing {tab} yet.</Body>
        </Card>
      ) : null}

      {shown.map((g) => {
        const p = goalProgress(g);
        const left = daysLeft(g);
        const behind = g.status === 'active' && behindPace(g);
        const editingProgress = progressFor?.id === g.id;
        return (
          <Card key={g.id}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
              <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: colours.text }}>{g.title}</Text>
              {g.status === 'active' ? (
                <Text style={{ fontSize: 12, fontWeight: '700', color: behind ? colours.orange : colours.good }}>{behind ? 'Behind pace' : 'On track'}</Text>
              ) : (
                <Text style={{ fontSize: 12, fontWeight: '700', color: g.status === 'done' ? colours.good : colours.faint }}>{g.status === 'done' ? 'Done' : 'Dropped'}</Text>
              )}
            </View>
            <Text style={{ fontSize: 14, color: colours.muted, marginTop: 2 }}>
              {goalLine(g)}
              {g.due_date ? `  ·  ${left !== null && left < 0 ? `${-left} days over` : left === 0 ? 'due today' : `${left} days left`}, ${friendlyDate(g.due_date)}` : ''}
            </Text>
            {p !== null ? (
              <View style={{ height: 8, backgroundColor: colours.sunk, borderRadius: 4, marginTop: space.sm, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round(p * 100)}%`, height: 8, backgroundColor: behind ? colours.orange : colours.purple, borderRadius: 4 }} />
              </View>
            ) : null}
            {g.notes ? <Text style={{ fontSize: 13, color: colours.muted, marginTop: space.sm, lineHeight: 19 }}>{g.notes}</Text> : null}

            {g.status === 'active' ? (
              editingProgress ? (
                <View style={{ marginTop: space.md }}>
                  <Field label={`Where are you now${g.unit ? ` (${g.unit})` : ''}?`} value={progressFor.value} onChangeText={(v) => setProgressFor({ id: g.id, value: v })} keyboardType="decimal-pad" autoFocus />
                  <View style={{ flexDirection: 'row', gap: space.sm }}>
                    <Pill label="Save" primary onPress={saveProgress} />
                    <Pill label="Cancel" onPress={() => setProgressFor(null)} />
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md }}>
                  <Pill label="Update number" primary onPress={() => setProgressFor({ id: g.id, value: fmtNum(g.current_number).replace(/,/g, '') })} />
                  <Pill label="Ask Tali" onPress={() => askTali(g)} />
                  <Pill label="Edit" onPress={() => startEdit(g)} />
                  <Pill label="Done" onPress={() => status(g, 'done')} />
                  <Pill label="Drop" onPress={() => status(g, 'dropped')} />
                </View>
              )
            ) : (
              <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
                <Pill label="Make it active again" onPress={() => status(g, 'active')} />
              </View>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}

function taliLine(active: Goal[]) {
  const behind = active.filter(behindPace);
  if (!behind.length) return `${active.length} goal${active.length === 1 ? '' : 's'} on the go and all on pace. Not bad, hey?`;
  if (behind.length === 1) return `"${behind[0].title}" is behind pace. Want to talk about what moves it this week?`;
  return `${behind.length} of your goals are behind pace. Pick one and ask me what moves it this week.`;
}

function Pill({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: primary ? colours.purple : colours.borderStrong,
        backgroundColor: primary ? colours.purple : colours.surface,
        paddingVertical: 7,
        paddingHorizontal: 12,
        ...(primary ? elevation.button(colours.purple) : {}),
      }}>
      <Text style={{ color: primary ? colours.onPurple : colours.text, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}
