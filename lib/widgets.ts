// lib/widgets.ts
// ADDED (16 Nov 2026, Taj): "Build your HQ". Today is blocks the person adds, removes, resizes and
// moves, one home per mode (and one per extra business). Three kinds of block:
//   - built-in: the parts of Today (Needs you, Due today, Money, Pipeline, the Business blocks...)
//   - trackers: anything they want to keep count of (water, cold calls, savings, reading)
//   - extras: a countdown, a checklist or a note
// BUILT FOR REAL (17 Nov 2026): layouts live in home_layouts, trackers in trackers and
// tracker_entries (migration 20261117000092). This file is the app's one store for all of it.
// Free: 6 blocks and 3 trackers a home, number and bar looks, day or week targets, 7 days of
// history, Countdown and Note. The database checks the same limits.

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { myCredits, type Credits } from './data';
import { hasBusinessTools, isPaid } from './plan';
import type { Mode } from './mode';
import { progress, series, streaks, todayKey, valueOn, type Days, type Period, type TrackerType } from './trackerMath';

export type { Period, TrackerType } from './trackerMath';
export type TrackerStyle = 'ring' | 'bar' | 'number' | 'streak' | 'chart';
export type Size = 'small' | 'wide';
export type Plan = 'free' | 'hq' | 'pro' | 'max' | 'biz';
export type TrackerSource = 'manual' | 'invoices_paid' | 'quotes_sent' | 'jobs_done' | 'bookings' | 'spend' | 'health';

/** What a tracker is, before it has any numbers. Templates, presets and shared layouts carry these. */
export type TrackerSpec = {
  name: string;
  type: TrackerType;
  unit: string;            // 'L', 'calls', 'A$', 'h', 'pages'
  target: number | null;
  period: Period;
  style: TrackerStyle;
  colour: string;
  step?: number | null;    // what one tap of + adds; null asks for the amount
  startValue?: number;
  countDown?: boolean;
  checkIn?: boolean;       // Tali nudges if it falls behind (paid)
  restDay?: boolean;
  source?: TrackerSource;
  preset?: string | null;
  team?: boolean;
};

export type Tracker = TrackerSpec & {
  id: string;
  home: 'life' | 'business' | 'both';
  step: number | null;
  startValue: number;
  countDown: boolean;
  checkIn: boolean;
  restDay: boolean;
  source: TrackerSource;
  team: boolean;
  sharedIn: boolean;       // someone else's team tracker I log to
  ownerName: string | null;
  archivedAt: string | null;
  days: Days;              // my numbers by day
  before: number;
  teamDays?: Days;         // everyone's, for a team tracker
  teamBefore?: number;
  // Worked out by lib/trackerMath.ts:
  value: number;           // this period so far
  week: number[];          // last 7 days, oldest first
  streak: number;
  teamValue?: number;
};

export type BuiltIn =
  | 'needs_you' | 'due' | 'brief' | 'money' | 'calendar' | 'goals' | 'week'
  | 'your_day' | 'habits' | 'people' | 'journal' | 'sleep' | 'pipeline' | 'jobs' | 'invoices' | 'night_idea'
  | 'bills' | 'tali_pick'
  | 'team' | 'leads' | 'cashflow' | 'bookings' | 'visits' | 'quote_rate' | 'happiness';

export type Extra =
  | { type: 'countdown'; title: string; date: string }
  | { type: 'checklist'; title: string; items: { t: string; done: boolean }[] }
  | { type: 'note'; text: string };

/** A block as it is saved in a layout. */
export type Block = {
  id: string;
  kind: 'builtin' | 'tracker' | 'extra';
  builtin?: BuiltIn;
  tracker_id?: string;
  extra?: Extra;
  size: Size;
  hidden?: boolean;
  parked?: boolean;                 // didn't fit on Free
  pin?: 'pinned' | 'suggested';     // from a team layout
  // Drafts (templates, onboarding, shared layouts) carry the tracker itself until it is made.
  spec?: TrackerSpec;
};
/** A block ready to draw: a tracker block has its tracker. */
export type Widget = Block & { tracker?: Tracker | (TrackerSpec & Partial<Tracker>) };

export const COLOURS = ['#3B3F9E', '#A8561A', '#2E8A63', '#2C7FA8', '#B8487A', '#A8841C'];

type Meta = { title: string; sub: string; modes: Mode[]; group: string; plan?: 'paid' | 'biz'; hint: string; wide?: boolean };
export const BUILTINS: Record<BuiltIn, Meta> = {
  needs_you:  { title: 'Needs you',          sub: 'Drafts waiting for your yes and emails to answer', modes: ['business', 'life'], group: 'Tali', hint: 'Nothing is waiting on your yes.' },
  due:        { title: 'Due today',          sub: 'Reminders and follow-ups',                         modes: ['business', 'life'], group: 'Tali', hint: "Nothing due. Add a reminder and I'll nudge you when it's time." },
  brief:      { title: 'Morning brief',      sub: 'Her read of your day',                             modes: ['business', 'life'], group: 'Tali', hint: 'Your first brief lands tomorrow morning.' },
  night_idea: { title: 'Idea from night school', sub: 'What she studied last night',                  modes: ['business', 'life'], group: 'Tali', hint: 'She studies while you sleep. Her first idea shows here.' },
  tali_pick:  { title: "Tali's pick",        sub: 'The one thing she would do today',                 modes: ['business', 'life'], group: 'Tali', plan: 'paid', hint: 'Her pick for the day lands with your morning brief.' },
  money:      { title: 'Money',              sub: 'In this month, owed and runway',                   modes: ['business', 'life'], group: 'Money', hint: 'Set a weekly amount or add your costs in Money and your numbers show here.' },
  invoices:   { title: 'Invoices',           sub: 'Owed and overdue',                                 modes: ['business'], group: 'Money', wide: true, hint: 'No invoices out. Send one from Invoices and it shows here.' },
  bills:      { title: 'Bills coming up',    sub: 'What is due in the next 30 days',                  modes: ['life'], group: 'Money', plan: 'paid', hint: 'Add a bill that repeats in Money and I will show what is coming.' },
  pipeline:   { title: 'Pipeline',           sub: 'Leads, follow-ups and clients',                    modes: ['business'], group: 'Work', hint: 'Add a lead in People and your pipeline shows here.' },
  jobs:       { title: 'Jobs on',            sub: 'What is booked in and in progress',                modes: ['business'], group: 'Work', wide: true, hint: 'No jobs on. Accept a quote in Jobs and it shows here.' },
  calendar:   { title: 'Calendar',           sub: "Today's events",                                   modes: ['business', 'life'], group: 'Work', hint: 'Link your Google or Outlook calendar in Settings to see today here.' },
  goals:      { title: 'Goals',              sub: 'Your goals and how close you are',                 modes: ['business', 'life'], group: 'Growth', hint: 'No goals yet. Set one in Goals and I will hold you to it.' },
  week:       { title: 'This week',          sub: 'Your three promises for the week',                 modes: ['business', 'life'], group: 'Growth', hint: 'Do your weekly review and pick three promises for the week.' },
  your_day:   { title: 'Food and training',  sub: "Calories, protein and today's session",            modes: ['life'], group: 'Health', hint: 'Link Totality or Totality Nutrition in Settings to see your day here.' },
  habits:     { title: 'Habits',             sub: 'Tick them off, keep the streak',                   modes: ['life'], group: 'Health', hint: 'No habits yet. Add one and tick it off each day.' },
  people:     { title: 'People',             sub: 'Birthdays and who to catch up with',               modes: ['business', 'life'], group: 'People', hint: 'Nothing coming up. Add birthdays and I will remind you.' },
  journal:    { title: 'Journal',            sub: 'Two lines is plenty',                              modes: ['life'], group: 'Mind', hint: '' },
  sleep:      { title: 'Sleep sounds',       sub: 'Rain, waves or her night sky',                     modes: ['life'], group: 'Mind', hint: '' },
  team:       { title: 'Team',               sub: 'Who is on what, and anything stuck',               modes: ['business'], group: 'Business', plan: 'biz', wide: true, hint: 'Add your first teammate in Your team.' },
  leads:      { title: 'Leads',              sub: 'New this week and who needs a reply',              modes: ['business'], group: 'Business', plan: 'biz', hint: 'No leads yet. They land here from your website and booking link.' },
  cashflow:   { title: 'Cash flow',          sub: 'In and out this month, owed, next 30 days',        modes: ['business'], group: 'Business', plan: 'biz', hint: 'Send an invoice or snap a receipt and your cash flow shows here.' },
  bookings:   { title: 'Bookings today',     sub: "Today's bookings and the gaps between",            modes: ['business'], group: 'Business', plan: 'biz', wide: true, hint: 'Nothing booked today. Share your booking link from Bookings.' },
  visits:     { title: 'Website visits',     sub: 'This week against last, and the top page',         modes: ['business'], group: 'Business', plan: 'biz', hint: 'Publish your website and visits show here.' },
  quote_rate: { title: 'Quote win rate',     sub: 'Won, lost and waiting, last 90 days',              modes: ['business'], group: 'Business', plan: 'biz', hint: 'Send a quote from Jobs and your win rate shows here.' },
  happiness:  { title: 'Customer happiness', sub: 'Recent reviews and your average rating',           modes: ['business'], group: 'Business', plan: 'biz', hint: 'Log a review when one comes in and your average shows here.' },
};
/** On a lower plan the nearest built-in goes in instead of a Business block. */
export const BIZ_SWAP: Partial<Record<BuiltIn, BuiltIn | null>> = { leads: 'pipeline', cashflow: 'money', bookings: 'calendar', quote_rate: 'pipeline', team: null, visits: null, happiness: null };

type Preset = TrackerSpec & { group: string; for: string[]; home: 'life' | 'business' };
// Ready-made trackers for the gallery, templates and onboarding (30).
export const TRACKER_PRESETS: Record<string, Preset> = {
  water:      { group: 'Health', home: 'life', for: ['Health and habits'], name: 'Water', type: 'count', unit: 'L', target: 3, period: 'day', style: 'ring', colour: '#2C7FA8', step: 0.25 },
  steps:      { group: 'Health', home: 'life', for: ['Health and habits'], name: 'Steps', type: 'count', unit: 'steps', target: 10000, period: 'day', style: 'bar', colour: '#2E8A63', step: null },
  sleep:      { group: 'Health', home: 'life', for: ['Health and habits'], name: 'Sleep', type: 'time', unit: 'h', target: 8, period: 'day', style: 'chart', colour: '#3B3F9E', step: null },
  gym:        { group: 'Health', home: 'life', for: ['Health and habits'], name: 'Gym sessions', type: 'count', unit: 'sessions', target: 4, period: 'week', style: 'ring', colour: '#A8561A', step: 1 },
  read:       { group: 'Mind', home: 'life', for: ['Big goals'], name: 'Read 20 minutes', type: 'yesno', unit: '', target: null, period: 'day', style: 'streak', colour: '#A8841C' },
  meditate:   { group: 'Mind', home: 'life', for: ['Health and habits'], name: 'Meditate', type: 'yesno', unit: '', target: null, period: 'day', style: 'streak', colour: '#B8487A' },
  mood:       { group: 'Mind', home: 'life', for: [], name: 'Mood', type: 'scale', unit: '/5', target: null, period: 'day', style: 'chart', colour: '#B8487A' },
  in_bed:     { group: 'Mind', home: 'life', for: [], name: 'In bed by 10:30', type: 'yesno', unit: '', target: null, period: 'day', style: 'streak', colour: '#3B3F9E' },
  screens_off:{ group: 'Mind', home: 'life', for: [], name: 'Screens off before bed', type: 'yesno', unit: '', target: null, period: 'day', style: 'streak', colour: '#2C7FA8' },
  savings:    { group: 'Money', home: 'life', for: ['Money', 'Big goals'], name: 'House deposit', type: 'money', unit: 'A$', target: 20000, period: 'total', style: 'bar', colour: '#2E8A63', step: null },
  spend:      { group: 'Money', home: 'life', for: ['Money'], name: 'Spent this week', type: 'money', unit: 'A$', target: 400, period: 'week', style: 'bar', colour: '#A8561A', step: null, source: 'spend' },
  no_spend:   { group: 'Money', home: 'life', for: [], name: 'No-spend days', type: 'yesno', unit: 'days', target: 3, period: 'week', style: 'streak', colour: '#2E8A63' },
  debt:       { group: 'Money', home: 'life', for: [], name: 'Debt left', type: 'money', unit: 'A$', target: 0, period: 'total', style: 'bar', colour: '#B8487A', step: null, countDown: true, startValue: 5000 },
  extra_paid: { group: 'Money', home: 'life', for: [], name: 'Extra paid this month', type: 'money', unit: 'A$', target: 200, period: 'month', style: 'number', colour: '#A8841C', step: null },
  family:     { group: 'People', home: 'life', for: ['The people in my life'], name: 'Called Mum', type: 'yesno', unit: '', target: null, period: 'week', style: 'number', colour: '#B8487A' },
  date_night: { group: 'People', home: 'life', for: [], name: 'Date night', type: 'yesno', unit: '', target: null, period: 'week', style: 'number', colour: '#A8561A' },
  family_dinner: { group: 'People', home: 'life', for: [], name: 'Family dinner', type: 'count', unit: 'dinners', target: 4, period: 'week', style: 'ring', colour: '#A8841C', step: 1 },
  calls:      { group: 'Business', home: 'business', for: ['My business', 'More customers'], name: 'Cold calls', type: 'count', unit: 'calls', target: 20, period: 'week', style: 'ring', colour: '#A8561A', step: 1 },
  revenue:    { group: 'Business', home: 'business', for: ['My business', 'Getting paid on time'], name: 'Revenue', type: 'money', unit: 'A$', target: 8000, period: 'month', style: 'bar', colour: '#2E8A63', step: null, source: 'invoices_paid' },
  quotes:     { group: 'Business', home: 'business', for: ['My business', 'Keeping on top of jobs'], name: 'Quotes sent', type: 'count', unit: 'quotes', target: 5, period: 'week', style: 'number', colour: '#3B3F9E', step: 1, source: 'quotes_sent' },
  reviews:    { group: 'Business', home: 'business', for: ['More customers', 'Growing online'], name: 'Google reviews', type: 'count', unit: 'reviews', target: 50, period: 'total', style: 'chart', colour: '#A8841C', step: 1 },
  posts:      { group: 'Business', home: 'business', for: ['More customers', 'Filling my diary', 'Growing online'], name: 'Posts this week', type: 'count', unit: 'posts', target: 3, period: 'week', style: 'ring', colour: '#B8487A', step: 1 },
  jobs_done:  { group: 'Business', home: 'business', for: [], name: 'Jobs finished', type: 'count', unit: 'jobs', target: 10, period: 'week', style: 'ring', colour: '#2C7FA8', step: 1, source: 'jobs_done' },
  bookings:   { group: 'Business', home: 'business', for: [], name: 'Bookings', type: 'count', unit: 'bookings', target: 30, period: 'week', style: 'ring', colour: '#2C7FA8', step: 1, source: 'bookings' },
  rebooked:   { group: 'Business', home: 'business', for: [], name: 'Rebooked', type: 'count', unit: 'customers', target: 10, period: 'week', style: 'number', colour: '#2E8A63', step: 1 },
  first_customers: { group: 'Business', home: 'business', for: [], name: 'First customers', type: 'count', unit: 'customers', target: 10, period: 'total', style: 'bar', colour: '#A8561A', step: 1 },
  hours_on_it:{ group: 'Business', home: 'business', for: [], name: 'Hours on it', type: 'time', unit: 'h', target: 8, period: 'week', style: 'bar', colour: '#3B3F9E', step: 0.5 },
  launch_tasks:{ group: 'Business', home: 'business', for: [], name: 'Launch tasks done', type: 'count', unit: 'tasks', target: 20, period: 'total', style: 'bar', colour: '#B8487A', step: 1 },
  deepwork:   { group: 'Work', home: 'business', for: ['My week and to-dos'], name: 'Deep work', type: 'time', unit: 'h', target: 15, period: 'week', style: 'bar', colour: '#2C7FA8', step: 0.5 },
  inbox_zero: { group: 'Work', home: 'business', for: [], name: 'Inbox zero', type: 'yesno', unit: '', target: null, period: 'day', style: 'streak', colour: '#2E8A63' },
};
export function presetSpec(key: string, over: Partial<TrackerSpec> = {}): TrackerSpec {
  const { group: _g, for: _f, home: _h, ...spec } = TRACKER_PRESETS[key];
  return { ...spec, preset: key, ...over };
}

// What each plan can do (Taj, 16 Nov 2026). Free is a set number and less in depth.
export const LIMITS = {
  free: { blocks: 6, trackers: 3, styles: ['number', 'bar'] as TrackerStyle[], periods: ['day', 'week'] as Period[], checkIn: false, history: '7 days' },
  paid: { blocks: null, trackers: null, styles: ['ring', 'bar', 'number', 'streak', 'chart'] as TrackerStyle[], periods: ['day', 'week', 'month', 'total'] as Period[], checkIn: true, history: 'all of it' },
};
export const SOURCE_LABEL: Record<TrackerSource, string> = {
  manual: 'You log it', invoices_paid: 'Paid invoices', quotes_sent: 'Quotes you send', jobs_done: 'Jobs you finish', bookings: 'Your bookings', spend: 'Your spending in Money', health: 'Apple Health or Health Connect',
};

export function planOf(c: Credits | null | undefined, userId?: string | null): Plan {
  if (hasBusinessTools(c, userId)) return 'biz';
  if (!c || !isPaid(c)) return 'free';
  return c.plan === 'pro' || c.plan === 'max' ? c.plan : 'hq';
}
export const isFree = (p: Plan) => p === 'free';
export const isProPlan = (p: Plan) => p === 'pro' || p === 'max' || p === 'biz';
/** Can this plan have this block? */
export function blockAllowed(plan: Plan, w: Pick<Block, 'kind' | 'builtin' | 'extra'>): boolean {
  if (w.kind === 'extra') return w.extra?.type !== 'checklist' || plan !== 'free';
  if (w.kind !== 'builtin' || !w.builtin) return true;
  const need = BUILTINS[w.builtin]?.plan;
  if (need === 'biz') return plan === 'biz';
  if (need === 'paid') return plan !== 'free';
  return true;
}

let seq = 0;
export const newId = () => `b${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
export const builtinBlock = (builtin: BuiltIn, size?: Size): Block => ({ id: newId(), kind: 'builtin', builtin, size: size ?? 'wide' });
export const draftTracker = (spec: TrackerSpec, size: Size = 'small'): Block => ({ id: newId(), kind: 'tracker', size, spec });
export const extraBlock = (extra: Extra, size: Size = 'wide'): Block => ({ id: newId(), kind: 'extra', extra, size });

/** Which home is showing. Someone with no business has one home ('life') that takes every block. */
export function homeKeyFor(mode: Mode, hasBusiness: boolean, businessId?: string | null): string {
  if (!hasBusiness) return 'life';
  if (mode === 'business') return businessId ? `business:${businessId}` : 'business';
  return 'life';
}
export const sideOfHome = (homeKey: string): Mode => (homeKey.startsWith('business') ? 'business' : 'life');

/**
 * The home someone has before they have saved one: the same sections Today always had, in the same
 * order, so nothing moves or disappears for people who were here before Build your HQ.
 */
export function defaultLayout(homeKey: string, hasBusiness: boolean, plan: Plan): Block[] {
  const b = (k: BuiltIn, size: Size = 'wide'): Block => ({ id: `d-${k}`, kind: 'builtin', builtin: k, size });
  let list: Block[];
  if (!hasBusiness) list = plan === 'free'
    ? [b('needs_you'), b('due'), b('night_idea'), b('your_day'), b('journal'), b('sleep')]
    : [b('night_idea'), b('needs_you'), b('due'), b('money'), b('week'), b('goals'), b('your_day'), b('journal'), b('sleep')];
  else if (sideOfHome(homeKey) === 'business') list = plan === 'free'
    ? [b('pipeline'), b('night_idea'), b('needs_you'), b('due'), b('goals')]
    : [b('money'), b('pipeline'), b('night_idea'), b('needs_you'), b('due'), b('week'), b('goals')];
  else list = plan === 'free'
    ? [b('night_idea'), b('due'), b('habits'), b('people'), b('journal'), b('sleep')]
    : [b('night_idea'), b('due'), b('habits'), b('people'), b('money'), b('your_day'), b('journal'), b('sleep')];
  return list;
}

/** Free: the first 6 blocks stay on the home, the rest are parked under "Didn't fit on Free". Paid: nothing is parked. */
export function fitPlan(blocks: Block[], plan: Plan): Block[] {
  // Paid: nothing is parked for size, only a block the plan does not have (a Business block after a downgrade).
  if (plan !== 'free') return blocks.map((x) => ({ ...x, parked: !blockAllowed(plan, x) }));
  let shown = 0, trackers = 0;
  return blocks.map((x) => {
    if (x.hidden) return { ...x, parked: false };
    const allowed = blockAllowed(plan, x);
    const fits = allowed && shown < LIMITS.free.blocks && (x.kind !== 'tracker' || trackers < LIMITS.free.trackers);
    if (fits) { shown++; if (x.kind === 'tracker') trackers++; }
    return { ...x, parked: !fits };
  });
}

// ── The store ───────────────────────────────────────────────────────────────────────────
export type TeamHome = { owner_id: string; business: string; owner_name: string; pushed_at: string | null; can_money: boolean; can_pipeline: boolean; can_customers: boolean; blocks: Block[] };
export type HomeNote = { id: string; kind: 'pick' | 'nudge' | 'team'; side: Mode | null; tracker_id: string | null; body: string; for_date: string };

type State = {
  loaded: boolean; userId: string | null; plan: Plan; credits: Credits | null;
  layouts: Record<string, Block[]>; trackers: Tracker[]; teamHomes: TeamHome[]; notes: HomeNote[];
  error: string;
};
let state: State = { loaded: false, userId: null, plan: 'free', credits: null, layouts: {}, trackers: [], teamHomes: [], notes: [], error: '' };
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

function hydrate(row: any, today: string): Tracker {
  const base = {
    id: row.id, name: row.name, type: row.type, unit: row.unit ?? '', target: row.target == null ? null : Number(row.target), period: row.period,
    style: row.style, colour: row.colour, step: row.step == null ? null : Number(row.step), startValue: Number(row.start_value ?? 0), countDown: !!row.count_down,
    checkIn: !!row.check_in, restDay: !!row.rest_day, source: row.source ?? 'manual', preset: row.preset ?? null, home: row.home ?? 'life',
    team: !!row.team, sharedIn: !!row.shared_in, ownerName: row.owner_name ?? null, archivedAt: row.archived_at ?? null,
    days: numberMap(row.mine?.days), before: Number(row.mine?.before ?? 0),
    teamDays: row.everyone ? numberMap(row.everyone.days) : undefined, teamBefore: row.everyone ? Number(row.everyone.before ?? 0) : undefined,
  } as Tracker;
  return derive(base, today);
}
const numberMap = (o: any): Days => Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [k, Number(v)]));
export function derive(t: Tracker, today = todayKey()): Tracker {
  return {
    ...t,
    value: valueOn(t, t.days, t.before, today),
    week: series(t, t.days, t.before, today, 7),
    streak: streaks(t, t.days, today).now,
    teamValue: t.teamDays ? valueOn(t, t.teamDays, t.teamBefore ?? 0, today) : undefined,
  };
}

let loading: Promise<void> | null = null;
/** Loads layouts, trackers, team homes and Tali's notes. Any part that fails leaves the rest working. */
export function loadHq(userId: string, force = false): Promise<void> {
  if (!force && state.loaded && state.userId === userId) return Promise.resolve();
  if (loading) return loading;
  loading = (async () => {
    const today = todayKey();
    const [lay, tr, th, nt, cr] = await Promise.all([
      supabase.from('home_layouts').select('home_key, blocks').then((r) => r, () => ({ data: null, error: true } as any)),
      supabase.rpc('my_trackers', { p_today: today }).then((r) => r, () => ({ data: null, error: true } as any)),
      supabase.rpc('team_home').then((r) => r, () => ({ data: null, error: true } as any)),
      supabase.from('home_notes').select('id, kind, side, tracker_id, body, for_date').is('seen_at', null).gte('for_date', shiftDay(today, -1)).order('created_at', { ascending: false }).then((r) => r, () => ({ data: null, error: true } as any)),
      myCredits().catch(() => state.credits),
    ]);
    const layouts: Record<string, Block[]> = {};
    for (const r of (lay.data as any[]) ?? []) if (Array.isArray(r.blocks)) layouts[r.home_key] = r.blocks;
    set({
      loaded: true, userId, credits: cr ?? null, plan: planOf(cr, userId), layouts,
      trackers: ((tr.data as any[]) ?? []).map((r) => hydrate(r, today)),
      teamHomes: ((th.data as any[]) ?? []) as TeamHome[],
      notes: ((nt.data as any[]) ?? []) as HomeNote[],
      error: lay.error || tr.error ? 'Could not load your home. Pull down to try again.' : '',
    });
    loading = null;
  })();
  return loading;
}
function shiftDay(k: string, n: number) { const d = new Date(`${k}T12:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export const reloadHq = () => (state.userId ? loadHq(state.userId, true) : Promise.resolve());
export const hqState = () => state;

const plain = (e: any, fallback: string) => {
  const m = String(e?.message ?? '');
  return /Free (fits|has)|Business plans|not yours|has happened/.test(m) ? m : fallback;
};

/** Saves a home. Blocks that were drafts must be made into trackers first (see materialise). */
export async function saveLayout(homeKey: string, blocks: Block[]): Promise<void> {
  const clean = (homeKey.startsWith('team:') ? blocks : fitPlan(blocks, state.plan)).map(({ spec: _s, ...b }) => b);
  const before = state.layouts;
  set({ layouts: { ...state.layouts, [homeKey]: clean } });
  const { error } = await supabase.from('home_layouts').upsert({ home_key: homeKey, blocks: clean }, { onConflict: 'user_id,home_key' });
  if (error) { set({ layouts: before }); throw new Error(plain(error, 'Could not save your home. Check your connection and try again.')); }
}

const toRow = (s: TrackerSpec, home: 'life' | 'business' | 'both') => ({
  name: s.name.trim().slice(0, 60), type: s.type, unit: s.type === 'money' ? 'A$' : (s.unit ?? '').slice(0, 16), target: s.type === 'yesno' && s.period === 'day' ? null : s.target,
  period: s.period, style: s.style, colour: s.colour, step: s.step ?? null, start_value: s.startValue ?? 0, count_down: !!s.countDown,
  check_in: !!s.checkIn, rest_day: !!s.restDay, source: s.source ?? 'manual', preset: s.preset ?? null, home, team: !!s.team,
});

export async function createTracker(spec: TrackerSpec, home: 'life' | 'business' | 'both'): Promise<string> {
  const { data, error } = await supabase.from('trackers').insert(toRow(spec, home)).select('id').single();
  if (error || !data) throw new Error(plain(error, 'Could not make that tracker. Try again.'));
  return (data as any).id as string;
}
export async function updateTracker(id: string, spec: TrackerSpec, home: 'life' | 'business' | 'both') {
  const { error } = await supabase.from('trackers').update(toRow(spec, home)).eq('id', id);
  if (error) throw new Error(plain(error, 'Could not save that tracker. Try again.'));
  await reloadHq();
}
/** Archive keeps the history and takes it off every home. */
export async function archiveTracker(id: string, on = true) {
  const { error } = await supabase.from('trackers').update({ archived_at: on ? new Date().toISOString() : null }).eq('id', id);
  if (error) throw new Error(plain(error, 'Could not archive that tracker.'));
  if (on) await dropFromHomes(id);
  await reloadHq();
}
export async function deleteTracker(id: string) {
  const { error } = await supabase.from('trackers').delete().eq('id', id);
  if (error) throw new Error('Could not delete that tracker.');
  await dropFromHomes(id);
  await reloadHq();
}
async function dropFromHomes(id: string) {
  for (const [key, blocks] of Object.entries(state.layouts)) {
    if (blocks.some((b) => b.tracker_id === id)) await saveLayout(key, blocks.filter((b) => b.tracker_id !== id)).catch(() => {});
  }
}

/** Turns draft tracker blocks (templates, onboarding, shared layouts) into real trackers. Existing ones with the same name are reused. */
export async function materialise(homeKey: string, blocks: Block[]): Promise<Block[]> {
  const side = sideOfHome(homeKey);
  const out: Block[] = [];
  for (const b of blocks) {
    if (b.kind !== 'tracker' || !b.spec) { out.push(b); continue; }
    const same = state.trackers.find((t) => !t.archivedAt && !t.sharedIn && t.name.toLowerCase() === b.spec!.name.toLowerCase() && (t.home === side || t.home === 'both'));
    try {
      const id = same?.id ?? (await createTracker(b.spec, side));
      const { spec: _s, ...rest } = b;
      out.push({ ...rest, tracker_id: id });
    } catch (e: any) {
      // Free at its limit: the tracker is left out and the rest of the home still saves.
      if (!/Free has/.test(String(e?.message))) throw e;
    }
  }
  return out;
}

/** Log an amount. The tile moves straight away; the database is told after. */
export async function logTracker(id: string, amount: number, day = todayKey(), note?: string, source: 'tap' | 'tali' = 'tap') {
  const before = state.trackers;
  const replace = (t: Tracker) => t.type === 'yesno' || t.type === 'scale';
  set({ trackers: state.trackers.map((t) => {
    if (t.id !== id) return t;
    const days = { ...t.days, [day]: replace(t) ? (t.type === 'yesno' ? (amount > 0 ? 1 : 0) : amount) : (t.days[day] ?? 0) + amount };
    const teamDays = t.teamDays ? { ...t.teamDays, [day]: (t.teamDays[day] ?? 0) + amount } : undefined;
    return derive({ ...t, days, teamDays });
  }) });
  const { error } = await supabase.rpc('tracker_log', { p_tracker: id, p_amount: amount, p_day: day, p_note: note ?? null, p_source: source });
  if (error) { set({ trackers: before }); throw new Error(plain(error, 'Could not log that. Check your connection and try again.')); }
}

export async function seenNote(id: string) {
  set({ notes: state.notes.filter((n) => n.id !== id) });
  await supabase.from('home_notes').update({ seen_at: new Date().toISOString() }).eq('id', id).then(() => {}, () => {});
}

export function useHq() {
  const { session } = useAuth();
  const s = useSyncExternalStore(subscribe, () => state, () => state);
  const userId = session?.user.id ?? null;
  useEffect(() => { if (userId) loadHq(userId); }, [userId]);
  return s;
}

/** One home, ready to draw. `saved` is false while it is still the default nobody has edited. */
export function useHome(homeKey: string, hasBusiness: boolean) {
  const s = useHq();
  return useMemo(() => {
    const saved = s.layouts[homeKey];
    const raw = saved ?? defaultLayout(homeKey, hasBusiness, s.plan);
    const blocks = fitPlan(raw, s.plan);
    const widgets: Widget[] = [];
    for (const b of blocks) {
      if (b.kind === 'tracker') {
        const t = s.trackers.find((x) => x.id === b.tracker_id && !x.archivedAt);
        if (t) widgets.push({ ...b, tracker: t });
      } else if (b.kind === 'builtin' ? !!BUILTINS[b.builtin!] : true) widgets.push(b);
    }
    return { loaded: s.loaded, saved: !!saved, plan: s.plan, widgets, shown: widgets.filter((w) => !w.hidden && !w.parked), blocks };
  }, [s, homeKey, hasBusiness]);
}

/** A team home as a teammate sees it, with their own collapse and remove choices laid over the top. */
export function teamWidgets(team: TeamHome, mine: Block[] | undefined, trackers: Tracker[]): Widget[] {
  const over = new Map((mine ?? []).map((b) => [b.id, b]));
  const out: Widget[] = [];
  for (const b of team.blocks) {
    const o = over.get(b.id);
    if (b.pin !== 'pinned' && o?.hidden) continue;
    const w: Widget = { ...b, hidden: false, parked: false };
    if (b.kind === 'tracker') { const t = trackers.find((x) => x.id === b.tracker_id); if (!t) continue; w.tracker = t; }
    out.push(w);
  }
  return out;
}

// ── Words ───────────────────────────────────────────────────────────────────────────────
type Fmtable = Pick<TrackerSpec, 'type' | 'unit' | 'period' | 'target'>;
export function fmt(tr: Fmtable, v: number): string {
  if (tr.type === 'money') return `${v < 0 ? '-' : ''}A$${Math.abs(Math.round(v)).toLocaleString('en-AU')}`;
  if (tr.type === 'yesno') return tr.period === 'day' || !tr.target ? (v ? 'Done' : 'Not yet') : String(Math.round(v));
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString('en-AU');
  return `${Number.isInteger(v) ? v : Number(v.toFixed(v < 10 ? 2 : 1)).toString()}`;
}
export const unitOf = (tr: Fmtable) => (tr.type === 'money' ? '' : tr.type === 'yesno' ? (tr.target && tr.period !== 'day' ? tr.unit || 'days' : '') : tr.unit);
export const PERIOD_WORD: Record<Period, string> = { day: 'today', week: 'this week', month: 'this month', total: 'so far' };
export function goalLine(tr: TrackerSpec): string {
  if (tr.type === 'yesno' && !tr.target) return `Every ${tr.period === 'week' ? 'week' : 'day'}`;
  if (tr.countDown) return `Down to ${fmt(tr, tr.target ?? 0)}`;
  if (!tr.target) return tr.type === 'scale' ? 'Rate it daily' : 'Keep count';
  const n = tr.type === 'money' ? fmt(tr, tr.target) : `${tr.target.toLocaleString('en-AU')} ${unitOf(tr) || tr.unit}`.trim();
  return `${n} ${tr.period === 'total' ? 'goal' : `a ${tr.period}`}`;
}
export function widgetTitle(w: Widget | Block): string {
  if (w.kind === 'builtin') return BUILTINS[w.builtin!]?.title ?? 'Block';
  if (w.kind === 'extra') return w.extra?.type === 'countdown' ? w.extra.title || 'Countdown' : w.extra?.type === 'checklist' ? w.extra.title || 'Checklist' : 'Note';
  return (w as Widget).tracker?.name ?? w.spec?.name ?? 'Tracker';
}
export { progress };

/** A layout to share: blocks, targets and looks. Numbers only when asked for. */
export function snapshot(widgets: Widget[], numbers: boolean): any[] {
  return widgets.filter((w) => !w.hidden && !w.parked && !(w.kind === 'tracker' && (w.tracker as Tracker)?.sharedIn)).map((w) => {
    if (w.kind === 'tracker' && w.tracker) {
      const t = w.tracker as Tracker;
      const spec: TrackerSpec = { name: t.name, type: t.type, unit: t.unit, target: t.target, period: t.period, style: t.style, colour: t.colour, step: t.step, countDown: t.countDown, startValue: t.countDown ? t.startValue : 0, preset: t.preset };
      return { id: w.id, kind: 'tracker', size: w.size, spec, ...(numbers ? { value: t.value, week: t.week } : null) };
    }
    if (w.kind === 'extra') return { id: w.id, kind: 'extra', size: w.size, extra: w.extra?.type === 'note' ? { type: 'note', text: '' } : w.extra?.type === 'checklist' ? { type: 'checklist', title: w.extra.title, items: [] } : w.extra };
    return { id: w.id, kind: 'builtin', builtin: w.builtin, size: w.size };
  });
}
