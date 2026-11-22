// supabase/functions/tali-apple-verify/index.ts (Tali HQ, 22 Nov 2026, copied from Totality Nutrition)
//
// Called by the iOS app after an App Store purchase, a restore, or a silent
// entitlement sync. Body: { transactions: string[] }, each a StoreKit 2
// signed transaction (JWS). Verifies each one is genuinely signed by Apple,
// is for this app and one of our subscription products, then marks the
// signed-in user's Tali HQ plan active (or expired).

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import {
  AppleJwsError, type AppleTransaction, TALI_BUNDLE_ID, TALI_PRODUCT_IDS, verifyAppleJws,
} from '../_shared/appleJws.ts'
import { applyAppleTransaction } from '../_shared/appleEntitlement.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Verify the caller's JWT with the service-role client (project pattern).
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user) return json({ error: 'Not signed in' }, 401)

  let body: { transactions?: unknown }
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }
  const list = Array.isArray(body.transactions) ? body.transactions.filter((t): t is string => typeof t === 'string') : []
  if (list.length === 0 || list.length > 20) return json({ error: 'Send 1 to 20 signed transactions' }, 400)

  // Verify every JWS, keep only ours, then apply the one that expires last
  // (renewals produce several transactions for the same subscription).
  const valid: AppleTransaction[] = []
  for (const jws of list) {
    try {
      const tx = await verifyAppleJws<AppleTransaction>(jws)
      if (tx.bundleId !== TALI_BUNDLE_ID) continue
      if (!TALI_PRODUCT_IDS.has(tx.productId)) continue
      valid.push(tx)
    } catch (e) {
      console.warn('Rejected transaction:', e instanceof AppleJwsError ? e.message : String(e))
    }
  }
  if (valid.length === 0) return json({ error: 'No valid App Store subscription found', active: false }, 400)

  valid.sort((a, b) => (b.expiresDate ?? 0) - (a.expiresDate ?? 0))
  const latest = valid[0]

  const result = await applyAppleTransaction(admin, latest, { userId: user.id })

  await admin.from('tali_apple_events').insert({
    source: 'client_verify',
    original_transaction_id: latest.originalTransactionId,
    transaction_id: latest.transactionId,
    product_id: latest.productId,
    environment: latest.environment ?? null,
    expires_at: latest.expiresDate ? new Date(latest.expiresDate).toISOString() : null,
    user_id: user.id,
    result: result.ok ? (result.active ? 'active' : 'inactive') : `error: ${result.reason}`,
  })

  if (!result.ok) return json({ error: result.reason, active: false }, result.status)
  return json({
    active: result.active,
    productId: latest.productId,
    expiresAt: latest.expiresDate ? new Date(latest.expiresDate).toISOString() : null,
  })
})
