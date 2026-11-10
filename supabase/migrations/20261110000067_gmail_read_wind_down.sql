-- Gmail reading wound down (10 Nov 2026, asked for by Taj: "just do the full thing").
--
-- Tali no longer asks Google for permission to read Gmail (that permission needs a paid yearly
-- security assessment). Mail reaches her by the owner's own Gmail auto-forward instead
-- (migration 066), and the only Gmail permission asked for now is sending their replies.
--
--   google_connections.gmail_read   true only for people who connected before today, so the old
--                                   10 minute read keeps going for them until they switch on
--                                   forwarding, or until 25 Nov 2026 when it stops for everyone.
--   forwarding_seen                 the moment someone's first forwarded email arrives, their old
--                                   read is switched off for good.
-- Nothing is deleted. Mail already sorted stays where it is.

alter table public.google_connections add column if not exists gmail_read boolean not null default false;
update public.google_connections set gmail_read = true where scopes @> array['gmail'] and gmail_read = false;

create or replace function public.forwarding_seen(p_user_id uuid, p_gmail text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.gmail_forwarding (user_id, gmail, state, first_at, last_at)
  values (p_user_id, lower(p_gmail), 'working', now(), now())
  on conflict (user_id) do update
    set state = 'working', gmail = excluded.gmail, first_at = coalesce(public.gmail_forwarding.first_at, now()), last_at = now();
  update public.google_connections set gmail_read = false where user_id = p_user_id and gmail_read;
end $$;
revoke all on function public.forwarding_seen(uuid, text) from public, anon, authenticated;
grant execute on function public.forwarding_seen(uuid, text) to service_role;

-- The app may see whether the old read is still on for them (to show the "switch to forwarding" note).
grant select (gmail_read) on public.google_connections to authenticated;

-- The 10 minute job now only wakes while someone is still on the old read, and never after 24 Nov.
select cron.unschedule('tali-gmail-sync') where exists (select 1 from cron.job where jobname = 'tali-gmail-sync');
select cron.schedule('tali-gmail-sync', '*/10 * * * *', $cron$
  select net.http_post(
    url := 'https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/google-connect',
    headers := jsonb_build_object('Content-Type','application/json','x-tali-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'tali_brain_key')),
    body := '{"action":"mail_sync"}'::jsonb,
    timeout_milliseconds := 120000)
  where now() < timestamptz '2026-11-24 13:00:00+00'
    and exists (select 1 from public.google_connections where gmail_read);
$cron$);

-- Founder screen: how much email is reaching Tali through Resend, so the plan limit is seen coming.
-- Counts what was kept (mail to Tali addresses and forwarded Gmail). Only Taj's account may call it.
create or replace function public.founder_mail()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  me constant uuid := 'e89ca9de-a86e-4dd6-8094-bc518566352e';
  day_start timestamptz := date_trunc('day', now() at time zone 'Australia/Sydney') at time zone 'Australia/Sydney';
  month_start timestamptz := date_trunc('month', now() at time zone 'Australia/Sydney') at time zone 'Australia/Sydney';
begin
  if auth.uid() is distinct from me then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'today', (select count(*) from public.inbound_emails e where e.received_at >= day_start and (e.provider_id is null or e.provider_id not like all (array['gmail:%', 'outlook:%']))),
    'month', (select count(*) from public.inbound_emails e where e.received_at >= month_start and (e.provider_id is null or e.provider_id not like all (array['gmail:%', 'outlook:%']))),
    'forwarding_on', (select count(*) from public.gmail_forwarding where state = 'working'),
    'old_read_left', (select count(*) from public.google_connections where gmail_read));
end $$;
revoke all on function public.founder_mail() from public, anon;
grant execute on function public.founder_mail() to authenticated;
