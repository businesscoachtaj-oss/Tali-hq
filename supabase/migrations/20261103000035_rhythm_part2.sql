-- Tali HQ, 3 Nov 2026: owner's rhythm build, part 2 (runs after 034). Idempotent.
-- Sections: A owner (money summary, people memories), B rhythm (profile grants, shutdown on Free, weekly review context),
-- C sense (audio in chat-uploads, voice seconds; voice notes are parked in the app until an OpenAI key exists).

-- ===== A. owner =====
-- Tali HQ, 3 Nov 2026: the owner's view. Money picture, people memory, decision log.
-- Builds on 20261103000034 (profiles.monthly_costs, cash_on_hand, money_updated_at; public.decisions).
-- Everything here is read by the signed in owner about their own rows. HQ never runs billing.
-- Idempotent: safe to run twice.

-- 1. Money summary from the app's own invoices, for the Money screen and the Today card.
--    Security invoker, so RLS on invoices and profiles scopes it to the caller's rows.
--    Stripe cash in (when Stripe is connected) comes from the stripe-invoices function, action 'money'.
create or replace function public.my_money_summary() returns jsonb
language sql stable security invoker set search_path = '' as $$
  with me as (
    select p.monthly_costs, p.cash_on_hand, p.money_updated_at,
           coalesce(p.timezone, 'Australia/Sydney') as tz
      from public.profiles p where p.id = (select auth.uid())
  ),
  today as (
    select (now() at time zone (select tz from me))::date as d
  ),
  inv as (
    select i.* from public.invoices i where i.user_id = (select auth.uid())
  )
  select jsonb_build_object(
    'paid_this_month', (select coalesce(sum(total), 0) from inv
                          where status = 'paid'
                            and (coalesce(paid_at, created_at) at time zone (select tz from me))::date >= date_trunc('month', (select d from today))::date),
    'owed', (select coalesce(sum(total), 0) from inv where status = 'sent'),
    'overdue', (select coalesce(sum(total), 0) from inv where status = 'sent' and due_date < (select d from today)),
    'overdue_invoices', (select coalesce(jsonb_agg(jsonb_build_object(
                            'id', id, 'number', number, 'client_name', client_name, 'client_id', client_id,
                            'total', total, 'due_date', due_date, 'stripe_url', stripe_url) order by due_date), '[]'::jsonb)
                           from inv where status = 'sent' and due_date < (select d from today)),
    'monthly_costs', (select monthly_costs from me),
    'cash_on_hand', (select cash_on_hand from me),
    'money_updated_at', (select money_updated_at from me),
    'month_start', date_trunc('month', (select d from today))::date
  );
$$;
revoke all on function public.my_money_summary() from public, anon;
grant execute on function public.my_money_summary() to authenticated;

-- 2. What Tali knows about one person. Name match on brain.memories.about (case insensitive),
--    with a fallback to the memory text, scoped to the caller. Same shape as my_memories().
create or replace function public.my_memories_about(p_name text)
returns table(id uuid, kind text, content text, about text[], source text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.id, m.kind, m.content, m.about, m.source, m.created_at
    from brain.memories m
   where m.user_id = (select auth.uid())
     and m.status = 'active'
     and length(trim(coalesce(p_name, ''))) >= 2
     and (
       exists (select 1 from unnest(m.about) a where lower(a) like '%' || lower(trim(p_name)) || '%')
       or m.content ilike '%' || trim(p_name) || '%'
     )
   order by m.importance desc, m.created_at desc
   limit 200;
$$;
revoke all on function public.my_memories_about(text) from public, anon;
grant execute on function public.my_memories_about(text) to authenticated;

-- ===== B. rhythm =====
-- Tali HQ, 3 Nov 2026 (builder "rhythm"): what the shutdown, weekly review and goals screens need
-- on top of migration 034. Idempotent.

-- 1. The app saves the shutdown and review settings straight to the profile (Settings screen).
--    Profile updates are column-granted (migration 002), so the new columns need a grant too.
grant update (shutdown_time, shutdown_push, review_day, review_time) on public.profiles to authenticated;

-- 2. The end of day shutdown is on Free too, counted like a message there (1 credit on trial and paid).
--    chat_try_consume only let 'chat' through on Free; 'shutdown' now goes through the same monthly count.
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

-- 3. The weekly review reads the week's numbers in one call (service role only): reminders done and
--    missed, follow-ups, clients added or gone quiet, invoices paid and overdue, journal entries,
--    shutdown moods, goals, and last week's commitments. p_from and p_to are the local dates of the week.
create or replace function public.tali_review_context(p_user_id uuid, p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = public as $$
  with tz as (select coalesce((select timezone from public.profiles where id = p_user_id), 'Australia/Sydney') as z),
  bounds as (select (p_from::timestamp at time zone (select z from tz)) as t0, ((p_to + 1)::timestamp at time zone (select z from tz)) as t1)
  select jsonb_build_object(
    'week', jsonb_build_object('from', p_from, 'to', p_to),
    'reminders_done', (select coalesce(jsonb_agg(r.text order by r.done_at), '[]'::jsonb) from public.reminders r, bounds b
                        where r.user_id = p_user_id and r.done_at >= b.t0 and r.done_at < b.t1),
    'reminders_missed', (select coalesce(jsonb_agg(r.text order by r.due_at), '[]'::jsonb) from public.reminders r, bounds b
                          where r.user_id = p_user_id and r.done_at is null and r.due_at >= b.t0 and r.due_at < b.t1),
    'follow_ups_open', (select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'due', c.next_follow_up) order by c.next_follow_up), '[]'::jsonb)
                         from public.clients c where c.user_id = p_user_id and c.next_follow_up is not null and c.next_follow_up <= p_to and c.status not in ('lost', 'past')),
    'clients_added', (select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'kind', c.kind, 'status', c.status) order by c.created_at), '[]'::jsonb)
                       from public.clients c, bounds b where c.user_id = p_user_id and c.created_at >= b.t0 and c.created_at < b.t1),
    'clients_quiet', (select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'last_contact', c.last_contact_at) order by c.last_contact_at nulls first), '[]'::jsonb)
                       from public.clients c where c.user_id = p_user_id and c.kind = 'client'
                         and (c.status = 'quiet' or (c.status = 'active' and (c.last_contact_at is null or c.last_contact_at < p_to - 14)))),
    'clients_lost', (select coalesce(jsonb_agg(c.name), '[]'::jsonb) from public.clients c, bounds b
                      where c.user_id = p_user_id and c.status in ('lost', 'past') and c.updated_at >= b.t0 and c.updated_at < b.t1),
    'invoices_paid', (select coalesce(jsonb_agg(jsonb_build_object('client', i.client_name, 'total', i.total) order by i.paid_at), '[]'::jsonb)
                       from public.invoices i, bounds b where i.user_id = p_user_id and i.status = 'paid' and i.paid_at >= b.t0 and i.paid_at < b.t1),
    'invoices_sent', (select coalesce(jsonb_agg(jsonb_build_object('client', i.client_name, 'total', i.total) order by i.sent_at), '[]'::jsonb)
                       from public.invoices i, bounds b where i.user_id = p_user_id and i.sent_at >= b.t0 and i.sent_at < b.t1),
    'invoices_overdue', (select coalesce(jsonb_agg(jsonb_build_object('client', i.client_name, 'total', i.total, 'due', i.due_date) order by i.due_date), '[]'::jsonb)
                          from public.invoices i where i.user_id = p_user_id and i.status = 'sent' and i.due_date < p_to),
    'journal', (select coalesce(jsonb_agg(jsonb_build_object('on', j.created_at, 'title', j.title, 'mood', j.mood, 'body', left(j.body, 600)) order by j.created_at), '[]'::jsonb)
                 from public.journal_entries j, bounds b where j.user_id = p_user_id and j.private_to_tali = false and j.created_at >= b.t0 and j.created_at < b.t1),
    'shutdowns', (select coalesce(jsonb_agg(jsonb_build_object('date', s.local_date, 'mood', s.mood, 'went_well', s.went_well, 'note', s.note) order by s.local_date), '[]'::jsonb)
                   from public.shutdowns s where s.user_id = p_user_id and s.local_date between p_from and p_to),
    'commitments', (select coalesce(jsonb_agg(jsonb_build_object('text', c.text, 'done', c.done_at is not null) order by c.created_at), '[]'::jsonb)
                     from public.commitments c where c.user_id = p_user_id and c.week_start = p_from),
    'goals', (select coalesce(jsonb_agg(jsonb_build_object('title', g.title, 'target', g.target_number, 'current', g.current_number, 'unit', g.unit, 'due', g.due_date, 'status', g.status) order by g.due_date nulls last), '[]'::jsonb)
               from public.goals g where g.user_id = p_user_id and (g.status = 'active' or g.updated_at >= (select t0 from bounds))),
    'sessions_done', (select count(*) from public.workout_logs w where w.user_id = p_user_id and w.local_date between p_from and p_to),
    'money', (select jsonb_build_object('monthly_costs', p.monthly_costs, 'cash_on_hand', p.cash_on_hand, 'money_updated_at', p.money_updated_at) from public.profiles p where p.id = p_user_id)
  );
$$;
revoke all on function public.tali_review_context(uuid, date, date) from public, anon, authenticated;
grant execute on function public.tali_review_context(uuid, date, date) to service_role;

-- ===== C. sense =====
-- Tali HQ, 3 Nov 2026 (builder "sense"): voice notes and patterns.
-- 1. The private chat-uploads bucket also takes short audio clips (voice notes go to <uid>/voice/<id>.<ext>,
--    the storage policies from migration 033 key on the first folder so nothing new is needed there).
-- 2. my_voice_seconds(): the app reads how many seconds of voice notes this month have used, so the Talk
--    composer can show HQ users what is left (the function tali-transcribe does the real gate with
--    voice_seconds_this_month, service role only).
-- Idempotent.

update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
                                  'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/x-m4a', 'audio/m4a', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/3gpp']
 where id = 'chat-uploads';

create or replace function public.my_voice_seconds() returns integer
language sql stable security invoker set search_path = public as $$
  select coalesce(sum(seconds), 0)::integer from public.usage
   where user_id = (select auth.uid()) and feature = 'voice_note'
     and created_at >= date_trunc('month', now());
$$;
revoke all on function public.my_voice_seconds() from public, anon;
grant execute on function public.my_voice_seconds() to authenticated;
