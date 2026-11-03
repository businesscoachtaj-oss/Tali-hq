-- Tali HQ, 3 Nov 2026: the owner's rhythm and memory.
-- End of day shutdown (Free), weekly review with three commitments (HQ), goals Tali holds you to (HQ),
-- money picture settings (HQ), decision log (Free reads, HQ asks why), monthly patterns (Pro),
-- voice notes usage (HQ capped, Pro unlimited). Totality stays the business; this is the owner.
-- All public tables are RLS on auth.uid(). Server jobs use service role.

-- 1. Profile settings for the rhythm and the money picture
alter table public.profiles
  add column if not exists shutdown_time time not null default '21:00',
  add column if not exists shutdown_push boolean not null default true,
  add column if not exists review_day smallint not null default 0 check (review_day between 0 and 6),   -- 0 Sunday
  add column if not exists review_time time not null default '17:00',
  add column if not exists monthly_costs numeric(12,2),                                                   -- what goes out each month, for runway
  add column if not exists cash_on_hand numeric(12,2),                                                    -- optional, if Stripe balance is not the whole story
  add column if not exists money_updated_at timestamptz;

-- 2. End of day shutdown: one per local day
create table if not exists public.shutdowns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  local_date date not null,
  mood smallint check (mood between 1 and 5),
  went_well text,
  note text,
  tomorrow jsonb not null default '[]'::jsonb,       -- [{text, reminder_id}]
  tali_line text,
  created_at timestamptz not null default now(),
  unique (user_id, local_date)
);
alter table public.shutdowns enable row level security;
create policy "own shutdowns all" on public.shutdowns for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 3. Weekly review and the three commitments it ends with
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  week_start date not null,                           -- Monday of the week being reviewed
  content jsonb not null default '{}'::jsonb,         -- {headline, moved:[], money:{}, quiet:[], kept:[], missed:[], tali_says}
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);
alter table public.reviews enable row level security;
create policy "own reviews all" on public.reviews for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  week_start date not null,                           -- Monday of the week they are for
  text text not null,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists commitments_user_week_idx on public.commitments (user_id, week_start desc);
alter table public.commitments enable row level security;
create policy "own commitments all" on public.commitments for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 4. Goals Tali holds you to
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null,
  target_number numeric,
  current_number numeric not null default 0,
  unit text,                                          -- "clients", "A$", "kg", "posts"
  due_date date,
  status text not null default 'active' check (status in ('active', 'done', 'dropped')),
  notes text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists goals_user_idx on public.goals (user_id, status, due_date);
alter table public.goals enable row level security;
create policy "own goals all" on public.goals for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop trigger if exists goals_touch on public.goals;
create trigger goals_touch before update on public.goals for each row execute function public.touch_updated_at();

-- 5. Decision log
create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  decision text not null,
  reasoning text,
  decided_at date not null default (now() at time zone 'Australia/Sydney')::date,
  source_ref text,                                    -- messages/<id> or 'app'
  revisited_at timestamptz,
  outcome text,
  created_at timestamptz not null default now()
);
create index if not exists decisions_user_idx on public.decisions (user_id, decided_at desc);
alter table public.decisions enable row level security;
create policy "own decisions all" on public.decisions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 6. Briefs: patterns (Pro, monthly) and review nudges reuse the briefs table
alter table public.briefs drop constraint if exists briefs_kind_check;
alter table public.briefs add constraint briefs_kind_check check (kind in ('morning', 'health', 'weekly', 'journal', 'patterns'));

-- 7. Voice notes: seconds used per month, read by the app and the transcribe function
alter table public.usage add column if not exists seconds integer;

create or replace function public.voice_seconds_this_month(p_user_id uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(seconds), 0)::integer from public.usage
   where user_id = p_user_id and feature = 'voice_note'
     and created_at >= date_trunc('month', now());
$$;
revoke all on function public.voice_seconds_this_month(uuid) from public, anon, authenticated;
grant execute on function public.voice_seconds_this_month(uuid) to service_role;

-- 8. Tali's tools: goals and decisions from chat (service role only)
create or replace function public.tali_save_goal(p_user_id uuid, p_title text, p_target numeric, p_current numeric, p_unit text, p_due date, p_status text, p_notes text)
returns uuid language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  select id into gid from public.goals where user_id = p_user_id and status = 'active' and lower(title) = lower(p_title) limit 1;
  if gid is null and p_status is distinct from 'done' and p_status is distinct from 'dropped' then
    insert into public.goals (user_id, title, target_number, current_number, unit, due_date, notes, last_checked_at)
    values (p_user_id, p_title, p_target, coalesce(p_current, 0), p_unit, p_due, p_notes, now()) returning id into gid;
  elsif gid is not null then
    update public.goals set
      target_number = coalesce(p_target, target_number),
      current_number = coalesce(p_current, current_number),
      unit = coalesce(p_unit, unit),
      due_date = coalesce(p_due, due_date),
      status = coalesce(p_status, status),
      notes = coalesce(p_notes, notes),
      last_checked_at = now()
    where id = gid;
  end if;
  return gid;
end $$;
revoke all on function public.tali_save_goal(uuid, text, numeric, numeric, text, date, text, text) from public, anon, authenticated;
grant execute on function public.tali_save_goal(uuid, text, numeric, numeric, text, date, text, text) to service_role;

-- 9. What the chat, brief, review and shutdown read: goals, this week's commitments, recent decisions
create or replace function public.tali_rhythm_context(p_user_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'goals', (select coalesce(jsonb_agg(jsonb_build_object('title', g.title, 'target', g.target_number, 'current', g.current_number, 'unit', g.unit, 'due', g.due_date, 'notes', g.notes) order by g.due_date nulls last), '[]'::jsonb)
                from public.goals g where g.user_id = p_user_id and g.status = 'active'),
    'commitments', (select coalesce(jsonb_agg(jsonb_build_object('text', c.text, 'done', c.done_at is not null) order by c.created_at), '[]'::jsonb)
                      from public.commitments c where c.user_id = p_user_id and c.week_start = date_trunc('week', (now() at time zone coalesce((select timezone from public.profiles where id = p_user_id), 'Australia/Sydney')))::date),
    'decisions', (select coalesce(jsonb_agg(jsonb_build_object('decision', d.decision, 'why', d.reasoning, 'on', d.decided_at) order by d.decided_at desc), '[]'::jsonb)
                    from (select * from public.decisions where user_id = p_user_id order by decided_at desc limit 8) d),
    'last_shutdown', (select jsonb_build_object('date', s.local_date, 'mood', s.mood, 'went_well', s.went_well, 'note', s.note, 'tomorrow', s.tomorrow)
                        from public.shutdowns s where s.user_id = p_user_id order by s.local_date desc limit 1),
    'monthly_costs', (select monthly_costs from public.profiles where id = p_user_id)
  );
$$;
revoke all on function public.tali_rhythm_context(uuid) from public, anon, authenticated;
grant execute on function public.tali_rhythm_context(uuid) to service_role;

-- 10. Who is due a shutdown nudge or a review nudge right now (pushed by cron, 15 minute window, once a day)
create or replace function public.shutdown_nudges() returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; n integer := 0;
begin
  for r in
    select p.id as user_id, p.first_name
      from public.profiles p
     where p.onboarded_at is not null and p.shutdown_push
       and (now() at time zone coalesce(p.timezone, 'Australia/Sydney'))::time >= p.shutdown_time
       and (now() at time zone coalesce(p.timezone, 'Australia/Sydney'))::time < p.shutdown_time + interval '15 minutes'
       and not exists (select 1 from public.shutdowns s where s.user_id = p.id and s.local_date = (now() at time zone coalesce(p.timezone, 'Australia/Sydney'))::date)
       and not exists (select 1 from public.job_runs j where j.user_id = p.id and j.job = 'shutdown_nudge' and j.started_at > now() - interval '20 hours')
  loop
    insert into public.job_runs(user_id, job, status, summary, finished_at) values (r.user_id, 'shutdown_nudge', 'ok', 'pushed', now());
    perform public.push_user(r.user_id, 'Tali: shut the day down?', 'Two minutes. How did today go, and what are tomorrow''s three?', '/shutdown');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.shutdown_nudges() from public, anon, authenticated;

create or replace function public.review_nudges() returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; n integer := 0;
begin
  for r in
    select p.id as user_id
      from public.profiles p join public.subscriptions s on s.user_id = p.id
     where p.onboarded_at is not null
       and ((s.status = 'trialing' and s.trial_ends_at > now()) or (s.status in ('active', 'past_due') and s.plan_id in ('hq', 'pro')))
       and extract(dow from (now() at time zone coalesce(p.timezone, 'Australia/Sydney'))) = p.review_day
       and (now() at time zone coalesce(p.timezone, 'Australia/Sydney'))::time >= p.review_time
       and (now() at time zone coalesce(p.timezone, 'Australia/Sydney'))::time < p.review_time + interval '15 minutes'
       and not exists (select 1 from public.job_runs j where j.user_id = p.id and j.job = 'review_nudge' and j.started_at > now() - interval '6 days')
  loop
    insert into public.job_runs(user_id, job, status, summary, finished_at) values (r.user_id, 'review_nudge', 'ok', 'pushed', now());
    perform public.push_user(r.user_id, 'Tali: your week, in ten minutes', 'I''ve pulled the week together. Come and set your three for next week.', '/review');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.review_nudges() from public, anon, authenticated;

select cron.unschedule('tali-shutdown-nudge') where exists (select 1 from cron.job where jobname = 'tali-shutdown-nudge');
select cron.schedule('tali-shutdown-nudge', '*/15 * * * *', $cron$ select public.shutdown_nudges(); $cron$);
select cron.unschedule('tali-review-nudge') where exists (select 1 from cron.job where jobname = 'tali-review-nudge');
select cron.schedule('tali-review-nudge', '*/15 * * * *', $cron$ select public.review_nudges(); $cron$);

-- 11. Patterns: the first of the month, 6pm UTC (early morning Sydney on the 2nd), Pro only, done by the edge function
select cron.unschedule('tali-patterns') where exists (select 1 from cron.job where jobname = 'tali-patterns');
select cron.schedule('tali-patterns', '0 18 1 * *', $cron$
  select net.http_post(
    url := 'https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/tali-patterns',
    headers := jsonb_build_object('Content-Type','application/json','x-tali-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'tali_brain_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000);
$cron$);
