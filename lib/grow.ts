// Tali grows (6 Nov 2026, asked for by Taj after looking at his own Tali HQ dashboard).
// Rules she suggests for a yes or no, one idea a day from night school, and a receipts folder.
// MOCKUP: the RPCs and the receipts table below don't exist yet. They land with the migration once
// Taj approves the screens.
import { supabase } from './supabase';
import type { RuleType } from './data';

// ---- Rules she suggests -------------------------------------------------------------------------
// A habit is how she behaves (it becomes a rule in the frontal lobe of her brain). An automation is
// one of the Rules page templates, filled in for you.
export type RuleSuggestion = {
  id: string;
  kind: 'habit' | 'automation';
  text: string;
  why: string;
  from: 'weekly_review' | 'night_school' | 'chats';
  rule_type?: RuleType;
  params?: Record<string, any>;
};

export async function ruleSuggestions(): Promise<RuleSuggestion[]> {
  const { data, error } = await supabase.rpc('my_rule_suggestions');
  if (error) return [];
  return (data as RuleSuggestion[]) ?? [];
}

export async function answerRuleSuggestion(id: string, yes: boolean): Promise<boolean> {
  const { error } = await supabase.rpc('answer_rule_suggestion', { p_id: id, p_yes: yes });
  return !error;
}

// ---- An idea from night school ------------------------------------------------------------------
export type NightIdea = { id: string; topic: string; idea: string; why: string; for_date: string };

export async function nightIdea(): Promise<NightIdea | null> {
  const { data, error } = await supabase.rpc('my_night_idea');
  if (error || !data) return null;
  return data as NightIdea;
}

// 'try' keeps it on her list for the Friday review; 'skip' hides it and she learns what you don't want.
export async function answerNightIdea(id: string, answer: 'try' | 'skip'): Promise<boolean> {
  const { error } = await supabase.rpc('answer_night_idea', { p_id: id, p_answer: answer });
  return !error;
}

// ---- Receipts folder ----------------------------------------------------------------------------
export const RECEIPT_TYPES = ['Supplies', 'Software', 'Travel', 'Equipment', 'Marketing', 'Other'] as const;
export type Receipt = {
  id: string;
  vendor: string;
  date: string; // yyyy-mm-dd
  amount: number;
  gst: number;
  category: (typeof RECEIPT_TYPES)[number];
  file_kind: 'image' | 'pdf';
  path: string;
};

export async function receipts(): Promise<Receipt[]> {
  const { data, error } = await supabase.from('receipts').select('id, vendor, date, amount, gst, category, file_kind, path').order('date', { ascending: false });
  if (error) throw new Error('Could not load your receipts. Try again in a minute.');
  return (data as Receipt[]) ?? [];
}

// The Australian financial year, 1 July to 30 June.
export function financialYear(d = new Date()): { start: string; end: string; label: string } {
  const y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  return { start: `${y}-07-01`, end: `${y + 1}-06-30`, label: `FY ${String(y).slice(2)}/${String(y + 1).slice(2)}` };
}
