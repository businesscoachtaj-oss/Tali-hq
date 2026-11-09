// The night sky (4 Nov 2026). Pulled out of sleep.tsx so Today can wear the same look once the day
// is shut down. A dark blue gradient with a fixed scatter of small stars, the same every render so
// nothing twinkles. `Sky` fills the screen (Sleep); `NightBackground` sits behind a card (Today's hero).
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSkyBlend } from '@/lib/sky';

export const night = {
  ink: '#EEE9FF',
  muted: 'rgba(238,233,255,0.68)',
  faint: 'rgba(238,233,255,0.42)',
  glass: 'rgba(255,255,255,0.08)',
  line: 'rgba(255,255,255,0.14)',
  accent: '#B9A6FF',
  accent2: '#7FD1FF',
  sky: ['#2A1F4F', '#1B2450', '#0E1633'] as const,
  black: '#05070F',
};

type Star = { x: number; y: number; r: number; o: number };

function makeStars(n: number, seed: number): Star[] {
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  return Array.from({ length: n }, () => ({ x: rnd() * 100, y: rnd() * 100, r: rnd() < 0.25 ? 3 : 2, o: 0.25 + rnd() * 0.5 }));
}
const STARS = makeStars(70, 7);
const CARD_STARS = makeStars(28, 11);

export function Stars({ stars = STARS }: { stars?: Star[] }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((st, i) => (
        <View key={i} style={{ position: 'absolute', left: `${st.x}%`, top: `${st.y}%`, width: st.r, height: st.r, borderRadius: st.r / 2, backgroundColor: '#fff', opacity: st.o }} />
      ))}
    </View>
  );
}

/** Full screen sky. `dark` is the dimmed player: near black, no stars. */
export function Sky({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: night.sky[1] }}>
      <LinearGradient colors={dark ? [night.black, night.black] : [...night.sky]} style={StyleSheet.absoluteFill} />
      {dark ? null : <Stars />}
      {children}
    </View>
  );
}

/** The same sky behind one card. Pass the card's radius through `style` so the stars are clipped to it. */
export function NightBackground({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, style]} pointerEvents="none">
      <LinearGradient colors={[...night.sky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Stars stars={CARD_STARS} />
    </View>
  );
}

// The sky behind a whole page (10 Nov 2026). Lighter through the day, fading into the night sky above
// as shut-off gets close (see lib/sky.ts). The stars come out as it darkens.
export const daySky = ['#8A6CF5', '#5F7FF0', '#4BA6DE'] as const;
export function PageSky({ style }: { style?: StyleProp<ViewStyle> }) {
  const blend = useSkyBlend();
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, style]} pointerEvents="none">
      <LinearGradient colors={[...night.sky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {blend < 1 ? <LinearGradient colors={[...daySky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { opacity: 1 - blend }]} /> : null}
      <View style={[StyleSheet.absoluteFill, { opacity: 0.35 + 0.65 * blend }]}><Stars stars={CARD_STARS} /></View>
    </View>
  );
}
