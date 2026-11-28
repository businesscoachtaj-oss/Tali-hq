// Tali's level (3 Nov 2026). XP comes from what Tali has learnt and done for this user (memories,
// night school, jobs) and what they have put in (journal entries, chats). Counts come from one RPC,
// my_tali_level() (migration 036), and the maths lives here.
import { supabase } from './supabase';

export type LevelCounts = { memories: number; night_school: number; journal: number; jobs_done: number; chats_learnt: number };

export const XP_PER = { memories: 2, night_school: 15, journal: 3, jobs_done: 1, chats_learnt: 2 } as const;

export const LEVELS = [
  // Learnéd mockup (28 Nov 2026): learning ranks in place of job titles.
  { at: 0, name: 'Curious' },
  { at: 100, name: 'Apprentice' },
  { at: 300, name: 'Student' },
  { at: 700, name: 'Reader' },
  { at: 1400, name: 'Scholar' },
  { at: 2200, name: 'Thinker' },
  { at: 3200, name: 'Teacher' },
  { at: 4500, name: 'Philosopher' },
  { at: 6000, name: 'Sage' },
];

export type Level = { xp: number; level: number; name: string; next: string | null; toNext: number; progress: number; counts: LevelCounts };

export function levelFrom(counts: LevelCounts): Level {
  const xp = (Object.keys(XP_PER) as (keyof LevelCounts)[]).reduce((sum, k) => sum + (counts[k] || 0) * XP_PER[k], 0);
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].at) i++;
  const cur = LEVELS[i];
  const nxt = LEVELS[i + 1] ?? null;
  return {
    xp,
    level: i + 1,
    name: cur.name,
    next: nxt?.name ?? null,
    toNext: nxt ? nxt.at - xp : 0,
    progress: nxt ? (xp - cur.at) / (nxt.at - cur.at) : 1,
    counts,
  };
}

export async function taliLevel(): Promise<Level | null> {
  const { data, error } = await supabase.rpc('my_tali_level');
  if (error || !data) return null;
  return levelFrom(data as LevelCounts);
}
