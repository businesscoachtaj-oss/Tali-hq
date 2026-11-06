-- 7 Nov 2026 (Taj): show Free users "X of 250 messages left". my_credits() gains messagesUsed: chats and
-- shutdowns this month in the user's time zone, counted exactly the way chat_try_consume counts them
-- for Free (feature chat or shutdown, from the start of the month).
create or replace function public.my_credits()
returns jsonb
language sql
stable
set search_path to ''
as $function$
  with s as (
    select s.plan_id, s.status, s.trial_ends_at, p.credits_month, p.messages_month, coalesce(pr.timezone,'Australia/Sydney') tz
      from public.subscriptions s join public.plans p on p.id = s.plan_id
      left join public.profiles pr on pr.id = s.user_id
     where s.user_id = (select auth.uid())
  )
  select jsonb_build_object(
    'plan', s.plan_id, 'status', s.status, 'trialEndsAt', s.trial_ends_at,
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
