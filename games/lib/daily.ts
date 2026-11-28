// The daily puzzle: everyone gets the same word or challenge on the same day, and it changes by itself
// every day (Taj, 25 Nov 2026). Worked out from the date alone, so it needs no server and works offline.
// The day starts at local midnight. Day 0 is launch day. When a pool runs out it starts again in a new
// order (seeded by the cycle number), so it never repeats in the same order.
export const LAUNCH = '2026-11-01'; // Puzzle No. 1. Set to the real launch day before release.
export function localDate(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function dayNumber(date = localDate()) {
  const [y, m, d] = date.split('-').map(Number);
  const [ly, lm, ld] = LAUNCH.split('-').map(Number);
  return Math.max(0, Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ly, lm - 1, ld)) / 86400000));
}
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function pickDaily<T>(pool: T[], salt: number, date = localDate()): T {
  const day = dayNumber(date); const cycle = Math.floor(day / pool.length); const pos = day % pool.length;
  if (cycle === 0) return pool[pos];
  const r = rng(salt * 100003 + cycle); const order = pool.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return pool[order[pos]];
}
/** A random number source that is the same for everyone today, one per game. */
export const todayRng = (salt: number, date = localDate()) => rng(salt * 7919 + dayNumber(date) * 104729);
export function shuffled<T>(list: T[], r: () => number) {
  const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a;
}
// The web reads ?level= and ?date= from the address. The phone apps have no address bar, so these are always empty there.
export const q = (k: string) => (typeof window !== 'undefined' && window.location?.search != null ? new URLSearchParams(window.location.search).get(k) : null);
export const isDemo = () => q('demo') !== null;
export const demoStep = () => q('demo');
export const prettyDate = (d = new Date()) => d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
