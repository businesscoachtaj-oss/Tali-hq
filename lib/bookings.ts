// 12 Nov 2026 (Taj): Bookings. Your services, your week, and one link customers book from.
import { supabase } from './supabase';

export type Service = { id: string; name: string; minutes: number; price: number | null; active: boolean };
export type BookingStatus = 'requested' | 'booked' | 'done' | 'cancelled';
export type Booking = { id: string; client_id: string | null; client_name: string; client_email: string | null; client_phone: string | null; service_id: string | null; title: string; starts_at: string; minutes: number; place: string; status: BookingStatus; source: 'you' | 'tali' | 'link'; notes: string };
export type BookingPage = { slug: string; enabled: boolean; intro: string; days: number[]; day_start: string; day_end: string };
export const BOOK_BASE = 'https://talihq.com.au/book/';

const B = 'id, client_id, client_name, client_email, client_phone, service_id, title, starts_at, minutes, place, status, source, notes';

export async function services(): Promise<Service[]> {
  const { data, error } = await supabase.from('services').select('id, name, minutes, price, active').order('created_at');
  if (error) throw error;
  return ((data as any[]) ?? []).map((s) => ({ ...s, price: s.price == null ? null : Number(s.price) }));
}
export async function saveService(s: { id?: string; name: string; minutes: number; price: number | null; active?: boolean }) {
  const row = { name: s.name.trim().slice(0, 80), minutes: Math.max(5, Math.min(480, Math.round(s.minutes) || 60)), price: s.price, ...(s.active !== undefined ? { active: s.active } : {}) };
  const { error } = s.id ? await supabase.from('services').update(row).eq('id', s.id) : await supabase.from('services').insert(row);
  if (error) throw error;
}
export async function deleteService(id: string) {
  const { error } = await supabase.from('services').delete().eq('id', id);
  if (error) throw error;
}

/** Everything from the start of this week to five weeks out, plus anything still waiting for a yes. */
export async function bookings(fromIso: string, toIso: string): Promise<Booking[]> {
  const { data, error } = await supabase.from('bookings').select(B).or(`and(starts_at.gte.${fromIso},starts_at.lt.${toIso}),status.eq.requested`).neq('status', 'cancelled').order('starts_at').limit(400);
  if (error) throw error;
  return (data as Booking[]) ?? [];
}
export async function saveBooking(b: { id?: string; title: string; client_name: string; client_id?: string | null; service_id?: string | null; starts_at: string; minutes: number; place: string; notes?: string }) {
  const row = { title: b.title.trim().slice(0, 160), client_name: b.client_name.trim().slice(0, 120), client_id: b.client_id ?? null, service_id: b.service_id ?? null, starts_at: b.starts_at, minutes: Math.max(5, Math.round(b.minutes) || 60), place: b.place.trim().slice(0, 300), notes: (b.notes ?? '').slice(0, 1000) };
  const { error } = b.id ? await supabase.from('bookings').update(row).eq('id', b.id) : await supabase.from('bookings').insert(row);
  if (error) throw error;
}
export async function setBookingStatus(id: string, status: BookingStatus) {
  const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function bookingPage(): Promise<BookingPage | null> {
  const { data, error } = await supabase.from('booking_pages').select('slug, enabled, intro, days, day_start, day_end').maybeSingle();
  if (error) throw error;
  const d = data as any;
  return d ? { ...d, day_start: String(d.day_start).slice(0, 5), day_end: String(d.day_end).slice(0, 5) } : null;
}
export const cleanSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
export async function saveBookingPage(userId: string, p: BookingPage) {
  const slug = cleanSlug(p.slug);
  if (slug.length < 3) throw new Error('Pick a link name with at least 3 letters or numbers.');
  const { error } = await supabase.from('booking_pages').upsert({ user_id: userId, slug, enabled: p.enabled, intro: p.intro.slice(0, 300), days: p.days, day_start: `${p.day_start}:00`, day_end: `${p.day_end}:00`, updated_at: new Date().toISOString() });
  if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'That link name is taken. Try another.' : error.message);
}

// ---------- The public page (no sign in) ----------
export type PublicPage = { name: string; timezone: string; intro: string; days: number[]; day_start: string; day_end: string; services: { id: string; name: string; minutes: number; price: number | null }[]; busy: { starts_at: string; minutes: number }[] };
export async function publicPage(slug: string): Promise<PublicPage | null> {
  const { data, error } = await supabase.rpc('booking_page_public', { p_slug: slug });
  if (error) throw error;
  return (data as PublicPage) ?? null;
}
export async function publicRequest(slug: string, r: { service_id: string; starts_at: string; name: string; email: string; phone: string; note: string }): Promise<{ ok: boolean; message?: string }> {
  const { data, error } = await supabase.rpc('booking_request_public', { p_slug: slug, p_service_id: r.service_id, p_starts_at: r.starts_at, p_name: r.name, p_email: r.email || null, p_phone: r.phone || null, p_note: r.note || null });
  if (error) return { ok: false, message: 'Could not send that. Try again.' };
  return data as { ok: boolean; message?: string };
}

/** Local day and time in a timezone, to an instant. Good to the minute across daylight saving. */
export function zonedIso(day: string, hm: string, timeZone: string): string {
  const guess = new Date(`${day}T${hm}:00Z`);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const shown = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
  return new Date(guess.getTime() - (shown - guess.getTime())).toISOString();
}
