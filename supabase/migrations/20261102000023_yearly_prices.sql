-- 023: yearly prices, 15% less than twelve months of the monthly price (Taj, 2 Nov 2026).
-- Stripe prices: Tali HQ price_1UXB4HPy9YlWBZ02pW7k1ubh (A$203.90/yr), Pro price_1UXB4JPy9YlWBZ02mazh3HDd (A$407.90/yr).
update public.plans set yearly_price_aud = 203.90 where id = 'hq';
update public.plans set yearly_price_aud = 407.90 where id = 'pro';
