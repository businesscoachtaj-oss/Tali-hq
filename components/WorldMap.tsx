// 9 Nov 2026 concept: Your world as constellations. Each part of your life is a cluster of stars, one star
// per thing she knows, so the parts she knows best are the brightest and biggest. Tap one to go in.
// 11 Nov 2026 (Taj: "could we make all the icons 3d... still looking the same"): the same shapes and
// movements, now with depth, and a sixth part, Home and money (a tide of stars that fills and drains).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import Reanimated, { Easing as REasing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { router, useFocusEffect } from 'expo-router';
import { myBrain, type Brain } from '@/lib/brain';

const CLUSTERS = [
  { name: 'People', colour: '#5CF2C0', kinds: ['person', 'client', 'lead'], to: '/clients', at: [0.0, 0.0], line: 'Family, friends, clients' },
  { name: 'Work', colour: '#7FA8FF', kinds: ['fact', 'note', 'email', 'skill'], to: '/invoices', at: [1.0, 0.17], line: 'Email, money, to do, rules' },
  { name: 'Health', colour: '#FF7EB6', kinds: ['event'], to: '/life', at: [0.0, 0.35], line: 'Training, food, sleep, headspace' },
  { name: 'Home and money', colour: '#5CD9FF', kinds: [], to: '/money?side=personal', at: [1.0, 0.52], line: 'Spending, bills, life admin' },
  { name: 'Growth', colour: '#FFE066', kinds: ['idea', 'plan', 'goal', 'decision'], to: '/goals', at: [0.0, 0.7], line: 'Goals, habits, learning, wins' },
  { name: 'Your words', colour: '#D7B5FF', kinds: ['journal', 'lesson', 'mistake'], to: '/journal', at: [0.75, 0.88], line: 'Journal, notes, ideas' },
] as const;

// The map itself, so Your world (the tab) can show it above the list (10 Nov 2026).
// Home and money is not made of memories, so its count is what she is tracking there (passed in).
export function WorldMap({ homeCount = 0, workTo }: { homeCount?: number; workTo?: string }) {
  const { width } = useWindowDimensions();
  const W = Math.min(width, 640);
  const [brain, setBrain] = useState<Brain | null>(null);
  useFocusEffect(useCallback(() => { myBrain('mine').then(setBrain).catch(() => {}); }, []));
  const items = brain?.regions.flatMap((r) => r.items) ?? [];
  const H = 1250;
  const centre = (c: (typeof CLUSTERS)[number]) => ({ x: 100 + c.at[0] * (W - 200), y: 70 + c.at[1] * (H - 160) });
  return (
    <View style={{ height: H, width: W, alignSelf: 'center' }}>
      {CLUSTERS.map((c, i) => {
        if (i === CLUSTERS.length - 1) return null;
        const k = centre(c); const n2 = centre(CLUSTERS[i + 1]);
        const len = Math.hypot(n2.x - k.x, n2.y - k.y), ang = Math.atan2(n2.y - k.y, n2.x - k.x);
        return <View key={'l' + i} pointerEvents="none" style={{ position: 'absolute', left: (k.x + n2.x) / 2 - len / 2, top: (k.y + n2.y) / 2, width: len, height: 1, backgroundColor: 'rgba(214,200,255,0.18)', transform: [{ rotate: `${ang}rad` }] }} />;
      })}
      {CLUSTERS.map((c) => {
        const k = centre(c);
        const home = c.name === 'Home and money';
        const count = home ? homeCount : items.filter((it) => (c.kinds as readonly string[]).includes(it.kind)).length;
        const to = c.name === 'Work' && workTo ? workTo : c.to;
        return (
          <Pressable key={c.name} onPress={() => router.navigate(to as any)} accessibilityRole="button" accessibilityLabel={c.name}
            style={{ position: 'absolute', left: k.x - 90, top: k.y - 70, width: 180, height: 200 }}>
            <View style={{ position: 'absolute', left: 30, top: 10, width: 120, height: 120, borderRadius: 60, backgroundColor: c.colour, opacity: 0.16, shadowColor: c.colour, shadowOpacity: 1, shadowRadius: 40 }} />
            <View style={{ position: 'absolute', left: 20, top: 0, width: 140, height: 140 }}>
              <Form kind={c.name} colour={c.colour} n={Math.min(40, 10 + count * 3)} />
            </View>
            <View style={{ position: 'absolute', left: 0, right: 0, top: 138, alignItems: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontSize: 24, fontFamily: 'InstrumentSerif_400Regular', textShadowColor: c.colour, textShadowRadius: 12, textAlign: 'center' }}>{c.name}</Text>
              <Text style={{ color: c.colour, fontSize: 12, fontWeight: '800' }}>{count ? `${count} ${count === 1 ? 'thing' : 'things'} ${home ? 'she is tracking' : 'she knows'}` : 'Nothing yet'}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11.5, marginTop: 2 }}>{c.line}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// Each part of your life has its own shape and its own movement, so you can tell them apart at a glance.
//  People: a living network on a globe, swaying.        Work: a board lying back, cells lighting up.
//  Health: a beating core inside two tilted rings.      Home and money: a tide that fills and drains.
//  Growth: a spiral galaxy seen on a tilt, turning.     Your words: fireflies rising through a space.
// 10 Nov 2026 (Taj: "work and health aren't moving anymore" on his phone): the shapes move with
// Reanimated on the UI thread, the same way her brain does. Each shape only starts the movement it uses.
// 11 Nov 2026, later (Taj's screen recording: whole chunks of the map blinking out on Android): no
// view here uses a perspective transform any more (the Work board was the only one, and the only
// thing on this map her brain does not also do), and stars no longer change their stacking order
// every frame. Only plain moves, turns, scales and opacity are animated.
// 11 Nov 2026: depth. Every star is placed from its own x, y, z each frame. The Work board is one
// flat view, squashed and turned.
const C = 70;
const F = 230; // how far away the eye is: smaller is a stronger perspective
const TAU = Math.PI * 2;
type P3 = readonly [number, number, number];

// 0 to 1, over and over.
function useLoop(ms: number) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = 0;
    v.value = withRepeat(withTiming(1, { duration: ms, easing: REasing.linear }), -1, false);
    return () => cancelAnimation(v);
  }, [v, ms]);
  return v;
}
// A heartbeat: a quick swell, back down, then a rest.
function useBeat() {
  const v = useSharedValue(1);
  useEffect(() => {
    v.value = withRepeat(withSequence(withTiming(1.14, { duration: 260, easing: REasing.out(REasing.quad) }), withTiming(1, { duration: 300, easing: REasing.in(REasing.quad) }), withDelay(1240, withTiming(1, { duration: 0 }))), -1, false);
    return () => cancelAnimation(v);
  }, [v]);
  return useAnimatedStyle(() => ({ transform: [{ scale: v.value }] }));
}
// A slow glow that goes up and comes back, offset so two groups of cells take turns. Lit cells also
// swell a little, so they read as lifting off the board.
function useGlow(offset: number) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(offset, withRepeat(withTiming(1, { duration: 1500, easing: REasing.inOut(REasing.sin) }), -1, true));
    return () => cancelAnimation(v);
  }, [v, offset]);
  return useAnimatedStyle(() => ({ opacity: 0.3 + 0.7 * v.value, transform: [{ scale: 1 + 0.3 * v.value }] }));
}

// Turn a point about the upright axis (yaw) and tip it (pitch), then shrink it with distance.
function project(x: number, y: number, z: number, yaw: number, pitch: number) {
  'worklet';
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
  const s = F / (F + z2);
  return { x: x1 * s, y: y2 * s, s, z: z2 };
}
function depthFade(z: number) {
  'worklet';
  return Math.max(0.25, Math.min(1, 0.62 - z / 110));
}

const star = (r: number, colour: string) => ({ position: 'absolute' as const, left: C - r / 2, top: C - r / 2, width: r, height: r, borderRadius: r, backgroundColor: colour, shadowColor: colour, shadowOpacity: 1, shadowRadius: 6 });

function Form({ kind, colour, n }: { kind: string; colour: string; n: number }) {
  if (kind === 'People') return <PeopleForm colour={colour} n={n} />;
  if (kind === 'Work') return <WorkForm colour={colour} />;
  if (kind === 'Health') return <HealthForm colour={colour} n={n} />;
  if (kind === 'Home and money') return <TideForm colour={colour} />;
  if (kind === 'Growth') return <GrowthForm colour={colour} n={n} />;
  return <WordsForm colour={colour} n={n} />;
}

// ---------- People: friends around you, spread over a globe that sways ----------
function peopleYaw(t: number) { 'worklet'; return 0.85 * Math.sin(TAU * t); }
function peoplePitch(t: number) { 'worklet'; return 0.3 + 0.14 * Math.cos(TAU * t); }
function PeopleStar({ p, r, colour, t }: { p: P3; r: number; colour: string; t: SharedValue<number> }) {
  const st = useAnimatedStyle(() => {
    const q = project(p[0], p[1], p[2], peopleYaw(t.value), peoplePitch(t.value));
    return { opacity: depthFade(q.z), transform: [{ translateX: q.x }, { translateY: q.y }, { scale: q.s }] };
  });
  return <Reanimated.View style={[star(r, colour), st]} />;
}
// A line between two stars: a fixed 100 wide bar, moved to the midpoint, turned and stretched each frame.
function PeopleLink({ a, b, colour, t }: { a: P3; b: P3; colour: string; t: SharedValue<number> }) {
  const st = useAnimatedStyle(() => {
    const yaw = peopleYaw(t.value), pitch = peoplePitch(t.value);
    const p = project(a[0], a[1], a[2], yaw, pitch), q = project(b[0], b[1], b[2], yaw, pitch);
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    return { opacity: 0.45 * depthFade((p.z + q.z) / 2), transform: [{ translateX: (p.x + q.x) / 2 }, { translateY: (p.y + q.y) / 2 }, { rotate: `${Math.atan2(q.y - p.y, q.x - p.x)}rad` }, { scaleX: Math.max(0.01, len / 100) }] };
  });
  return <Reanimated.View style={[{ position: 'absolute', left: C - 50, top: C, width: 100, height: 1, backgroundColor: colour }, st]} />;
}
function PeopleForm({ colour, n }: { colour: string; n: number }) {
  const t = useLoop(16000);
  const { pts, links } = useMemo(() => {
    const count = Math.max(8, Math.min(n, 14));
    const pts: P3[] = Array.from({ length: count }, (_, i) => {
      const y = 1 - (2 * (i + 0.5)) / count, rad = Math.sqrt(1 - y * y), a = i * 2.39996;
      const d = i % 3 === 0 ? 32 : i % 3 === 1 ? 48 : 41;
      return [Math.cos(a) * rad * d, y * d, Math.sin(a) * rad * d] as const;
    });
    // Each friend is joined to their two nearest.
    const seen = new Set<string>();
    const links: [number, number][] = [];
    pts.forEach((p, i) => {
      pts.map((q, j) => [Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]), j] as const).filter((x) => x[1] !== i).sort((a, b) => a[0] - b[0]).slice(0, 2).forEach(([, j]) => {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (!seen.has(key)) { seen.add(key); links.push([i, j]); }
      });
    });
    return { pts, links };
  }, [n]);
  const you: P3 = [0, 0, 0];
  return (
    <View style={{ position: 'absolute', width: 140, height: 140 }}>
      {links.map(([i, j]) => <PeopleLink key={`l${i}-${j}`} a={pts[i]} b={pts[j]} colour={colour} t={t} />)}
      {pts.map((p, i) => (i % 3 === 0 ? <PeopleLink key={'c' + i} a={you} b={p} colour={colour} t={t} /> : null))}
      {pts.map((p, i) => <PeopleStar key={i} p={p} r={i % 3 === 0 ? 8 : 6} colour={colour} t={t} />)}
      <View style={star(12, '#FFFFFF')} />
    </View>
  );
}

// ---------- Work: an ordered board lying back in space. Two sets of cells light up in turn. ----------
function WorkForm({ colour }: { colour: string }) {
  const glowA = useGlow(0);
  const glowB = useGlow(750);
  const sway = useSharedValue(0);
  useEffect(() => {
    sway.value = withRepeat(withTiming(1, { duration: 7000, easing: REasing.inOut(REasing.sin) }), -1, true);
    return () => cancelAnimation(sway);
  }, [sway]);
  // Lying back without a perspective transform: squashed top to bottom, then turned on the spot.
  // An animated perspective tilt is the likely cause of Android blanking out chunks of the map (11 Nov 2026).
  const board = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.56 }, { rotate: `${-24 + 24 * sway.value}deg` }] }));
  const cells: { x: number; y: number; on: boolean; b: boolean }[] = [];
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) cells.push({ x: 16 + c * 19, y: 16 + r * 19, on: (r * 7 + c * 3) % 5 < 2, b: (r + c) % 2 === 0 });
  return (
    <Reanimated.View style={[{ position: 'absolute', width: 140, height: 140 }, board]}>
      {cells.map((c, i) => c.on ? (
        <Reanimated.View key={i} style={[{ position: 'absolute', left: c.x, top: c.y, width: 12, height: 12, borderRadius: 3, backgroundColor: colour, shadowColor: colour, shadowOpacity: 1, shadowRadius: 6 }, c.b ? glowB : glowA]} />
      ) : (
        <View key={i} style={{ position: 'absolute', left: c.x + 3, top: c.y + 3, width: 6, height: 6, borderRadius: 1.5, backgroundColor: colour, opacity: 0.35 }} />
      ))}
    </Reanimated.View>
  );
}

// ---------- Health: a core that beats like a heart, inside two tilted rings of stars ----------
// Ring 0 lies flat and is tipped towards you; ring 1 stands up and is turned side on. Both turn slowly.
function HealthStar({ a, ring, r, colour, t }: { a: number; ring: 0 | 1; r: number; colour: string; t: SharedValue<number> }) {
  const st = useAnimatedStyle(() => {
    const ang = a + (ring ? -1 : 1) * TAU * t.value;
    const q = ring
      ? project(Math.cos(ang) * 44, Math.sin(ang) * 44, 0, 0.95, 0.2)
      : project(Math.cos(ang) * 46, 0, Math.sin(ang) * 46, 0, -1.15);
    return { opacity: (ring ? 0.6 : 1) * depthFade(q.z), transform: [{ translateX: q.x }, { translateY: q.y }, { scale: q.s }] };
  });
  return <Reanimated.View style={[star(r, colour), st]} />;
}
function HealthForm({ colour, n }: { colour: string; n: number }) {
  const beat = useBeat();
  const t = useLoop(30000);
  const count = Math.max(12, Math.min(n, 16));
  const angles = Array.from({ length: count }, (_, i) => (i / count) * TAU);
  return (
    <Reanimated.View style={[{ position: 'absolute', width: 140, height: 140 }, beat]}>
      {angles.map((a, i) => <HealthStar key={'b' + i} a={a} ring={1} r={i % 4 === 0 ? 6 : 3.5} colour={colour} t={t} />)}
      {angles.map((a, i) => <HealthStar key={'a' + i} a={a} ring={0} r={i % 4 === 0 ? 8 : 5} colour={colour} t={t} />)}
      <View style={star(17, colour)} />
    </Reanimated.View>
  );
}

// ---------- Home and money: a tide of stars inside a globe. It fills, then drains, like a week's money. ----------
function TideStar({ p, colour, t }: { p: P3; colour: string; t: SharedValue<number> }) {
  const st = useAnimatedStyle(() => {
    const v = t.value;
    const level = 0.12 + 0.8 * (0.5 - 0.5 * Math.cos(TAU * v));
    // How high this star sits in the globe (0 at the bottom), with a small ripple along the surface.
    const h = (44 - p[1]) / 88 + 0.035 * Math.sin(TAU * (v * 2 + p[0] / 60 + p[2] / 80));
    const k = Math.max(0, Math.min(1, (level - h) / 0.1 + 0.5));
    const q = project(p[0], p[1], p[2], 0.7 * Math.sin(TAU * v), 0.28);
    return { opacity: (0.12 + 0.88 * k) * depthFade(q.z), transform: [{ translateX: q.x }, { translateY: q.y }, { scale: q.s * (0.45 + 0.55 * k) }] };
  });
  return <Reanimated.View style={[star(7, colour), st]} />;
}
const TIDE: P3[] = (() => {
  const out: P3[] = [];
  const step = 17;
  // A loose lattice: each star is nudged off its spot (the same nudge every time), so the globe
  // never lines up into stripes as it turns.
  let s = 7;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280) - 0.5;
  for (let iy = -3; iy <= 3; iy++) for (let ix = -3; ix <= 3; ix++) for (let iz = -3; iz <= 3; iz++) {
    const x = ix * step + (iy % 2 ? step / 2 : 0) + rnd() * 8, y = iy * step * 0.9 + rnd() * 6, z = iz * step + (iy % 2 ? step / 2 : 0) + rnd() * 8;
    if (Math.hypot(x, y, z) <= 45) out.push([x, y, z]);
  }
  return out;
})();
function TideForm({ colour }: { colour: string }) {
  const t = useLoop(10000);
  return (
    <View style={{ position: 'absolute', width: 140, height: 140 }}>
      <View style={{ position: 'absolute', left: C - 50, top: C - 50, width: 100, height: 100, borderRadius: 50, borderWidth: 1, borderColor: colour, opacity: 0.4 }} />
      {TIDE.map((p, i) => <TideStar key={i} p={p} colour={colour} t={t} />)}
    </View>
  );
}

// ---------- Growth: a spiral galaxy seen on a tilt, turning outward ----------
function GalaxyStar({ a, d, y, r, alpha, colour, t }: { a: number; d: number; y: number; r: number; alpha: number; colour: string; t: SharedValue<number> }) {
  const st = useAnimatedStyle(() => {
    const ang = a + TAU * t.value;
    const q = project(Math.cos(ang) * d, y, Math.sin(ang) * d, 0, -1.0);
    return { opacity: alpha * depthFade(q.z), transform: [{ translateX: q.x }, { translateY: q.y }, { scale: q.s }] };
  });
  return <Reanimated.View style={[star(r, colour), st]} />;
}
function GrowthForm({ colour, n }: { colour: string; n: number }) {
  const t = useLoop(26000);
  // Two arms winding out from the middle. More that she knows means longer arms, up to 44 stars.
  const arms = useMemo(() => Array.from({ length: Math.max(24, Math.min(n * 2, 44)) }, (_, i) => {
    const k = Math.floor(i / 2) / 2.1;
    return { a: k * 0.62 + (i % 2) * Math.PI, d: 7 + k * 5.2, y: ((i * 37) % 7 - 3) * 0.9, r: 3 + (i % 5), alpha: 0.5 + (i % 3) * 0.2 };
  }).filter((p) => p.d < 60), [n]);
  return (
    <View style={{ position: 'absolute', width: 140, height: 140 }}>
      {arms.map((p, i) => <GalaxyStar key={i} {...p} colour={colour} t={t} />)}
      <View style={star(14, '#FFFFFF')} />
    </View>
  );
}

// ---------- Your words: fireflies rising through a space, some close and some far ----------
function Firefly({ p, r, colour, phase, rise, sway }: { p: P3; r: number; colour: string; phase: number; rise: SharedValue<number>; sway: SharedValue<number> }) {
  const st = useAnimatedStyle(() => {
    const u = (rise.value + phase) % 1;
    const glow = u < 0.3 ? u / 0.3 : u < 0.8 ? 1 - ((u - 0.3) / 0.5) * 0.2 : 0.8 * (1 - (u - 0.8) / 0.2);
    const q = project(p[0], p[1] + 14 - 40 * u, p[2], 0.55 * Math.sin(TAU * sway.value), 0.15);
    return { opacity: glow * depthFade(q.z), transform: [{ translateX: q.x }, { translateY: q.y }, { scale: q.s }] };
  });
  return <Reanimated.View style={[star(r, colour), { shadowRadius: 8 }, st]} />;
}
function WordsForm({ colour, n }: { colour: string; n: number }) {
  const rise = useLoop(3600);
  const sway = useLoop(14000);
  const flies = useMemo(() => {
    // The same scatter every time, so it looks like a real constellation.
    let s = 31;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const count = Math.max(8, Math.min(n, 18));
    return Array.from({ length: count }, (_, i) => {
      const a = rnd() * TAU, d = Math.sqrt(rnd()) * 50;
      return { p: [Math.cos(a) * d, (rnd() - 0.5) * 70, Math.sin(a) * d] as const, r: 4 + rnd() * 4, phase: i / count };
    });
  }, [n]);
  return (
    <View style={{ position: 'absolute', width: 140, height: 140 }}>
      {flies.map((f, i) => <Firefly key={i} p={f.p} r={f.r} colour={colour} phase={f.phase} rise={rise} sway={sway} />)}
    </View>
  );
}
