-- Tali HQ 016: food and training, logged by chatting with Tali (all plans).
-- Food numbers are Tali's estimates (no food database in Tali HQ), always shown as "about".
-- Training is a simple weekly plan of day labels ("Upper body", "Rest") Tali writes, plus
-- workouts the user ticks off or tells her about.

create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  local_date date not null,
  meal text not null default 'snack' check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  description text not null check (length(trim(description)) between 1 and 200),
  calories integer not null default 0 check (calories between 0 and 5000),
  protein_g numeric(6,1) not null default 0 check (protein_g between 0 and 500),
  carbs_g numeric(6,1) not null default 0 check (carbs_g between 0 and 800),
  fat_g numeric(6,1) not null default 0 check (fat_g between 0 and 400),
  estimated boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists food_logs_user_date_idx on public.food_logs (user_id, local_date desc);
alter table public.food_logs enable row level security;
create policy "own food all" on public.food_logs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  local_date date not null,
  kg numeric(5,1) not null check (kg between 25 and 350),
  created_at timestamptz not null default now(),
  unique (user_id, local_date)
);
alter table public.weight_logs enable row level security;
create policy "own weight all" on public.weight_logs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- One plan per user: [{weekday 1-7 (Mon-Sun), label, notes}].
create table if not exists public.training_plans (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  name text not null default 'My training',
  days jsonb not null default '[]' check (jsonb_typeof(days) = 'array'),
  updated_at timestamptz not null default now()
);
alter table public.training_plans enable row level security;
create policy "own plan all" on public.training_plans for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger training_plans_touch before update on public.training_plans for each row execute function public.touch_updated_at();

create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  local_date date not null,
  label text not null check (length(trim(label)) between 1 and 80),
  notes text not null default '' check (length(notes) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists workout_logs_user_date_idx on public.workout_logs (user_id, local_date desc);
alter table public.workout_logs enable row level security;
create policy "own workouts all" on public.workout_logs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Today, this week and the streak, in the user's own timezone. Used by the app, chat and briefs.
create or replace function public.life_summary(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz text; d date; wk date; plan jsonb; today_label text; planned integer; done integer; streak integer := 0; w date; wp integer; wd integer;
begin
  select coalesce(timezone, 'Australia/Sydney') into tz from public.profiles where id = p_user_id;
  d := (now() at time zone coalesce(tz, 'Australia/Sydney'))::date;
  wk := d - (extract(isodow from d)::integer - 1);
  select days into plan from public.training_plans where user_id = p_user_id;
  select x->>'label' into today_label from jsonb_array_elements(coalesce(plan, '[]')) x
   where (x->>'weekday')::integer = extract(isodow from d) and lower(x->>'label') <> 'rest' limit 1;
  select count(*) into planned from jsonb_array_elements(coalesce(plan, '[]')) x where lower(x->>'label') <> 'rest';
  select count(distinct local_date) into done from public.workout_logs where user_id = p_user_id and local_date between wk and d;

  -- Streak: full weeks in a row (before this one) where they did at least as many sessions as planned.
  if planned > 0 then
    w := wk - 7;
    loop
      select count(distinct local_date) into wd from public.workout_logs where user_id = p_user_id and local_date between w and w + 6;
      exit when wd < planned or streak >= 52;
      streak := streak + 1;
      w := w - 7;
    end loop;
  end if;

  return jsonb_build_object(
    'date', d,
    'food_today', (select jsonb_build_object('calories', coalesce(sum(calories), 0), 'protein_g', coalesce(sum(protein_g), 0),
                     'carbs_g', coalesce(sum(carbs_g), 0), 'fat_g', coalesce(sum(fat_g), 0), 'items', count(*))
                     from public.food_logs where user_id = p_user_id and local_date = d),
    'weight', (select jsonb_build_object('kg', kg, 'date', local_date) from public.weight_logs where user_id = p_user_id order by local_date desc limit 1),
    'weight_week_ago', (select kg from public.weight_logs where user_id = p_user_id and local_date <= d - 7 order by local_date desc limit 1),
    'plan_name', (select name from public.training_plans where user_id = p_user_id),
    'today_session', today_label,
    'today_done', exists (select 1 from public.workout_logs where user_id = p_user_id and local_date = d),
    'sessions_planned', planned,
    'sessions_done_this_week', done,
    'streak_weeks', streak);
end $$;
revoke all on function public.life_summary(uuid) from public, anon, authenticated;
grant execute on function public.life_summary(uuid) to service_role;

create or replace function public.my_life_summary() returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.life_summary((select auth.uid()));
$$;
revoke all on function public.my_life_summary() from public, anon;
grant execute on function public.my_life_summary() to authenticated;
