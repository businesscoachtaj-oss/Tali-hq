// 10 Nov 2026 (Taj: combine the concept with the current app): the top of Today IS her brain. Your day
// is the brightest stars around it, wired to the brain. Tap one and everything connected lights up.
// The rest of Today (needs you, due, your day, glance) carries on underneath.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { BrainGlobe } from '@/components/BrainGlobe';
import { TaliAvatar } from '@/components/TaliAvatar';
import { myBrain, myConnections, myUpcoming, type Brain, type RegionId, type Upcoming } from '@/lib/brain';
import { inboundEmails, openReminders, pendingApprovals, type Approval, type InboundEmail, type Reminder } from '@/lib/data';
import { loadMoneyPicture, type MoneyPicture } from '@/lib/money';
import { addDays } from '@/lib/dates';
import { taliLevel, type Level } from '@/lib/level';

const AREA = {
  people: { name: 'People', colour: '#5CF2C0' },
  work: { name: 'Work', colour: '#7FA8FF' },
  money: { name: 'Money', colour: '#FFB04D' },
  health: { name: 'Health', colour: '#FF7EB6' },
  growth: { name: 'Growth', colour: '#FFE066' },
} as const;
type Area = keyof typeof AREA;
type Star = { key: string; title: string; sub: string; area: Area; size: number; full?: string; links: Link[]; action?: string; to?: string; ask?: string; seed?: string; fallback?: Link[] };
// `full` is the whole memory, shown when a star or one of its connections is opened.
type Link = { text: string; area: Area; full?: string };

const SPOTS = [[0, 0.02], [1, 0.2], [0, 0.42], [1, 0.62], [0, 0.76], [1, 0.86]] as const;

export function BrainSky({ greeting, sub }: { greeting: string; sub?: string | null }) {
  const { width } = useWindowDimensions();
  const W = Math.min(width, 640);
  const [brain, setBrain] = useState<Brain | null>(null);
  const [money, setMoney] = useState<MoneyPicture | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [mail, setMail] = useState<InboundEmail[]>([]);
  const [due, setDue] = useState<Reminder[]>([]);
  const [focus, setFocus] = useState<string | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  // 10 Nov 2026 overhaul: dates she remembers become stars as they get close, and a tapped star asks
  // the brain for what is really connected to it.
  const [upcoming, setUpcoming] = useState<Upcoming[]>([]);
  const [found, setFound] = useState<Record<string, Link[]>>({});
  // A connection that has been tapped open, so it can be read in full.
  const [openLink, setOpenLink] = useState<Link | null>(null);
  const pick = (key: string | null) => { setOpenLink(null); setFocus(key); };

  useFocusEffect(useCallback(() => {
    const end = addDays(new Date(new Date().setHours(0, 0, 0, 0)), 1).toISOString();
    myBrain('mine').then(setBrain).catch(() => {});
    taliLevel().then(setLevel).catch(() => {});
    myUpcoming(45).then(setUpcoming).catch(() => {});
    loadMoneyPicture().then(setMoney).catch(() => {});
    pendingApprovals().then(setApprovals).catch(() => {});
    inboundEmails().then((e) => setMail(e.filter((x) => x.status === 'new'))).catch(() => {});
    openReminders(end).then(setDue).catch(() => {});
  }, []));

  const items = brain?.regions.flatMap((r) => r.items) ?? [];
  const person = items.find((i) => i.kind === 'person' && /birthday/i.test(i.text));
  const idea = items.find((i) => i.kind === 'idea');
  const late = money?.overdueInvoices?.[0];

  // Everything on a star is real: what is late, waiting, new or due, plus what she remembers that touches it.
  const short = (t: string, n = 40) => (t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t);
  const areaOf = (kind: string): Area => (kind === 'person' ? 'people' : ['idea', 'plan', 'goal', 'decision'].includes(kind) ? 'growth' : kind === 'event' ? 'health' : 'work');
  // Up to two other things she knows that mention the same name.
  const related = (name: string | null | undefined, skip?: string) => {
    const n = (name ?? '').trim().toLowerCase();
    if (n.length < 3) return [];
    return items.filter((i) => i.text !== skip && i.text.toLowerCase().includes(n)).slice(0, 2).map((i) => ({ text: short(i.text, 44), area: areaOf(i.kind), full: i.text }));
  };
  const stars: Star[] = [];
  if (late) {
    const lateMs = Date.now() - new Date(late.due_date).getTime();
    const days = Number.isFinite(lateMs) ? Math.max(1, Math.round(lateMs / 86400000)) : 0;
    stars.push({ key: 'late', title: `Invoice ${late.number} is late`, sub: `${late.client_name}, A$${late.total}`, area: 'money', size: 22,
      links: [{ text: late.client_name, area: 'people' }, ...(days ? [{ text: `${days} ${days === 1 ? 'day' : 'days'} overdue`, area: 'money' as Area }] : [])], seed: late.client_name, fallback: related(late.client_name).slice(0, 1), action: 'Open invoices', to: '/invoices' });
  }
  if (approvals[0]) {
    const to = approvals[0].draft?.to_name;
    stars.push({ key: 'yes', title: short(approvals[0].title), sub: 'Waiting for your yes', area: 'work', size: 18,
      links: to ? [{ text: to, area: 'people' as Area }] : [], seed: to || approvals[0].title, fallback: related(to), action: approvals.length > 1 ? `${approvals.length} drafts are just below` : 'The draft is just below' });
  }
  if (mail[0]) {
    const from = mail[0].from_name || mail[0].from_email || 'Someone';
    stars.push({ key: 'mail', title: `${short(from, 22)} emailed`, sub: mail[0].summary || mail[0].subject || 'New email', area: 'people', size: 16,
      links: mail[0].subject ? [{ text: short(mail[0].subject, 44), area: 'work' as Area }] : [], seed: mail[0].from_name || mail[0].subject || '', fallback: related(mail[0].from_name), action: 'Open email', to: '/inbox' });
  }
  if (due[0]) {
    const at = due[0].due_at ? new Date(due[0].due_at) : null;
    stars.push({ key: 'due', title: short(due[0].text), sub: at && !Number.isNaN(at.getTime()) ? `Today, ${at.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}` : 'Due today', area: 'work', size: 13,
      links: due.length > 1 ? [{ text: `${due.length - 1} more due today`, area: 'work' }] : [], action: 'Your list is just below' });
  }
  // Dates she remembers, as they get close (a birthday, a renewal, a deadline). Soonest two.
  const soon = (n: number) => (n <= 0 ? 'Today' : n === 1 ? 'Tomorrow' : n < 14 ? `In ${n} days` : `In ${Math.round(n / 7)} weeks`);
  for (const u of upcoming.slice(0, 2)) {
    stars.push({ key: `date-${u.id}`, full: u.text, ask: `Help me plan for this: ${u.text}`, title: short(u.text, 46), sub: `${soon(u.days_away)}${u.yearly ? ', every year' : ''}`, area: areaOf(u.kind), size: u.days_away <= 7 ? 17 : 14, links: [], seed: u.text, action: 'Plan it with her', to: '/talk' });
  }
  // Until the dates are switched on server side, a birthday she remembers still shows.
  if (!upcoming.length && person) stars.push({ key: 'person', full: person.text, ask: `Let's talk about this: ${person.text}`, title: short(person.text, 46), sub: 'Something she remembers for you', area: 'people', size: 14, links: [], seed: person.text, fallback: related(person.text.split(/[\s']/)[0], person.text), action: 'Talk it through', to: '/talk' });
  if (idea) stars.push({ key: 'idea', full: idea.text, ask: `Let's plan this idea: ${idea.text}`, title: short(idea.text, 46), sub: /night school/i.test(idea.text) ? 'An idea from her night school' : 'An idea you had', area: 'growth', size: 12, links: [], seed: idea.text, action: 'Plan it with her', to: '/talk' });

  // Six places in the sky. What needs you comes first, so an idea is the first to wait for a quiet day.
  stars.length = Math.min(stars.length, SPOTS.length);

  const stageH = 470;
  const cx = W / 2, cy = stageH / 2;
  const pos = (i: number) => ({ x: 16 + SPOTS[i][0] * (W - 186), y: SPOTS[i][1] * (stageH - 50) });
  const counts: Partial<Record<RegionId, number>> = {};
  brain?.regions.forEach((r) => (counts[r.id] = r.count));
  const picked = stars.find((s) => s.key === focus) ?? null;
  // What the brain says is connected, else the simple name match, on top of the star's own facts.
  const sel = picked ? { ...picked, links: [...picked.links, ...((found[picked.key]?.length ? found[picked.key] : picked.fallback) ?? [])].slice(0, 3) } : null;
  const seed = picked?.seed ?? '';
  const pickedKey = picked?.key ?? '';
  useEffect(() => {
    if (!pickedKey || !seed || found[pickedKey]) return;
    let live = true;
    myConnections(seed, 3).then((rows) => {
      if (!live) return;
      const own = new Set((picked?.links ?? []).map((l) => l.text.toLowerCase()));
      setFound((f) => ({ ...f, [pickedKey]: rows.filter((r) => r.text && r.text !== seed && !own.has(r.text.toLowerCase())).map((r) => ({ text: short(r.text, 44), area: areaOf(r.kind), full: r.text })) }));
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedKey, seed]);
  const needs = stars.filter((s) => s.key === 'late' || s.key === 'yes' || s.key === 'mail').length;
  const line = sel ? "Here's everything I know that touches this." : needs ? `${needs} ${needs === 1 ? 'thing needs' : 'things need'} you. I've got the rest.` : 'All quiet. Tell me anything.';

  return (
    <View style={{ width: W, alignSelf: 'center' }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(185,166,255,0.18)', borderWidth: 1, borderColor: 'rgba(214,200,255,0.6)', shadowColor: '#B9A6FF', shadowOpacity: 1, shadowRadius: 22, shadowOffset: { width: 0, height: 0 } }}>
            <TaliAvatar pose="head" size={42} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#B9A6FF', fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>{new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</Text>
            <Text style={{ color: '#F4F1FF', fontSize: 15, marginTop: 2 }}>{greeting}{sub ? `  ·  ${sub}` : ''}</Text>
          </View>
        </View>
        {/* Her words float in the space. */}
        <Text style={{ color: '#FFFFFF', fontSize: 32, lineHeight: 36, paddingHorizontal: 20, marginTop: 10, fontFamily: 'InstrumentSerif_400Regular', textShadowColor: 'rgba(185,166,255,0.8)', textShadowRadius: 18 }}>{line}</Text>

        {/* The stage: her brain, with your day orbiting it. */}
        {/* Tapping the empty sky closes whatever is open. */}
        <Pressable onPress={() => focus && pick(null)} accessible={false} style={{ height: stageH, marginTop: 10 }}>
          <View style={{ position: 'absolute', left: cx - 150, top: cy - 150, opacity: sel ? 0.35 : 1 }}>
            <BrainGlobe size={300} counts={counts as any} links={brain?.links ?? []} selected={null} onSelect={() => (focus ? pick(null) : router.navigate('/brain'))} />
          </View>
          {stars.map((s, i) => {
            const p = pos(i); const c = AREA[s.area].colour; const on = focus === s.key; const dim = !!focus && !on;
            const sx = p.x + 8, sy = p.y + 8;
            return <Beam key={'l' + s.key} x1={sx} y1={sy} x2={cx} y2={cy} colour={c} opacity={dim ? 0.08 : on ? 0.9 : 0.35} />;
          })}
          {sel ? sel.links.map((l, k) => {
            const i = stars.findIndex((x) => x.key === sel.key); const p = pos(i);
            // Stack the connections clear of the star's own label and of each other: below it for stars
            // in the top half of the sky, above it for the rest.
            const down = p.y < stageH / 2;
            const lx = Math.min(W - 190, Math.max(12, p.x > W / 2 ? p.x - 150 - k * 14 : p.x + 44 + k * 14));
            const ly = down ? p.y + 96 + k * 50 : p.y - 46 - k * 50;
            const on = openLink?.text === l.text;
            return (
              <View key={'s' + k} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
                <Beam x1={p.x + 8} y1={p.y + 8} x2={lx} y2={ly} colour={AREA[l.area].colour} opacity={0.9} />
                <Pressable onPress={() => setOpenLink(on ? null : l)} accessibilityRole="button" accessibilityLabel={l.full ?? l.text} hitSlop={6}
                  style={{ position: 'absolute', left: lx - 5, top: ly - 5, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 10, height: 10 }}><Glow colour={AREA[l.area].colour} size={10} /></View>
                  <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '700', maxWidth: 170, backgroundColor: on ? AREA[l.area].colour + '44' : 'rgba(10,8,32,0.9)', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 9, overflow: 'hidden', borderWidth: 1, borderColor: AREA[l.area].colour + (on ? 'FF' : '88') }}>{l.text}</Text>
                </Pressable>
              </View>
            );
          }) : null}
          {stars.map((s, i) => {
            const p = pos(i); const c = AREA[s.area].colour; const on = focus === s.key; const dim = !!focus && !on;
            return (
              <Pressable key={s.key} onPress={() => pick(on ? null : s.key)} accessibilityRole="button" accessibilityLabel={s.full ?? s.title}
                style={{ position: 'absolute', left: p.x, top: p.y, flexDirection: 'row', alignItems: 'flex-start', gap: 8, opacity: dim ? 0.12 : 1, maxWidth: 160 }}>
                <Pulse colour={c} size={s.size} on={on} strong={s.area === 'money'} delay={i * 350} />
                <View style={{ flexShrink: 1, backgroundColor: 'rgba(10,8,32,0.78)', borderRadius: 12, paddingVertical: 6, paddingHorizontal: 9, borderWidth: 1, borderColor: c + '66' }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '800' }}>{s.title}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 11.5, marginTop: 1 }} numberOfLines={2}>{s.sub}</Text>
                </View>
              </Pressable>
            );
          })}
        </Pressable>

        {sel ? (() => {
          // The card reads out whatever is open in full: the star itself, or one of its connections.
          const area = openLink ? openLink.area : sel.area;
          const c = AREA[area].colour;
          const words = openLink ? (openLink.full ?? openLink.text) : (sel.full ?? sel.title);
          const ask = openLink ? `Tell me more about this: ${openLink.full ?? openLink.text}` : sel.ask;
          const to = openLink ? '/talk' : sel.to;
          const go = () => { if (!to) return; if (to === '/talk' && ask) router.navigate({ pathname: '/talk', params: { ask } } as any); else router.navigate(to as any); };
          return (
            <View style={{ marginHorizontal: 16, marginTop: 6, padding: 18, borderRadius: 22, backgroundColor: 'rgba(20,16,52,0.92)', borderWidth: 1, borderColor: c + '99', shadowColor: c, shadowOpacity: 0.6, shadowRadius: 26, shadowOffset: { width: 0, height: 0 } }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1, color: c, fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>{openLink ? `CONNECTED  ·  ${AREA[area].name.toUpperCase()}` : AREA[area].name.toUpperCase()}</Text>
                <Pressable onPress={() => (openLink ? setOpenLink(null) : pick(null))} accessibilityRole="button" accessibilityLabel={openLink ? 'Back' : 'Close'} hitSlop={14}
                  style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>{openLink ? '‹' : '✕'}</Text>
                </Pressable>
              </View>
              <Text style={{ color: '#FFFFFF', fontSize: words.length > 70 ? 19 : 26, lineHeight: words.length > 70 ? 26 : 31, marginTop: 6, fontFamily: 'InstrumentSerif_400Regular' }}>{words}</Text>
              {!openLink ? <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 4 }}>{sel.sub}</Text> : null}
              {!openLink && sel.links.length ? <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12.5, marginTop: 8 }}>Tap a connection to read it.</Text> : null}
              {openLink || sel.action ? (
                <Pressable accessibilityRole="button" disabled={!to} onPress={go}
                  style={{ marginTop: 16, alignSelf: 'flex-start', backgroundColor: to ? c : 'rgba(255,255,255,0.12)', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 20, shadowColor: c, shadowOpacity: to ? 0.8 : 0, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } }}>
                  <Text style={{ color: to ? '#0C0A24' : 'rgba(255,255,255,0.8)', fontWeight: '800', fontSize: 15 }}>{openLink ? 'Talk about this' : sel.action}</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })() : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 18, paddingHorizontal: 16, marginTop: 28 }}>
            {(Object.keys(AREA) as Area[]).map((a) => (
              <Pressable key={a} onPress={() => router.navigate('/world')} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }} accessibilityRole="button">
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: AREA[a].colour, shadowColor: AREA[a].colour, shadowOpacity: 1, shadowRadius: 8 }} />
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700' }}>{AREA[a].name}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Tali's level stays (Taj, 10 Nov 2026): it's how you see her grow. */}
        {level ? (
          <Pressable onPress={() => router.navigate('/brain')} accessibilityRole="button" accessibilityLabel={`Tali's level ${level.level}, ${level.name}, ${level.xp} XP`}
            style={{ marginHorizontal: 16, marginTop: 22, padding: 14, borderRadius: 20, backgroundColor: 'rgba(107,79,216,0.38)', borderWidth: 1, borderColor: 'rgba(214,200,255,0.5)', shadowColor: '#7A4DFF', shadowOpacity: 0.7, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F6A02C', alignItems: 'center', justifyContent: 'center', shadowColor: '#F6A02C', shadowOpacity: 1, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } }}>
                <Text style={{ color: '#141033', fontSize: 19, fontWeight: '800' }}>{level.level}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFC56B', fontSize: 11, fontWeight: '800', letterSpacing: 1.6 }}>TALI'S LEVEL</Text>
                <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800' }}>{level.name}</Text>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '700' }}>{level.xp} XP</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 12, overflow: 'hidden' }}>
              <View style={{ width: `${Math.max(4, Math.round(level.progress * 100))}%`, height: 6, borderRadius: 3, backgroundColor: '#F6A02C' }} />
            </View>
            {level.next ? <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12.5, marginTop: 8 }}>{level.toNext} XP to {level.next}. Her brain grows every time you talk.</Text> : null}
          </Pressable>
        ) : null}

        <Pressable onPress={() => router.navigate('/talk')} accessibilityRole="button"
          style={{ marginHorizontal: 16, marginTop: 22, borderRadius: 999, paddingVertical: 16, paddingHorizontal: 22, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(214,200,255,0.45)', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ flex: 1, color: 'rgba(255,255,255,0.65)', fontSize: 16 }}>Tell her anything...</Text>
          <Text style={{ color: '#B9A6FF', fontSize: 18 }}>{'●'}</Text>
        </Pressable>
    </View>
  );
}

// A thin glowing line between two points, drawn with a rotated view (no SVG needed).
function Beam({ x1, y1, x2, y2, colour, opacity }: { x1: number; y1: number; x2: number; y2: number; colour: string; opacity: number }) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ang = Math.atan2(y2 - y1, x2 - x1);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: (x1 + x2) / 2 - len / 2, top: (y1 + y2) / 2, width: len, height: 1.5, backgroundColor: colour, opacity, transform: [{ rotate: `${ang}rad` }], shadowColor: colour, shadowOpacity: 1, shadowRadius: 6 }} />
  );
}

// A star that breathes. Urgent ones (money) pulse bigger so your eye goes there first.
function Pulse({ colour, size, on, strong, delay }: { colour: string; size: number; on: boolean; strong: boolean; delay: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration: strong ? 900 : 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: strong ? 900 : 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v, strong, delay]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, strong ? 1.45 : 1.18] });
  const ring = v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  const ringScale = v.interpolate({ inputRange: [0, 1], outputRange: [1, strong ? 2.6 : 1.8] });
  return (
    <View style={{ width: size, height: size, marginTop: 2 }}>
      <Animated.View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: colour, opacity: ring, transform: [{ scale: ringScale }] }} />
      <Animated.View style={{ width: size, height: size, transform: [{ scale }] }}>
        <Glow colour={colour} size={size} />
      </Animated.View>
    </View>
  );
}

// The same glow as a picked part of her brain: three soft rings of colour and a white core.
function Glow({ colour, size }: { colour: string; size: number }) {
  const b = size;
  return (
    <>
      <View style={{ position: 'absolute', width: b * 4, height: b * 4, left: -b * 1.5, top: -b * 1.5, borderRadius: b * 2, backgroundColor: colour, opacity: 0.1 }} />
      <View style={{ position: 'absolute', width: b * 2.6, height: b * 2.6, left: -b * 0.8, top: -b * 0.8, borderRadius: b * 1.3, backgroundColor: colour, opacity: 0.16 }} />
      <View style={{ position: 'absolute', width: b * 1.6, height: b * 1.6, left: -b * 0.3, top: -b * 0.3, borderRadius: b * 0.8, backgroundColor: colour, opacity: 0.3 }} />
      <View style={{ position: 'absolute', width: b, height: b, left: 0, top: 0, borderRadius: b / 2, backgroundColor: colour }} />
      <View style={{ position: 'absolute', width: b * 0.45, height: b * 0.45, left: b * 0.275, top: b * 0.275, borderRadius: b, backgroundColor: '#FFFFFF', opacity: 0.85 }} />
    </>
  );
}
