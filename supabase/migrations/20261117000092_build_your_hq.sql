-- 17 Nov 2026 (Taj: "All my picks do it all"): Build your HQ.
--
-- Today becomes blocks each person adds, removes, moves and resizes, one home per mode
-- (Life, Business, and one per extra business). Trackers keep count of anything. A Business
-- owner can set a team home. Layouts can be shared by link.
--
--   home_layouts      one row per person per home: the ordered blocks
--   trackers          what is being counted and how it looks
--   tracker_entries   each log
--   team_layouts      the owner's team home per business (pinned and suggested blocks)
--   shared_layouts    a layout shared by link (layout only unless numbers are switched on)
--   tracker_reads     Tali's "why it changed" cards
--   home_notes        Tali's pick, nudges and "your team home changed" notes
--   customer_reviews  reviews an owner logs, for the Customer happiness block
--   site_visits       a daily count per page of a hosted website, for the Website visits block
--
-- Free limits are checked here as well as in the app: 6 blocks a home, 3 trackers a home,
-- number and bar looks, day or week targets, 7 days of history, no Tali check-ins.
-- A teammate never reads the owner's tables directly: only through the functions below, which
-- leave out anything their seat is not allowed to see. Nothing here touches the brain schema.

-- ── Which plan is this person on? ───────────────────────────────────────────────────────
-- 'free', 'hq', 'pro', 'max' or 'biz' (a Business plan). A running trial counts as its plan.
create or replace function public.hq_plan(p_user uuid)
returns text language sql stable security definer set search_path to '' as $function$
  select case
    when p_user = 'e89ca9de-a86e-4dd6-8094-bc518566352e'::uuid then 'biz'
    else coalesce((
      select case
        when s.status in ('active', 'past_due') and s.plan_id = 'max' and s.business_tier is not null then 'biz'
        when s.status = 'trialing' and s.trial_ends_at > now() then case when s.plan_id in ('hq', 'pro', 'max') then s.plan_id else 'hq' end
        when s.status in ('active', 'past_due') and s.plan_id in ('hq', 'pro', 'max') then s.plan_id
        else 'free' end
      from public.subscriptions s where s.user_id = p_user), 'free')
  end;
$function$;
revoke all on function public.hq_plan(uuid) from public, anon;
grant execute on function public.hq_plan(uuid) to authenticated;

-- ── Layouts ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.home_layouts (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- 'life', 'business', 'business:<business id>' or 'team:<owner id>' (a teammate's own tweaks to a team home)
  home_key text not null check (home_key ~ '^(life|business|business:[0-9a-f-]{36}|team:[0-9a-f-]{36})$'),
  blocks jsonb not null default '[]'::jsonb check (jsonb_typeof(blocks) = 'array' and pg_column_size(blocks) < 60000),
  updated_at timestamptz not null default now(),
  primary key (user_id, home_key)
);
alter table public.home_layouts enable row level security;
revoke all on public.home_layouts from anon;
create policy "home layouts: own all" on public.home_layouts
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Free: 6 blocks showing on a home. Blocks marked hidden or parked ("Didn't fit on Free") do not count.
create or replace function public.home_layouts_limit()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare n integer;
begin
  new.updated_at := now();
  if new.home_key like 'team:%' then return new; end if;
  if public.hq_plan(new.user_id) = 'free' then
    select count(*) into n from jsonb_array_elements(new.blocks) b
     where coalesce((b->>'hidden')::boolean, false) = false and coalesce((b->>'parked')::boolean, false) = false;
    if n > 6 then raise exception 'Free fits 6 blocks on a home. Take one off, or go paid for no limit.' using errcode = 'P0001'; end if;
  end if;
  return new;
end;
$function$;
create or replace trigger home_layouts_limit before insert or update on public.home_layouts
  for each row execute function public.home_layouts_limit();

-- ── Trackers ────────────────────────────────────────────────────────────────────────────
create table if not exists public.trackers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  type text not null check (type in ('count', 'yesno', 'money', 'time', 'scale')),
  unit text not null default '' check (char_length(unit) <= 16),
  target numeric check (target is null or target >= 0),
  period text not null default 'day' check (period in ('day', 'week', 'month', 'total')),
  style text not null default 'bar' check (style in ('ring', 'bar', 'number', 'streak', 'chart')),
  colour text not null default '#B9A6FF' check (colour ~ '^#[0-9A-Fa-f]{6}$'),
  -- What one tap of + adds. Null means a tap asks for the amount.
  step numeric check (step is null or step > 0),
  -- For things that start somewhere and count down (a debt): where it started.
  start_value numeric not null default 0,
  count_down boolean not null default false,
  check_in boolean not null default false,
  rest_day boolean not null default false,
  -- Where it logs from. Anything but 'manual' fills itself in (Pro and up).
  source text not null default 'manual' check (source in ('manual', 'invoices_paid', 'quotes_sent', 'jobs_done', 'bookings', 'spend', 'health')),
  preset text,
  home text not null default 'life' check (home in ('life', 'business', 'both')),
  -- A team tracker: everyone on the owner's team logs to it (Business plans).
  team boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trackers_user_idx on public.trackers (user_id) where archived_at is null;
alter table public.trackers enable row level security;
revoke all on public.trackers from anon;
create policy "trackers: own all" on public.trackers
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function public.trackers_limit()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare plan text := public.hq_plan(new.user_id); n integer;
begin
  new.updated_at := now();
  if plan = 'free' then
    if tg_op = 'INSERT' or new.style is distinct from old.style then
      new.style := case when new.style in ('number', 'bar') then new.style else 'bar' end;
    end if;
    if tg_op = 'INSERT' or new.period is distinct from old.period then
      new.period := case when new.period in ('day', 'week') then new.period else 'week' end;
    end if;
    new.check_in := false;
    if new.archived_at is null and (tg_op = 'INSERT' or old.archived_at is not null or new.home is distinct from old.home) then
      select count(*) into n from public.trackers t
       where t.user_id = new.user_id and t.archived_at is null and t.id <> new.id
         and (t.home = new.home or t.home = 'both' or new.home = 'both');
      if n >= 3 then raise exception 'Free has 3 trackers on a home. Archive one, or go paid for no limit.' using errcode = 'P0001'; end if;
    end if;
  end if;
  if plan not in ('pro', 'max', 'biz') then new.source := 'manual'; end if;
  if plan <> 'biz' then new.team := false; end if;
  return new;
end;
$function$;
create or replace trigger trackers_limit before insert or update on public.trackers
  for each row execute function public.trackers_limit();

create table if not exists public.tracker_entries (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null references public.trackers(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  amount numeric not null check (amount between -100000000 and 100000000),
  -- The day it counts for (the person's own date), so yesterday's water can be logged today.
  day date not null,
  note text check (note is null or char_length(note) <= 300),
  source text not null default 'tap' check (source in ('tap', 'tali', 'auto')),
  created_at timestamptz not null default now()
);
create index if not exists tracker_entries_tracker_day_idx on public.tracker_entries (tracker_id, day);
create index if not exists tracker_entries_user_idx on public.tracker_entries (user_id, day);
alter table public.tracker_entries enable row level security;
revoke all on public.tracker_entries from anon, authenticated;
-- Logging goes through tracker_log (it checks team seats). People can read, fix and remove their own.
grant select, update, delete on public.tracker_entries to authenticated;
-- Free sees the last 7 days. Paid sees all of it. Nothing is deleted on Free: it comes back on a paid plan.
create policy "tracker entries: own read" on public.tracker_entries
  for select to authenticated using (
    user_id = (select auth.uid())
    and (day >= (current_date - 8) or (select public.hq_plan((select auth.uid()))) <> 'free'));
create policy "tracker entries: own change" on public.tracker_entries
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "tracker entries: own remove" on public.tracker_entries
  for delete to authenticated using (user_id = (select auth.uid()));

-- Can this person log to and read this tracker? Their own, or a team tracker of a team they are on.
create or replace function public.hq_tracker_access(p_tracker uuid, p_user uuid)
returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (
    select 1 from public.trackers t
     where t.id = p_tracker and t.archived_at is null
       and (t.user_id = p_user
         or (t.team and public.team_owner_live(t.user_id) and exists (
              select 1 from public.team_members m where m.owner_id = t.user_id and m.member_id = p_user and m.status = 'active'))));
$function$;
revoke all on function public.hq_tracker_access(uuid, uuid) from public, anon, authenticated;

-- Log an amount. Yes or no and 1 to 5 trackers hold one answer a day, so a second log replaces the first.
create or replace function public.tracker_log(p_tracker uuid, p_amount numeric, p_day date, p_note text default null, p_source text default 'tap')
returns uuid language plpgsql security definer set search_path to '' as $function$
declare me uuid := (select auth.uid()); t public.trackers; e uuid; amt numeric := p_amount;
begin
  if me is null or p_amount is null or p_day is null then return null; end if;
  if not public.hq_tracker_access(p_tracker, me) then raise exception 'That tracker is not yours to log to.' using errcode = 'P0001'; end if;
  if p_day > current_date + 1 or p_day < current_date - 3660 then raise exception 'Pick a day that has happened.' using errcode = 'P0001'; end if;
  select * into t from public.trackers where id = p_tracker;
  if t.type = 'yesno' then amt := case when p_amount > 0 then 1 else 0 end; end if;
  if t.type = 'scale' then amt := greatest(1, least(5, round(p_amount))); end if;
  if t.type in ('yesno', 'scale') then
    update public.tracker_entries set amount = amt, note = coalesce(nullif(btrim(p_note), ''), note), created_at = now()
     where tracker_id = p_tracker and user_id = me and day = p_day
     returning id into e;
    if e is not null then return e; end if;
  end if;
  insert into public.tracker_entries (tracker_id, user_id, amount, day, note, source)
  values (p_tracker, me, amt, p_day, nullif(left(btrim(coalesce(p_note, '')), 300), ''), case when p_source in ('tap', 'tali') then p_source else 'tap' end)
  returning id into e;
  return e;
end;
$function$;
revoke all on function public.tracker_log(uuid, numeric, date, text, text) from public, anon;
grant execute on function public.tracker_log(uuid, numeric, date, text, text) to authenticated;

-- A tracker's numbers by day between two dates, plus everything before the first date.
-- p_user null means everyone who logs to it (a team tracker's total). Trackers that fill
-- themselves in read the owner's own invoices, jobs, bookings or spending (Pro and up).
create or replace function public.hq_tracker_days(p_tracker uuid, p_user uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  t public.trackers; tz text; days jsonb; before numeric; auto boolean;
begin
  select * into t from public.trackers where id = p_tracker;
  if t.id is null then return jsonb_build_object('days', '{}'::jsonb, 'before', 0); end if;
  select coalesce(p.timezone, 'Australia/Sydney') into tz from public.profiles p where p.id = t.user_id;
  tz := coalesce(tz, 'Australia/Sydney');
  auto := t.source <> 'manual' and t.source <> 'health' and public.hq_plan(t.user_id) in ('pro', 'max', 'biz');
  with rows as (
    select e.day d, e.amount a from public.tracker_entries e
     where e.tracker_id = p_tracker and (p_user is null or e.user_id = p_user)
    union all
    select (i.paid_at at time zone tz)::date, i.total from public.invoices i
     where auto and t.source = 'invoices_paid' and i.user_id = t.user_id and i.status = 'paid' and i.paid_at is not null
    union all
    select (j.sent_at at time zone tz)::date, 1 from public.jobs j
     where auto and t.source = 'quotes_sent' and j.user_id = t.user_id and j.sent_at is not null
    union all
    select (j.done_at at time zone tz)::date, 1 from public.jobs j
     where auto and t.source = 'jobs_done' and j.user_id = t.user_id and j.done_at is not null
    union all
    select (b.starts_at at time zone tz)::date, 1 from public.bookings b
     where auto and t.source = 'bookings' and b.user_id = t.user_id and b.status in ('booked', 'done')
    union all
    select s.local_date, s.amount from public.personal_spends s
     where auto and t.source = 'spend' and s.user_id = t.user_id
  )
  select coalesce(jsonb_object_agg(d, a) filter (where d is not null), '{}'::jsonb), coalesce(max(b), 0)
    into days, before
    from (
      select d::text d, sum(a) a, null::numeric b from rows where d between p_from and p_to group by d
      union all
      select null, null, coalesce(sum(a), 0) from rows where d < p_from
    ) x;
  return jsonb_build_object('days', days, 'before', before);
end;
$function$;
revoke all on function public.hq_tracker_days(uuid, uuid, date, date) from public, anon, authenticated;

-- Every tracker this person has (their own and any team tracker they can log to), each with the
-- last 120 days by day. The app works out this period's number, the week and the streak from that
-- with one shared function, so a tile and its history page always agree.
create or replace function public.my_trackers(p_today date)
returns jsonb language sql stable security definer set search_path to '' as $function$
  with me as (select (select auth.uid()) id),
  mine as (
    select t.*, false as shared_in, null::text as owner_name
      from public.trackers t where t.user_id = (select id from me)
    union all
    select t.*, true, coalesce(nullif(p.business_name, ''), nullif(p.first_name, ''), 'Your team')
      from public.trackers t
      join public.team_members m on m.owner_id = t.user_id
      left join public.profiles p on p.id = t.user_id
     where m.member_id = (select id from me) and m.status = 'active' and t.team and t.archived_at is null
       and public.team_owner_live(m.owner_id)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'name', t.name, 'type', t.type, 'unit', t.unit, 'target', t.target, 'period', t.period,
    'style', t.style, 'colour', t.colour, 'step', t.step, 'start_value', t.start_value, 'count_down', t.count_down,
    'check_in', t.check_in, 'rest_day', t.rest_day, 'source', t.source, 'preset', t.preset, 'home', t.home,
    'team', t.team, 'shared_in', t.shared_in, 'owner_name', t.owner_name, 'archived_at', t.archived_at, 'created_at', t.created_at,
    'mine', public.hq_tracker_days(t.id, case when t.team then (select id from me) else null end, p_today - 119, p_today),
    'everyone', case when t.team then public.hq_tracker_days(t.id, null, p_today - 119, p_today) end
  ) order by t.created_at), '[]'::jsonb)
  from mine t;
$function$;
revoke all on function public.my_trackers(date) from public, anon;
grant execute on function public.my_trackers(date) to authenticated;

-- One tracker in full for its history page. Free gets the last 7 days, paid plans all of it.
-- For a team tracker the owner also gets each person's share.
create or replace function public.my_tracker(p_tracker uuid, p_today date)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare me uuid := (select auth.uid()); t public.trackers; first_day date; free boolean;
begin
  if me is null or not public.hq_tracker_access(p_tracker, me) then
    -- An archived tracker can still be opened by its owner.
    if not exists (select 1 from public.trackers x where x.id = p_tracker and x.user_id = me) then return null; end if;
  end if;
  select * into t from public.trackers where id = p_tracker;
  free := public.hq_plan(me) = 'free';
  first_day := case when free then p_today - 6 else least(p_today - 6, coalesce((select min(day) from public.tracker_entries where tracker_id = p_tracker), p_today), t.created_at::date - 400) end;
  if not free and t.source <> 'manual' then first_day := least(first_day, p_today - 730); end if;
  return jsonb_build_object(
    'first_day', first_day,
    'mine', public.hq_tracker_days(p_tracker, case when t.team then me else null end, first_day, p_today),
    'everyone', case when t.team then public.hq_tracker_days(p_tracker, null, first_day, p_today) end,
    'people', case when t.team and t.user_id = me then coalesce((
      select jsonb_agg(jsonb_build_object('name', x.name, 'amount', x.amount) order by x.amount desc) from (
        select coalesce(m.name, 'You') as name, sum(e.amount) as amount
          from public.tracker_entries e
          left join public.team_members m on m.owner_id = t.user_id and m.member_id = e.user_id
         where e.tracker_id = p_tracker and e.day >= case t.period
                 when 'day' then p_today
                 when 'week' then p_today - ((extract(isodow from p_today)::int) - 1)
                 when 'month' then date_trunc('month', p_today)::date
                 else '1900-01-01'::date end
         group by 1) x), '[]'::jsonb) end);
end;
$function$;
revoke all on function public.my_tracker(uuid, date) from public, anon;
grant execute on function public.my_tracker(uuid, date) to authenticated;

-- ── Tali's reads, picks and nudges ──────────────────────────────────────────────────────
create table if not exists public.tracker_reads (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null references public.trackers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('weekly', 'daily', 'ask')),
  for_date date not null,
  body text not null check (char_length(body) between 1 and 700),
  thumbs smallint check (thumbs in (-1, 1)),
  created_at timestamptz not null default now()
);
create index if not exists tracker_reads_tracker_idx on public.tracker_reads (tracker_id, created_at desc);
alter table public.tracker_reads enable row level security;
revoke all on public.tracker_reads from anon, authenticated;
grant select on public.tracker_reads to authenticated;
grant update (thumbs) on public.tracker_reads to authenticated;
create policy "tracker reads: own read" on public.tracker_reads for select to authenticated using (user_id = (select auth.uid()));
create policy "tracker reads: own thumbs" on public.tracker_reads for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.home_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  for_date date not null,
  kind text not null check (kind in ('pick', 'nudge', 'team')),
  side text check (side in ('life', 'business')),
  tracker_id uuid references public.trackers(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  seen_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists home_notes_user_idx on public.home_notes (user_id, for_date desc);
alter table public.home_notes enable row level security;
revoke all on public.home_notes from anon, authenticated;
grant select on public.home_notes to authenticated;
grant update (seen_at) on public.home_notes to authenticated;
create policy "home notes: own read" on public.home_notes for select to authenticated using (user_id = (select auth.uid()));
create policy "home notes: own seen" on public.home_notes for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── Team layouts ────────────────────────────────────────────────────────────────────────
create table if not exists public.team_layouts (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business_key text not null default 'main' check (business_key ~ '^(main|[0-9a-f-]{36})$'),
  -- Each block carries pin: 'pinned' (set by the owner) or 'suggested'.
  blocks jsonb not null default '[]'::jsonb check (jsonb_typeof(blocks) = 'array' and pg_column_size(blocks) < 60000),
  pushed jsonb,
  pushed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (owner_id, business_key)
);
alter table public.team_layouts enable row level security;
revoke all on public.team_layouts from anon;
create policy "team layouts: owner all" on public.team_layouts
  for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Is this block allowed for this seat? Permissions win over the layout, pinned or not.
create or replace function public.hq_block_allowed(p_block jsonb, p_money boolean, p_pipeline boolean, p_customers boolean)
returns boolean language sql immutable set search_path to '' as $function$
  select case
    when p_block->>'kind' <> 'builtin' then true
    when p_block->>'builtin' in ('money', 'invoices', 'cashflow') then p_money
    when p_block->>'builtin' in ('pipeline', 'leads', 'bookings', 'quote_rate') then p_pipeline
    when p_block->>'builtin' in ('people', 'happiness') then p_customers
    else true end;
$function$;

-- The owner sends the team layout out. Each teammate gets one note saying what changed.
create or replace function public.team_layout_push(p_business text, p_blocks jsonb, p_note text)
returns integer language plpgsql security definer set search_path to '' as $function$
declare me uuid := (select auth.uid()); n integer := 0; who text; today date;
begin
  if me is null or not public.team_owner_live(me) then raise exception 'Team layouts come with the Business plans.' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_blocks) <> 'array' then return 0; end if;
  insert into public.team_layouts (owner_id, business_key, blocks, pushed, pushed_at, updated_at)
  values (me, coalesce(p_business, 'main'), p_blocks, p_blocks, now(), now())
  on conflict (owner_id, business_key) do update set blocks = excluded.blocks, pushed = excluded.pushed, pushed_at = now(), updated_at = now();
  select coalesce(nullif(p.first_name, ''), 'The owner'), (now() at time zone coalesce(p.timezone, 'Australia/Sydney'))::date
    into who, today from public.profiles p where p.id = me;
  insert into public.home_notes (user_id, for_date, kind, side, body)
  select m.member_id, coalesce(today, current_date), 'team', 'business',
         left(coalesce(who, 'The owner') || ' updated your team home' || case when nullif(btrim(coalesce(p_note, '')), '') is null then '.' else ': ' || btrim(p_note) end, 500)
    from public.team_members m where m.owner_id = me and m.member_id is not null and m.status = 'active';
  get diagnostics n = row_count;
  return n;
end;
$function$;
revoke all on function public.team_layout_push(text, jsonb, text) from public, anon;
grant execute on function public.team_layout_push(text, jsonb, text) to authenticated;

-- What a teammate sees: the pushed team home of each team they are on, minus what their seat cannot see.
create or replace function public.team_home()
returns jsonb language sql stable security definer set search_path to '' as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'owner_id', m.owner_id, 'business_key', l.business_key,
    'business', coalesce(nullif(p.business_name, ''), nullif(p.first_name, ''), 'Your team'),
    'owner_name', coalesce(nullif(p.first_name, ''), 'The owner'),
    'pushed_at', l.pushed_at,
    'can_money', m.can_money, 'can_pipeline', m.can_pipeline, 'can_customers', m.can_customers,
    'blocks', coalesce((select jsonb_agg(b order by ord) from jsonb_array_elements(l.pushed) with ordinality as x(b, ord)
                         where public.hq_block_allowed(b, m.can_money, m.can_pipeline, m.can_customers)), '[]'::jsonb)
  ) order by m.joined_at), '[]'::jsonb)
  from public.team_members m
  join public.team_layouts l on l.owner_id = m.owner_id and l.pushed is not null
  left join public.profiles p on p.id = m.owner_id
  where m.member_id = (select auth.uid()) and m.status = 'active' and public.team_owner_live(m.owner_id);
$function$;
revoke all on function public.team_home() from public, anon;
grant execute on function public.team_home() to authenticated;

-- ── Sharing ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.shared_layouts (
  slug text primary key check (slug ~ '^[a-z0-9-]{4,40}$'),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  home text not null check (home in ('life', 'business')),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  about text not null default '' check (char_length(about) <= 300),
  -- A snapshot: blocks, targets and looks. Numbers are only in it when show_numbers is on.
  blocks jsonb not null check (jsonb_typeof(blocks) = 'array' and pg_column_size(blocks) < 60000),
  show_numbers boolean not null default false,
  featured_ok boolean not null default false,
  active boolean not null default true,
  copies integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shared_layouts_user_idx on public.shared_layouts (user_id);
alter table public.shared_layouts enable row level security;
revoke all on public.shared_layouts from anon;
create policy "shared layouts: own all" on public.shared_layouts
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select public.hq_plan((select auth.uid()))) <> 'free');

-- Anyone with the link: the layout only.
create or replace function public.shared_layout(p_slug text)
returns jsonb language sql stable security definer set search_path to '' as $function$
  select jsonb_build_object('slug', s.slug, 'home', s.home, 'name', s.name, 'about', s.about, 'blocks', s.blocks,
                            'show_numbers', s.show_numbers, 'copies', s.copies)
    from public.shared_layouts s where s.slug = lower(p_slug) and s.active;
$function$;
revoke all on function public.shared_layout(text) from public;
grant execute on function public.shared_layout(text) to anon, authenticated;

create or replace function public.shared_layout_used(p_slug text)
returns void language sql security definer set search_path to '' as $function$
  update public.shared_layouts set copies = copies + 1 where slug = lower(p_slug) and active and user_id <> (select auth.uid());
$function$;
revoke all on function public.shared_layout_used(text) from public, anon;
grant execute on function public.shared_layout_used(text) to authenticated;

-- ── Customer happiness and website visits ───────────────────────────────────────────────
create table if not exists public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  name text not null default '' check (char_length(name) <= 80),
  rating smallint not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 1500),
  place text not null default '' check (char_length(place) <= 40),
  replied boolean not null default false,
  day date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists customer_reviews_user_idx on public.customer_reviews (user_id, day desc);
alter table public.customer_reviews enable row level security;
revoke all on public.customer_reviews from anon;
create policy "customer reviews: own all" on public.customer_reviews
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.site_visits (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  path text not null default '/' check (char_length(path) <= 120),
  n integer not null default 0,
  primary key (user_id, day, path)
);
alter table public.site_visits enable row level security;
revoke all on public.site_visits from anon, authenticated;
grant select on public.site_visits to authenticated;
create policy "site visits: own read" on public.site_visits for select to authenticated using (user_id = (select auth.uid()));

-- Called by a hosted website when a page is opened. Counts only, nothing about the visitor is kept.
create or replace function public.site_visit(p_slug text, p_path text default '/')
returns void language plpgsql security definer set search_path to '' as $function$
declare owner uuid; tz text;
begin
  select s.user_id into owner from public.sites s where s.slug = lower(p_slug) and s.published;
  if owner is null then return; end if;
  select coalesce(p.timezone, 'Australia/Sydney') into tz from public.profiles p where p.id = owner;
  insert into public.site_visits (user_id, day, path, n)
  values (owner, (now() at time zone coalesce(tz, 'Australia/Sydney'))::date, left(coalesce(nullif(btrim(p_path), ''), '/'), 120), 1)
  on conflict (user_id, day, path) do update set n = public.site_visits.n + 1;
end;
$function$;
revoke all on function public.site_visit(text, text) from public;
grant execute on function public.site_visit(text, text) to anon, authenticated;

-- ── The Business blocks ─────────────────────────────────────────────────────────────────
-- Team, Leads, Cash flow, Bookings today, Website visits, Quote win rate and Customer happiness
-- in one call. The owner gets all of it. A teammate passes the owner's id and gets only what
-- their seat can see. p_business: 'all', 'main' or a business id.
create or replace function public.hq_business_board(p_owner uuid, p_business text, p_today date)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  me uuid := (select auth.uid());
  own uuid := coalesce(p_owner, (select auth.uid()));
  seat public.team_members;
  money boolean := true; pipe boolean := true; cust boolean := true; mine boolean := true;
  tz text; wk date := p_today - ((extract(isodow from p_today)::int) - 1); mo date := date_trunc('month', p_today)::date;
  biz uuid := case when p_business ~ '^[0-9a-f-]{36}$' then p_business::uuid end;
  allb boolean := coalesce(p_business, 'all') = 'all';
  res jsonb := '{}'::jsonb;
begin
  if me is null then return null; end if;
  if own <> me then
    select * into seat from public.team_members m where m.owner_id = own and m.member_id = me and m.status = 'active';
    if seat.id is null then return null; end if;
    money := seat.can_money; pipe := seat.can_pipeline; cust := seat.can_customers; mine := false; allb := true;
  end if;
  if not public.team_owner_live(own) then return jsonb_build_object('locked', true); end if;
  select coalesce(p.timezone, 'Australia/Sydney') into tz from public.profiles p where p.id = own;
  tz := coalesce(tz, 'Australia/Sydney');

  res := res || jsonb_build_object('team', jsonb_build_object(
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', t.name, 'role_title', t.role_title, 'status', t.status, 'me', t.member_id = me,
        'jobs', coalesce((select jsonb_agg(j.title order by j.updated_at desc) from public.job_people jp join public.jobs j on j.id = jp.job_id
                           where jp.team_member_id = t.id and j.status in ('accepted', 'on')), '[]'::jsonb),
        'tasks_open', (select count(*) from public.project_tasks pt where pt.assignee_id = t.id and pt.done_at is null),
        'overdue', (select count(*) from public.project_tasks pt where pt.assignee_id = t.id and pt.done_at is null and pt.due_date < p_today)
      ) order by t.created_at)
      from public.team_members t where t.owner_id = own), '[]'::jsonb)));

  if pipe then
    res := res || jsonb_build_object(
      'leads', jsonb_build_object(
        'new_week', (select count(*) from public.clients c where c.user_id = own and c.kind = 'lead' and (c.created_at at time zone tz)::date >= wk),
        'need_reply', (select count(*) from public.clients c where c.user_id = own and c.kind = 'lead' and c.status in ('new', 'talking')
                        and (c.status = 'new' or (c.next_follow_up is not null and c.next_follow_up <= p_today))),
        'new', (select count(*) from public.clients c where c.user_id = own and c.kind = 'lead' and c.status = 'new'),
        'talking', (select count(*) from public.clients c where c.user_id = own and c.kind = 'lead' and c.status = 'talking'),
        'won_month', (select count(*) from public.clients c where c.user_id = own and c.status = 'won' and (c.updated_at at time zone tz)::date >= mo),
        'names', coalesce((select jsonb_agg(x.name) from (select c.name from public.clients c where c.user_id = own and c.kind = 'lead' and c.status = 'new' order by c.created_at desc limit 3) x), '[]'::jsonb)),
      'bookings', jsonb_build_object(
        'today', coalesce((
          select jsonb_agg(jsonb_build_object('id', b.id, 'title', b.title, 'client_name', b.client_name, 'starts_at', b.starts_at, 'minutes', b.minutes, 'status', b.status) order by b.starts_at)
            from public.bookings b
           where b.user_id = own and (b.starts_at at time zone tz)::date = p_today and b.status <> 'cancelled'
             and (allb or b.business_id is not distinct from biz)), '[]'::jsonb),
        'cancelled', (select count(*) from public.bookings b where b.user_id = own and (b.starts_at at time zone tz)::date = p_today and b.status = 'cancelled' and (allb or b.business_id is not distinct from biz)),
        'requested', (select count(*) from public.bookings b where b.user_id = own and b.status = 'requested' and b.starts_at >= now() and (allb or b.business_id is not distinct from biz)),
        'week', (select count(*) from public.bookings b where b.user_id = own and (b.starts_at at time zone tz)::date between wk and wk + 6 and b.status in ('booked', 'done') and (allb or b.business_id is not distinct from biz))),
      'quote_rate', (
        select jsonb_build_object(
          'won', count(*) filter (where j.accepted_at is not null or j.status in ('accepted', 'on', 'done', 'invoiced')),
          'lost', count(*) filter (where j.status = 'lost'),
          'waiting', count(*) filter (where j.status = 'sent'),
          'won_value', case when money or mine then coalesce(sum(j.total) filter (where j.accepted_at is not null or j.status in ('accepted', 'on', 'done', 'invoiced')), 0) end)
          from public.jobs j
         where j.user_id = own and j.sent_at is not null and j.sent_at >= now() - interval '90 days'
           and (allb or j.business_id is not distinct from biz)));
  end if;

  if money then
    res := res || jsonb_build_object('cashflow', jsonb_build_object(
      'in_month', (select coalesce(sum(i.total), 0) from public.invoices i where i.user_id = own and i.status = 'paid' and (i.paid_at at time zone tz)::date >= mo and (allb or i.business_id is not distinct from biz)),
      'out_month', (select coalesce(sum(r.amount), 0) from public.receipts r where r.user_id = own and r.date >= mo and (allb or r.business_id is not distinct from biz)),
      'owed', (select coalesce(sum(i.total), 0) from public.invoices i where i.user_id = own and i.status = 'sent' and (allb or i.business_id is not distinct from biz)),
      'late', (select coalesce(sum(i.total), 0) from public.invoices i where i.user_id = own and i.status = 'sent' and i.due_date < p_today and (allb or i.business_id is not distinct from biz)),
      'due_30', (select coalesce(sum(i.total), 0) from public.invoices i where i.user_id = own and i.status = 'sent' and i.due_date between p_today and p_today + 30 and (allb or i.business_id is not distinct from biz)),
      'costs_month', (select p.monthly_costs from public.profiles p where p.id = own)));
  end if;

  if cust then
    res := res || jsonb_build_object('happiness', jsonb_build_object(
      'count', (select count(*) from public.customer_reviews r where r.user_id = own and (allb or r.business_id is not distinct from biz)),
      'average', (select round(avg(r.rating)::numeric, 1) from public.customer_reviews r where r.user_id = own and (allb or r.business_id is not distinct from biz)),
      'no_reply', (select count(*) from public.customer_reviews r where r.user_id = own and not r.replied and (allb or r.business_id is not distinct from biz)),
      'recent', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select r.id, r.name, r.rating, r.body, r.place, r.replied, r.day from public.customer_reviews r
         where r.user_id = own and (allb or r.business_id is not distinct from biz) order by r.day desc, r.created_at desc limit 3) x), '[]'::jsonb)));
  end if;

  res := res || jsonb_build_object('visits', jsonb_build_object(
    'has_site', exists (select 1 from public.sites s where s.user_id = own and s.published),
    'week', (select coalesce(sum(v.n), 0) from public.site_visits v where v.user_id = own and v.day between wk and wk + 6),
    'last_week', (select coalesce(sum(v.n), 0) from public.site_visits v where v.user_id = own and v.day between wk - 7 and wk - 1),
    'top', (select v.path from public.site_visits v where v.user_id = own and v.day >= wk - 7 group by v.path order by sum(v.n) desc limit 1)));

  return res || jsonb_build_object('can_money', money, 'can_pipeline', pipe, 'can_customers', cust);
end;
$function$;
revoke all on function public.hq_business_board(uuid, text, date) from public, anon;
grant execute on function public.hq_business_board(uuid, text, date) to authenticated;

-- ── What Tali reads about trackers ──────────────────────────────────────────────────────
-- For the morning brief run (her pick, check-ins and "why it changed") and for Ask why. Each
-- tracker with its last 4 weeks by day. Server only: the app never calls this.
create or replace function public.hq_tracker_context(p_user uuid, p_today date)
returns jsonb language sql stable security definer set search_path to '' as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'name', t.name, 'type', t.type, 'unit', t.unit, 'target', t.target, 'target_is_per', t.period,
    'home', t.home, 'check_in', t.check_in, 'counts_down_from', case when t.count_down then t.start_value end,
    'by_day', (public.hq_tracker_days(t.id, null, p_today - 27, p_today))->'days',
    'before_that', (public.hq_tracker_days(t.id, null, p_today - 27, p_today))->'before'
  ) order by t.created_at), '[]'::jsonb)
  from (select * from public.trackers x where x.user_id = p_user and x.archived_at is null order by x.created_at limit 30) t;
$function$;
revoke all on function public.hq_tracker_context(uuid, date) from public, anon, authenticated;
grant execute on function public.hq_tracker_context(uuid, date) to service_role;
grant execute on function public.hq_plan(uuid) to service_role;
grant execute on function public.hq_tracker_days(uuid, uuid, date, date) to service_role;

-- ── The Plans screen ────────────────────────────────────────────────────────────────────
-- One new line on each plan for what Build your HQ gives it. Only what is built is listed.
-- Safe to run twice: a line already there is not added again.
update public.plans p set features = p.features || to_jsonb(x.line)
  from (values
    ('free', 'Build your home: 6 blocks and 3 trackers, with a countdown and a note'),
    ('hq', 'Build your HQ: no limit on blocks or trackers, every look, your full history, templates, a checklist, bills coming up, sharing by link and Tali''s pick each morning'),
    ('pro', 'Trackers that fill themselves in from your invoices, quotes, jobs, bookings and spending, check-ins in Tali''s own words, and a weekly read on why a tracker changed'),
    ('max', 'A daily read from Tali on why your trackers changed')
  ) as x(id, line)
 where p.id = x.id and not (p.features @> to_jsonb(x.line));
