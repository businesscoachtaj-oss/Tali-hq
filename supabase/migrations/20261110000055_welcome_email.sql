-- Tali HQ 055: the welcome email (10 Nov 2026, asked for by Taj).
-- One hello from Tali, sent once by the tali-welcome edge function a few minutes after someone
-- confirms their email. Nothing here sends anything by itself: the cron job at the bottom only calls
-- the function, and only when someone is due.
--
-- Rules, all enforced in welcome_due():
--   * only people who confirmed their email AFTER this migration ran (welcome_settings.live_from),
--     so nobody who is already a member gets a late hello. Set include_existing to true to change that.
--   * only confirmed emails, confirmed at least 3 minutes ago and no more than 7 days ago.
--   * never twice (welcome_emails.sent_at), and no more than 3 tries if sending keeps failing.
--   * paused = true stops all sending without touching the cron job.

-- Who has been sent it. Its own server only table (RLS on, no policies) instead of columns on
-- profiles, because people can update their own profile row and these must not be theirs to clear.
create table if not exists public.welcome_emails (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sent_at timestamptz,
  tries smallint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.welcome_emails enable row level security;
revoke all on table public.welcome_emails from anon, authenticated;

-- One row of settings. Server only: RLS is on and there are no policies.
create table if not exists public.welcome_settings (
  id boolean primary key default true check (id),
  live_from timestamptz not null default now(),
  include_existing boolean not null default false,
  paused boolean not null default false
);
alter table public.welcome_settings enable row level security;
revoke all on table public.welcome_settings from anon, authenticated;
insert into public.welcome_settings (id) values (true) on conflict (id) do nothing;

-- Who is due a welcome email right now.
create or replace function public.welcome_due(p_limit integer default 20)
returns table (user_id uuid, email text, first_name text)
language sql stable security definer set search_path = '' as $$
  select p.id, u.email::text, p.first_name
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.welcome_emails w on w.user_id = p.id
    cross join public.welcome_settings s
   where not s.paused
     and w.sent_at is null
     and coalesce(w.tries, 0) < 3
     and u.email is not null
     and u.email_confirmed_at is not null
     and u.email_confirmed_at <= now() - interval '3 minutes'
     and u.email_confirmed_at >= now() - interval '7 days'
     and (s.include_existing or u.email_confirmed_at >= s.live_from)
     and u.deleted_at is null
     and coalesce(u.is_anonymous, false) = false
   order by u.email_confirmed_at
   limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

-- Claim one person. True for exactly one caller; false if someone else got there first.
create or replace function public.welcome_claim(p_user_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into public.welcome_emails (user_id, sent_at, tries) values (p_user_id, now(), 1)
  on conflict (user_id) do update
     set sent_at = now(), tries = public.welcome_emails.tries + 1, updated_at = now()
   where public.welcome_emails.sent_at is null;
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- The send failed: hand the person back so the next run can try again (tries stays counted).
create or replace function public.welcome_release(p_user_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.welcome_emails set sent_at = null, updated_at = now() where user_id = p_user_id;
$$;

revoke all on function public.welcome_due(integer), public.welcome_claim(uuid), public.welcome_release(uuid) from public, anon, authenticated;
grant execute on function public.welcome_due(integer), public.welcome_claim(uuid), public.welcome_release(uuid) to service_role;

-- Every 5 minutes, only when someone is due. Same vault key as the other Tali jobs.
select cron.unschedule('tali-welcome') where exists (select 1 from cron.job where jobname = 'tali-welcome');
select cron.schedule('tali-welcome', '*/5 * * * *', $cron$
  select net.http_post(
    url := 'https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/tali-welcome',
    headers := jsonb_build_object('Content-Type','application/json','x-tali-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'tali_brain_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000)
  where exists (select 1 from public.welcome_due(1));
$cron$);
