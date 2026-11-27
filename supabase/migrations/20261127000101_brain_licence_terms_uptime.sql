-- 27 Nov 2026 (Taj): two gaps closed on the Tali Brain licence.
-- 1. Minimum terms are enforced: term_start is when the licensee's subscription began. brain-api uses it
--    to keep cancelling and moving down a plan switched off until the plan's minimum has passed.
-- 2. Uptime is measured: every 5 minutes the database calls the brain API and records whether it answered,
--    so an uptime promise can be made from real numbers. Founder only.
alter table public.licensees add column if not exists term_start timestamptz;

create table if not exists public.licence_uptime (
  id bigint generated always as identity primary key,
  checked_at timestamptz not null default now(),
  request_id bigint,
  ok boolean
);
create index if not exists licence_uptime_checked_idx on public.licence_uptime (checked_at desc);
alter table public.licence_uptime enable row level security;
revoke all on public.licence_uptime from anon, authenticated;

create or replace function public.licence_uptime_tick() returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Mark the earlier checks from what came back.
  update public.licence_uptime u set ok = (r.status_code = 200 and coalesce(r.timed_out, false) = false)
    from net._http_response r where u.ok is null and r.id = u.request_id;
  -- No answer after 4 minutes counts as down.
  update public.licence_uptime set ok = false where ok is null and checked_at < now() - interval '4 minutes';
  insert into public.licence_uptime (request_id)
    values (net.http_get(url := 'https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/brain-api/public/plans', timeout_milliseconds := 15000));
  delete from public.licence_uptime where checked_at < now() - interval '100 days';
end $$;
revoke all on function public.licence_uptime_tick() from public, anon, authenticated;

create or replace function public.licence_uptime_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me constant uuid := 'e89ca9de-a86e-4dd6-8094-bc518566352e';
begin
  if auth.uid() is distinct from me then raise exception 'not allowed'; end if;
  return (select jsonb_build_object(
    'since', min(checked_at), 'checks', count(*), 'up', count(*) filter (where ok),
    'percent', case when count(*) > 0 then round(100.0 * count(*) filter (where ok) / count(*), 2) end)
    from public.licence_uptime where ok is not null and checked_at >= now() - interval '30 days');
end $$;
revoke all on function public.licence_uptime_stats() from public, anon;
grant execute on function public.licence_uptime_stats() to authenticated;

do $$ begin
  if exists (select 1 from cron.job where jobname = 'licence-uptime') then perform cron.unschedule('licence-uptime'); end if;
end $$;
select cron.schedule('licence-uptime', '*/5 * * * *', $cron$ select public.licence_uptime_tick(); $cron$);
