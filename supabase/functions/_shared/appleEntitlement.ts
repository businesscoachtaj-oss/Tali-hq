// supabase/functions/_shared/appleEntitlement.ts (Tali HQ, 22 Nov 2026)
//
// Writes a verified Apple subscription onto public.subscriptions. Used by tali-apple-verify (the iPhone
// app, right after a purchase or on Restore) and tali-apple-notifications (Apple's server: renewals,
// expiries, refunds). Same rules as Totality Nutrition:
//   - an active Stripe subscription stays the source of truth (Apple fields are still saved);
//   - when Apple ends, only an Apple-billed plan drops back to Free;
//   - a Stripe subscription that is failing does not block a confirmed Apple payment.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';
import { type AppleTransaction, isTransactionActive, planForAppleProduct } from './appleJws.ts';

export type ApplyResult =
  | { ok: true; active: boolean; userId: string }
  | { ok: false; reason: string; status: number };

export async function applyAppleTransaction(
  admin: SupabaseClient,
  tx: AppleTransaction,
  opts: { userId?: string; graceUntilMs?: number; forceInactive?: boolean },
): Promise<ApplyResult> {
  // appAccountToken is the Tali HQ user id, set at purchase time.
  let ownerId: string | null = tx.appAccountToken ?? null;
  const { data: holder } = await admin
    .from('subscriptions')
    .select('user_id')
    .eq('apple_original_transaction_id', tx.originalTransactionId)
    .maybeSingle();
  if (!ownerId) ownerId = holder?.user_id ?? null;

  if (opts.userId) {
    if (ownerId && ownerId.toLowerCase() !== opts.userId.toLowerCase()) {
      return { ok: false, reason: 'This App Store subscription belongs to a different Learnéd account.', status: 409 };
    }
    ownerId = opts.userId;
  }
  if (!ownerId) return { ok: false, reason: 'No matching account for this subscription', status: 404 };
  if (holder && holder.user_id !== ownerId) {
    return { ok: false, reason: 'This App Store subscription is already linked to a different Learnéd account.', status: 409 };
  }

  const { data: sub } = await admin
    .from('subscriptions')
    .select('user_id, plan_id, status, billing_source, stripe_subscription_id')
    .eq('user_id', ownerId)
    .maybeSingle();
  if (!sub) return { ok: false, reason: 'Subscription row not found', status: 404 };

  const plan = planForAppleProduct(tx.productId);
  if (!plan) return { ok: false, reason: 'Unknown product', status: 400 };

  const active = !opts.forceInactive && isTransactionActive(tx, opts.graceUntilMs);
  const nowMs = Date.now();
  const expiresIso = active
    ? (tx.expiresDate ? new Date(Math.max(tx.expiresDate, opts.graceUntilMs ?? 0)).toISOString() : null)
    : new Date(Math.min(tx.expiresDate ?? nowMs, tx.revocationDate ?? nowMs, nowMs)).toISOString();

  const update: Record<string, unknown> = {
    apple_original_transaction_id: tx.originalTransactionId,
    apple_product_id: tx.productId,
    apple_expires_at: expiresIso,
    apple_environment: tx.environment ?? null,
    updated_at: new Date().toISOString(),
  };

  const hasStripe = sub.billing_source !== 'apple' && !!sub.stripe_subscription_id;
  const stripeActive = hasStripe && sub.status === 'active';
  const stripePaying = hasStripe && (sub.status === 'active' || sub.status === 'past_due');

  if (active && stripeActive) {
    // Stripe stays in charge; the Apple fields above are kept for later.
  } else if (active) {
    Object.assign(update, {
      plan_id: plan,
      status: 'active',
      billing_source: 'apple',
      business_tier: null,
      current_period_end: expiresIso,
      trial_ends_at: null,
    });
  } else if (!stripePaying && sub.billing_source === 'apple') {
    Object.assign(update, { plan_id: 'free', status: 'active', current_period_end: null });
  }

  const { error } = await admin.from('subscriptions').update(update).eq('user_id', ownerId);
  if (error) return { ok: false, reason: error.message, status: 500 };
  return { ok: true, active, userId: ownerId };
}
