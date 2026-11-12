// 12 Nov 2026 (Taj): Quote calculator. A hosted page where a customer picks what they want and sees
// a rough price, then sends it. It lands in the Pipeline as a new lead with the estimate.
import { supabase } from './supabase';
import { cleanSlug } from './bookings';

export type CalcChoice = { label: string; price: number };
export type CalcItem = { id: string; label: string; kind: 'qty' | 'tick' | 'choice'; price: number; unit: string; max: number; choices: CalcChoice[] };
export type Calc = { slug: string; enabled: boolean; title: string; intro: string; base: number; items: CalcItem[] };
export type Answers = Record<string, number | boolean>;
export const QUOTE_BASE = 'https://talihq.com.au/quote/';
export const KIND_LABEL: Record<CalcItem['kind'], string> = { qty: 'How many', tick: 'Yes or no', choice: 'Pick one' };

export const blankCalc = (): Calc => ({ slug: '', enabled: false, title: '', intro: '', base: 0, items: [] });
export const newItem = (kind: CalcItem['kind']): CalcItem => ({ id: Math.random().toString(36).slice(2, 10), label: '', kind, price: 0, unit: '', max: 20, choices: kind === 'choice' ? [{ label: '', price: 0 }, { label: '', price: 0 }] : [] });
const num = (v: unknown, max = 1000000) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n * 100) / 100, max) : 0; };

function tidy(items: unknown): CalcItem[] {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 20).map((x: any) => ({
    id: String(x?.id ?? '').slice(0, 20) || Math.random().toString(36).slice(2, 10),
    label: String(x?.label ?? '').trim().slice(0, 80),
    kind: (x?.kind === 'tick' || x?.kind === 'choice' ? x.kind : 'qty') as CalcItem['kind'],
    price: num(x?.price), unit: String(x?.unit ?? '').trim().slice(0, 20), max: Math.max(1, Math.min(999, Math.round(Number(x?.max) || 20))),
    choices: Array.isArray(x?.choices) ? x.choices.slice(0, 6).map((c: any) => ({ label: String(c?.label ?? '').trim().slice(0, 60), price: num(c?.price) })) : [],
  }));
}

export async function myCalc(): Promise<Calc | null> {
  const { data, error } = await supabase.from('quote_calcs').select('slug, enabled, title, intro, base, items').maybeSingle();
  if (error) throw error;
  const d = data as any;
  return d ? { slug: d.slug, enabled: !!d.enabled, title: d.title ?? '', intro: d.intro ?? '', base: Number(d.base) || 0, items: tidy(d.items) } : null;
}
export async function saveCalc(userId: string, c: Calc) {
  const slug = cleanSlug(c.slug);
  if (slug.length < 3) throw new Error('Pick a link name with at least 3 letters or numbers.');
  const items = tidy(c.items).filter((i) => i.label).map((i) => ({ ...i, choices: i.kind === 'choice' ? i.choices.filter((ch) => ch.label) : [] })).filter((i) => i.kind !== 'choice' || i.choices.length >= 2);
  if (c.enabled && !items.length && !num(c.base)) throw new Error('Add a starting price or at least one thing to pick before it goes live.');
  const { error } = await supabase.from('quote_calcs').upsert({ user_id: userId, slug, enabled: c.enabled, title: c.title.trim().slice(0, 80), intro: c.intro.trim().slice(0, 400), base: num(c.base), items, updated_at: new Date().toISOString() });
  if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'That link name is taken. Try another.' : error.message);
}

/** The rough price for a set of picks. The server works it out again when the request is sent. */
export function estimate(c: { base: number; items: CalcItem[] }, a: Answers): number {
  let total = Number(c.base) || 0;
  for (const it of c.items) {
    const v = a[it.id];
    if (it.kind === 'qty' && typeof v === 'number') total += it.price * Math.max(0, Math.min(Math.floor(v), it.max));
    else if (it.kind === 'tick' && v === true) total += it.price;
    else if (it.kind === 'choice' && typeof v === 'number' && it.choices[v]) total += it.choices[v].price;
  }
  return Math.round(total * 100) / 100;
}
export const money = (n: number) => `A$${n.toLocaleString('en-AU', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

// ---------- The public page (no sign in) ----------
export type PublicCalc = { name: string; title: string; intro: string; base: number; items: CalcItem[] };
export async function publicCalc(slug: string): Promise<PublicCalc | null> {
  const { data, error } = await supabase.rpc('quote_calc_public', { p_slug: slug });
  if (error) throw error;
  const d = data as any;
  return d ? { name: d.name, title: d.title ?? '', intro: d.intro ?? '', base: Number(d.base) || 0, items: tidy(d.items) } : null;
}
export async function publicQuoteRequest(slug: string, r: { name: string; email: string; phone: string; note: string; answers: Answers }): Promise<{ ok: boolean; message?: string; estimate?: number }> {
  const { data, error } = await supabase.rpc('quote_request_public', { p_slug: slug, p_name: r.name, p_email: r.email || null, p_phone: r.phone || null, p_note: r.note || null, p_answers: r.answers });
  if (error) return { ok: false, message: 'Could not send that. Try again.' };
  return (data as any) ?? { ok: false };
}

/** Tali drafts the things to pick from a description of the work. Nothing is saved until the owner saves. */
export async function writeCalc(notes: string): Promise<{ ok: true; draft: { title: string; intro: string; base: number; items: CalcItem[] } } | { ok: false; message: string }> {
  const fail = 'Tali could not set that up. Try again in a minute.';
  try {
    const { data, error } = await supabase.functions.invoke('tali-site-write', { body: { mode: 'calc', notes } });
    if (error) {
      let message = fail;
      try { const b = await (error as any).context?.json?.(); if (b?.message) message = b.message; } catch {}
      return { ok: false, message };
    }
    const d = data as any;
    return d?.ok && d.calc ? { ok: true, draft: { title: String(d.calc.title ?? ''), intro: String(d.calc.intro ?? ''), base: num(d.calc.base), items: tidy(d.calc.items) } } : { ok: false, message: d?.message ?? fail };
  } catch { return { ok: false, message: fail }; }
}
