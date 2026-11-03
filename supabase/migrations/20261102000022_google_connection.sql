-- Tali HQ 022: connect Google (Gmail and Google Calendar) the way Claude does, one sign-in.
-- Tali reads new mail and sorts it, drafts replies, sees the calendar for the brief and chat,
-- and drafts invites. Sending and booking only ever happen when the user taps the button.

-- One Google account per user. Tokens are server only: the app can read the email, scopes and
-- sync times (column grants), never the tokens.
create table if not exists public.google_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_email text not null,
  scopes text[] not null default '{}',
  access_token text not null,
  access_expires_at timestamptz not null,
  refresh_token text not null,
  calendar_id text not null default 'primary',
  mail_sync_after timestamptz,          -- only mail newer than this is read (set at connect time)
  last_mail_sync_at timestamptz,
  last_error text,
  connected_at timestamptz not null default now()
);
alter table public.google_connections enable row level security;
create policy "own google connection read" on public.google_connections for select to authenticated
  using (user_id = (select auth.uid()));
revoke select on public.google_connections from authenticated;
grant select (user_id, google_email, scopes, calendar_id, last_mail_sync_at, last_error, connected_at) on public.google_connections to authenticated;

-- Short-lived OAuth state for any provider (Stripe keeps its own table from 018).
create table if not exists public.oauth_states (
  state text primary key,
  provider text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  return_to text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.oauth_states enable row level security;

-- Gmail lands in the same table as Tali's own address. source tells them apart and category is
-- Tali's sort: needs_you (a reply is drafted), fyi, or spam.
alter table public.inbound_emails add column if not exists source text not null default 'tali_inbox' check (source in ('tali_inbox', 'gmail'));
alter table public.inbound_emails add column if not exists category text check (category is null or category in ('needs_you', 'fyi', 'spam'));
alter table public.inbound_emails add column if not exists thread_id text;
alter table public.inbound_emails add column if not exists to_email text;
alter table public.inbound_emails add column if not exists snippet text;
create index if not exists inbound_user_source_idx on public.inbound_emails (user_id, source, received_at desc);

-- Approvals can now be an email (Gmail send) or a booking (calendar invite). The draft json says
-- what happens on the tap: {action:'gmail_send', to, subject, body, thread_id} or
-- {action:'calendar_create', title, start, end, attendee_email, location, description}.
alter table public.approvals drop constraint if exists approvals_kind_check;
alter table public.approvals add constraint approvals_kind_check
  check (kind in ('message','follow_up','invoice','booking','rule','email','other'));

-- Every 10 minutes: read new Gmail for everyone connected (the function skips anyone with nothing new).
select cron.unschedule('tali-gmail-sync') where exists (select 1 from cron.job where jobname = 'tali-gmail-sync');
select cron.schedule('tali-gmail-sync', '*/10 * * * *', $cron$
  select net.http_post(
    url := 'https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/google-connect',
    headers := jsonb_build_object('Content-Type','application/json','x-tali-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'tali_brain_key')),
    body := '{"action":"mail_sync"}'::jsonb,
    timeout_milliseconds := 120000)
  where exists (select 1 from public.google_connections where 'gmail' = any(scopes));
$cron$);
