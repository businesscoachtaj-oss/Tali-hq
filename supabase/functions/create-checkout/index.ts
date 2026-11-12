// supabase/functions/create-checkout/index.ts  (Tali HQ project jbyzblwrywgxilhmfyjt)
//
// POST { plan: 'hq' | 'pro' | 'max' | 'biz', interval?: 'month' | 'year', returnUrl: string }
//      'biz' is Tali HQ Business (12 Nov 2026): monthly only, no founding coupon (the coupon is tied to the older products).
// POST { topup: pack id, returnUrl: string }  (6 Nov 2026) a one-off payment for extra credits or images,
//      see _shared/topups.ts. Paid plans and the trial only. stripe-webhook records it with add_topup.
// Returns { url } for Stripe Checkout (web only; iOS and Android need store billing later).
// Founding members (subscriptions.founding_member = true) get STRIPE_COUPON_FOUNDING applied forever.
// The stripe-webhook function writes the result into public.subscriptions.
//
// Secrets: STRIPE_SECRET_KEY, APP_URLS (comma separated allowed return origins). Live prices and the
// founding coupon are built into _shared/stripe.ts (STRIPE_PRICE_* and STRIPE_COUPON_FOUNDING override them).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { topupPack } from '../_shared/topups.ts';
import { COUPON_FOUNDING, COUPON_FOUNDING_MAX, PRICE_HQ, PRICE_HQ_YEARLY, PRICE_MAX, PRICE_MAX_YEARLY, PRICE_PRO, PRICE_BIZ, PRICE_PRO_YEARLY, stripe, stripeReady } from '../_shared/stripe.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const ALLOWED = (Deno.env.get('APP_URLS') ?? 'http://localhost:8081').split(',').map((s) => s.trim()).filter(Boolean);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, message: 'POST only' }, 405);
  if (!stripeReady()) return json({ ok: false, code: 'not_ready', message: 'Upgrades open soon.' }, 503);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: u } = await admin.auth.getUser(token);
  const user = u?.user;
  if (!user) return json({ ok: false, code: 'unauthorized', message: 'Please sign in again.' }, 401);

  const body = await req.json().catch(() => ({}));
  if (body.topup) return topup(user, body);
  const plan = body.plan === 'biz' ? 'biz' : body.plan === 'max' ? 'max' : body.plan === 'pro' ? 'pro' : body.plan === 'hq' ? 'hq' : null;
  const yearly = body.interval === 'year';
  if (!plan) return json({ ok: false, code: 'bad_request', message: 'Pick a plan.' }, 400);

  const price = plan === 'biz' ? PRICE_BIZ : plan === 'max' ? (yearly ? PRICE_MAX_YEARLY : PRICE_MAX) : plan === 'hq' ? (yearly ? PRICE_HQ_YEARLY : PRICE_HQ) : yearly ? PRICE_PRO_YEARLY : PRICE_PRO;
  if (!price) return json({ ok: false, code: 'not_ready', message: 'That plan is not open yet.' }, 503);

  let origin: string;
  try {
    origin = new URL(String(body.returnUrl ?? '')).origin;
  } catch {
    return json({ ok: false, code: 'bad_request', message: 'Bad return address.' }, 400);
  }
  if (!ALLOWED.includes(origin)) return json({ ok: false, code: 'bad_request', message: 'Bad return address.' }, 400);

  const { data: sub } = await admin.from('subscriptions').select('plan_id, status, trial_ends_at, founding_member, stripe_customer_id, stripe_subscription_id').eq('user_id', user.id).maybeSingle();
  if (sub?.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(sub.status)) {
    return json({ ok: false, code: 'already_subscribed', message: 'You already have a plan. Manage it from Me.' }, 409);
  }

  try {
    let customer = sub?.stripe_customer_id ?? null;
    if (!customer) {
      const c = await stripe('POST', 'customers', { email: user.email, metadata: { tali_user_id: user.id } });
      customer = c.id as string;
      await admin.from('subscriptions').update({ stripe_customer_id: customer }).eq('user_id', user.id);
    }
    const coupon = plan === 'biz' ? '' : sub?.founding_member ? (plan === 'max' ? COUPON_FOUNDING_MAX : COUPON_FOUNDING) : '';
    // Still on the free trial: Stripe holds the first charge until the trial ends (5 Nov 2026).
    // Stripe needs trial_end at least 48 hours away, so with under 48 hours (plus a small margin)
    // left on the trial, there is no Stripe trial and the first charge happens now at checkout.
    const trialEndMs = sub?.status === 'trialing' && sub?.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : 0;
    const trialEnd = trialEndMs - Date.now() >= 48 * 3600 * 1000 + 10 * 60 * 1000 ? Math.floor(trialEndMs / 1000) : null;
    const session = await stripe('POST', 'checkout/sessions', {
      mode: 'subscription',
      customer,
      client_reference_id: user.id,
      line_items: [{ price, quantity: 1 }],
      ...(coupon ? { discounts: [{ coupon }] } : { allow_promotion_codes: true }),
      subscription_data: { metadata: { tali_user_id: user.id, plan }, ...(trialEnd ? { trial_end: trialEnd } : {}) },
      metadata: { tali_user_id: user.id, plan },
      success_url: `${origin}/me?upgraded=1`,
      cancel_url: `${origin}/plans`,
    });
    return json({ ok: true, url: session.url });
  } catch (e) {
    console.error('create-checkout failed', String(e));
    return json({ ok: false, code: 'server_error', message: 'Could not start checkout. Try again in a minute.' }, 500);
  }
});

// A one-off top up (6 Nov 2026).
async function topup(user: { id: string; email?: string }, body: any) {
  const pack = topupPack(body.topup);
  if (!pack) return json({ ok: false, code: 'bad_request', message: 'Pick a pack.' }, 400);
  const isDomain = pack.id === 'domain'; // 12 Nov 2026: the own domain unlock goes back to Website, not Top up
  let origin: string;
  try {
    origin = new URL(String(body.returnUrl ?? '')).origin;
  } catch {
    return json({ ok: false, code: 'bad_request', message: 'Bad return address.' }, 400);
  }
  if (!ALLOWED.includes(origin)) return json({ ok: false, code: 'bad_request', message: 'Bad return address.' }, 400);

  const { data: sub } = await admin.from('subscriptions').select('plan_id, status, trial_ends_at, stripe_customer_id').eq('user_id', user.id).maybeSingle();
  const paid = sub && ((sub.status === 'trialing' && sub.trial_ends_at && new Date(sub.trial_ends_at).getTime() > Date.now()) || (['active', 'past_due'].includes(sub.status) && ['hq', 'pro', 'max'].includes(sub.plan_id)));
  if (!paid) return json({ ok: false, code: 'no_plan', message: isDomain ? 'Your own domain comes with any paid plan. Pick a plan first.' : 'Top ups are for Tali HQ and Pro. Pick a plan first.' }, 403);

  try {
    let customer = sub?.stripe_customer_id ?? null;
    if (!customer) {
      const c = await stripe('POST', 'customers', { email: user.email, metadata: { tali_user_id: user.id } });
      customer = c.id as string;
      await admin.from('subscriptions').update({ stripe_customer_id: customer }).eq('user_id', user.id);
    }
    const meta = { kind: 'topup', tali_user_id: user.id, pack: pack.id, credits: String(pack.credits), images: String(pack.images) };
    const session = await stripe('POST', 'checkout/sessions', {
      mode: 'payment',
      customer,
      client_reference_id: user.id,
      line_items: [{ quantity: 1, price_data: { currency: 'aud', unit_amount: pack.cents, product_data: { name: pack.name, description: isDomain ? 'A one-off unlock. Bring a domain you already own.' : 'Extras never expire. Used after your monthly allowance.' } } }],
      payment_intent_data: { metadata: meta },
      metadata: meta,
      success_url: isDomain ? `${origin}/website?domain=paid` : `${origin}/top-up?done=${pack.id}`,
      cancel_url: isDomain ? `${origin}/website` : `${origin}/top-up`,
    });
    return json({ ok: true, url: session.url });
  } catch (e) {
    console.error('create-checkout topup failed', String(e));
    return json({ ok: false, code: 'server_error', message: 'Could not start checkout. Try again in a minute.' }, 500);
  }
}
