// 9 Nov 2026 concept: Your world as constellations. Each part of your life is a cluster of stars, one star
// per thing she knows, so the parts she knows best are the brightest and biggest. Tap one to go in.
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { NightBackground } from '@/components/NightSky';
import { Aurora } from '@/components/Aurora';
import { myBrain, type Brain } from '@/lib/brain';
import { NO_BOTTOM } from '@/constants/theme';

const CLUSTERS = [
  { name: 'People', colour: '#5CF2C0', kinds: ['person', 'client', 'lead'], to: '/clients', at: [0.0, 0.0], base: 40, line: 'Clients, leads, Mum, May' },
  { name: 'Work', colour: '#7FA8FF', kinds: ['fact', 'note', 'email', 'skill'], to: '/invoices', at: [1.0, 0.2], base: 52, line: 'Invoices, email, money, rules' },
  { name: 'Health', colour: '#FF7EB6', kinds: ['event'], to: '/life', at: [0.0, 0.42], base: 12, line: 'Training, food, sleep' },
  { name: 'Growth', colour: '#FFE066', kinds: ['idea', 'plan', 'goal', 'decision'], to: '/goals', at: [1.0, 0.62], base: 20, line: 'Goals, ideas, decisions' },
  { name: 'Your words', colour: '#D7B5FF', kinds: ['journal', 'lesson', 'mistake'], to: '/journal', at: [0.25, 0.86], base: 14, line: 'Journal, notes, lessons' },
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

export default function WorldSpace() {
  const { width } = useWindowDimensions();
  const W = Math.min(width, 640);
  const [brain, setBrain] = useState<Brain | null>(null);
  useFocusEffect(useCallback(() => { myBrain('mine').then(setBrain).catch(() => {}); }, []));
  const items = brain?.regions.flatMap((r) => r.items) ?? [];
  const H = 1020;
  const centre = (c: (typeof CLUSTERS)[number]) => ({ x: 70 + c.at[0] * (W - 200), y: 70 + c.at[1] * (H - 160) });
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#07061A' }} edges={NO_BOTTOM}>
      <NightBackground />
      <Aurora />
      <ScrollView>
        <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
          <Text style={{ color: '#B9A6FF', fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>YOUR WORLD</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 38, lineHeight: 42, marginTop: 6, fontFamily: 'InstrumentSerif_400Regular' }}>Everything she looks after, as she sees it.</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 8 }}>Each star is something she knows. The brighter the cluster, the better she knows that part of your life.</Text>
        </View>
        <View style={{ height: H }}>
          {CLUSTERS.map((c, i) => {
            const k = centre(c); const nxt = CLUSTERS[(i + 1) % CLUSTERS.length]; const n2 = centre(nxt);
            const len = Math.hypot(n2.x - k.x, n2.y - k.y), ang = Math.atan2(n2.y - k.y, n2.x - k.x);
            return <View key={'l' + i} pointerEvents="none" style={{ position: 'absolute', left: (k.x + n2.x) / 2 - len / 2, top: (k.y + n2.y) / 2, width: len, height: 1, backgroundColor: 'rgba(214,200,255,0.18)', transform: [{ rotate: `${ang}rad` }] }} />;
          })}
          {CLUSTERS.map((c, i) => {
            const k = centre(c);
            const known = items.filter((it) => (c.kinds as readonly string[]).includes(it.kind)).length;
            const count = c.base + known;
            const dots = scatter(i * 97 + 13, Math.min(46, 10 + count));
            return (
              <Pressable key={c.name} onPress={() => router.navigate(c.to as any)} accessibilityRole="button" accessibilityLabel={c.name}
                style={{ position: 'absolute', left: k.x - 90, top: k.y - 70, width: 180, height: 200 }}>
                <View style={{ position: 'absolute', left: 30, top: 10, width: 120, height: 120, borderRadius: 60, backgroundColor: c.colour, opacity: 0.16, shadowColor: c.colour, shadowOpacity: 1, shadowRadius: 40 }} />
                {dots.map((d, j) => (
                  <View key={j} style={{ position: 'absolute', left: 90 + d.x - d.r / 2, top: 70 + d.y - d.r / 2, width: d.r, height: d.r, borderRadius: d.r, backgroundColor: c.colour, shadowColor: c.colour, shadowOpacity: 1, shadowRadius: 6, opacity: 0.6 + (j % 3) * 0.15 }} />
                ))}
                <View style={{ position: 'absolute', left: 0, right: 0, top: 138, alignItems: 'center' }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 24, fontFamily: 'InstrumentSerif_400Regular', textShadowColor: c.colour, textShadowRadius: 12 }}>{c.name}</Text>
                  <Text style={{ color: c.colour, fontSize: 12, fontWeight: '800' }}>{count} things</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11.5, marginTop: 2 }}>{c.line}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
