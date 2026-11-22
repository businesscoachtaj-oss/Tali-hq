// lib/appleIap.ts (Tali HQ, web and Android stub, 22 Nov 2026)
// Apple In-App Purchase is iPhone only (lib/appleIap.ios.ts, which Metro uses on iOS instead of this
// file). Web and Android keep Stripe, so every function here does nothing and expo-iap is never
// bundled for them.
export { PRODUCT_IDS, productIdFor, type IapIntroOffer, type IapProduct, type VerifyResult } from './appleIapIds';
import type { IapProduct, VerifyResult } from './appleIapIds';

export const IAP_SUPPORTED = false;
export async function loadProducts(): Promise<Record<string, IapProduct>> { return {}; }
export async function completePurchase(_purchase: unknown): Promise<VerifyResult> { return { active: false }; }
export async function buy(_productId: string, _userId: string): Promise<null> { return null; }
export function listenForPurchases(_onPurchase: (p: any) => void, _onError: (m: string | null) => void): () => void { return () => {}; }
export async function syncEntitlements(): Promise<VerifyResult | null> { return null; }
export async function restore(): Promise<VerifyResult | null> { return null; }
export async function openManageSubscriptions(): Promise<void> {}
