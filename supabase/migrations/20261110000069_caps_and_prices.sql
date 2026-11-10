-- Caps and prices (10 Nov 2026, Taj's call after seeing what each plan can cost).
--
-- Prices: Tali HQ stays A$19.99. Pro goes from A$39.99 to A$49.99 (A$509.90 a year). Max goes from
-- A$99.99 to A$149.99 (A$1,529.90 a year). Nobody was paying yet, so nobody's price changes under them.
-- New Stripe prices are in _shared/stripe.ts. The founding 42.5% off still applies on top.
--
-- Two caps, both about the dearest things a credit can buy:
--   1. Web searches a month on paid plans and the trial: Tali HQ 150, Pro 400, Max 1,000.
--      (Free keeps its 10.) Counted from the usage rows tali-chat already writes.
--   2. Max: Deep think, Big brain and second opinions are half the credits for the first 100 a
--      month, then the normal credits.
--
--   plans.searches_month       now set for every plan
--   plans.half_price_month     how many half price thinks a month (Max 100, the rest 0)
--   search_allowance_for       now answers for paid plans too: { free, capped, allowance, used, remaining }
--   half_price_left            half price thinks left this month (0 unless on Max)
-- tali-chat reads both. Until it is redeployed nothing changes for anyone.
-- Also: the Tali HQ plan card no longer says Tali reads Gmail (she is sent it now).

alter table public.plans add column if not exists half_price_month integer not null default 0;

update public.plans set monthly_price_aud = 49.99, yearly_price_aud = 509.90 where id = 'pro';
update public.plans set monthly_price_aud = 149.99, yearly_price_aud = 1529.90 where id = 'max';
update public.plans set searches_month = case id when 'free' then 10 when 'hq' then 150 when 'pro' then 400 when 'max' then 1000 else searches_month end;
update public.plans set half_price_month = case id when 'max' then 100 else 0 end;

update public.plans set features = (
  select jsonb_agg(case
    when f = 'Your inbox, sorted: connect Gmail and Tali reads what comes in, flags what needs you and drafts the reply'
      then 'Your inbox, sorted: send your Gmail to Tali or connect Outlook, and she flags what needs you and drafts the reply'
    else f end order by ord)
  from jsonb_array_elements_text(features) with ordinality as x(f, ord))
 where id = 'hq';
update public.plans set features = (
  select jsonb_agg(case
    when f = 'Deep think, Big brain and second opinions at half the credits'
      then 'Deep think, Big brain and second opinions at half the credits for your first 100 a month'
    else f end order by ord)
  from jsonb_array_elements_text(features) with ordinality as x(f, ord))
 where id = 'max';

-- Web searches left this month. Free: 10, counted one row a search. Paid plans and the trial: their
-- plan's limit, counted from the credits tali-chat records (2 credits a search).
create or replace function public.search_allowance_for(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s record; tz text; month_start timestamptz; v_plan text := 'free'; allowance integer := 0; used integer;
begin
  select sub.plan_id, sub.status, sub.trial_ends_at into s from public.subscriptions sub where sub.user_id = p_user_id;
  if found and s.status in ('active', 'past_due') and s.plan_id in ('hq', 'pro', 'max') then
    v_plan := s.plan_id;
  elsif found and s.status = 'trialing' and s.trial_ends_at > now() then
    v_plan := 'hq'; -- the trial is a trial of Tali HQ
  end if;
  select coalesce(p.searches_month, 0) into allowance from public.plans p where p.id = v_plan;
  select coalesce(pr.timezone, 'Australia/Sydney') into tz from public.profiles pr where pr.id = p_user_id;
  tz := coalesce(tz, 'Australia/Sydney');
  month_start := date_trunc('month', now() at time zone tz) at time zone tz;
  if v_plan = 'free' then
    select count(*) into used from public.usage u
     where u.user_id = p_user_id and u.feature = 'web_search_free' and u.created_at >= month_start;
  else
    select coalesce(sum(u.credits), 0) / 2 into used from public.usage u
     where u.user_id = p_user_id and u.feature = 'web_search' and u.created_at >= month_start;
  end if;
  return jsonb_build_object('free', v_plan = 'free', 'capped', coalesce(allowance, 0) > 0, 'plan', v_plan,
                            'allowance', coalesce(allowance, 0), 'used', used,
                            'remaining', greatest(coalesce(allowance, 0) - used, 0));
end $$;
revoke all on function public.search_allowance_for(uuid) from public, anon, authenticated;
grant execute on function public.search_allowance_for(uuid) to service_role;

-- For the app: the signed-in person's own count, on any plan now.
create or replace function public.my_searches() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when (select auth.uid()) is null then null else public.search_allowance_for((select auth.uid())) end;
$$;
revoke all on function public.my_searches() from public, anon;
grant execute on function public.my_searches() to authenticated;

-- Half price thinks left this month. 0 for anyone who is not a paying Max member.
create or replace function public.half_price_left(p_user_id uuid)
returns integer language plpgsql stable security definer set search_path = '' as $$
declare s record; tz text; month_start timestamptz; allowance integer; used integer;
begin
  select sub.plan_id, sub.status into s from public.subscriptions sub where sub.user_id = p_user_id;
  if not found or s.plan_id <> 'max' or s.status not in ('active', 'past_due') then return 0; end if;
  select coalesce(p.half_price_month, 0) into allowance from public.plans p where p.id = 'max';
  select coalesce(pr.timezone, 'Australia/Sydney') into tz from public.profiles pr where pr.id = p_user_id;
  tz := coalesce(tz, 'Australia/Sydney');
  month_start := date_trunc('month', now() at time zone tz) at time zone tz;
  select count(*) into used from public.usage u
   where u.user_id = p_user_id and u.feature in ('deep_think', 'second_opinion') and u.created_at >= month_start;
  return greatest(coalesce(allowance, 0) - used, 0);
end $$;
revoke all on function public.half_price_left(uuid) from public, anon, authenticated;
grant execute on function public.half_price_left(uuid) to service_role;
