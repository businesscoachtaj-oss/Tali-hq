// Google (Gmail and Calendar) helpers for Tali HQ edge functions. Plain fetch, no SDK.
// Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (one OAuth web client, shared with Totality).
// Tokens live in public.google_connections (server only). Every call refreshes the access
// token when it is within a minute of expiring.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';

export const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
export const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
export const googleReady = () => GOOGLE_CLIENT_ID.length > 0 && GOOGLE_CLIENT_SECRET.length > 0;

// What each scope set asks Google for. 'both' is the Tali HQ default; Totality asks for calendar only.
export const SCOPES = {
  gmail: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'],
  calendar: ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly'],
  identity: ['openid', 'email'],
};

export type GoogleConnection = {
  user_id: string;
  google_email: string;
  scopes: string[];
  access_token: string;
  access_expires_at: string;
  refresh_token: string;
  calendar_id: string;
  mail_sync_after: string | null;
  last_mail_sync_at: string | null;
};

export class GoogleError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function exchangeCode(code: string, redirectUri: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  });
  const data = await res.json();
  if (!res.ok) throw new GoogleError(res.status, data?.error_description ?? data?.error ?? 'token exchange failed');
  return data as { access_token: string; expires_in: number; refresh_token?: string; scope: string; id_token?: string };
}

export async function revokeToken(token: string) {
  await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  }).catch(() => {});
}

// The signed-in Google account's email, from the id_token (we only read it, never verify for auth).
export function emailFromIdToken(idToken: string | undefined) {
  try {
    if (!idToken) return null;
    const payload = JSON.parse(atob(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

export async function loadConnection(admin: SupabaseClient, userId: string): Promise<GoogleConnection | null> {
  const { data } = await admin.from('google_connections').select('*').eq('user_id', userId).maybeSingle();
  return (data as GoogleConnection | null) ?? null;
}

async function freshToken(admin: SupabaseClient, conn: GoogleConnection) {
  if (new Date(conn.access_expires_at).getTime() - Date.now() > 60_000) return conn.access_token;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, refresh_token: conn.refresh_token, grant_type: 'refresh_token' }),
  });
  const data = await res.json();
  if (!res.ok) {
    // invalid_grant means they revoked access in their Google account: remember that so the app can say so.
    await admin.from('google_connections').update({ last_error: data?.error === 'invalid_grant' ? 'revoked' : String(data?.error ?? 'refresh failed') }).eq('user_id', conn.user_id);
    throw new GoogleError(res.status, data?.error_description ?? data?.error ?? 'refresh failed');
  }
  const expires = new Date(Date.now() + (Number(data.expires_in) || 3600) * 1000).toISOString();
  await admin.from('google_connections').update({ access_token: data.access_token, access_expires_at: expires, last_error: null }).eq('user_id', conn.user_id);
  conn.access_token = data.access_token;
  conn.access_expires_at = expires;
  return conn.access_token;
}

// One Google API call as this user.
export async function gapi<T = any>(admin: SupabaseClient, conn: GoogleConnection, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, body?: unknown): Promise<T> {
  const token = await freshToken(admin, conn);
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return {} as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new GoogleError(res.status, data?.error?.message ?? `Google ${res.status}`);
  return data as T;
}

// ---------- Calendar ----------
export type CalEvent = { id: string; title: string; start: string; end: string; all_day: boolean; location: string | null; attendees: string[]; link: string | null };

function localDayRange(tz: string, dayOffset: number) {
  // Midnight to midnight in the user's timezone, as ISO strings.
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === 'year')?.value), m = Number(parts.find((p) => p.type === 'month')?.value), d = Number(parts.find((p) => p.type === 'day')?.value);
  const offsetMin = (() => {
    const s = new Intl.DateTimeFormat('en-AU', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(now).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+00:00';
    const mm = s.match(/([+-])(\d{2}):(\d{2})/);
    return mm ? (mm[1] === '-' ? -1 : 1) * (Number(mm[2]) * 60 + Number(mm[3])) : 0;
  })();
  const startUtc = Date.UTC(y, m - 1, d + dayOffset) - offsetMin * 60_000;
  return { start: new Date(startUtc).toISOString(), end: new Date(startUtc + 86_400_000).toISOString() };
}

export async function calendarEvents(admin: SupabaseClient, conn: GoogleConnection, tz: string, days = 2): Promise<CalEvent[]> {
  const { start } = localDayRange(tz, 0);
  const { end } = localDayRange(tz, days - 1);
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conn.calendar_id || 'primary')}/events`);
  url.searchParams.set('timeMin', start);
  url.searchParams.set('timeMax', end);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '40');
  const data = await gapi<{ items?: any[] }>(admin, conn, 'GET', url.toString());
  return (data.items ?? [])
    .filter((e) => e.status !== 'cancelled')
    .map((e) => ({
      id: String(e.id),
      title: String(e.summary ?? '(no title)').slice(0, 120),
      start: e.start?.dateTime ?? e.start?.date ?? '',
      end: e.end?.dateTime ?? e.end?.date ?? '',
      all_day: !e.start?.dateTime,
      location: e.location ? String(e.location).slice(0, 120) : null,
      attendees: Array.isArray(e.attendees) ? e.attendees.map((a: any) => String(a.email)).slice(0, 6) : [],
      link: e.htmlLink ?? null,
    }));
}

// Today and tomorrow, as a compact blob Tali can read: events in local time plus free gaps (7am to 7pm).
export async function calendarSummary(admin: SupabaseClient, conn: GoogleConnection, tz: string) {
  const events = await calendarEvents(admin, conn, tz, 2);
  const fmt = (iso: string, allDay: boolean) =>
    allDay ? 'all day' : new Date(iso).toLocaleString('en-AU', { timeZone: tz, weekday: 'short', hour: 'numeric', minute: '2-digit' });
  const today = localDayRange(tz, 0);
  const todays = events.filter((e) => !e.all_day && e.start >= today.start && e.start < today.end).sort((a, b) => a.start.localeCompare(b.start));
  // Free gaps of 45 minutes or more between 7am and 7pm local, today.
  const dayStart = new Date(today.start).getTime() + 7 * 3600_000, dayEnd = new Date(today.start).getTime() + 19 * 3600_000;
  const gaps: string[] = [];
  let cursor = Math.max(dayStart, Date.now());
  for (const e of todays) {
    const s = new Date(e.start).getTime(), en = new Date(e.end).getTime();
    if (s - cursor >= 45 * 60_000) gaps.push(`${fmt(new Date(cursor).toISOString(), false)} to ${fmt(new Date(s).toISOString(), false)}`);
    cursor = Math.max(cursor, en);
  }
  if (dayEnd - cursor >= 45 * 60_000) gaps.push(`${fmt(new Date(cursor).toISOString(), false)} to ${fmt(new Date(dayEnd).toISOString(), false)}`);
  return {
    account: conn.google_email,
    events: events.map((e) => ({ title: e.title, when: `${fmt(e.start, e.all_day)}${e.all_day ? '' : ' to ' + new Date(e.end).toLocaleTimeString('en-AU', { timeZone: tz, hour: 'numeric', minute: '2-digit' })}`, location: e.location, attendees: e.attendees })),
    free_today: gaps.slice(0, 6),
  };
}

export async function calendarCreate(admin: SupabaseClient, conn: GoogleConnection, ev: { title: string; start: string; end: string; attendee_email?: string | null; location?: string | null; description?: string | null }, tz: string) {
  const body: any = {
    summary: ev.title.slice(0, 200),
    start: { dateTime: ev.start, timeZone: tz },
    end: { dateTime: ev.end, timeZone: tz },
    location: ev.location || undefined,
    description: ev.description || undefined,
  };
  if (ev.attendee_email) body.attendees = [{ email: ev.attendee_email }];
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conn.calendar_id || 'primary')}/events?sendUpdates=${ev.attendee_email ? 'all' : 'none'}`;
  return gapi<{ id: string; htmlLink?: string }>(admin, conn, 'POST', url, body);
}

// ---------- Gmail ----------
export type GmailMessage = { id: string; threadId: string; from_name: string | null; from_email: string; to_email: string | null; subject: string; snippet: string; text: string; received_at: string; message_id_header: string | null; labels: string[] };

function b64urlDecode(s: string) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function parseAddress(raw: string) {
  const m = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || null, email: m[2].trim().toLowerCase() };
  return { name: null, email: raw.trim().toLowerCase() };
}
export function htmlToText(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
function partText(p: any): { text: string; html: string } {
  let text = '', html = '';
  const walk = (part: any) => {
    if (!part) return;
    const mime = String(part.mimeType ?? '');
    if (part.body?.data) {
      if (mime === 'text/plain' && !text) text = b64urlDecode(part.body.data);
      else if (mime === 'text/html' && !html) html = b64urlDecode(part.body.data);
    }
    for (const c of part.parts ?? []) walk(c);
  };
  walk(p);
  return { text, html };
}

// New inbox mail since `after` (ISO), newest first, up to `max`. Promotions and social are skipped.
export async function gmailNew(admin: SupabaseClient, conn: GoogleConnection, after: string, max = 20): Promise<GmailMessage[]> {
  const epoch = Math.floor(new Date(after).getTime() / 1000);
  const q = `in:inbox after:${epoch} -category:promotions -category:social -category:forums -from:me`;
  const list = await gapi<{ messages?: { id: string; threadId: string }[] }>(admin, conn, 'GET', `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}&q=${encodeURIComponent(q)}`);
  const out: GmailMessage[] = [];
  for (const m of list.messages ?? []) {
    const full = await gapi<any>(admin, conn, 'GET', `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`);
    const h = (name: string) => (full.payload?.headers ?? []).find((x: any) => String(x.name).toLowerCase() === name)?.value ?? '';
    const from = parseAddress(String(h('from')));
    const { text, html } = partText(full.payload);
    const body = (text || htmlToText(html)).slice(0, 12000);
    out.push({
      id: String(full.id),
      threadId: String(full.threadId),
      from_name: from.name,
      from_email: from.email,
      to_email: parseAddress(String(h('to')).split(',')[0] || '').email || null,
      subject: String(h('subject') || '(no subject)').slice(0, 300),
      snippet: String(full.snippet ?? '').slice(0, 300),
      text: body,
      received_at: new Date(Number(full.internalDate) || Date.now()).toISOString(),
      message_id_header: String(h('message-id')) || null,
      labels: Array.isArray(full.labelIds) ? full.labelIds : [],
    });
  }
  return out;
}

function b64url(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function encodeHeader(s: string) {
  // RFC 2047 for anything outside ASCII (names and subjects with accents or emoji).
  return /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${btoa(unescape(encodeURIComponent(s)))}?=`;
}

export async function gmailSend(admin: SupabaseClient, conn: GoogleConnection, msg: { to: string; subject: string; body: string; thread_id?: string | null; in_reply_to?: string | null; from_name?: string | null }) {
  const headers = [
    `From: ${msg.from_name ? `${encodeHeader(msg.from_name)} <${conn.google_email}>` : conn.google_email}`,
    `To: ${msg.to}`,
    `Subject: ${encodeHeader(msg.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
  ];
  if (msg.in_reply_to) headers.push(`In-Reply-To: ${msg.in_reply_to}`, `References: ${msg.in_reply_to}`);
  const raw = b64url(headers.join('\r\n') + '\r\n\r\n' + msg.body);
  const body: any = { raw };
  if (msg.thread_id) body.threadId = msg.thread_id;
  return gapi<{ id: string; threadId: string }>(admin, conn, 'POST', 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send', body);
}
