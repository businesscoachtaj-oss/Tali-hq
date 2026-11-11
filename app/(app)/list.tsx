// 11 Nov 2026 (Taj: Your world felt "bare and empty"): one screen for the lists that fill it in.
// /list?kind=todo | checkup | admin | home | habit | learning | win | someday | idea
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { addDays, friendlyDate, isoDate, today } from '@/lib/dates';
import { LISTS, deleteLifeItem, habitTicks, lifeItems, parseDue, saveLifeItem, setHabitDay, streak, tickLifeItem, type LifeItem, type ListKind } from '@/lib/world';
import { ChipPicker } from '@/components/ChipPicker';
import { BackLink, Body, Button, Card, ErrorText, Field, Label, Screen, TaliSays, Title, useConfirm } from '@/components/ui';
import { colours, radius, space } from '@/constants/theme';
// MOCK (12 Nov 2026): one list, every item tagged Life or Business. It opens on the mode you are in.
import { ScopeChips, TagPill } from '@/components/ModeSwitch';
import { MODE, tagOf, useMode, type Mode } from '@/lib/mode';
import { useHasBusiness } from '@/lib/business';
const TAGGED: string[] = ['todo', 'idea', 'learning', 'win', 'someday'];

const DUE_PICKS = [{ label: 'No date', days: null }, { label: 'Today', days: 0 }, { label: 'Tomorrow', days: 1 }, { label: 'Next week', days: 7 }, { label: 'In a month', days: 30 }] as const;
const REPEATS = [{ label: 'Once', months: null }, { label: 'Monthly', months: 1 }, { label: 'Every 3 months', months: 3 }, { label: 'Every 6 months', months: 6 }, { label: 'Yearly', months: 12 }, { label: 'Every 2 years', months: 24 }] as const;
const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type Draft = { id?: string; title: string; note: string; due_date: string | null; dueText: string; repeat_months: number | null; tag?: Mode };
const blank = (): Draft => ({ title: '', note: '', due_date: null, dueText: '', repeat_months: null });

export default function List() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const raw = Array.isArray(params.kind) ? params.kind[0] : params.kind;
  const kind = (raw && raw in LISTS ? raw : 'todo') as ListKind;
  const cfg = LISTS[kind];
  const [items, setItems] = useState<LifeItem[]>([]);
  const [ticks, setTicks] = useState<Record<string, string[]>>({});
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirm = useConfirm();
  const mode = useMode();
  const tagged = useHasBusiness() && TAGGED.includes(kind);
  const [scope, setScope] = useState<'mode' | 'all'>('mode');

  const load = useCallback(async () => {
    setError('');
    try {
      const [list, t] = await Promise.all([lifeItems(kind), kind === 'habit' ? habitTicks() : Promise.resolve({})]);
      setItems(list);
      setTicks(t);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load this.');
    }
    setLoaded(true);
  }, [kind]);
  // A different list is a different screen: start clean so the last one never flashes up.
  useFocusEffect(useCallback(() => { setItems([]); setLoaded(false); setDraft(null); setShowDone(false); load(); }, [load]));

  const back = () => router.navigate('/world');

  async function save() {
    if (!draft) return;
    setError('');
    if (!draft.title.trim()) return setError('Give it a name.');
    let due = draft.due_date;
    if (cfg.due && draft.dueText.trim()) {
      due = parseDue(draft.dueText);
      if (!due) return setError('I could not read that date. Try 29 Nov or 29/11.');
    }
    setBusy(true);
    try {
      await saveLifeItem({ id: draft.id, kind, title: draft.title, note: draft.note, due_date: cfg.due ? due : null, repeat_months: cfg.repeat ? draft.repeat_months : null });
      setDraft(null);
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save.');
    }
    setBusy(false);
  }

  async function act(fn: () => Promise<void>) {
    setError('');
    try {
      await fn();
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'That did not save.');
    }
  }

  if (draft) {
    const pick = DUE_PICKS.find((p) => (p.days === null ? !draft.due_date && !draft.dueText : draft.due_date === isoDate(addDays(new Date(), p.days)) && !draft.dueText))?.label ?? null;
    return (
      <Screen skin={cfg.skin}>
        <BackLink onPress={() => { setDraft(null); setError(''); }} label={cfg.title} />
        <Title>{draft.id ? 'Edit' : cfg.add}</Title>
        <Field label={kind === 'win' ? 'What went right' : 'What is it'} value={draft.title} onChangeText={(v) => setDraft({ ...draft, title: v })} placeholder={cfg.placeholder} maxLength={200} autoFocus={!draft.id} />
        {cfg.due ? (
          <>
            <Label>{kind === 'todo' || kind === 'home' ? 'By when' : 'Due'}</Label>
            <ChipPicker options={DUE_PICKS.map((p) => p.label)} value={pick}
              onChange={(l) => { const p = DUE_PICKS.find((x) => x.label === l)!; setDraft({ ...draft, due_date: p.days === null ? null : isoDate(addDays(new Date(), p.days)), dueText: '' }); }} />
            <Field label="Or a date" value={draft.dueText} onChangeText={(v) => setDraft({ ...draft, dueText: v })} placeholder="29 Nov" autoCapitalize="none" />
            {draft.due_date && !draft.dueText ? <Text style={{ color: colours.muted, fontSize: 13, marginTop: -6, marginBottom: space.md }}>Due {friendlyDate(draft.due_date)}</Text> : null}
          </>
        ) : null}
        {tagged ? (
          <>
            <Label>Belongs to</Label>
            <ChipPicker options={[MODE.life.label, MODE.business.label]} value={MODE[draft.tag ?? mode].label}
              onChange={(l) => setDraft({ ...draft, tag: l === MODE.life.label ? 'life' : 'business' })} />
            <Text style={{ color: colours.muted, fontSize: 13, marginTop: -6, marginBottom: space.md }}>When you tell Tali, she picks this for you. You can change it any time.</Text>
          </>
        ) : null}
        {cfg.repeat ? (
          <>
            <Label>Comes round</Label>
            <ChipPicker options={REPEATS.map((r) => r.label)} value={REPEATS.find((r) => r.months === draft.repeat_months)?.label ?? 'Once'}
              onChange={(l) => setDraft({ ...draft, repeat_months: REPEATS.find((r) => r.label === l)!.months })} />
          </>
        ) : null}
        <Field label="Notes (optional)" value={draft.note} onChangeText={(v) => setDraft({ ...draft, note: v })} multiline maxLength={2000}
          placeholder={kind === 'home' ? 'Who to call, what it cost last time' : kind === 'admin' ? 'Policy number, who it is with' : 'Anything worth keeping with it'} style={{ minHeight: 90, textAlignVertical: 'top' }} />
        <ErrorText>{error}</ErrorText>
        <Button title="Save" onPress={save} busy={busy} />
        {draft.id ? (
          <Button title={confirm.armed === draft.id ? 'Tap again to delete' : 'Delete'} kind="danger" disabled={busy}
            onPress={() => { const id = draft.id!; confirm.confirm(id, () => act(async () => { await deleteLifeItem(id); setDraft(null); })); }} />
        ) : null}
      </Screen>
    );
  }

  const allOpen = items.filter((i) => !i.done_at);
  const inMode = (i: LifeItem) => !tagged || scope === 'all' || tagOf(i, 'life') === mode;
  const open = allOpen.filter(inMode).sort((a, b) => {
    if (!cfg.due) return 0;
    const fa = a.due_date ?? '9999', fb = b.due_date ?? '9999';
    return fa.localeCompare(fb);
  });
  const done = items.filter((i) => i.done_at).filter(inMode);
  const t = today();
  const week = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i - 6));
  const edit = (i: LifeItem) => setDraft({ id: i.id, title: i.title, note: i.note, due_date: i.due_date, dueText: '', repeat_months: i.repeat_months, tag: tagOf(i, 'life') });

  return (
    <Screen skin={cfg.skin} onRefresh={load}>
      <View style={{ marginBottom: 20, marginTop: 6 }}>
        <Pressable onPress={back} hitSlop={12} accessibilityRole="button" style={{ marginBottom: 18 }}>
          <Text style={{ color: '#B9A6FF', fontSize: 15, fontWeight: '600' }}>{'‹'} Your world</Text>
        </Pressable>
        <Text style={{ color: '#B9A6FF', fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>{(tagged ? (scope === 'all' ? 'Life and business' : MODE[mode].label) : cfg.back).toUpperCase()}</Text>
        <Text style={{ color: '#F4F1FF', fontSize: 46, lineHeight: 50, marginTop: 6, fontFamily: 'InstrumentSerif_400Regular' }}>{cfg.title}</Text>
        <Text style={{ color: '#B9B2D9', fontSize: 15, lineHeight: 22, marginTop: 8 }}>{cfg.sub}</Text>
      </View>
      <Button title={cfg.add} onPress={() => setDraft(blank())} />
      <Button title="Tell Tali" kind="ghost" onPress={() => router.navigate({ pathname: '/talk', params: { ask: cfg.ask } })} />
      {kind === 'learning' ? <Button title="Tali's library" kind="ghost" onPress={() => router.navigate('/library')} /> : null}
      <ErrorText>{error}</ErrorText>
      <View style={{ height: space.md }} />
      {tagged && loaded && items.length ? <ScopeChips value={scope} onChange={setScope} counts={{ mode: allOpen.filter((i) => tagOf(i, 'life') === mode).length, all: allOpen.length }} /> : null}
      {loaded && items.length === 0 ? (
        <>
          <TaliSays pose="idle">{cfg.empty}</TaliSays>
          <Card><Body muted>You can just tell me in Talk. {cfg.example}</Body></Card>
        </>
      ) : null}
      {open.map((i) => {
        const days = ticks[i.id] ?? [];
        const overdue = !!i.due_date && i.due_date < t;
        const dueNow = !!i.due_date && i.due_date <= t;
        if (kind === 'habit') {
          const n = streak(days);
          const doneToday = days.includes(t);
          return (
            <Card key={i.id}>
              <Pressable accessibilityRole="button" onPress={() => edit(i)}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text }}>{i.title}</Text>
                <Text style={{ fontSize: 13, color: n ? colours.orange : colours.muted, marginTop: 3, fontWeight: n ? '700' : '400' }}>
                  {n ? `${n} ${n === 1 ? 'day' : 'days'} in a row` : doneToday ? 'Done today' : 'Not started yet'}
                </Text>
              </Pressable>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md }}>
                {week.map((d) => {
                  const iso = isoDate(d), on = days.includes(iso), isToday = iso === t;
                  return (
                    <Pressable key={iso} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${i.title}, ${friendlyDate(iso)}`}
                      onPress={() => act(() => setHabitDay(i.id, iso, !on))} hitSlop={4} style={{ alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: isToday ? colours.text : colours.faint }}>{DAY_LETTER[d.getDay()]}</Text>
                      <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colours.purple : 'transparent', borderWidth: isToday ? 2 : 1, borderColor: on ? colours.purple : isToday ? colours.purpleInk : colours.borderStrong }}>
                        {on ? <Ionicons name="checkmark" size={18} color={colours.onPurple} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          );
        }
        return (
          <Card key={i.id} style={dueNow ? { borderLeftWidth: 5, borderLeftColor: colours.orange } : undefined}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
              {cfg.tick ? (
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: false }} accessibilityLabel={`${cfg.tick}: ${i.title}`} hitSlop={10} onPress={() => act(() => tickLifeItem(i))}
                  style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colours.purpleInk, marginTop: 1 }} />
              ) : null}
              <Pressable accessibilityRole="button" onPress={() => edit(i)} style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text }}>{i.title}</Text>
                {i.due_date ? (
                  <Text style={{ fontSize: 13, color: dueNow ? colours.orange : colours.muted, marginTop: 3, fontWeight: dueNow ? '700' : '400' }}>
                    {overdue ? 'Was due' : 'Due'} {friendlyDate(i.due_date)}{i.repeat_months ? `, ${REPEATS.find((r) => r.months === i.repeat_months)?.label.toLowerCase() ?? `every ${i.repeat_months} months`}` : ''}
                  </Text>
                ) : kind === 'win' ? (
                  <Text style={{ fontSize: 13, color: colours.muted, marginTop: 3 }}>{friendlyDate(i.local_date ?? i.created_at)}</Text>
                ) : null}
                {i.note ? <Text numberOfLines={3} style={{ fontSize: 14, color: colours.muted, marginTop: 4, lineHeight: 20 }}>{i.note}</Text> : null}
                {tagged || i.created_by === 'tali' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7 }}>
                    {tagged ? <TagPill tag={tagOf(i, 'life')} /> : null}
                    {i.created_by === 'tali' ? <Text style={{ fontSize: 11, fontWeight: '700', color: colours.purpleInk }}>Added by Tali</Text> : null}
                  </View>
                ) : null}
              </Pressable>
            </View>
          </Card>
        );
      })}
      {done.length ? (
        <>
          <Pressable accessibilityRole="button" onPress={() => setShowDone((v) => !v)} style={{ paddingVertical: space.md }}>
            <Text style={{ color: colours.purpleInk, fontWeight: '700' }}>{showDone ? 'Hide' : 'Show'} {cfg.tick ? cfg.tick.toLowerCase() : 'done'} ({done.length})</Text>
          </Pressable>
          {showDone ? done.map((i) => (
            <Card key={i.id} style={{ opacity: 0.7 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: true }} accessibilityLabel={`Put back: ${i.title}`} hitSlop={10} onPress={() => act(() => tickLifeItem(i))}
                  style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colours.purple, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="checkmark" size={16} color={colours.onPurple} />
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => edit(i)} style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, color: colours.muted, textDecorationLine: 'line-through' }}>{i.title}</Text>
                </Pressable>
              </View>
            </Card>
          )) : null}
        </>
      ) : null}
      <View style={{ height: radius.card }} />
    </Screen>
  );
}
