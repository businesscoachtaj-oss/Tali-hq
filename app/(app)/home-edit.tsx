// app/(app)/home-edit.tsx
// ADDED (16 Nov 2026, Taj): "Edit home". Every block on Today in one list: move it, make it small
// or wide, hide it or take it off. Add a widget from the gallery, make your own tracker, ask Tali to
// build one, start from a template, or share the layout. Each home (Business, Life, and each extra
// business) has its own layout.
// BUILT FOR REAL (17 Nov 2026): saves to home_layouts as you go, drag the handle to move a block,
// 12 templates with a preview, and on Free the blocks past 6 sit under "Didn't fit on Free".
import { useEffect, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BackLink, Button, ErrorText, Screen, Title } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { BlockPreview, DotRing, MiniLayout } from '@/components/Widgets';
import { colours, radius, space } from '@/constants/theme';
import { BUILTINS, LIMITS, TRACKER_PRESETS, blockAllowed, builtinBlock, draftTracker, extraBlock, fitPlan, goalLine, homeKeyFor, materialise, presetSpec, saveLayout, sideOfHome, useHome, useHq, widgetTitle, type Block, type BuiltIn, type Extra, type Plan, type Tracker, type Widget } from '@/lib/widgets';
import { TEMPLATES, forPlan, mergeBlocks, templateBlocks, type Template } from '@/lib/hqTemplates';
import { MODE, setMode, useMode, type Mode } from '@/lib/mode';
import { useHasBusiness } from '@/lib/business';
import { useBusinesses } from '@/lib/businesses';

function Pill({ label, on, onPress, icon }: { label: string; on?: boolean; onPress?: () => void; icon?: any }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={6}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? colours.purple : colours.border, backgroundColor: on ? colours.purpleSoft : 'transparent' }}>
      {icon ? <Ionicons name={icon} size={13} color={on ? colours.purpleInk : colours.muted} /> : null}
      <Text style={{ color: on ? colours.purpleInk : colours.muted, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
const head = (t: string) => <Text style={{ color: colours.faint, fontSize: 12, fontWeight: '800', letterSpacing: 1.6, marginTop: space.lg, marginBottom: space.sm }}>{t}</Text>;
const input = { backgroundColor: colours.sunk, borderWidth: 1, borderColor: colours.border, borderRadius: radius.input, color: colours.text, fontSize: 16, paddingHorizontal: 14, paddingVertical: 11 } as const;

/** The drag handle. Drag up or down and the block swaps places with its neighbours as it passes them. */
function Handle({ onStart, onMove, onEnd, label }: { onStart: () => void; onMove: (dy: number) => void; onEnd: () => void; label: string }) {
  const cb = useRef({ onStart, onMove, onEnd });
  cb.current = { onStart, onMove, onEnd };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => cb.current.onStart(),
    onPanResponderMove: (_, g) => cb.current.onMove(g.dy),
    onPanResponderRelease: () => cb.current.onEnd(),
    onPanResponderTerminate: () => cb.current.onEnd(),
  })).current;
  return (
    <View {...pan.panHandlers} accessibilityLabel={label} style={[{ paddingVertical: 14, paddingHorizontal: 2 }, Platform.OS === 'web' ? ({ cursor: 'grab', touchAction: 'none', userSelect: 'none' } as any) : null]}>
      <Ionicons name="reorder-three" size={24} color={colours.faint} />
    </View>
  );
}

export default function HomeEdit() {
  const q = useLocalSearchParams<{ mode?: string; gallery?: string; template?: string }>();
  const current = useMode();
  const hasBiz = useHasBusiness();
  const bz = useBusinesses();
  const mode: Mode = !hasBiz ? 'life' : (q.mode === 'business' || q.mode === 'life') ? q.mode : current;
  const homeKey = homeKeyFor(mode, hasBiz, bz.current);
  const hq = useHq();
  const home = useHome(homeKey, hasBiz);
  const plan = home.plan;
  const free = plan === 'free';
  const [gallery, setGallery] = useState(q.gallery === '1');
  const [tpl, setTpl] = useState<Template | null>(null);
  const [editing, setEditing] = useState<Widget | null>(null);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (q.template) { const t = TEMPLATES.find((x) => x.key === q.template); if (t) setTpl(t); } }, [q.template]);

  const list = home.widgets;                       // every block, in order
  const onHome = list.filter((w) => !w.parked);
  const parked = list.filter((w) => w.parked);
  const shown = onHome.filter((w) => !w.hidden).length;
  const own = onHome.filter((w) => w.kind === 'tracker' && !w.hidden).length;
  const full = free && shown >= LIMITS.free.blocks;
  // Trackers that exist but are not on this home, so nothing made is ever lost.
  const side = sideOfHome(homeKey);
  const spare = hq.trackers.filter((t) => !t.archivedAt && !t.sharedIn && (t.home === side || t.home === 'both' || !hasBiz) && !list.some((w) => w.tracker_id === t.id));

  const strip = (ws: (Widget | Block)[]): Block[] => ws.map(({ tracker: _t, ...b }: any) => b);
  async function commit(next: (Widget | Block)[]) {
    setErr('');
    try { await saveLayout(homeKey, strip(next)); setSaved(true); } catch (e: any) { setErr(e?.message ?? 'Could not save.'); }
  }
  const update = (id: string, patch: Partial<Block>) => commit(list.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  const remove = (id: string) => commit(list.filter((w) => w.id !== id));
  const move = (id: string, by: number) => {
    const i = list.findIndex((w) => w.id === id), j = i + by;
    if (i < 0 || j < 0 || j >= list.length) return;
    const next = list.slice(); [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };
  async function add(b: Block) {
    setErr('');
    try {
      const made = await materialise(homeKey, [b]);
      if (!made.length) throw new Error(`Free has ${LIMITS.free.trackers} trackers on a home. Archive one, or go paid for no limit.`);
      // New blocks go on top, so they are seen straight away.
      await saveLayout(homeKey, [...made, ...strip(list)]);
      setGallery(false); setSaved(true);
    } catch (e: any) { setErr(e?.message ?? 'Could not add that.'); setGallery(false); }
  }

  // Drag to move: the block follows the finger and swaps with a neighbour once it is 60% past it.
  const heights = useRef<Record<string, number>>({});
  const [drag, setDrag] = useState<{ id: string; dy: number } | null>(null);
  const order = useRef<Widget[]>(list); const base = useRef(0); const moved = useRef(false);
  if (!drag) order.current = list;
  const [live, setLive] = useState<Widget[] | null>(null);
  const rows = live ?? onHome;
  const startDrag = (id: string) => { base.current = 0; moved.current = false; order.current = onHome.slice(); setLive(onHome.slice()); setDrag({ id, dy: 0 }); };
  const onDrag = (id: string, gdy: number) => {
    const cur = order.current; const i = cur.findIndex((w) => w.id === id);
    let dy = gdy - base.current;
    const nxt = cur[i + 1], prv = cur[i - 1];
    if (nxt && dy > (heights.current[nxt.id] ?? 80) * 0.6) { const h = (heights.current[nxt.id] ?? 80) + 10; [cur[i], cur[i + 1]] = [cur[i + 1], cur[i]]; base.current += h; dy -= h; moved.current = true; setLive(cur.slice()); }
    else if (prv && dy < -(heights.current[prv.id] ?? 80) * 0.6) { const h = (heights.current[prv.id] ?? 80) + 10; [cur[i], cur[i - 1]] = [cur[i - 1], cur[i]]; base.current -= h; dy += h; moved.current = true; setLive(cur.slice()); }
    setDrag({ id, dy });
  };
  const endDrag = () => { const next = order.current.slice(); setDrag(null); setLive(null); if (moved.current) commit([...next, ...parked]); };

  const row = (w: Widget, i: number, n: number) => {
    const dragging = drag?.id === w.id;
    const pinned = false;
    return (
      <View key={w.id} onLayout={(e) => { heights.current[w.id] = e.nativeEvent.layout.height; }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: w.hidden ? 0.45 : 1, transform: [{ translateY: dragging ? drag!.dy : 0 }], zIndex: dragging ? 5 : 0 }}>
        <View style={{ alignItems: 'center' }}>
          <Pressable onPress={() => move(w.id, -1)} disabled={i === 0} hitSlop={6} accessibilityLabel={`Move ${widgetTitle(w)} up`}><Ionicons name="chevron-up" size={15} color={i === 0 ? 'transparent' : colours.faint} /></Pressable>
          <Handle label={`Drag to move ${widgetTitle(w)}`} onStart={() => startDrag(w.id)} onMove={(dy) => onDrag(w.id, dy)} onEnd={endDrag} />
          <Pressable onPress={() => move(w.id, 1)} disabled={i === n - 1} hitSlop={6} accessibilityLabel={`Move ${widgetTitle(w)} down`}><Ionicons name="chevron-down" size={15} color={i === n - 1 ? 'transparent' : colours.faint} /></Pressable>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={dragging ? { shadowColor: colours.purple, shadowOpacity: 0.8, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } } : null}>
            <BlockPreview w={w} compact />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {w.kind === 'tracker' || (w.kind === 'extra' && w.extra?.type !== 'checklist') ? (<>
              <Pill label="Small" on={w.size === 'small'} onPress={() => update(w.id, { size: 'small' })} />
              <Pill label="Wide" on={w.size === 'wide'} onPress={() => update(w.id, { size: 'wide' })} />
            </>) : null}
            {w.kind === 'tracker' ? <Pill label="Edit" icon="create-outline" onPress={() => router.navigate(`/widget-new?edit=${w.tracker_id}&mode=${mode}` as any)} /> : null}
            {w.kind === 'extra' ? <Pill label="Edit" icon="create-outline" onPress={() => setEditing(w)} /> : null}
            <Pill label={w.hidden ? 'Hidden' : 'Showing'} icon={w.hidden ? 'eye-off-outline' : 'eye-outline'} on={!w.hidden} onPress={() => update(w.id, { hidden: !w.hidden })} />
          </View>
        </View>
        {pinned ? null : (
          <Pressable onPress={() => remove(w.id)} accessibilityLabel={`Take off ${widgetTitle(w)}`} hitSlop={8}>
            <Ionicons name="remove-circle" size={24} color={colours.danger} />
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <Screen>
      <BackLink onPress={() => router.navigate('/')} label="Today" />
      <Title sub="Move, resize, hide or take off anything. This is your HQ.">Edit home</Title>

      {hasBiz ? (
        <View style={{ flexDirection: 'row', backgroundColor: 'rgba(12,10,36,0.78)', borderRadius: radius.pill, padding: 4, borderWidth: 1, borderColor: colours.border, marginBottom: space.md }}>
          {(['business', 'life'] as const).map((m) => {
            const on = mode === m;
            return (
              <Pressable key={m} onPress={() => { setMode(m); router.setParams({ mode: m }); }} style={{ flex: 1, paddingVertical: 9, borderRadius: radius.pill, alignItems: 'center', backgroundColor: on ? MODE[m].colour : 'transparent' }}>
                <Text numberOfLines={1} style={{ fontWeight: '800', color: on ? '#141033' : colours.muted }}>{m === 'business' && bz.many ? bz.here.name : `${MODE[m].label} home`}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {free ? (
        <View style={{ backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: full ? colours.orange : colours.border, padding: 14, marginBottom: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <DotRing pct={shown / LIMITS.free.blocks} colour={full ? colours.orange : colours.purple} size={44} n={18} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colours.text, fontWeight: '800', fontSize: 15 }}>{shown} of {LIMITS.free.blocks} blocks on Free</Text>
              <Text style={{ color: colours.muted, fontSize: 12.5, marginTop: 2 }}>{own} of {LIMITS.free.trackers} of your own trackers. Paid plans have no limit, plus rings, streaks, charts and Tali check-ins.</Text>
            </View>
          </View>
          <Pressable onPress={() => router.navigate('/plans')} style={{ marginTop: 10, alignSelf: 'flex-start' }}><Text style={{ color: colours.orange, fontWeight: '800' }}>See plans ›</Text></Pressable>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm }}>
        <Text style={{ flex: 1, color: colours.faint, fontSize: 12, fontWeight: '800', letterSpacing: 1.6 }}>ON YOUR {hasBiz ? MODE[mode].label.toUpperCase() + ' ' : ''}HOME  ·  DRAG TO MOVE</Text>
        {saved && !err ? <Text style={{ color: colours.good, fontSize: 12, fontWeight: '700' }}>Saved</Text> : null}
      </View>
      <ErrorText>{err}</ErrorText>
      <View style={{ gap: 10 }}>
        {rows.map((w, i) => row(w, i, rows.length))}
        {!rows.length ? <Text style={{ color: colours.muted, fontSize: 14 }}>Nothing on this home yet. Add your first widget below.</Text> : null}
      </View>

      {parked.length ? (
        <>
          {head(free ? "DIDN'T FIT ON FREE" : 'NOT ON YOUR PLAN')}
          <Text style={{ color: colours.muted, fontSize: 13, marginBottom: space.sm, lineHeight: 19 }}>
            {free ? `Free fits ${LIMITS.free.blocks} blocks and ${LIMITS.free.trackers} trackers on a home. These are kept, with their history, and come back when there is room.` : 'These come with the Business plans. They are kept here in case you go back.'}{' '}
            <Text onPress={() => router.navigate('/plans')} style={{ color: colours.orange, fontWeight: '800' }}>Upgrade for no limit ›</Text>
          </Text>
          <View style={{ gap: 10 }}>
            {parked.map((w) => (
              <View key={w.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: 0.6 }}>
                <Ionicons name="lock-closed" size={16} color={colours.orange} />
                <View style={{ flex: 1 }}><BlockPreview w={w} compact /></View>
                <Pressable onPress={() => remove(w.id)} accessibilityLabel={`Take off ${widgetTitle(w)}`} hitSlop={8}><Ionicons name="remove-circle" size={24} color={colours.danger} /></Pressable>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {spare.length ? (
        <>
          {head('YOUR TRACKERS NOT ON THIS HOME')}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {spare.map((t) => (
              <Pressable key={t.id} onPress={() => add({ id: `t${t.id.slice(0, 8)}${Date.now().toString(36)}`, kind: 'tracker', tracker_id: t.id, size: 'small' })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.border }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.colour }} />
                <Text style={{ color: colours.text, fontWeight: '700', fontSize: 13 }}>{t.name}</Text>
                <Ionicons name="add" size={14} color={colours.purple} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <View style={{ height: space.lg }} />
      <Button title="+ Add a widget" onPress={() => setGallery(true)} />
      <View style={{ height: space.sm }} />
      <Pressable onPress={() => router.navigate({ pathname: '/talk', params: { ask: `Add a tracker to my ${hasBiz ? MODE[mode].label.toLowerCase() + ' ' : ''}home: ` } } as any)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, backgroundColor: colours.sunk }}>
        <Ionicons name="sparkles" size={18} color={colours.purple} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colours.text, fontWeight: '800' }}>Ask Tali to build it</Text>
          <Text style={{ color: colours.muted, fontSize: 12.5 }}>"Track my cold calls, 20 a week" and she puts it on your home. {free ? 'Counts as one of your messages.' : 'Same as a chat message.'}</Text>
        </View>
        <Text style={{ color: colours.faint, fontSize: 20 }}>›</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: space.md }}>
        <View style={{ flex: 1 }}><Button kind="ghost" title={free ? 'Share (paid plans)' : 'Share my layout'} onPress={() => router.navigate((free ? '/plans' : `/home-share?mode=${mode}`) as any)} /></View>
        <View style={{ flex: 1 }}><Button kind="ghost" title="Start from a template" onPress={() => setGallery(true)} /></View>
      </View>
      {plan === 'biz' && mode === 'business' && hasBiz ? (
        <Pressable onPress={() => router.navigate('/team-home' as any)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.card, borderWidth: 1, borderColor: 'rgba(127,168,255,0.5)', backgroundColor: 'rgba(127,168,255,0.12)', marginTop: space.md }}>
          <Ionicons name="people" size={18} color="#7FA8FF" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colours.text, fontWeight: '800' }}>Team layout</Text>
            <Text style={{ color: colours.muted, fontSize: 12.5 }}>Set the home your team starts from, and push it to every seat.</Text>
          </View>
          <Text style={{ color: colours.faint, fontSize: 20 }}>›</Text>
        </Pressable>
      ) : null}
      <View style={{ height: space.xl }} />

      <Sheet visible={gallery} title="Add a widget" sub={full ? `Your Free home is full (${LIMITS.free.blocks} blocks). New ones go under "Didn't fit on Free" until you take one off, or go paid for no limit.` : hasBiz ? `Adding to your ${MODE[mode].label} home` : 'Adding to your home'} onClose={() => setGallery(false)}>
        <Gallery plan={plan} mode={mode} single={!hasBiz} have={list} onAdd={add} onTemplate={(t) => { setGallery(false); setTpl(t); }} />
      </Sheet>

      <TemplateSheet tpl={tpl} plan={plan} mode={mode} hasBiz={hasBiz} current={list} trackers={hq.trackers} homeKey={homeKey} onClose={() => setTpl(null)} onDone={() => { setTpl(null); setSaved(true); }} />
      <ExtraSheet w={editing} onClose={() => setEditing(null)} onSave={(extra) => { if (editing) update(editing.id, { extra }); setEditing(null); }} />
    </Screen>
  );
}

const TYPES: { type: string; label: string; icon: any; eg: string }[] = [
  { type: 'count', label: 'Count', icon: 'add-circle-outline', eg: 'Water, calls, pages' },
  { type: 'yesno', label: 'Yes or no', icon: 'checkmark-circle-outline', eg: 'Read, meditate' },
  { type: 'money', label: 'Money', icon: 'cash-outline', eg: 'Savings, revenue' },
  { type: 'time', label: 'Time', icon: 'time-outline', eg: 'Sleep, deep work' },
  { type: 'scale', label: '1 to 5', icon: 'happy-outline', eg: 'Mood, energy' },
];
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const EXTRAS: { extra: Extra; label: string; icon: any; eg: string }[] = [
  { extra: { type: 'countdown', title: 'My big day', date: inDays(30) }, label: 'Countdown', icon: 'hourglass-outline', eg: 'Days to a date' },
  { extra: { type: 'note', text: '' }, label: 'Note', icon: 'document-text-outline', eg: 'A line to see each day' },
  { extra: { type: 'checklist', title: 'Checklist', items: [] }, label: 'Checklist', icon: 'checkbox-outline', eg: 'Tick things off' },
];

function Lock({ text }: { text: string }) {
  return (
    <View style={{ alignSelf: 'flex-start', marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, backgroundColor: colours.orangeSoft, borderWidth: 1, borderColor: colours.orange }}>
      <Ionicons name="lock-closed" size={10} color={colours.orange} />
      <Text style={{ color: colours.orange, fontSize: 10, fontWeight: '800' }}>{text}</Text>
    </View>
  );
}

function Gallery({ plan, mode, single, have, onAdd, onTemplate }: { plan: Plan; mode: Mode; single: boolean; have: Widget[]; onAdd: (b: Block) => void; onTemplate: (t: Template) => void }) {
  const free = plan === 'free';
  const groups = single ? ['Health', 'Mind', 'Money', 'People', 'Work'] : mode === 'business' ? ['Business', 'Work'] : ['Health', 'Mind', 'Money', 'People'];
  const haveBuiltin = new Set(have.filter((w) => w.kind === 'builtin').map((w) => w.builtin));
  const haveNames = new Set(have.filter((w) => w.kind === 'tracker').map((w) => (w.tracker as Tracker)?.name?.toLowerCase()));
  const builtins = (Object.keys(BUILTINS) as BuiltIn[]).filter((k) => (single || BUILTINS[k].modes.includes(mode)) && !haveBuiltin.has(k));
  const mine = builtins.filter((k) => BUILTINS[k].plan !== 'biz');
  const bizBlocks = builtins.filter((k) => BUILTINS[k].plan === 'biz');
  const builtinRow = (k: BuiltIn) => {
    const ok = blockAllowed(plan, { kind: 'builtin', builtin: k });
    return (
      <Pressable key={k} onPress={() => (ok ? onAdd(builtinBlock(k, 'wide')) : router.navigate('/plans'))} accessibilityRole="button" accessibilityLabel={`Add ${BUILTINS[k].title}`}>
        <BlockPreview w={{ id: k, kind: 'builtin', builtin: k, size: 'wide' }} compact />
        {ok ? null : <Lock text={BUILTINS[k].plan === 'biz' ? 'BUSINESS' : 'PAID'} />}
      </Pressable>
    );
  };
  return (
    <View>
      {head('MAKE YOUR OWN TRACKER')}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {TYPES.map((t) => (
          <Pressable key={t.type} onPress={() => router.navigate(`/widget-new?type=${t.type}&mode=${mode}` as any)}
            style={{ width: '31.5%', padding: 10, borderRadius: 14, backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.border }}>
            <Ionicons name={t.icon} size={20} color={colours.purple} />
            <Text style={{ color: colours.text, fontWeight: '800', marginTop: 6 }}>{t.label}</Text>
            <Text style={{ color: colours.faint, fontSize: 11, marginTop: 2 }}>{t.eg}</Text>
          </Pressable>
        ))}
      </View>

      {head('COUNTDOWN, NOTE AND CHECKLIST')}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {EXTRAS.map((x) => {
          const ok = blockAllowed(plan, { kind: 'extra', extra: x.extra });
          return (
            <Pressable key={x.label} onPress={() => (ok ? onAdd(extraBlock(x.extra, x.extra.type === 'countdown' ? 'small' : 'wide')) : router.navigate('/plans'))}
              style={{ width: '31.5%', padding: 10, borderRadius: 14, backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.border, opacity: ok ? 1 : 0.7 }}>
              <Ionicons name={x.icon} size={20} color={colours.orange} />
              <Text style={{ color: colours.text, fontWeight: '800', marginTop: 6 }}>{x.label}</Text>
              <Text style={{ color: colours.faint, fontSize: 11, marginTop: 2 }}>{ok ? x.eg : 'Paid plans'}</Text>
            </Pressable>
          );
        })}
      </View>

      {groups.map((g) => {
        const items = Object.entries(TRACKER_PRESETS).filter(([, p]) => p.group === g && !haveNames.has(p.name.toLowerCase()));
        if (!items.length) return null;
        return (
          <View key={g}>
            {head(g.toUpperCase())}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 }}>
              {items.map(([k]) => {
                const spec = presetSpec(k);
                const fit = forPlan(spec, plan);
                const changed = free && (fit.style !== spec.style || fit.period !== spec.period);
                return (
                  <Pressable key={k} onPress={() => onAdd(draftTracker(fit, spec.type === 'money' && spec.period !== 'week' ? 'wide' : 'small'))} style={{ width: '48.5%' }} accessibilityLabel={`Add ${spec.name}`}>
                    <BlockPreview w={{ id: k, kind: 'tracker', spec: fit, size: 'small' }} blank />
                    {changed ? <Lock text={fit.period !== spec.period ? 'WEEKLY ON FREE' : `${spec.style.toUpperCase()} ON PAID`} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}

      {mine.length ? (<>{head('FROM YOUR HQ')}<View style={{ gap: 8 }}>{mine.map(builtinRow)}</View></>) : null}
      {bizBlocks.length ? (<>{head('BUSINESS BLOCKS')}<View style={{ gap: 8 }}>{bizBlocks.map(builtinRow)}</View></>) : null}

      {head('START FROM A TEMPLATE')}
      <View style={{ gap: 8 }}>
        {TEMPLATES.filter((t) => single || t.home === 'either' || t.home === mode).map((t) => (
          <Pressable key={t.key} onPress={() => onTemplate(t)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.border }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colours.text, fontWeight: '800' }}>{t.name}</Text>
              <Text style={{ color: colours.faint, fontSize: 12 }}>{t.desc}</Text>
            </View>
            <Text style={{ color: colours.purple, fontWeight: '800' }}>Preview</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** A template before it goes on: the home it makes, every target editable, then Add or Replace. */
function TemplateSheet({ tpl, plan, mode, hasBiz, current, trackers, homeKey, onClose, onDone }: { tpl: Template | null; plan: Plan; mode: Mode; hasBiz: boolean; current: Widget[]; trackers: Tracker[]; homeKey: string; onClose: () => void; onDone: () => void }) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [more, setMore] = useState(0);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState<'add' | 'replace' | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!tpl) return;
    const r = templateBlocks(tpl, plan, mode, hasBiz);
    setBlocks(r.blocks); setMore(r.more); setSure(false); setErr('');
  }, [tpl, plan, mode, hasBiz]);
  if (!tpl) return null;
  const setTarget = (id: string, v: string) => setBlocks((bs) => bs.map((b) => (b.id === id && b.spec ? { ...b, spec: { ...b.spec, target: Number(v.replace(/,/g, '')) || null } } : b)));
  const setName = (id: string, v: string) => setBlocks((bs) => bs.map((b) => (b.id === id && b.spec ? { ...b, spec: { ...b.spec, name: v } } : b)));
  async function apply(replace: boolean) {
    if (replace && !sure) return setSure(true);
    setBusy(replace ? 'replace' : 'add'); setErr('');
    try {
      const cur: Block[] = current.map(({ tracker: _t, ...b }: any) => b);
      const nameOf = (b: Block) => trackers.find((t) => t.id === b.tracker_id)?.name ?? null;
      const clean = blocks.map((b) => (b.spec ? { ...b, spec: { ...b.spec, name: b.spec.name.trim() || 'Tracker' } } : b));
      const want = replace ? clean : mergeBlocks(cur, clean, nameOf).slice(cur.length);
      const made = await materialise(homeKey, want);
      await saveLayout(homeKey, fitPlan(replace ? made : [...cur, ...made], plan));
      onDone();
    } catch (e: any) { setErr(e?.message ?? 'Could not add that template.'); }
    setBusy(null);
  }
  return (
    <Sheet visible title={tpl.name} sub={`${tpl.desc}. Change any target before it goes on.`} onClose={onClose}>
      <View style={{ borderRadius: 20, padding: 12, backgroundColor: 'rgba(30,24,88,0.6)', borderWidth: 1, borderColor: colours.border }}>
        <MiniLayout widgets={blocks} blank />
      </View>
      {blocks.some((b) => b.spec) ? head('TARGETS') : null}
      {blocks.filter((b) => b.spec).map((b) => (
        <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: b.spec!.colour }} />
          <TextInput value={b.spec!.name} onChangeText={(v) => setName(b.id, v)} maxLength={60} style={[input, { flex: 1.4, fontSize: 14, paddingVertical: 9 }]} accessibilityLabel="Tracker name" />
          {b.spec!.type === 'yesno' && !b.spec!.target ? <Text style={{ flex: 1, color: colours.faint, fontSize: 12.5 }}>{goalLine(b.spec!)}</Text> : (
            <>
              <TextInput value={b.spec!.target ? String(b.spec!.target) : ''} onChangeText={(v) => setTarget(b.id, v)} keyboardType="numeric" style={[input, { width: 84, fontSize: 14, paddingVertical: 9, textAlign: 'right' }]} accessibilityLabel={`${b.spec!.name} target`} />
              <Text numberOfLines={1} style={{ width: 70, color: colours.faint, fontSize: 12 }}>{b.spec!.type === 'money' ? 'A$' : b.spec!.unit} {b.spec!.period === 'total' ? 'in total' : `a ${b.spec!.period}`}</Text>
            </>
          )}
        </View>
      ))}
      {more > 0 ? (
        <Pressable onPress={() => router.navigate('/plans')} style={{ marginTop: 4, marginBottom: 6 }}>
          <Text style={{ color: colours.orange, fontWeight: '700', fontSize: 13 }}>This is the Free version. The full version adds {more} more. See plans ›</Text>
        </Pressable>
      ) : null}
      <ErrorText>{err}</ErrorText>
      <View style={{ height: space.sm }} />
      <Button title="Add to my home" onPress={() => apply(false)} busy={busy === 'add'} disabled={!!busy} />
      {sure ? <Text style={{ color: colours.muted, fontSize: 13, lineHeight: 19, marginBottom: 6 }}>Your trackers and their history are kept, just taken off the home. Tap again to replace it.</Text> : null}
      <Button kind={sure ? 'danger' : 'ghost'} title={sure ? 'Yes, replace my home' : 'Replace my home'} onPress={() => apply(true)} busy={busy === 'replace'} disabled={!!busy} />
    </Sheet>
  );
}

/** Edit a Countdown, a Note or a Checklist's title. */
export function ExtraSheet({ w, onClose, onSave }: { w: Widget | null; onClose: () => void; onSave: (x: Extra) => void }) {
  const [x, setX] = useState<Extra | null>(null);
  const [date, setDate] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { setX(w?.extra ?? null); setErr(''); if (w?.extra?.type === 'countdown') setDate(w.extra.date.split('-').reverse().join('/')); }, [w]);
  if (!w || !x) return null;
  function save() {
    if (!x) return;
    if (x.type === 'countdown') {
      const m = date.trim().match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
      if (!m) return setErr('Write the date like 25/12/2026.');
      const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      if (Number.isNaN(new Date(`${iso}T12:00:00`).getTime())) return setErr('That date does not look right.');
      return onSave({ ...x, title: x.title.trim().slice(0, 60) || 'Countdown', date: iso });
    }
    if (x.type === 'note') return onSave({ ...x, text: x.text.trim().slice(0, 280) });
    onSave({ ...x, title: x.title.trim().slice(0, 60) || 'Checklist' });
  }
  return (
    <Sheet visible title={x.type === 'countdown' ? 'Countdown' : x.type === 'note' ? 'Note' : 'Checklist'} onClose={onClose}>
      {x.type === 'note' ? (
        <TextInput value={x.text} onChangeText={(text) => setX({ ...x, text })} multiline maxLength={280} placeholder="A line you want to see each day" placeholderTextColor={colours.faint} style={[input, { minHeight: 110, textAlignVertical: 'top', marginBottom: space.md }]} autoFocus />
      ) : (
        <TextInput value={x.title} onChangeText={(title) => setX({ ...x, title } as Extra)} maxLength={60} placeholder={x.type === 'countdown' ? 'What are you counting down to?' : 'What is this list for?'} placeholderTextColor={colours.faint} style={[input, { marginBottom: space.md }]} />
      )}
      {x.type === 'countdown' ? <TextInput value={date} onChangeText={setDate} placeholder="25/12/2026" placeholderTextColor={colours.faint} keyboardType="numbers-and-punctuation" style={[input, { marginBottom: space.md }]} accessibilityLabel="Date, day month year" /> : null}
      {x.type === 'checklist' ? <Text style={{ color: colours.muted, fontSize: 13, marginBottom: space.md }}>Add and tick items on your home.</Text> : null}
      <ErrorText>{err}</ErrorText>
      <Button title="Save" onPress={save} />
    </Sheet>
  );
}
