// supabase/functions/stripe-webhook/index.ts  (Tali HQ project jbyzblwrywgxilhmfyjt)
//
// Keeps public.subscriptions in step with Stripe. Deployed with verify_jwt false; every
// request is checked against STRIPE_WEBHOOK_SECRET instead.
// Events: checkout.session.completed, customer.subscription.created / updated / deleted.
// A subscription that ends drops the user back to the Free plan (their data stays).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { planForPrice, stripe, verifyStripeSignature } from '../_shared/stripe.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

const STATUS: Record<string, string> = {
  active: 'active',
  trialing: 'trialing',
  past_due: 'past_due',
  unpaid: 'past_due',
  canceled: 'canceled',
  incomplete: 'incomplete',
  incomplete_expired: 'canceled',
  paused: 'canceled',
};

async function syncSubscription(s: any) {
  const userId = s.metadata?.tali_user_id;
  const priceId = s.items?.data?.[0]?.price?.id;
  const plan = planForPrice(priceId);
  // The Stripe account also runs Totality and Totality Nutrition. Only Tali HQ subscriptions count here.
  if (!plan && !userId) return;
  let target = userId as string | undefined;
  if (!target && s.customer) {
    const { data } = await admin.from('subscriptions').select('user_id').eq('stripe_customer_id', s.customer).maybeSingle();
    target = data?.user_id;
  }
  if (!target) {
    console.warn('stripe-webhook: no Tali user for subscription', s.id);
    return;
  }
  const status = STATUS[s.status] ?? 'incomplete';
  const ended = status === 'canceled';
  const periodEnd = s.current_period_end ?? s.items?.data?.[0]?.current_period_end;
  await admin
    .from('subscriptions')
    .update({
      plan_id: ended || !plan ? 'free' : plan,
      status: ended ? 'active' : status,
      stripe_customer_id: s.customer,
      stripe_subscription_id: ended ? null : s.id,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      trial_ends_at: ended ? null : undefined,
    })
    .eq('user_id', target);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  const payload = await req.text();
  if (!(await verifyStripeSignature(payload, req.headers.get('Stripe-Signature'), SECRET))) {
    return new Response('bad signature', { status: 400 });
  }
  const event = JSON.parse(payload);
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription' && session.subscription) {
          const sub = await stripe('GET', `subscriptions/${session.subscription}`);
          if (!sub.metadata?.tali_user_id && session.client_reference_id) sub.metadata = { ...sub.metadata, tali_user_id: session.client_reference_id };
          await syncSubscription(sub);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(event.data.object);
        break;
    }
    return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('stripe-webhook failed', event.type, String(e));
    return new Response('error', { status: 500 });
  }
});
