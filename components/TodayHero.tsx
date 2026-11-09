// Today's top card (3 Nov 2026). Replaces the plain greeting and Tali's
// bubble with one card: the greeting, Tali reading the page for you, and Tali's level.
// 4 Nov 2026: night mode. Once the day is shut down the card puts on the Sleep screen's night sky,
// Tali says the day's done, the brief button goes away and the one button is "Sleep sounds".
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { TaliAvatar } from '@/components/TaliAvatar';
import { NightBackground, night as sky } from '@/components/NightSky';
import { taliLevel, type Level } from '@/lib/level';
import { registerTarget } from '@/lib/tourTargets';
import { colours, elevation, space } from '@/constants/theme';

const RADIUS = 22;

export function TodayHero({
  greeting,
  sub,
  hello,
  briefLabel,
  onBrief,
  night,
  nightLine,
}: {
  greeting: string;
  sub?: string | null;
  hello: string;
  briefLabel?: string | null;
  onBrief?: () => void;
  /** The day has been shut down: night sky, "Sleep sounds" button, no brief button. */
  night?: boolean;
  /** Tali's sign off from the shutdown, if she wrote one. */
  nightLine?: string | null;
}) {
  const [level, setLevel] = useState<Level | null>(null);
  const levelRef = useRef<View>(null);
  useEffect(() => {
    registerTarget('level', levelRef);
  }, []);
  useFocusEffect(
    useCallback(() => {
      taliLevel().then(setLevel).catch(() => setLevel(null));
    }, []),
  );

  const n = !!night;
  const line = n ? nightLine?.trim() || "Day's done. Bed time?" : hello;
  const pct = level ? Math.max(4, Math.round(level.progress * 100)) : 0;

  // 9 Nov 2026 look refresh: in the day, Tali stands on the page and talks to you. No purple card,
  // no level (that lives on Brain now). Night mode keeps the night sky card below.
  if (!n) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14, paddingTop: 8, paddingBottom: 6, marginBottom: 14 }}>
        <TaliAvatar pose="wave" size={118} />
        <View style={{ flex: 1, paddingBottom: 10 }}>
          <Text style={{ color: colours.muted, fontSize: 15, fontWeight: '600' }}>{greeting}</Text>
          {sub ? <Text style={{ color: colours.purpleInk, fontSize: 13, marginTop: 2 }}>{sub}</Text> : null}
          <Text style={{ color: colours.text, fontSize: 21, lineHeight: 28, marginTop: 6, fontFamily: 'PlusJakartaSans_700Bold' }}>{line}</Text>
          {briefLabel && onBrief ? (
            <Pressable onPress={onBrief} accessibilityRole="button" style={{ marginTop: 10 }}>
              <Text style={{ color: colours.purple, fontSize: 15, fontWeight: '700' }}>{briefLabel} {'›'}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }
  return (
    <View style={[h.card, n && h.cardNight]}>
      {n ? <NightBackground style={{ borderRadius: RADIUS }} /> : <LinearGradient colors={['#4A2160', colours.purple, '#8A4A9E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: RADIUS }]} />}
      <Text style={[h.greeting, n && { color: sky.ink }]}>{greeting}</Text>
      {sub ? <Text style={[h.sub, n && { color: sky.muted }]}>{sub}</Text> : null}

      <View style={h.hello}>
        <TaliAvatar pose="idle" size={84} />
        <View style={[h.bubble, n && h.bubbleNight]}>
          <Text style={[h.bubbleText, n && { color: sky.ink }]}>{line}</Text>
          {n ? (
            <View style={h.nightRow}>
              {nightLine?.trim() ? <Text style={h.bedTime}>Bed time?</Text> : null}
              <Pressable onPress={() => router.navigate('/sleep')} accessibilityRole="button" style={h.sleepBtn}>
                <LinearGradient colors={[sky.accent, sky.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                <Text style={h.sleepBtnText}>Sleep sounds {'›'}</Text>
              </Pressable>
            </View>
          ) : briefLabel && onBrief ? (
            <Pressable onPress={onBrief} accessibilityRole="button" style={h.briefLink}>
              <Text style={h.briefLinkText}>{briefLabel} {'›'}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {level ? (
        <View ref={levelRef} collapsable={false} style={[h.level, n && h.levelNight]} accessible accessibilityLabel={`Tali's level ${level.level}, ${level.name}, ${level.xp} XP`}>
          <View style={h.levelTop}>
            <View style={[h.badge, n && h.badgeNight]}>
              {n ? <LinearGradient colors={[sky.accent, sky.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 18 }]} /> : null}
              <Text style={[h.badgeNum, n && { color: '#141033' }]}>{level.level}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[h.levelLabel, n && { color: sky.accent }]}>TALI'S LEVEL</Text>
              <Text style={[h.levelName, n && { color: sky.ink }]}>{level.name}</Text>
            </View>
            <Text style={[h.xp, n && { color: sky.muted }]}>{level.xp} XP</Text>
          </View>
          <View style={[h.bar, n && { backgroundColor: sky.line }]}>
            <LinearGradient colors={n ? [sky.accent, sky.accent2] : [colours.orange, '#F6B04C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[h.fill, { width: `${pct}%` }]} />
          </View>
          {level.next ? <Text style={[h.next, n && { color: sky.faint }]}>{level.toNext} XP to {level.next}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const h = StyleSheet.create({
  card: { borderRadius: RADIUS, padding: space.lg, paddingTop: space.xl, marginBottom: space.lg, overflow: 'hidden', backgroundColor: colours.purple, ...elevation.card, shadowOpacity: 0.18 },
  cardNight: { backgroundColor: sky.sky[1], shadowColor: sky.accent2, shadowOpacity: 0.25 },
  greeting: { color: '#FFFFFF', fontSize: 28, letterSpacing: -0.5, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  sub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  hello: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginTop: space.sm },
  bubble: { flex: 1, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 16, borderBottomLeftRadius: 4, padding: space.md },
  bubbleNight: { backgroundColor: sky.glass, borderWidth: 1, borderColor: sky.line },
  bubbleText: { color: '#FFFFFF', fontSize: 15, lineHeight: 21 },
  briefLink: { alignSelf: 'flex-start', marginTop: space.sm, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  briefLinkText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  nightRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  bedTime: { color: sky.muted, fontSize: 13, fontWeight: '700' },
  sleepBtn: { borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14, overflow: 'hidden', shadowColor: sky.accent2, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 4 },
  sleepBtnText: { color: '#141033', fontSize: 13, fontWeight: '800' },
  level: { marginTop: space.md, backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 16, padding: space.md },
  levelNight: { backgroundColor: sky.glass, borderWidth: 1, borderColor: sky.line },
  levelTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badge: { width: 36, height: 36, borderRadius: 18, backgroundColor: colours.orange, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...elevation.button(colours.orange) },
  badgeNight: { backgroundColor: sky.accent, shadowColor: sky.accent },
  badgeNum: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  levelLabel: { color: '#F6B04C', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  levelName: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', marginTop: 1 },
  xp: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '700' },
  bar: { height: 6, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 4, marginTop: space.md, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 4 },
  next: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 6 },
});
