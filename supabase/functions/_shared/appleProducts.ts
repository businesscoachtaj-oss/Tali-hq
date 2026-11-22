// supabase/functions/_shared/appleProducts.ts (Tali HQ, 22 Nov 2026)
//
// The App Store subscription products for Tali HQ on iPhone (App Review guideline 3.1.1). All six sit
// in ONE subscription group in App Store Connect ("Tali HQ") so people can move between plans.
// No crypto imports here, so the Stripe webhook can use them too.

export const TALI_APPLE_PRODUCTS: Record<string, { plan: 'hq' | 'pro' | 'max'; interval: 'month' | 'year' }> = {
  'au.com.totality360.talihq.hq.monthly': { plan: 'hq', interval: 'month' },
  'au.com.totality360.talihq.hq.yearly': { plan: 'hq', interval: 'year' },
  'au.com.totality360.talihq.pro.monthly': { plan: 'pro', interval: 'month' },
  'au.com.totality360.talihq.pro.yearly': { plan: 'pro', interval: 'year' },
  'au.com.totality360.talihq.max.monthly': { plan: 'max', interval: 'month' },
  'au.com.totality360.talihq.max.yearly': { plan: 'max', interval: 'year' },
};

export const TALI_PRODUCT_IDS = new Set(Object.keys(TALI_APPLE_PRODUCTS));

export const planForAppleProduct = (productId: string | null | undefined) =>
  (productId && TALI_APPLE_PRODUCTS[productId]?.plan) || null;
