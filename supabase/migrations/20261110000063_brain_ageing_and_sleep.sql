-- Brain overhaul, part 2 (10 Nov 2026, asked for by Taj): memories that age, and a real sleep.
--
--  1. Ageing. Each memory now carries "last confirmed" (set by itself whenever the memory proves
--     right or the owner corrects it). When Tali is handed an old fact, plan, event or idea that
--     nobody has confirmed lately, the date it was noted rides along, so she can say "last I heard".
--  2. Sleep for everyone. Once a night, in the owner's own early morning, Tali goes back over what
--     she learnt that day: merges repeats, lets a newer fact replace the older one it updates,
--     folds scattered notes into one clean memory, lets small stale notes fade, and writes two or
--     three lines on what she learnt. Every change is listed and can be undone by the owner.
--     Nothing is ever deleted.
--
-- The founder's own nightly Sleep task (outside the database) is untouched, and his brain is
-- skipped here so the two never fight. The weekly customer tidy from migration 058 still runs.
-- Additive: the two and three argument tali_context the older app builds call are unchanged.

-- ============================================================================================
-- 1. Ageing
-- ============================================================================================
alter table brain.memories add column if not exists last_confirmed_at timestamptz;

create or replace function brain.memories_confirmed() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(new.confirmed_count, 0) > coalesce(old.confirmed_count, 0)
     or new.corrected_at is distinct from old.corrected_at then
    new.last_confirmed_at := now();
  end if;
  return new;
end $$;
drop trigger if exists memories_confirmed on brain.memories;
create trigger memories_confirmed before update of confirmed_count, corrected_at on brain.memories
  for each row execute function brain.memories_confirmed();

-- The few words added after an old memory when Tali is handed it. Empty for anything fresh, for
-- people, preferences, lessons and rules (those do not go stale by the calendar), and for yearly dates.
create or replace function brain.age_note(p_kind text, p_created timestamptz, p_confirmed timestamptz, p_yearly boolean)
returns text language sql stable set search_path = '' as $$
  select case
    when p_kind not in ('fact', 'event', 'plan', 'idea', 'seen') or coalesce(p_yearly, false) then ''
    when greatest(p_created, coalesce(p_confirmed, p_created)) > now() - interval '45 days' then ''
    when p_confirmed is not null and p_confirmed > p_created
      then ' (noted ' || to_char(p_created, 'FMDD Mon YYYY') || ', last confirmed ' || to_char(p_confirmed, 'FMDD Mon YYYY') || ')'
    else ' (noted ' || to_char(p_created, 'FMDD Mon YYYY') || ', not confirmed since)'
  end;
$$;

create or replace function public.tali_context(p_user_id uuid, p_query text, p_limit integer, p_qvec text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v jsonb; n integer := least(greatest(coalesce(p_limit, 10), 1), 40);
        q extensions.vector(1024) := case when nullif(trim(coalesce(p_qvec, '')), '') is null then null else p_qvec::extensions.vector(1024) end;
begin
  select jsonb_build_object(
      'profile', (select jsonb_build_object('first_name', pr.first_name, 'business_name', pr.business_name,
                        'business_type', pr.business_type, 'about_me', pr.about_me, 'timezone', pr.timezone)
                    from public.profiles pr where pr.id = p_user_id),
      'memories', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind,
                        'content', r.content || coalesce((select brain.age_note(m.kind, m.created_at, m.last_confirmed_at, m.yearly)
                                                            from brain.memories m where m.id = r.id and m.user_id = p_user_id), ''),
                        'about', r.about) order by r.score desc)
                    from brain.recall_hybrid(p_user_id, coalesce(nullif(trim(p_query), ''), 'business'), q, n, null, true) r), '[]'::jsonb),
      'recent', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind, 'content', m.content) order by m.created_at desc)
                    from (select id, kind, content, created_at from brain.memories
                           where user_id = p_user_id and status = 'active' and importance >= 4
                           order by created_at desc limit case when n > 10 then 12 else 8 end) m), '[]'::jsonb),
      'journal', coalesce((select jsonb_agg(jsonb_build_object('when', j.created_at::date, 'title', j.title, 'body', left(j.body, 600)) order by j.created_at desc)
                    from (select title, body, created_at from public.journal_entries
                           where user_id = p_user_id and private_to_tali = false
                           order by created_at desc limit 5) j), '[]'::jsonb),
      'search', case when q is null then 'words' else 'words and meaning' end
    ) into v;
  return v;
end $$;
revoke all on function public.tali_context(uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.tali_context(uuid, text, integer, text) to service_role;

-- ============================================================================================
-- 2. Sleep
-- ============================================================================================
-- One row per person per night. `changes` is a list the owner can read and undo:
--   { "type": "merged" | "replaced" | "combined" | "faded", "text": what she kept or let go,
--     "was": [the words that were replaced or folded in], "keep": uuid | null, "gone": [uuid],
--     "undone": false }
create table if not exists public.brain_sleeps (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  night date not null,
  learned text,
  changes jsonb not null default '[]'::jsonb,
  new_memories integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, night)
);
alter table public.brain_sleeps enable row level security;
drop policy if exists "Own sleeps" on public.brain_sleeps;
create policy "Own sleeps" on public.brain_sleeps for select to authenticated using (user_id = (select auth.uid()));
revoke all on table public.brain_sleeps from anon, authenticated;
grant select on table public.brain_sleeps to authenticated;

-- Who is due: it is between 2am and 5am where they live, they have not slept tonight, and they
-- have at least one new memory since the last sleep. Never the founder (he has his own Sleep).
create or replace function public.brain_sleep_due(p_limit integer default 20)
returns table(user_id uuid, night date)
language sql stable security definer set search_path = '' as $$
  with people as (
    select pr.id as uid,
           (now() at time zone coalesce(nullif(pr.timezone, ''), 'Australia/Sydney')) as local_now
      from public.profiles pr
     where pr.id <> 'e89ca9de-a86e-4dd6-8094-bc518566352e'
  )
  select p.uid, p.local_now::date
    from people p
   where extract(hour from p.local_now) between 2 and 4
     and not exists (select 1 from public.brain_sleeps s where s.user_id = p.uid and s.night = p.local_now::date)
     and exists (select 1 from brain.memories m
                  where m.user_id = p.uid and m.status = 'active'
                    and m.created_at > coalesce((select max(s.created_at) from public.brain_sleeps s where s.user_id = p.uid), 'epoch'::timestamptz))
   order by p.uid
   limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

-- What she goes back over: the new memories since the last sleep (newest 30), and for each, the
-- older memories of the same person that sit closest in meaning. Refs are n1.. and o1..
create or replace function public.brain_sleep_material(p_user_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare since timestamptz := coalesce((select max(s.created_at) from public.brain_sleeps s where s.user_id = p_user_id), 'epoch'::timestamptz);
        out jsonb;
begin
  with fresh as (
    select m.id, m.kind, m.content, m.about, m.created_at, m.embedding_v2
      from brain.memories m
     where m.user_id = p_user_id and m.status = 'active' and m.created_at > since
     order by m.created_at desc limit 30
  ), near as (
    select distinct o.id, o.kind, o.content, o.about, o.created_at
      from fresh f
      cross join lateral (
        select m.id, m.kind, m.content, m.about, m.created_at
          from brain.memories m
         where m.user_id = p_user_id and m.status = 'active' and m.created_at <= since
           and m.embedding_v2 is not null and f.embedding_v2 is not null
           and not coalesce(m.urgent, false)
           and (m.embedding_v2 operator(extensions.<=>) f.embedding_v2) < 0.45
         order by m.embedding_v2 operator(extensions.<=>) f.embedding_v2
         limit 3) o
     limit 40
  )
  select jsonb_build_object(
    'fresh', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'kind', f.kind, 'content', f.content, 'about', f.about, 'when', f.created_at::date) order by f.created_at) from fresh f), '[]'::jsonb),
    'older', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'content', n.content, 'about', n.about, 'when', n.created_at::date) order by n.created_at) from near n), '[]'::jsonb)
  ) into out;
  return out;
end $$;

-- Applies one night. p_replace: [{ "new": uuid, "old": uuid }]; p_combine: [{ "ids": [uuid], "text": string }].
-- Every item is checked again here, so a confused model can never touch another person's memories,
-- an urgent one, one the owner has corrected by hand, or one in an open contradiction.
create or replace function public.brain_sleep_apply(p_user_id uuid, p_night date, p_learned text, p_replace jsonb default '[]'::jsonb, p_combine jsonb default '[]'::jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r jsonb; p record; changes jsonb := '[]'::jsonb; a brain.memories%rowtype; b brain.memories%rowtype;
        ids uuid[]; txt text; new_id uuid; n_merged integer := 0; n_replaced integer := 0; n_combined integer := 0; n_faded integer := 0;
        since timestamptz := coalesce((select max(s.created_at) from public.brain_sleeps s where s.user_id = p_user_id), 'epoch'::timestamptz);
        n_new integer; keep uuid; gone uuid; clean text;
begin
  if p_user_id is null or p_user_id = 'e89ca9de-a86e-4dd6-8094-bc518566352e' then return jsonb_build_object('ok', false, 'why', 'not for this brain'); end if;
  if exists (select 1 from public.brain_sleeps s where s.user_id = p_user_id and s.night = p_night) then return jsonb_build_object('ok', false, 'why', 'already slept'); end if;
  select count(*) into n_new from brain.memories m where m.user_id = p_user_id and m.status = 'active' and m.created_at > since;

  -- a. A newer fact replaces the older one it updates.
  for r in select * from jsonb_array_elements(coalesce(p_replace, '[]'::jsonb)) limit 8 loop
    begin
      select * into a from brain.memories where id = (r->>'new')::uuid and user_id = p_user_id and status = 'active';
      if not found then continue; end if;
      select * into b from brain.memories where id = (r->>'old')::uuid and user_id = p_user_id and status = 'active';
      if not found then continue; end if;
    exception when others then continue;
    end;
    if a.id = b.id or b.created_at >= a.created_at or coalesce(b.urgent, false) or b.corrected_at is not null or a.kind <> b.kind then continue; end if;
    if exists (select 1 from brain.conflicts c where c.status = 'open' and (c.new_id in (a.id, b.id) or c.old_id in (a.id, b.id))) then continue; end if;
    update brain.memories k set about = (select array(select distinct v from unnest(k.about || b.about) v)),
           due_on = coalesce(k.due_on, b.due_on), yearly = k.yearly or b.yearly where k.id = a.id;
    update brain.memories set status = 'merged', merged_into = a.id where id = b.id;
    changes := changes || jsonb_build_object('type', 'replaced', 'text', a.content, 'was', jsonb_build_array(b.content), 'keep', a.id, 'gone', jsonb_build_array(b.id), 'undone', false);
    n_replaced := n_replaced + 1;
  end loop;

  -- b. Scattered notes folded into one clean memory.
  for r in select * from jsonb_array_elements(coalesce(p_combine, '[]'::jsonb)) limit 4 loop
    begin
      select array_agg(distinct v::uuid) into ids from jsonb_array_elements_text(r->'ids') v;
    exception when others then continue;
    end;
    clean := trim(regexp_replace(replace(replace(coalesce(r->>'text', ''), chr(8212), ', '), chr(8211), ' to '), '\s+', ' ', 'g'));
    if ids is null or cardinality(ids) < 2 or cardinality(ids) > 5 or length(clean) < 12 or length(clean) > 500 then continue; end if;
    if (select count(*) from brain.memories m where m.id = any(ids) and m.user_id = p_user_id and m.status = 'active'
           and not coalesce(m.urgent, false) and m.corrected_at is null) <> cardinality(ids) then continue; end if;
    if (select count(distinct m.kind) from brain.memories m where m.id = any(ids)) <> 1 then continue; end if;
    if exists (select 1 from brain.conflicts c where c.status = 'open' and (c.new_id = any(ids) or c.old_id = any(ids))) then continue; end if;
    select * into a from brain.memories m where m.id = any(ids) order by m.importance desc, m.created_at desc limit 1;
    insert into brain.memories (user_id, kind, content, about, tags, source, source_ref, importance, confidence, confirmed_count, private, due_on, yearly, written_by)
    select p_user_id, a.kind, clean,
           (select array(select distinct v from brain.memories m, unnest(m.about) v where m.id = any(ids))),
           (select array(select distinct v from brain.memories m, unnest(m.tags) v where m.id = any(ids))) || array['sleep'],
           'sleep', 'sleep/' || p_night::text,
           (select max(m.importance) from brain.memories m where m.id = any(ids)),
           (select max(m.confidence) from brain.memories m where m.id = any(ids)),
           (select coalesce(sum(m.confirmed_count), 0)::integer from brain.memories m where m.id = any(ids)),
           (select bool_or(m.private) from brain.memories m where m.id = any(ids)),
           (select min(m.due_on) from brain.memories m where m.id = any(ids)),
           (select bool_or(m.yearly) from brain.memories m where m.id = any(ids)),
           'claude'
    returning id into new_id;
    changes := changes || jsonb_build_object('type', 'combined', 'text', clean,
      'was', (select jsonb_agg(m.content order by m.created_at) from brain.memories m where m.id = any(ids)),
      'keep', new_id, 'gone', to_jsonb(ids), 'undone', false);
    update brain.memories set status = 'merged', merged_into = new_id where id = any(ids);
    n_combined := n_combined + 1;
  end loop;

  -- c. Plain repeats (the same careful test as the weekly tidy).
  for p in
    select x.id as a, y.id as b,
           (x.confirmed_count > y.confirmed_count
            or (x.confirmed_count = y.confirmed_count and x.importance > y.importance)
            or (x.confirmed_count = y.confirmed_count and x.importance = y.importance and x.created_at <= y.created_at)) as keep_a
      from brain.memories x
      join brain.memories y on y.user_id = x.user_id and y.id > x.id and y.kind = x.kind and y.status = 'active'
     where x.user_id = p_user_id and x.status = 'active'
       and x.embedding is not null and y.embedding is not null
       and not coalesce(x.urgent, false) and not coalesce(y.urgent, false)
       and -(x.embedding operator(extensions.<#>) y.embedding) >= 0.95
       and extensions.similarity(x.content, y.content) >= 0.55
       and not exists (select 1 from brain.conflicts c where c.status = 'open' and (c.new_id in (x.id, y.id) or c.old_id in (x.id, y.id)))
     order by -(x.embedding operator(extensions.<#>) y.embedding) desc
     limit 20
  loop
    keep := case when p.keep_a then p.a else p.b end;
    gone := case when p.keep_a then p.b else p.a end;
    if exists (select 1 from brain.memories z where z.id in (keep, gone) and z.status <> 'active') then continue; end if;
    select * into b from brain.memories where id = gone;
    update brain.memories k
       set about = (select array(select distinct v from unnest(k.about || b.about) v)),
           tags = (select array(select distinct v from unnest(k.tags || b.tags) v)),
           confirmed_count = k.confirmed_count + b.confirmed_count + 1,
           private = k.private or b.private, due_on = coalesce(k.due_on, b.due_on), yearly = k.yearly or b.yearly
     where k.id = keep;
    update brain.memories set status = 'merged', merged_into = keep where id = gone;
    changes := changes || jsonb_build_object('type', 'merged', 'text', (select content from brain.memories where id = keep),
      'was', jsonb_build_array(b.content), 'keep', keep, 'gone', jsonb_build_array(gone), 'undone', false);
    n_merged := n_merged + 1;
  end loop;

  -- d. Small stale notes fade. Only things she saw or one-off events, low importance, four months
  --    old, never confirmed, never corrected, not recalled in three months, no date still to come.
  for a in
    select * from brain.memories m
     where m.user_id = p_user_id and m.status = 'active'
       and m.kind in ('seen', 'event') and m.importance <= 2
       and not coalesce(m.urgent, false) and not coalesce(m.yearly, false)
       and m.created_at < now() - interval '120 days'
       and coalesce(m.confirmed_count, 0) = 0 and m.corrected_at is null
       and (m.last_recalled_at is null or m.last_recalled_at < now() - interval '90 days')
       and (m.due_on is null or m.due_on < current_date)
     order by m.created_at limit 10
  loop
    update brain.memories set status = 'faded' where id = a.id;
    changes := changes || jsonb_build_object('type', 'faded', 'text', a.content, 'was', '[]'::jsonb, 'keep', null, 'gone', jsonb_build_array(a.id), 'undone', false);
    n_faded := n_faded + 1;
  end loop;

  insert into public.brain_sleeps (user_id, night, learned, changes, new_memories)
  values (p_user_id, p_night,
          nullif(left(trim(regexp_replace(replace(replace(coalesce(p_learned, ''), chr(8212), ', '), chr(8211), ' to '), '[ \t]+', ' ', 'g')), 600), ''),
          changes, n_new);
  if n_merged + n_replaced + n_combined + n_faded > 0 then
    insert into brain.sleep_log (merged, faded, promoted, conflicts, notes)
    values (n_merged + n_replaced + n_combined, n_faded, 0, 0,
            'Nightly sleep for one customer brain: ' || n_merged || ' repeats merged, ' || n_replaced || ' updated, ' || n_combined || ' folded together, ' || n_faded || ' faded. Nothing deleted.');
  end if;
  return jsonb_build_object('ok', true, 'new', n_new, 'merged', n_merged, 'replaced', n_replaced, 'combined', n_combined, 'faded', n_faded);
end $$;

revoke all on function public.brain_sleep_due(integer), public.brain_sleep_material(uuid), public.brain_sleep_apply(uuid, date, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.brain_sleep_due(integer), public.brain_sleep_material(uuid), public.brain_sleep_apply(uuid, date, text, jsonb, jsonb) to service_role;

-- For the app: the last few nights, newest first.
create or replace function public.my_sleeps(p_limit integer default 7)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'night', s.night, 'learned', s.learned, 'new_memories', s.new_memories,
           'changes', (select coalesce(jsonb_agg(jsonb_build_object('index', c.i - 1, 'type', c.v->>'type', 'text', c.v->>'text', 'was', c.v->'was', 'undone', coalesce((c.v->>'undone')::boolean, false)) order by c.i), '[]'::jsonb)
                         from jsonb_array_elements(s.changes) with ordinality c(v, i))) order by s.night desc), '[]'::jsonb)
    from (select * from public.brain_sleeps where user_id = (select auth.uid()) order by night desc limit least(greatest(coalesce(p_limit, 7), 1), 30)) s;
$$;

-- The owner undoes one change from a night. Puts the old memories back and, for a fold, retires
-- the folded one. Returns false when it is not theirs or was already undone.
create or replace function public.my_sleep_undo(p_sleep_id bigint, p_index integer)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare s public.brain_sleeps%rowtype; c jsonb; gone uuid[]; uid uuid := (select auth.uid());
begin
  if uid is null then return false; end if;
  select * into s from public.brain_sleeps where id = p_sleep_id and user_id = uid for update;
  if not found then return false; end if;
  c := s.changes -> p_index;
  if c is null or coalesce((c->>'undone')::boolean, false) then return false; end if;
  select array_agg(v::uuid) into gone from jsonb_array_elements_text(c->'gone') v;
  if c->>'type' = 'faded' then
    update brain.memories set status = 'active' where id = any(gone) and user_id = uid and status = 'faded';
  else
    update brain.memories set status = 'active', merged_into = null where id = any(gone) and user_id = uid and status = 'merged';
    if c->>'type' = 'combined' then
      update brain.memories set status = 'retired' where id = (c->>'keep')::uuid and user_id = uid and source = 'sleep';
    end if;
  end if;
  update public.brain_sleeps set changes = jsonb_set(changes, array[p_index::text, 'undone'], 'true'::jsonb) where id = p_sleep_id;
  return true;
end $$;

revoke all on function public.my_sleeps(integer), public.my_sleep_undo(bigint, integer) from public, anon;
grant execute on function public.my_sleeps(integer), public.my_sleep_undo(bigint, integer) to authenticated;

-- NOT SWITCHED ON YET (10 Nov 2026). The nightly job waits until the app shows each night's
-- changes with an undo, so nobody's memories are changed where they cannot see it. To switch it on,
-- run the block below. To switch it off again: select cron.unschedule('tali-brain-sleep');
--
-- select cron.unschedule('tali-brain-sleep') where exists (select 1 from cron.job where jobname = 'tali-brain-sleep');
-- select cron.schedule('tali-brain-sleep', '37 * * * *', $cron$
--   select net.http_post(
--     url := 'https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/tali-brain-sleep',
--     headers := jsonb_build_object('Content-Type','application/json','x-tali-key',
--       (select decrypted_secret from vault.decrypted_secrets where name = 'tali_brain_key')),
--     body := '{}'::jsonb,
--     timeout_milliseconds := 120000)
--   where exists (select 1 from public.brain_sleep_due(1));
-- $cron$);
