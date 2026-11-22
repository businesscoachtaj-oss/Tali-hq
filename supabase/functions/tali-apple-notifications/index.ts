// supabase/functions/tali-apple-notifications/index.ts (Tali HQ, 22 Nov 2026, copied from Totality Nutrition)
//
// App Store Server Notifications V2 endpoint (set as both the Production and
// Sandbox Server URL in App Store Connect > App Information). Apple POSTs
// { signedPayload } here on every subscription event: renewals, expiries,
// failed renewals, refunds, revocations. We verify Apple's signature, then
// update the subscriber's plan. Deployed with verify_jwt = false because
// Apple doesn't send a Supabase JWT; the JWS signature check is the auth.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import {
  AppleJwsError, type AppleTransaction, TALI_BUNDLE_ID, TALI_PRODUCT_IDS, verifyAppleJws,
} from '../_shared/appleJws.ts'
import { applyAppleTransaction } from '../_shared/appleEntitlement.ts'

type NotificationPayload = {
  notificationType: string
  subtype?: string
  notificationUUID: string
  data?: {
    bundleId?: string
    environment?: string
    signedTransactionInfo?: string
    signedRenewalInfo?: string
  }
}

type RenewalInfo = { gracePeriodExpiresDate?: number }

// Events that end access regardless of the transaction's expiry date.
const ENDS_ACCESS = new Set(['EXPIRED', 'GRACE_PERIOD_EXPIRED', 'REVOKE', 'REFUND'])

const ok = (msg = 'ok') => new Response(msg, { status: 200 })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let signedPayload: string | undefined
  try { signedPayload = (await req.json())?.signedPayload } catch { /* fallthrough */ }
  if (!signedPayload) return new Response('Missing signedPayload', { status: 400 })

  let note: NotificationPayload
  try {
    note = await verifyAppleJws<NotificationPayload>(signedPayload)
  } catch (e) {
    console.warn('Rejected notification:', e instanceof AppleJwsError ? e.message : String(e))
    return new Response('Invalid signature', { status: 401 })
  }

  if (note.data?.bundleId && note.data.bundleId !== TALI_BUNDLE_ID) return ok('ignored: other app')
  if (note.notificationType === 'TEST') return ok('test received')

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Idempotency: Apple retries until it gets a 200.
  const { data: seen } = await admin
    .from('tali_apple_events')
    .select('id')
    .eq('notification_uuid', note.notificationUUID)
    .maybeSingle()
  if (seen) return ok('duplicate')

  if (!note.data?.signedTransactionInfo) return ok('no transaction')

  let tx: AppleTransaction
  let renewal: RenewalInfo = {}
  try {
    tx = await verifyAppleJws<AppleTransaction>(note.data.signedTransactionInfo)
    if (note.data.signedRenewalInfo) renewal = await verifyAppleJws<RenewalInfo>(note.data.signedRenewalInfo)
  } catch (e) {
    console.warn('Rejected inner JWS:', e instanceof AppleJwsError ? e.message : String(e))
    return new Response('Invalid signature', { status: 401 })
  }
  if (tx.bundleId !== TALI_BUNDLE_ID || !TALI_PRODUCT_IDS.has(tx.productId)) return ok('ignored: other product')

  const result = await applyAppleTransaction(admin, tx, {
    graceUntilMs: renewal.gracePeriodExpiresDate,
    forceInactive: ENDS_ACCESS.has(note.notificationType),
  })

  await admin.from('tali_apple_events').insert({
    source: 'notification',
    notification_uuid: note.notificationUUID,
    notification_type: note.notificationType,
    subtype: note.subtype ?? null,
    original_transaction_id: tx.originalTransactionId,
    transaction_id: tx.transactionId,
    product_id: tx.productId,
    environment: tx.environment ?? note.data?.environment ?? null,
    expires_at: tx.expiresDate ? new Date(tx.expiresDate).toISOString() : null,
    user_id: result.ok ? result.userId : null,
    result: result.ok ? (result.active ? 'active' : 'inactive') : `error: ${result.reason}`,
  })

  // Always 200 once the signature checked out, so Apple doesn't keep
  // retrying events we can't map to an account (logged above).
  return ok()
})
