// Tali's brain on the web, drawn on a canvas (11 Nov 2026, asked for by Taj: "make it EXACTLY how it is
// on the website. Why don't you just copy it over"). This is the website's brain (totality-website
// js/brain-demo.js) carried across line for line: the same dots, the same soft glow, the same sparks
// running to the nearest dots, the same twinkle, breath, spin speed and flick. Only the web has a canvas,
// so the phone apps keep components/BrainGlobe.tsx until a store build adds a drawing library.
//
// What is different from the website, on purpose: no auto tour and no made up memories (the app shows
// the real ones), parts she holds little in sit a little dimmer, and the Today lens can light several parts.
import { useEffect, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { REGIONS, type RegionId } from '@/lib/brain';

type D = { x: number; y: number; z: number; region: RegionId; size: number; ph: number; near: D[]; p?: { sx: number; sy: number; k: number; z: number } };
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

const DEEP: Partial<Record<RegionId, 1>> = { hippocampus: 1, amygdala: 1, thalamus: 1, hypothalamus: 1, basal_ganglia: 1, corpus_callosum: 1 };

export function BrainCanvas(props: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const live = useRef(props);
  live.current = props;
  const focused = useIsFocused();
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  // A new pick sends a burst of sparks into that part, like the website.
  const burst = useRef<RegionId | null>(null);
  const lastSel = useRef<RegionId | null>(props.selected);
  if (props.selected !== lastSel.current) {
    lastSel.current = props.selected;
    burst.current = props.selected;
  }

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    // The dots, each knowing its four nearest, with its own twinkle beat.
    let seed = 42;
    const r = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    const dots: D[] = live.current.dots.map((d) => ({ ...d, ph: r() * 6.283, near: [] }));
    dots.forEach((d, i) => {
      const best: { j: number; dd: number }[] = [];
      for (let j = 0; j < dots.length; j++) {
        if (j === i) continue;
        const o = dots[j];
        const dd = (o.x - d.x) ** 2 + (o.y - d.y) ** 2 + (o.z - d.z) ** 2;
        if (best.length < 4 || dd < best[best.length - 1].dd) {
          best.push({ j, dd });
          best.sort((a, b) => a.dd - b.dd);
          if (best.length > 4) best.pop();
        }
      }
      d.near = best.map((b) => dots[b.j]);
    });
    const byRegion = {} as Record<string, D[]>;
    dots.forEach((d) => (byRegion[d.region] = byRegion[d.region] || []).push(d));
    type Spark = { a: D; b: D; t0: number; dur: number; hops: number };
    const sparks: Spark[] = [];
    let lastSpark = 0;
    let clock = 0;
    const fire = (now: number, region: RegionId | null) => {
      const pool = region && byRegion[region] ? byRegion[region] : dots;
      const a = pool[Math.floor(Math.random() * pool.length)];
      sparks.push({ a, b: a.near[Math.floor(Math.random() * a.near.length)], t0: now, dur: 260 + Math.random() * 240, hops: 3 + Math.floor(Math.random() * 5) });
    };

    // A soft glowing dot per colour, drawn once.
    const sprites = {} as Record<string, HTMLCanvasElement>;
    (Object.keys(REGIONS) as RegionId[]).forEach((id) => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d')!;
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      const col = REGIONS[id].colour;
      grd.addColorStop(0, '#ffffffcc');
      grd.addColorStop(0.1, col);
      grd.addColorStop(0.26, col);
      grd.addColorStop(0.34, col + '55');
      grd.addColorStop(1, col + '00');
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
      sprites[id] = c;
    });

    let ry = 0.6, rx = 0.18, spin = 0, breathe = 1, size = live.current.size, dpr = 1;
    let dragging = false, lastX = 0, lastY = 0, moved = 0, lastInput = 0;
    let proj: { sx: number; sy: number; k: number; z: number; d: D }[] = [];

    const resize = () => {
      size = live.current.size;
      dpr = Math.min(3, window.devicePixelRatio || 1);
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
    };
    const project = (p: { x: number; y: number; z: number }) => {
      const cy = Math.cos(ry), sy = Math.sin(ry), x1 = p.x * cy + p.z * sy, z1 = -p.x * sy + p.z * cy;
      const cx = Math.cos(rx), sx = Math.sin(rx), y2 = p.y * cx - z1 * sx, z2 = p.y * sx + z1 * cx;
      const k = 3.2 / (3.2 - z2), half = size / 2, sc = half * 0.88 * k * breathe;
      return { sx: half + x1 * sc, sy: half - y2 * sc + size * 0.02, k, z: z2 };
    };
    const focusSet = (): RegionId[] | null => {
      const { lit, selected } = live.current;
      return lit && lit.length ? lit : selected ? [selected] : null;
    };
    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      proj = dots.map((d) => {
        const p = project(d);
        d.p = p;
        return { ...p, d };
      });
      proj.sort((a, b) => a.z - b.z);
      const focus = focusSet();
      const scale = size / 400;
      const { glow, links, centres } = live.current;
      // The app's lines between parts that share a name, on the whole brain only.
      if (!focus) {
        ctx.strokeStyle = '#EEE9FF';
        ctx.lineWidth = 1;
        for (const l of links) {
          const a = project(centres[l.a]), b = project(centres[l.b]);
          ctx.globalAlpha = 0.1 + l.strength * 0.3;
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
          ctx.stroke();
        }
      }
      for (let i = 0; i < proj.length; i++) {
        const p = proj[i], d = p.d, on = !!focus && focus.includes(d.region);
        const depth = (p.z + 1.1) / 2.2;
        const base = focus ? (on ? 1 : 0.5) : (DEEP[d.region] ? 1 : 0.9) * (0.7 + 0.3 * (glow[d.region] ?? 0));
        const a = Math.max(0.12, Math.min(1, base * (0.45 + depth * 0.75) * (reduce ? 1 : 0.86 + 0.14 * Math.sin(clock * 0.0021 + d.ph))));
        const rad = d.size * p.k * scale * (on ? 0.95 : 0.78);
        if (on) {
          const g = rad * 6;
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a * 0.5;
          ctx.drawImage(sprites[d.region], p.sx - g / 2, p.sy - g / 2, g, g);
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.globalAlpha = a;
        ctx.fillStyle = REGIONS[d.region].colour;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, rad, 0, Math.PI * 2);
        ctx.fill();
        if (on) {
          ctx.globalAlpha = a * 0.8;
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, rad * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // The sparks: a thin line that fades behind a bright point running to the next dot.
      if (!reduce) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (let s = sparks.length - 1; s >= 0; s--) {
          const sp = sparks[s];
          let t = (clock - sp.t0) / sp.dur;
          if (t >= 1) {
            if (sp.hops > 0 && sp.b.near.length) {
              const nx = sp.b.near[Math.floor(Math.random() * sp.b.near.length)];
              const from = sp.b;
              sp.b = nx === sp.a ? from.near[0] : nx;
              sp.a = from;
              sp.t0 = clock;
              sp.hops--;
              t = 0;
            } else {
              sparks.splice(s, 1);
              continue;
            }
          }
          const A = sp.a.p, B = sp.b.p;
          if (!A || !B) continue;
          const x = A.sx + (B.sx - A.sx) * t, y = A.sy + (B.sy - A.sy) * t;
          const dim = focus && !focus.includes(sp.b.region) ? 0.5 : 1, col = '#FFFFFF'; // 11 Nov 2026: white sparks
          ctx.globalAlpha = 0.5 * dim;
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.2 * scale;
          ctx.beginPath();
          ctx.moveTo(A.sx, A.sy);
          ctx.lineTo(x, y);
          ctx.stroke();
          const g2 = 16 * scale * B.k;
          ctx.globalAlpha = 0.35 * dim;
          ctx.drawImage(sprites[sp.b.region], x - g2 / 2, y - g2 / 2, g2, g2);
          ctx.globalAlpha = 0.95 * dim;
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(x, y, 1.9 * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    const pick = (x: number, y: number): RegionId | null => {
      let best: RegionId | null = null, bd = 22 * 22;
      for (let i = proj.length - 1; i >= 0; i--) {
        const p = proj[i], dx = p.sx - x, dy = p.sy - y, dd = dx * dx + dy * dy;
        if (dd < bd) { bd = dd; best = p.d.region; }
      }
      return best;
    };
    const down = (e: PointerEvent) => { dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      spin = dx * 0.01;
      ry += spin;
      rx = Math.max(-0.8, Math.min(0.8, rx + dy * 0.008));
      lastX = e.clientX;
      lastY = e.clientY;
      lastInput = performance.now();
    };
    const up = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (moved < 6) {
        const rc = canvas.getBoundingClientRect();
        const hit = pick(e.clientX - rc.left, e.clientY - rc.top);
        live.current.onSelect(hit && hit !== live.current.selected ? hit : null);
      }
    };
    const cancel = () => { dragging = false; };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', cancel);

    let visible = true;
    const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => { visible = es[0].isIntersecting; }) : null;
    io?.observe(canvas);
    let raf = 0;
    let prev = 0;
    const frame = (now: number) => {
      // Nothing is drawn while she is off screen, on another tab, or the browser tab is hidden.
      if (visible && focusedRef.current && !document.hidden) {
        if (size !== live.current.size) resize();
        const step = prev ? Math.min(3, (now - prev) / 16.667) : 1; // the website moves per frame at 60 a second
        clock = now;
        if (!reduce) {
          breathe = 1 + 0.014 * Math.sin(now / 1700);
          if (!dragging && Math.abs(spin) > 0.0005) { ry += spin * step; spin *= Math.pow(0.94, step); }
          if (burst.current) { for (let q = 0; q < 8; q++) fire(clock, burst.current); burst.current = null; }
          const want = focusSet();
          if (now - lastSpark > 140 / Math.max(0.4, live.current.speed) && sparks.length < 26) {
            fire(now, want && Math.random() < 0.7 ? want[Math.floor(Math.random() * want.length)] : null);
            lastSpark = now;
          }
        }
        if (!dragging && !reduce && now - lastInput > 2500) ry += 0.0035 * live.current.speed * step;
        draw();
      }
      prev = now;
      raf = requestAnimationFrame(frame);
    };
    resize();
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', cancel);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-label="Tali's brain in 3D. Drag to spin, tap a part to see what is in it."
      role="img"
      style={{ width: props.size, height: props.size, display: 'block', touchAction: 'pan-y', cursor: 'grab' }}
    />
  );
}
