// 9 Nov 2026 concept: Your world as constellations. Each part of your life is a cluster of stars, one star
// per thing she knows, so the parts she knows best are the brightest and biggest. Tap one to go in.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { NightBackground } from '@/components/NightSky';
import { Aurora } from '@/components/Aurora';
import { myBrain, type Brain } from '@/lib/brain';
import { NO_BOTTOM } from '@/constants/theme';

const CLUSTERS = [
  { name: 'People', colour: '#5CF2C0', kinds: ['person', 'client', 'lead'], to: '/clients', at: [0.0, 0.0], line: 'Clients, leads, Mum, May' },
  { name: 'Work', colour: '#7FA8FF', kinds: ['fact', 'note', 'email', 'skill'], to: '/invoices', at: [1.0, 0.2], line: 'Invoices, email, money, rules' },
  { name: 'Health', colour: '#FF7EB6', kinds: ['event'], to: '/life', at: [0.0, 0.42], line: 'Training, food, sleep' },
  { name: 'Growth', colour: '#FFE066', kinds: ['idea', 'plan', 'goal', 'decision'], to: '/goals', at: [1.0, 0.62], line: 'Goals, ideas, decisions' },
  { name: 'Your words', colour: '#D7B5FF', kinds: ['journal', 'lesson', 'mistake'], to: '/journal', at: [0.25, 0.86], line: 'Journal, notes, lessons' },
] as const;

// Same scatter every time for a cluster, so it looks like a real constellation.
function scatter(seed: number, n: number) {
  const out: { x: number; y: number; r: number }[] = [];
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 52;
    out.push({ x: Math.cos(a) * d * 1.3, y: Math.sin(a) * d, r: 2 + rnd() * 4 });
  }
  return out;
}

// The map itself, so Your world (the tab) can show it above the list (10 Nov 2026).
export function WorldMap() {
  const { width } = useWindowDimensions();
  const W = Math.min(width, 640);
  const [brain, setBrain] = useState<Brain | null>(null);
  useFocusEffect(useCallback(() => { myBrain('mine').then(setBrain).catch(() => {}); }, []));
  const items = brain?.regions.flatMap((r) => r.items) ?? [];
  const H = 1020;
  const centre = (c: (typeof CLUSTERS)[number]) => ({ x: 70 + c.at[0] * (W - 200), y: 70 + c.at[1] * (H - 160) });
  return (
    <View style={{ height: H, width: W, alignSelf: 'center' }}>
          {CLUSTERS.map((c, i) => {
            const k = centre(c); const nxt = CLUSTERS[(i + 1) % CLUSTERS.length]; const n2 = centre(nxt);
            const len = Math.hypot(n2.x - k.x, n2.y - k.y), ang = Math.atan2(n2.y - k.y, n2.x - k.x);
            return <View key={'l' + i} pointerEvents="none" style={{ position: 'absolute', left: (k.x + n2.x) / 2 - len / 2, top: (k.y + n2.y) / 2, width: len, height: 1, backgroundColor: 'rgba(214,200,255,0.18)', transform: [{ rotate: `${ang}rad` }] }} />;
          })}
          {CLUSTERS.map((c, i) => {
            const k = centre(c);
            const known = items.filter((it) => (c.kinds as readonly string[]).includes(it.kind)).length;
            const count = known;
            return (
              <Pressable key={c.name} onPress={() => router.navigate(c.to as any)} accessibilityRole="button" accessibilityLabel={c.name}
                style={{ position: 'absolute', left: k.x - 90, top: k.y - 70, width: 180, height: 200 }}>
                <View style={{ position: 'absolute', left: 30, top: 10, width: 120, height: 120, borderRadius: 60, backgroundColor: c.colour, opacity: 0.16, shadowColor: c.colour, shadowOpacity: 1, shadowRadius: 40 }} />
                <View style={{ position: 'absolute', left: 20, top: 0, width: 140, height: 140 }}>
                  <Form kind={c.name} colour={c.colour} n={Math.min(40, 10 + count * 3)} />
                </View>
                <View style={{ position: 'absolute', left: 0, right: 0, top: 138, alignItems: 'center' }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 24, fontFamily: 'InstrumentSerif_400Regular', textShadowColor: c.colour, textShadowRadius: 12 }}>{c.name}</Text>
                  <Text style={{ color: c.colour, fontSize: 12, fontWeight: '800' }}>{count ? `${count} ${count === 1 ? 'thing' : 'things'} she knows` : 'Nothing yet'}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11.5, marginTop: 2 }}>{c.line}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
  );
}

// Each part of your life has its own shape and its own movement, so you can tell them apart at a glance.
//  People: a living network, friends orbiting and linked.   Work: an ordered grid, lighting up like activity.
//  Health: a breathing ring, like a heartbeat.               Growth: a spiral galaxy, turning outward.
//  Your words: fireflies drifting up, like thoughts.
function useLoop(ms: number) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.linear, useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, [v, ms]);
  return v;
}
function Dot({ x, y, r, colour, opacity = 1 }: { x: number; y: number; r: number; colour: string; opacity?: number }) {
  return <View style={{ position: 'absolute', left: x - r / 2, top: y - r / 2, width: r, height: r, borderRadius: r, backgroundColor: colour, opacity, shadowColor: colour, shadowOpacity: 1, shadowRadius: 6 }} />;
}
function Link({ x1, y1, x2, y2, colour }: { x1: number; y1: number; x2: number; y2: number; colour: string }) {
  const len = Math.hypot(x2 - x1, y2 - y1), ang = Math.atan2(y2 - y1, x2 - x1);
  return <View style={{ position: 'absolute', left: (x1 + x2) / 2 - len / 2, top: (y1 + y2) / 2, width: len, height: 1, backgroundColor: colour, opacity: 0.45, transform: [{ rotate: `${ang}rad` }] }} />;
}

function Form({ kind, colour, n }: { kind: string; colour: string; n: number }) {
  const spin = useLoop(kind === 'Growth' ? 26000 : 40000);
  const beat = useLoop(kind === 'Health' ? 1800 : 3000);
  const C = 70;
  if (kind === 'People') {
    const pts = useMemo(() => scatter(7, Math.min(n, 18)).map((p) => ({ x: C + p.x * 0.9, y: C + p.y * 1.1, r: p.r + 2 })), [n]);
    const rot = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    return (
      <Animated.View style={{ position: 'absolute', width: 140, height: 140, transform: [{ rotate: rot }] }}>
        {pts.map((p, i) => i ? <Link key={'l' + i} x1={pts[i - 1].x} y1={pts[i - 1].y} x2={p.x} y2={p.y} colour={colour} /> : null)}
        {pts.map((p, i) => i % 3 === 0 ? <Link key={'c' + i} x1={C} y1={C} x2={p.x} y2={p.y} colour={colour} /> : null)}
        {pts.map((p, i) => <Dot key={i} x={p.x} y={p.y} r={p.r} colour={colour} />)}
        <Dot x={C} y={C} r={12} colour="#FFFFFF" />
      </Animated.View>
    );
  }
  if (kind === 'Work') {
    const cells: { x: number; y: number; on: boolean }[] = [];
    for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) cells.push({ x: 22 + c * 19, y: 22 + r * 19, on: (r * 7 + c * 3) % 5 < 2 });
    const glow = beat.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 1, 0.35] });
    return (
      <View style={{ position: 'absolute', width: 140, height: 140, transform: [{ rotate: '-12deg' }] }}>
        {cells.map((c, i) => c.on ? (
          <Animated.View key={i} style={{ position: 'absolute', left: c.x, top: c.y, width: 11, height: 11, borderRadius: 3, backgroundColor: colour, opacity: glow, shadowColor: colour, shadowOpacity: 1, shadowRadius: 8 }} />
        ) : (
          <View key={i} style={{ position: 'absolute', left: c.x + 3, top: c.y + 3, width: 5, height: 5, borderRadius: 1, backgroundColor: colour, opacity: 0.35 }} />
        ))}
      </View>
    );
  }
  if (kind === 'Health') {
    const scale = beat.interpolate({ inputRange: [0, 0.15, 0.3, 1], outputRange: [1, 1.14, 1, 1] });
    const ring = Array.from({ length: Math.max(14, n) }, (_, i) => { const a = (i / Math.max(14, n)) * Math.PI * 2; return { x: C + Math.cos(a) * 46, y: C + Math.sin(a) * 46 }; });
    return (
      <Animated.View style={{ position: 'absolute', width: 140, height: 140, transform: [{ scale }] }}>
        <View style={{ position: 'absolute', left: C - 46, top: C - 46, width: 92, height: 92, borderRadius: 46, borderWidth: 1, borderColor: colour, opacity: 0.4 }} />
        {ring.map((p, i) => <Dot key={i} x={p.x} y={p.y} r={i % 4 === 0 ? 7 : 4} colour={colour} />)}
        <Dot x={C} y={C} r={16} colour={colour} />
      </Animated.View>
    );
  }
  if (kind === 'Growth') {
    const rot = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    const arms = Array.from({ length: Math.max(24, n * 2) }, (_, i) => { const t = i / 4; const a = t * 0.9 + (i % 2) * Math.PI; const d = 6 + t * 5; return { x: C + Math.cos(a) * d, y: C + Math.sin(a) * d, r: 2 + (i % 5) }; }).filter((p) => Math.hypot(p.x - C, p.y - C) < 66);
    return (
      <Animated.View style={{ position: 'absolute', width: 140, height: 140, transform: [{ rotate: rot }] }}>
        {arms.map((p, i) => <Dot key={i} x={p.x} y={p.y} r={p.r} colour={colour} opacity={0.5 + (i % 3) * 0.2} />)}
        <Dot x={C} y={C} r={14} colour="#FFFFFF" />
      </Animated.View>
    );
  }
  // Your words: fireflies drifting upward, each on its own rhythm.
  const flies = useMemo(() => scatter(31, Math.min(n, 16)), [n]);
  return (
    <View style={{ position: 'absolute', width: 140, height: 140 }}>
      {flies.map((f, i) => <Firefly key={i} x={C + f.x} y={C + f.y} r={f.r + 1} colour={colour} delay={i * 260} />)}
    </View>
  );
}

function Firefly({ x, y, r, colour, delay }: { x: number; y: number; r: number; colour: string; delay: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([Animated.delay(delay), Animated.timing(v, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }), Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true })]));
    a.start();
    return () => a.stop();
  }, [v, delay]);
  const ty = v.interpolate({ inputRange: [0, 1], outputRange: [12, -22] });
  const op = v.interpolate({ inputRange: [0, 0.3, 0.8, 1], outputRange: [0, 1, 0.8, 0] });
  return <Animated.View style={{ position: 'absolute', left: x - r / 2, top: y - r / 2, width: r, height: r, borderRadius: r, backgroundColor: colour, shadowColor: colour, shadowOpacity: 1, shadowRadius: 8, opacity: op, transform: [{ translateY: ty }] }} />;
}
