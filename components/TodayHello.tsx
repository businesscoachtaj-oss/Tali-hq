// Today's top card, calm version (9 Nov 2026, from Tali's Tuesday list: "remove the banners and
// keep the home screen calm"). A plain white card instead of the big purple banner: the greeting,
// Tali's one line reading the page for you, the brief button and her level as a small chip.
// Night mode (after the shutdown) still uses TodayHero's night sky.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { TaliAvatar } from '@/components/TaliAvatar';
import { taliLevel, type Level } from '@/lib/level';
import { registerTarget } from '@/lib/tourTargets';
import { colours, elevation, space } from '@/constants/theme';

export function TodayHello({ greeting, sub, hello, briefLabel, onBrief }: {
  greeting: string;
  sub?: string | null;
  hello: string;
  briefLabel?: string | null;
  onBrief?: () => void;
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

  return (
    <View style={s.card}>
      <View style={s.row}>
        <TaliAvatar pose="idle" size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.greeting}>{greeting}</Text>
          {sub ? <Text style={s.sub}>{sub}</Text> : null}
          <Text style={s.hello}>{hello}</Text>
        </View>
      </View>
      <View style={s.footer}>
        {level ? (
          <View ref={levelRef} collapsable={false} style={s.level} accessible accessibilityLabel={`Tali's level ${level.level}, ${level.name}, ${level.xp} XP`}>
            <View style={s.badge}><Text style={s.badgeNum}>{level.level}</Text></View>
            <Text style={s.levelName}>{level.name}</Text>
          </View>
        ) : <View />}
        {briefLabel && onBrief ? (
          <Pressable onPress={onBrief} accessibilityRole="button" style={s.brief}>
            <Text style={s.briefText}>{briefLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colours.surface, borderRadius: 18, padding: space.lg, marginBottom: space.md, ...elevation.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  greeting: { fontSize: 22, fontWeight: '800', color: colours.text, letterSpacing: -0.3 },
  sub: { fontSize: 13, color: colours.muted },
  hello: { fontSize: 15, lineHeight: 21, color: colours.muted, marginTop: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.md, gap: space.sm },
  level: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colours.purpleSoft, borderRadius: 999, paddingVertical: 5, paddingLeft: 5, paddingRight: 12 },
  badge: { width: 24, height: 24, borderRadius: 12, backgroundColor: colours.purple, alignItems: 'center', justifyContent: 'center' },
  badgeNum: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  levelName: { fontSize: 13, fontWeight: '700', color: colours.purpleInk },
  brief: { borderWidth: 1, borderColor: colours.borderStrong, backgroundColor: colours.surface, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center', ...elevation.lift },
  briefText: { fontSize: 13, fontWeight: '800', color: colours.purple },
});
