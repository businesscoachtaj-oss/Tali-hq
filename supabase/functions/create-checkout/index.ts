// supabase/functions/create-checkout/index.ts  (Tali HQ project jbyzblwrywgxilhmfyjt)
//
// POST { plan: 'hq' | 'pro', interval?: 'month' | 'year', returnUrl: string }
// Returns { url } for Stripe Checkout (web only; iOS and Android need store billing later).
// Founding members (subscriptions.founding_member = true) get STRIPE_COUPON_FOUNDING applied forever.
// The stripe-webhook function writes the result into public.subscriptions.
//
// Secrets: STRIPE_SECRET_KEY, APP_URLS (comma separated allowed return origins). Live prices and the
// founding coupon are built into _shared/stripe.ts (STRIPE_PRICE_* and STRIPE_COUPON_FOUNDING override them).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { COUPON_FOUNDING, PRICE_HQ, PRICE_PRO, stripe, stripeReady } from '../_shared/stripe.ts';

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
  const plan = body.plan === 'pro' ? 'pro' : body.plan === 'hq' ? 'hq' : null;
  const yearly = body.interval === 'year';
  if (!plan) return json({ ok: false, code: 'bad_request', message: 'Pick a plan.' }, 400);

  const env = (k: string) => Deno.env.get(k) ?? '';
  const price = plan === 'hq' ? (yearly ? env('STRIPE_PRICE_HQ_YEARLY') : PRICE_HQ) : yearly ? env('STRIPE_PRICE_PRO_YEARLY') : PRICE_PRO;
  if (!price) return json({ ok: false, code: 'not_ready', message: 'That plan is not open yet.' }, 503);

  let origin: string;
  try {
    origin = new URL(String(body.returnUrl ?? '')).origin;
  } catch {
    return json({ ok: false, code: 'bad_request', message: 'Bad return address.' }, 400);
  }
  if (!ALLOWED.includes(origin)) return json({ ok: false, code: 'bad_request', message: 'Bad return address.' }, 400);

  const { data: sub } = await admin.from('subscriptions').select('plan_id, status, founding_member, stripe_customer_id, stripe_subscription_id').eq('user_id', user.id).maybeSingle();
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
    const coupon = sub?.founding_member ? COUPON_FOUNDING : '';
    const session = await stripe('POST', 'checkout/sessions', {
      mode: 'subscription',
      customer,
      client_reference_id: user.id,
      line_items: [{ price, quantity: 1 }],
      ...(coupon ? { discounts: [{ coupon }] } : { allow_promotion_codes: true }),
      subscription_data: { metadata: { tali_user_id: user.id, plan } },
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
