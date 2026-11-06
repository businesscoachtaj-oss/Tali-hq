-- Tali HQ, 6 Nov 2026: Deep think (asked for by Taj). One message to a smarter model with more of her
-- brain: Sonnet for 20 credits on Tali HQ and Pro, Opus ("Deepest") for 40 credits on Pro. Free gets 1
-- Deep think a month, counted on its own (a usage row with feature 'deep_think_free', 0 credits) on
-- top of the normal message. Idempotent.

alter table public.plans add column if not exists deep_month integer not null default 0;
update public.plans set deep_month = case id when 'free' then 1 else 0 end;

update public.plans set features = features || '"1 Deep think a month"'::jsonb
 where id = 'free' and not features ? '1 Deep think a month';

-- Which Deep think options this person has, and Free's count this month (service role).
create or replace function public.deep_allowance_for(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s record; tz text; month_start timestamptz; v_plan text := 'free'; allowance integer := 0; used integer;
begin
  select sub.plan_id, sub.status, sub.trial_ends_at into s from public.subscriptions sub where sub.user_id = p_user_id;
  if found and ((s.status = 'trialing' and s.trial_ends_at > now()) or (s.status in ('active', 'past_due') and s.plan_id in ('hq', 'pro'))) then
    v_plan := s.plan_id;
  end if;
  if v_plan = 'free' then select deep_month into allowance from public.plans where id = 'free'; end if;
  select coalesce(pr.timezone, 'Australia/Sydney') into tz from public.profiles pr where pr.id = p_user_id;
  tz := coalesce(tz, 'Australia/Sydney');
  month_start := date_trunc('month', now() at time zone tz) at time zone tz;
  select count(*) into used from public.usage u
   where u.user_id = p_user_id and u.feature = 'deep_think_free' and u.created_at >= month_start;
  return jsonb_build_object('plan', v_plan, 'allowance', coalesce(allowance, 0), 'used', used,
                            'remaining', greatest(coalesce(allowance, 0) - used, 0));
end $$;
revoke all on function public.deep_allowance_for(uuid) from public, anon, authenticated;
grant execute on function public.deep_allowance_for(uuid) to service_role;

-- For the app: Free's Deep think count (null on paid plans, where it costs credits).
create or replace function public.my_deep() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when (select auth.uid()) is null then null
              when public.deep_allowance_for((select auth.uid()))->>'plan' = 'free' then public.deep_allowance_for((select auth.uid()))
              else null end;
$$;
revoke all on function public.my_deep() from public, anon;
grant execute on function public.my_deep() to authenticated;

-- Deep think reads more of her brain: 30 memories and 12 recent ones instead of 10 and 8.
-- A three-argument twin of tali_context (041); the two-argument one is unchanged.
create or replace function public.tali_context(p_user_id uuid, p_query text, p_limit integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb; n integer := least(greatest(coalesce(p_limit, 10), 1), 40);
begin
  select jsonb_build_object(
    'profile', (select jsonb_build_object('first_name', pr.first_name, 'business_name', pr.business_name,
                  'business_type', pr.business_type, 'about_me', pr.about_me, 'timezone', pr.timezone)
                  from public.profiles pr where pr.id = p_user_id),
    'memories', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'content', r.content, 'about', r.about))
                  from brain.recall(p_user_id, coalesce(nullif(trim(p_query), ''), 'business'), n, null, true) r), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind, 'content', m.content) order by m.created_at desc)
                  from (select id, kind, content, created_at from brain.memories
                         where user_id = p_user_id and status = 'active' and importance >= 4
                         order by created_at desc limit case when n > 10 then 12 else 8 end) m), '[]'::jsonb),
    'journal', coalesce((select jsonb_agg(jsonb_build_object('when', j.created_at::date, 'title', j.title, 'body', left(j.body, 600)) order by j.created_at desc)
                  from (select title, body, created_at from public.journal_entries
                         where user_id = p_user_id and private_to_tali = false
                         order by created_at desc limit 5) j), '[]'::jsonb)
  ) into v;
  return v;
end $$;
revoke all on function public.tali_context(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.tali_context(uuid, text, integer) to service_role;

-- The credit line carries Free's Deep think count. Same as 047 with deep added.
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
    'searches', public.my_searches(),
    'deep', public.my_deep())
  from s;
$$;
revoke all on function public.my_credits() from public, anon;
grant execute on function public.my_credits() to authenticated;
