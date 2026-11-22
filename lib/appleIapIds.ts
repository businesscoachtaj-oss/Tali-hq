// lib/appleIapIds.ts (Tali HQ, 22 Nov 2026)
// The App Store products for the plans on iPhone. They must match supabase/functions/_shared/appleProducts.ts
// and the six products in App Store Connect, all in ONE subscription group ("Tali HQ") so people can
// move between plans. Business plans, top ups and the voice add-on are not sold on iPhone.
export type IapPlan = 'hq' | 'pro' | 'max';
export type IapInterval = 'month' | 'year';

export const PRODUCT_IDS: Record<IapPlan, Record<IapInterval, string>> = {
  hq: { month: 'au.com.totality360.talihq.hq.monthly', year: 'au.com.totality360.talihq.hq.yearly' },
  pro: { month: 'au.com.totality360.talihq.pro.monthly', year: 'au.com.totality360.talihq.pro.yearly' },
  max: { month: 'au.com.totality360.talihq.max.monthly', year: 'au.com.totality360.talihq.max.yearly' },
};
export const ALL_IDS: string[] = Object.values(PRODUCT_IDS).flatMap((p) => [p.month, p.year]);
export const productIdFor = (plan: IapPlan, interval: IapInterval) => PRODUCT_IDS[plan][interval];

export type IapIntroOffer = { price: string; periods: number; unit: 'day' | 'week' | 'month' | 'year'; mode: 'pay-as-you-go' | 'pay-up-front' | 'free-trial' };
export type IapProduct = { id: string; displayPrice: string; title: string; price?: number | null; intro?: IapIntroOffer | null; introEligible?: boolean };
export type VerifyResult = { active: boolean; error?: string };
