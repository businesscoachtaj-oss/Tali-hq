-- Tali HQ 008: what the tali-chat edge function needs (all service role only).
-- 1. chat_try_consume / chat_finish / chat_refund: reserve credits before calling Claude.
-- 2. tali_context: the profile, memories and journal Tali reads before she answers.
-- 3. brain_remember_for: lets the function save what Tali learnt into that user's private brain.

-- Who can use what this month. Trial or paid HQ/Pro = monthly credits; Free = messages a month.
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

  if (s.status = 'trialing' and s.trial_ends_at > now()) or (s.status = 'active' and s.plan_id in ('hq','pro')) then
    plan := s.plan_id; allowance := s.credits_month;
    select coalesce(sum(u.credits), 0) into used_credits from public.usage u
     where u.user_id = p_user_id and u.created_at >= month_start;
    if used_credits + p_credits > allowance then
      return jsonb_build_object('ok', false, 'reason', 'out_of_credits', 'allowance', allowance, 'remaining', greatest(allowance - used_credits, 0));
    end if;
    insert into public.usage(user_id, feature, credits) values (p_user_id, p_feature, p_credits) returning id into v_id;
    return jsonb_build_object('ok', true, 'usage_id', v_id, 'plan', plan, 'remaining', allowance - used_credits - p_credits);
  end if;

  -- Free plan (or an ended trial / lapsed paid plan falls back to Free): messages a month, chat only.
  select messages_month into msg_limit from public.plans where id = 'free';
  if p_feature <> 'chat' then return jsonb_build_object('ok', false, 'reason', 'no_access'); end if;
  select count(*) into used_msgs from public.usage u
   where u.user_id = p_user_id and u.feature = 'chat' and u.created_at >= month_start;
  if used_msgs >= coalesce(msg_limit, 0) then
    return jsonb_build_object('ok', false, 'reason', 'out_of_messages', 'limit', msg_limit, 'remaining', 0);
  end if;
  insert into public.usage(user_id, feature, credits) values (p_user_id, p_feature, 0) returning id into v_id;
  return jsonb_build_object('ok', true, 'usage_id', v_id, 'plan', 'free', 'remaining', msg_limit - used_msgs - 1);
end $$;

create or replace function public.chat_finish(p_usage_id bigint, p_model text, p_tokens_in integer, p_tokens_out integer)
returns void language sql security definer set search_path = '' as $$
  update public.usage set model = p_model, tokens_in = p_tokens_in, tokens_out = p_tokens_out where id = p_usage_id;
$$;

create or replace function public.chat_refund(p_usage_id bigint)
returns void language sql security definer set search_path = '' as $$
  delete from public.usage where id = p_usage_id;
$$;

-- Everything Tali reads before answering one user.
create or replace function public.tali_context(p_user_id uuid, p_query text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  select jsonb_build_object(
    'profile', (select jsonb_build_object('first_name', pr.first_name, 'business_name', pr.business_name,
                  'business_type', pr.business_type, 'about_me', pr.about_me, 'timezone', pr.timezone)
                  from public.profiles pr where pr.id = p_user_id),
    'memories', coalesce((select jsonb_agg(jsonb_build_object('kind', r.kind, 'content', r.content, 'about', r.about))
                  from brain.recall(p_user_id, coalesce(nullif(trim(p_query), ''), 'business'), 10, null, true) r), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('kind', m.kind, 'content', m.content) order by m.created_at desc)
                  from (select kind, content, created_at from brain.memories
                         where user_id = p_user_id and status = 'active' and importance >= 4
                         order by created_at desc limit 8) m), '[]'::jsonb),
    'journal', coalesce((select jsonb_agg(jsonb_build_object('when', j.created_at::date, 'title', j.title, 'body', left(j.body, 600)) order by j.created_at desc)
                  from (select title, body, created_at from public.journal_entries
                         where user_id = p_user_id and private_to_tali = false
                         order by created_at desc limit 5) j), '[]'::jsonb)
  ) into v;
  return v;
end $$;

-- Save a memory to one user's private brain (never the shared brain from here).
create or replace function public.brain_remember_for(p_user_id uuid, p_kind text, p_content text, p_about text[] default '{}', p_source_ref text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if p_user_id is null then raise exception 'user id required'; end if;
  if p_kind not in ('event','fact','lesson','mistake','preference','person','idea') then raise exception 'bad kind %', p_kind; end if;
  return brain.remember(p_user_id, p_kind, p_content, 'tali hq chat', coalesce(p_about, '{}'), array['chat'], 3::smallint, 0.8::real, p_source_ref);
end $$;

revoke all on function public.chat_try_consume(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.chat_finish(bigint, text, integer, integer) from public, anon, authenticated;
revoke all on function public.chat_refund(bigint) from public, anon, authenticated;
revoke all on function public.tali_context(uuid, text) from public, anon, authenticated;
revoke all on function public.brain_remember_for(uuid, text, text, text[], text) from public, anon, authenticated;
grant execute on function public.chat_try_consume(uuid, text, integer), public.chat_finish(bigint, text, integer, integer),
  public.chat_refund(bigint), public.tali_context(uuid, text), public.brain_remember_for(uuid, text, text, text[], text) to service_role;

-- Realtime for the chat screen (RLS still applies to what each user receives).
alter publication supabase_realtime add table public.messages;
