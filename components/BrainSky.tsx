// 10 Nov 2026 (Taj: combine the concept with the current app): the top of Today IS her brain. Your day
// is the brightest stars around it, wired to the brain. Tap one and everything connected lights up.
// The rest of Today (needs you, due, your day, glance) carries on underneath.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { BrainGlobe } from '@/components/BrainGlobe';
import { TaliAvatar } from '@/components/TaliAvatar';
import { myBrain, type Brain, type RegionId } from '@/lib/brain';
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
type Star = { key: string; title: string; sub: string; area: Area; size: number; links: { text: string; area: Area }[]; action?: string };

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

  useFocusEffect(useCallback(() => {
    const end = addDays(new Date(new Date().setHours(0, 0, 0, 0)), 1).toISOString();
    myBrain('mine').then(setBrain).catch(() => {});
    taliLevel().then(setLevel).catch(() => {});
    loadMoneyPicture().then(setMoney).catch(() => {});
    pendingApprovals().then(setApprovals).catch(() => {});
    inboundEmails().then((e) => setMail(e.filter((x) => x.status === 'new'))).catch(() => {});
    openReminders(end).then(setDue).catch(() => {});
  }, []));

  const items = brain?.regions.flatMap((r) => r.items) ?? [];
  const person = items.find((i) => i.kind === 'person' && /birthday/i.test(i.text));
  const idea = items.find((i) => i.kind === 'idea');
  const late = money?.overdueInvoices?.[0];

  const stars: Star[] = [];
  if (late) stars.push({ key: 'late', title: `Invoice ${late.number} is late`, sub: `${late.client_name}, A$${late.total}`, area: 'money', size: 22,
    links: [{ text: late.client_name, area: 'people' }, { text: `${(late as any).days ?? Math.max(1, Math.round((Date.now() - new Date(late.due_date).getTime()) / 86400000))} days overdue`, area: 'money' }, { text: 'Invoice sent with Stripe link', area: 'work' }], action: 'Draft a friendly nudge' });
  if (approvals[0]) stars.push({ key: 'yes', title: approvals[0].title, sub: 'Waiting for your yes', area: 'work', size: 18,
    links: [{ text: approvals[0].draft?.to_name || 'Jess', area: 'people' }, { text: 'Thursday 10am is free', area: 'work' }], action: 'Read the draft' });
  if (mail[0]) stars.push({ key: 'mail', title: `${mail[0].from_name || 'Someone'} wants to move`, sub: mail[0].summary || mail[0].subject || 'New email', area: 'people', size: 16,
    links: [{ text: 'Saturday 9am is free', area: 'work' }, { text: 'Trains with you Fridays', area: 'health' }], action: 'Offer Saturday' });
  if (person) stars.push({ key: 'mum', title: "Mum's birthday", sub: '14 December. She loves orchids.', area: 'health', size: 14,
    links: [{ text: '5 weeks away', area: 'growth' }, { text: 'Orchid delivery near her', area: 'people' }], action: 'Remind me 1 Dec' });
  if (due[0]) stars.push({ key: 'due', title: due[0].text, sub: 'Today, 10am', area: 'work', size: 13, links: [{ text: 'May, M.L Remedial', area: 'people' }], action: 'Done' });
  if (idea) stars.push({ key: 'idea', title: 'Weekend bootcamp', sub: 'Your idea for February', area: 'growth', size: 12,
    links: [{ text: '6 clients asked about weekends', area: 'people' }, { text: 'Park permit needed', area: 'work' }], action: 'Plan it with her' });

  const stageH = 470;
  const cx = W / 2, cy = stageH / 2;
  const pos = (i: number) => ({ x: 16 + SPOTS[i][0] * (W - 186), y: SPOTS[i][1] * (stageH - 50) });
  const counts: Partial<Record<RegionId, number>> = {};
  brain?.regions.forEach((r) => (counts[r.id] = r.count));
  const sel = stars.find((s) => s.key === focus) ?? null;
  const needs = stars.filter((s) => s.area === 'money' || s.key === 'yes' || s.key === 'mail').length;
  const line = sel ? `${sel.title}. Here's everything I know that touches it.` : needs ? `${needs} things need you. I've got the rest.` : 'All quiet. Tell me anything.';

  return (
    <View style={{ width: W, alignSelf: 'center' }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ borderRadius: 24, padding: 6, backgroundColor: 'rgba(107,79,216,0.45)', borderWidth: 1, borderColor: 'rgba(214,200,255,0.55)', shadowColor: '#B9A6FF', shadowOpacity: 0.9, shadowRadius: 22, shadowOffset: { width: 0, height: 0 } }}>
            <TaliAvatar pose="idle" size={92} style={{ backgroundColor: 'transparent' }} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#B9A6FF', fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>{new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</Text>
            <Text style={{ color: '#F4F1FF', fontSize: 15, marginTop: 2 }}>{greeting}{sub ? `  ·  ${sub}` : ''}</Text>
          </View>
        </View>
        {/* Her words float in the space. */}
        <Text style={{ color: '#FFFFFF', fontSize: 32, lineHeight: 36, paddingHorizontal: 20, marginTop: 10, fontFamily: 'InstrumentSerif_400Regular', textShadowColor: 'rgba(185,166,255,0.8)', textShadowRadius: 18 }}>{line}</Text>

        {/* The stage: her brain, with your day orbiting it. */}
        <View style={{ height: stageH, marginTop: 10 }}>
          <View style={{ position: 'absolute', left: cx - 150, top: cy - 150, opacity: sel ? 0.35 : 1 }}>
            <BrainGlobe size={300} counts={counts as any} links={brain?.links ?? []} selected={null} onSelect={() => router.navigate('/brain')} />
          </View>
          {stars.map((s, i) => {
            const p = pos(i); const c = AREA[s.area].colour; const on = focus === s.key; const dim = !!focus && !on;
            const sx = p.x + 8, sy = p.y + 8;
            return <Beam key={'l' + s.key} x1={sx} y1={sy} x2={cx} y2={cy} colour={c} opacity={dim ? 0.08 : on ? 0.9 : 0.35} />;
          })}
          {sel ? sel.links.map((l, k) => {
            const i = stars.indexOf(sel); const p = pos(i);
            // Fan the connections out below the star, clear of its own label.
            const base = [0.55, 1.0, 1.45][k] ?? 1.2;
            const ang = p.x > W / 2 ? Math.PI - base : base;
            const lx = Math.min(W - 150, Math.max(8, p.x + 8 + Math.cos(ang) * 175)), ly = Math.min(stageH - 30, Math.max(10, p.y + 8 + Math.sin(ang) * 175));
            return (
              <View key={'s' + k} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} pointerEvents="none">
                <Beam x1={p.x + 8} y1={p.y + 8} x2={lx} y2={ly} colour={AREA[l.area].colour} opacity={0.9} />
                <View style={{ position: 'absolute', left: lx - 5, top: ly - 5, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 10, height: 10 }}><Glow colour={AREA[l.area].colour} size={10} /></View>
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700', maxWidth: 150, backgroundColor: 'rgba(10,8,32,0.82)', borderRadius: 10, paddingVertical: 4, paddingHorizontal: 8, overflow: 'hidden', borderWidth: 1, borderColor: AREA[l.area].colour + '77' }}>{l.text}</Text>
                </View>
              </View>
            );
          }) : null}
          {stars.map((s, i) => {
            const p = pos(i); const c = AREA[s.area].colour; const on = focus === s.key; const dim = !!focus && !on;
            return (
              <Pressable key={s.key} onPress={() => setFocus(on ? null : s.key)} accessibilityRole="button" accessibilityLabel={s.title}
                style={{ position: 'absolute', left: p.x, top: p.y, flexDirection: 'row', alignItems: 'flex-start', gap: 8, opacity: dim ? 0.3 : 1, maxWidth: 160 }}>
                <Pulse colour={c} size={s.size} on={on} strong={s.area === 'money'} delay={i * 350} />
                <View style={{ flexShrink: 1, backgroundColor: 'rgba(10,8,32,0.78)', borderRadius: 12, paddingVertical: 6, paddingHorizontal: 9, borderWidth: 1, borderColor: c + '66' }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '800' }}>{s.title}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 11.5, marginTop: 1 }} numberOfLines={2}>{s.sub}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {sel ? (
          <View style={{ marginHorizontal: 16, marginTop: 6, padding: 18, borderRadius: 22, backgroundColor: 'rgba(20,16,52,0.85)', borderWidth: 1, borderColor: AREA[sel.area].colour + '99', shadowColor: AREA[sel.area].colour, shadowOpacity: 0.6, shadowRadius: 26 }}>
            <Text style={{ color: AREA[sel.area].colour, fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>{AREA[sel.area].name.toUpperCase()}</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 28, marginTop: 4, fontFamily: 'InstrumentSerif_400Regular' }}>{sel.title}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 2 }}>{sel.sub}</Text>
            {sel.action ? (
              <Pressable accessibilityRole="button" style={{ marginTop: 16, alignSelf: 'flex-start', backgroundColor: AREA[sel.area].colour, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 20, shadowColor: AREA[sel.area].colour, shadowOpacity: 0.8, shadowRadius: 16 }}>
                <Text style={{ color: '#0C0A24', fontWeight: '800', fontSize: 15 }}>{sel.action}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
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
