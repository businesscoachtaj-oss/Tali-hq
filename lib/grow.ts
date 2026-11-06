// Tali grows (6 Nov 2026, asked for by Taj after looking at his own Tali HQ dashboard).
// Rules she suggests for a yes or no, one idea a day from night school, and a receipts folder.
// Database: migration 20261106000049. Reading and the tax time zip: the tali-receipts edge function.
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

export type ReceiptDraft = Omit<Receipt, 'id'>;

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

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<{ ok: true } & T | { ok: false; message: string }> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    try {
      const b = await (error as any).context?.json?.();
      if (b?.message) return { ok: false, message: b.message };
    } catch {}
    return { ok: false, message: "Couldn't reach the server. Try again." };
  }
  return data;
}

// Upload the file to the private receipts bucket under <user id>/, then Tali reads it.
export async function uploadReceipt(file: { blob: Blob; name: string; mime: string }): Promise<{ path: string; kind: 'image' | 'pdf' }> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error('Not signed in');
  const pdf = file.mime === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!pdf && !file.mime.startsWith('image/')) throw new Error('Photos and PDFs only.');
  if (file.blob.size > 10 * 1024 * 1024) throw new Error(`${file.name} is over 10 MB.`);
  const ext = pdf ? 'pdf' : file.mime === 'image/png' ? 'png' : file.mime === 'image/webp' ? 'webp' : 'jpg';
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const path = `${uid}/${id}.${ext}`;
  const { error } = await supabase.storage.from('receipts').upload(path, file.blob, { contentType: pdf ? 'application/pdf' : file.mime, upsert: false });
  if (error) throw new Error('Could not upload that file. Try again.');
  return { path, kind: pdf ? 'pdf' : 'image' };
}

export async function readReceipt(path: string) {
  return invoke<{ receipt: { vendor: string; date: string; amount: number; gst: number; category: Receipt['category']; file_kind: 'image' | 'pdf' } }>('tali-receipts', { action: 'read', path });
}

export async function saveReceipt(r: ReceiptDraft) {
  const { error } = await supabase.from('receipts').insert(r);
  if (error) throw new Error('Could not save that receipt. Check the details and try again.');
}

export async function deleteReceipt(r: Receipt) {
  const { error } = await supabase.from('receipts').delete().eq('id', r.id);
  if (error) throw new Error('Could not delete that receipt.');
  await supabase.storage.from('receipts').remove([r.path]);
}

// Throws away a file that was uploaded but never saved (they cancelled the check).
export async function discardReceiptFile(path: string) {
  await supabase.storage.from('receipts').remove([path]);
}

export async function receiptLink(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('receipts').createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

export async function receiptsZip(from: string, to: string) {
  return invoke<{ url: string; count: number }>('tali-receipts', { action: 'zip', from, to });
}
