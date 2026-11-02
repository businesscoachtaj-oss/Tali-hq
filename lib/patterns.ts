// Patterns (Pro, 3 Nov 2026): once a month Tali names up to three patterns in the last 60 days.
// They are briefs rows with kind 'patterns' (written by the tali-patterns function). This file reads
// them and runs the function by hand for "Run now" on Me.
import { supabase } from './supabase';

export type Pattern = { pattern: string; evidence: string; suggestion: string };
export type PatternsBrief = {
  id: string;
  kind: 'patterns';
  for_date: string;
  title: string | null;
  content: { headline?: string; patterns?: Pattern[]; window_days?: number; days_with_data?: number };
  read_at: string | null;
  created_at: string;
};

export async function recentPatterns(limit = 6): Promise<PatternsBrief[]> {
  const { data, error } = await supabase
    .from('briefs')
    .select('id, kind, for_date, title, content, read_at, created_at')
    .eq('kind', 'patterns')
    .order('for_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as PatternsBrief[]) ?? [];
}

// The latest one, only if it is from this calendar month (Today shows it then).
export async function patternsThisMonth(): Promise<PatternsBrief | null> {
  const [latest] = await recentPatterns(1);
  if (!latest) return null;
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  return latest.for_date >= monthStart ? latest : null;
}

export async function markPatternsRead(id: string) {
  await supabase.from('briefs').update({ read_at: new Date().toISOString() }).eq('id', id);
}

export type RunPatternsResult = { ok: true; headline: string; patterns: number } | { ok: false; code: string; message: string };

// Runs tali-patterns for the signed-in user (Pro only, 10 credits). The function replaces this month's row.
export async function runPatternsNow(): Promise<RunPatternsResult> {
  const { data, error } = await supabase.functions.invoke('tali-patterns', { body: {} });
  if (error) {
    try {
      const b = await (error as any).context?.json?.();
      if (b?.message) return { ok: false, code: b.code ?? 'error', message: b.message };
    } catch {}
    return { ok: false, code: 'network', message: "Couldn't reach Tali. Check your connection." };
  }
  if (data?.ok) return { ok: true, headline: data.headline ?? '', patterns: Number(data.patterns ?? 0) };
  return { ok: false, code: data?.code ?? 'error', message: data?.message ?? 'Nothing to run right now.' };
}

export const patternsDate = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long' });
