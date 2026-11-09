-- Tali HQ 059: the brain outside the app (10 Nov 2026, asked for by Taj).
-- Run AFTER 20261110000056_welcome_email.sql (part 2 adds to its settings table).
--
-- 1. Forward anything to her: a marker on inbound_emails for mail the owner forwarded to their own
--    Tali address.
-- 2. The day 3 email: who has had it, who is due, and an hourly job that calls tali-welcome.
-- 3. Download your brain: my_brain_export() for the signed in person.
-- 4. Day one fill: a record so "learn from my recent mail and calendar" runs once per connected
--    account per 30 days.
--
-- Nothing here sends an email or reads a mailbox by itself. Off switches are at the bottom.

-- 1. Forward anything to her ------------------------------------------------------------------------
-- null       an ordinary email (an enquiry, or synced from Gmail or Outlook)
-- remembered the owner forwarded it and Tali saved what mattered to their brain
-- waiting    the owner forwarded it, sender checked, but nothing is saved yet (no credits, or it failed)
-- unverified it says it is from the owner but the sender could not be proven, so nothing was saved
alter table public.inbound_emails add column if not exists forwarded text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'inbound_emails_forwarded_check') then
    alter table public.inbound_emails add constraint inbound_emails_forwarded_check
      check (forwarded is null or forwarded in ('remembered', 'waiting', 'unverified'));
  end if;
end $$;

-- 2. The day 3 email -------------------------------------------------------------------------------
-- Its own server only table (RLS on, no policies), the same shape as welcome_emails.
create table if not exists public.day3_emails (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sent_at timestamptz,
  skipped_at timestamptz,
  tries smallint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.day3_emails enable row level security;
revoke all on table public.day3_emails from anon, authenticated;

-- Its switches live beside the welcome email's. welcome_settings.paused stops both;
-- day3_paused stops only this one. Only people who sign up after day3_live_from ever get it.
alter table public.welcome_settings add column if not exists day3_live_from timestamptz not null default now();
alter table public.welcome_settings add column if not exists day3_paused boolean not null default false;

-- What counts as something she has learned about this person: their own, active, not private, a kind
-- that is about them (never her mistakes or lessons), and not from night school or the checker.
create or replace function public.day3_memories(p_user_id uuid, p_limit integer default 30)
returns table (content text, kind text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.content, m.kind, m.created_at
    from brain.memories m
   where m.user_id = p_user_id
     and m.status = 'active'
     and coalesce(m.private, false) = false
     and m.kind in ('person', 'preference', 'plan', 'idea', 'fact', 'event')
     and coalesce(m.source_ref, '') not like 'night_school/%'
     and coalesce(m.source_ref, '') not like 'checker/%'
   order by case m.kind when 'person' then 0 when 'preference' then 1 when 'plan' then 2 when 'idea' then 3 else 4 end,
            m.created_at desc
   limit greatest(1, least(coalesce(p_limit, 30), 60));
$$;

-- Who is due right now. memory_count is how many of the above they have; the function that sends
-- uses it to decide between sending and skipping for good.
create or replace function public.day3_due(p_limit integer default 20)
returns table (user_id uuid, email text, first_name text, memory_count integer)
language sql stable security definer set search_path = '' as $$
  select p.id, u.email::text, p.first_name,
         (select count(*)::integer from brain.memories m
           where m.user_id = p.id and m.status = 'active' and coalesce(m.private, false) = false
             and m.kind in ('person', 'preference', 'plan', 'idea', 'fact', 'event')
             and coalesce(m.source_ref, '') not like 'night_school/%'
             and coalesce(m.source_ref, '') not like 'checker/%')
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.day3_emails d on d.user_id = p.id
    cross join public.welcome_settings s
   where not s.paused and not s.day3_paused
     and d.sent_at is null and d.skipped_at is null
     and coalesce(d.tries, 0) < 3
     and u.email is not null
     and u.email_confirmed_at is not null
     and u.email_confirmed_at <= now() - interval '3 days'
     and u.email_confirmed_at >= now() - interval '6 days'
     and u.created_at >= s.day3_live_from
     and u.deleted_at is null
     and coalesce(u.is_anonymous, false) = false
     -- daytime where they live, so it does not land at 3am
     and extract(hour from (now() at time zone coalesce(p.timezone, 'Australia/Sydney'))) between 8 and 17
   order by u.email_confirmed_at
   limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

-- Claim one person. True for exactly one caller.
create or replace function public.day3_claim(p_user_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into public.day3_emails (user_id, sent_at, tries) values (p_user_id, now(), 1)
  on conflict (user_id) do update
     set sent_at = now(), tries = public.day3_emails.tries + 1, updated_at = now()
   where public.day3_emails.sent_at is null and public.day3_emails.skipped_at is null;
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- The send failed: hand the person back so the next run can try again (tries stays counted).
create or replace function public.day3_release(p_user_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.day3_emails set sent_at = null, updated_at = now() where user_id = p_user_id;
$$;

-- Not enough to show on day 3: never send this person the day 3 email.
create or replace function public.day3_skip(p_user_id uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.day3_emails (user_id, skipped_at) values (p_user_id, now())
  on conflict (user_id) do update set skipped_at = now(), updated_at = now()
   where public.day3_emails.sent_at is null;
$$;

revoke all on function public.day3_memories(uuid, integer), public.day3_due(integer), public.day3_claim(uuid),
  public.day3_release(uuid), public.day3_skip(uuid) from public, anon, authenticated;
grant execute on function public.day3_memories(uuid, integer), public.day3_due(integer), public.day3_claim(uuid),
  public.day3_release(uuid), public.day3_skip(uuid) to service_role;

-- 3. Download your brain ---------------------------------------------------------------------------
-- Everything she holds about the signed in person, in plain words. Their own active memories only:
-- nothing from the shared brain, no search data, no internal ids. Newest first, capped at 5,000.
create or replace function public.my_brain_export()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_total integer;
  v_cap constant integer := 5000;
  v_out jsonb;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select count(*)::integer into v_total from brain.memories m where m.user_id = v_uid and m.status = 'active';
  with mine as (
    select m.content, m.kind, m.created_at, m.source, m.source_ref, coalesce(m.private, false) as private,
           case m.kind
             when 'person' then 'Your people'
             when 'preference' then 'How you like things'
             when 'rule' then 'How you like things'
             when 'idea' then 'Plans and ideas'
             when 'plan' then 'Plans and ideas'
             when 'lesson' then 'What she has learned'
             when 'mistake' then 'What she has learned'
             else 'Your life and work'
           end as part
      from brain.memories m
     where m.user_id = v_uid and m.status = 'active'
     order by m.created_at desc
     limit v_cap
  )
  select jsonb_build_object(
    'exported_at', now(),
    'person', jsonb_build_object('first_name', (select p.first_name from public.profiles p where p.id = v_uid)),
    'memories', coalesce((select jsonb_agg(jsonb_build_object(
        'text', x.content,
        'kind', x.kind,
        'part', x.part,
        'saved_at', x.created_at,
        'source', case
            when x.source_ref like 'forwarded/%' then 'An email you forwarded'
            when x.source_ref like 'day_one/%/google' then 'Your Google mail and calendar'
            when x.source_ref like 'day_one/%/microsoft' then 'Your Outlook mail and calendar'
            when x.source_ref like 'day_one/%' then 'Your recent mail and calendar'
            when x.source_ref like 'night_school/%' then 'Night school'
            when x.source_ref like 'checker/%' then 'Her nightly check of her own work'
            when x.source = 'tali hq chat' then 'Your chats'
            else coalesce(x.source, 'Your chats') end,
        'private', x.private) order by x.created_at desc) from mine x), '[]'::jsonb),
    'counts', jsonb_build_object(
        'total', v_total,
        'included', (select count(*) from mine),
        'by_part', coalesce((select jsonb_object_agg(t.part, t.n) from (select part, count(*) as n from mine group by part) t), '{}'::jsonb),
        'by_kind', coalesce((select jsonb_object_agg(t.kind, t.n) from (select kind, count(*) as n from mine group by kind) t), '{}'::jsonb)),
    'truncated', v_total > v_cap
  ) into v_out;
  return v_out;
end $$;
revoke all on function public.my_brain_export() from public, anon;
grant execute on function public.my_brain_export() to authenticated;

-- 4. Day one fill ----------------------------------------------------------------------------------
-- One row per connected account. Server only.
create table if not exists public.day_one_runs (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  account_email text not null,
  ran_at timestamptz,
  learned integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider, account_email)
);
alter table public.day_one_runs enable row level security;
revoke all on table public.day_one_runs from anon, authenticated;

-- Claim a run. True when this account has not been learned from in the last 30 days, and only for
-- one caller at a time.
create or replace function public.day_one_claim(p_user_id uuid, p_provider text, p_account_email text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into public.day_one_runs (user_id, provider, account_email, ran_at)
  values (p_user_id, p_provider, lower(p_account_email), now())
  on conflict (user_id, provider, account_email) do update
     set ran_at = now(), updated_at = now()
   where public.day_one_runs.ran_at is null or public.day_one_runs.ran_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- It failed before anything was saved: let them try again.
create or replace function public.day_one_release(p_user_id uuid, p_provider text, p_account_email text) returns void
language sql security definer set search_path = '' as $$
  update public.day_one_runs set ran_at = null, updated_at = now()
   where user_id = p_user_id and provider = p_provider and account_email = lower(p_account_email);
$$;

-- It worked: note how much she learned.
create or replace function public.day_one_done(p_user_id uuid, p_provider text, p_account_email text, p_learned integer) returns void
language sql security definer set search_path = '' as $$
  update public.day_one_runs set learned = greatest(coalesce(p_learned, 0), 0), updated_at = now()
   where user_id = p_user_id and provider = p_provider and account_email = lower(p_account_email);
$$;

-- They disconnected that account: forget what she learned from it (the app tells them she has), and
-- clear the 30 day record so connecting again starts fresh. Only ever this one person's rows.
create or replace function public.day_one_forget(p_user_id uuid, p_provider text) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if p_user_id is null or p_provider not in ('google', 'microsoft') then return 0; end if;
  delete from brain.memories m
   where m.user_id = p_user_id and m.source_ref like 'day_one/%/' || p_provider;
  get diagnostics n = row_count;
  delete from public.day_one_runs r where r.user_id = p_user_id and r.provider = p_provider;
  return n;
end $$;

revoke all on function public.day_one_claim(uuid, text, text), public.day_one_release(uuid, text, text),
  public.day_one_done(uuid, text, text, integer), public.day_one_forget(uuid, text) from public, anon, authenticated;
grant execute on function public.day_one_claim(uuid, text, text), public.day_one_release(uuid, text, text),
  public.day_one_done(uuid, text, text, integer), public.day_one_forget(uuid, text) to service_role;

-- The day 3 job: once an hour, only when someone is due. Same vault key as the other Tali jobs.
-- To stop it: update public.welcome_settings set day3_paused = true;   (or cron.unschedule('tali-day3'))
select cron.unschedule('tali-day3') where exists (select 1 from cron.job where jobname = 'tali-day3');
select cron.schedule('tali-day3', '12 * * * *', $cron$
  select net.http_post(
    url := 'https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/tali-welcome',
    headers := jsonb_build_object('Content-Type','application/json','x-tali-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'tali_brain_key')),
    body := '{"kind":"day3"}'::jsonb,
    timeout_milliseconds := 60000)
  where exists (select 1 from public.day3_due(1));
$cron$);
