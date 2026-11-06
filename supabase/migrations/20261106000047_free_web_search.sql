-- Tali HQ, 6 Nov 2026: Free gets 10 web searches a month (asked for by Taj, so Free Tali is not behind
-- the free chat apps on "what's the going rate for...?"). Counted on their own, never as messages or
-- credits: one usage row per search with feature 'web_search_free' and 0 credits. Trial, Tali HQ and
-- Pro are unchanged (searching is built in, 2 extra credits a search). Idempotent.

alter table public.plans add column if not exists searches_month integer not null default 0;
update public.plans set searches_month = case id when 'free' then 10 else 0 end;

-- Free plan list: say so.
update public.plans set features = features || '"10 web searches a month, with sources"'::jsonb
 where id = 'free' and not features ? '10 web searches a month, with sources';

-- Free searches left this month (service role). Only people on the Free plan (or whose trial or paid
-- plan has ended) get an allowance here; everyone else searches under their credits.
create or replace function public.search_allowance_for(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s record; tz text; month_start timestamptz; v_free boolean := true; allowance integer := 0; used integer;
begin
  select sub.plan_id, sub.status, sub.trial_ends_at into s from public.subscriptions sub where sub.user_id = p_user_id;
  if found and ((s.status = 'trialing' and s.trial_ends_at > now()) or (s.status in ('active', 'past_due') and s.plan_id in ('hq', 'pro'))) then
    v_free := false;
  end if;
  if v_free then select searches_month into allowance from public.plans where id = 'free'; end if;
  select coalesce(pr.timezone, 'Australia/Sydney') into tz from public.profiles pr where pr.id = p_user_id;
  tz := coalesce(tz, 'Australia/Sydney');
  month_start := date_trunc('month', now() at time zone tz) at time zone tz;
  select count(*) into used from public.usage u
   where u.user_id = p_user_id and u.feature = 'web_search_free' and u.created_at >= month_start;
  return jsonb_build_object('free', v_free, 'allowance', coalesce(allowance, 0), 'used', used,
                            'remaining', greatest(coalesce(allowance, 0) - used, 0));
end $$;
revoke all on function public.search_allowance_for(uuid) from public, anon, authenticated;
grant execute on function public.search_allowance_for(uuid) to service_role;

-- For the app: the signed-in person's own count (null unless they are on Free).
create or replace function public.my_searches() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when (select auth.uid()) is null then null
              when (public.search_allowance_for((select auth.uid()))->>'free')::boolean then public.search_allowance_for((select auth.uid()))
              else null end;
$$;
revoke all on function public.my_searches() from public, anon;
grant execute on function public.my_searches() to authenticated;

-- The credit line carries it. Same as 045 with searches added.
create or replace function public.my_credits() returns jsonb
language sql stable security invoker set search_path = '' as $$
  with s as (
    select s.plan_id, s.status, s.trial_ends_at, p.credits_month, p.messages_month, coalesce(pr.timezone,'Australia/Sydney') tz
      from public.subscriptions s join public.plans p on p.id = s.plan_id
      left join public.profiles pr on pr.id = s.user_id
     where s.user_id = (select auth.uid())
  )
  select jsonb_build_object(
    'plan', s.plan_id, 'status', s.status, 'trialEndsAt', s.trial_ends_at,
    'creditsMonth', s.credits_month, 'messagesMonth', s.messages_month,
    'used', coalesce((select sum(u.credits) from public.usage u
                       where u.user_id = (select auth.uid())
                         and u.created_at >= (date_trunc('month', now() at time zone s.tz) at time zone s.tz)), 0),
    'images', public.my_images(),
    'searches', public.my_searches())
  from s;
$$;
revoke all on function public.my_credits() from public, anon;
grant execute on function public.my_credits() to authenticated;
