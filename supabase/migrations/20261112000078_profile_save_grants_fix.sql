-- 12 Nov 2026: profile saves were failing with "permission denied". The app updates these columns on the
-- person's own row (onboarding and Settings save has_business, Money saves costs and cash, Your privacy
-- saves share_learning) but the column grants were never added. Own row only, as before (RLS unchanged).
grant update (has_business, share_learning, monthly_costs, cash_on_hand, money_updated_at) on public.profiles to authenticated;
