-- 23 Nov 2026 (Taj): Your time. The people you love and how often you see them, so Tali can count
-- roughly how many more times you'll be together. Private to each person.
create table if not exists public.time_people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  relation text not null,
  age int not null check (age between 0 and 115),
  often text not null default 'monthly' check (often in ('daily','weekly','fortnightly','monthly','few_months','yearly')),
  created_at timestamptz not null default now()
);
alter table public.time_people enable row level security;
create policy "time_people own rows" on public.time_people for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create index if not exists time_people_user on public.time_people(user_id);
grant select, insert, update, delete on public.time_people to authenticated;

-- 23 Nov 2026 (Taj): Your philosophy. The schools you follow, and the daily quotes you keep.
alter table public.profiles add column if not exists philosophies text[] not null default '{}';
grant select (philosophies), update (philosophies) on public.profiles to authenticated;
create table if not exists public.saved_quotes (
  user_id uuid not null references auth.users(id) on delete cascade,
  quote_id text not null check (char_length(quote_id) <= 40),
  saved_at timestamptz not null default now(),
  primary key (user_id, quote_id)
);
alter table public.saved_quotes enable row level security;
create policy "saved_quotes own rows" on public.saved_quotes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.saved_quotes to authenticated;
