// The owner's rhythm (3 Nov 2026): end of day shutdown, weekly review with three commitments,
// and goals Tali holds you to. Supabase calls for the shutdown, review and goals screens and
// their Today cards. Dates here are the phone's local dates (lib/dates), which match the
// profile timezone for everyone who set the app up on their own phone.
import { supabase } from './supabase';
import { addDays, isoDate, today } from './dates';

// ---------- Settings (profile columns from migration 034) ----------
export type RhythmSettings = { shutdown_time: string; shutdown_push: boolean; review_day: number; review_time: string };

export async function rhythmSettings(): Promise<RhythmSettings> {
  const { data } = await supabase.from('profiles').select('shutdown_time, shutdown_push, review_day, review_time').maybeSingle();
  return {
    shutdown_time: (data as any)?.shutdown_time ?? '21:00:00',
    shutdown_push: (data as any)?.shutdown_push ?? true,
    review_day: (data as any)?.review_day ?? 0,
    review_time: (data as any)?.review_time ?? '17:00:00',
  };
}

export async function saveRhythmSettings(s: Partial<RhythmSettings>) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not signed in');
  const { error } = await supabase.from('profiles').update(s).eq('id', u.user.id);
  if (error) throw error;
}

export const SHUTDOWN_TIMES = ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'];
export const REVIEW_TIMES = ['08:00', '10:00', '12:00', '15:00', '17:00', '19:00'];
export const REVIEW_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ---------- Weeks ----------
// Monday of the week that holds `d` (local).
export function mondayOf(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = x.getDay(); // 0 Sunday
  x.setDate(x.getDate() - ((dow + 6) % 7));
  return x;
}

// "2 Nov to 8 Nov" for a week's Monday.
export function weekLabel(weekStart: string) {
  const s = new Date(`${weekStart}T12:00:00`);
  const e = addDays(s, 6);
  const f = (d: Date) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  return `${f(s)} to ${f(e)}`;
}

// This week's Monday, for the commitments on Today (matches tali_rhythm_context).
export const thisWeekStart = () => isoDate(mondayOf(new Date()));

// The week a review covers: it runs on the review day (0 Sunday to 6 Saturday) and looks back at the
// week ending the day before. Sunday reviews Monday to Sunday of this week; Monday reviews last week.
// Before the review day has come around this week, it is the week that ended at the last review day.
export function reviewWeekStart(reviewDay: number, now = new Date()) {
  const r = new Date(now);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - ((r.getDay() - reviewDay + 7) % 7)); // most recent review day, today included
  return isoDate(mondayOf(addDays(r, -1)));
}

// True on the review day and every day after it until the next one comes around.
export function isReviewDayOrLater(reviewDay: number, reviewTime: string, now = new Date()) {
  if (now.getDay() !== reviewDay) return true; // some other day: the last review day is behind us
  const [h, m] = reviewTime.split(':').map(Number);
  return now.getHours() * 60 + now.getMinutes() >= h * 60 + m;
}

// ---------- Shutdown ----------
export type Shutdown = {
  id: string;
  local_date: string;
  mood: number | null;
  went_well: string | null;
  note: string | null;
  tomorrow: { text: string; reminder_id?: string | null }[];
  tali_line: string | null;
  created_at: string;
};

export const MOODS: { value: number; label: string; emoji: string }[] = [
  { value: 1, label: 'Rough', emoji: '😮‍💨' },
  { value: 2, label: 'Meh', emoji: '😐' },
  { value: 3, label: 'Fine', emoji: '🙂' },
  { value: 4, label: 'Good', emoji: '😊' },
  { value: 5, label: 'Great', emoji: '🤩' },
];

export async function todaysShutdown(): Promise<Shutdown | null> {
  const { data, error } = await supabase
    .from('shutdowns')
    .select('id, local_date, mood, went_well, note, tomorrow, tali_line, created_at')
    .eq('local_date', today())
    .maybeSingle();
  if (error) throw error;
  return (data as Shutdown | null) ?? null;
}

// What tomorrow's three start from: reminders due tomorrow, follow-ups due tomorrow and this week's
// unfinished commitments. Reads reminders and clients the same way Today does.
export async function tomorrowSuggestions(): Promise<string[]> {
  const tomorrow = isoDate(addDays(new Date(), 1));
  const start = new Date(`${tomorrow}T00:00:00`);
  const end = addDays(start, 1);
  const [{ data: rem }, { data: cl }, { data: com }] = await Promise.all([
    supabase.from('reminders').select('text, due_at').is('done_at', null).gte('due_at', start.toISOString()).lt('due_at', end.toISOString()).order('due_at'),
    supabase.from('clients').select('name').eq('next_follow_up', tomorrow).not('status', 'in', '(lost,past)').order('name'),
    supabase.from('commitments').select('text').eq('week_start', thisWeekStart()).is('done_at', null).order('created_at'),
  ]);
  const lines = [
    ...((rem as any[]) ?? []).map((r) => String(r.text)),
    ...((cl as any[]) ?? []).map((c) => `Follow up ${c.name}`),
    ...((com as any[]) ?? []).map((c) => String(c.text)),
  ];
  return Array.from(new Set(lines.map((l) => l.trim()).filter(Boolean)));
}

export type ShutdownResult = { ok: true; tali_line: string; shutdown: Shutdown; remaining?: number | null } | { ok: false; code: string; message: string };

// Saves the day through tali-shutdown (1 credit): the shutdown row, the journal entry, tomorrow's
// reminders and Tali's sign off line.
export async function finishDay(input: { mood: number | null; went_well: string; note: string; tomorrow: string[] }): Promise<ShutdownResult> {
  const { data, error } = await supabase.functions.invoke('tali-shutdown', { body: input });
  if (error) {
    try {
      const b = await (error as any).context?.json?.();
      if (b?.message) return { ok: false, code: b.code ?? 'error', message: b.message };
    } catch {}
    return { ok: false, code: 'network', message: "I couldn't reach Tali. Check your connection and try again." };
  }
  return data as ShutdownResult;
}

// ---------- Weekly review ----------
export type ReviewContent = {
  headline: string;
  moved: string[];
  money: string;
  quiet: string[];
  kept: string[];
  missed: string[];
  tali_says: string;
  suggested_commitments: string[];
};
export type Review = { id: string; week_start: string; content: ReviewContent; created_at: string };

export async function reviews(limit = 12): Promise<Review[]> {
  const { data, error } = await supabase.from('reviews').select('id, week_start, content, created_at').order('week_start', { ascending: false }).limit(limit);
  if (error) throw error;
  return ((data as any[]) ?? []).map((r) => ({ ...r, content: normaliseReview(r.content) }));
}

export async function reviewFor(weekStart: string): Promise<Review | null> {
  const { data, error } = await supabase.from('reviews').select('id, week_start, content, created_at').eq('week_start', weekStart).maybeSingle();
  if (error) throw error;
  return data ? { ...(data as any), content: normaliseReview((data as any).content) } : null;
}

function normaliseReview(c: any): ReviewContent {
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  return {
    headline: String(c?.headline ?? ''),
    moved: arr(c?.moved),
    money: String(c?.money ?? ''),
    quiet: arr(c?.quiet),
    kept: arr(c?.kept),
    missed: arr(c?.missed),
    tali_says: String(c?.tali_says ?? ''),
    suggested_commitments: arr(c?.suggested_commitments),
  };
}

export type ReviewResult = { ok: true; review: Review; week_start: string; next_week_start: string; remaining?: number | null } | { ok: false; code: string; message: string };

// Runs the weekly review through tali-review (3 credits) and returns it.
export async function runReview(): Promise<ReviewResult> {
  const { data, error } = await supabase.functions.invoke('tali-review', { body: {} });
  if (error) {
    try {
      const b = await (error as any).context?.json?.();
      if (b?.message) return { ok: false, code: b.code ?? 'error', message: b.message };
    } catch {}
    return { ok: false, code: 'network', message: "I couldn't reach Tali. Check your connection and try again." };
  }
  if (data?.ok && data.review) data.review = { ...data.review, content: normaliseReview(data.review.content) };
  return data as ReviewResult;
}

// ---------- Commitments ----------
export type Commitment = { id: string; week_start: string; text: string; done_at: string | null; created_at: string };

export async function commitmentsFor(weekStart: string): Promise<Commitment[]> {
  const { data, error } = await supabase.from('commitments').select('id, week_start, text, done_at, created_at').eq('week_start', weekStart).order('created_at');
  if (error) throw error;
  return (data as Commitment[]) ?? [];
}

export async function saveCommitments(weekStart: string, lines: string[]) {
  const rows = lines.map((l) => l.trim()).filter(Boolean).slice(0, 3).map((text) => ({ week_start: weekStart, text }));
  if (!rows.length) return;
  const { error } = await supabase.from('commitments').insert(rows);
  if (error) throw error;
}

export async function toggleCommitment(id: string, done: boolean) {
  const { error } = await supabase.from('commitments').update({ done_at: done ? new Date().toISOString() : null }).eq('id', id);
  if (error) throw error;
}

// ---------- Goals ----------
export type Goal = {
  id: string;
  title: string;
  target_number: number | null;
  current_number: number;
  unit: string | null;
  due_date: string | null;
  status: 'active' | 'done' | 'dropped';
  notes: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

const GOAL_COLS = 'id, title, target_number, current_number, unit, due_date, status, notes, last_checked_at, created_at, updated_at';
const numify = (g: any): Goal => ({ ...g, target_number: g.target_number === null ? null : Number(g.target_number), current_number: Number(g.current_number ?? 0) });

export async function goals(status: Goal['status'] | 'all' = 'active'): Promise<Goal[]> {
  let q = supabase.from('goals').select(GOAL_COLS);
  if (status !== 'all') q = q.eq('status', status);
  const { data, error } = await q.order('due_date', { ascending: true, nullsFirst: false }).order('created_at');
  if (error) throw error;
  return ((data as any[]) ?? []).map(numify);
}

export async function activeGoals(limit = 3): Promise<Goal[]> {
  const { data, error } = await supabase.from('goals').select(GOAL_COLS).eq('status', 'active').order('due_date', { ascending: true, nullsFirst: false }).order('created_at').limit(limit);
  if (error) throw error;
  return ((data as any[]) ?? []).map(numify);
}

export async function saveGoal(g: { id?: string; title: string; target_number: number | null; current_number?: number; unit: string | null; due_date: string | null; notes: string | null; status?: Goal['status'] }) {
  const row = {
    title: g.title.trim().slice(0, 120),
    target_number: g.target_number,
    ...(g.current_number !== undefined ? { current_number: g.current_number } : {}),
    unit: g.unit?.trim() || null,
    due_date: g.due_date || null,
    notes: g.notes?.trim() || null,
    ...(g.status ? { status: g.status } : {}),
    last_checked_at: new Date().toISOString(),
  };
  const { error } = g.id ? await supabase.from('goals').update(row).eq('id', g.id) : await supabase.from('goals').insert(row);
  if (error) throw error;
}

export async function setGoalStatus(id: string, status: Goal['status']) {
  const { error } = await supabase.from('goals').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function setGoalProgress(id: string, current_number: number) {
  const { error } = await supabase.from('goals').update({ current_number, last_checked_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

// 0 to 1, or null when there is no target.
export function goalProgress(g: Goal): number | null {
  if (!g.target_number || g.target_number <= 0) return null;
  return Math.max(0, Math.min(1, g.current_number / g.target_number));
}

// Days until the due date (negative when past), or null.
export function daysLeft(g: Goal): number | null {
  if (!g.due_date) return null;
  const due = new Date(`${g.due_date}T12:00:00`).getTime();
  const now = new Date(`${today()}T12:00:00`).getTime();
  return Math.round((due - now) / 86400000);
}

// Behind pace: less of the target done than of the time gone by.
export function behindPace(g: Goal): boolean {
  const p = goalProgress(g);
  const left = daysLeft(g);
  if (p === null || left === null) return false;
  const total = Math.max(1, Math.round((new Date(`${g.due_date}T12:00:00`).getTime() - new Date(g.created_at).getTime()) / 86400000));
  const elapsed = Math.max(0, total - Math.max(0, left));
  return left <= 0 ? p < 1 : p < elapsed / total - 0.1;
}

export function fmtNum(n: number) {
  return Number.isInteger(n) ? n.toLocaleString('en-AU') : n.toLocaleString('en-AU', { maximumFractionDigits: 1 });
}

// "2 of 5 clients", or "A$6,100 of A$8,000" when the unit is a currency sign.
export function goalLine(g: Goal) {
  const money = !!g.unit && /^[A-Z]{0,2}\$$/.test(g.unit.trim());
  const n = (v: number) => (money ? `${g.unit!.trim()}${fmtNum(v)}` : fmtNum(v));
  const unit = g.unit && !money ? ` ${g.unit}` : '';
  if (g.target_number) return `${n(g.current_number)} of ${n(g.target_number)}${unit}`;
  return g.current_number ? `${n(g.current_number)}${unit} so far` : 'No target set';
}
