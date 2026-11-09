-- The checker (10 Nov 2026, asked for by Taj): each night Tali looks back over her own replies and
-- turns anything she got wrong into a lesson in that same person's brain. Runs for everyone who
-- chatted, costs them nothing, and only ever reads and writes the one user's own rows.
--
-- 1. checker_state: where each person's check is up to. Server only.
-- 2. checker_findings: what she found, so she never records the same mistake twice. Server only.
-- 3. due_checker(): who is due (chatted since their last check, and it is the small hours for them).
-- 4. A cron job every 30 minutes that calls the tali-checker function only when someone is due.
-- To switch it off: select cron.unschedule('tali-checker');

create table if not exists public.checker_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  checked_to timestamptz not null default now(),
  last_run_at timestamptz,
  last_found integer not null default 0
);
alter table public.checker_state enable row level security;
revoke all on table public.checker_state from anon, authenticated;

create table if not exists public.checker_findings (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  mistake text not null,
  lesson text not null,
  evidence text,
  memory_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists checker_findings_user_idx on public.checker_findings (user_id, created_at desc);
alter table public.checker_findings enable row level security;
revoke all on table public.checker_findings from anon, authenticated;

create or replace function public.due_checker(p_limit integer default 5)
returns table(user_id uuid, since timestamptz)
language sql security definer set search_path = '' as $$
  select p.id,
         greatest(coalesce(s.checked_to, now() - interval '1 day'), now() - interval '2 days')
    from public.profiles p
    left join public.checker_state s on s.user_id = p.id
   where p.onboarded_at is not null
     -- once a night at most, in the small hours where they live
     and (s.last_run_at is null or s.last_run_at < now() - interval '20 hours')
     and extract(hour from (now() at time zone coalesce(p.timezone, 'Australia/Sydney'))) between 1 and 4
     -- a mistake only shows when they came back at her, so it needs at least two of their messages
     and (select count(*) from public.messages m
           where m.user_id = p.id and m.role = 'user'
             and m.created_at > greatest(coalesce(s.checked_to, now() - interval '1 day'), now() - interval '2 days')) >= 2
   limit least(coalesce(p_limit, 5), 20);
$$;
revoke all on function public.due_checker(integer) from public, anon, authenticated;
grant execute on function public.due_checker(integer) to service_role;

select cron.unschedule('tali-checker') where exists (select 1 from cron.job where jobname = 'tali-checker');
select cron.schedule('tali-checker', '*/30 * * * *', $cron$
  select net.http_post(
    url := 'https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/tali-checker',
    headers := jsonb_build_object('Content-Type','application/json','x-tali-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'tali_brain_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000)
  where exists (select 1 from public.due_checker(1));
$cron$);
