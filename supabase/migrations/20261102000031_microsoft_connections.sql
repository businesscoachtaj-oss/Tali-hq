-- 2 Nov 2026: Outlook / Microsoft 365 alongside Google. Same shape as google_connections:
-- tokens server only, the app sees the account and status. Mail from Outlook lands in
-- inbound_emails with source 'outlook', sorted the same way as Gmail. The sync runs on the
-- same 10 minute cadence through the ms-connect function.
create table if not exists public.microsoft_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ms_email text not null,
  scopes text[] not null default '{}',
  access_token text not null,
  access_expires_at timestamptz not null,
  refresh_token text not null,
  mail_sync_after timestamptz,
  last_mail_sync_at timestamptz,
  last_error text,
  connected_at timestamptz not null default now()
);
alter table public.microsoft_connections enable row level security;
create policy "own microsoft connection read" on public.microsoft_connections for select to authenticated
  using (user_id = (select auth.uid()));
revoke select on public.microsoft_connections from authenticated;
grant select (user_id, ms_email, scopes, last_mail_sync_at, last_error, connected_at) on public.microsoft_connections to authenticated;

alter table public.inbound_emails drop constraint if exists inbound_emails_source_check;
alter table public.inbound_emails add constraint inbound_emails_source_check check (source in ('tali_inbox', 'gmail', 'outlook'));

-- The 90 day prune covers Outlook mail too.
create or replace function public.prune_gmail_emails()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.inbound_emails where source in ('gmail', 'outlook') and received_at < now() - interval '90 days';
  get diagnostics n = row_count;
  return n;
end $$;

-- Mail sync for Outlook, every 10 minutes, only when someone has it connected.
select cron.schedule('tali-outlook-sync', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/ms-connect',
    headers := jsonb_build_object('Content-Type','application/json','x-tali-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'tali_brain_key')),
    body := '{"action":"mail_sync"}'::jsonb,
    timeout_milliseconds := 120000)
  where exists (select 1 from public.microsoft_connections where 'mail' = any(scopes));
$$);
