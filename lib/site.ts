// 12 Nov 2026 (Taj): Website. A simple site Tali HQ hosts at talihq.com.au/site/<name>, and On autopilot,
// rules that put a nudge on your To do so nothing slips.
import { supabase } from './supabase';
import { cleanSlug } from './bookings';

export type SiteSection = { heading: string; text: string };
export type Site = { slug: string; published: boolean; kind: 'business' | 'life'; title: string; tagline: string; about: string; sections: SiteSection[]; accent: string; show_services: boolean; show_booking: boolean; show_contact: boolean; contact_email: string; contact_phone: string };
export type Enquiry = { id: string; name: string; email: string | null; phone: string | null; message: string; created_at: string };
export const SITE_BASE = 'https://talihq.com.au/site/';
export const ACCENTS = ['#7FA8FF', '#B98CFF', '#7FE0B0', '#FFB561', '#FF8A7E', '#F472B6'];

export const blankSite = (kind: Site['kind']): Site => ({ slug: '', published: false, kind, title: '', tagline: '', about: '', sections: [], accent: ACCENTS[0], show_services: kind === 'business', show_booking: kind === 'business', show_contact: true, contact_email: '', contact_phone: '' });

export async function mySite(): Promise<Site | null> {
  const { data, error } = await supabase.from('sites').select('slug, published, kind, title, tagline, about, sections, accent, show_services, show_booking, show_contact, contact_email, contact_phone').maybeSingle();
  if (error) throw error;
  const d = data as any;
  return d ? { ...d, sections: Array.isArray(d.sections) ? d.sections : [], contact_email: d.contact_email ?? '', contact_phone: d.contact_phone ?? '' } : null;
}
export async function saveSite(userId: string, s: Site) {
  const slug = cleanSlug(s.slug);
  if (slug.length < 3) throw new Error('Pick an address with at least 3 letters or numbers.');
  const sections = s.sections.map((x) => ({ heading: x.heading.trim().slice(0, 80), text: x.text.trim().slice(0, 1200) })).filter((x) => x.heading || x.text).slice(0, 8);
  const { error } = await supabase.from('sites').upsert({
    user_id: userId, slug, published: s.published, kind: s.kind, title: s.title.trim().slice(0, 80), tagline: s.tagline.trim().slice(0, 160), about: s.about.trim().slice(0, 2000),
    sections, accent: s.accent, show_services: s.show_services, show_booking: s.show_booking, show_contact: s.show_contact,
    contact_email: s.contact_email.trim().slice(0, 200) || null, contact_phone: s.contact_phone.trim().slice(0, 40) || null, updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'That address is taken. Try another.' : error.message);
}
export async function enquiries(): Promise<Enquiry[]> {
  const { data, error } = await supabase.from('site_enquiries').select('id, name, email, phone, message, created_at').order('created_at', { ascending: false }).limit(30);
  if (error) throw error;
  return (data as Enquiry[]) ?? [];
}
export async function deleteEnquiry(id: string) {
  const { error } = await supabase.from('site_enquiries').delete().eq('id', id);
  if (error) throw error;
}

// ---------- The public site (no sign in) ----------
export type PublicSite = { name: string; kind: 'business' | 'life'; tagline: string; about: string; sections: SiteSection[]; accent: string; book_slug: string | null; show_contact: boolean; contact_email: string | null; contact_phone: string | null; services: { name: string; minutes: number; price: number | null }[] };
export async function publicSite(slug: string): Promise<PublicSite | null> {
  const { data, error } = await supabase.rpc('site_public', { p_slug: slug });
  if (error) throw error;
  return (data as PublicSite) ?? null;
}
export async function publicEnquiry(slug: string, r: { name: string; email: string; phone: string; message: string }): Promise<{ ok: boolean; message?: string }> {
  const { data, error } = await supabase.rpc('site_enquiry_public', { p_slug: slug, p_name: r.name, p_email: r.email || null, p_phone: r.phone || null, p_message: r.message || null });
  if (error) return { ok: false, message: 'Could not send that. Try again.' };
  return (data as any) ?? { ok: false };
}

// ---------- On autopilot ----------
export type AutoKind = 'quote_followup' | 'invoice_overdue' | 'new_lead' | 'booking_request' | 'job_to_invoice';
export const AUTO: { kind: AutoKind; title: string; sub: string }[] = [
  { kind: 'quote_followup', title: 'Follow up a quote', sub: 'When a quote has been sent for 3 days with no answer' },
  { kind: 'invoice_overdue', title: 'Chase a late invoice', sub: 'When a sent invoice goes past its due date' },
  { kind: 'new_lead', title: 'Get back to a new lead', sub: 'When a new lead has waited a day without hearing from you' },
  { kind: 'booking_request', title: 'Answer a booking request', sub: 'When someone asks for a time through your booking link' },
  { kind: 'job_to_invoice', title: 'Invoice a finished job', sub: 'When a job is marked done and has no invoice yet' },
];
export async function autoRules(): Promise<Record<string, boolean>> {
  const { data, error } = await supabase.from('automations').select('kind, enabled');
  if (error) throw error;
  return Object.fromEntries(((data as any[]) ?? []).map((r) => [r.kind, !!r.enabled]));
}
export async function setAutoRule(userId: string, kind: AutoKind, enabled: boolean) {
  const { error } = await supabase.from('automations').upsert({ user_id: userId, kind, enabled, updated_at: new Date().toISOString() });
  if (error) throw error;
}
/** Runs your rules and adds any new nudges to your To do. Quiet if anything goes wrong. */
export async function runAutopilot(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('automations_run');
    return error ? 0 : Number(data ?? 0);
  } catch { return 0; }
}
export async function autoCounts(): Promise<Record<string, number>> {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data, error } = await supabase.from('automation_log').select('kind').gte('created_at', since).limit(1000);
  if (error) return {};
  const out: Record<string, number> = {};
  for (const r of (data as any[]) ?? []) out[r.kind] = (out[r.kind] ?? 0) + 1;
  return out;
}

// ---------- Ask Tali to write it ----------
export type SiteDraft = { title: string; tagline: string; about: string; sections: SiteSection[] };
/** Tali drafts the words. Nothing is saved until the owner saves. */
export async function writeSite(kind: Site['kind'], notes: string): Promise<{ ok: true; draft: SiteDraft } | { ok: false; message: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('tali-site-write', { body: { kind, notes } });
    if (error) {
      let message = 'Tali could not write that. Try again in a minute.';
      try { const b = await (error as any).context?.json?.(); if (b?.message) message = b.message; } catch {}
      return { ok: false, message };
    }
    const d = data as any;
    return d?.ok && d.draft ? { ok: true, draft: d.draft } : { ok: false, message: d?.message ?? 'Tali could not write that. Try again in a minute.' };
  } catch { return { ok: false, message: 'Tali could not write that. Try again in a minute.' }; }
}
