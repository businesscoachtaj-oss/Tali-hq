-- 11 Nov 2026 (asked for by Taj). What is yours in Tali's library: the books on your shelf, the page
-- you are up to in each one, and the day you finished it. One row per person, so it follows you
-- from phone to web app. Only you can see or change your row. Already applied to the live project.
create table if not exists public.library_mine (
  user_id uuid primary key references auth.users(id) on delete cascade,
  shelf text[],
  place jsonb not null default '{}'::jsonb,
  done jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.library_mine enable row level security;
drop policy if exists "library_mine own row" on public.library_mine;
create policy "library_mine own row" on public.library_mine for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.library_mine from anon;
grant select, insert, update, delete on public.library_mine to authenticated;
