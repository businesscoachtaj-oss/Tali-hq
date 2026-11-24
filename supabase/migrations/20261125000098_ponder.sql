-- 20261125000098_ponder.sql. Ponder (brain games), 25 Nov 2026. Lives in the Tali HQ project; a Ponder sign-up is a normal sign-up
-- here and gets the Tali HQ profile and trial (Taj's choice, 25 Nov). Everything is RLS on auth.uid().
-- Kids never have a login of their own: a paired family device holds a device token, and kids sign in
-- on it with their PIN through the functions below. PINs are bcrypt hashed in a table no client can read.
create extension if not exists pgcrypto with schema extensions;

create table public.ponder_players (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  is_self boolean not null default false,
  name text not null check (char_length(name) between 1 and 30),
  kind text not null check (kind in ('everyone', 'kids', 'gentle')),
  emoji text not null default '🙂' check (char_length(emoji) <= 16),
  colour text not null default '#1F7A6D' check (colour ~ '^#[0-9A-Fa-f]{6}$'),
  age int check (age between 5 and 12),
  limit_mins int check (limit_mins in (15, 20, 30)),
  text_size text check (text_size in ('large', 'xl')),
  share_with_owner boolean not null default false,
  goals text[] not null default '{}',
  paths text[] not null default '{}',
  reminder text,
  levels jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create unique index ponder_players_one_self on public.ponder_players (owner) where is_self;
create index ponder_players_owner on public.ponder_players (owner);

create table public.ponder_results (
  player_id uuid not null references public.ponder_players(id) on delete cascade,
  day date not null,
  game text not null check (char_length(game) <= 60),
  won boolean, score int, stars int check (stars between 0 and 3),
  level text check (level in ('easy', 'medium', 'hard')),
  detail text check (char_length(detail) <= 200),
  share text check (char_length(share) <= 400),
  data jsonb,
  created_at timestamptz not null default now(),
  primary key (player_id, day, game)
);
create table public.ponder_habits (player_id uuid not null references public.ponder_players(id) on delete cascade, day date not null, habit text not null check (char_length(habit) <= 30), primary key (player_id, day, habit));
create table public.ponder_lessons (player_id uuid not null references public.ponder_players(id) on delete cascade, lesson text not null check (char_length(lesson) <= 60), read_at timestamptz not null default now(), primary key (player_id, lesson));
create table public.ponder_minutes (player_id uuid not null references public.ponder_players(id) on delete cascade, day date not null, minutes int not null default 0 check (minutes between 0 and 1440), primary key (player_id, day));
-- Plus. Written by billing (App Store, Google Play, Stripe) and the trial function, never by the app directly.
create table public.ponder_members (owner uuid primary key references auth.users(id) on delete cascade, plan text not null default 'free' check (plan in ('free', 'plus')), renews_at timestamptz, source text, trial_used boolean not null default false, updated_at timestamptz not null default now());
-- Server only (RLS on, no policies).
create table public.ponder_kid_pins (player_id uuid primary key references public.ponder_players(id) on delete cascade, pin_hash text not null);
create table public.ponder_devices (id uuid primary key default gen_random_uuid(), owner uuid not null references auth.users(id) on delete cascade, token_hash text not null unique, name text, created_at timestamptz not null default now(), last_seen timestamptz, revoked_at timestamptz);
create table public.ponder_pair_codes (code text primary key, owner uuid not null references auth.users(id) on delete cascade, player_id uuid references public.ponder_players(id) on delete cascade, expires_at timestamptz not null, used_at timestamptz);
create table public.ponder_kid_sessions (token_hash text primary key, player_id uuid not null references public.ponder_players(id) on delete cascade, device_id uuid not null references public.ponder_devices(id) on delete cascade, expires_at timestamptz not null);
create table public.ponder_pin_tries (device_id uuid not null references public.ponder_devices(id) on delete cascade, player_id uuid not null, at timestamptz not null default now());
create index ponder_pin_tries_recent on public.ponder_pin_tries (device_id, at);

alter table public.ponder_players enable row level security;
alter table public.ponder_results enable row level security;
alter table public.ponder_habits enable row level security;
alter table public.ponder_lessons enable row level security;
alter table public.ponder_minutes enable row level security;
alter table public.ponder_members enable row level security;
alter table public.ponder_kid_pins enable row level security;
alter table public.ponder_devices enable row level security;
alter table public.ponder_pair_codes enable row level security;
alter table public.ponder_kid_sessions enable row level security;
alter table public.ponder_pin_tries enable row level security;

create policy "own players" on public.ponder_players for all to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create or replace function public.ponder_owns(p_player uuid) returns boolean language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.ponder_players p where p.id = p_player and p.owner = (select auth.uid())) $$;
create policy "own results" on public.ponder_results for all to authenticated using (public.ponder_owns(player_id)) with check (public.ponder_owns(player_id));
create policy "own habits" on public.ponder_habits for all to authenticated using (public.ponder_owns(player_id)) with check (public.ponder_owns(player_id));
create policy "own lessons" on public.ponder_lessons for all to authenticated using (public.ponder_owns(player_id)) with check (public.ponder_owns(player_id));
create policy "own minutes" on public.ponder_minutes for all to authenticated using (public.ponder_owns(player_id)) with check (public.ponder_owns(player_id));
create policy "read own plan" on public.ponder_members for select to authenticated using (owner = (select auth.uid()));

-- A grown-up sets a child's PIN.
create or replace function public.ponder_set_pin(p_player uuid, p_pin text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_pin !~ '^[0-9]{4}$' then raise exception 'pin must be 4 numbers'; end if;
  if not exists (select 1 from public.ponder_players where id = p_player and owner = auth.uid() and kind = 'kids') then raise exception 'not your child'; end if;
  insert into public.ponder_kid_pins (player_id, pin_hash) values (p_player, extensions.crypt(p_pin, extensions.gen_salt('bf')))
  on conflict (player_id) do update set pin_hash = excluded.pin_hash;
end $$;

-- This device joins the grown-up's family (their own phone or a shared tablet). Returns the device token once.
create or replace function public.ponder_register_device(p_name text default null) returns text language plpgsql security definer set search_path = '' as $$
declare t text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  insert into public.ponder_devices (owner, token_hash, name) values (auth.uid(), encode(extensions.digest(t, 'sha256'), 'hex'), left(p_name, 40));
  return t;
end $$;

-- A grown-up makes a 6 character code for a kid's own device. Works once, for 10 minutes.
create or replace function public.ponder_make_pair_code(p_player uuid default null) returns text language plpgsql security definer set search_path = '' as $$
declare a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text := ''; i int;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if p_player is not null and not exists (select 1 from public.ponder_players where id = p_player and owner = auth.uid()) then raise exception 'not your family'; end if;
  for i in 1..6 loop c := c || substr(a, 1 + floor(random() * 32)::int, 1); end loop;
  delete from public.ponder_pair_codes where owner = auth.uid() and (used_at is not null or expires_at < now());
  insert into public.ponder_pair_codes (code, owner, player_id, expires_at) values (c, auth.uid(), p_player, now() + interval '10 minutes');
  return c;
end $$;

-- The kid's device types the code and gets its device token.
create or replace function public.ponder_pair(p_code text) returns text language plpgsql security definer set search_path = '' as $$
declare r record; t text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  select * into r from public.ponder_pair_codes where code = upper(p_code) and used_at is null and expires_at > now() for update;
  if not found then raise exception 'that code did not work'; end if;
  update public.ponder_pair_codes set used_at = now() where code = r.code;
  insert into public.ponder_devices (owner, token_hash, name) values (r.owner, encode(extensions.digest(t, 'sha256'), 'hex'), 'Kids device');
  return t;
end $$;

create or replace function public.ponder_device(p_token text) returns public.ponder_devices language sql security definer set search_path = '' as
$$ select * from public.ponder_devices where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and revoked_at is null $$;

-- The kids on this device's family: names, animals and colours only.
create or replace function public.ponder_device_kids(p_token text) returns table (id uuid, name text, emoji text, colour text) language plpgsql security definer set search_path = '' as $$
declare d public.ponder_devices := public.ponder_device(p_token);
begin
  if d.id is null then raise exception 'device not paired'; end if;
  update public.ponder_devices set last_seen = now() where ponder_devices.id = d.id;
  return query select p.id, p.name, p.emoji, p.colour from public.ponder_players p where p.owner = d.owner and p.kind = 'kids' order by p.created_at;
end $$;

-- A kid types their PIN. Five wrong tries in 10 minutes on a device locks it for a while.
create or replace function public.ponder_kid_login(p_token text, p_player uuid, p_pin text) returns text language plpgsql security definer set search_path = '' as $$
declare d public.ponder_devices := public.ponder_device(p_token); h text; t text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if d.id is null then raise exception 'device not paired'; end if;
  if (select count(*) from public.ponder_pin_tries where device_id = d.id and at > now() - interval '10 minutes') >= 5 then raise exception 'too many tries, ask a grown-up'; end if;
  select k.pin_hash into h from public.ponder_kid_pins k join public.ponder_players p on p.id = k.player_id where p.id = p_player and p.owner = d.owner and p.kind = 'kids';
  if h is null or h <> extensions.crypt(p_pin, h) then insert into public.ponder_pin_tries (device_id, player_id) values (d.id, p_player); return null; end if; -- null means wrong PIN (raising would undo the try)
  delete from public.ponder_kid_sessions where expires_at < now();
  insert into public.ponder_kid_sessions (token_hash, player_id, device_id, expires_at) values (encode(extensions.digest(t, 'sha256'), 'hex'), p_player, d.id, now() + interval '12 hours');
  return t;
end $$;

create or replace function public.ponder_kid(p_kid text) returns public.ponder_players language sql security definer set search_path = '' as
$$ select p.* from public.ponder_kid_sessions s join public.ponder_players p on p.id = s.player_id where s.token_hash = encode(extensions.digest(p_kid, 'sha256'), 'hex') and s.expires_at > now() $$;

-- What a signed-in kid needs: who they are, today's results, minutes played, limit and stars.
create or replace function public.ponder_kid_state(p_kid text, p_day date) returns jsonb language plpgsql security definer set search_path = '' as $$
declare k public.ponder_players := public.ponder_kid(p_kid);
begin
  if k.id is null then raise exception 'signed out'; end if;
  return jsonb_build_object('player', jsonb_build_object('id', k.id, 'name', k.name, 'emoji', k.emoji, 'colour', k.colour, 'age', k.age, 'limit', k.limit_mins, 'levels', k.levels),
    'today', coalesce((select jsonb_object_agg(game, jsonb_build_object('stars', stars, 'won', won, 'level', level, 'detail', detail)) from public.ponder_results where player_id = k.id and day = p_day), '{}'),
    'minutes', coalesce((select minutes from public.ponder_minutes where player_id = k.id and day = p_day), 0),
    'stars', coalesce((select sum(stars) from public.ponder_results where player_id = k.id), 0));
end $$;

-- A kid finishes a game. Saves the result and the minutes; says how many minutes are left today.
create or replace function public.ponder_kid_save(p_kid text, p_day date, p_game text, p_stars int, p_won boolean, p_level text, p_detail text, p_minutes int) returns int language plpgsql security definer set search_path = '' as $$
declare k public.ponder_players := public.ponder_kid(p_kid); m int;
begin
  if k.id is null then raise exception 'signed out'; end if;
  if p_day not between current_date - 1 and current_date + 1 then raise exception 'wrong day'; end if;
  insert into public.ponder_results (player_id, day, game, stars, won, level, detail) values (k.id, p_day, left(p_game, 60), least(3, greatest(0, p_stars)), p_won, p_level, left(p_detail, 200))
  on conflict (player_id, day, game) do update set stars = greatest(public.ponder_results.stars, excluded.stars), won = excluded.won, level = excluded.level, detail = excluded.detail;
  insert into public.ponder_minutes (player_id, day, minutes) values (k.id, p_day, least(60, greatest(0, p_minutes)))
  on conflict (player_id, day) do update set minutes = least(1440, public.ponder_minutes.minutes + excluded.minutes) returning minutes into m;
  return case when k.limit_mins is null then null else greatest(0, k.limit_mins - m) end;
end $$;

-- Plus trial: once per grown-up, 7 days. Real billing writes ponder_members from the store webhooks.
create or replace function public.ponder_start_trial() returns timestamptz language plpgsql security definer set search_path = '' as $$
declare r timestamptz;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if exists (select 1 from public.ponder_members where owner = auth.uid() and trial_used) then raise exception 'trial already used'; end if;
  insert into public.ponder_members (owner, plan, renews_at, source, trial_used) values (auth.uid(), 'plus', now() + interval '7 days', 'trial', true)
  on conflict (owner) do update set plan = 'plus', renews_at = now() + interval '7 days', source = 'trial', trial_used = true, updated_at = now() returning renews_at into r;
  return r;
end $$;

-- For Tali HQ (server only): a person's last 7 days in Ponder, so Tali knows their sleep, habits and games.
create or replace function public.ponder_for_tali(p_user uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select case when me.id is null then null else jsonb_build_object(
    'games_last_7_days', (select count(*) from public.ponder_results r where r.player_id = me.id and r.day > current_date - 7),
    'days_played', (select count(distinct day) from public.ponder_results r where r.player_id = me.id and r.day > current_date - 7),
    'habits', (select coalesce(jsonb_object_agg(habit, n), '{}') from (select habit, count(*) n from public.ponder_habits h where h.player_id = me.id and h.day > current_date - 7 group by habit) x),
    'sleep_hours', (select jsonb_agg(jsonb_build_object('day', day, 'hours', (data->>'sleep_hours')::numeric) order by day) from public.ponder_results r where r.player_id = me.id and r.game like 'winddown%' and r.day > current_date - 7 and data ? 'sleep_hours'),
    'lessons_read', (select count(*) from public.ponder_lessons l where l.player_id = me.id and l.read_at > now() - interval '7 days')) end
  from (select (select id from public.ponder_players where owner = p_user and is_self) as id) me
$$;

-- Sunday note to the grown-up a Gentle player shares with (server only, for the weekly note function).
create or replace function public.ponder_weekly_notes() returns table (owner uuid, email text, player text, days_played bigint, games text[], talked bigint) language sql stable security definer set search_path = '' as $$
  select p.owner, u.email::text, p.name,
    (select count(distinct day) from public.ponder_results r where r.player_id = p.id and r.day > current_date - 7),
    (select coalesce(array_agg(distinct split_part(game, '@', 1)), '{}') from public.ponder_results r where r.player_id = p.id and r.day > current_date - 7),
    (select count(*) from public.ponder_habits h where h.player_id = p.id and h.habit = 'people' and h.day > current_date - 7)
  from public.ponder_players p join auth.users u on u.id = p.owner where p.kind = 'gentle' and p.share_with_owner
$$;

revoke all on function public.ponder_for_tali(uuid), public.ponder_weekly_notes(), public.ponder_device(text), public.ponder_kid(text) from public, anon, authenticated;
revoke all on function public.ponder_set_pin(uuid, text), public.ponder_register_device(text), public.ponder_make_pair_code(uuid), public.ponder_start_trial() from public, anon;
grant execute on function public.ponder_set_pin(uuid, text), public.ponder_register_device(text), public.ponder_make_pair_code(uuid), public.ponder_start_trial() to authenticated;
revoke all on function public.ponder_pair(text), public.ponder_device_kids(text), public.ponder_kid_login(text, uuid, text), public.ponder_kid_state(text, date), public.ponder_kid_save(text, date, text, int, boolean, text, text, int) from public;
grant execute on function public.ponder_pair(text), public.ponder_device_kids(text), public.ponder_kid_login(text, uuid, text), public.ponder_kid_state(text, date), public.ponder_kid_save(text, date, text, int, boolean, text, text, int) to anon, authenticated;

revoke all on function public.ponder_owns(uuid) from public, anon;
grant execute on function public.ponder_owns(uuid) to authenticated;
