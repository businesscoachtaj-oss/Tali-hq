-- Your world, filled in (11 Nov 2026, asked for by Taj: "it's all so bare and empty").
-- People now holds family and friends as their own groups, with birthdays. Goals are business or
-- personal. One small table, life_items, backs the new lists across the six parts of Your world:
-- to do, check ups, life admin, home, habits, learning, wins, someday and ideas.
-- my_world() gives the "right now" lines each part opens with. Everything is the owner's own rows.

-- 1. People: family and friends beside clients and leads, and a birthday.
alter table public.clients drop constraint if exists clients_kind_check;
alter table public.clients add constraint clients_kind_check check (kind in ('client', 'lead', 'family', 'friend'));
-- A birthday with no year known is stored in 1904 (a leap year, so 29 Feb fits).
alter table public.clients add column if not exists birthday date;

-- 2. Goals: business or personal.
alter table public.goals add column if not exists area text not null default 'business';
alter table public.goals drop constraint if exists goals_area_check;
alter table public.goals add constraint goals_area_check check (area in ('business', 'personal'));

-- 3. The lists.
create table if not exists public.life_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('todo', 'checkup', 'admin', 'home', 'habit', 'learning', 'win', 'someday', 'idea')),
  title text not null check (char_length(trim(title)) between 1 and 200),
  note text not null default '' check (char_length(note) <= 2000),
  due_date date,
  repeat_months int check (repeat_months is null or repeat_months between 1 and 60),
  done_at timestamptz,
  local_date date,
  created_by text not null default 'user' check (created_by in ('user', 'tali')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists life_items_user_kind_idx on public.life_items (user_id, kind, created_at desc);
alter table public.life_items enable row level security;
drop policy if exists life_items_own on public.life_items;
create policy life_items_own on public.life_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- One row per habit per day it was done.
create table if not exists public.habit_ticks (
  item_id uuid not null references public.life_items (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  local_date date not null,
  created_at timestamptz not null default now(),
  primary key (item_id, local_date)
);
create index if not exists habit_ticks_user_date_idx on public.habit_ticks (user_id, local_date desc);
alter table public.habit_ticks enable row level security;
drop policy if exists habit_ticks_own on public.habit_ticks;
create policy habit_ticks_own on public.habit_ticks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 4. The next time a birthday comes round, on or after a day.
create or replace function public.next_birthday(p_birthday date, p_today date) returns date
language sql immutable set search_path = '' as $$
  select case when p_birthday is null or p_today is null then null else (
    select case when d >= p_today then d else (p_birthday + make_interval(years => y + 1))::date end
      from (select greatest(0, extract(year from p_today)::int - extract(year from p_birthday)::int) as y) a,
           lateral (select (p_birthday + make_interval(years => a.y))::date as d) b
  ) end;
$$;

-- 5. What each part of Your world opens with. Reads the caller's own rows (RLS applies).
create or replace function public.my_world(p_today date) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'people', jsonb_build_object(
      'family', (select count(*) from public.clients where kind = 'family'),
      'friend', (select count(*) from public.clients where kind = 'friend'),
      'client', (select count(*) from public.clients where kind = 'client'),
      'lead', (select count(*) from public.clients where kind = 'lead'),
      'new_leads', (select count(*) from public.clients where kind = 'lead' and status = 'new'),
      'next_birthday', (select jsonb_build_object('name', c.name, 'days', public.next_birthday(c.birthday, p_today) - p_today)
                          from public.clients c where c.birthday is not null
                         order by public.next_birthday(c.birthday, p_today), c.name limit 1),
      'birthdays_30', (select count(*) from public.clients c where c.birthday is not null and public.next_birthday(c.birthday, p_today) - p_today <= 30),
      'stale', (select jsonb_build_object('name', c.name, 'days', p_today - c.last_contact_at)
                  from public.clients c where c.kind in ('family', 'friend') and c.last_contact_at is not null and p_today - c.last_contact_at >= 28
                 order by c.last_contact_at limit 1)
    ),
    'work', jsonb_build_object(
      'emails_need', (select count(*) from public.inbound_emails where status = 'new' and category = 'needs_you'),
      'drafts_pending', (select count(*) from public.approvals where status = 'pending'),
      'owed', (select coalesce(sum(total), 0) from public.invoices where status = 'sent'),
      'owed_count', (select count(*) from public.invoices where status = 'sent'),
      'todo_open', (select count(*) from public.life_items where kind = 'todo' and done_at is null),
      'todo_today', (select count(*) from public.life_items where kind = 'todo' and done_at is null and due_date is not null and due_date <= p_today)
    ),
    'health', jsonb_build_object(
      'checkups', (select count(*) from public.life_items where kind = 'checkup' and done_at is null),
      'checkup_next', (select jsonb_build_object('title', i.title, 'days', i.due_date - p_today)
                         from public.life_items i where i.kind = 'checkup' and i.done_at is null and i.due_date is not null
                        order by i.due_date limit 1),
      'moods_7', (select count(*) from public.journal_entries where mood is not null and created_at > now() - interval '7 days')
    ),
    'home', jsonb_build_object(
      'admin_open', (select count(*) from public.life_items where kind = 'admin' and done_at is null),
      'home_open', (select count(*) from public.life_items where kind = 'home' and done_at is null),
      'admin_next', (select jsonb_build_object('title', i.title, 'days', i.due_date - p_today)
                       from public.life_items i where i.kind = 'admin' and i.done_at is null and i.due_date is not null
                      order by i.due_date limit 1)
    ),
    'growth', jsonb_build_object(
      'goals_business', (select count(*) from public.goals where status = 'active' and area = 'business'),
      'goals_personal', (select count(*) from public.goals where status = 'active' and area = 'personal'),
      'habits', (select count(*) from public.life_items where kind = 'habit' and done_at is null),
      'habits_today', (select count(*) from public.habit_ticks t join public.life_items i on i.id = t.item_id where t.local_date = p_today and i.done_at is null),
      'learning', (select count(*) from public.life_items where kind = 'learning' and done_at is null),
      'wins_month', (select count(*) from public.life_items where kind = 'win' and coalesce(local_date, created_at::date) >= date_trunc('month', p_today)::date),
      'someday', (select count(*) from public.life_items where kind = 'someday' and done_at is null)
    ),
    'words', jsonb_build_object(
      'last_journal', (select max(created_at) from public.journal_entries where kind = 'journal'),
      'journal', (select count(*) from public.journal_entries where kind = 'journal'),
      'notes', (select count(*) from public.journal_entries where kind = 'note'),
      'ideas', (select count(*) from public.life_items where kind = 'idea' and done_at is null)
    )
  );
$$;
revoke all on function public.my_world(date) from public, anon;
grant execute on function public.my_world(date) to authenticated;

-- 6. What Tali is given about the lists when you chat, so she can answer "what's on my to do" and
--    tick things off by name. Service role only.
create or replace function public.tali_life_context(p_user_id uuid, p_today date) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'open', (select coalesce(jsonb_agg(jsonb_build_object('kind', i.kind, 'title', i.title, 'due', i.due_date) order by i.kind, i.due_date nulls last, i.created_at), '[]'::jsonb)
               from (select * from public.life_items where user_id = p_user_id and done_at is null and kind <> 'win'
                      order by created_at desc limit 60) i),
    'habits_done_today', (select coalesce(jsonb_agg(i.title), '[]'::jsonb) from public.habit_ticks t join public.life_items i on i.id = t.item_id
                           where t.user_id = p_user_id and t.local_date = p_today),
    'birthdays', (select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'in_days', public.next_birthday(c.birthday, p_today) - p_today)), '[]'::jsonb)
                    from public.clients c where c.user_id = p_user_id and c.birthday is not null and public.next_birthday(c.birthday, p_today) - p_today <= 45)
  );
$$;
revoke all on function public.tali_life_context(uuid, date) from public, anon, authenticated;
grant execute on function public.tali_life_context(uuid, date) to service_role;
