// supabase/functions/business-admin/index.ts  (Tali HQ project jbyzblwrywgxilhmfyjt)
//
// 12 Nov 2026 (Taj: "Build it all"): the paid extras on a Business plan, which all need Stripe.
//
// POST { action, ... } with the owner's session:
//   team_invite     { name, email, role_title?, seat, can_customers?, can_prices?, can_money?, can_pipeline? }
//   team_seat       { id, seat }            move a teammate between Standard and Premium
//   team_remove     { id }                  take a teammate off the team
//   business_add    { name, about?, abn?, colour? }
//   business_remove { id }                  its jobs, invoices and the rest move back to the main business
//   sync            {}                      make the bill match what is in the database
//
// Billing: extras are items on the owner's own Business subscription, so they stop when it stops.
//   Standard seat   A$19.99 a month, the Tali HQ allowance (1,000 credits)
//   Premium seat    A$49.99 a month, the Pro allowance (3,000 credits)
//   Extra business  A$99.99 a month (Business Max includes two)
// More of anything is charged straight away for the rest of the month. Less of anything simply
// lowers the next bill, with no refund. If the card is declined nothing changes.
// The founder's account has the business tools without a subscription, so it is never billed.
//
// What a teammate can see is changed with the team_set_access database function, not here.
// Self-contained on purpose (its own small Stripe helper) so it deploys as one file.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM = Deno.env.get('WELCOME_FROM') || 'Tali <tali@tali.totality360.com.au>';
const APP_URL = (Deno.env.get('WELCOME_APP_URL') || 'https://talihq.com.au').replace(/\/+$/, '');
const FOUNDER = 'e89ca9de-a86e-4dd6-8094-bc518566352e';

const PRICE_SEAT_STANDARD = Deno.env.get('STRIPE_PRICE_SEAT_STANDARD') || 'price_1UauPRPy9YlWBZ02nLeH6AZG';
const PRICE_SEAT_PREMIUM = Deno.env.get('STRIPE_PRICE_SEAT_PREMIUM') || 'price_1UauPRPy9YlWBZ02jKOr0N3k';
const PRICE_EXTRA_BUSINESS = Deno.env.get('STRIPE_PRICE_EXTRA_BUSINESS') || 'price_1UauPSPy9YlWBZ02FyKeSOEy';
const MAX_TEAM = 50;
const MAX_BUSINESSES = 10;
// Extra businesses that come with each Business plan.
const INCLUDED_EXTRA: Record<string, number> = { biz: 0, biz_pro: 0, biz_max: 2 };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const fail = (code: string, message: string, status = 400) => json({ ok: false, code, message }, status);

function form(params: Record<string, unknown>, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === 'object' ? form(item as Record<string, unknown>, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))));
    else if (typeof v === 'object') form(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}
async function stripe(method: 'GET' | 'POST', path: string, params: Record<string, unknown> = {}): Promise<any> {
  const url = new URL(`https://api.stripe.com/v1/${path}`);
  const init: RequestInit = { method, headers: { Authorization: `Bearer ${STRIPE_KEY}` } };
  if (method === 'GET') form(params).forEach((v, k) => url.searchParams.append(k, v));
  else {
    init.body = form(params);
    (init.headers as Record<string, string>)['Content-Type'] = 'application/x-www-form-urlencoded';
  }
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${data?.error?.message ?? 'error'}`);
  return data;
}

type Owner = { id: string; founder: boolean; tier: string | null; subId: string | null; status: string };

async function ownerOf(userId: string): Promise<Owner> {
  const { data } = await admin.from('subscriptions').select('business_tier, status, stripe_subscription_id').eq('user_id', userId).maybeSingle();
  const live = !!data && ['active', 'past_due'].includes(data.status);
  return { id: userId, founder: userId === FOUNDER, tier: live ? (data!.business_tier as string | null) : null, subId: live ? (data!.stripe_subscription_id as string | null) : null, status: data?.status ?? '' };
}

/** How many of each extra the owner should be paying for, from the database. */
async function wanted(o: Owner) {
  const [{ data: team }, { count: extra }] = await Promise.all([
    admin.from('team_members').select('seat').eq('owner_id', o.id),
    admin.from('businesses').select('id', { count: 'exact', head: true }).eq('user_id', o.id),
  ]);
  const seats = (team ?? []) as { seat: string }[];
  return {
    [PRICE_SEAT_STANDARD]: seats.filter((s) => s.seat !== 'premium').length,
    [PRICE_SEAT_PREMIUM]: seats.filter((s) => s.seat === 'premium').length,
    [PRICE_EXTRA_BUSINESS]: Math.max(0, (extra ?? 0) - (INCLUDED_EXTRA[o.tier ?? ''] ?? 0)),
  } as Record<string, number>;
}

/**
 * Makes the owner's subscription match the database. Increases are charged now and throw if the
 * card is declined (the caller then undoes its change). Decreases never refund.
 */
async function bill(o: Owner): Promise<void> {
  if (o.founder && !o.subId) return; // the founder's account is not billed
  if (!o.subId) throw new Error('no_subscription');
  const want = await wanted(o);
  const sub = await stripe('GET', `subscriptions/${o.subId}`);
  const items: any[] = sub.items?.data ?? [];
  const up: Record<string, unknown>[] = [];
  const down: Record<string, unknown>[] = [];
  for (const price of Object.keys(want)) {
    const item = items.find((i) => i.price?.id === price);
    const have = item?.quantity ?? 0;
    if (want[price] === have) continue;
    if (want[price] > have) up.push(item ? { id: item.id, quantity: want[price] } : { price, quantity: want[price] });
    else down.push(want[price] === 0 ? { id: item.id, deleted: true } : { id: item.id, quantity: want[price] });
  }
  if (up.length) await stripe('POST', `subscriptions/${o.subId}`, { items: up, proration_behavior: 'always_invoice', payment_behavior: 'error_if_incomplete' });
  if (down.length) await stripe('POST', `subscriptions/${o.subId}`, { items: down, proration_behavior: 'none' });
}

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

async function sendInvite(to: string, name: string, business: string, ownerName: string) {
  if (!RESEND_KEY) return false;
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const first = esc(name.split(' ')[0] || 'there');
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3EEF6;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 12px;font-family:${font};font-size:18px;font-weight:800;color:#6C3483;">Tali HQ</td></tr>
<tr><td style="background:#FFFFFF;border-radius:18px;border:1px solid #E6E4E1;padding:26px 24px;font-family:${font};color:#272626;">
<h1 style="margin:0 0 14px;font-size:23px;line-height:1.25;font-weight:800;">${esc(ownerName)} added you to ${esc(business)}</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Hi ${first}, you have a seat on ${esc(business)}'s team in Tali HQ. You get your own login, your own Tali and the jobs and tasks ${esc(ownerName)} gives you.</p>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Sign up or sign in with <strong>${esc(to)}</strong> and your work is waiting. It costs you nothing.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 18px;"><tr><td style="border-radius:999px;background:#6C3483;">
<a href="${APP_URL}" target="_blank" style="display:inline-block;padding:12px 26px;font-family:${font};font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;">Open Tali HQ</a>
</td></tr></table>
<p style="margin:0;font-size:13px;line-height:1.6;color:#62605D;">${esc(ownerName)} sees the work they give you. They cannot see your journal, your notes or what you say to Tali.</p>
</td></tr></table></td></tr></table></body></html>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject: `${ownerName} added you to ${business} on Tali HQ`, html }),
    });
    if (!res.ok) console.error('business-admin invite email failed', res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } catch (e) {
    console.error('business-admin invite email threw', String(e));
    return false;
  }
}

const declined = () => fail('card', "Your card didn't go through, so nothing changed. Update it under Me, Manage plan, then try again.", 402);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('bad_request', 'POST only', 405);
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: u } = await admin.auth.getUser(token);
  const user = u?.user;
  if (!user) return fail('unauthorized', 'Please sign in again.', 401);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? '');
  try {
    const o = await ownerOf(user.id);
    const hasTools = o.founder || !!o.tier;
    if (!hasTools) return fail('no_plan', 'This comes with Tali HQ Business.', 403);
    if (!o.founder && !o.subId) return fail('no_plan', 'This comes with Tali HQ Business.', 403);
    if (!o.founder && o.status === 'past_due' && action !== 'sync' && action !== 'team_remove' && action !== 'business_remove') {
      return fail('past_due', "Your last payment didn't go through. Update your card under Me, Manage plan, first.", 409);
    }

    if (action === 'sync') {
      await bill(o);
      return json({ ok: true });
    }

    if (action === 'team_invite') {
      const name = String(body.name ?? '').trim().slice(0, 80);
      const email = String(body.email ?? '').trim().toLowerCase();
      const seat = body.seat === 'premium' ? 'premium' : 'standard';
      if (!name) return fail('bad_request', 'What is their name?');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) return fail('bad_request', "That email doesn't look right.");
      if (email === (user.email ?? '').toLowerCase()) return fail('bad_request', 'That is your own email. You are already here.');
      const { count } = await admin.from('team_members').select('id', { count: 'exact', head: true }).eq('owner_id', user.id);
      if ((count ?? 0) >= MAX_TEAM) return fail('limit', `A team can have up to ${MAX_TEAM} people. Email us if you need more.`);
      const { data: row, error } = await admin.from('team_members').insert({
        owner_id: user.id, name, email, seat,
        role_title: String(body.role_title ?? '').trim().slice(0, 60),
        can_customers: body.can_customers === true, can_prices: body.can_prices === true,
        can_money: body.can_money === true, can_pipeline: body.can_pipeline === true,
      }).select('id').single();
      if (error) return error.code === '23505' ? fail('exists', 'They are already on your team.') : fail('server_error', 'Could not add them. Try again.', 500);
      try {
        await bill(o);
      } catch (e) {
        console.error('business-admin team_invite billing failed', String(e));
        await admin.from('team_members').delete().eq('id', row.id);
        return declined();
      }
      // Already a Tali HQ member with that email: put them on the team straight away.
      const { data: existing } = await admin.rpc('team_link_existing', { p_id: row.id });
      const { data: prof } = await admin.from('profiles').select('first_name, business_name').eq('id', user.id).maybeSingle();
      const sent = await sendInvite(email, name, prof?.business_name || 'the team', prof?.first_name || 'Your teammate');
      return json({ ok: true, id: row.id, joined: existing === true, emailed: sent });
    }

    if (action === 'team_seat') {
      const seat = body.seat === 'premium' ? 'premium' : 'standard';
      const { data: row } = await admin.from('team_members').select('id, seat').eq('id', String(body.id ?? '')).eq('owner_id', user.id).maybeSingle();
      if (!row) return fail('not_found', 'That person is not on your team.', 404);
      if (row.seat === seat) return json({ ok: true });
      await admin.from('team_members').update({ seat }).eq('id', row.id);
      try {
        await bill(o);
      } catch (e) {
        console.error('business-admin team_seat billing failed', String(e));
        await admin.from('team_members').update({ seat: row.seat }).eq('id', row.id);
        return declined();
      }
      return json({ ok: true });
    }

    if (action === 'team_remove') {
      const { error } = await admin.from('team_members').delete().eq('id', String(body.id ?? '')).eq('owner_id', user.id);
      if (error) return fail('server_error', 'Could not remove them. Try again.', 500);
      try { await bill(o); } catch (e) { console.error('business-admin team_remove billing failed, the next sync fixes it', String(e)); }
      return json({ ok: true });
    }

    if (action === 'business_add') {
      const name = String(body.name ?? '').trim().slice(0, 80);
      if (!name) return fail('bad_request', 'What is the business called?');
      const { count } = await admin.from('businesses').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
      if ((count ?? 0) + 1 >= MAX_BUSINESSES) return fail('limit', `Up to ${MAX_BUSINESSES} businesses here. Email us if you need more.`);
      const colour = /^#[0-9A-Fa-f]{6}$/.test(String(body.colour ?? '')) ? String(body.colour) : '#7FE0B0';
      const { data: row, error } = await admin.from('businesses').insert({
        user_id: user.id, name, colour,
        about: String(body.about ?? '').trim().slice(0, 200),
        abn: String(body.abn ?? '').trim().slice(0, 20) || null,
      }).select('id').single();
      if (error) return fail('server_error', 'Could not add that business. Try again.', 500);
      try {
        await bill(o);
      } catch (e) {
        console.error('business-admin business_add billing failed', String(e));
        await admin.from('businesses').delete().eq('id', row.id);
        return declined();
      }
      return json({ ok: true, id: row.id });
    }

    if (action === 'business_remove') {
      // The database moves its jobs, invoices and the rest back to the main business
      // (business_id is set to null when the business row goes).
      const { error } = await admin.from('businesses').delete().eq('id', String(body.id ?? '')).eq('user_id', user.id);
      if (error) return fail('server_error', 'Could not remove that business. Try again.', 500);
      try { await bill(o); } catch (e) { console.error('business-admin business_remove billing failed, the next sync fixes it', String(e)); }
      return json({ ok: true });
    }

    return fail('bad_request', 'Unknown action.');
  } catch (e) {
    console.error('business-admin failed', action, String(e));
    return fail('server_error', 'Something went wrong. Try again in a minute.', 500);
  }
});
