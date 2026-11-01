// supabase/functions/stripe-invoices/index.ts  (Tali HQ project jbyzblwrywgxilhmfyjt)
//
// Businesses connect the Stripe account they already have (Stripe Connect, Standard, OAuth).
// Tali can then send their invoices through it, only when they tap Send, and the invoice marks
// itself paid when their client pays.
//
//   POST {action:'connect', returnUrl}   signed in: returns the Stripe connect link
//   GET  ?code=...&state=...             Stripe sends them back here; saves the account, redirects to the app
//   POST {action:'disconnect'}           signed in: unlinks their Stripe
//   POST {action:'send', invoiceId}      signed in: creates the invoice in their Stripe, finalises and emails it
//   POST {action:'sync'}                 pg_cron every 15 min (x-tali-key): marks paid or void, pushes a note
//
// verify_jwt is off (Stripe's redirect and the cron call carry no Supabase JWT); signed-in actions
// check the JWT themselves. Secrets: STRIPE_SECRET_KEY, STRIPE_CONNECT_CLIENT_ID, APP_URLS.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { CONNECT_CLIENT_ID, connectOAuth, stripe, stripeReady } from '../_shared/stripe.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ALLOWED = (Deno.env.get('APP_URLS') ?? 'http://localhost:8081').split(',').map((s) => s.trim()).filter(Boolean);
const SELF = `${SUPABASE_URL}/functions/v1/stripe-invoices`;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const fail = (code: string, message: string, status = 400) => json({ ok: false, code, message }, status);
const redirect = (url: string) => new Response(null, { status: 302, headers: { Location: url } });
const cents = (n: number) => Math.round(Number(n) * 100);

async function userFrom(req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  return data?.user ?? null;
}

// Invoices are part of the trial, Tali HQ and Pro.
async function isPaid(userId: string) {
  const { data } = await admin.from('subscriptions').select('plan_id, status').eq('user_id', userId).maybeSingle();
  return !!data && data.plan_id !== 'free' && ['active', 'trialing', 'past_due'].includes(data.status);
}

async function notify(userId: string, title: string, body: string) {
  try {
    const { data: tokens } = await admin.from('push_tokens').select('token').eq('user_id', userId);
    if (!tokens?.length) return;
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(tokens.map((t: { token: string }) => ({ to: t.token, title, body, sound: 'default', data: { url: '/invoices' } }))),
    });
  } catch (e) {
    console.warn('push failed', String(e));
  }
}

// ---------- Connect ----------
async function startConnect(userId: string, returnUrl: string) {
  if (!stripeReady() || !CONNECT_CLIENT_ID) return fail('not_ready', 'Stripe connect switches on soon.', 503);
  let origin = '';
  try {
    origin = new URL(returnUrl).origin;
  } catch {
    /* falls through */
  }
  if (!ALLOWED.includes(origin)) return fail('bad_request', 'Bad return address.');
  const state = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  await admin.from('stripe_oauth_states').delete().lt('created_at', new Date(Date.now() - 3600_000).toISOString());
  const { error } = await admin.from('stripe_oauth_states').insert({ state, user_id: userId, return_to: origin });
  if (error) return fail('server_error', 'Could not start connecting.', 500);
  const url = new URL('https://connect.stripe.com/oauth/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', CONNECT_CLIENT_ID);
  url.searchParams.set('scope', 'read_write');
  url.searchParams.set('state', state);
  url.searchParams.set('redirect_uri', SELF);
  return json({ ok: true, url: url.toString() });
}

async function finishConnect(params: URLSearchParams) {
  const state = params.get('state') ?? '';
  const { data: row } = await admin.from('stripe_oauth_states').select('user_id, return_to, created_at').eq('state', state).maybeSingle();
  const back = (row?.return_to && ALLOWED.includes(row.return_to) ? row.return_to : ALLOWED[0]) + '/settings';
  if (!row || Date.now() - new Date(row.created_at).getTime() > 3600_000) return redirect(`${back}?stripe=expired`);
  await admin.from('stripe_oauth_states').delete().eq('state', state);
  if (params.get('error') || !params.get('code')) return redirect(`${back}?stripe=cancelled`);
  try {
    const tok = await connectOAuth<{ stripe_user_id: string; livemode: boolean }>('token', { grant_type: 'authorization_code', code: params.get('code') as string });
    let name: string | null = null;
    try {
      const acct = await stripe('GET', 'account', {}, tok.stripe_user_id);
      name = acct?.settings?.dashboard?.display_name || acct?.business_profile?.name || acct?.email || null;
    } catch {
      /* name is optional */
    }
    await admin.from('stripe_connections').upsert({ user_id: row.user_id, account_id: tok.stripe_user_id, business_name: name, livemode: !!tok.livemode, connected_at: new Date().toISOString() });
    return redirect(`${back}?stripe=connected`);
  } catch (e) {
    console.error('stripe connect failed', String(e));
    return redirect(`${back}?stripe=error`);
  }
}

async function disconnect(userId: string) {
  const { data: conn } = await admin.from('stripe_connections').select('account_id').eq('user_id', userId).maybeSingle();
  if (conn && CONNECT_CLIENT_ID) {
    try {
      await connectOAuth('deauthorize', { client_id: CONNECT_CLIENT_ID, stripe_user_id: conn.account_id });
    } catch (e) {
      console.warn('deauthorize failed', String(e));
    }
  }
  await admin.from('stripe_connections').delete().eq('user_id', userId);
  return json({ ok: true });
}

// ---------- Send ----------
async function send(userId: string, invoiceId: string) {
  if (!stripeReady()) return fail('not_ready', 'Stripe sending switches on soon.', 503);
  if (!(await isPaid(userId))) return fail('no_access', 'Sending through Stripe is part of Tali HQ and Pro.', 402);
  const { data: conn } = await admin.from('stripe_connections').select('account_id').eq('user_id', userId).maybeSingle();
  if (!conn) return fail('not_connected', 'Connect your Stripe first, in Settings.');
  const { data: inv } = await admin.from('invoices').select('*').eq('id', invoiceId).eq('user_id', userId).maybeSingle();
  if (!inv) return fail('not_found', 'That invoice was not found.', 404);
  if (inv.stripe_invoice_id) return json({ ok: true, already: true, url: inv.stripe_url });
  if (inv.status === 'paid' || inv.status === 'void') return fail('bad_request', 'That invoice is already closed.');
  const email = String(inv.client_email ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('no_email', `Add ${inv.client_name}'s email on the invoice first.`);
  const items = (Array.isArray(inv.items) ? inv.items : []).filter((i: any) => cents(Number(i.qty || 1) * Number(i.unit_price || 0)) > 0);
  if (!items.length || Number(inv.total) <= 0) return fail('bad_request', 'Add at least one line with a price.');
  const { data: settings } = await admin.from('invoice_settings').select('business_name, abn, footer, payment_details').eq('user_id', userId).maybeSingle();

  const acct = conn.account_id;
  try {
    // Find or make the customer in their Stripe.
    const found = await stripe('GET', 'customers', { email, limit: 1 }, acct);
    const customer = found?.data?.[0]?.id ?? (await stripe('POST', 'customers', { email, name: inv.client_name, metadata: { tali_hq_client_id: inv.client_id ?? '' } }, acct)).id;

    const today = new Date();
    const due = new Date(`${inv.due_date}T00:00:00Z`);
    const days = Math.max(1, Math.round((due.getTime() - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / 86400000));
    const footer = [settings?.abn ? `ABN ${settings.abn}` : '', settings?.footer ?? ''].filter(Boolean).join('  ');

    const draft = await stripe('POST', 'invoices', {
      customer,
      collection_method: 'send_invoice',
      days_until_due: days,
      currency: 'aud',
      auto_advance: false,
      pending_invoice_items_behavior: 'exclude',
      description: inv.notes ? String(inv.notes).slice(0, 500) : undefined,
      footer: footer ? footer.slice(0, 500) : undefined,
      metadata: { tali_hq_invoice_id: inv.id, tali_hq_number: inv.number ?? '' },
    }, acct);

    for (const it of items) {
      const qty = Number(it.qty || 1);
      const label = String(it.description || 'Item').slice(0, 200);
      await stripe('POST', 'invoiceitems', {
        customer,
        invoice: draft.id,
        currency: 'aud',
        amount: cents(qty * Number(it.unit_price || 0)),
        description: qty === 1 ? label : `${label} (${qty} x A$${Number(it.unit_price).toFixed(2)})`,
      }, acct);
    }
    if (inv.gst && Number(inv.gst_amount) > 0) {
      await stripe('POST', 'invoiceitems', { customer, invoice: draft.id, currency: 'aud', amount: cents(inv.gst_amount), description: 'GST (10%)' }, acct);
    }

    const final = await stripe('POST', `invoices/${draft.id}/finalize`, { auto_advance: true }, acct);
    await stripe('POST', `invoices/${draft.id}/send`, {}, acct);

    await admin.from('invoices').update({ status: 'sent', sent_at: new Date().toISOString(), stripe_invoice_id: draft.id, stripe_url: final.hosted_invoice_url ?? null }).eq('id', inv.id);
    await admin.from('approvals').update({ status: 'done', decided_at: new Date().toISOString() })
      .eq('user_id', userId).eq('status', 'pending').eq('kind', 'invoice').filter('draft->>invoice_id', 'eq', inv.id);
    return json({ ok: true, url: final.hosted_invoice_url ?? null });
  } catch (e) {
    console.error('stripe send failed', String(e));
    const msg = String(e).replace(/^Error:\s*/, '');
    return fail('stripe_error', `Stripe said no: ${msg.replace(/^Stripe \d+:\s*/, '').slice(0, 200)}`, 502);
  }
}

// ---------- Sync (cron) ----------
async function sync() {
  if (!stripeReady()) return json({ ok: false, error: 'STRIPE_SECRET_KEY is not set' }, 503);
  const { data: open } = await admin.from('invoices').select('id, user_id, number, client_name, total, stripe_invoice_id').eq('status', 'sent').not('stripe_invoice_id', 'is', null).limit(200);
  const accounts = new Map<string, string>();
  let paid = 0;
  let voided = 0;
  for (const inv of open ?? []) {
    try {
      if (!accounts.has(inv.user_id)) {
        const { data: c } = await admin.from('stripe_connections').select('account_id').eq('user_id', inv.user_id).maybeSingle();
        accounts.set(inv.user_id, c?.account_id ?? '');
      }
      const acct = accounts.get(inv.user_id);
      if (!acct) continue;
      const s = await stripe('GET', `invoices/${inv.stripe_invoice_id}`, {}, acct);
      if (s.status === 'paid') {
        const at = s.status_transitions?.paid_at ? new Date(s.status_transitions.paid_at * 1000).toISOString() : new Date().toISOString();
        await admin.from('invoices').update({ status: 'paid', paid_at: at, paid_via: 'stripe' }).eq('id', inv.id);
        paid++;
        await notify(inv.user_id, `${inv.client_name} paid 💸`, `${inv.number}, A$${Number(inv.total).toFixed(2)}, just came through Stripe.`);
      } else if (s.status === 'void' || s.status === 'uncollectible') {
        await admin.from('invoices').update({ status: 'void' }).eq('id', inv.id);
        voided++;
      }
    } catch (e) {
      console.warn('sync failed for', inv.id, String(e));
    }
  }
  return json({ ok: true, checked: (open ?? []).length, paid, voided });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = new URL(req.url);
  if (req.method === 'GET') {
    if (url.searchParams.has('state')) return finishConnect(url.searchParams);
    return new Response('ok');
  }
  if (req.method !== 'POST') return fail('bad_request', 'POST only', 405);

  let body: { action?: string; returnUrl?: string; invoiceId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return fail('bad_request', 'Bad request.');
  }

  if (body.action === 'sync') {
    const key = req.headers.get('x-tali-key') ?? '';
    const { data: ok } = key ? await admin.rpc('brain_check_key', { p_key: key }) : { data: false };
    if (ok !== true) return new Response('forbidden', { status: 403 });
    return sync();
  }

  const user = await userFrom(req);
  if (!user) return fail('unauthorized', 'Please sign in again.', 401);
  if (body.action === 'connect') return startConnect(user.id, String(body.returnUrl ?? ''));
  if (body.action === 'disconnect') return disconnect(user.id);
  if (body.action === 'send') return send(user.id, String(body.invoiceId ?? ''));
  return fail('bad_request', 'Unknown action.');
});
