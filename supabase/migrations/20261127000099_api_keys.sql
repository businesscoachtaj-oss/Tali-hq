-- 27 Nov 2026 (Taj): Tali HQ API and Zapier.
-- An owner makes an API key in Settings, Connections, and pastes it into Zapier (or anything else).
-- The key is shown once. Only its sha256 hash is kept. The tali-api edge function looks keys up with
-- the service role; the app can list its own keys (never the hash) and nothing else.
-- What a key can do: read their clients and leads (not family or friends), website enquiries,
-- bookings, paid invoices and accepted quotes, and add a client or lead, a reminder or a note.
-- It can never send, spend or delete anything.

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Zapier' check (char_length(btrim(name)) between 1 and 60),
  key_hash text not null unique,
  last4 text not null check (char_length(last4) = 4),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists api_keys_user_idx on public.api_keys (user_id);

alter table public.api_keys enable row level security;

drop policy if exists "api keys: own, read" on public.api_keys;
create policy "api keys: own, read" on public.api_keys
  for select to authenticated using (user_id = (select auth.uid()));

-- Made and revoked through tali-api only. The hash is never readable from the app.
revoke all on public.api_keys from anon, authenticated;
grant select (id, user_id, name, last4, created_at, last_used_at, revoked_at) on public.api_keys to authenticated;
