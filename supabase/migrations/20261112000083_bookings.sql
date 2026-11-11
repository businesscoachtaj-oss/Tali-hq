-- 12 Nov 2026 (Taj): the business side, stage 3. Bookings: your services, your week, and one link
-- customers book from. A request from the link waits for the owner's yes. The public page only ever
-- sees the business name, the services and which times are taken, never who booked them.

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (length(trim(name)) between 1 and 80),
  minutes integer not null default 60 check (minutes between 5 and 480),
  price numeric(12,2) check (price is null or price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists services_user_idx on public.services (user_id);
alter table public.services enable row level security;
drop policy if exists "own services all" on public.services;
create policy "own services all" on public.services for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null default '' check (length(client_name) <= 120),
  client_email text check (client_email is null or length(client_email) <= 200),
  client_phone text check (client_phone is null or length(client_phone) <= 40),
  service_id uuid references public.services(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 160),
  starts_at timestamptz not null,
  minutes integer not null default 60 check (minutes between 5 and 1440),
  place text not null default '' check (length(place) <= 300),
  -- requested: came from the booking link and waits for a yes. booked: confirmed. done. cancelled.
  status text not null default 'booked' check (status in ('requested', 'booked', 'done', 'cancelled')),
  source text not null default 'you' check (source in ('you', 'tali', 'link')),
  notes text not null default '' check (length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bookings_user_time_idx on public.bookings (user_id, starts_at);
alter table public.bookings enable row level security;
drop policy if exists "own bookings all" on public.bookings;
create policy "own bookings all" on public.bookings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop trigger if exists bookings_touch on public.bookings;
create trigger bookings_touch before update on public.bookings for each row execute function public.touch_updated_at();

create table if not exists public.booking_pages (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  enabled boolean not null default false,
  intro text not null default '' check (length(intro) <= 300),
  days integer[] not null default '{1,2,3,4,5}',
  day_start time not null default '09:00',
  day_end time not null default '17:00',
  updated_at timestamptz not null default now()
);
alter table public.booking_pages enable row level security;
drop policy if exists "own booking page all" on public.booking_pages;
create policy "own booking page all" on public.booking_pages for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- What the public booking page is allowed to see.
create or replace function public.booking_page_public(p_slug text)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare pg public.booking_pages; pr record;
begin
  select * into pg from public.booking_pages where slug = lower(trim(p_slug)) and enabled;
  if not found then return null; end if;
  select coalesce(nullif(trim(business_name), ''), nullif(trim(first_name), ''), 'Bookings') as name, coalesce(timezone, 'Australia/Sydney') as tz into pr from public.profiles where id = pg.user_id;
  return jsonb_build_object(
    'name', pr.name, 'timezone', pr.tz, 'intro', pg.intro, 'days', to_jsonb(pg.days),
    'day_start', to_char(pg.day_start, 'HH24:MI'), 'day_end', to_char(pg.day_end, 'HH24:MI'),
    'services', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'minutes', s.minutes, 'price', s.price) order by s.created_at) from public.services s where s.user_id = pg.user_id and s.active), '[]'::jsonb),
    'busy', coalesce((select jsonb_agg(jsonb_build_object('starts_at', b.starts_at, 'minutes', b.minutes)) from public.bookings b where b.user_id = pg.user_id and b.status in ('requested', 'booked') and b.starts_at > now() - interval '1 day' and b.starts_at < now() + interval '61 days'), '[]'::jsonb));
end $$;
revoke all on function public.booking_page_public(text) from public;
grant execute on function public.booking_page_public(text) to anon, authenticated, service_role;

-- A customer asks for a time. It is saved as a request and nothing is confirmed until the owner says yes.
create or replace function public.booking_request_public(p_slug text, p_service_id uuid, p_starts_at timestamptz, p_name text, p_email text default null, p_phone text default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare pg public.booking_pages; sv public.services; tz text; lt timestamp; dow int; mins int;
  nm text := trim(coalesce(p_name, '')); em text := nullif(trim(coalesce(p_email, '')), ''); ph text := nullif(trim(coalesce(p_phone, '')), '');
begin
  select * into pg from public.booking_pages where slug = lower(trim(p_slug)) and enabled;
  if not found then return jsonb_build_object('ok', false, 'message', 'This booking page is not taking bookings right now.'); end if;
  select * into sv from public.services where id = p_service_id and user_id = pg.user_id and active;
  if not found then return jsonb_build_object('ok', false, 'message', 'Pick a service first.'); end if;
  if length(nm) < 2 or length(nm) > 120 then return jsonb_build_object('ok', false, 'message', 'Add your name.'); end if;
  if em is null and ph is null then return jsonb_build_object('ok', false, 'message', 'Add an email or a phone number so they can confirm.'); end if;
  if em is not null and (length(em) > 200 or em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then return jsonb_build_object('ok', false, 'message', 'That email does not look right.'); end if;
  if ph is not null and length(ph) > 40 then return jsonb_build_object('ok', false, 'message', 'That phone number is too long.'); end if;
  if p_starts_at is null or p_starts_at < now() + interval '1 hour' or p_starts_at > now() + interval '60 days' then return jsonb_build_object('ok', false, 'message', 'Pick a time in the next 60 days.'); end if;
  select coalesce(timezone, 'Australia/Sydney') into tz from public.profiles where id = pg.user_id;
  lt := p_starts_at at time zone tz; dow := extract(dow from lt)::int; mins := sv.minutes;
  if not (dow = any (pg.days)) or lt::time < pg.day_start or (lt + make_interval(mins => mins))::time > pg.day_end or (lt + make_interval(mins => mins))::date <> lt::date then
    return jsonb_build_object('ok', false, 'message', 'That time is outside their hours. Pick another.');
  end if;
  if exists (select 1 from public.bookings b where b.user_id = pg.user_id and b.status in ('requested', 'booked')
             and b.starts_at < p_starts_at + make_interval(mins => mins) and b.starts_at + make_interval(mins => b.minutes) > p_starts_at) then
    return jsonb_build_object('ok', false, 'message', 'That time has just been taken. Pick another.');
  end if;
  if (select count(*) from public.bookings b where b.user_id = pg.user_id and b.source = 'link' and b.created_at > now() - interval '1 day') >= 20 then
    return jsonb_build_object('ok', false, 'message', 'They have had a lot of requests today. Try again tomorrow.');
  end if;
  insert into public.bookings (user_id, client_name, client_email, client_phone, service_id, title, starts_at, minutes, status, source, notes)
  values (pg.user_id, nm, em, ph, sv.id, sv.name, p_starts_at, mins, 'requested', 'link', left(trim(coalesce(p_note, '')), 1000));
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.booking_request_public(text, uuid, timestamptz, text, text, text, text) from public;
grant execute on function public.booking_request_public(text, uuid, timestamptz, text, text, text, text) to anon, authenticated, service_role;
