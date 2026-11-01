-- Tali HQ 013: night school for every Tali HQ and Pro user (and the trial).
-- The user picks up to 3 topics. Late each night (their time) Tali researches one of them with
-- web search, saves what she learnt to that user's private brain and leaves a short note.
-- Costs credits like chat: 1 for the night plus 2 per web search.

create table if not exists public.night_school (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  enabled boolean not null default true,
  topics text[] not null default '{}' check (cardinality(topics) <= 3),
  nights text not null default 'three' check (nights in ('every', 'three')),
  next_topic integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.night_school enable row level security;
create policy "own night school all" on public.night_school for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger night_school_touch before update on public.night_school for each row execute function public.touch_updated_at();
revoke update on public.night_school from authenticated;
grant update (user_id, enabled, topics, nights) on public.night_school to authenticated;

-- Topics stay short and plain.
create or replace function public.night_school_clean() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.topics := array(select left(trim(t), 80) from unnest(new.topics) t where length(trim(t)) >= 3);
  return new;
end $$;
create trigger night_school_clean before insert or update on public.night_school for each row execute function public.night_school_clean();

create table if not exists public.night_school_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  for_date date not null,
  topic text not null,
  headline text not null,
  learnt jsonb not null default '[]',
  sources jsonb not null default '[]',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, for_date)
);
create index if not exists night_notes_user_idx on public.night_school_notes (user_id, for_date desc);
alter table public.night_school_notes enable row level security;
create policy "own night notes read" on public.night_school_notes for select to authenticated using (user_id = (select auth.uid()));
create policy "own night notes update" on public.night_school_notes for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on public.night_school_notes from authenticated;
grant update (read_at) on public.night_school_notes to authenticated;
create policy "own night notes delete" on public.night_school_notes for delete to authenticated using (user_id = (select auth.uid()));

-- Who is due tonight: trial or paid, enabled, has a topic, between 11pm and 3am their time,
-- no note yet for that night. "three" = Monday, Wednesday and Friday nights.
create or replace function public.due_night_school(p_limit integer default 10)
returns table(user_id uuid, topic text, topic_index integer, local_date date)
language sql security definer set search_path = '' as $$
  with base as (
    select n.user_id, n.topics, n.nights, n.next_topic,
           (now() at time zone coalesce(p.timezone, 'Australia/Sydney')) as local_now
      from public.night_school n
      join public.profiles p on p.id = n.user_id
      join public.subscriptions s on s.user_id = n.user_id
     where n.enabled and cardinality(n.topics) > 0 and p.onboarded_at is not null
       and ((s.status = 'trialing' and s.trial_ends_at > now()) or (s.status in ('active', 'past_due') and s.plan_id in ('hq', 'pro')))
  ), b2 as (
    -- The "night of" date: 11pm to midnight is that day, midnight to 3am belongs to the day before.
    select b.*, case when extract(hour from b.local_now) >= 23 then b.local_now::date else (b.local_now - interval '1 day')::date end as night_of
      from base b
     where extract(hour from b.local_now) >= 23 or extract(hour from b.local_now) < 3
  )
  select b2.user_id, b2.topics[(b2.next_topic % cardinality(b2.topics)) + 1], b2.next_topic % cardinality(b2.topics), b2.night_of
    from b2
   where (b2.nights = 'every' or extract(isodow from b2.night_of) in (1, 3, 5))
     and not exists (select 1 from public.night_school_notes x where x.user_id = b2.user_id and x.for_date = b2.night_of)
   limit least(coalesce(p_limit, 10), 50);
$$;
revoke all on function public.due_night_school(integer) from public, anon, authenticated;
grant execute on function public.due_night_school(integer) to service_role;

-- Moves on to the next topic after a night's study.
create or replace function public.night_school_advance(p_user_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.night_school set next_topic = next_topic + 1 where user_id = p_user_id;
$$;
revoke all on function public.night_school_advance(uuid) from public, anon, authenticated;
grant execute on function public.night_school_advance(uuid) to service_role;

select cron.schedule('tali-night-school', '*/20 * * * *', $cron$
  select net.http_post(
    url := 'https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/tali-night-school',
    headers := jsonb_build_object('Content-Type','application/json','x-tali-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'tali_brain_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000)
  where exists (select 1 from public.due_night_school(1));
$cron$);
