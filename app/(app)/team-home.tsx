// app/(app)/team-home.tsx
// ADDED (17 Nov 2026, Taj): Team layout. The owner of a Business account builds one home per
// business for the team and pushes it to every seat. Each block is either "Set by me" (pinned on
// every teammate's home: they can fold it shut but not move or remove it) or "Suggested" (added for
// everyone, each person can take it off). A seat's switches win over the layout: someone with no
// money access never gets Cash flow, pinned or not. The owner never sees a teammate's own blocks.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BackLink, Button, ErrorText, Label, Screen, Title } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { BlockPreview, MiniLayout } from '@/components/Widgets';
import { colours, radius, space } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { myTeam, type TeamMember } from '@/lib/team';
import { useBusinesses } from '@/lib/businesses';
import { BUILTINS, builtinBlock, extraBlock, newId, reloadHq, useHq, widgetTitle, type Block, type BuiltIn, type Extra, type Tracker, type Widget } from '@/lib/widgets';
import { ExtraSheet } from './home-edit';

const BIZ_BLOCKS = (Object.keys(BUILTINS) as BuiltIn[]).filter((k) => BUILTINS[k].plan === 'biz');
const NEEDS: Partial<Record<BuiltIn, 'can_money' | 'can_pipeline' | 'can_customers'>> = { cashflow: 'can_money', leads: 'can_pipeline', bookings: 'can_pipeline', quote_rate: 'can_pipeline', happiness: 'can_customers' };
const NEED_WORD = { can_money: 'money', can_pipeline: 'pipeline', can_customers: 'customers' } as const;
const allowedFor = (b: Block, m: TeamMember) => b.kind !== 'builtin' || !NEEDS[b.builtin!] || m[NEEDS[b.builtin!]!];
const head = (t: string) => <Text style={{ color: colours.faint, fontSize: 12, fontWeight: '800', letterSpacing: 1.6, marginTop: space.lg, marginBottom: space.sm }}>{t}</Text>;

export default function TeamHomeEditor() {
  const hq = useHq();
  const bz = useBusinesses();
  const key = bz.current ?? 'main';
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [pushed, setPushed] = useState<Block[] | null>(null);
  const [pushedAt, setPushedAt] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [gallery, setGallery] = useState(false);
  const [as, setAs] = useState<TeamMember | null>(null);
  const [editing, setEditing] = useState<Widget | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const [l, t] = await Promise.all([
      supabase.from('team_layouts').select('blocks, pushed, pushed_at').eq('business_key', key).maybeSingle(),
      myTeam().catch(() => ({ members: [] as TeamMember[], member_of: [] })),
    ]);
    const row = l.data as any;
    setBlocks(Array.isArray(row?.blocks) ? row.blocks : []);
    setPushed(Array.isArray(row?.pushed) ? row.pushed : null);
    setPushedAt(row?.pushed_at ?? null);
    setMembers(t.members);
    setLoaded(true);
  }, [key]);
  useFocusLoad(load, 1500);
  useEffect(() => { setLoaded(false); setNote(''); }, [key]);

  const teamTrackers = hq.trackers.filter((t) => t.team && !t.sharedIn && !t.archivedAt);
  const widgets: Widget[] = (blocks.map((b) => (b.kind === 'tracker' ? { ...b, tracker: hq.trackers.find((t) => t.id === b.tracker_id) } : b)) as Widget[]).filter((w) => w.kind !== 'tracker' || w.tracker);
  const active = members.filter((m) => m.status === 'active');

  async function save(next: Block[]) {
    setBlocks(next); setErr(''); setNote('');
    const { error } = await supabase.from('team_layouts').upsert({ business_key: key, blocks: next, updated_at: new Date().toISOString() }, { onConflict: 'owner_id,business_key' });
    if (error) setErr('Could not save the team layout. Check your connection and try again.');
  }
  const update = (id: string, patch: Partial<Block>) => save(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const move = (id: string, by: number) => { const i = blocks.findIndex((b) => b.id === id), j = i + by; if (j < 0 || j >= blocks.length) return; const n = blocks.slice(); [n[i], n[j]] = [n[j], n[i]]; save(n); };
  const add = (b: Block) => { save([...blocks, { ...b, pin: 'suggested' }]); setGallery(false); };

  // What changed since the last push, in plain words, for the note each teammate gets and the summary here.
  const was = pushed ?? [];
  const sig = (b: Block) => (b.kind === 'builtin' ? `b:${b.builtin}` : b.kind === 'tracker' ? `t:${b.tracker_id}` : `x:${b.id}`);
  const nameOf = (b: Block) => widgetTitle(b.kind === 'tracker' ? ({ ...b, tracker: hq.trackers.find((t) => t.id === b.tracker_id) } as Widget) : b);
  const added = blocks.filter((b) => !was.some((w) => sig(w) === sig(b)));
  const removed = was.filter((w) => !blocks.some((b) => sig(b) === sig(w)));
  const reordered = !added.length && !removed.length && blocks.map(sig).join() !== was.map(sig).join();
  const repinned = blocks.filter((b) => { const w = was.find((x) => sig(x) === sig(b)); return w && w.pin !== b.pin; });
  const changes = [
    added.length ? `added ${added.map(nameOf).join(', ')}` : '',
    removed.length ? `took off ${removed.map(nameOf).join(', ')}` : '',
    reordered ? `moved ${nameOf(blocks[0])} to the top` : '',
    repinned.length && !added.length && !removed.length && !reordered ? `changed what is pinned` : '',
  ].filter(Boolean).join(', ');
  const dirty = !!changes || !pushed;
  const wontSee = added.flatMap((b) => active.filter((m) => !allowedFor(b, m)).map((m) => `${m.name.split(' ')[0]} won't see ${nameOf(b)}: no ${NEED_WORD[NEEDS[b.builtin!]!]} access.`));

  async function push() {
    setBusy(true); setErr(''); setNote('');
    const { data, error } = await supabase.rpc('team_layout_push', { p_business: key, p_blocks: blocks, p_note: changes || 'your team home is set up' });
    setBusy(false);
    if (error) return setErr(/Business plans/.test(error.message) ? error.message : 'Could not push the team layout. Try again.');
    setPushed(blocks); setPushedAt(new Date().toISOString());
    setNote(`Pushed to ${Number(data) || 0} ${Number(data) === 1 ? 'person' : 'people'}. They each get one note about what changed.`);
    reloadHq();
  }

  if (hq.loaded && hq.plan !== 'biz') {
    return (
      <Screen>
        <BackLink onPress={() => router.navigate('/home-edit?mode=business' as any)} label="Edit home" />
        <Title sub="Set the home your team starts from. Team layouts come with the Business plans.">Team layout</Title>
        <Button title="See plans" onPress={() => router.navigate('/plans')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <BackLink onPress={() => router.navigate('/home-edit?mode=business' as any)} label="Edit home" />
      <Title sub={`The home ${bz.many ? `${bz.here.name}'s team` : 'your team'} starts from. They add their own blocks on top, and you never see those.`}>Team layout</Title>

      {loaded && !members.length ? (
        <Pressable onPress={() => router.navigate('/team')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.card, borderWidth: 1, borderColor: colours.orange, backgroundColor: colours.orangeSoft, marginBottom: space.md }}>
          <Ionicons name="person-add-outline" size={18} color={colours.orange} />
          <Text style={{ flex: 1, color: colours.text, fontSize: 14, lineHeight: 20 }}>Nobody is on your team yet. Add a teammate first, then push this to them.</Text>
          <Text style={{ color: colours.orange, fontWeight: '800' }}>Your team ›</Text>
        </Pressable>
      ) : null}

      <Label>On the team home</Label>
      <ErrorText>{err}</ErrorText>
      <View style={{ gap: 12 }}>
        {widgets.map((w, i) => (
          <View key={w.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View>
              <Pressable onPress={() => move(w.id, -1)} disabled={i === 0} hitSlop={8} accessibilityLabel={`Move ${widgetTitle(w)} up`}><Ionicons name="chevron-up" size={18} color={i === 0 ? 'transparent' : colours.faint} /></Pressable>
              <Pressable onPress={() => move(w.id, 1)} disabled={i === widgets.length - 1} hitSlop={8} accessibilityLabel={`Move ${widgetTitle(w)} down`}><Ionicons name="chevron-down" size={18} color={i === widgets.length - 1 ? 'transparent' : colours.faint} /></Pressable>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <BlockPreview w={w} compact blank={w.kind === 'tracker'} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <Switch value={w.pin === 'pinned'} onValueChange={(v) => update(w.id, { pin: v ? 'pinned' : 'suggested' })} accessibilityLabel={`${widgetTitle(w)}: set by me`} />
                <Text style={{ flex: 1, color: colours.muted, fontSize: 12.5 }}>{w.pin === 'pinned' ? 'Set by me. Pinned on every home.' : 'Suggested. Each person can take it off.'}</Text>
                {w.kind === 'extra' ? <Pressable onPress={() => setEditing(w)} hitSlop={8}><Text style={{ color: colours.purple, fontWeight: '700', fontSize: 13 }}>Edit</Text></Pressable> : null}
              </View>
            </View>
            <Pressable onPress={() => save(blocks.filter((b) => b.id !== w.id))} accessibilityLabel={`Take off ${widgetTitle(w)}`} hitSlop={8}><Ionicons name="remove-circle" size={24} color={colours.danger} /></Pressable>
          </View>
        ))}
        {loaded && !widgets.length ? <Text style={{ color: colours.muted, fontSize: 14, lineHeight: 20 }}>Nothing on the team home yet. Add the blocks everyone should start their day with.</Text> : null}
      </View>

      <View style={{ height: space.lg }} />
      <Button kind="ghost" title="+ Add to the team home" onPress={() => setGallery(true)} />

      {active.length ? (
        <>
          <Label>Preview as</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space.md }}>
            {active.map((m) => (
              <Pressable key={m.id} onPress={() => setAs(m)} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.border }}>
                <Text style={{ color: colours.text, fontWeight: '700' }}>{m.name}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {widgets.length || pushed ? (
        <View style={{ backgroundColor: colours.sunk, borderRadius: radius.card, borderWidth: 1, borderColor: dirty ? '#3B3F9E' : colours.border, padding: 14, marginTop: space.sm }}>
          <Text style={{ color: colours.text, fontWeight: '800', fontSize: 15 }}>{!pushed ? 'Not pushed yet' : dirty ? 'Changes not pushed yet' : 'Your team has this layout'}</Text>
          <Text style={{ color: colours.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
            {dirty && changes ? `${active.length} ${active.length === 1 ? 'person gets' : 'people get'} this: ${changes}.` : !pushed ? `Push it and it lands on ${active.length} ${active.length === 1 ? "person's" : "people's"} home.` : `Pushed ${new Date(pushedAt ?? Date.now()).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}.`}
            {wontSee.length ? ` ${wontSee.join(' ')}` : ''}
          </Text>
          {note ? <Text style={{ color: colours.good, fontWeight: '700', marginTop: 8 }}>{note}</Text> : null}
          <View style={{ height: 10 }} />
          <Button title="Push to team" onPress={push} busy={busy} disabled={!dirty || !active.length} />
        </View>
      ) : null}
      <Text style={{ color: colours.faint, fontSize: 12.5, marginTop: space.md, lineHeight: 18 }}>Their own blocks stay where they were. You never see a teammate's own blocks, trackers, Life side, journal or what they tell Tali. Anything Tali writes for a teammate comes from their own seat's credits.</Text>
      <View style={{ height: space.xl }} />

      <Sheet visible={gallery} title="Add to the team home" sub="Business blocks, team trackers, a checklist, a note or a countdown." onClose={() => setGallery(false)}>
        {head('BUSINESS BLOCKS')}
        <View style={{ gap: 8 }}>
          {BIZ_BLOCKS.filter((k) => !blocks.some((b) => b.builtin === k)).map((k) => (
            <Pressable key={k} onPress={() => add(builtinBlock(k, 'wide'))} accessibilityLabel={`Add ${BUILTINS[k].title}`}>
              <BlockPreview w={{ id: k, kind: 'builtin', builtin: k, size: 'wide' }} compact />
              {NEEDS[k] ? <Text style={{ color: colours.faint, fontSize: 11.5, marginTop: 3 }}>Only people with {NEED_WORD[NEEDS[k]!]} access see it.</Text> : null}
            </Pressable>
          ))}
        </View>
        {head('TEAM TRACKERS')}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {teamTrackers.filter((t) => !blocks.some((b) => b.tracker_id === t.id)).map((t: Tracker) => (
            <Pressable key={t.id} onPress={() => add({ id: newId(), kind: 'tracker', tracker_id: t.id, size: 'small' })} style={{ width: '48.5%' }}>
              <BlockPreview w={{ id: t.id, kind: 'tracker', tracker: t, size: 'small' }} blank />
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => { setGallery(false); router.navigate('/widget-new?mode=business&type=count' as any); }} style={{ marginTop: 10 }}>
          <Text style={{ color: colours.purple, fontWeight: '800' }}>+ Make a team tracker</Text>
          <Text style={{ color: colours.faint, fontSize: 12, marginTop: 2 }}>Switch on "Team tracker" when you make it. Everyone logs to it and it counts as one tracker.</Text>
        </Pressable>
        {head('CHECKLIST, NOTE AND COUNTDOWN')}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {([['Checklist', { type: 'checklist', title: 'Team checklist', items: [] }], ['Note', { type: 'note', text: '' }], ['Countdown', { type: 'countdown', title: 'Team deadline', date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) }]] as [string, Extra][]).map(([label, extra]) => (
            <Pressable key={label} onPress={() => add(extraBlock(extra, 'wide'))} style={{ flex: 1, padding: 12, borderRadius: 14, backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.border }}>
              <Text style={{ color: colours.text, fontWeight: '800' }}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ height: space.md }} />
      </Sheet>

      <Sheet visible={!!as} title={as ? `As ${as.name} sees it` : ''} sub="Blocks their seat is not allowed to see are left out." onClose={() => setAs(null)}>
        {as ? (
          <>
            <View style={{ borderRadius: 20, padding: 12, backgroundColor: 'rgba(30,24,88,0.6)', borderWidth: 1, borderColor: colours.border }}>
              <MiniLayout widgets={widgets.filter((w) => allowedFor(w, as))} blank />
            </View>
            {widgets.filter((w) => !allowedFor(w, as)).map((w) => (
              <Text key={w.id} style={{ color: colours.orange, fontSize: 13, marginTop: 8 }}>{as.name.split(' ')[0]} won't see {widgetTitle(w)}: no {NEED_WORD[NEEDS[w.builtin!]!]} access. Change it in Your team.</Text>
            ))}
          </>
        ) : null}
        <View style={{ height: space.md }} />
      </Sheet>

      <ExtraSheet w={editing} onClose={() => setEditing(null)} onSave={(extra) => { if (editing) update(editing.id, { extra }); setEditing(null); }} />
    </Screen>
  );
}
