-- 12 Nov 2026 (Taj): counts "Ask Tali to write it" drafts so each owner gets at most 5 a day.
-- Only the tali-site-write function touches it.
create table if not exists public.site_drafts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists site_drafts_user_idx on public.site_drafts (user_id, created_at desc);
alter table public.site_drafts enable row level security;
revoke all on public.site_drafts from anon, authenticated;
