// lib/trackerMath.ts
// ADDED (17 Nov 2026, Taj): the one place tracker numbers are worked out. The home tiles and the
// history page both use this, so they always agree. Plain maths, no AI, never costs credits.
//
// A tracker's log comes from the database as a number per day ("2026-11-17": 1.5) plus the sum of
// everything before the first day sent. From that: this period's number, the last 7 days, streaks,
// records and the pace toward a goal in total.

export type TrackerType = 'count' | 'yesno' | 'money' | 'time' | 'scale';
export type Period = 'day' | 'week' | 'month' | 'total';
export type Days = Record<string, number>;
export type Mathable = { type: TrackerType; period: Period; target: number | null; startValue?: number; countDown?: boolean; restDay?: boolean };

const pad = (n: number) => String(n).padStart(2, '0');
export const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dateOf = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const shift = (k: string, n: number) => { const d = dateOf(k); d.setDate(d.getDate() + n); return keyOf(d); };
export const todayKey = () => keyOf(new Date());
/** Monday of the week a day is in. */
export const weekStart = (k: string) => { const d = dateOf(k); return shift(k, -((d.getDay() + 6) % 7)); };
export const monthStart = (k: string) => `${k.slice(0, 8)}01`;
export const daysBetween = (a: string, b: string) => Math.round((dateOf(b).getTime() - dateOf(a).getTime()) / 86400000);

function range(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to; k = shift(k, 1)) out.push(k);
  return out;
}
const sum = (days: Days, from: string, to: string) => range(from, to).reduce((s, k) => s + (days[k] ?? 0), 0);
const logged = (days: Days, from: string, to: string) => range(from, to).filter((k) => days[k] != null && days[k] !== 0);

/** Where a tracker is at for the period that holds `day`. */
export function valueOn(t: Mathable, days: Days, before: number, day: string): number {
  if (t.period === 'total') {
    const all = before + Object.entries(days).reduce((s, [k, v]) => (k <= day ? s + v : s), 0);
    return t.countDown ? (t.startValue ?? 0) - all : (t.startValue ?? 0) + all;
  }
  const from = t.period === 'day' ? day : t.period === 'week' ? weekStart(day) : monthStart(day);
  if (t.type === 'scale') {
    const ks = logged(days, from, day);
    return ks.length ? ks.reduce((s, k) => s + days[k], 0) / ks.length : 0;
  }
  if (t.type === 'yesno') return t.period === 'day' ? (days[day] ? 1 : 0) : logged(days, from, day).length;
  return sum(days, from, day);
}

/** How far through the target, 0 to 1 and beyond. A countdown fills as it gets closer to zero. */
export function progress(t: Mathable, value: number): number {
  if (t.countDown) {
    const start = t.startValue ?? 0, goal = t.target ?? 0;
    return start > goal ? (start - value) / (start - goal) : 0;
  }
  if (t.type === 'yesno' && t.period === 'day') return value ? 1 : 0;
  return t.target ? value / t.target : 0;
}

/** The last `n` days ending on `day`, oldest first. A total shows where it stood at the end of each day. */
export function series(t: Mathable, days: Days, before: number, day: string, n = 7): number[] {
  const ks = range(shift(day, -(n - 1)), day);
  if (t.period === 'total') return ks.map((k) => valueOn(t, days, before, k));
  return ks.map((k) => days[k] ?? 0);
}

/** Did this day count? Its own target met, or for a yes or no, a yes. */
export function dayMet(t: Mathable, days: Days, k: string): boolean {
  const v = days[k] ?? 0;
  if (t.type === 'yesno' || t.type === 'scale') return v > 0;
  if (t.period === 'day' && t.target) return v >= t.target;
  return v > 0;
}

export type Streak = { now: number; best: number; unit: 'day' | 'week' };

/**
 * Streaks. Daily targets and yes or no trackers make a streak of days. A weekly target makes a
 * streak of weeks. With a rest day switched on, one missed day in a week does not break it.
 * Today (or this week) not being done yet never breaks a streak: it only adds once it is done.
 */
export function streaks(t: Mathable, days: Days, day: string): Streak {
  const keys = Object.keys(days).filter((k) => k <= day).sort();
  if (!keys.length) return { now: 0, best: 0, unit: t.period === 'week' ? 'week' : 'day' };
  const first = keys[0];
  if (t.period === 'week') {
    const met = (w: string) => {
      const v = t.type === 'yesno' ? logged(days, w, shift(w, 6)).length : sum(days, w, shift(w, 6));
      return t.target ? v >= t.target : v > 0;
    };
    let best = 0, run = 0, now = 0;
    const thisWeek = weekStart(day);
    for (let w = weekStart(first); w <= thisWeek; w = shift(w, 7)) {
      if (met(w)) { run++; best = Math.max(best, run); }
      else if (w !== thisWeek) run = 0;
      now = run;
    }
    return { now, best, unit: 'week' };
  }
  let best = 0, run = 0, now = 0;
  let restWeek = '', restUsed = false;
  for (let k = first; k <= day; k = shift(k, 1)) {
    const w = weekStart(k);
    if (w !== restWeek) { restWeek = w; restUsed = false; }
    if (dayMet(t, days, k)) { run++; best = Math.max(best, run); }
    else if (k === day) { /* not done yet today */ }
    else if (t.restDay && !restUsed) restUsed = true;
    else run = 0;
    now = run;
  }
  return { now, best, unit: 'day' };
}

export type Records = {
  bestDay: { day: string; value: number } | null;
  bestWeek: { week: string; value: number } | null;
  average: number | null;       // per logged day
  hit: { met: number; of: number } | null; // target met X of the last Y days (or weeks)
};

export function records(t: Mathable, days: Days, day: string): Records {
  const keys = Object.keys(days).filter((k) => k <= day && days[k]).sort();
  if (!keys.length) return { bestDay: null, bestWeek: null, average: null, hit: null };
  let bestDay: Records['bestDay'] = null;
  const weeks: Record<string, number> = {};
  for (const k of keys) {
    if (!bestDay || days[k] > bestDay.value) bestDay = { day: k, value: days[k] };
    const w = weekStart(k);
    weeks[w] = (weeks[w] ?? 0) + (t.type === 'yesno' ? 1 : days[k]);
  }
  let bestWeek: Records['bestWeek'] = null;
  for (const [w, v] of Object.entries(weeks)) if (!bestWeek || v > bestWeek.value) bestWeek = { week: w, value: v };
  const average = keys.reduce((s, k) => s + days[k], 0) / keys.length;
  let hit: Records['hit'] = null;
  if (t.period === 'week' && t.target) {
    const ws = Array.from({ length: 8 }, (_, i) => shift(weekStart(day), -7 * i)).filter((w) => w >= weekStart(keys[0]));
    hit = { met: ws.filter((w) => (weeks[w] ?? 0) >= t.target!).length, of: ws.length };
  } else if (t.period === 'day') {
    const ks = range(shift(day, -29), day).filter((k) => k >= keys[0]);
    hit = { met: ks.filter((k) => dayMet(t, days, k)).length, of: ks.length };
  }
  if (t.type === 'scale' || t.type === 'yesno') bestDay = null;
  if (t.type === 'scale') bestWeek = null;
  return { bestDay, bestWeek, average: t.type === 'yesno' ? null : average, hit };
}

/**
 * Pace toward a goal in total: from the last 8 weeks, the day it lands. Null when there is no
 * target, it is already there, or nothing has moved the right way in those 8 weeks.
 */
export function pace(t: Mathable, days: Days, before: number, day: string): { perWeek: number; lands: string } | null {
  if (t.period !== 'total' || t.target == null) return null;
  const now = valueOn(t, days, before, day);
  const left = t.countDown ? now - t.target : t.target - now;
  if (left <= 0) return null;
  const from = shift(day, -55);
  const firstLog = Object.keys(days).sort()[0];
  if (!firstLog) return null;
  const span = Math.max(7, Math.min(56, daysBetween(firstLog < from ? from : firstLog, day) + 1));
  const moved = sum(days, shift(day, -(span - 1)), day);
  if (moved <= 0) return null;
  const perDay = moved / span;
  const lands = shift(day, Math.ceil(left / perDay));
  return { perWeek: perDay * 7, lands };
}

export type Bar = { key: string; label: string; value: number; now?: boolean };

/** The chart for a range. Bars by day, week or month; a total draws its running line from the same points. */
export function chart(t: Mathable, days: Days, before: number, day: string, span: 'week' | 'month' | 'year' | 'all', firstDay?: string): Bar[] {
  const D = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const total = t.period === 'total';
  const at = (k: string) => (total ? valueOn(t, days, before, k) : days[k] ?? 0);
  const over = (from: string, to: string) => {
    if (total) return valueOn(t, days, before, to > day ? day : to);
    if (t.type === 'scale') { const ks = logged(days, from, to); return ks.length ? ks.reduce((s, k) => s + days[k], 0) / ks.length : 0; }
    if (t.type === 'yesno') return logged(days, from, to).length;
    return sum(days, from, to);
  };
  if (span === 'week') {
    const start = weekStart(day);
    return range(start, shift(start, 6)).map((k, i) => ({ key: k, label: D[i], value: k > day ? 0 : at(k), now: k === day }));
  }
  if (span === 'month') {
    return range(shift(day, -29), day).map((k) => ({ key: k, label: dateOf(k).getDate() === 1 || k === day ? String(dateOf(k).getDate()) : dateOf(k).getDate() % 5 === 0 ? String(dateOf(k).getDate()) : '', value: at(k), now: k === day }));
  }
  if (span === 'year') {
    const out: Bar[] = [];
    const d = dateOf(monthStart(day));
    d.setMonth(d.getMonth() - 11);
    for (let i = 0; i < 12; i++) {
      const from = keyOf(d);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      out.push({ key: from, label: mon[d.getMonth()][0], value: over(from, keyOf(end)), now: i === 11 });
      d.setMonth(d.getMonth() + 1);
    }
    return out;
  }
  // All: by month from the first log, capped at the last 36 months.
  const keys = Object.keys(days).sort();
  const first = keys[0] ?? firstDay ?? day;
  const out: Bar[] = [];
  const d = dateOf(monthStart(first));
  const stop = dateOf(monthStart(day));
  while (d <= stop) {
    const from = keyOf(d);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    out.push({ key: from, label: d.getMonth() === 0 ? String(d.getFullYear()).slice(2) : mon[d.getMonth()][0], value: over(from, keyOf(end)), now: d.getTime() === stop.getTime() });
    d.setMonth(d.getMonth() + 1);
  }
  return out.slice(-36);
}

/** Behind where a steady pace would have you by now? Used for the set-wording nudge. Null when on track or no target. */
export function behind(t: Mathable, value: number, day: string, hour: number): { expected: number } | null {
  if (!t.target || t.countDown || t.type === 'scale' || t.period === 'total') return null;
  let through = 0;
  if (t.period === 'day') { if (hour < 15) return null; through = Math.min(1, (hour - 6) / 15); }
  if (t.period === 'week') { const d = (dateOf(day).getDay() + 6) % 7; if (d < 2) return null; through = (d + (hour >= 18 ? 1 : 0.5)) / 7; }
  if (t.period === 'month') { const dt = dateOf(day); const len = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate(); if (dt.getDate() < 8) return null; through = dt.getDate() / len; }
  const expected = t.target * through;
  return value < expected * 0.7 ? { expected } : null;
}
