// Easy, Medium and Hard for every game (25 Nov 2026, Taj). Each level of a daily puzzle is the same for
// everyone that day. Timed games also speed up the longer you last, on every level.
import type { Level } from './store';

export const LEVEL_NAME: Record<Level, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
export const KIDS_LEVEL_NAME: Record<Level, string> = { easy: '🐣 Easy', medium: '🐥 Medium', hard: '🦅 Hard' };
const L = <T,>(easy: T, medium: T, hard: T) => ({ easy, medium, hard });

export const P = {
  six: L({ len: 5, tries: 7, hint: true, strict: false }, { len: 5, tries: 6, hint: false, strict: false }, { len: 6, tries: 6, hint: false, strict: true }),
  'word-hop': L({ len: 3, tries: 5 }, { len: 4, tries: 5 }, { len: 5, tries: 6 }),
  four: L({ groups: 3, slips: 99, tiers: [1, 1, 1] }, { groups: 4, slips: 4, tiers: [1, 1, 2, 3] }, { groups: 4, slips: 3, tiers: [2, 2, 3, 3] }),
  trail: L({ cols: 5, rows: 6, firstLetters: true }, { cols: 6, rows: 8, firstLetters: false }, { cols: 7, rows: 8, firstLetters: false }),
  keys: L({ speed: 150, ramp: 5, gap: 1.05, chords: false }, { speed: 185, ramp: 8, gap: 0.85, chords: false }, { speed: 230, ramp: 11, gap: 0.65, chords: true }),
  recall: L({ size: 3, start: 2, ms: 850 }, { size: 4, start: 3, ms: 600 }, { size: 5, start: 4, ms: 450 }),
  sums: L({ tiles: 6, pick: [2, 2, 2, 3, 3], top: 9, clock: 0 }, { tiles: 9, pick: [3, 3, 4, 4, 4], top: 15, clock: 0 }, { tiles: 12, pick: [3, 4, 4, 5, 5], top: 30, clock: 30 }),
  'count-up': L({ tiles: 4, pick: [2, 2, 2, 2, 2], top: 5, clock: 0 }, { tiles: 6, pick: [2, 2, 3, 3, 3], top: 9, clock: 0 }, { tiles: 8, pick: [3, 3, 3, 4, 4], top: 12, clock: 0 }),
  stop: L({ ms: 1100, stop: 0.22, turns: 30 }, { ms: 850, stop: 0.28, turns: 40 }, { ms: 650, stop: 0.35, turns: 50 }),
  frog: L({ ms: 1500, stop: 0.2, turns: 15 }, { ms: 1250, stop: 0.28, turns: 20 }, { ms: 1000, stop: 0.33, turns: 25 }),
  spot: L({ grow: 3, diff: 24, drop: 1.4 }, { grow: 2, diff: 18, drop: 1.3 }, { grow: 1.5, diff: 13, drop: 1.0 }),
  focus: L({ arrows: 3, same: 0.6, limit: 0 }, { arrows: 5, same: 0.45, limit: 0 }, { arrows: 7, same: 0.35, limit: 1400 }),
  room: L({ options: 3 }, { options: 4 }, { options: 5 }),
  feelings: L({ options: 2 }, { options: 3 }, { options: 4 }),
  mirror: L({ sizes: [3, 3, 3, 3, 4, 4], both: false }, { sizes: [3, 3, 4, 4, 5, 5], both: false }, { sizes: [4, 4, 5, 5, 6, 6], both: true }),
  pairs: L({ pairs: 4 }, { pairs: 6 }, { pairs: 8 }),
  breathe: L({ name: 'Calm', pattern: [4, 0, 6, 0] }, { name: 'Box', pattern: [4, 4, 4, 4] }, { name: 'Deep', pattern: [4, 7, 8, 0] }),
};
export const hasLevels = (id: string) => id in P;
