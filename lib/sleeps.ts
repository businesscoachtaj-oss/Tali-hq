// Sleep (10 Nov 2026, brain overhaul part 2). Each night Tali goes back over what she learnt and
// tidies her notes. These read the last few nights and undo one change. See docs/BRAIN_OVERHAUL_2.md.
import { supabase } from '@/lib/supabase';

export type SleepChange = { index: number; type: 'merged' | 'replaced' | 'combined' | 'faded'; text: string; was: string[]; undone: boolean };
export type SleepNight = { id: number; night: string; learned: string | null; new_memories: number; changes: SleepChange[] };

export async function mySleeps(limit = 3): Promise<SleepNight[]> {
  const { data, error } = await supabase.rpc('my_sleeps', { p_limit: limit });
  if (error || !Array.isArray(data)) return [];
  return (data as any[]).map((n) => ({
    id: Number(n.id),
    night: String(n.night ?? ''),
    learned: n.learned ? String(n.learned) : null,
    new_memories: Number(n.new_memories ?? 0),
    changes: Array.isArray(n.changes) ? n.changes.map((c: any) => ({ index: Number(c.index), type: c.type, text: String(c.text ?? ''), was: Array.isArray(c.was) ? c.was.map(String) : [], undone: !!c.undone })) : [],
  }));
}

export async function undoSleepChange(sleepId: number, index: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('my_sleep_undo', { p_sleep_id: sleepId, p_index: index });
  return !error && data === true;
}
