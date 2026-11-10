// Tali's brain in 3D (6 Nov 2026, asked for by Taj). A point cloud shaped like a brain: two
// hemispheres folded like a cortex, the cerebellum and brainstem underneath, and the deep parts
// (hippocampus, amygdala, thalamus and friends) glowing inside. Each part lights up by how much
// Tali holds there. It turns slowly on its own; drag to spin it, pinch to zoom, tap a part.
// 11 Nov 2026: sparks run between the dots, every dot twinkles, she breathes, and a flick keeps her turning.
//
// Drawn with plain Views moved by Reanimated on the UI thread, so it needs no 3D library and ships
// as an over the air update on iPhone, Android and the web. Names shared by more than one part
// (a client who shows up in lessons and in facts) are drawn as lines between those parts on the whole brain.
import { memo, useEffect, useMemo } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useFrameCallback, useReducedMotion, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { REGIONS, type RegionId } from '@/lib/brain';
import { BrainCanvas } from '@/components/BrainCanvas';

type P3 = { x: number; y: number; z: number };
type Dot = P3 & { region: RegionId; size: number };

// ---------------------------------------------------------------------------------------------
// The shape. x is left to right, y is up, z is front (+) to back (-). Seeded so it never changes.
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

function cortexRegion(p: P3): RegionId {
  if (p.z > 0.62 && p.y > -0.2) return 'prefrontal';
  if (p.z < -0.58) return 'occipital';
  // 6 Nov 2026: was p.y < -0.12, which no dot ever reached, so the temporal lobe was empty.
  if (p.y < 0.22 && Math.abs(p.x) > 0.28 && p.z > -0.58 && p.z < 0.62) return 'temporal';
  if (p.z > 0.12) return 'frontal';
  return 'parietal';
}

function makeBrain(): { dots: Dot[]; centres: Record<RegionId, P3> } {
  const r = rng(42);
  const dots: Dot[] = [];
  // Cortex: two hemispheres. Each is a long egg (longer front to back), flattened underneath, with a
  // temporal lobe bulging down at the side and small ripples for the folds. Points on the flat
  // inner face are skipped so the two halves read as two.
  for (const side of [-1, 1]) {
    let made = 0;
    for (let i = 0; made < 190 && i < 420; i++) {
      const t = (i + 0.5) / 420;
      const phi = Math.acos(1 - 2 * t);
      const th = i * 2.399963 + side * 0.7;
      const nx = Math.sin(phi) * Math.cos(th);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(th);
      if (nx * side < -0.45) continue;
      const fold = 1 + 0.035 * Math.sin(11 * phi + 5 * th) + 0.025 * Math.sin(17 * th + 3 * phi);
      let y = ny * 0.58 * fold;
      const z = nz * 0.95 * fold;
      if (y < -0.18) y = -0.18 + (y + 0.18) * 0.45; // flat base
      // temporal lobe: bulge down and out at the side, front half
      const temporal = Math.max(0, -ny) * Math.max(0, 1 - Math.abs(nz - 0.15) * 1.6) * Math.max(0, nx * side);
      y -= temporal * 0.22;
      const p = { x: side * 0.27 + nx * 0.38 * fold + side * temporal * 0.05, y: 0.15 + y, z };
      dots.push({ ...p, region: cortexRegion(p), size: 3.6 + r() * 1.4 });
      made++;
    }
  }
  // Cerebellum: a ridged bulb at the back, underneath.
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2;
    const b = Math.acos(2 * r() - 1);
    const ridge = 1 + 0.08 * Math.sin(10 * b);
    dots.push({ x: Math.sin(b) * Math.cos(a) * 0.56 * ridge, y: -0.5 + Math.cos(b) * 0.24, z: -0.62 + Math.sin(b) * Math.sin(a) * 0.3 * ridge, region: 'cerebellum', size: 4.5 + r() * 1.5 });
  }
  // Brainstem: a short stalk down from the middle.
  for (let i = 0; i < 18; i++) {
    const a = r() * Math.PI * 2;
    const h = r();
    dots.push({ x: Math.cos(a) * 0.12, y: -0.38 - h * 0.62, z: -0.22 - h * 0.12 + Math.sin(a) * 0.12, region: 'brainstem', size: 4.5 });
  }
  // Deep parts, glowing through the cortex.
  const cluster = (region: RegionId, c: P3, spread: P3, n: number, size: number, mirror = true) => {
    for (const side of mirror ? [-1, 1] : [1]) {
      for (let i = 0; i < n; i++) {
        dots.push({ x: side * c.x + (r() - 0.5) * spread.x, y: c.y + (r() - 0.5) * spread.y, z: c.z + (r() - 0.5) * spread.z, region, size });
      }
    }
  };
  cluster('hippocampus', { x: 0.32, y: -0.18, z: -0.2 }, { x: 0.12, y: 0.12, z: 0.42 }, 9, 6);
  cluster('amygdala', { x: 0.3, y: -0.24, z: 0.16 }, { x: 0.1, y: 0.1, z: 0.1 }, 5, 7);
  cluster('thalamus', { x: 0.12, y: 0.02, z: -0.08 }, { x: 0.1, y: 0.12, z: 0.18 }, 5, 6.5);
  cluster('hypothalamus', { x: 0, y: -0.2, z: 0.08 }, { x: 0.1, y: 0.08, z: 0.1 }, 6, 6.5, false);
  cluster('basal_ganglia', { x: 0.27, y: 0.06, z: 0.14 }, { x: 0.1, y: 0.18, z: 0.24 }, 6, 6);
  // Corpus callosum: the bridge arching between the halves.
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    dots.push({ x: (r() - 0.5) * 0.14, y: 0.2 + Math.sin(t * Math.PI) * 0.16, z: 0.5 - t * 1.0, region: 'corpus_callosum', size: 5.5 });
  }
  // The centre of each part, for taps and link lines.
  const sums = {} as Record<RegionId, { x: number; y: number; z: number; n: number }>;
  for (const d of dots) {
    const s = (sums[d.region] ??= { x: 0, y: 0, z: 0, n: 0 });
    s.x += d.x; s.y += d.y; s.z += d.z; s.n++;
  }
  const centres = {} as Record<RegionId, P3>;
  for (const k of Object.keys(sums) as RegionId[]) {
    const s = sums[k];
    // Mirrored parts average to the middle; nudge them to the right half so taps and lines land on dots.
    const mirrored = ['hippocampus', 'amygdala', 'thalamus', 'basal_ganglia', 'frontal', 'prefrontal', 'parietal', 'temporal', 'occipital'].includes(k);
    centres[k] = { x: mirrored ? Math.abs(s.x / s.n) + 0.32 * (k === 'thalamus' ? 0.4 : 1) : s.x / s.n, y: s.y / s.n, z: s.z / s.n };
  }
  return { dots, centres };
}

const BRAIN = makeBrain();

/** The brain's dots and their part colours, so dot Tali can turn into her brain (9 Nov 2026 concept). */
export const BRAIN_DOTS = BRAIN.dots.map((d) => ({ x: d.x, y: d.y, z: d.z, size: d.size, colour: REGIONS[d.region].colour }));
// 11 Nov 2026 (Taj: "I bloody love how the brain moves on the website now. Is that possible on the app?").
// The same life as the website brain: sparks that run from dot to dot like a thought firing, a soft
// twinkle on every dot, a slow breath, and a flick that keeps turning. Flat number lists, so the
// sparks can read them on the UI thread: where each dot is, four dots it can jump to, and its colour.
const PTS: number[] = [];
const NEAR: number[] = [];
const COLS: string[] = [];
BRAIN.dots.forEach((d, i) => {
  PTS.push(d.x, d.y, d.z);
  COLS.push(REGIONS[d.region].colour);
  // Not the very nearest dots: those are a few pixels away and a hop that short cannot be seen. A spark
  // jumps to one of four dots a little further off, so each hop leaves a streak you can follow.
  const order = BRAIN.dots.map((o, j) => ({ j, dd: (o.x - d.x) ** 2 + (o.y - d.y) ** 2 + (o.z - d.z) ** 2 })).filter((o) => o.j !== i).sort((p, q) => p.dd - q.dd);
  for (const rank of [8, 14, 20, 28]) NEAR.push(order[Math.min(rank, order.length - 1)].j);
});
const ALL_DOTS = BRAIN.dots.map((_, i) => i);
/** How many sparks run at once. Kept small so older phones stay smooth. */
const SPARKS = 16;

/** Where the brain globe opens: turned side on, looking down a touch. */
export const BRAIN_START = { ry: 1.9, rx: 0.18 };

// ---------------------------------------------------------------------------------------------
// Projection, shared by every dot (runs on the UI thread).
const FOCAL = 3.2;
function project(p: P3, ry: number, rx: number, zoom: number, half: number) {
  'worklet';
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const x1 = p.x * cy + p.z * sy;
  const z1 = -p.x * sy + p.z * cy;
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const y2 = p.y * cx - z1 * sx;
  const z2 = p.y * sx + z1 * cx;
  const k = FOCAL / (FOCAL - z2);
  const scale = half * 0.86 * zoom * k;
  return { sx: half + x1 * scale, sy: half - y2 * scale + half * 0.04, k, z: z2 };
}

type Spin = { ry: SharedValue<number>; rx: SharedValue<number>; zoom: SharedValue<number>; clock: SharedValue<number>; breathe: SharedValue<number> };

// 6 Nov 2026 (Taj: "looks so much cooler on the website"): drawn like the website demo. Every dot is a
// crisp circle. The part you picked gets bigger dots with a white core and a soft glow behind them,
// and everything else dims. With nothing picked (Whole brain) every part shows at once, brighter the
// more Tali keeps there. The glow is three faint rings, since React Native has no radial gradient.
// Each dot is drawn once at a fixed size and only moved and scaled per frame.
type Mode = 'on' | 'off' | 'all';
const DotView = memo(function DotView({ d, spin, half, scale, glow, colour, mode, ph }: { d: Dot; spin: Spin; half: number; scale: number; glow: number; colour: string; mode: Mode; ph: number }) {
  const base = d.size * 2 * scale; // diameter at zoom 1, front of the brain
  const style = useAnimatedStyle(() => {
    const z = spin.zoom.value * spin.breathe.value;
    const p = project(d, spin.ry.value, spin.rx.value, z, half);
    const depth = (p.z + 1.1) / 2.2; // 0 at the back, 1 at the front
    const bright = mode === 'on' ? 1 : mode === 'off' ? 0.22 : 0.6 + glow * 0.4;
    const s = p.k * z * (mode === 'on' ? 0.95 : 0.78);
    // The twinkle: each dot drifts a little brighter and dimmer on its own beat. The clock stays at 0 with reduced motion.
    const twinkle = spin.clock.value > 0 ? 0.86 + 0.14 * Math.sin(spin.clock.value * 0.0021 + ph) : 1;
    return {
      opacity: Math.max(0.06, Math.min(1, bright * (0.3 + depth * 0.8) * twinkle)),
      transform: [{ translateX: p.sx - base / 2 }, { translateY: p.sy - base / 2 }, { scale: s }],
      zIndex: Math.round(depth * 100),
    };
  });
  return (
    <Animated.View style={[styles.dot, { width: base, height: base }, style]}>
      {mode === 'on' ? (
        <>
          <View style={[styles.ring, { width: base * 4, height: base * 4, left: -base * 1.5, top: -base * 1.5, borderRadius: base * 2, backgroundColor: colour, opacity: 0.1 }]} />
          <View style={[styles.ring, { width: base * 2.6, height: base * 2.6, left: -base * 0.8, top: -base * 0.8, borderRadius: base * 1.3, backgroundColor: colour, opacity: 0.16 }]} />
          <View style={[styles.ring, { width: base * 1.6, height: base * 1.6, left: -base * 0.3, top: -base * 0.3, borderRadius: base * 0.8, backgroundColor: colour, opacity: 0.3 }]} />
        </>
      ) : null}
      <View style={[styles.ring, { width: base, height: base, left: 0, top: 0, borderRadius: base / 2, backgroundColor: colour }]} />
      {mode === 'on' ? <View style={[styles.ring, { width: base * 0.45, height: base * 0.45, left: base * 0.275, top: base * 0.275, borderRadius: base, backgroundColor: '#FFFFFF', opacity: 0.8 }]} /> : null}
    </Animated.View>
  );
});

const LinkView = memo(function LinkView({ a, b, spin, half, strength }: { a: P3; b: P3; spin: Spin; half: number; strength: number }) {
  const style = useAnimatedStyle(() => {
    const z = spin.zoom.value * spin.breathe.value;
    const p = project(a, spin.ry.value, spin.rx.value, z, half);
    const q = project(b, spin.ry.value, spin.rx.value, z, half);
    const dx = q.sx - p.sx;
    const dy = q.sy - p.sy;
    const len = Math.sqrt(dx * dx + dy * dy);
    return {
      width: len,
      opacity: 0.1 + strength * 0.3,
      transform: [{ translateX: (p.sx + q.sx) / 2 - len / 2 }, { translateY: (p.sy + q.sy) / 2 }, { rotate: `${Math.atan2(dy, dx)}rad` }],
    };
  });
  return <Animated.View style={[styles.link, style]} />;
});

// One spark. It waits its turn, picks a dot, runs to one of that dot's neighbours, then hops on a few
// more times before resting. A thin line trails behind a bright point. All of it runs on the UI thread.
const SparkView = memo(function SparkView({ i, spin, half, scale, pool, pace }: { i: number; spin: Spin; half: number; scale: number; pool: SharedValue<number[]>; pace: SharedValue<number> }) {
  const a = useSharedValue(0);
  const b = useSharedValue(0);
  // Where she was before `a`, so the streak she leaves behind can fade out along the last hop.
  const c = useSharedValue(-1);
  const t0 = useSharedValue(0);
  const dur = useSharedValue(400);
  const hops = useSharedValue(0);
  const wake = useSharedValue(i * 260);
  useFrameCallback(() => {
    const now = spin.clock.value;
    if (now <= 0) return;
    if (t0.value === 0) {
      if (now < wake.value) return;
      const list = pool.value;
      const from = list[Math.floor(Math.random() * list.length)] ?? 0;
      a.value = from;
      c.value = -1;
      b.value = NEAR[from * 4 + Math.floor(Math.random() * 4)];
      dur.value = (300 + Math.random() * 240) / pace.value;
      hops.value = 4 + Math.floor(Math.random() * 6);
      t0.value = now;
      return;
    }
    if (now - t0.value >= dur.value) {
      if (hops.value > 0) {
        const next = NEAR[b.value * 4 + Math.floor(Math.random() * 4)];
        const to = next === a.value ? NEAR[b.value * 4] : next;
        c.value = a.value;
        a.value = b.value;
        b.value = to;
        hops.value -= 1;
        t0.value = now;
      } else {
        t0.value = 0;
        wake.value = now + (150 + Math.random() * 700) / pace.value;
      }
    }
  });
  const at = () => {
    'worklet';
    const z = spin.zoom.value * spin.breathe.value;
    const p = project({ x: PTS[a.value * 3], y: PTS[a.value * 3 + 1], z: PTS[a.value * 3 + 2] }, spin.ry.value, spin.rx.value, z, half);
    const q = project({ x: PTS[b.value * 3], y: PTS[b.value * 3 + 1], z: PTS[b.value * 3 + 2] }, spin.ry.value, spin.rx.value, z, half);
    const t = t0.value === 0 ? 0 : Math.min(1, (spin.clock.value - t0.value) / dur.value);
    return { p, x: p.sx + (q.sx - p.sx) * t, y: p.sy + (q.sy - p.sy) * t, k: q.k, t };
  };
  const head = 9 * scale;
  const headStyle = useAnimatedStyle(() => {
    if (t0.value === 0) return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }], zIndex: 200 };
    const s = at();
    return { opacity: 0.95, transform: [{ translateX: s.x - head / 2 }, { translateY: s.y - head / 2 }, { scale: s.k }], zIndex: 200 };
  });
  const glowStyle = useAnimatedStyle(() => ({ backgroundColor: COLS[b.value] }));
  const trailStyle = useAnimatedStyle(() => {
    if (t0.value === 0) return { opacity: 0, width: 0, backgroundColor: COLS[b.value], transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0rad' }], zIndex: 199 };
    const s = at();
    const dx = s.x - s.p.sx;
    const dy = s.y - s.p.sy;
    const len = Math.sqrt(dx * dx + dy * dy);
    return {
      opacity: 0.9,
      width: len,
      backgroundColor: COLS[b.value],
      transform: [{ translateX: (s.p.sx + s.x) / 2 - len / 2 }, { translateY: (s.p.sy + s.y) / 2 }, { rotate: `${Math.atan2(dy, dx)}rad` }],
      zIndex: 199,
    };
  });
  // The streak behind her: the hop she just finished, fading as she runs the next one. This is what
  // makes a spark look like it shoots through the brain (11 Nov 2026, Taj: "it doesn't shoot like the website").
  const tailStyle = useAnimatedStyle(() => {
    if (t0.value === 0 || c.value < 0) return { opacity: 0, width: 0, backgroundColor: COLS[a.value], transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0rad' }], zIndex: 198 };
    const s = at();
    const z = spin.zoom.value * spin.breathe.value;
    const o = project({ x: PTS[c.value * 3], y: PTS[c.value * 3 + 1], z: PTS[c.value * 3 + 2] }, spin.ry.value, spin.rx.value, z, half);
    const dx = s.p.sx - o.sx;
    const dy = s.p.sy - o.sy;
    const len = Math.sqrt(dx * dx + dy * dy);
    return {
      opacity: 0.6 * (1 - s.t),
      width: len,
      backgroundColor: COLS[a.value],
      transform: [{ translateX: (o.sx + s.p.sx) / 2 - len / 2 }, { translateY: (o.sy + s.p.sy) / 2 }, { rotate: `${Math.atan2(dy, dx)}rad` }],
      zIndex: 198,
    };
  });
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.trail, tailStyle]} />
      <Animated.View pointerEvents="none" style={[styles.trail, trailStyle]} />
      <Animated.View pointerEvents="none" style={[styles.dot, { width: head, height: head }, headStyle]}>
        <Animated.View style={[styles.ring, { width: head * 3.4, height: head * 3.4, left: -head * 1.2, top: -head * 1.2, borderRadius: head * 1.7, opacity: 0.22 }, glowStyle]} />
        <Animated.View style={[styles.ring, { width: head * 1.8, height: head * 1.8, left: -head * 0.4, top: -head * 0.4, borderRadius: head, opacity: 0.45 }, glowStyle]} />
        <View style={[styles.ring, { width: head, height: head, left: 0, top: 0, borderRadius: head / 2, backgroundColor: '#FFFFFF' }]} />
      </Animated.View>
    </>
  );
});

// 11 Nov 2026 (Taj: "make it EXACTLY how it is on the website"): on the web she is the website's brain,
// drawn on a canvas by BrainCanvas. The phone apps have no canvas, so they keep the Views version below.
export function BrainGlobe(props: Parameters<typeof BrainGlobeViews>[0]) {
  if (Platform.OS !== 'web') return <BrainGlobeViews {...props} />;
  return <BrainGlobeWeb {...props} />;
}

function BrainGlobeWeb({ size, counts, links, selected, lit, onSelect, speed = 1 }: Parameters<typeof BrainGlobeViews>[0]) {
  const glow = useMemo(() => {
    const max = Math.max(1, ...Object.values(counts).map((n) => n ?? 0));
    const out = {} as Record<RegionId, number>;
    for (const id of Object.keys(REGIONS) as RegionId[]) {
      const n = counts[id] ?? 0;
      out[id] = n <= 0 ? 0 : 0.25 + 0.75 * (Math.log(1 + n) / Math.log(1 + max));
    }
    return out;
  }, [counts]);
  const pairs = useMemo(() => {
    const out: { a: RegionId; b: RegionId; strength: number }[] = [];
    const max = Math.max(1, ...links.map((l) => l.count));
    for (const l of links.slice(0, 12)) {
      const rs = l.regions.filter((x) => BRAIN.centres[x]);
      for (let i = 0; i + 1 < rs.length; i++) out.push({ a: rs[i], b: rs[i + 1], strength: l.count / max });
    }
    return out.slice(0, 18);
  }, [links]);
  return <BrainCanvas size={size} dots={BRAIN.dots} centres={BRAIN.centres} glow={glow} links={pairs} selected={selected} lit={lit} onSelect={onSelect} speed={speed} />;
}

function BrainGlobeViews({
  size,
  counts,
  links,
  selected,
  lit,
  onSelect,
  speed = 1,
}: {
  size: number;
  counts: Partial<Record<RegionId, number>>;
  links: { regions: RegionId[]; count: number }[];
  /** null is the whole brain. */
  selected: RegionId | null;
  /** Several parts lit at once (10 Nov 2026, the Today lens). The rest of the brain dims. Wins over `selected`. */
  lit?: RegionId[] | null;
  /** The part tapped, or null for a tap on empty space. */
  onSelect: (id: RegionId | null) => void;
  /** How fast she turns on her own. 1 is normal, 0.5 is the slow night turn. */
  speed?: number;
}) {
  const half = size / 2;
  const scale = size / 400;
  // 6 Nov 2026: opens side on with the front to the right and a slight look down from above, like the website.
  const ry = useSharedValue(1.9);
  const rx = useSharedValue(0.18);
  const zoom = useSharedValue(1);
  const dragging = useSharedValue(false);
  const startRy = useSharedValue(0);
  const startRx = useSharedValue(0);
  const startZoom = useSharedValue(1);
  // What makes her feel alive (11 Nov 2026): a clock for the twinkle and the sparks, a slow breath, and
  // the speed left over from a flick. All of it is off when the phone asks for reduced motion.
  const still = useReducedMotion();
  const clock = useSharedValue(0);
  const breathe = useSharedValue(1);
  const flick = useSharedValue(0);
  const spin = useMemo(() => ({ ry, rx, zoom, clock, breathe }), [ry, rx, zoom, clock, breathe]);

  // A slow turn on its own, paused while a finger is on it.
  const frames = useFrameCallback((f) => {
    const dt = (f.timeSincePreviousFrame ?? 16) / 1000;
    if (!still) {
      clock.value += dt * 1000;
      breathe.value = 1 + 0.014 * Math.sin(clock.value / 1700);
    }
    if (dragging.value) return;
    ry.value += dt * 0.35 * speed;
    // Keeps turning after a flick, easing back to her slow spin.
    if (Math.abs(flick.value) > 0.02) {
      ry.value += flick.value * dt;
      flick.value *= Math.pow(0.04, dt);
    }
  });

  // Nothing moves while you are on another tab, so she costs nothing when you cannot see her.
  const focused = useIsFocused();
  useEffect(() => {
    frames.setActive(focused);
  }, [focused, frames]);

  // Sparks start in the part you picked (or the parts the lens lit), and anywhere on the whole brain.
  const sparkPool = useMemo(() => {
    const want = lit && lit.length ? lit : selected ? [selected] : null;
    if (!want) return ALL_DOTS;
    const pool = ALL_DOTS.filter((i) => want.includes(BRAIN.dots[i].region));
    return pool.length ? pool : ALL_DOTS;
  }, [lit, selected]);
  // Kept in shared values so the sparks see a new pick straight away.
  const poolSV = useSharedValue<number[]>(ALL_DOTS);
  const paceSV = useSharedValue(1);
  useEffect(() => {
    poolSV.value = sparkPool;
    paceSV.value = Math.max(0.4, speed);
  }, [sparkPool, speed, poolSV, paceSV]);

  // How bright each part is: a log scale so 5 memories glow and 500 don't blind.
  const glow = useMemo(() => {
    const max = Math.max(1, ...Object.values(counts).map((n) => n ?? 0));
    const out = {} as Record<RegionId, number>;
    for (const id of Object.keys(REGIONS) as RegionId[]) {
      const n = counts[id] ?? 0;
      out[id] = n <= 0 ? 0 : 0.25 + 0.75 * (Math.log(1 + n) / Math.log(1 + max));
    }
    return out;
  }, [counts]);

  const linkPairs = useMemo(() => {
    const pairs: { a: P3; b: P3; strength: number; key: string }[] = [];
    const max = Math.max(1, ...links.map((l) => l.count));
    for (const l of links.slice(0, 12)) {
      const rs = l.regions.filter((x) => BRAIN.centres[x]);
      for (let i = 0; i + 1 < rs.length; i++) {
        pairs.push({ a: BRAIN.centres[rs[i]], b: BRAIN.centres[rs[i + 1]], strength: l.count / max, key: `${rs[i]}-${rs[i + 1]}-${pairs.length}` });
      }
    }
    return pairs.slice(0, 18);
  }, [links]);

  const centreList = useMemo(() => (Object.keys(BRAIN.centres) as RegionId[]).map((id) => ({ id, ...BRAIN.centres[id] })), []);

  const pan = Gesture.Pan()
    .minDistance(4)
    .onStart(() => {
      dragging.value = true;
      flick.value = 0;
      startRy.value = ry.value;
      startRx.value = rx.value;
    })
    .onUpdate((e) => {
      ry.value = startRy.value + e.translationX / 120;
      rx.value = Math.max(-1.2, Math.min(1.2, startRx.value + e.translationY / 160));
    })
    .onFinalize((e) => {
      dragging.value = false;
      flick.value = still ? 0 : Math.max(-9, Math.min(9, (e.velocityX ?? 0) / 120));
    });
  const pinch = Gesture.Pinch()
    .onStart(() => {
      dragging.value = true;
      startZoom.value = zoom.value;
    })
    .onUpdate((e) => {
      zoom.value = Math.max(0.7, Math.min(2.2, startZoom.value * e.scale));
    })
    .onFinalize(() => {
      dragging.value = false;
    });
  const tap = Gesture.Tap()
    .maxDistance(8)
    .onEnd((e) => {
      // Nearest part to the finger, front-most first.
      let best = '';
      let bestD = 1e9;
      for (const c of centreList) {
        const p = project(c, ry.value, rx.value, zoom.value, half);
        const d = Math.hypot(p.sx - e.x, p.sy - e.y) - p.z * 12;
        if (d < bestD) {
          bestD = d;
          best = c.id;
        }
      }
      // Too far from every part: back to the whole brain.
      scheduleOnRN(onSelect, best && bestD < size * 0.2 ? (best as RegionId) : null);
    });
  const gesture = Gesture.Race(Gesture.Simultaneous(pan, pinch), tap);

  return (
    <GestureHandlerRootView style={{ width: size, height: size }}>
      <GestureDetector gesture={gesture}>
        <View style={{ width: size, height: size }} accessibilityLabel="Tali's brain in 3D. Drag to spin, pinch to zoom, tap a part to see what is in it.">
          {/* The lines between parts only show on the whole brain, so a picked part stays clean. */}
          {selected || lit ? null : linkPairs.map((l) => (
            <LinkView key={l.key} a={l.a} b={l.b} spin={spin} half={half} strength={l.strength} />
          ))}
          {BRAIN.dots.map((d, i) => (
            <DotView
              key={i}
              d={d}
              spin={spin}
              half={half}
              scale={scale}
              glow={glow[d.region]}
              colour={REGIONS[d.region].colour}
              mode={lit ? (lit.includes(d.region) ? 'on' : 'off') : selected == null ? 'all' : selected === d.region ? 'on' : 'off'}
              ph={(i * 2.399) % 6.283}
            />
          ))}
          {still ? null : Array.from({ length: SPARKS }, (_, i) => (
            <SparkView key={`spark-${i}`} i={i} spin={spin} half={half} scale={scale} pool={poolSV} pace={paceSV} />
          ))}
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  dot: { position: 'absolute', left: 0, top: 0 },
  ring: { position: 'absolute' },
  link: { position: 'absolute', left: 0, top: 0, height: 1, backgroundColor: '#EEE9FF', borderRadius: 1 },
  trail: { position: 'absolute', left: 0, top: 0, height: 2.5, borderRadius: 2 },
});
