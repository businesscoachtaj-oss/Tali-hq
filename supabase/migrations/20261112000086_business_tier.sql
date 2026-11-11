-- 12 Nov 2026 (Taj): the Business plans. A Business member stays on plan 'max' for credits and every
-- existing check, and business_tier says which Business plan they pay for. Only the server writes it
-- (stripe-webhook). my_credits now returns businessTier.
alter table public.subscriptions add column if not exists business_tier text check (business_tier is null or business_tier in ('biz', 'biz_pro', 'biz_max'));

create or replace function public.my_credits()
returns jsonb language sql stable set search_path to '' as $function$
  with s as (
    select s.plan_id, s.status, s.trial_ends_at, s.business_tier, p.credits_month, p.messages_month, coalesce(pr.timezone,'Australia/Sydney') tz
      from public.subscriptions s join public.plans p on p.id = s.plan_id
      left join public.profiles pr on pr.id = s.user_id
     where s.user_id = (select auth.uid())
  )
  select jsonb_build_object(
    'plan', s.plan_id, 'status', s.status, 'trialEndsAt', s.trial_ends_at,
    'businessTier', case when s.plan_id = 'max' and s.status in ('active', 'past_due') then s.business_tier end,
    'creditsMonth', s.credits_month, 'messagesMonth', s.messages_month,
    'used', coalesce((select sum(u.credits - u.extra_credits) from public.usage u
                       where u.user_id = (select auth.uid())
                         and u.created_at >= (date_trunc('month', now() at time zone s.tz) at time zone s.tz)), 0),
    'messagesUsed', (select count(*) from public.usage u
                      where u.user_id = (select auth.uid())
                        and u.feature in ('chat', 'shutdown')
                        and u.created_at >= (date_trunc('month', now() at time zone s.tz) at time zone s.tz)),
    'freeMessages', (select messages_month from public.plans where id = 'free'),
    'extra', public.my_extra_credits(),
    'images', public.my_images(),
    'searches', public.my_searches(),
    'deep', public.my_deep())
  from s;
$function$;
