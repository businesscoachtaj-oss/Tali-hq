-- Tali HQ, 6 Nov 2026 (asked for by Taj): Tali grows, and Top up.
--   1. Top ups: one-off Stripe payments for extra credits and images. Extras never expire and are used
--      after the month's allowance, on any paid plan or trial. chat_try_consume, my_credits and the
--      image allowance learn about them.
--   2. Rules Tali suggests from the weekly review, for a yes or no.
--   3. One idea from each night school class, shown on Today.
--   4. A receipts folder: a private storage bucket and a table.
-- Idempotent.

-- 1. Top ups ---------------------------------------------------------------------------------------
create table if not exists public.topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pack text not null,
  credits integer not null default 0 check (credits >= 0),
  images integer not null default 0 check (images >= 0),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'aud',
  stripe_session_id text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists topups_user_idx on public.topups (user_id, created_at desc);
alter table public.topups enable row level security;
drop policy if exists "own topups read" on public.topups;
create policy "own topups read" on public.topups for select to authenticated using (user_id = (select auth.uid()));

-- How much of a charge came out of the extras (the rest came out of the month).
alter table public.usage add column if not exists extra_credits integer not null default 0;
alter table public.usage drop constraint if exists usage_extra_credits_check;
alter table public.usage add constraint usage_extra_credits_check check (extra_credits >= 0 and extra_credits <= credits);

-- Extras left (service role). Images taken from extras are usage rows with feature 'image_extra'.
create or replace function public.extras_for(p_user_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'credits', greatest(coalesce((select sum(t.credits) from public.topups t where t.user_id = p_user_id), 0)
                      - coalesce((select sum(u.extra_credits) from public.usage u where u.user_id = p_user_id), 0), 0),
    'images', greatest(coalesce((select sum(t.images) from public.topups t where t.user_id = p_user_id), 0)
                     - (select count(*) from public.usage u where u.user_id = p_user_id and u.feature = 'image_extra'), 0));
$$;
revoke all on function public.extras_for(uuid) from public, anon, authenticated;
grant execute on function public.extras_for(uuid) to service_role;

-- Records a paid top up once per Stripe Checkout session (service role, from stripe-webhook).
create or replace function public.add_topup(p_user_id uuid, p_pack text, p_credits integer, p_images integer,
  p_amount_cents integer, p_currency text, p_session text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into public.topups (user_id, pack, credits, images, amount_cents, currency, stripe_session_id)
  values (p_user_id, p_pack, greatest(coalesce(p_credits, 0), 0), greatest(coalesce(p_images, 0), 0),
          greatest(coalesce(p_amount_cents, 0), 0), coalesce(p_currency, 'aud'), p_session)
  on conflict (stripe_session_id) do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.add_topup(uuid, text, integer, integer, integer, text, text) from public, anon, authenticated;
grant execute on function public.add_topup(uuid, text, integer, integer, integer, text, text) to service_role;

-- chat_try_consume, from 20261105400000 with extras: the month's credits first, then the extras.
create or replace function public.chat_try_consume(p_user_id uuid, p_feature text, p_credits integer default 1)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s record; tz text; month_start timestamptz; used_credits integer; used_msgs integer;
  allowance integer; msg_limit integer; plan text; v_id bigint;
  month_left integer; extra_left integer; from_month integer; from_extra integer;
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
    perform pg_advisory_xact_lock(hashtextextended('credits:' || p_user_id::text, 0));
    select coalesce(sum(u.credits - u.extra_credits), 0) into used_credits from public.usage u
     where u.user_id = p_user_id and u.created_at >= month_start;
    month_left := greatest(allowance - used_credits, 0);
    extra_left := (public.extras_for(p_user_id)->>'credits')::int;
    from_month := least(p_credits, month_left);
    from_extra := p_credits - from_month;
    if from_extra > extra_left then
      return jsonb_build_object('ok', false, 'reason', 'out_of_credits', 'allowance', allowance,
                                'remaining', month_left + extra_left, 'extra', extra_left);
    end if;
    insert into public.usage(user_id, feature, credits, extra_credits) values (p_user_id, p_feature, p_credits, from_extra) returning id into v_id;
    return jsonb_build_object('ok', true, 'usage_id', v_id, 'plan', plan,
                              'remaining', month_left - from_month + extra_left - from_extra, 'extra', extra_left - from_extra);
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

-- Image allowance, from 045 with extras. 'extra' is extra images left; they count only on a plan that
-- has images at all.
create or replace function public.image_allowance_for(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s record; tz text; month_start timestamptz; allowance integer := 0; used integer; extra integer;
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
  extra := case when allowance > 0 then (public.extras_for(p_user_id)->>'images')::int else 0 end;
  return jsonb_build_object('allowance', allowance, 'used', used, 'remaining', greatest(allowance - used, 0), 'extra', extra,
                            'trial', coalesce(s.status = 'trialing' and s.trial_ends_at <= now() + interval '30 days', false));
end $$;
revoke all on function public.image_allowance_for(uuid) from public, anon, authenticated;
grant execute on function public.image_allowance_for(uuid) to service_role;

-- Reserve one image, from 045: the month's first, then an extra one.
create or replace function public.image_try_consume(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a jsonb; v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('image:' || p_user_id::text, 0));
  a := public.image_allowance_for(p_user_id);
  if (a->>'allowance')::int = 0 then return jsonb_build_object('ok', false, 'reason', 'no_access') || a; end if;
  if (select count(*) from public.usage u where u.user_id = p_user_id and u.feature in ('image', 'image_extra') and u.created_at > now() - interval '5 minutes') >= 4 then
    return jsonb_build_object('ok', false, 'reason', 'slow_down') || a;
  end if;
  if (a->>'remaining')::int > 0 then
    insert into public.usage(user_id, feature, credits) values (p_user_id, 'image', 0) returning id into v_id;
    return jsonb_build_object('ok', true, 'usage_id', v_id, 'remaining', (a->>'remaining')::int - 1 + (a->>'extra')::int, 'allowance', (a->>'allowance')::int);
  end if;
  if (a->>'extra')::int > 0 then
    insert into public.usage(user_id, feature, credits) values (p_user_id, 'image_extra', 0) returning id into v_id;
    return jsonb_build_object('ok', true, 'usage_id', v_id, 'remaining', (a->>'extra')::int - 1, 'allowance', (a->>'allowance')::int);
  end if;
  return jsonb_build_object('ok', false, 'reason', 'out_of_images') || a;
end $$;
revoke all on function public.image_try_consume(uuid) from public, anon, authenticated;
grant execute on function public.image_try_consume(uuid) to service_role;

-- my_credits runs as the caller, who can't call extras_for, so this wraps it for the signed-in person.
create or replace function public.my_extra_credits() returns integer
language sql stable security definer set search_path = '' as $$
  select case when (select auth.uid()) is null then 0 else (public.extras_for((select auth.uid()))->>'credits')::int end;
$$;
revoke all on function public.my_extra_credits() from public, anon;
grant execute on function public.my_extra_credits() to authenticated;

-- The credit line, from 048: 'used' is the month's own credits, 'extra' is extra credits left.
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
    'used', coalesce((select sum(u.credits - u.extra_credits) from public.usage u
                       where u.user_id = (select auth.uid())
                         and u.created_at >= (date_trunc('month', now() at time zone s.tz) at time zone s.tz)), 0),
    'extra', public.my_extra_credits(),
    'images', public.my_images(),
    'searches', public.my_searches(),
    'deep', public.my_deep())
  from s;
$$;

revoke all on function public.my_credits() from public, anon;
grant execute on function public.my_credits() to authenticated;

-- 2. Rules Tali suggests ---------------------------------------------------------------------------
create table if not exists public.rule_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('habit', 'automation')),
  text text not null,
  why text not null default '',
  source text not null default 'weekly_review' check (source in ('weekly_review', 'night_school', 'chats')),
  rule_type text check (rule_type in ('quiet_client', 'overdue_invoice', 'weekly_reminder', 'new_lead')),
  params jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'yes', 'no')),
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
create index if not exists rule_suggestions_user_idx on public.rule_suggestions (user_id, status, created_at desc);
alter table public.rule_suggestions enable row level security;
drop policy if exists "own rule suggestions read" on public.rule_suggestions;
create policy "own rule suggestions read" on public.rule_suggestions for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.my_rule_suggestions() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'text', r.text, 'why', r.why, 'from', r.source,
                                               'rule_type', r.rule_type, 'params', r.params) order by r.created_at desc), '[]'::jsonb)
    from (select * from public.rule_suggestions
           where user_id = (select auth.uid()) and status = 'pending'
           order by created_at desc limit 5) r;
$$;
revoke all on function public.my_rule_suggestions() from public, anon;
grant execute on function public.my_rule_suggestions() to authenticated;

-- Yes: a habit goes into her brain as a preference; an automation turns that rule on with these settings.
create or replace function public.answer_rule_suggestion(p_id uuid, p_yes boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); r record;
begin
  select * into r from public.rule_suggestions where id = p_id and user_id = v_uid and status = 'pending';
  if not found then return false; end if;
  if p_yes then
    if r.kind = 'habit' then
      perform public.brain_remember_for(v_uid, 'preference', r.text, '{}'::text[], 'rule_suggestion:' || r.id::text, false);
    elsif r.rule_type is not null then
      if exists (select 1 from public.rules where user_id = v_uid and type = r.rule_type) then
        update public.rules set params = r.params, enabled = true where user_id = v_uid and type = r.rule_type;
      else
        insert into public.rules (user_id, type, params, enabled) values (v_uid, r.rule_type, r.params, true);
      end if;
    end if;
  end if;
  update public.rule_suggestions set status = case when p_yes then 'yes' else 'no' end, answered_at = now() where id = p_id;
  return true;
end $$;
revoke all on function public.answer_rule_suggestion(uuid, boolean) from public, anon;
grant execute on function public.answer_rule_suggestion(uuid, boolean) to authenticated;

-- 3. An idea from night school ---------------------------------------------------------------------
alter table public.night_school_notes add column if not exists idea text;
alter table public.night_school_notes add column if not exists idea_why text;
alter table public.night_school_notes add column if not exists idea_answer text;
alter table public.night_school_notes add column if not exists idea_answered_at timestamptz;
alter table public.night_school_notes drop constraint if exists night_school_notes_idea_answer_check;
alter table public.night_school_notes add constraint night_school_notes_idea_answer_check check (idea_answer in ('try', 'skip'));

-- The newest unanswered idea from the last three days.
create or replace function public.my_night_idea() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('id', n.id, 'topic', n.topic, 'idea', n.idea, 'why', coalesce(n.idea_why, ''), 'for_date', n.for_date)
    from public.night_school_notes n
   where n.user_id = (select auth.uid()) and n.idea is not null and n.idea_answer is null
     and n.created_at > now() - interval '3 days'
   order by n.for_date desc limit 1;
$$;
revoke all on function public.my_night_idea() from public, anon;
grant execute on function public.my_night_idea() to authenticated;

-- 'try' also goes into her brain as an idea you want to try, so it comes up in chats and the weekly review.
create or replace function public.answer_night_idea(p_id uuid, p_answer text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); n record;
begin
  if p_answer not in ('try', 'skip') then return false; end if;
  select * into n from public.night_school_notes where id = p_id and user_id = v_uid and idea is not null and idea_answer is null;
  if not found then return false; end if;
  update public.night_school_notes set idea_answer = p_answer, idea_answered_at = now() where id = p_id;
  if p_answer = 'try' then
    perform public.brain_remember_for(v_uid, 'idea', 'Wants to try (from night school on ' || n.topic || '): ' || n.idea,
                                      '{}'::text[], 'night_idea:' || n.id::text, false);
  end if;
  return true;
end $$;
revoke all on function public.answer_night_idea(uuid, text) from public, anon;
grant execute on function public.answer_night_idea(uuid, text) to authenticated;

-- 4. Receipts -------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- The tax time zips, made by the tali-receipts function (service role) under <user id>/. Read only for the app.
insert into storage.buckets (id, name, public, allowed_mime_types)
values ('receipt-exports', 'receipt-exports', false, array['application/zip'])
on conflict (id) do update set public = false, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "receipt exports read own" on storage.objects;
create policy "receipt exports read own" on storage.objects for select to authenticated
  using (bucket_id = 'receipt-exports' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "receipts read own" on storage.objects;
create policy "receipts read own" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "receipts write own" on storage.objects;
create policy "receipts write own" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "receipts delete own" on storage.objects;
create policy "receipts delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  vendor text not null check (length(vendor) between 1 and 120),
  date date not null,
  amount numeric(12,2) not null check (amount >= 0),
  gst numeric(12,2) not null default 0 check (gst >= 0),
  category text not null default 'Other' check (category in ('Supplies', 'Software', 'Travel', 'Equipment', 'Marketing', 'Other')),
  file_kind text not null check (file_kind in ('image', 'pdf')),
  path text not null,
  created_at timestamptz not null default now()
);
create index if not exists receipts_user_date_idx on public.receipts (user_id, date desc);
alter table public.receipts enable row level security;
drop policy if exists "own receipts all" on public.receipts;
create policy "own receipts all" on public.receipts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and (storage.foldername(path))[1] = (select auth.uid())::text);
