// Tali made of the same dots as her brain (9 Nov 2026 concept, asked for by Taj). She sways and breathes,
// her dots ripple while she thinks, and she can turn into her brain: every dot flies to a place in the
// brain globe and takes that part's colour. Drawn like BrainGlobe, with plain Views moved by Reanimated,
// so it needs no 3D library and ships over the air.
import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useFrameCallback, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { TALI_DOTS, type TaliDot } from '@/lib/taliDots';
import { BRAIN_DOTS, BRAIN_START } from '@/components/BrainGlobe';

const FOCAL = 3.2;
function proj(x: number, y: number, z: number, ry: number, rx: number, scale: number, cx: number, cy: number) {
  'worklet';
  const c = Math.cos(ry), s = Math.sin(ry);
  const x1 = x * c + z * s;
  const z1 = -x * s + z * c;
  const c2 = Math.cos(rx), s2 = Math.sin(rx);
  const y2 = y * c2 - z1 * s2;
  const z2 = y * s2 + z1 * c2;
  const k = FOCAL / (FOCAL - z2);
  return { sx: cx + x1 * scale * k, sy: cy - y2 * scale * k, k, z: z2 };
}

type Clock = { t: SharedValue<number>; think: SharedValue<number>; morph: SharedValue<number> };
type Box = { w: number; h: number; dot: number; brainScale: number; brainCy: number; brainDot: number };

const Dot = memo(function Dot({ i, d, clock, box, morphable }: { i: number; d: TaliDot; clock: Clock; box: Box; morphable: boolean }) {
  const [x, y, z, colour, kind] = d;
  const b = BRAIN_DOTS[(i * 7) % BRAIN_DOTS.length];
  const size = box.dot * (kind === 'f' ? 0.95 : kind === 'b' ? 0.8 : 1);
  const phase = ((i * 0.618) % 1) * Math.PI * 2;
  const style = useAnimatedStyle(() => {
    const t = clock.t.value;
    const m = clock.morph.value;
    const e = m * m * (3 - 2 * m);
    const th = clock.think.value;
    // Tali: a slow sway and a breath. Thinking sends a ripple up through her.
    const wave = th * 0.08 * Math.sin(t * 6 - y * 7);
    const ry = Math.sin(t * 0.4) * 0.8 + e * 1.2;
    const a = proj(x * (1 + wave), y + Math.sin(t * 1.4) * 0.008, z * (1 + wave) + wave * 0.04, ry, 0, box.h * 0.47, box.w / 2, box.h / 2);
    let sx = a.sx, sy = a.sy;
    const front = Math.max(0, Math.min(1, (a.z + 0.25) / 0.5));
    let scale = a.k * (0.7 + 0.45 * front);
    const twinkle = 0.88 + 0.12 * Math.sin(t * 2.2 + phase);
    let op = (kind === 'b' ? 0.85 : kind === 'p' ? 0.5 : 0.95) * (0.4 + front * 0.6) * twinkle * (1 + th * 0.25 * Math.max(0, Math.sin(t * 6 - y * 7)));
    if (morphable && e > 0) {
      // Fly to a place in her brain, curving a little on the way so it reads as a swirl, not a slide.
      const p = proj(b.x, b.y, b.z, BRAIN_START.ry - (1 - e) * 2.2, BRAIN_START.rx * e, box.brainScale, box.w / 2, box.brainCy);
      const curve = Math.sin(e * Math.PI) * 40 * Math.sin(phase);
      sx = sx + (p.sx - sx) * e + curve;
      sy = sy + (p.sy - sy) * e + Math.sin(e * Math.PI) * 30 * Math.cos(phase);
      const bdepth = (p.z + 1.1) / 2.2;
      const bsize = (b.size * 2 * box.brainDot * p.k * 0.62) / size;
      scale = scale + (bsize - scale) * e;
      op = op + (Math.min(1, 0.85 * (0.3 + bdepth * 0.8)) - op) * e;
    }
    return {
      opacity: Math.max(0.05, Math.min(1, op)),
      transform: [{ translateX: sx - size / 2 }, { translateY: sy - size / 2 }, { scale }],
      zIndex: Math.round(front * 40),
    };
  });
  const brainColour = useAnimatedStyle(() => {
    const m = clock.morph.value;
    return { opacity: morphable ? m * m * (3 - 2 * m) : 0 };
  });
  // Her glow fades as she becomes her brain, so the globe ends crisp like BrainGlobe.
  const halo = useAnimatedStyle(() => ({ opacity: (kind === 'f' ? 0.32 : 0.16) * (1 - Math.min(1, clock.morph.value * 1.6)) }));
  const glow = kind === 'f' ? '#FFFFFF' : kind === 'c' ? colour : null;
  return (
    <Animated.View style={[styles.dot, { width: size, height: size }, style]}>
      {glow ? <Animated.View style={[styles.ring, { width: size * (kind === 'f' ? 1.9 : 2.6), height: size * (kind === 'f' ? 1.9 : 2.6), left: -size * (kind === 'f' ? 0.45 : 0.8), top: -size * (kind === 'f' ? 0.45 : 0.8), borderRadius: size * 1.3, backgroundColor: glow }, halo]} /> : null}
      <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, backgroundColor: colour }]} />
      {morphable ? <Animated.View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, backgroundColor: b.colour }, brainColour]} /> : null}
    </Animated.View>
  );
});

export function TaliDots({
  width,
  height,
  thinking = false,
  morph,
  brainSize,
  every = 1,
  onPress,
}: {
  width: number;
  height: number;
  /** Her dots ripple while she works something out. */
  thinking?: boolean;
  /** 0 is Tali, 1 is her brain. Pass one in to turn her into her brain. */
  morph?: SharedValue<number>;
  /** How big the brain globe she turns into is drawn, centred in the same box. */
  brainSize?: number;
  /** Keep every nth dot (her face always stays whole), for small sizes where all of them crowd. */
  every?: number;
  onPress?: () => void;
}) {
  const t = useSharedValue(0);
  const think = useSharedValue(0);
  const own = useSharedValue(0);
  useFrameCallback((f) => {
    t.value += (f.timeSincePreviousFrame ?? 16) / 1000;
  });
  useEffect(() => {
    think.value = withTiming(thinking ? 1 : 0, { duration: 500, easing: Easing.inOut(Easing.quad) });
  }, [thinking, think]);
  const clock = { t, think, morph: morph ?? own };
  const bs = brainSize ?? width;
  const box: Box = { w: width, h: height, dot: Math.max(1.8, height / 150), brainScale: (bs / 2) * 0.86, brainCy: height / 2 + bs * 0.02, brainDot: bs / 400 };
  const body = (
    <View style={{ width, height }} pointerEvents={onPress ? 'box-only' : 'none'}>
      {TALI_DOTS.map((d, i) => (every > 1 && i % (d[4] === 'f' ? 2 : every) ? null : (
        <Dot key={i} i={i} d={d} clock={clock} box={box} morphable={!!morph} />
      )))}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Tali. Tap to step into her brain.">
      {body}
    </Pressable>
  ) : body;
}

const styles = StyleSheet.create({
  dot: { position: 'absolute', left: 0, top: 0 },
  ring: { position: 'absolute', left: 0, top: 0 },
});
