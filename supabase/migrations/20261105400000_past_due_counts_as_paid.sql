-- Tali HQ, 5 Nov 2026: a plan with an overdue payment (Stripe past_due) is a grace state while Stripe
-- retries the card. The app (lib/plan.ts isPaid) and the edge functions already treat it as paid, but
-- these SQL functions did not. Each is copied from its newest definition in the repo with only the paid
-- status check changed: chat_try_consume (035), due_briefs (012), health_nudges (029), admin_stats (011).

-- 1. chat_try_consume, from 20261103000035 (section B.2).
create or replace function public.chat_try_consume(p_user_id uuid, p_feature text, p_credits integer default 1)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s record; tz text; month_start timestamptz; used_credits integer; used_msgs integer;
  allowance integer; msg_limit integer; plan text; v_id bigint;
begin
  select sub.plan_id, sub.status, sub.trial_ends_at, p.credits_month, p.messages_month
    into s
    from public.subscriptions sub join public.plans p on p.id = sub.plan_id
   where sub.user_id = p_user_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_access'); end if;

  select coalesce(pr.timezone, 'Australia/Sydney') into tz from public.profiles pr where pr.id = p_user_id;
  tz := coalesce(tz, 'Australia/Sydney');
  month_start := date_trunc('month', now() at time zone tz) at time zone tz;

  -- Slow down: no more than 20 calls in 5 minutes for anyone.
  if (select count(*) from public.usage u where u.user_id = p_user_id and u.created_at > now() - interval '5 minutes') >= 20 then
    return jsonb_build_object('ok', false, 'reason', 'slow_down');
  end if;

  if (s.status = 'trialing' and s.trial_ends_at > now()) or (s.status in ('active', 'past_due') and s.plan_id in ('hq','pro')) then
    plan := s.plan_id; allowance := s.credits_month;
    select coalesce(sum(u.credits), 0) into used_credits from public.usage u
     where u.user_id = p_user_id and u.created_at >= month_start;
    if used_credits + p_credits > allowance then
      return jsonb_build_object('ok', false, 'reason', 'out_of_credits', 'allowance', allowance, 'remaining', greatest(allowance - used_credits, 0));
    end if;
    insert into public.usage(user_id, feature, credits) values (p_user_id, p_feature, p_credits) returning id into v_id;
    return jsonb_build_object('ok', true, 'usage_id', v_id, 'plan', plan, 'remaining', allowance - used_credits - p_credits);
  end if;

  -- Free plan (or an ended trial / lapsed paid plan falls back to Free): messages a month.
  -- Chat and the end of day shutdown both count as a message here.
  select messages_month into msg_limit from public.plans where id = 'free';
  if p_feature not in ('chat', 'shutdown') then return jsonb_build_object('ok', false, 'reason', 'no_access'); end if;
  select count(*) into used_msgs from public.usage u
   where u.user_id = p_user_id and u.feature in ('chat', 'shutdown') and u.created_at >= month_start;
  if used_msgs >= coalesce(msg_limit, 0) then
    return jsonb_build_object('ok', false, 'reason', 'out_of_messages', 'limit', msg_limit, 'remaining', 0);
  end if;
  insert into public.usage(user_id, feature, credits) values (p_user_id, p_feature, 0) returning id into v_id;
  return jsonb_build_object('ok', true, 'usage_id', v_id, 'plan', 'free', 'remaining', msg_limit - used_msgs - 1);
end $$;

-- 2. due_briefs, from 20261101000012 (supersedes 009).
create or replace function public.due_briefs(p_limit integer default 25)
returns table(user_id uuid, kind text, local_date date, plan text)
language sql security definer set search_path = '' as $$
  with base as (
    select p.id as user_id, coalesce(p.timezone, 'Australia/Sydney') as tz, p.brief_time,
           s.plan_id, s.status, s.trial_ends_at
      from public.profiles p
      join public.subscriptions s on s.user_id = p.id
     where p.onboarded_at is not null
  ), local as (
    select b.*, (now() at time zone b.tz) as local_now,
           ((b.status = 'trialing' and b.trial_ends_at > now()) or (b.status in ('active', 'past_due') and b.plan_id in ('hq','pro'))) as paid
      from base b
  ), wanted as (
    select l.user_id, case when l.paid then 'morning' else 'weekly' end as kind, l.local_now::date as local_date,
           case when l.paid then l.plan_id else 'free' end as plan,
           (l.local_now >= l.local_now::date + l.brief_time and l.local_now < l.local_now::date + l.brief_time + interval '3 hours'
             and (l.paid or extract(isodow from l.local_now) = 5)) as due
      from local l
    union all
    select l.user_id, 'journal', l.local_now::date, l.plan_id,
           (l.paid and extract(isodow from l.local_now) = 7 and extract(hour from l.local_now) between 17 and 21)
      from local l
  )
  select w.user_id, w.kind, w.local_date, w.plan
    from wanted w
   where w.due
     and not exists (select 1 from public.briefs br where br.user_id = w.user_id and br.kind = w.kind and br.for_date = w.local_date)
   limit least(coalesce(p_limit, 25), 100);
$$;

-- 3. health_nudges, from 20261102000029 (supersedes 012).
create or replace function public.health_nudges()
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; h jsonb; n integer := 0; body text;
begin
  for r in
    select s.user_id from public.subscriptions s join public.profiles p on p.id = s.user_id
     where p.onboarded_at is not null
       and ((s.status = 'trialing' and s.trial_ends_at > now()) or (s.status in ('active', 'past_due') and s.plan_id in ('hq', 'pro')))
       and not exists (select 1 from public.job_runs j where j.user_id = s.user_id and j.job = 'health_check' and j.started_at > now() - interval '11 hours')
  loop
    h := public.business_health(r.user_id);
    insert into public.job_runs(user_id, job, status, summary, finished_at)
    values (r.user_id, 'health_check', 'ok', h->>'status' || ': ' || jsonb_array_length(h->'items') || ' items', now());
    if h->>'status' <> 'green' then
      body := (select string_agg(x->>'text', ', ') from (select x from jsonb_array_elements(h->'items') x limit 3) t);
      perform public.push_user(r.user_id,
        case when h->>'status' = 'red' then 'Tali: something needs you' else 'Tali: a few things to check' end,
        coalesce(body, ''), '/');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- 4. admin_stats plan counts, from 20261101000011.
create or replace function public.admin_stats() returns jsonb
language sql security definer set search_path = '' as $$
  select jsonb_build_object(
    'asOf', now(),
    'users', (select count(*) from auth.users),
    'onboarded', (select count(*) from public.profiles where onboarded_at is not null),
    'newUsers7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'plans', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (
               select case when status = 'trialing' and trial_ends_at > now() then 'trial'
                           when status in ('active', 'past_due') and plan_id in ('hq','pro') and stripe_subscription_id is not null then plan_id
                           else 'free' end as k, count(*) n
                 from public.subscriptions group by 1) x),
    'founding', (select count(*) from public.subscriptions where founding_member),
    'trialsEnding7d', (select count(*) from public.subscriptions where status = 'trialing' and trial_ends_at between now() and now() + interval '7 days'),
    'messages7d', (select count(*) from public.messages where role = 'user' and created_at > now() - interval '7 days'),
    'activeUsers7d', (select count(distinct user_id) from public.messages where role = 'user' and created_at > now() - interval '7 days'),
    'credits30d', (select coalesce(sum(credits), 0) from public.usage where created_at > now() - interval '30 days'),
    'tokensIn30d', (select coalesce(sum(tokens_in), 0) from public.usage where created_at > now() - interval '30 days'),
    'tokensOut30d', (select coalesce(sum(tokens_out), 0) from public.usage where created_at > now() - interval '30 days'),
    'byFeature30d', (select coalesce(jsonb_object_agg(feature, n), '{}'::jsonb) from (select feature, count(*) n from public.usage where created_at > now() - interval '30 days' group by feature) f),
    'briefs7d', (select count(*) from public.job_runs where job in ('morning_brief','weekly_checkin') and status = 'ok' and started_at > now() - interval '7 days'),
    'briefFailures7d', (select count(*) from public.job_runs where job in ('morning_brief','weekly_checkin') and status = 'failed' and started_at > now() - interval '7 days'),
    'journalEntries7d', (select count(*) from public.journal_entries where created_at > now() - interval '7 days'),
    'clients', (select count(*) from public.clients),
    'remindersOpen', (select count(*) from public.reminders where done_at is null),
    'draftsPending', (select count(*) from public.approvals where status = 'pending'),
    'memories', (select count(*) from brain.memories where status = 'active' and user_id is not null),
    'sharedMemories', (select count(*) from brain.memories where status = 'active' and user_id is null),
    'waitlistFounding', (select count(*) from public.founding_emails)
  );
$$;
