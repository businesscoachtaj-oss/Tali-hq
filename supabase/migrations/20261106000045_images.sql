-- Tali HQ, 6 Nov 2026: Tali makes images (asked for by Taj). Images are made by OpenAI (secret
-- OPENAI_API_KEY, edge function tali-image) and counted on their own, separate from Tali credits:
-- Free none, the 7 day trial 5, Tali HQ 30 a month, Pro 100 a month. Each image is a usage row with
-- feature 'image' and 0 credits, so it never eats chat credits. Idempotent.

alter table public.plans add column if not exists images_month integer not null default 0;
update public.plans set images_month = case id when 'hq' then 30 when 'pro' then 100 else 0 end;

-- Plan lists: say how many images each plan gets.
update public.plans set features = (
  select jsonb_agg(case when f = '1,000 Tali credits a month' then '1,000 Tali credits and 30 images a month' else f end order by o)
    from jsonb_array_elements_text(features) with ordinality as x(f, o))
 where id = 'hq' and not features ? '1,000 Tali credits and 30 images a month';
update public.plans set features = (
  select jsonb_agg(case when f = 'Everything in Tali HQ, with 3,000 credits a month' then 'Everything in Tali HQ, with 3,000 credits and 100 images a month' else f end order by o)
    from jsonb_array_elements_text(features) with ordinality as x(f, o))
 where id = 'pro' and not features ? 'Everything in Tali HQ, with 3,000 credits and 100 images a month';

-- How many images this person can make this month (service role). Mirrors chat_try_consume's plan check.
create or replace function public.image_allowance_for(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s record; tz text; month_start timestamptz; allowance integer := 0; used integer;
begin
  select sub.plan_id, sub.status, sub.trial_ends_at, p.images_month into s
    from public.subscriptions sub join public.plans p on p.id = sub.plan_id
   where sub.user_id = p_user_id;
  if found then
    -- The 7 day trial gets 5. A long founder trial (Taj's own account runs to 2028) gets the full plan.
    if s.status = 'trialing' and s.trial_ends_at > now() + interval '30 days' then allowance := s.images_month;
    elsif s.status = 'trialing' and s.trial_ends_at > now() then allowance := least(5, s.images_month);
    elsif s.status in ('active', 'past_due') and s.plan_id in ('hq', 'pro') then allowance := s.images_month;
    end if;
  end if;
  select coalesce(pr.timezone, 'Australia/Sydney') into tz from public.profiles pr where pr.id = p_user_id;
  tz := coalesce(tz, 'Australia/Sydney');
  month_start := date_trunc('month', now() at time zone tz) at time zone tz;
  select count(*) into used from public.usage u
   where u.user_id = p_user_id and u.feature = 'image' and u.created_at >= month_start;
  return jsonb_build_object('allowance', allowance, 'used', used, 'remaining', greatest(allowance - used, 0),
                            'trial', coalesce(s.status = 'trialing' and s.trial_ends_at <= now() + interval '30 days', false));
end $$;
revoke all on function public.image_allowance_for(uuid) from public, anon, authenticated;
grant execute on function public.image_allowance_for(uuid) to service_role;

-- Reserve one image before calling OpenAI (service role). Refund by deleting the usage row.
create or replace function public.image_try_consume(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a jsonb; v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('image:' || p_user_id::text, 0));
  a := public.image_allowance_for(p_user_id);
  if (a->>'allowance')::int = 0 then return jsonb_build_object('ok', false, 'reason', 'no_access') || a; end if;
  if (select count(*) from public.usage u where u.user_id = p_user_id and u.feature = 'image' and u.created_at > now() - interval '5 minutes') >= 4 then
    return jsonb_build_object('ok', false, 'reason', 'slow_down') || a;
  end if;
  if (a->>'remaining')::int <= 0 then return jsonb_build_object('ok', false, 'reason', 'out_of_images') || a; end if;
  insert into public.usage(user_id, feature, credits) values (p_user_id, 'image', 0) returning id into v_id;
  return jsonb_build_object('ok', true, 'usage_id', v_id, 'remaining', (a->>'remaining')::int - 1, 'allowance', (a->>'allowance')::int);
end $$;
revoke all on function public.image_try_consume(uuid) from public, anon, authenticated;
grant execute on function public.image_try_consume(uuid) to service_role;

-- Images left for the signed-in person, for the app.
create or replace function public.my_images() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when (select auth.uid()) is null then null else public.image_allowance_for((select auth.uid())) end;
$$;
revoke all on function public.my_images() from public, anon;
grant execute on function public.my_images() to authenticated;

-- The app's credit line also shows images left. Same as 002 with images added.
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
    'images', public.my_images())
  from s;
$$;

revoke all on function public.my_credits() from public, anon;
grant execute on function public.my_credits() to authenticated;
