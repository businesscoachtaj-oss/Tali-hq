// Decision log (3 Nov 2026): what you decided, why, and when. Free reads and writes the log;
// "Ask Tali why" (Talk prefilled) is Tali HQ and up. No credits for the log itself.
import { supabase } from './supabase';

export type Decision = {
  id: string;
  decision: string;
  reasoning: string | null;
  decided_at: string;        // YYYY-MM-DD
  source_ref: string | null; // 'app' or messages/<id>
  revisited_at: string | null;
  outcome: string | null;
  created_at: string;
};

const COLS = 'id, decision, reasoning, decided_at, source_ref, revisited_at, outcome, created_at';

export async function decisions(limit = 200): Promise<Decision[]> {
  const { data, error } = await supabase
    .from('decisions')
    .select(COLS)
    .order('decided_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Decision[]) ?? [];
}

export async function saveDecision(d: { id?: string; decision: string; reasoning: string; decided_at: string }) {
  const row = { decision: d.decision.trim(), reasoning: d.reasoning.trim() || null, decided_at: d.decided_at };
  if (d.id) {
    const { error } = await supabase.from('decisions').update(row).eq('id', d.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('decisions').insert({ ...row, source_ref: 'app' });
    if (error) throw error;
  }
}

export async function deleteDecision(id: string) {
  const { error } = await supabase.from('decisions').delete().eq('id', id);
  if (error) throw error;
}

export const askWhyQuestion = (decision: string) => `Why did I decide: ${decision.trim()}? Remind me of my reasoning and whether it still holds.`;
