-- 12 Nov 2026 (Taj: "Build it all"): team seats on the Business plans.
--
-- The owner of a Business account invites teammates. Each teammate has their own Tali HQ login
-- and their own Tali credits (a Standard seat is the Tali HQ allowance, a Premium seat is the
-- Pro allowance). A teammate always sees the jobs and tasks given to them. The owner switches
-- on more per person: customers, quotes and prices, invoices and money, pipeline and bookings.
--
-- How a teammate sees the owner's work: only through the functions at the bottom of this file,
-- which hand back exactly what that person is allowed to see (prices are left out unless the
-- owner switched them on). None of the owner's tables get a new policy, so nothing about who
-- can read jobs, customers or invoices directly has changed. Nobody on a team can read the
-- owner's journal, Life side or Tali's memories: no function here touches them.
--
-- Seats are billed by the business-admin function as extra items on the owner's Business
-- subscription. This file never talks to Stripe.

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  -- Filled in when the invited person signs in with the invited email (team_claim).
  member_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  email text not null check (email = lower(email)),
  role_title text not null default '',
  seat text not null default 'standard' check (seat in ('standard', 'premium')),
  can_customers boolean not null default false,
  can_prices boolean not null default false,
  can_money boolean not null default false,
  can_pipeline boolean not null default false,
  status text not null default 'invited' check (status in ('invited', 'active')),
  created_at timestamptz not null default now(),
  joined_at timestamptz,
  unique (owner_id, email)
);
create index if not exists team_members_member_idx on public.team_members (member_id);

alter table public.team_members enable row level security;
revoke all on public.team_members from anon, authenticated;
grant select, delete on public.team_members to authenticated;
-- The owner sees their team. A teammate sees their own row, and can take themselves off.
-- Adding people and changing seats goes through business-admin (it bills), and what a person
-- can see is changed with team_set_access below.
create policy "team: owner or the person, read" on public.team_members
  for select to authenticated using (owner_id = (select auth.uid()) or member_id = (select auth.uid()));
create policy "team: the person can leave" on public.team_members
  for delete to authenticated using (member_id = (select auth.uid()));

-- Who is on a job.
create table if not exists public.job_people (
  job_id uuid not null references public.jobs(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (job_id, team_member_id)
);
alter table public.job_people enable row level security;
create policy "job people: own all" on public.job_people
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.jobs j where j.id = job_id and j.user_id = (select auth.uid()))
    and exists (select 1 from public.team_members m where m.id = team_member_id and m.owner_id = (select auth.uid()))
  );

-- A task can be given to a teammate. The free text "who" stays for names that are not on the team.
alter table public.project_tasks
  add column if not exists assignee_id uuid references public.team_members(id) on delete set null;

-- A teammate's plan while they hold a seat: who gave it to them.
alter table public.subscriptions
  add column if not exists seat_owner_id uuid references auth.users(id) on delete set null;

-- ── Seats and plans ─────────────────────────────────────────────────────────────────────
create or replace function public.team_owner_live(p_owner uuid)
returns boolean language sql stable security definer set search_path to '' as $function$
  select p_owner = 'e89ca9de-a86e-4dd6-8094-bc518566352e'::uuid -- the founder's account always has the business tools
      or exists (select 1 from public.subscriptions s
                  where s.user_id = p_owner and s.business_tier is not null and s.status in ('active', 'past_due'));
$function$;
revoke all on function public.team_owner_live(uuid) from public, anon, authenticated;

-- Puts a teammate on their seat's plan, or takes them off it. A person paying for their own
-- plan is never touched, and neither is anyone already on a bigger plan some other way.
create or replace function public.team_apply_seat(p_owner uuid, p_member uuid, p_seat text, p_on boolean)
returns void language plpgsql security definer set search_path to '' as $function$
begin
  if p_member is null then return; end if;
  if p_on and public.team_owner_live(p_owner) then
    update public.subscriptions s
       set plan_id = case when p_seat = 'premium' then 'pro' else 'hq' end,
           status = 'active', trial_ends_at = null, seat_owner_id = p_owner, updated_at = now()
     where s.user_id = p_member
       and s.stripe_subscription_id is null
       and (s.seat_owner_id = p_owner or s.plan_id = 'free' or s.status = 'trialing');
  else
    update public.subscriptions s
       set plan_id = 'free', status = 'active', seat_owner_id = null, updated_at = now()
     where s.user_id = p_member and s.seat_owner_id = p_owner and s.stripe_subscription_id is null;
  end if;
end;
$function$;
revoke all on function public.team_apply_seat(uuid, uuid, text, boolean) from public, anon, authenticated;

create or replace function public.team_members_sync()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if tg_op = 'DELETE' then
    perform public.team_apply_seat(old.owner_id, old.member_id, old.seat, false);
    return old;
  end if;
  if tg_op = 'UPDATE' and old.member_id is not null and old.member_id is distinct from new.member_id then
    perform public.team_apply_seat(old.owner_id, old.member_id, old.seat, false);
  end if;
  perform public.team_apply_seat(new.owner_id, new.member_id, new.seat, new.status = 'active');
  return new;
end;
$function$;
create or replace trigger team_members_sync
  after insert or update or delete on public.team_members
  for each row execute function public.team_members_sync();

-- The owner's Business plan starting or ending switches every seat on or off.
create or replace function public.team_owner_plan_changed()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare m record;
begin
  for m in select member_id, seat, status from public.team_members where owner_id = new.user_id and member_id is not null loop
    perform public.team_apply_seat(new.user_id, m.member_id, m.seat, m.status = 'active');
  end loop;
  return new;
end;
$function$;
create or replace trigger team_owner_plan_changed
  after update of business_tier, status on public.subscriptions
  for each row when (old.business_tier is distinct from new.business_tier or old.status is distinct from new.status)
  execute function public.team_owner_plan_changed();

-- ── What the app calls ──────────────────────────────────────────────────────────────────
-- A person signing in picks up any invite sent to their (confirmed) email address.
create or replace function public.team_claim()
returns integer language plpgsql security definer set search_path to '' as $function$
declare
  me uuid := (select auth.uid());
  my_email text;
  n integer := 0;
begin
  if me is null then return 0; end if;
  select lower(u.email) into my_email from auth.users u where u.id = me and u.email_confirmed_at is not null;
  if my_email is null then return 0; end if;
  update public.team_members t
     set member_id = me, status = 'active', joined_at = now()
   where t.email = my_email and t.member_id is null and t.owner_id <> me;
  get diagnostics n = row_count;
  return n;
end;
$function$;

-- The owner's team, with how much of their Tali credits each person has used this month.
create or replace function public.team_mine()
returns jsonb language sql stable security definer set search_path to '' as $function$
  select jsonb_build_object(
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.name, 'email', t.email, 'role_title', t.role_title, 'seat', t.seat, 'status', t.status,
        'can_customers', t.can_customers, 'can_prices', t.can_prices, 'can_money', t.can_money, 'can_pipeline', t.can_pipeline,
        'created_at', t.created_at, 'joined_at', t.joined_at,
        'allowance', case when t.seat = 'premium' then 3000 else 1000 end,
        'used', case when t.member_id is null then 0 else coalesce((
          select sum(u.credits - u.extra_credits) from public.usage u
           where u.user_id = t.member_id
             and u.created_at >= (date_trunc('month', now() at time zone 'Australia/Sydney') at time zone 'Australia/Sydney')), 0) end,
        'jobs', (select count(*) from public.job_people jp join public.jobs j on j.id = jp.job_id
                  where jp.team_member_id = t.id and j.status in ('accepted', 'on')),
        'tasks_open', (select count(*) from public.project_tasks pt where pt.assignee_id = t.id and pt.done_at is null),
        'tasks_done', (select count(*) from public.project_tasks pt where pt.assignee_id = t.id
                        and pt.done_at >= (date_trunc('month', now() at time zone 'Australia/Sydney') at time zone 'Australia/Sydney'))
      ) order by t.created_at)
      from public.team_members t where t.owner_id = (select auth.uid())), '[]'::jsonb),
    'member_of', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'owner_id', t.owner_id,
        'business', coalesce(nullif(p.business_name, ''), nullif(p.first_name, ''), 'Your team'),
        'owner_name', coalesce(nullif(p.first_name, ''), 'The owner'),
        'role_title', t.role_title, 'seat', t.seat,
        'can_customers', t.can_customers, 'can_prices', t.can_prices, 'can_money', t.can_money, 'can_pipeline', t.can_pipeline,
        'live', public.team_owner_live(t.owner_id)
      ) order by t.joined_at)
      from public.team_members t left join public.profiles p on p.id = t.owner_id
      where t.member_id = (select auth.uid()) and t.status = 'active'), '[]'::jsonb));
$function$;

-- Owner only: what a person can see, and what they are called.
create or replace function public.team_set_access(p_id uuid, p_name text, p_role_title text, p_customers boolean, p_prices boolean, p_money boolean, p_pipeline boolean)
returns boolean language plpgsql security definer set search_path to '' as $function$
begin
  update public.team_members t
     set name = left(coalesce(nullif(btrim(p_name), ''), t.name), 80),
         role_title = left(coalesce(btrim(p_role_title), ''), 60),
         can_customers = coalesce(p_customers, false), can_prices = coalesce(p_prices, false),
         can_money = coalesce(p_money, false), can_pipeline = coalesce(p_pipeline, false)
   where t.id = p_id and t.owner_id = (select auth.uid());
  return found;
end;
$function$;

-- Everything a teammate has been given, for each team they are on. Prices only when allowed.
create or replace function public.team_my_work()
returns jsonb language sql stable security definer set search_path to '' as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'team_id', t.id,
    'business', coalesce(nullif(p.business_name, ''), nullif(p.first_name, ''), 'Your team'),
    'owner_name', coalesce(nullif(p.first_name, ''), 'The owner'),
    'role_title', t.role_title,
    'can_customers', t.can_customers, 'can_prices', t.can_prices, 'can_money', t.can_money, 'can_pipeline', t.can_pipeline,
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', j.id, 'title', j.title, 'client_name', j.client_name, 'address', j.address, 'status', j.status, 'number', j.number,
        'total', case when t.can_prices then j.total end,
        'with', coalesce((select jsonb_agg(o.name order by o.name) from public.job_people jo join public.team_members o on o.id = jo.team_member_id
                           where jo.job_id = j.id and o.id <> t.id), '[]'::jsonb)
      ) order by j.updated_at desc)
      from public.job_people jp join public.jobs j on j.id = jp.job_id
      where jp.team_member_id = t.id and j.user_id = t.owner_id and j.status in ('sent', 'accepted', 'on', 'done')), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pt.id, 'title', pt.title, 'project', pr.name, 'due_date', pt.due_date, 'done_at', pt.done_at
      ) order by (pt.done_at is not null), pt.due_date nulls last, pt.sort)
      from public.project_tasks pt join public.projects pr on pr.id = pt.project_id
      where pt.assignee_id = t.id and pt.user_id = t.owner_id
        and (pt.done_at is null or pt.done_at > now() - interval '7 days')), '[]'::jsonb),
    'customers', case when t.can_customers then coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone, 'email', c.email, 'notes', c.notes) order by c.name)
      from public.clients c where c.user_id = t.owner_id and c.kind = 'client'), '[]'::jsonb) end,
    'invoices', case when t.can_money then coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'number', i.number, 'client_name', i.client_name, 'total', i.total, 'status', i.status, 'due_date', i.due_date) order by i.created_at desc)
      from (select * from public.invoices i0 where i0.user_id = t.owner_id order by i0.created_at desc limit 50) i), '[]'::jsonb) end,
    'bookings', case when t.can_pipeline then coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'title', b.title, 'client_name', b.client_name, 'starts_at', b.starts_at, 'minutes', b.minutes, 'place', b.place) order by b.starts_at)
      from public.bookings b where b.user_id = t.owner_id and b.status <> 'cancelled' and b.starts_at >= now() - interval '2 hours' and b.starts_at < now() + interval '21 days'), '[]'::jsonb) end,
    'leads', case when t.can_pipeline then coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'status', c.status, 'next_follow_up', c.next_follow_up) order by c.updated_at desc)
      from public.clients c where c.user_id = t.owner_id and c.kind = 'lead'), '[]'::jsonb) end
  ) order by t.joined_at), '[]'::jsonb)
  from public.team_members t left join public.profiles p on p.id = t.owner_id
  where t.member_id = (select auth.uid()) and t.status = 'active' and public.team_owner_live(t.owner_id);
$function$;

-- A teammate ticks (or unticks) a task that was given to them.
create or replace function public.team_tick_task(p_task uuid)
returns boolean language plpgsql security definer set search_path to '' as $function$
begin
  update public.project_tasks pt
     set done_at = case when pt.done_at is null then now() end
    from public.team_members t
   where pt.id = p_task and pt.assignee_id = t.id and pt.user_id = t.owner_id
     and t.member_id = (select auth.uid()) and t.status = 'active';
  return found;
end;
$function$;

-- A teammate who can see customers adds a note to one. The note says who wrote it.
create or replace function public.team_add_client_note(p_team uuid, p_client uuid, p_note text)
returns boolean language plpgsql security definer set search_path to '' as $function$
declare who text;
begin
  if coalesce(btrim(p_note), '') = '' then return false; end if;
  select t.name into who from public.team_members t
   where t.id = p_team and t.member_id = (select auth.uid()) and t.status = 'active' and t.can_customers;
  if who is null then return false; end if;
  update public.clients c
     set notes = left(case when coalesce(c.notes, '') = '' then '' else c.notes || E'\n' end
                      || who || ', ' || to_char(now() at time zone 'Australia/Sydney', 'DD Mon') || ': ' || left(btrim(p_note), 500), 6000)
    from public.team_members t
   where c.id = p_client and t.id = p_team and c.user_id = t.owner_id;
  return found;
end;
$function$;

revoke all on function public.team_claim() from public, anon;
revoke all on function public.team_mine() from public, anon;
revoke all on function public.team_set_access(uuid, text, text, boolean, boolean, boolean, boolean) from public, anon;
revoke all on function public.team_my_work() from public, anon;
revoke all on function public.team_tick_task(uuid) from public, anon;
revoke all on function public.team_add_client_note(uuid, uuid, text) from public, anon;
grant execute on function public.team_claim() to authenticated;
grant execute on function public.team_mine() to authenticated;
grant execute on function public.team_set_access(uuid, text, text, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.team_my_work() to authenticated;
grant execute on function public.team_tick_task(uuid) to authenticated;
grant execute on function public.team_add_client_note(uuid, uuid, text) to authenticated;
