// Microsoft 365 (Outlook mail and calendar) helpers, the Microsoft twin of google.ts. Added 2 Nov 2026.
// Secrets: MS_CLIENT_ID, MS_CLIENT_SECRET (one Entra app registration, "Accounts in any organizational
// directory and personal Microsoft accounts", redirect https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/ms-connect).
// Tokens live in public.microsoft_connections (server only). Access tokens are refreshed when within a minute of expiring.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';

export const MS_CLIENT_ID = (Deno.env.get('MS_CLIENT_ID') ?? '').trim();
export const MS_CLIENT_SECRET = (Deno.env.get('MS_CLIENT_SECRET') ?? '').trim();
export const msReady = () => MS_CLIENT_ID.length > 0 && MS_CLIENT_SECRET.length > 0;

const AUTH = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const GRAPH = 'https://graph.microsoft.com/v1.0';

// Delegated Graph permissions. offline_access gives the refresh token.
export const MS_SCOPES = {
  identity: ['openid', 'email', 'profile', 'offline_access', 'User.Read'],
  mail: ['Mail.Read', 'Mail.Send'],
  calendar: ['Calendars.ReadWrite'],
};

export type MsConnection = {
  user_id: string;
  ms_email: string;
  scopes: string[];
  access_token: string;
  access_expires_at: string;
  refresh_token: string;
  mail_sync_after: string | null;
  last_mail_sync_at: string | null;
  last_error?: string | null;
};

export class MsError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function authUrl(redirectUri: string, scopes: string[], state: string) {
  const u = new URL(`${AUTH}/authorize`);
  u.searchParams.set('client_id', MS_CLIENT_ID);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('response_mode', 'query');
  u.searchParams.set('scope', scopes.join(' '));
  u.searchParams.set('state', state);
  u.searchParams.set('prompt', 'select_account');
  return u.toString();
}

export async function exchangeCode(code: string, redirectUri: string, scopes: string[]) {
  const res = await fetch(`${AUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: MS_CLIENT_ID, client_secret: MS_CLIENT_SECRET, code, redirect_uri: redirectUri, grant_type: 'authorization_code', scope: scopes.join(' ') }),
  });
  const data = await res.json();
  if (!res.ok) throw new MsError(res.status, data?.error_description ?? data?.error ?? 'token exchange failed');
  return data as { access_token: string; expires_in: number; refresh_token?: string; scope: string; id_token?: string };
}

export function emailFromIdToken(idToken: string | undefined) {
  try {
    if (!idToken) return null;
    const p = JSON.parse(atob(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const e = p.email ?? p.preferred_username;
    return typeof e === 'string' && e.includes('@') ? e.toLowerCase() : null;
  } catch {
    return null;
  }
}

export async function loadConnection(admin: SupabaseClient, userId: string): Promise<MsConnection | null> {
  const { data } = await admin.from('microsoft_connections').select('*').eq('user_id', userId).maybeSingle();
  return (data as MsConnection | null) ?? null;
}

async function freshToken(admin: SupabaseClient, conn: MsConnection) {
  if (new Date(conn.access_expires_at).getTime() - Date.now() > 60_000) return conn.access_token;
  const res = await fetch(`${AUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: MS_CLIENT_ID, client_secret: MS_CLIENT_SECRET, refresh_token: conn.refresh_token, grant_type: 'refresh_token' }),
  });
  const data = await res.json();
  if (!res.ok) {
    await admin.from('microsoft_connections').update({ last_error: data?.error === 'invalid_grant' ? 'revoked' : String(data?.error ?? 'refresh failed') }).eq('user_id', conn.user_id);
    throw new MsError(res.status, data?.error_description ?? data?.error ?? 'refresh failed');
  }
  const expires = new Date(Date.now() + (Number(data.expires_in) || 3600) * 1000).toISOString();
  await admin.from('microsoft_connections').update({ access_token: data.access_token, access_expires_at: expires, ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}), last_error: null }).eq('user_id', conn.user_id);
  conn.access_token = data.access_token;
  conn.access_expires_at = expires;
  if (data.refresh_token) conn.refresh_token = data.refresh_token;
  return conn.access_token;
}

export async function graph<T = any>(admin: SupabaseClient, conn: MsConnection, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const token = await freshToken(admin, conn);
  const res = await fetch(path.startsWith('http') ? path : `${GRAPH}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 202 || res.status === 204) return {} as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new MsError(res.status, data?.error?.message ?? `Microsoft ${res.status}`);
  return data as T;
}

// ---------- Calendar ----------
export type CalEvent = { id: string; title: string; start: string; end: string; all_day: boolean; location: string | null; attendees: string[]; link: string | null };

function localDayRange(tz: string, dayOffset: number) {
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

export async function calendarEvents(admin: SupabaseClient, conn: MsConnection, tz: string, days = 2): Promise<CalEvent[]> {
  const { start } = localDayRange(tz, 0);
  const { end } = localDayRange(tz, days - 1);
  const path = `/me/calendarView?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}&$orderby=start/dateTime&$top=40&$select=id,subject,start,end,isAllDay,location,attendees,webLink,isCancelled`;
  const data = await graph<{ value?: any[] }>(admin, conn, 'GET', path, undefined, { Prefer: 'outlook.timezone="UTC"' });
  return (data.value ?? [])
    .filter((e) => !e.isCancelled)
    .map((e) => ({
      id: String(e.id),
      title: String(e.subject ?? '(no title)').slice(0, 120),
      start: e.start?.dateTime ? new Date(e.start.dateTime + 'Z').toISOString() : '',
      end: e.end?.dateTime ? new Date(e.end.dateTime + 'Z').toISOString() : '',
      all_day: !!e.isAllDay,
      location: e.location?.displayName ? String(e.location.displayName).slice(0, 120) : null,
      attendees: Array.isArray(e.attendees) ? e.attendees.map((a: any) => String(a.emailAddress?.address ?? '')).filter(Boolean).slice(0, 6) : [],
      link: e.webLink ?? null,
    }));
}

export async function calendarSummary(admin: SupabaseClient, conn: MsConnection, tz: string) {
  const events = await calendarEvents(admin, conn, tz, 2);
  const fmt = (iso: string, allDay: boolean) => (allDay ? 'all day' : new Date(iso).toLocaleString('en-AU', { timeZone: tz, weekday: 'short', hour: 'numeric', minute: '2-digit' }));
  const today = localDayRange(tz, 0);
  const todays = events.filter((e) => !e.all_day && e.start >= today.start && e.start < today.end).sort((a, b) => a.start.localeCompare(b.start));
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
    account: conn.ms_email,
    events: events.map((e) => ({ title: e.title, when: `${fmt(e.start, e.all_day)}${e.all_day ? '' : ' to ' + new Date(e.end).toLocaleTimeString('en-AU', { timeZone: tz, hour: 'numeric', minute: '2-digit' })}`, location: e.location, attendees: e.attendees })),
    free_today: gaps.slice(0, 6),
  };
}

export async function calendarCreate(admin: SupabaseClient, conn: MsConnection, ev: { title: string; start: string; end: string; attendee_email?: string | null; location?: string | null; description?: string | null }, tz: string) {
  const body: any = {
    subject: ev.title.slice(0, 200),
    start: { dateTime: new Date(ev.start).toISOString().replace('Z', ''), timeZone: 'UTC' },
    end: { dateTime: new Date(ev.end).toISOString().replace('Z', ''), timeZone: 'UTC' },
    location: ev.location ? { displayName: ev.location } : undefined,
    body: ev.description ? { contentType: 'text', content: ev.description } : undefined,
  };
  if (ev.attendee_email) body.attendees = [{ emailAddress: { address: ev.attendee_email }, type: 'required' }];
  const created = await graph<{ id: string; webLink?: string }>(admin, conn, 'POST', '/me/events', body);
  return { id: created.id, htmlLink: created.webLink ?? null };
}

// ---------- Mail ----------
export type MailMessage = { id: string; threadId: string; from_name: string | null; from_email: string; to_email: string | null; subject: string; snippet: string; text: string; received_at: string; message_id_header: string | null };

function htmlToText(html: string) {
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

// New inbox mail since `after` (ISO), newest first. Outlook's "Other" (focused inbox) is still the inbox, so
// Junk and Clutter are the only folders left out, by reading the Inbox folder alone.
export async function mailNew(admin: SupabaseClient, conn: MsConnection, after: string, max = 20): Promise<MailMessage[]> {
  const filter = encodeURIComponent(`receivedDateTime ge ${new Date(after).toISOString()}`);
  const path = `/me/mailFolders/inbox/messages?$filter=${filter}&$orderby=receivedDateTime desc&$top=${max}&$select=id,conversationId,from,toRecipients,subject,bodyPreview,body,receivedDateTime,internetMessageId,isDraft`;
  const data = await graph<{ value?: any[] }>(admin, conn, 'GET', path, undefined, { Prefer: 'outlook.body-content-type="text"' });
  return (data.value ?? [])
    .filter((m) => !m.isDraft)
    .map((m) => {
      const bodyText = String(m.body?.contentType === 'html' ? htmlToText(String(m.body?.content ?? '')) : m.body?.content ?? '').slice(0, 12000);
      return {
        id: String(m.id),
        threadId: String(m.conversationId ?? m.id),
        from_name: m.from?.emailAddress?.name ?? null,
        from_email: String(m.from?.emailAddress?.address ?? '').toLowerCase(),
        to_email: m.toRecipients?.[0]?.emailAddress?.address ? String(m.toRecipients[0].emailAddress.address).toLowerCase() : null,
        subject: String(m.subject || '(no subject)').slice(0, 300),
        snippet: String(m.bodyPreview ?? '').slice(0, 300),
        text: bodyText,
        received_at: new Date(m.receivedDateTime).toISOString(),
        message_id_header: m.internetMessageId ?? null,
      };
    });
}

// Replies in the same Outlook conversation when message_id is given; otherwise sends a new message.
export async function mailSend(admin: SupabaseClient, conn: MsConnection, msg: { to: string; subject: string; body: string; reply_to_message_id?: string | null }) {
  if (msg.reply_to_message_id) {
    await graph(admin, conn, 'POST', `/me/messages/${encodeURIComponent(msg.reply_to_message_id)}/reply`, {
      comment: msg.body,
      message: { toRecipients: [{ emailAddress: { address: msg.to } }] },
    });
    return { id: msg.reply_to_message_id };
  }
  await graph(admin, conn, 'POST', '/me/sendMail', {
    message: { subject: msg.subject, body: { contentType: 'Text', content: msg.body }, toRecipients: [{ emailAddress: { address: msg.to } }] },
    saveToSentItems: true,
  });
  return { id: null };
}
