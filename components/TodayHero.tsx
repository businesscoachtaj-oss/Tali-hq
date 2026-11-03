// Today's top card (MOCKUP, 3 Nov 2026, not shipped). Replaces the plain greeting and Tali's
// bubble with one card: the greeting, Tali reading the page for you, and Tali's level.
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { TaliAvatar } from '@/components/TaliAvatar';
import { taliLevel, type Level } from '@/lib/level';
import { colours, elevation, space } from '@/constants/theme';

export function TodayHero({ greeting, sub, hello }: { greeting: string; sub?: string | null; hello: string }) {
  const [level, setLevel] = useState<Level | null>(null);
  useFocusEffect(
    useCallback(() => {
      taliLevel().then(setLevel).catch(() => setLevel(null));
    }, []),
  );

  return (
    <LinearGradient colors={['#4A2160', colours.purple, '#8A4A9E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={h.card}>
      <Text style={h.greeting}>{greeting}</Text>
      {sub ? <Text style={h.sub}>{sub}</Text> : null}

      <View style={h.hello}>
        <TaliAvatar pose="idle" size={58} />
        <View style={h.bubble}>
          <Text style={h.bubbleText}>{hello}</Text>
        </View>
      </View>

      {level ? (
        <Pressable onPress={() => router.navigate('/me')} accessibilityRole="button" style={h.level}>
          <View style={h.levelTop}>
            <View style={h.badge}>
              <Text style={h.badgeNum}>{level.level}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={h.levelLabel}>TALI'S LEVEL</Text>
              <Text style={h.levelName}>{level.name}</Text>
            </View>
            <Text style={h.xp}>{level.xp} XP</Text>
          </View>
          <View style={h.bar}>
            <LinearGradient colors={[colours.orange, '#F6B04C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[h.fill, { width: `${Math.max(4, Math.round(level.progress * 100))}%` }]} />
          </View>
          {level.next ? <Text style={h.next}>{level.toNext} XP to {level.next}</Text> : null}
          <View style={h.chips}>
            <Chip n={level.counts.memories} label="things she knows" />
            <Chip n={level.counts.night_school} label="study nights" />
            <Chip n={level.counts.jobs_done} label="jobs done" />
          </View>
        </Pressable>
      ) : null}
    </LinearGradient>
  );
}

function Chip({ n, label }: { n: number; label: string }) {
  return (
    <View style={h.chip}>
      <Text style={h.chipN}>{n}</Text>
      <Text style={h.chipL}>{label}</Text>
    </View>
  );
}

const h = StyleSheet.create({
  card: { borderRadius: 22, padding: space.lg, paddingTop: space.xl, marginBottom: space.lg, ...elevation.card, shadowOpacity: 0.18 },
  greeting: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  sub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  hello: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginTop: space.md },
  bubble: { flex: 1, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 16, borderBottomLeftRadius: 4, padding: space.md },
  bubbleText: { color: '#FFFFFF', fontSize: 15, lineHeight: 21 },
  level: { marginTop: space.lg, backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 16, padding: space.md },
  levelTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badge: { width: 42, height: 42, borderRadius: 21, backgroundColor: colours.orange, alignItems: 'center', justifyContent: 'center', ...elevation.button(colours.orange) },
  badgeNum: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  levelLabel: { color: '#F6B04C', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  levelName: { color: '#FFFFFF', fontSize: 19, fontWeight: '800', marginTop: 1 },
  xp: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '700' },
  bar: { height: 8, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 4, marginTop: space.md, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  next: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 6 },
  chips: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  chip: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingVertical: space.sm, paddingHorizontal: space.sm },
  chipN: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  chipL: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 1 },
});
