// supabase/functions/tali-api/index.ts  (Tali HQ project jbyzblwrywgxilhmfyjt)
//
// 27 Nov 2026 (Taj): the Tali HQ API, used by the Tali HQ Zapier app (integrations/zapier-tali-hq).
// Deployed with verify_jwt false: it checks API keys itself, and the app's own calls carry a sign in.
//
// From the app (signed in), POST with { action }:
//   create_key { name? }   makes a key, returns it once
//   revoke_key { id }      stops a key working
//
// With an API key (Authorization: Bearer thq_live_...), on a paid plan:
//   GET  /v1/me
//   GET  /v1/clients?kind=client|lead&email=&limit=     newest first. Family and friends never come out.
//   POST /v1/clients   { name, email?, phone?, kind?, notes? }   same email again returns the one already there
//   GET  /v1/enquiries?limit=                           website enquiries, newest first
//   GET  /v1/bookings?status=&limit=                    newest first
//   GET  /v1/invoices/paid?limit=                       newest paid first
//   GET  /v1/quotes/accepted?limit=                     newest accepted first
//   POST /v1/reminders { text, due_at? }                due tomorrow 9am if no time is given
//   POST /v1/notes     { title?, body }                 a business note Tali reads
// Nothing here sends, spends or deletes. Those stay behind the owner's yes in the app.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(URL_, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const fail = (status: number, message: string) => json({ error: message }, status);

const PREFIX = 'thq_live_';
const clean = (v: unknown, max: number) => String(v ?? '').replace(/[–—]/g, ', ').replace(/\s+/g, ' ').trim().slice(0, max);
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

async function sha256(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function newKey() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(36));
  return PREFIX + Array.from(bytes).map((b) => abc[b % abc.length]).join('');
}

// Hq, Pro and Max, or a trial that has not run out. Same rule as isPaid() in the app.
async function paid(userId: string) {
  const { data } = await admin.from('subscriptions').select('plan_id, status, trial_ends_at').eq('user_id', userId).maybeSingle();
  if (!data) return false;
  if (data.status === 'trialing') return !!data.trial_ends_at && new Date(data.trial_ends_at).getTime() > Date.now();
  return ['hq', 'pro', 'max'].includes(data.plan_id) && ['active', 'past_due'].includes(data.status);
}

const limitOf = (u: URL) => Math.min(100, Math.max(1, Number(u.searchParams.get('limit')) || 25));

// Tomorrow at 9am Sydney time, as an ISO string.
function tomorrowNine() {
  const now = new Date();
  const syd = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
  const offset = syd.getTime() - now.getTime();
  syd.setDate(syd.getDate() + 1); syd.setHours(9, 0, 0, 0);
  return new Date(syd.getTime() - offset).toISOString();
}

const CLIENT_COLS = 'id, name, kind, status, email, phone, notes, source, next_follow_up, created_at';

async function api(req: Request, userId: string, path: string, u: URL): Promise<Response> {
  const get = req.method === 'GET';
  const body = get ? {} : await req.json().catch(() => ({}));

  if (get && path === '/v1/me') {
    const { data: p } = await admin.from('profiles').select('first_name, business_name').eq('id', userId).maybeSingle();
    return json({ id: userId, name: p?.first_name ?? '', business: p?.business_name ?? '' });
  }

  if (path === '/v1/clients') {
    if (get) {
      let q = admin.from('clients').select(CLIENT_COLS).eq('user_id', userId).in('kind', ['client', 'lead']).order('created_at', { ascending: false }).limit(limitOf(u));
      const kind = u.searchParams.get('kind');
      if (kind === 'client' || kind === 'lead') q = q.eq('kind', kind);
      const email = clean(u.searchParams.get('email'), 200);
      if (email) q = q.ilike('email', email.replace(/[%_]/g, ''));
      const { data, error } = await q;
      if (error) return fail(500, 'Could not read clients.');
      return json(data ?? []);
    }
    const name = clean(body.name, 120);
    if (!name) return fail(400, 'A name is needed.');
    const email = clean(body.email, 200).toLowerCase() || null;
    if (email && !emailOk(email)) return fail(400, 'That email does not look right.');
    const kind = body.kind === 'client' ? 'client' : 'lead';
    if (email) {
      const { data: had } = await admin.from('clients').select(CLIENT_COLS).eq('user_id', userId).in('kind', ['client', 'lead']).ilike('email', email).limit(1);
      if (had?.[0]) return json({ ...had[0], existing: true });
    }
    const { data, error } = await admin.from('clients').insert({
      user_id: userId, name, email, phone: clean(body.phone, 40) || null, kind,
      status: kind === 'lead' ? 'new' : 'active', notes: clean(body.notes, 4000), source: 'zapier',
    }).select(CLIENT_COLS).single();
    if (error) return fail(400, 'Could not add them.');
    return json({ ...data, existing: false }, 201);
  }

  if (get && path === '/v1/enquiries') {
    const { data, error } = await admin.from('site_enquiries').select('id, name, email, phone, message, client_id, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(limitOf(u));
    if (error) return fail(500, 'Could not read enquiries.');
    return json(data ?? []);
  }

  if (get && path === '/v1/bookings') {
    let q = admin.from('bookings').select('id, title, client_name, client_email, client_phone, starts_at, minutes, place, status, source, notes, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(limitOf(u));
    const st = u.searchParams.get('status');
    if (st && ['requested', 'booked', 'done', 'cancelled'].includes(st)) q = q.eq('status', st);
    const { data, error } = await q;
    if (error) return fail(500, 'Could not read bookings.');
    return json(data ?? []);
  }

  if (get && path === '/v1/invoices/paid') {
    const { data, error } = await admin.from('invoices').select('id, number, client_name, client_email, total, gst_amount, issue_date, paid_at, paid_via').eq('user_id', userId).eq('status', 'paid').order('paid_at', { ascending: false, nullsFirst: false }).limit(limitOf(u));
    if (error) return fail(500, 'Could not read invoices.');
    return json(data ?? []);
  }

  if (get && path === '/v1/quotes/accepted') {
    const { data, error } = await admin.from('jobs').select('id, number, title, client_name, client_email, total, status, accepted_at').eq('user_id', userId).not('accepted_at', 'is', null).order('accepted_at', { ascending: false }).limit(limitOf(u));
    if (error) return fail(500, 'Could not read quotes.');
    return json(data ?? []);
  }

  if (!get && path === '/v1/reminders') {
    const text = clean(body.text, 300);
    if (!text) return fail(400, 'What should Tali remind you about?');
    const due = body.due_at ? new Date(String(body.due_at)) : null;
    if (due && isNaN(due.getTime())) return fail(400, 'That time does not look right.');
    const { data, error } = await admin.from('reminders').insert({ user_id: userId, text, due_at: (due ?? new Date(tomorrowNine())).toISOString(), created_by: 'user', side: 'business' }).select('id, text, due_at, created_at').single();
    if (error) return fail(400, 'Could not add the reminder.');
    return json(data, 201);
  }

  if (!get && path === '/v1/notes') {
    const text = String(body.body ?? '').trim().slice(0, 20000);
    if (!text) return fail(400, 'The note is empty.');
    const { data, error } = await admin.from('journal_entries').insert({ user_id: userId, kind: 'note', title: clean(body.title, 160) || null, body: text, tags: ['zapier'], side: 'business' }).select('id, title, created_at').single();
    if (error) return fail(400, 'Could not add the note.');
    return json(data, 201);
  }

  return fail(404, 'Not found.');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const u = new URL(req.url);
  const path = u.pathname.replace(/^.*\/tali-api/, '') || '/';
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();

  try {
    // An API key.
    if (token.startsWith(PREFIX)) {
      const { data: key } = await admin.from('api_keys').select('id, user_id, revoked_at, last_used_at').eq('key_hash', await sha256(token)).maybeSingle();
      if (!key || key.revoked_at) return fail(401, 'That API key is not working. Make a new one in Tali HQ, Settings, Connections.');
      if (!(await paid(key.user_id))) return fail(402, 'The Tali HQ API comes with HQ, Pro and Max.');
      // Mark it used, at most once a minute.
      if (!key.last_used_at || Date.now() - new Date(key.last_used_at).getTime() > 60_000) {
        await admin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', key.id);
      }
      return await api(req, key.user_id, path, u);
    }

    // The app, signed in.
    if (req.method !== 'POST') return fail(401, 'Add your API key as a Bearer token.');
    const { data: who } = await admin.auth.getUser(token);
    const me = who?.user;
    if (!me) return fail(401, 'Please sign in again.');
    const body = await req.json().catch(() => ({}));

    if (body.action === 'create_key') {
      if (!(await paid(me.id))) return json({ ok: false, message: 'The Tali HQ API and Zapier come with HQ, Pro and Max.' });
      const { count } = await admin.from('api_keys').select('id', { count: 'exact', head: true }).eq('user_id', me.id).is('revoked_at', null);
      if ((count ?? 0) >= 5) return json({ ok: false, message: 'You have 5 keys. Revoke one you no longer use first.' });
      const key = newKey();
      const { data, error } = await admin.from('api_keys').insert({ user_id: me.id, name: clean(body.name, 60) || 'Zapier', key_hash: await sha256(key), last4: key.slice(-4) })
        .select('id, name, last4, created_at, last_used_at, revoked_at').single();
      if (error) return json({ ok: false, message: 'Could not make a key. Please try again.' });
      return json({ ok: true, key, row: data });
    }
    if (body.action === 'revoke_key') {
      const { error } = await admin.from('api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', String(body.id ?? '')).eq('user_id', me.id).is('revoked_at', null);
      if (error) return json({ ok: false, message: 'Could not revoke it. Please try again.' });
      return json({ ok: true });
    }
    return fail(400, 'Unknown action.');
  } catch (e) {
    console.error('tali-api', e);
    return fail(500, 'Something went wrong. Please try again.');
  }
});
