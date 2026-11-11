// Tali's brain on iPhone and Android, drawn with Skia (11 Nov 2026, asked for by Taj: "That's perfect,
// let's do it for the apps"). The same brain as the web app and the website: the web file next to this
// one (BrainCanvas.web.tsx) draws it on a browser canvas, and this one draws the same picture, frame by
// frame, on a Skia canvas. Same dots, glow, sparks, twinkle, breath, spin speed and flick.
// Skia is a native library, so this first ships in the 1.0.2 store builds, not over the air to 1.0.1.
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { BlendMode, Canvas, PaintStyle, Picture, Skia, StrokeCap, TileMode, createPicture } from '@shopify/react-native-skia';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useDerivedValue, useFrameCallback, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { REGIONS, type RegionId } from '@/lib/brain';

type Props = {
  size: number;
  dots: { x: number; y: number; z: number; region: RegionId; size: number }[];
  centres: Record<RegionId, { x: number; y: number; z: number }>;
  glow: Record<RegionId, number>;
  links: { a: RegionId; b: RegionId; strength: number }[];
  selected: RegionId | null;
  lit?: RegionId[] | null;
  onSelect: (id: RegionId | null) => void;
  speed: number;
};

const IDS = Object.keys(REGIONS) as RegionId[];
const DEEP_IDS: RegionId[] = ['hippocampus', 'amygdala', 'thalamus', 'hypothalamus', 'basal_ganglia', 'corpus_callosum'];
/** Each spark is five numbers in one flat list: from dot, to dot, start time, how long, hops left. */
const SP = 5;
const MAX_SPARKS = 26;

export function BrainCanvas({ size, dots, centres, glow, links, selected, lit, onSelect, speed }: Props) {
  const still = useReducedMotion();
  const focused = useIsFocused();

  // Flat lists the drawing can read on the UI thread, built once. Same seed as the web brain.
  const shape = useMemo(() => {
    let seed = 42;
    const r = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    const pts: number[] = [], reg: number[] = [], sizes: number[] = [], ph: number[] = [], near: number[] = [];
    dots.forEach((d) => {
      pts.push(d.x, d.y, d.z);
      reg.push(IDS.indexOf(d.region));
      sizes.push(d.size);
      ph.push(r() * 6.283);
    });
    dots.forEach((d, i) => {
      const order = dots.map((o, j) => ({ j, dd: (o.x - d.x) ** 2 + (o.y - d.y) ** 2 + (o.z - d.z) ** 2 })).filter((o) => o.j !== i).sort((p, q) => p.dd - q.dd);
      for (let k = 0; k < 4; k++) near.push(order[k].j);
    });
    const byRegion: number[][] = IDS.map(() => []);
    reg.forEach((ri, i) => byRegion[ri].push(i));
    const cen: number[] = [];
    IDS.forEach((id) => cen.push(centres[id]?.x ?? 0, centres[id]?.y ?? 0, centres[id]?.z ?? 0));
    return { pts, reg, sizes, ph, near, byRegion, cen, n: dots.length, deep: IDS.map((id) => (DEEP_IDS.includes(id) ? 1 : 0)) };
  }, [dots, centres]);

  // The paints, made once. A soft glow per colour is a round gradient drawn at the origin and moved into place.
  const paints = useMemo(() => {
    const fill = IDS.map((id) => {
      const p = Skia.Paint();
      p.setAntiAlias(true);
      p.setColor(Skia.Color(REGIONS[id].colour));
      return p;
    });
    const glowP = IDS.map((id) => {
      const col = REGIONS[id].colour;
      const p = Skia.Paint();
      p.setAntiAlias(true);
      p.setBlendMode(BlendMode.Plus);
      p.setShader(Skia.Shader.MakeRadialGradient({ x: 0, y: 0 }, 32, [Skia.Color('#ffffffcc'), Skia.Color(col), Skia.Color(col), Skia.Color(col + '55'), Skia.Color(col + '00')], [0, 0.1, 0.26, 0.34, 1], TileMode.Clamp));
      return p;
    });
    const line = IDS.map((id) => {
      const p = Skia.Paint();
      p.setAntiAlias(true);
      p.setStyle(PaintStyle.Stroke);
      p.setStrokeCap(StrokeCap.Round);
      p.setBlendMode(BlendMode.Plus);
      p.setColor(Skia.Color(REGIONS[id].colour));
      return p;
    });
    const white = Skia.Paint();
    white.setAntiAlias(true);
    white.setColor(Skia.Color('#ffffff'));
    const link = Skia.Paint();
    link.setAntiAlias(true);
    link.setStyle(PaintStyle.Stroke);
    link.setStrokeWidth(1);
    link.setColor(Skia.Color('#EEE9FF'));
    return { fill, glowP, line, white, link };
  }, []);

  // Everything that moves.
  const ry = useSharedValue(0.6);
  const rx = useSharedValue(0.18);
  const spin = useSharedValue(0);
  const breathe = useSharedValue(1);
  const clock = useSharedValue(0);
  const lastInput = useSharedValue(-10000);
  const lastSpark = useSharedValue(0);
  const dragging = useSharedValue(false);
  const lastX = useSharedValue(0);
  const lastY = useSharedValue(0);
  // 11 Nov 2026 (Taj: "you can't rotate and spin the brain or pinch to zoom"): pinch to zoom, 0.7 to 2.2.
  const zoom = useSharedValue(1);
  const startZoom = useSharedValue(1);
  const sparks = useSharedValue<number[]>([]);
  const burst = useSharedValue(-1);
  // What the screen asked for, kept in shared values so the drawing sees a change straight away.
  const focusList = useSharedValue<number[]>([]);
  const glowList = useSharedValue<number[]>(IDS.map(() => 0));
  const linkList = useSharedValue<number[]>([]);
  const pace = useSharedValue(1);
  const selectedIdx = useSharedValue(-1);

  useEffect(() => {
    const want = lit && lit.length ? lit : selected ? [selected] : [];
    focusList.value = want.map((id) => IDS.indexOf(id));
    if (selected && IDS.indexOf(selected) !== selectedIdx.value) burst.value = IDS.indexOf(selected);
    selectedIdx.value = selected ? IDS.indexOf(selected) : -1;
  }, [lit, selected, focusList, burst, selectedIdx]);
  useEffect(() => {
    glowList.value = IDS.map((id) => glow[id] ?? 0);
  }, [glow, glowList]);
  useEffect(() => {
    const flat: number[] = [];
    links.forEach((l) => flat.push(IDS.indexOf(l.a), IDS.indexOf(l.b), l.strength));
    linkList.value = flat;
  }, [links, linkList]);
  useEffect(() => {
    pace.value = speed;
  }, [speed, pace]);

  const { pts, reg, sizes, ph, near, byRegion, cen, n, deep } = shape;

  // One step of her life, every frame: breathe, ease out of a flick, fire and move sparks, turn slowly.
  const frames = useFrameCallback((f) => {
    const dt = f.timeSincePreviousFrame ?? 16.667;
    const step = Math.min(3, dt / 16.667); // the website moves per frame at 60 a second
    const now = clock.value + dt;
    if (!still) {
      breathe.value = 1 + 0.014 * Math.sin(now / 1700);
      if (!dragging.value && Math.abs(spin.value) > 0.0005) {
        ry.value += spin.value * step;
        spin.value *= Math.pow(0.94, step);
      }
      const list = sparks.value.slice();
      const fire = (region: number) => {
        const pool = region >= 0 && byRegion[region].length ? byRegion[region] : null;
        const a = pool ? pool[Math.floor(Math.random() * pool.length)] : Math.floor(Math.random() * n);
        list.push(a, near[a * 4 + Math.floor(Math.random() * 4)], now, 260 + Math.random() * 240, 3 + Math.floor(Math.random() * 5));
      };
      if (burst.value >= 0) {
        for (let q = 0; q < 8; q++) fire(burst.value);
        burst.value = -1;
      }
      const want = focusList.value;
      if (now - lastSpark.value > 140 / Math.max(0.4, pace.value) && list.length / SP < MAX_SPARKS) {
        fire(want.length && Math.random() < 0.7 ? want[Math.floor(Math.random() * want.length)] : -1);
        lastSpark.value = now;
      }
      // Move each spark on: the next hop when it lands, gone when it has no hops left.
      const kept: number[] = [];
      for (let s = 0; s < list.length; s += SP) {
        let a = list[s], b = list[s + 1], t0 = list[s + 2], hops = list[s + 4];
        if ((now - t0) / list[s + 3] >= 1) {
          if (hops <= 0) continue;
          const nx = near[b * 4 + Math.floor(Math.random() * 4)];
          const from = b;
          b = nx === a ? near[from * 4] : nx;
          a = from;
          t0 = now;
          hops -= 1;
        }
        kept.push(a, b, t0, list[s + 3], hops);
      }
      sparks.value = kept;
      if (!dragging.value && now - lastInput.value > 2500) ry.value += 0.0035 * pace.value * step;
    }
    clock.value = now;
  });
  // Nothing moves while you are on another tab.
  useEffect(() => {
    frames.setActive(focused);
  }, [focused, frames]);

  const picture = useDerivedValue(() => {
    const yaw = ry.value, pitch = rx.value, br = breathe.value * zoom.value, now = clock.value;
    const focus = focusList.value, gl = glowList.value, ln = linkList.value, sp = sparks.value;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch);
    const half = size / 2, scale = (size / 400) * zoom.value;
    // Where every dot lands on screen this frame.
    const px: number[] = new Array(n), py: number[] = new Array(n), pk: number[] = new Array(n), pz: number[] = new Array(n);
    const proj = (x: number, y: number, z: number) => {
      const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
      const y2 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;
      const k = 3.2 / (3.2 - z2), sc = half * 0.88 * k * br;
      return [half + x1 * sc, half - y2 * sc + size * 0.02, k, z2];
    };
    const order: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const p = proj(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
      px[i] = p[0]; py[i] = p[1]; pk[i] = p[2]; pz[i] = p[3];
      order[i] = i;
    }
    order.sort((a, b) => pz[a] - pz[b]);
    const hasFocus = focus.length > 0;
    return createPicture((c) => {
      // The lines between parts that share a name, on the whole brain only.
      if (!hasFocus) {
        for (let l = 0; l < ln.length; l += 3) {
          const a = proj(cen[ln[l] * 3], cen[ln[l] * 3 + 1], cen[ln[l] * 3 + 2]);
          const b = proj(cen[ln[l + 1] * 3], cen[ln[l + 1] * 3 + 1], cen[ln[l + 1] * 3 + 2]);
          paints.link.setAlphaf(0.1 + ln[l + 2] * 0.3);
          c.drawLine(a[0], a[1], b[0], b[1], paints.link);
        }
      }
      for (let o = 0; o < n; o++) {
        const i = order[o], ri = reg[i];
        const on = hasFocus && focus.indexOf(ri) >= 0;
        const depth = (pz[i] + 1.1) / 2.2;
        const base = hasFocus ? (on ? 1 : 0.5) : (deep[ri] ? 1 : 0.9) * (0.7 + 0.3 * (gl[ri] ?? 0));
        const a = Math.max(0.12, Math.min(1, base * (0.45 + depth * 0.75) * (still ? 1 : 0.86 + 0.14 * Math.sin(now * 0.0021 + ph[i]))));
        const rad = sizes[i] * pk[i] * scale * (on ? 0.95 : 0.78);
        if (on) {
          const g = rad * 6;
          paints.glowP[ri].setAlphaf(a * 0.5);
          c.save();
          c.translate(px[i], py[i]);
          c.scale(g / 64, g / 64);
          c.drawCircle(0, 0, 32, paints.glowP[ri]);
          c.restore();
        }
        paints.fill[ri].setAlphaf(a);
        c.drawCircle(px[i], py[i], rad, paints.fill[ri]);
        if (on) {
          paints.white.setAlphaf(a * 0.8);
          c.drawCircle(px[i], py[i], rad * 0.45, paints.white);
        }
      }
      // The sparks: a thin line that fades behind a bright point running to the next dot.
      if (!still) {
        for (let s = 0; s < sp.length; s += SP) {
          const a = sp[s], b = sp[s + 1];
          const t = Math.max(0, Math.min(1, (now - sp[s + 2]) / sp[s + 3]));
          const x = px[a] + (px[b] - px[a]) * t, y = py[a] + (py[b] - py[a]) * t;
          const rb = reg[b];
          const dim = hasFocus && focus.indexOf(rb) < 0 ? 0.5 : 1;
          // 11 Nov 2026 (Taj liked the mock's brain): the sparks are white, a thin streak with a bright point.
          paints.link.setStrokeWidth(1.2 * scale);
          paints.link.setAlphaf(0.6 * dim);
          c.drawLine(px[a], py[a], x, y, paints.link);
          paints.link.setStrokeWidth(1);
          paints.white.setAlphaf(0.95 * dim);
          c.drawCircle(x, y, 1.9 * scale, paints.white);
          const g2 = 16 * scale * pk[b];
          paints.glowP[rb].setAlphaf(0.35 * dim);
          c.save();
          c.translate(x, y);
          c.scale(g2 / 64, g2 / 64);
          c.drawCircle(0, 0, 32, paints.glowP[rb]);
          c.restore();
        }
      }
    }, { width: size, height: size });
  });

  // The part under a tap: the nearest dot within 22 points, front of the brain first. Same as the web.
  const pick = (x: number, y: number) => {
    'worklet';
    const cy = Math.cos(ry.value), sy = Math.sin(ry.value), cx = Math.cos(rx.value), sx = Math.sin(rx.value);
    const half = size / 2;
    let best = -1, bd = 22 * 22, bz = -10;
    for (let i = 0; i < n; i++) {
      const x1 = pts[i * 3] * cy + pts[i * 3 + 2] * sy, z1 = -pts[i * 3] * sy + pts[i * 3 + 2] * cy;
      const y2 = pts[i * 3 + 1] * cx - z1 * sx, z2 = pts[i * 3 + 1] * sx + z1 * cx;
      const sc = half * 0.88 * (3.2 / (3.2 - z2)) * breathe.value * zoom.value;
      const dx = half + x1 * sc - x, dy = half - y2 * sc + size * 0.02 - y, dd = dx * dx + dy * dy;
      if (dd < 22 * 22 && (z2 > bz || (z2 === bz && dd < bd))) { bz = z2; bd = dd; best = reg[i]; }
    }
    return best;
  };
  const report = (ri: number) => {
    const hit = ri >= 0 ? IDS[ri] : null;
    onSelect(hit && hit !== selected ? hit : null);
  };

  // A sideways drag spins her (and once it has started, up and down tilts her). A drag that starts
  // up or down is left to the page, so you can still scroll past her.
  const pan = Gesture.Pan()
    .maxPointers(1)
    .activeOffsetX([-6, 6])
    .failOffsetY([-18, 18])
    .onStart(() => {
      dragging.value = true;
      lastX.value = 0;
      lastY.value = 0;
    })
    .onUpdate((e) => {
      const dx = e.translationX - lastX.value, dy = e.translationY - lastY.value;
      spin.value = dx * 0.01;
      ry.value += spin.value;
      rx.value = Math.max(-0.8, Math.min(0.8, rx.value + dy * 0.008));
      lastX.value = e.translationX;
      lastY.value = e.translationY;
      lastInput.value = clock.value;
    })
    .onFinalize(() => {
      dragging.value = false;
    });
  const tap = Gesture.Tap()
    .maxDistance(8)
    .onEnd((e) => {
      scheduleOnRN(report, pick(e.x, e.y));
    });
  const pinch = Gesture.Pinch()
    .onStart(() => {
      dragging.value = true;
      startZoom.value = zoom.value;
    })
    .onUpdate((e) => {
      zoom.value = Math.max(0.7, Math.min(2.2, startZoom.value * e.scale));
      lastInput.value = clock.value;
    })
    .onFinalize(() => {
      dragging.value = false;
    });
  const gesture = Gesture.Race(Gesture.Simultaneous(pan, pinch), tap);

  return (
    <GestureHandlerRootView style={{ width: size, height: size }}>
      <GestureDetector gesture={gesture}>
        <View style={{ width: size, height: size }} accessibilityLabel="Tali's brain in 3D. Drag to spin, pinch to zoom, tap a part to see what is in it.">
          <Canvas style={{ width: size, height: size }}>
            <Picture picture={picture} />
          </Canvas>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}
