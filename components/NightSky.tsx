// The night sky (4 Nov 2026). Pulled out of sleep.tsx so Today can wear the same look once the day
// is shut down. A dark blue gradient with a fixed scatter of small stars, the same every render so
// nothing twinkles. `Sky` fills the screen (Sleep); `NightBackground` sits behind a card (Today's hero).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
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
// as shut-off gets close (see lib/sky.ts).
//
// DEPTH (10 Nov 2026, Taj: "the background doesn't feel like it has depth", worst by day when the
// stars are gone). The old sky was one smooth diagonal gradient with 28 same-size stars, so nothing
// was in front of anything else. Now it is built in layers, back to front:
//   1. the sky itself, darker overhead and lighter toward the horizon, like real air
//   2. far light: big soft glows of colour, one sitting behind her brain like a light source
//   3. far dust: many tiny faint points
//   4. mid points: fewer, bigger, brighter
//   5. near light: a few large out of focus discs, the way close things blur in a photo
//   6. a vignette, so the edges fall away
// Each layer drifts at its own speed and moves by its own amount when the page scrolls, far things
// least and near things most. That difference is what the eye reads as distance.
// The glows are two small pictures (assets/sky) tinted and stretched, so it looks the same on
// phones and the web with nothing new installed.
export const daySky = ['#24177F', '#3B2FB8', '#3F5FCC', '#5C8BDD'] as const;
const nightDeep = ['#120C2E', '#1B1B4A', '#16224F', '#1C2E63'] as const;

/** Pages feed their scroll position in here so the sky layers can move by different amounts. */
export const skyScroll = new Animated.Value(0);

// FIX (10 Nov 2026): each glow is its own ready-coloured picture. They used to be one white picture
// tinted in code, and on the web a tint is a filter the browser re-draws every time the layer moves.
// With the layers drifting, Android Chrome could not keep up and the whole sky flashed off and on.
const GLOWS = {
  violet: require('@/assets/sky/glow_violet.png'),
  magenta: require('@/assets/sky/glow_magenta.png'),
  teal: require('@/assets/sky/glow_teal.png'),
  pink: require('@/assets/sky/glow_pink.png'),
  white: require('@/assets/sky/glow_white.png'),
};
const BOKEH = require('@/assets/sky/bokeh_lilac.png');

// Positions are % of the screen so every phone gets the same picture. Sizes are points.
const FAR_LIGHT = [
  { x: 50, y: 44, size: 640, glow: 'violet' as const, day: 0.5, night: 0.3 },   // behind her brain
  { x: 4, y: 8, size: 520, glow: 'magenta' as const, day: 0.42, night: 0.3 },
  { x: 98, y: 58, size: 480, glow: 'teal' as const, day: 0.3, night: 0.2 },
  { x: 8, y: 92, size: 460, glow: 'pink' as const, day: 0.24, night: 0.16 },
];
type Dot = { x: number; y: number; r: number; o: number };
function scatter(n: number, seed: number, rMin: number, rMax: number, oMin: number, oMax: number): Dot[] {
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  return Array.from({ length: n }, () => ({ x: rnd() * 100, y: rnd() * 100, r: rMin + rnd() * (rMax - rMin), o: oMin + rnd() * (oMax - oMin) }));
}
const FAR_DUST = scatter(90, 21, 1, 1.8, 0.18, 0.5);
const MID_POINTS = scatter(24, 5, 2.2, 3.4, 0.45, 0.9);
const NEAR_STARS = scatter(7, 33, 12, 22, 0.55, 0.95);
const NEAR_BOKEH = [
  { x: 86, y: 14, size: 96, o: 0.11 }, { x: 10, y: 34, size: 62, o: 0.1 }, { x: 78, y: 78, size: 132, o: 0.08 },
  { x: 22, y: 70, size: 84, o: 0.09 }, { x: 60, y: 96, size: 70, o: 0.1 }, { x: 40, y: 6, size: 48, o: 0.12 },
];

// One slow back and forth, used at a different size and speed for each layer.
function useDrift(range: number, ms: number, still: boolean) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still || Platform.OS === 'web') return; // the web drifts with CSS, see webDrift
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v, ms, still]);
  return v.interpolate({ inputRange: [0, 1], outputRange: [-range, range] });
}
// FIX (10 Nov 2026): on the web the drift is a CSS animation, which the browser runs by sliding an
// already drawn layer, with no JavaScript each frame and nothing redrawn.
// The keyframes are added to the page once, and each layer is pointed at them through its element.
function ensureSkyCss() {
  if (typeof document === 'undefined' || document.getElementById('tali-sky-css')) return;
  const el = document.createElement('style');
  el.id = 'tali-sky-css';
  el.textContent = '@keyframes taliSkyDrift{from{transform:translateX(calc(var(--sky-r) * -1))}to{transform:translateX(var(--sky-r))}}@keyframes taliSkyTwinkle{from{opacity:.6}to{opacity:1}}';
  document.head.appendChild(el);
}
function useWebAnimation(animation: string | null, range?: number) {
  const ref = useRef<any>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node: any = ref.current;
    if (!node?.style) return;
    ensureSkyCss();
    if (range != null) node.style.setProperty('--sky-r', `${range}px`);
    node.style.willChange = animation?.includes('Twinkle') ? 'opacity' : 'transform';
    node.style.animation = animation ?? 'none';
  }, [animation, range]);
  return ref;
}
const WEB = Platform.OS === 'web';
const LAYER: any = WEB ? { willChange: 'transform' } : null;
const parallax = (factor: number) => skyScroll.interpolate({ inputRange: [0, 3000], outputRange: [0, -3000 * factor], extrapolate: 'clamp' });
// Layers are a little bigger than the screen so drifting never shows an edge.
const BLEED = { position: 'absolute' as const, left: -40, right: -40, top: -60, bottom: -60 };

// One depth layer. It moves up a little as the page scrolls (far layers least) and drifts side to
// side. On phones both run on the native thread. On the web the scroll shift is the outer box and
// the drift is a CSS animation on the inner one.
function Layer({ drift, range, ms, depth, still, opacity, children }: { drift: Animated.AnimatedInterpolation<number>; range: number; ms: number; depth: number; still: boolean; opacity?: number; children: ReactNode }) {
  const driftRef = useWebAnimation(still ? null : `taliSkyDrift ${ms}ms ease-in-out infinite alternate`, range);
  const move = WEB ? [{ translateY: parallax(depth) }] : [{ translateX: drift }, { translateY: parallax(depth) }];
  return (
    <Animated.View style={[BLEED, LAYER, opacity != null ? { opacity } : null, { transform: move }]}>
      <View ref={driftRef} style={StyleSheet.absoluteFill}>{children}</View>
    </Animated.View>
  );
}

export function PageSky({ style }: { style?: StyleProp<ViewStyle> }) {
  const blend = useSkyBlend(); // 0 day, 1 night
  const [still, setStill] = useState(false);
  useEffect(() => {
    let on = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (on) setStill(!!v); }).catch(() => {});
    return () => { on = false; };
  }, []);
  const farX = useDrift(8, 42000, still);
  const midX = useDrift(16, 31000, still);
  const nearX = useDrift(30, 23000, still);
  const twinkle = useDrift(0.5, 3800, still); // -0.5..0.5, turned into brightness below
  const twinkleRef = useWebAnimation(still ? null : 'taliSkyTwinkle 3800ms ease-in-out infinite alternate');
  const day = 1 - blend;
  const mix = (d: number, n: number) => d * day + n * blend;

  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', backgroundColor: nightDeep[0] }, style]} pointerEvents="none">
      {/* 1. the sky */}
      <LinearGradient colors={[...nightDeep]} locations={[0, 0.35, 0.7, 1]} style={StyleSheet.absoluteFill} />
      {blend < 1 ? <LinearGradient colors={[...daySky]} locations={[0, 0.32, 0.68, 1]} style={[StyleSheet.absoluteFill, { opacity: day }]} /> : null}

      {/* 2. far light */}
      <Layer drift={farX} range={8} ms={42000} depth={0.03} still={still}>
        {FAR_LIGHT.map((g, i) => (
          <Image key={i} source={GLOWS[g.glow]} resizeMode="stretch" style={{ position: 'absolute', left: `${g.x}%`, top: `${g.y}%`, width: g.size, height: g.size, marginLeft: -g.size / 2, marginTop: -g.size / 2, opacity: mix(g.day, g.night) }} />
        ))}
      </Layer>

      {/* 3. far dust */}
      <Layer drift={farX} range={8} ms={42000} depth={0.05} still={still} opacity={mix(0.55, 1)}>
        {FAR_DUST.map((d, i) => (
          <View key={i} style={{ position: 'absolute', left: `${d.x}%`, top: `${d.y}%`, width: d.r, height: d.r, borderRadius: d.r / 2, backgroundColor: '#fff', opacity: d.o }} />
        ))}
      </Layer>

      {/* 4. mid points */}
      <Layer drift={midX} range={16} ms={31000} depth={0.1} still={still} opacity={mix(0.5, 1)}>
        {MID_POINTS.map((d, i) => (
          <View key={i} style={{ position: 'absolute', left: `${d.x}%`, top: `${d.y}%`, width: d.r, height: d.r, borderRadius: d.r / 2, backgroundColor: '#EDE8FF', opacity: d.o }} />
        ))}
      </Layer>

      {/* 5. near light: bright stars with a halo at night, soft out of focus discs all day */}
      <Layer drift={nearX} range={30} ms={23000} depth={0.2} still={still}>
        {NEAR_BOKEH.map((b, i) => (
          <Image key={`b${i}`} source={BOKEH} resizeMode="stretch" style={{ position: 'absolute', left: `${b.x}%`, top: `${b.y}%`, width: b.size, height: b.size, marginLeft: -b.size / 2, marginTop: -b.size / 2, opacity: b.o * mix(1, 0.6) }} />
        ))}
        <Animated.View style={[StyleSheet.absoluteFill, WEB ? { opacity: mix(0.4, 0.9) } : { opacity: Animated.multiply(Animated.add(twinkle, 1.1), mix(0.35, 0.8)) }]}>
          <View ref={twinkleRef} style={StyleSheet.absoluteFill}>
          {NEAR_STARS.map((d, i) => (
            <Image key={`s${i}`} source={GLOWS.white} resizeMode="stretch" style={{ position: 'absolute', left: `${d.x}%`, top: `${d.y}%`, width: d.r, height: d.r, opacity: d.o }} />
          ))}
          </View>
        </Animated.View>
      </Layer>

      {/* 6. the edges fall away */}
      <LinearGradient colors={['rgba(8,5,40,0.55)', 'rgba(8,5,40,0)']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '26%' }} />
      <LinearGradient colors={['rgba(8,5,40,0.35)', 'rgba(8,5,40,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '16%' }} />
      <LinearGradient colors={['rgba(8,5,40,0)', 'rgba(8,5,40,0.35)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '16%' }} />
    </View>
  );
}
