// supabase/functions/billing-portal/index.ts  (Tali HQ project jbyzblwrywgxilhmfyjt)
// POST { returnUrl } -> { url } for the Stripe customer portal (change card, cancel, invoices).
// Uses Tali HQ's own portal configuration (created 5 Nov 2026 in Stripe): switch between Tali HQ and
// Pro, monthly or yearly, keeping any trial; card, invoices, cancel at period end. Totality keeps the
// account's default configuration. STRIPE_PORTAL_CONFIG overrides it, for example for test mode.
// 12 Nov 2026: a member whose subscription still carries the Black Friday offer gets the monthly
// only configuration, see PORTAL_CONFIG_MONTHLY below.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { stripe, stripeReady } from '../_shared/stripe.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const PORTAL_CONFIG = Deno.env.get('STRIPE_PORTAL_CONFIG') || 'bpc_1UYFPhPy9YlWBZ02sLUshfqB';
// 12 Nov 2026 (Taj): the Black Friday code is 60% off the first 2 months, for monthly plans. The
// normal portal lets a member switch to yearly, which would take 60% off the whole yearly bill while
// the offer is still on their subscription. So while a subscription carries the offer, the member
// gets a second portal configuration that is the same in every way except it only lists the monthly
// prices. Once the 2 months are up Stripe drops the offer and they get the normal portal again.
// STRIPE_PORTAL_CONFIG_MONTHLY overrides it, for example for test mode.
const PORTAL_CONFIG_MONTHLY = Deno.env.get('STRIPE_PORTAL_CONFIG_MONTHLY') || 'bpc_1Uaqc6Py9YlWBZ02CstlOM8c';
const BLACK_FRIDAY_COUPON = 'XHZd38r1';
const BLACK_FRIDAY_PROMO = 'promo_1Uamj3Py9YlWBZ02MkX75o2e';
const LIVE = ['active', 'trialing', 'past_due', 'unpaid', 'paused'];
const idOf = (v: any): string | undefined => (typeof v === 'string' ? v : v?.id);
function monthlyOnlyOffer(d: any): boolean {
  if (!d || typeof d === 'string') return false;
  return (idOf(d.source?.coupon) ?? idOf(d.coupon)) === BLACK_FRIDAY_COUPON || idOf(d.promotion_code) === BLACK_FRIDAY_PROMO;
}
// True when any live subscription on the customer still carries a monthly only offer. Throws when
// Stripe hands back a discount it did not expand, so billing never opens on a guess.
async function carriesMonthlyOnlyOffer(customer: string): Promise<boolean> {
  const subs = await stripe('GET', 'subscriptions', { customer, status: 'all', limit: 20, expand: ['data.discounts'] });
  for (const sub of (subs?.data ?? []) as any[]) {
    if (!LIVE.includes(sub.status)) continue;
    const list = Array.isArray(sub.discounts) ? sub.discounts : [];
    if (list.some((d: any) => typeof d === 'string')) throw new Error('subscription discounts were not expanded');
    if (list.some(monthlyOnlyOffer) || monthlyOnlyOffer(sub.discount)) return true;
  }
  return false;
}
const ALLOWED = (Deno.env.get('APP_URLS') ?? 'http://localhost:8081').split(',').map((s) => s.trim()).filter(Boolean);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!stripeReady()) return json({ ok: false, message: 'Billing opens soon.' }, 503);
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return json({ ok: false, message: 'Please sign in again.' }, 401);

  const body = await req.json().catch(() => ({}));
  let origin = '';
  try {
    origin = new URL(String(body.returnUrl ?? '')).origin;
  } catch {}
  if (!ALLOWED.includes(origin)) return json({ ok: false, message: 'Bad return address.' }, 400);

  const { data: sub } = await admin.from('subscriptions').select('stripe_customer_id').eq('user_id', u.user.id).maybeSingle();
  if (!sub?.stripe_customer_id) return json({ ok: false, message: 'No billing account yet.' }, 404);
  try {
    const monthlyOnly = await carriesMonthlyOnlyOffer(sub.stripe_customer_id);
    const portal = await stripe('POST', 'billing_portal/sessions', {
      customer: sub.stripe_customer_id,
      return_url: `${origin}/me`,
      configuration: monthlyOnly ? PORTAL_CONFIG_MONTHLY : PORTAL_CONFIG,
    });
    return json({ ok: true, url: portal.url });
  } catch (e) {
    console.error('billing-portal failed', String(e));
    return json({ ok: false, message: 'Could not open billing. Try again in a minute.' }, 500);
  }
});
