// Top up packs (6 Nov 2026, asked for by Taj). One-off Stripe payments for extra credits and images.
// The app shows the same packs (app/(app)/top-up.tsx); the price charged always comes from here.
export type TopupPack = { id: string; name: string; credits: number; images: number; cents: number };

export const TOPUP_PACKS: TopupPack[] = [
  { id: 'c500', name: '500 Tali credits', credits: 500, images: 0, cents: 999 },
  { id: 'c1500', name: '1,500 Tali credits', credits: 1500, images: 0, cents: 2499 },
  { id: 'c5000', name: '5,000 Tali credits', credits: 5000, images: 0, cents: 6999 },
  { id: 'i20', name: '20 Tali images', credits: 0, images: 20, cents: 499 },
  { id: 'i50', name: '50 Tali images', credits: 0, images: 50, cents: 999 },
  { id: 'b-busy', name: 'Busy month: 1,500 credits and 30 images', credits: 1500, images: 30, cents: 2999 },
  { id: 'b-big', name: 'Big month: 5,000 credits and 100 images', credits: 5000, images: 100, cents: 7999 },
  // 12 Nov 2026 (Taj): the one-off unlock for your own domain on a hosted site. No credits. public.site_domain_unlocked reads it.
  { id: 'domain', name: 'Your own domain for your website', credits: 0, images: 0, cents: 7900 },
];

export const topupPack = (id: unknown) => TOPUP_PACKS.find((p) => p.id === id) ?? null;
