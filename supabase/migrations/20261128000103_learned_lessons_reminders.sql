-- Learnéd 103 (28 Nov 2026, Taj): Tali HQ became Learnéd, for life and learning.
--   1. The lesson library: ten categories, shared courses Tali writes a lesson a night for in every
--      category (always at least a day ahead of the fastest person), and personal "learn anything" paths.
--   2. What each person is on, what they have done, and the recall cards that bring a lesson back.
--   3. Reminders across mind, body, people, money and home, with repeats, streaks and a 7pm check-in.
-- Lessons are written and checked by the tali-learn function (service role only). Quotes in a
-- lesson are only ever word for word from a book in her library, and the writer checks that.

-- ---------- 1. The lesson library ----------
create table if not exists public.learn_categories (
  id text primary key,
  name text not null,
  line text not null,
  colour text not null,
  region text not null,            -- the part of Tali's brain it is filed in (lib/brain.ts)
  subjects text[] not null default '{}', -- library subjects the writer reads from
  sort integer not null default 0
);
alter table public.learn_categories enable row level security;
drop policy if exists "learn categories read" on public.learn_categories;
create policy "learn categories read" on public.learn_categories for select to authenticated using (true);

insert into public.learn_categories (id, name, line, colour, region, subjects, sort) values
  ('philosophy', 'Philosophy', 'How to live, from the people who thought hardest about it', '#5B4BB0', 'frontal', '{philosophy}', 1),
  ('mind', 'Mind and psychology', 'How your mind works, and how to work with it', '#8A4FB8', 'amygdala', '{emotions,learning,habits}', 2),
  ('money', 'Money', 'Saving, spending, debt and making it grow', '#A8841C', 'prefrontal', '{economics,business}', 3),
  ('history', 'History', 'What happened, and what it still tells us', '#C27A1E', 'hippocampus', '{history,strategy}', 4),
  ('science', 'Science and nature', 'How the universe, life and the planet work', '#2C7FA8', 'parietal', '{"big ideas",physics,maths,computing}', 5),
  ('health', 'Health and the body', 'Sleep, food, movement and the body you live in', '#B8487A', 'hypothalamus', '{habits}', 6),
  ('writing', 'Writing and words', 'Say what you mean, clearly and well', '#4060B0', 'temporal', '{writing,plays,classics}', 7),
  ('people', 'People and relationships', 'Family, friends, love, and getting along', '#2E8A63', 'temporal', '{emotions,plays,classics,philosophy}', 8),
  ('world', 'How the world works', 'Markets, cities, machines and the systems around you', '#6B7488', 'corpus_callosum', '{economics,computing,design,strategy}', 9),
  ('art', 'Art and culture', 'Painting, music, stories and how to enjoy them more', '#C0453A', 'occipital', '{art,music,design,Australian,classics}', 10)
on conflict (id) do update set name = excluded.name, line = excluded.line, colour = excluded.colour, region = excluded.region, subjects = excluded.subjects, sort = excluded.sort;

-- A course: a run of lessons on one topic. owner null = the shared library everyone can take.
create table if not exists public.learn_courses (
  id uuid primary key default gen_random_uuid(),
  category text not null references public.learn_categories(id),
  owner uuid references auth.users(id) on delete cascade,
  title text not null,
  line text,
  outline jsonb not null default '[]'::jsonb,   -- [{n, title, aim, book?}]
  sources text,                                  -- in plain words, for the path screen
  asked text,                                    -- what they asked to learn (personal paths)
  status text not null default 'live' check (status in ('live', 'finished', 'retired')),
  created_at timestamptz not null default now()
);
create index if not exists learn_courses_cat_idx on public.learn_courses (category, created_at) where owner is null;
create index if not exists learn_courses_owner_idx on public.learn_courses (owner) where owner is not null;
alter table public.learn_courses enable row level security;
drop policy if exists "learn courses read" on public.learn_courses;
create policy "learn courses read" on public.learn_courses for select to authenticated
  using (owner is null or owner = (select auth.uid()));

create table if not exists public.learn_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.learn_courses(id) on delete cascade,
  n integer not null,
  title text not null,
  mins integer not null default 7,
  teaser text,
  body jsonb not null default '[]'::jsonb,       -- [{t: 'p'|'h'|'quote'|'try', text, by?, book?, passage?}]
  questions jsonb not null default '[]'::jsonb,  -- [{q, options: [..], answer, why}]
  recall jsonb not null default '[]'::jsonb,     -- [{q, a}]
  status text not null default 'draft' check (status in ('draft', 'live', 'failed')),
  check_notes text,
  tries integer not null default 0,
  model text,
  created_at timestamptz not null default now(),
  live_at timestamptz,
  unique (course_id, n)
);
alter table public.learn_lessons enable row level security;
drop policy if exists "learn lessons read" on public.learn_lessons;
create policy "learn lessons read" on public.learn_lessons for select to authenticated
  using (status = 'live' and exists (select 1 from public.learn_courses c where c.id = course_id and (c.owner is null or c.owner = (select auth.uid()))));

-- ---------- 2. What each person is on ----------
create table if not exists public.learn_enrolments (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null references public.learn_courses(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_at timestamptz,
  paused boolean not null default false,
  primary key (user_id, course_id)
);
alter table public.learn_enrolments enable row level security;
drop policy if exists "own learn enrolments" on public.learn_enrolments;
create policy "own learn enrolments" on public.learn_enrolments for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.learn_progress (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.learn_lessons(id) on delete cascade,
  course_id uuid not null references public.learn_courses(id) on delete cascade,
  done_at timestamptz not null default now(),
  score integer,
  out_of integer,
  primary key (user_id, lesson_id)
);
create index if not exists learn_progress_course_idx on public.learn_progress (course_id, user_id);
alter table public.learn_progress enable row level security;
drop policy if exists "own learn progress read" on public.learn_progress;
create policy "own learn progress read" on public.learn_progress for select to authenticated using (user_id = (select auth.uid()));

-- Recall cards: what you forget comes back sooner, what you know comes back in a few weeks.
create table if not exists public.learn_recall (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lesson_id uuid references public.learn_lessons(id) on delete cascade,
  q text not null,
  a text not null,
  box integer not null default 1,
  due_on date not null,
  last_at timestamptz
);
create index if not exists learn_recall_due_idx on public.learn_recall (user_id, due_on);
alter table public.learn_recall enable row level security;
drop policy if exists "own learn recall read" on public.learn_recall;
create policy "own learn recall read" on public.learn_recall for select to authenticated using (user_id = (select auth.uid()));

-- The person's own date, from their time zone.
create or replace function public.learn_local_day(p_user uuid) returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone coalesce((select timezone from public.profiles where id = p_user), 'Australia/Sydney'))::date;
$$;
revoke all on function public.learn_local_day(uuid) from public, anon, authenticated;

-- Start (or restart) a course. Shared or their own only.
create or replace function public.learn_enrol(p_course uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return false; end if;
  if not exists (select 1 from public.learn_courses c where c.id = p_course and c.status <> 'retired' and (c.owner is null or c.owner = v_uid)) then return false; end if;
  insert into public.learn_enrolments (user_id, course_id) values (v_uid, p_course)
  on conflict (user_id, course_id) do update set paused = false;
  return true;
end $$;

-- Finish a lesson: saves the score and puts its recall cards in, first back in two days.
-- One new lesson a path a day, so the writer always stays ahead (Taj, 28 Nov 2026).
create or replace function public.learn_finish(p_lesson uuid, p_score integer, p_out_of integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_course uuid; v_today date; v_new boolean;
begin
  if v_uid is null then return jsonb_build_object('ok', false); end if;
  select l.course_id into v_course from public.learn_lessons l join public.learn_courses c on c.id = l.course_id
   where l.id = p_lesson and l.status = 'live' and (c.owner is null or c.owner = v_uid);
  if v_course is null then return jsonb_build_object('ok', false); end if;
  v_today := public.learn_local_day(v_uid);
  insert into public.learn_progress (user_id, lesson_id, course_id, score, out_of)
  values (v_uid, p_lesson, v_course, greatest(0, least(p_score, 20)), greatest(0, least(p_out_of, 20)))
  on conflict (user_id, lesson_id) do nothing;
  v_new := found;
  insert into public.learn_enrolments (user_id, course_id, last_at) values (v_uid, v_course, now())
  on conflict (user_id, course_id) do update set last_at = now(), paused = false;
  if v_new then
    insert into public.learn_recall (user_id, lesson_id, q, a, due_on)
    select v_uid, p_lesson, left(r->>'q', 300), left(r->>'a', 600), v_today + 2
      from public.learn_lessons l, jsonb_array_elements(l.recall) r
     where l.id = p_lesson and coalesce(r->>'q', '') <> '' and coalesce(r->>'a', '') <> ''
     limit 3;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- Knew it: the card goes up a box and comes back later. Forgot it: back to box 1, tomorrow.
create or replace function public.learn_recall_answer(p_card uuid, p_knew boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_box integer; v_today date;
begin
  select box into v_box from public.learn_recall where id = p_card and user_id = v_uid;
  if v_box is null then return false; end if;
  v_today := public.learn_local_day(v_uid);
  v_box := case when p_knew then least(v_box + 1, 6) else 1 end;
  update public.learn_recall
     set box = v_box, last_at = now(),
         due_on = v_today + (case v_box when 1 then 1 when 2 then 3 when 3 then 7 when 4 then 14 when 5 then 30 else 90 end)
   where id = p_card;
  return true;
end $$;

-- Everything the Learn tab and Today need in one call.
create or replace function public.learn_home() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_today date; v_paths jsonb; v_recall jsonb; v_due integer; v_cats jsonb;
begin
  if v_uid is null then return '{}'::jsonb; end if;
  v_today := public.learn_local_day(v_uid);
  select coalesce(jsonb_agg(p order by (p->>'last_at') desc nulls last), '[]'::jsonb) into v_paths from (
    select jsonb_build_object(
      'id', c.id, 'title', c.title, 'line', c.line, 'category', c.category, 'mine', c.owner is not null,
      'colour', cat.colour, 'category_name', cat.name, 'sources', c.sources,
      'planned', jsonb_array_length(c.outline),
      'live', (select count(*) from public.learn_lessons l where l.course_id = c.id and l.status = 'live'),
      'done', (select count(*) from public.learn_progress pr where pr.course_id = c.id and pr.user_id = v_uid),
      'done_today', exists (select 1 from public.learn_progress pr where pr.course_id = c.id and pr.user_id = v_uid
                      and (pr.done_at at time zone coalesce((select timezone from public.profiles where id = v_uid), 'Australia/Sydney'))::date = v_today),
      'last_at', e.last_at,
      'next', (select jsonb_build_object('id', l.id, 'n', l.n, 'title', l.title, 'mins', l.mins, 'teaser', l.teaser)
                 from public.learn_lessons l
                where l.course_id = c.id and l.status = 'live'
                  and not exists (select 1 from public.learn_progress pr where pr.lesson_id = l.id and pr.user_id = v_uid)
                order by l.n limit 1)
    ) p
    from public.learn_enrolments e
    join public.learn_courses c on c.id = e.course_id
    join public.learn_categories cat on cat.id = c.category
    where e.user_id = v_uid and not e.paused and c.status <> 'retired'
  ) x;
  select count(*) into v_due from public.learn_recall where user_id = v_uid and due_on <= v_today;
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'q', r.q, 'a', r.a, 'box', r.box) order by r.due_on, r.box), '[]'::jsonb) into v_recall
    from (select * from public.learn_recall where user_id = v_uid and due_on <= v_today order by due_on, box limit 3) r;
  select coalesce(jsonb_agg(jsonb_build_object('id', cat.id, 'name', cat.name, 'line', cat.line, 'colour', cat.colour,
           'courses', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'line', c.line, 'planned', jsonb_array_length(c.outline),
                         'live', (select count(*) from public.learn_lessons l where l.course_id = c.id and l.status = 'live')) order by c.created_at), '[]'::jsonb)
                         from public.learn_courses c where c.category = cat.id and c.owner is null and c.status <> 'retired'
                          and exists (select 1 from public.learn_lessons l where l.course_id = c.id and l.status = 'live'))) order by cat.sort), '[]'::jsonb)
    into v_cats from public.learn_categories cat;
  return jsonb_build_object('today', v_today, 'paths', v_paths, 'recall', v_recall, 'recall_due', v_due, 'categories', v_cats);
end $$;

revoke all on function public.learn_enrol(uuid), public.learn_finish(uuid, integer, integer), public.learn_recall_answer(uuid, boolean), public.learn_home() from public, anon;
grant execute on function public.learn_enrol(uuid), public.learn_finish(uuid, integer, integer), public.learn_recall_answer(uuid, boolean), public.learn_home() to authenticated;

-- For the writer (service only): passages from her library to quote from, best matches first.
create or replace function public.learn_passages(p_subjects text[], p_query text, p_book text default null, p_limit integer default 8)
returns table (book_id text, title text, author text, n integer, content text)
language sql stable security definer set search_path = '' as $$
  select b.id, b.title, b.author, p.n, left(p.content, 1500)
    from brain.library_passages p join brain.library_books b on b.id = p.book_id
   where (p_book is not null and b.id = p_book or p_book is null and b.subject = any (p_subjects))
     and b.state = 'loaded'
     and to_tsvector('english', p.content) @@ websearch_to_tsquery('english', coalesce(nullif(p_query, ''), 'life'))
   order by ts_rank(to_tsvector('english', p.content), websearch_to_tsquery('english', coalesce(nullif(p_query, ''), 'life'))) desc
   limit least(greatest(p_limit, 1), 20);
$$;
-- Is this quote really in that passage? (whitespace and curly quotes don't count)
create or replace function public.learn_quote_ok(p_book text, p_passage integer, p_quote text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from brain.library_passages p
     where p.book_id = p_book and p.n = p_passage and length(trim(p_quote)) >= 12
       and position(lower(regexp_replace(translate(p_quote, '‘’“”', '''''""'), '\s+', ' ', 'g'))
                    in lower(regexp_replace(translate(p.content, '‘’“”', '''''""'), '\s+', ' ', 'g'))) > 0);
$$;
-- The books the writer can choose from, per category.
create or replace function public.learn_books(p_subjects text[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'title', b.title, 'author', b.author, 'subject', b.subject) order by b.subject, b.title), '[]'::jsonb)
    from brain.library_books b where b.subject = any (p_subjects) and b.state = 'loaded' and b.passages > 0;
$$;
-- How far ahead the library is: for each shared course, the most lessons anyone has done.
create or replace function public.learn_writer_state() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'category', c.category, 'owner', c.owner, 'title', c.title, 'outline', c.outline, 'status', c.status,
    'written', (select coalesce(max(l.n), 0) from public.learn_lessons l where l.course_id = c.id and l.status <> 'failed'),
    'live', (select count(*) from public.learn_lessons l where l.course_id = c.id and l.status = 'live'),
    'furthest', (select coalesce(max(k), 0) from (select count(*) k from public.learn_progress pr where pr.course_id = c.id group by pr.user_id) z),
    'learners', (select count(*) from public.learn_enrolments e where e.course_id = c.id and not e.paused)
  ) order by c.category, c.created_at), '[]'::jsonb)
  from public.learn_courses c where c.status = 'live';
$$;
revoke all on function public.learn_passages(text[], text, text, integer), public.learn_quote_ok(text, integer, text), public.learn_books(text[]), public.learn_writer_state() from public, anon, authenticated;
grant execute on function public.learn_passages(text[], text, text, integer), public.learn_quote_ok(text, integer, text), public.learn_books(text[]), public.learn_writer_state() to service_role;

-- ---------- 3. Reminders across every part of life ----------
alter table public.reminders add column if not exists area text check (area in ('mind', 'body', 'people', 'money', 'home'));
alter table public.reminders add column if not exists repeat text check (repeat in ('daily', 'weekdays', 'weekly', 'fortnightly', 'monthly', 'yearly'));
alter table public.reminders add column if not exists streak integer not null default 0;
alter table public.reminders add column if not exists checkin boolean not null default true;
alter table public.reminders add column if not exists checked_in_on date;

-- Done: ticks it off, and for a repeating one puts the next one in. The streak carries on when it was
-- done before the next one fell due, and starts again at 1 when it wasn't.
create or replace function public.reminder_done(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); r public.reminders; v_next timestamptz; v_streak integer; v_tz text;
begin
  select * into r from public.reminders where id = p_id and user_id = v_uid and done_at is null;
  if r.id is null then return jsonb_build_object('ok', false); end if;
  update public.reminders set done_at = now() where id = p_id;
  if r.repeat is null then return jsonb_build_object('ok', true); end if;
  select coalesce(timezone, 'Australia/Sydney') into v_tz from public.profiles where id = v_uid;
  v_next := r.due_at;
  loop
    v_next := case r.repeat
      when 'daily' then v_next + interval '1 day'
      when 'weekdays' then v_next + interval '1 day'
      when 'weekly' then v_next + interval '7 days'
      when 'fortnightly' then v_next + interval '14 days'
      when 'monthly' then ((v_next at time zone v_tz) + interval '1 month') at time zone v_tz
      else ((v_next at time zone v_tz) + interval '1 year') at time zone v_tz end;
    if r.repeat = 'weekdays' then
      while extract(isodow from (v_next at time zone v_tz)) > 5 loop v_next := v_next + interval '1 day'; end loop;
    end if;
    exit when v_next > now();
  end loop;
  -- On time: done before the one after this one would have fallen due.
  v_streak := case when now() <= (r.due_at + (v_next - r.due_at)) and v_next - r.due_at <= interval '400 days'
                     and now() < r.due_at + case r.repeat when 'daily' then interval '1 day' when 'weekdays' then interval '3 days' when 'weekly' then interval '7 days' when 'fortnightly' then interval '14 days' when 'monthly' then interval '31 days' else interval '366 days' end
                   then r.streak + 1 else 1 end;
  insert into public.reminders (user_id, text, due_at, client_id, created_by, side, area, repeat, streak, checkin)
  values (v_uid, r.text, v_next, r.client_id, r.created_by, r.side, r.area, r.repeat, v_streak, r.checkin);
  update public.reminders set streak = v_streak where id = p_id;
  return jsonb_build_object('ok', true, 'streak', v_streak, 'next', v_next);
end $$;
revoke all on function public.reminder_done(uuid) from public, anon;
grant execute on function public.reminder_done(uuid) to authenticated;

-- Tali's version of tali_add_reminder, with the part of life and the repeat.
create or replace function public.tali_add_reminder2(p_user_id uuid, p_text text, p_due_at timestamptz, p_area text default null, p_repeat text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.reminders (user_id, text, due_at, created_by, side, area, repeat)
  values (p_user_id, trim(p_text), greatest(p_due_at, now()), 'tali', 'life',
          case when p_area in ('mind', 'body', 'people', 'money', 'home') then p_area end,
          case when p_repeat in ('daily', 'weekdays', 'weekly', 'fortnightly', 'monthly', 'yearly') then p_repeat end)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.tali_add_reminder2(uuid, text, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.tali_add_reminder2(uuid, text, timestamptz, text, text) to service_role;

-- 7pm their time: one push for whatever is still open today (reminders that asked for a check-in, and
-- today's lesson if they are on a path and haven't done one). Once a day, only if there is something.
create or replace function public.learned_evening_checkins() returns integer
language plpgsql security definer set search_path = '' as $$
declare u record; v_items text[]; v_lesson text; n integer := 0; v_body text;
begin
  for u in
    select p.id, coalesce(p.timezone, 'Australia/Sydney') tz,
           (now() at time zone coalesce(p.timezone, 'Australia/Sydney'))::date d
      from public.profiles p
     where p.onboarded_at is not null
       and extract(hour from (now() at time zone coalesce(p.timezone, 'Australia/Sydney'))) = 19
       and not exists (select 1 from public.job_runs j where j.user_id = p.id and j.job = 'evening_checkin' and j.started_at > now() - interval '20 hours')
       and exists (select 1 from public.push_tokens t where t.user_id = p.id)
  loop
    select array_agg(r.text order by r.due_at) into v_items from (
      select text, due_at from public.reminders r
       where r.user_id = u.id and r.done_at is null and r.checkin
         and (r.due_at at time zone u.tz)::date = u.d
       order by r.due_at limit 3) r;
    select c.title into v_lesson from public.learn_enrolments e join public.learn_courses c on c.id = e.course_id
     where e.user_id = u.id and not e.paused
       and not exists (select 1 from public.learn_progress pr where pr.user_id = u.id and (pr.done_at at time zone u.tz)::date = u.d)
       and exists (select 1 from public.learn_lessons l where l.course_id = c.id and l.status = 'live'
                    and not exists (select 1 from public.learn_progress pr where pr.lesson_id = l.id and pr.user_id = u.id))
     order by e.last_at desc nulls last limit 1;
    if v_lesson is not null then v_items := array_prepend('today''s ' || v_lesson || ' lesson', coalesce(v_items, '{}')); end if;
    insert into public.job_runs (user_id, job, status, started_at, finished_at) values (u.id, 'evening_checkin', 'ok', now(), now());
    if coalesce(array_length(v_items, 1), 0) = 0 then continue; end if;
    v_body := 'Still open today: ' || array_to_string(v_items[1:3], ', ') || '. Plenty of evening left.';
    perform public.push_user(u.id, 'Tali', left(v_body, 170), '/reminders');
    update public.reminders set checked_in_on = u.d
     where user_id = u.id and done_at is null and checkin and (due_at at time zone u.tz)::date = u.d;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.learned_evening_checkins() from public, anon, authenticated;

select cron.unschedule('learned-evening') where exists (select 1 from cron.job where jobname = 'learned-evening');
select cron.schedule('learned-evening', '4,34 * * * *', $cron$ select public.learned_evening_checkins(); $cron$);

-- The nightly lesson writer (function tali-learn): 1:53am Sydney (14:53 UTC in summer). It writes a lesson a night in every
-- category, and more where someone is close to catching up.
select cron.unschedule('tali-learn-writer') where exists (select 1 from cron.job where jobname = 'tali-learn-writer');
select cron.schedule('tali-learn-writer', '53 14 * * *', $cron$
  select net.http_post(
    url := 'https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/tali-learn',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-tali-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'tali_brain_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000);
$cron$);
-- And personal paths, every 2 hours, so a new one has its next lesson the same day.
select cron.unschedule('tali-learn-personal') where exists (select 1 from cron.job where jobname = 'tali-learn-personal');
select cron.schedule('tali-learn-personal', '29 */2 * * *', $cron$
  select net.http_post(
    url := 'https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/tali-learn',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-tali-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'tali_brain_key')),
    body := '{"personal_only": true}'::jsonb,
    timeout_milliseconds := 150000);
$cron$);

-- What Tali sees about their learning in Talk: the paths they are on, the last lesson they did and the
-- next one, and how their games are going. Service only (tali-chat).
create or replace function public.tali_learn_context(p_user_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'paths', coalesce((select jsonb_agg(jsonb_build_object(
        'course', c.title, 'category', cat.name, 'own_path', c.owner is not null,
        'done', (select count(*) from public.learn_progress pr where pr.course_id = c.id and pr.user_id = p_user_id),
        'of', jsonb_array_length(c.outline),
        'last_done', (select l.title from public.learn_progress pr join public.learn_lessons l on l.id = pr.lesson_id
                       where pr.course_id = c.id and pr.user_id = p_user_id order by pr.done_at desc limit 1),
        'next', (select l.title from public.learn_lessons l where l.course_id = c.id and l.status = 'live'
                  and not exists (select 1 from public.learn_progress pr where pr.lesson_id = l.id and pr.user_id = p_user_id) order by l.n limit 1)
      ) order by e.last_at desc nulls last)
      from public.learn_enrolments e join public.learn_courses c on c.id = e.course_id join public.learn_categories cat on cat.id = c.category
      where e.user_id = p_user_id and not e.paused), '[]'::jsonb),
    'recall_cards_due', (select count(*) from public.learn_recall r where r.user_id = p_user_id and r.due_on <= public.learn_local_day(p_user_id)),
    'games_last_7_days', (select count(distinct r.day) from public.ponder_results r join public.ponder_players pl on pl.id = r.player_id
                           where pl.owner = p_user_id and pl.is_self and r.day > current_date - 7)
  );
$$;
revoke all on function public.tali_learn_context(uuid) from public, anon, authenticated;
grant execute on function public.tali_learn_context(uuid) to service_role;
