// lib/widgets.ts
// ADDED (16 Nov 2026, Taj): "Build your HQ". Today becomes blocks the user adds, removes, resizes
// and moves, in both modes. Two kinds of block:
//   - built-in: the parts of Today that already exist (Needs you, Due today, money, brief...)
//   - trackers: anything the user wants to keep count of (water, cold calls, savings, reading)
// Onboarding builds the starting layout from their answers, so nobody starts on a blank page.
// Free gets a set number of blocks and simpler trackers; paid plans get the lot. Layouts can be
// shared as a link (the layout only, never their numbers unless they choose to).
//
// MOCKUP STAGE: layouts live in local storage so the screens can be shown. The build moves them to
// a home_layouts table (one row per user per mode) and trackers to trackers + tracker_entries.

import { useEffect, useState } from 'react';
import type { Mode } from './mode';

export type TrackerType = 'count' | 'yesno' | 'money' | 'time' | 'scale';
export type TrackerStyle = 'ring' | 'bar' | 'number' | 'streak' | 'chart';
export type Period = 'day' | 'week' | 'month' | 'total';
export type Size = 'small' | 'wide';

export type Tracker = {
  name: string;
  type: TrackerType;
  unit: string;            // 'L', 'calls', 'A$', 'min', 'pages'
  target: number | null;
  period: Period;
  value: number;           // this period so far
  week: number[];          // last 7 days, oldest first (for streaks and charts)
  style: TrackerStyle;
  colour: string;
  checkIn?: boolean;       // Tali nudges if it falls behind (paid)
};

export type BuiltIn =
  | 'needs_you' | 'due' | 'brief' | 'money' | 'calendar' | 'goals' | 'week'
  | 'your_day' | 'habits' | 'people' | 'journal' | 'sleep' | 'pipeline' | 'jobs' | 'invoices' | 'night_idea';

export type Widget = {
  id: string;
  kind: 'builtin' | 'tracker';
  builtin?: BuiltIn;
  tracker?: Tracker;
  size: Size;
  hidden?: boolean;
};

export const COLOURS = ['#B9A6FF', '#FFB561', '#7FE0B0', '#8FD3FF', '#FF9AD5', '#FFE08A'];

export const BUILTINS: Record<BuiltIn, { title: string; sub: string; modes: Mode[]; group: string }> = {
  needs_you:  { title: 'Needs you',          sub: 'Drafts waiting for your yes and emails to answer', modes: ['business', 'life'], group: 'Tali' },
  due:        { title: 'Due today',          sub: 'Reminders and follow-ups',                         modes: ['business', 'life'], group: 'Tali' },
  brief:      { title: 'Morning brief',      sub: 'Her read of your day',                             modes: ['business', 'life'], group: 'Tali' },
  night_idea: { title: 'Idea from night school', sub: 'What she studied last night',                  modes: ['business', 'life'], group: 'Tali' },
  money:      { title: 'Money',              sub: 'In this month, owed and runway',                   modes: ['business', 'life'], group: 'Money' },
  invoices:   { title: 'Invoices',           sub: 'Owed and overdue',                                 modes: ['business'], group: 'Money' },
  pipeline:   { title: 'Pipeline',           sub: 'Leads and quotes by stage',                        modes: ['business'], group: 'Work' },
  jobs:       { title: 'Jobs on',            sub: 'What is booked in and in progress',                modes: ['business'], group: 'Work' },
  calendar:   { title: 'Calendar',           sub: "Today's events",                                   modes: ['business', 'life'], group: 'Work' },
  goals:      { title: 'Goals',              sub: 'Your goals and how close you are',                 modes: ['business', 'life'], group: 'Growth' },
  week:       { title: 'This week',          sub: 'Your three promises for the week',                 modes: ['business', 'life'], group: 'Growth' },
  your_day:   { title: 'Food and training',  sub: 'Calories, protein and today\'s session',           modes: ['life'], group: 'Health' },
  habits:     { title: 'Habits',             sub: 'Tick them off, keep the streak',                   modes: ['life'], group: 'Health' },
  people:     { title: 'People',             sub: 'Birthdays and who to catch up with',               modes: ['business', 'life'], group: 'People' },
  journal:    { title: 'Journal',            sub: 'Two lines is plenty',                              modes: ['life'], group: 'Mind' },
  sleep:      { title: 'Sleep sounds',       sub: 'Rain, waves or her night sky',                     modes: ['life'], group: 'Mind' },
};

// Ready made trackers for the gallery and for onboarding. Values are the demo state for mockups.
export const TRACKER_PRESETS: Record<string, Tracker & { group: string; for: string[] }> = {
  water:     { group: 'Health', for: ['Health and habits'], name: 'Water', type: 'count', unit: 'L', target: 3, period: 'day', value: 1.8, week: [3, 2.5, 3.1, 2, 2.8, 3, 1.8], style: 'ring', colour: '#8FD3FF' },
  steps:     { group: 'Health', for: ['Health and habits'], name: 'Steps', type: 'count', unit: 'steps', target: 10000, period: 'day', value: 6420, week: [9800, 11200, 7400, 10400, 8800, 12100, 6420], style: 'bar', colour: '#7FE0B0' },
  sleep:     { group: 'Health', for: ['Health and habits'], name: 'Sleep', type: 'time', unit: 'h', target: 8, period: 'day', value: 7.2, week: [6.5, 7, 7.5, 6.8, 8.1, 7.9, 7.2], style: 'chart', colour: '#B9A6FF' },
  gym:       { group: 'Health', for: ['Health and habits'], name: 'Gym sessions', type: 'count', unit: 'sessions', target: 4, period: 'week', value: 2, week: [1, 0, 1, 0, 0, 0, 0], style: 'ring', colour: '#FFB561' },
  read:      { group: 'Mind', for: ['Health and habits', 'Big goals'], name: 'Read 20 minutes', type: 'yesno', unit: '', target: null, period: 'day', value: 1, week: [1, 1, 1, 0, 1, 1, 1], style: 'streak', colour: '#FFE08A' },
  meditate:  { group: 'Mind', for: ['Health and habits'], name: 'Meditate', type: 'yesno', unit: '', target: null, period: 'day', value: 0, week: [1, 0, 1, 1, 0, 1, 0], style: 'streak', colour: '#FF9AD5' },
  mood:      { group: 'Mind', for: ['Health and habits'], name: 'Mood', type: 'scale', unit: '/5', target: null, period: 'day', value: 4, week: [3, 4, 4, 2, 3, 4, 4], style: 'chart', colour: '#FF9AD5' },
  savings:   { group: 'Money', for: ['Money', 'Big goals'], name: 'House deposit', type: 'money', unit: 'A$', target: 20000, period: 'total', value: 8650, week: [8100, 8100, 8250, 8250, 8400, 8400, 8650], style: 'bar', colour: '#7FE0B0' },
  spend:     { group: 'Money', for: ['Money'], name: 'Spent this week', type: 'money', unit: 'A$', target: 400, period: 'week', value: 186, week: [40, 22, 0, 65, 18, 41, 0], style: 'bar', colour: '#FFB561' },
  family:    { group: 'People', for: ['The people in my life'], name: 'Called Mum', type: 'yesno', unit: '', target: null, period: 'week', value: 1, week: [0, 0, 1, 0, 0, 0, 0], style: 'number', colour: '#FF9AD5' },
  calls:     { group: 'Business', for: ['My business'], name: 'Cold calls', type: 'count', unit: 'calls', target: 20, period: 'week', value: 12, week: [4, 3, 0, 5, 0, 0, 0], style: 'ring', colour: '#FFB561' },
  revenue:   { group: 'Business', for: ['My business', 'Money'], name: 'Revenue', type: 'money', unit: 'A$', target: 8000, period: 'month', value: 5240, week: [600, 980, 420, 1200, 0, 860, 1180], style: 'bar', colour: '#7FE0B0' },
  quotes:    { group: 'Business', for: ['My business'], name: 'Quotes sent', type: 'count', unit: 'quotes', target: 5, period: 'week', value: 3, week: [1, 0, 1, 1, 0, 0, 0], style: 'number', colour: '#B9A6FF' },
  reviews:   { group: 'Business', for: ['My business'], name: 'Google reviews', type: 'count', unit: 'reviews', target: 50, period: 'total', value: 31, week: [28, 28, 29, 29, 30, 30, 31], style: 'chart', colour: '#FFE08A' },
  posts:     { group: 'Business', for: ['My business'], name: 'Posts this week', type: 'count', unit: 'posts', target: 3, period: 'week', value: 1, week: [0, 1, 0, 0, 0, 0, 0], style: 'ring', colour: '#FF9AD5' },
  deepwork:  { group: 'Work', for: ['My week and to-dos', 'My business'], name: 'Deep work', type: 'time', unit: 'h', target: 15, period: 'week', value: 9.5, week: [2, 3, 1.5, 3, 0, 0, 0], style: 'bar', colour: '#8FD3FF' },
};

// What each plan can do. Free is a set number and less in depth (Taj, 16 Nov 2026).
export const LIMITS = {
  free: { blocks: 6, trackers: 3, styles: ['number', 'bar'] as TrackerStyle[], periods: ['day', 'week'] as Period[], checkIn: false, history: '7 days' },
  paid: { blocks: null, trackers: null, styles: ['ring', 'bar', 'number', 'streak', 'chart'] as TrackerStyle[], periods: ['day', 'week', 'month', 'total'] as Period[], checkIn: true, history: 'all of it' },
};

const t = (id: string, key: keyof typeof TRACKER_PRESETS, size: Size = 'small'): Widget => {
  const { group, for: _f, ...tr } = TRACKER_PRESETS[key];
  return { id, kind: 'tracker', tracker: tr, size };
};
const b = (id: string, builtin: BuiltIn, size: Size = 'wide', hidden = false): Widget => ({ id, kind: 'builtin', builtin, size, hidden });

// Demo layouts for the mockups (Sam in the mock data). The build makes these from onboarding.
export const DEMO_LAYOUT: Record<Mode, Widget[]> = {
  life: [t('w1', 'water'), t('w2', 'gym'), t('w3', 'savings', 'wide'), t('w4', 'read'), t('w5', 'sleep'), b('w6', 'due'), b('w7', 'needs_you'), b('w8', 'your_day'), b('w9', 'people', 'wide', true), b('w10', 'journal'), b('w11', 'sleep', 'wide', true)],
  business: [t('x1', 'revenue', 'wide'), t('x2', 'calls'), t('x3', 'quotes'), t('x4', 'reviews'), t('x5', 'posts'), b('x6', 'needs_you'), b('x7', 'due'), b('x8', 'pipeline'), b('x9', 'money', 'wide', true), b('x10', 'calendar', 'wide', true)],
};

// Starting layout from the onboarding answers: what they want a hand with plus the trackers they ticked.
export function startingLayout(plate: string[], trackers: string[], hasBusiness: boolean): Record<Mode, Widget[]> {
  const life: Widget[] = trackers.filter((k) => TRACKER_PRESETS[k]?.group !== 'Business').map((k, i) => t(`l${i}`, k as any));
  const biz: Widget[] = trackers.filter((k) => TRACKER_PRESETS[k]?.group === 'Business').map((k, i) => t(`b${i}`, k as any));
  life.push(b('lb1', 'due'), b('lb2', 'needs_you'));
  if (plate.includes('Health and habits')) life.push(b('lb3', 'your_day'));
  if (plate.includes('The people in my life')) life.push(b('lb4', 'people'));
  if (plate.includes('Money')) life.push(b('lb5', 'money'));
  life.push(b('lb6', 'journal'));
  if (hasBusiness) biz.push(b('bb1', 'needs_you'), b('bb2', 'due'), b('bb3', 'pipeline'), b('bb4', 'money'));
  return { life, business: biz };
}

const KEY = (m: Mode) => `tali.home.${m}`;
// What a Free home looks like at its limit (mockups): 3 of their own trackers and 3 built-in blocks.
export const DEMO_FREE: Record<Mode, Widget[]> = {
  life: [{ ...t('f1', 'water'), tracker: { ...TRACKER_PRESETS.water, style: 'bar' } } as Widget, t('f2', 'savings', 'wide'), { ...t('f3', 'gym'), tracker: { ...TRACKER_PRESETS.gym, style: 'number' } } as Widget, b('f4', 'due'), b('f5', 'needs_you'), b('f6', 'journal')],
  business: [t('g1', 'revenue', 'wide'), { ...t('g2', 'calls'), tracker: { ...TRACKER_PRESETS.calls, style: 'bar' } } as Widget, t('g3', 'quotes'), b('g4', 'needs_you'), b('g5', 'due'), b('g6', 'pipeline')],
};

export function useHomeLayout(mode: Mode, free = false): [Widget[], (w: Widget[]) => void] {
  const [layout, setLayout] = useState<Widget[]>(() => read(mode, free));
  useEffect(() => { setLayout(read(mode, free)); }, [mode, free]);
  const save = (w: Widget[]) => { setLayout(w); try { localStorage.setItem(KEY(mode), JSON.stringify(w)); } catch {} };
  return [layout, save];
}
function read(mode: Mode, free = false): Widget[] {
  try { const s = localStorage.getItem(KEY(mode)); if (s) return JSON.parse(s); } catch {}
  return (free ? DEMO_FREE : DEMO_LAYOUT)[mode];
}

export function fmt(tr: Tracker, v = tr.value): string {
  if (tr.type === 'money') return `A$${Math.round(v).toLocaleString('en-AU')}`;
  if (tr.type === 'yesno') return v ? 'Done' : 'Not yet';
  if (tr.unit === 'steps') return Math.round(v).toLocaleString('en-AU');
  return `${Number.isInteger(v) ? v : v.toFixed(1)}`;
}
export const PERIOD_WORD: Record<Period, string> = { day: 'today', week: 'this week', month: 'this month', total: 'so far' };
export function streakOf(week: number[]) { let n = 0; for (let i = week.length - 1; i >= 0 && week[i]; i--) n++; return n; }

// A shared layout carries the blocks, targets and looks, not the numbers (unless they switch them on).
export function blankNumbers(ws: Widget[]): Widget[] {
  return ws.map((w) => (w.tracker ? { ...w, tracker: { ...w.tracker, value: 0, week: [0, 0, 0, 0, 0, 0, 0] } } : w));
}
