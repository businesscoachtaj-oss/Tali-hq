// supabase/functions/billing-portal/index.ts  (Tali HQ project jbyzblwrywgxilhmfyjt)
// POST { returnUrl } -> { url } for the Stripe customer portal (change card, cancel, invoices).
// Uses Tali HQ's own portal configuration (created 5 Nov 2026 in Stripe): switch between Tali HQ and
// Pro, monthly or yearly, keeping any trial; card, invoices, cancel at period end. Totality keeps the
// account's default configuration. STRIPE_PORTAL_CONFIG overrides it, for example for test mode.
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
    const portal = await stripe('POST', 'billing_portal/sessions', { customer: sub.stripe_customer_id, return_url: `${origin}/me`, configuration: PORTAL_CONFIG });
    return json({ ok: true, url: portal.url });
  } catch (e) {
    console.error('billing-portal failed', String(e));
    return json({ ok: false, message: 'Could not open billing. Try again in a minute.' }, 500);
  }
});
