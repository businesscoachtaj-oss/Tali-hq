-- Tali HQ, 5 Nov 2026: a plan with an overdue payment (Stripe past_due) is a grace state while Stripe
-- retries the card. The app (lib/plan.ts isPaid) already treats it as paid, but chat_try_consume sent
-- it to the Free message limit, so chat was refused while the app showed paid features.
-- Same body as migration 20261103000035 (section B.2); only the paid status check changes.
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
