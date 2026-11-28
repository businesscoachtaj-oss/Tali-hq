// Tali's brain, copied from Tali HQ (lib/brain.ts and components/BrainGlobe.tsx, 25 Nov 2026) so the
// brain games app shows the same brain. Each part lists the games and habits linked with it.
// Honest wording: real skills use many parts of the brain together; we show the part most linked
// with each skill, not a claim that a game trains or grows that part.
export type RegionId =
  | 'frontal'
  | 'prefrontal'
  | 'parietal'
  | 'temporal'
  | 'occipital'
  | 'cerebellum'
  | 'hippocampus'
  | 'amygdala'
  | 'thalamus'
  | 'hypothalamus'
  | 'basal_ganglia'
  | 'brainstem'
  | 'corpus_callosum';

export type Region = { name: string; human: string; colour: string; games: string[]; does: string; kid: string; kidName: string; tip: string };
export const REGIONS: Record<RegionId, Region> = {
  frontal: { name: 'Frontal lobe', human: 'Self-control and judgement', colour: '#5B4BB0', games: ['Stop Go', 'Frog Stop'], kidName: 'Stop and think part', does: 'Helps you hold back, wait your turn and choose instead of react.', kid: 'It helps you wait and think before you act.', tip: 'When you feel rushed, count to three before you answer.' },
  prefrontal: { name: 'Prefrontal cortex', human: 'Planning and problem solving', colour: '#8A4FB8', games: ['Four by Four'], kidName: 'Planning part', does: 'Holds a few ideas in mind at once, sorts them and makes a plan.', kid: 'It helps you plan and solve puzzles.', tip: 'Break a big job into the first small step.' },
  parietal: { name: 'Parietal lobe', human: 'Numbers and where things are', colour: '#2C7FA8', games: ['Sums', 'Count Up'], kidName: 'Numbers part', does: 'Works with numbers, maps and where your body is in space.', kid: 'It helps you count and find your way.', tip: 'Do a sum in your head before you reach for the calculator.' },
  temporal: { name: 'Temporal lobe', human: 'Language and words', colour: '#C27A1E', games: ['Six Tries', 'Trail', 'Word Hop'], kidName: 'Words part', does: 'Understands words and sounds, and helps you find the right word.', kid: 'It helps you listen, talk and read.', tip: 'Read something a bit harder than usual.' },
  occipital: { name: 'Occipital lobe', human: 'Seeing', colour: '#2E8A63', games: ['Spot'], kidName: 'Seeing part', does: 'Turns light from your eyes into shapes, colours and movement.', kid: 'It helps you see.', tip: 'Look for one thing you have never noticed on a walk you know well.' },
  cerebellum: { name: 'Cerebellum', human: 'Timing and coordination', colour: '#B8487A', games: ['Keys'], kidName: 'Balance part', does: 'Keeps your movements smooth, steady and on time.', kid: 'It helps you balance, dance and catch a ball.', tip: 'Try standing on one foot while you brush your teeth.' },
  hippocampus: { name: 'Hippocampus', human: 'Memory', colour: '#4060B0', games: ['Recall', 'Pairs'], kidName: 'Memory part', does: 'Turns today into memories, and helps you find your way around.', kid: 'It helps you remember.', tip: 'Tonight, think back over three good things from today.' },
  amygdala: { name: 'Amygdala', human: 'Feelings', colour: '#C0453A', games: ['Read the Room', 'Feelings'], kidName: 'Feelings part', does: 'Notices danger and strong feelings, and gives them weight.', kid: 'It helps you notice how you feel.', tip: 'Name the feeling. Putting it into words helps it settle.' },
  thalamus: { name: 'Thalamus', human: 'Paying attention', colour: '#A8841C', games: ['Focus'], kidName: 'Paying attention part', does: 'Passes messages from your senses on, and helps you tune out the rest.', kid: 'It helps you pay attention.', tip: 'Put your phone in another room for one task.' },
  hypothalamus: { name: 'Hypothalamus', human: 'Sleep and your body clock', colour: '#C2652E', games: ['Wind Down'], kidName: 'Body clock part', does: 'Runs your body clock, hunger, thirst and temperature.', kid: 'It tells you when you are sleepy or hungry.', tip: 'Get some daylight in the first hour after you wake.' },
  basal_ganglia: { name: 'Basal ganglia', human: 'Habits', colour: '#5E8A1E', games: ['Habits'], kidName: 'Habits part', does: 'Turns things you repeat into habits that run without much thought.', kid: 'It helps you get good at things you do again and again.', tip: 'Tie a new habit to one you already have, like reading after dinner.' },
  brainstem: { name: 'Brainstem', human: 'Breathing and staying alert', colour: '#6B7488', games: ['Breathe', 'Balloon'], kidName: 'Breathing part', does: 'Keeps you breathing, your heart beating and you awake.', kid: 'It keeps you breathing, even when you sleep.', tip: 'Breathe out a little longer than you breathe in.' },
  corpus_callosum: { name: 'Corpus callosum', human: 'Joins the two halves', colour: '#5A4E8C', games: ['Mirror'], kidName: 'Bridge part', does: 'A thick bridge of nerves that lets the two halves of your brain work together.', kid: 'It joins the two sides of your brain.', tip: 'Try writing your name with your other hand.' },
};
export const REGION_ORDER: RegionId[] = ['prefrontal', 'frontal', 'temporal', 'parietal', 'occipital', 'cerebellum', 'hippocampus', 'amygdala', 'thalamus', 'hypothalamus', 'basal_ganglia', 'brainstem', 'corpus_callosum'];
export const regionColour = (id: RegionId, _night?: boolean) => REGIONS[id].colour;
export const REGION_FOR_GAME: Record<string, RegionId> = Object.fromEntries((Object.keys(REGIONS) as RegionId[]).flatMap(id => REGIONS[id].games.map(g => [g, id])));

export type P3 = { x: number; y: number; z: number };
export type Dot = P3 & { region: RegionId; size: number };

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

export function makeBrain(): { dots: Dot[]; centres: Record<RegionId, P3> } {
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
