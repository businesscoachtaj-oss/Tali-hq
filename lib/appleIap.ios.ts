// lib/appleIap.ios.ts (Tali HQ, iOS ONLY, 22 Nov 2026)
//
// Apple In-App Purchase for the Tali HQ plans on iPhone (App Review guideline 3.1.1), copied from
// Totality Nutrition. Metro only bundles this file into the iOS app; web and Android get
// lib/appleIap.ts (a stub) and keep Stripe.
//
// Flow: StoreKit purchase -> Apple-signed transaction (JWS) -> the tali-apple-verify Edge Function
// checks Apple's signature and sets the plan -> we finish the transaction. Renewals and expiries
// arrive server side through tali-apple-notifications.

import {
  initConnection, fetchProducts, requestPurchase, finishTransaction,
  getAvailablePurchases, restorePurchases, deepLinkToSubscriptions,
  purchaseUpdatedListener, purchaseErrorListener, getTransactionJwsIOS, ErrorCode,
  isEligibleForIntroOfferIOS,
} from 'expo-iap'
import type { Purchase } from 'expo-iap'
import { supabase } from './supabase'
import { PRODUCT_IDS, ALL_IDS, type IapIntroOffer, type IapProduct, type VerifyResult } from './appleIapIds'

export { PRODUCT_IDS, productIdFor, type IapIntroOffer, type IapProduct, type VerifyResult } from './appleIapIds'
export const IAP_SUPPORTED = true
void PRODUCT_IDS

let connected: Promise<boolean> | null = null
function connect(): Promise<boolean> {
  if (!connected) connected = initConnection().then(() => true).catch(() => { connected = null; return false })
  return connected
}

export async function loadProducts(): Promise<Record<string, IapProduct>> {
  if (!(await connect())) return {}
  const list = (await fetchProducts({ skus: ALL_IDS, type: 'subs' })) ?? []
  const out: Record<string, IapProduct> = {}
  // ADDED (Oct 25 2026): intro offer and eligibility (one check for the group).
  const groupId = (list as any[]).map((p) => p.subscriptionInfoIOS?.subscriptionGroupId).find(Boolean) as string | undefined
  let eligible = false
  if (groupId) {
    try { eligible = await isEligibleForIntroOfferIOS(groupId) } catch { eligible = false }
  }
  for (const p of list as any[]) {
    const mode = p.introductoryPricePaymentModeIOS as string | undefined
    const unit = p.introductoryPriceSubscriptionPeriodIOS as string | undefined
    const periods = Number(p.introductoryPriceNumberOfPeriodsIOS ?? 0)
    const intro: IapIntroOffer | null =
      p.introductoryPriceIOS && periods > 0 && (mode === 'pay-as-you-go' || mode === 'pay-up-front' || mode === 'free-trial')
        && (unit === 'day' || unit === 'week' || unit === 'month' || unit === 'year')
        ? { price: String(p.introductoryPriceIOS), periods, unit, mode }
        : null
    out[p.id] = { id: p.id, displayPrice: p.displayPrice, title: p.title || p.displayNameIOS || p.id, price: p.price ?? null, intro, introEligible: !!intro && eligible }
  }
  return out
}

async function verifyOnServer(jwsList: string[]): Promise<VerifyResult> {
  const { data, error } = await supabase.functions.invoke('tali-apple-verify', { body: { transactions: jwsList } })
  if (error) {
    // supabase-js wraps non-2xx; pull our JSON error message out if present
    let msg = 'We could not confirm your purchase with the App Store.'
    try { const body = await (error as any).context?.json?.(); if (body?.error) msg = body.error } catch { /* keep default */ }
    return { active: false, error: msg }
  }
  return { active: !!data?.active }
}

async function jwsFor(purchase: Purchase): Promise<string | null> {
  if (purchase.purchaseToken) return purchase.purchaseToken
  try { return (await getTransactionJwsIOS(purchase.productId)) ?? null } catch { return null }
}

// Verify one purchase on our server, then finish it with StoreKit. A
// purchase is only finished after the server accepted it, so a network
// failure leaves it pending and StoreKit re-delivers it next launch.
const handled = new Set<string>()
export async function completePurchase(purchase: Purchase): Promise<VerifyResult> {
  if (!ALL_IDS.includes(purchase.productId)) return { active: false }
  const key = (purchase as any).transactionId ?? purchase.id
  const jws = await jwsFor(purchase)
  if (!jws) return { active: false, error: 'The App Store did not return a receipt for this purchase.' }
  const result = await verifyOnServer([jws])
  if (!result.error && !handled.has(key)) {
    handled.add(key)
    try { await finishTransaction({ purchase, isConsumable: false }) } catch { /* already finished */ }
  }
  return result
}

// Starts the App Store purchase sheet. The outcome arrives through the
// listeners registered with listenForPurchases (and is also returned here
// when StoreKit hands it back directly).
export async function buy(productId: string, userId: string): Promise<Purchase | null> {
  if (!(await connect())) throw new Error('The App Store is not available right now. Please try again.')
  const res: any = await requestPurchase({
    request: { ios: { sku: productId, appAccountToken: userId } },
    type: 'subs',
  })
  const purchase = Array.isArray(res) ? res[0] : res
  return purchase ?? null
}

export function listenForPurchases(
  onPurchase: (p: Purchase) => void,
  onError: (message: string | null) => void,
): () => void {
  connect()
  const a = purchaseUpdatedListener((p) => onPurchase(p))
  const b = purchaseErrorListener((e) => {
    if (e?.code === ErrorCode.UserCancelled) onError(null)
    else onError(e?.message || 'The purchase did not go through.')
  })
  return () => { a.remove(); b.remove() }
}

// Silent check of the Apple ID's current subscriptions (no sign-in prompt).
// Returns null when this Apple ID has no Tali HQ subscription at all.
export async function syncEntitlements(): Promise<VerifyResult | null> {
  if (!(await connect())) return null
  const purchases = ((await getAvailablePurchases()) ?? []) as Purchase[]
  const ours = purchases.filter(p => ALL_IDS.includes(p.productId))
  if (ours.length === 0) return null
  const jwsList = (await Promise.all(ours.map(jwsFor))).filter((j): j is string => !!j)
  if (jwsList.length === 0) return null
  return verifyOnServer(jwsList)
}

// "Restore Purchases" button (Apple requires one): syncs with the App Store,
// which may ask the user to sign in, then re-checks entitlements.
export async function restore(): Promise<VerifyResult | null> {
  if (!(await connect())) return null
  try { await restorePurchases() } catch { /* fall through to the silent check */ }
  return syncEntitlements()
}

export async function openManageSubscriptions(): Promise<void> {
  try { await deepLinkToSubscriptions() } catch {
    const { Linking } = require('react-native')
    Linking.openURL('https://apps.apple.com/account/subscriptions')
  }
}
