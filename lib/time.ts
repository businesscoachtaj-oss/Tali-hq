// 23 Nov 2026 (Taj: "you only get 4000 weeks, you only get x amount of chances to tell them how you
// feel"). The sums behind Your time (app/(app)/time.tsx). Everything is an average and says so.
import { supabase } from './supabase';

// Remaining years of life at each age, both sexes averaged, rounded. Australian life tables 2021 to
// 2023 (ABS). Ages in between are read off a straight line.
const REMAINING: [number, number][] = [
  [0, 83.1], [10, 73.5], [20, 63.6], [30, 53.8], [40, 44.1], [50, 34.6], [60, 25.5], [65, 21.2],
  [70, 17.0], [75, 13.1], [80, 9.7], [85, 6.8], [90, 4.6], [95, 3.0], [100, 2.0], [110, 1.0],
];

export function yearsLeftAt(age: number): number {
  const a = Math.max(0, age);
  for (let i = 1; i < REMAINING.length; i++) {
    const [x1, y1] = REMAINING[i - 1], [x2, y2] = REMAINING[i];
    if (a <= x2) return y1 + ((a - x1) / (x2 - x1)) * (y2 - y1);
  }
  return 1;
}

export const OFTEN = {
  daily: { label: 'Every day', perYear: 365 },
  weekly: { label: 'Every week', perYear: 52 },
  fortnightly: { label: 'Every fortnight', perYear: 26 },
  monthly: { label: 'Every month', perYear: 12 },
  few_months: { label: 'Every few months', perYear: 4 },
  yearly: { label: 'Once a year', perYear: 1 },
} as const;
export type Often = keyof typeof OFTEN;

export const RELATIONS = ['Mum', 'Dad', 'Partner', 'Child', 'Grandparent', 'Brother or sister', 'Friend', 'Someone else'] as const;
export type Relation = (typeof RELATIONS)[number];

export type TimePerson = { id: string; name: string; relation: Relation; age: number; often: Often };

/** People you add on Your time. Empty if the table is not there yet. */
export async function myTimePeople(): Promise<TimePerson[]> {
  const { data, error } = await supabase.from('time_people').select('id, name, relation, age, often').order('created_at');
  if (error) return [];
  return (data ?? []) as TimePerson[];
}

export async function addTimePerson(p: Omit<TimePerson, 'id'>): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from('time_people').insert({ ...p, user_id: u.user?.id });
  if (error) throw error;
}

export async function removeTimePerson(id: string): Promise<void> {
  const { error } = await supabase.from('time_people').delete().eq('id', id);
  if (error) throw error;
}

/** Your age in years (with a fraction) from a yyyy-mm-dd birthday. */
export function ageFrom(birth: string, now = new Date()): number {
  return (now.getTime() - new Date(`${birth}T00:00:00`).getTime()) / (365.25 * 86400000);
}

/**
 * How many more times you'll see someone, on averages: the shorter of their years left and yours,
 * times how often you see them. A child counts only until they turn 18 (the years they live with you).
 */
export function visitsLeft(p: TimePerson, myYearsLeft: number): number {
  const theirs = p.relation === 'Child' ? Math.max(0, 18 - p.age) : yearsLeftAt(p.age);
  return Math.max(0, Math.round(Math.min(theirs, myYearsLeft) * OFTEN[p.often].perYear));
}

export function round(n: number): number {
  if (n >= 10000) return Math.round(n / 100) * 100;
  if (n >= 1000) return Math.round(n / 10) * 10;
  return Math.round(n);
}
