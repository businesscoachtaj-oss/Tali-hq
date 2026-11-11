-- Personal money (11 Nov 2026, asked for by Taj): a personal spend and budget tracker on the
-- Personal side of Money. Spends come in by telling Tali, snapping a receipt or typing them in.
-- One weekly "left to spend" amount, monthly budgets by category, and bills that repeat.
-- Nothing here moves money. Every table is the owner's own rows only (RLS on auth.uid()).

create table if not exists public.personal_spends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  amount numeric(12,2) not null check (amount > 0 and amount < 1000000),
  description text not null check (char_length(description) between 1 and 120),
  category text not null default 'Other' check (char_length(category) between 1 and 40),
  source text not null default 'manual' check (source in ('tali', 'receipt', 'manual', 'repeat')),
  repeat_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists personal_spends_user_date_idx on public.personal_spends (user_id, local_date desc);
alter table public.personal_spends enable row level security;
drop policy if exists personal_spends_own on public.personal_spends;
create policy personal_spends_own on public.personal_spends for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.personal_budgets (
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (char_length(category) between 1 and 40),
  monthly numeric(12,2) not null check (monthly >= 0 and monthly < 1000000),
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);
alter table public.personal_budgets enable row level security;
drop policy if exists personal_budgets_own on public.personal_budgets;
create policy personal_budgets_own on public.personal_budgets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.personal_money_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  weekly_amount numeric(12,2) check (weekly_amount is null or (weekly_amount >= 0 and weekly_amount < 1000000)),
  updated_at timestamptz not null default now()
);
alter table public.personal_money_settings enable row level security;
drop policy if exists personal_money_settings_own on public.personal_money_settings;
create policy personal_money_settings_own on public.personal_money_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.personal_repeats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  description text not null check (char_length(description) between 1 and 120),
  amount numeric(12,2) not null check (amount > 0 and amount < 1000000),
  category text not null default 'Bills' check (char_length(category) between 1 and 40),
  every text not null check (every in ('week', 'fortnight', 'month')),
  next_date date not null,
  created_at timestamptz not null default now()
);
create index if not exists personal_repeats_user_idx on public.personal_repeats (user_id);
alter table public.personal_repeats enable row level security;
drop policy if exists personal_repeats_own on public.personal_repeats;
create policy personal_repeats_own on public.personal_repeats for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- The picture for one person on one day. Server only: the app goes through my_personal_money and
-- Tali's chat function calls this with the service role. It first writes any repeating bills that
-- have come due (at most 12 catch-ups each), then adds everything up. Weeks run Monday to Sunday.
create or replace function public.personal_money_picture(p_user_id uuid, p_today date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n int;
  d date;
  v_week date := date_trunc('week', p_today)::date;
  v_month date := date_trunc('month', p_today)::date;
  v_weekly numeric;
  v_out jsonb;
begin
  if p_user_id is null or p_today is null then return '{}'::jsonb; end if;
  for r in select * from personal_repeats where user_id = p_user_id and next_date <= p_today loop
    n := 0; d := r.next_date;
    while d <= p_today and n < 12 loop
      insert into personal_spends (user_id, local_date, amount, description, category, source, repeat_id)
      values (p_user_id, d, r.amount, r.description, r.category, 'repeat', r.id);
      d := case r.every when 'week' then d + 7 when 'fortnight' then d + 14 else (d + interval '1 month')::date end;
      n := n + 1;
    end loop;
    update personal_repeats set next_date = d where id = r.id;
  end loop;

  select weekly_amount into v_weekly from personal_money_settings where user_id = p_user_id;

  select jsonb_build_object(
    'today', p_today,
    'week_start', v_week,
    'weekly_amount', v_weekly,
    'week_spent', coalesce((select sum(amount) from personal_spends where user_id = p_user_id and local_date >= v_week and local_date <= p_today and source <> 'repeat'), 0),
    'month_spent', coalesce((select sum(amount) from personal_spends where user_id = p_user_id and local_date >= v_month and local_date <= p_today), 0),
    'month_budget', (select sum(monthly) from personal_budgets where user_id = p_user_id),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('category', c.category, 'budget', c.budget, 'spent', c.spent) order by c.spent desc, c.category)
      from (
        select coalesce(b.category, s.category) as category, b.monthly as budget, coalesce(s.spent, 0) as spent
        from (select category, monthly from personal_budgets where user_id = p_user_id and monthly > 0) b
        full join (select category, sum(amount) as spent from personal_spends where user_id = p_user_id and local_date >= v_month and local_date <= p_today group by category) s
          on s.category = b.category
      ) c), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'local_date', x.local_date, 'amount', x.amount, 'description', x.description, 'category', x.category, 'source', x.source) order by x.local_date desc, x.created_at desc)
      from (select * from personal_spends where user_id = p_user_id order by local_date desc, created_at desc limit 40) x), '[]'::jsonb),
    'repeats', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'description', p.description, 'amount', p.amount, 'category', p.category, 'every', p.every, 'next_date', p.next_date) order by p.next_date)
      from personal_repeats p where p.user_id = p_user_id), '[]'::jsonb)
  ) into v_out;
  return v_out;
end;
$$;
revoke all on function public.personal_money_picture(uuid, date) from public, anon, authenticated;
grant execute on function public.personal_money_picture(uuid, date) to service_role;

-- The app's door: your own picture. The day comes from the phone (its local date) and must be
-- within a day of the server's, so nobody can write repeating bills far into the future.
create or replace function public.my_personal_money(p_today date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if p_today is null or abs(p_today - (now() at time zone 'utc')::date) > 1 then
    p_today := (now() at time zone 'utc')::date;
  end if;
  return public.personal_money_picture(auth.uid(), p_today);
end;
$$;
revoke all on function public.my_personal_money(date) from public, anon;
grant execute on function public.my_personal_money(date) to authenticated;
