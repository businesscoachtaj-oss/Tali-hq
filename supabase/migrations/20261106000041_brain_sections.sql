-- Tali HQ, 6 Nov 2026: brain sections (asked for by Taj).
--
-- Every memory is now filed into a section of Tali's brain, named after the part of a human brain
-- that does the same job, and the app draws them as a 3D brain:
--   hippocampus  facts and events (memory)          temporal     people (who's who)
--   cerebellum   lessons and mistakes (fixing errors) frontal     rules and preferences (self-control)
--   prefrontal   plans and ideas, plus live goals and open decisions (planning)
--   occipital    what she saw in photos and screenshots (vision)
--   amygdala     anything flagged urgent (threat and urgency)
-- Sections that are not memories are counted from what is already built:
--   thalamus (router: memories filed this week), hypothalamus (body clock: scheduled jobs this week),
--   parietal (senses: connected Gmail, Calendar, Stripe), basal ganglia (habits: Tali's skills),
--   brainstem (core: memories still waiting for their embedding), corpus callosum (the shared brain).
--
-- The router (thalamus) is a trigger: every new memory gets its section from its kind, so nothing
-- that saves memories has to change. New kinds: 'seen' (vision) and 'plan' (planning). New column
-- 'urgent' for the amygdala; brain_remember_for takes it as an optional last argument.
--
-- Two views, one brain: my_brain('mine') is the signed in user's own brain. my_brain('main') is the
-- founder only: counts across every user and the shared brain, readable text for the founder's own
-- memories and the shared brain. Other users' memories count but are never returned as text.
-- Also from the open source brains Taj asked about (ideas only, no code):
--   Contradictions: when a new memory disagrees with an old one, Tali flags it (brain.conflicts) and
--   the user settles it in the app: keep the new one, keep the old one, or both are true.
--   Lessons that prove themselves: when Tali uses a lesson or rule in a reply she reports whether it
--   held. confirmed_count already existed; broken_count is new. 3 holds and no breaks = proven,
--   2 breaks and more breaks than holds = shaky (shown in the cerebellum, recalled less).
--   Links: people, clients and products (the 'about' names) that show up in more than one section
--   are returned as links, drawn as lines across the 3D brain.
-- tali_context now returns memory ids so tali-chat can refer to them.
-- Run this BEFORE deploying the tali-chat change that uses it.

-- 1. Section and urgency on every memory --------------------------------------------------------
alter table brain.memories add column if not exists region text;
alter table brain.memories add column if not exists urgent boolean not null default false;
-- New kinds: plan (planning) and seen (vision).
alter table brain.memories drop constraint if exists memories_kind_check;
alter table brain.memories add constraint memories_kind_check
  check (kind = any (array['event', 'fact', 'lesson', 'mistake', 'preference', 'person', 'idea', 'rule', 'plan', 'seen']));

create or replace function brain.region_for(p_kind text)
returns text language sql immutable set search_path = '' as $$
  select case p_kind
    when 'fact' then 'hippocampus'
    when 'event' then 'hippocampus'
    when 'person' then 'temporal'
    when 'lesson' then 'cerebellum'
    when 'mistake' then 'cerebellum'
    when 'rule' then 'frontal'
    when 'preference' then 'frontal'
    when 'idea' then 'prefrontal'
    when 'plan' then 'prefrontal'
    when 'seen' then 'occipital'
    else 'hippocampus'
  end;
$$;

-- The router: files each memory as it is written (and again if its kind changes).
create or replace function brain.route_memory()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.region is null or tg_op = 'UPDATE' and new.kind is distinct from old.kind then
    new.region := brain.region_for(new.kind);
  end if;
  return new;
end $$;

drop trigger if exists route_memory on brain.memories;
create trigger route_memory before insert or update of kind on brain.memories
  for each row execute function brain.route_memory();

update brain.memories set region = brain.region_for(kind) where region is null;
create index if not exists memories_region_idx on brain.memories (user_id, region) where status = 'active';
create index if not exists memories_urgent_idx on brain.memories (user_id) where urgent and status = 'active';

-- 2. Saving from chat: new kinds and the urgent flag ---------------------------------------------
-- The old five argument call still works because p_urgent defaults to false.
drop function if exists public.brain_remember_for(uuid, text, text, text[], text);
create or replace function public.brain_remember_for(
  p_user_id uuid, p_kind text, p_content text, p_about text[] default '{}'::text[],
  p_source_ref text default null, p_urgent boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_user_id is null then raise exception 'user id required'; end if;
  if p_kind not in ('event','fact','lesson','mistake','preference','person','idea','plan','seen') then
    raise exception 'bad kind %', p_kind;
  end if;
  v_id := brain.remember(p_user_id, p_kind, p_content, 'tali hq chat', coalesce(p_about, '{}'), array['chat'], 3::smallint, 0.8::real, p_source_ref);
  if coalesce(p_urgent, false) and v_id is not null then
    update brain.memories set urgent = true, importance = greatest(importance, 4::smallint) where id = v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.brain_remember_for(uuid, text, text, text[], text, boolean) from public, anon, authenticated;
grant execute on function public.brain_remember_for(uuid, text, text, text[], text, boolean) to service_role;

-- 3. The brain, section by section ---------------------------------------------------------------
create or replace function public.my_brain(p_scope text default 'mine')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_main boolean := p_scope = 'main' and v_uid = 'e89ca9de-a86e-4dd6-8094-bc518566352e'::uuid;
  v_out jsonb := '[]'::jsonb;
  r text;
  v_count bigint;
  v_items jsonb;
begin
  if v_uid is null then return null; end if;

  -- Memory sections. In the main brain every user's memories count; only the founder's own and the
  -- shared brain come back as text.
  foreach r in array array['hippocampus','temporal','cerebellum','frontal','prefrontal','occipital'] loop
    select count(*) into v_count from brain.memories m
     where m.status = 'active' and m.region = r
       and (case when v_main then true else m.user_id = v_uid end);
    select coalesce(jsonb_agg(x order by x->>'at' desc), '[]'::jsonb) into v_items from (
      select jsonb_build_object('id', m.id, 'text', m.content, 'kind', m.kind, 'at', m.created_at,
                                'mine', m.user_id = v_uid, 'urgent', m.urgent,
                                'held', coalesce(m.confirmed_count, 0), 'broken', m.broken_count) x
        from brain.memories m
       where m.status = 'active' and m.region = r
         and (m.user_id = v_uid or (v_main and m.user_id is null))
       order by m.created_at desc limit 40) s;
    if r = 'prefrontal' then
      -- Planning also holds live goals and open decisions (the user's own, in both views).
      v_count := v_count
        + (select count(*) from public.goals g where g.user_id = v_uid and coalesce(g.status, 'active') = 'active')
        + (select count(*) from public.decisions d where d.user_id = v_uid and d.outcome is null);
      v_items := v_items
        || coalesce((select jsonb_agg(jsonb_build_object('text', 'Goal: ' || g.title, 'kind', 'goal', 'at', g.created_at, 'mine', true) order by g.created_at desc)
                       from public.goals g where g.user_id = v_uid and coalesce(g.status, 'active') = 'active'), '[]'::jsonb)
        || coalesce((select jsonb_agg(jsonb_build_object('text', 'Decision: ' || d.decision, 'kind', 'decision', 'at', d.created_at, 'mine', true) order by d.created_at desc)
                       from (select * from public.decisions d where d.user_id = v_uid and d.outcome is null order by d.created_at desc limit 20) d), '[]'::jsonb);
    end if;
    v_out := v_out || jsonb_build_object('id', r, 'count', v_count, 'items', v_items);
  end loop;

  -- Amygdala: anything flagged urgent.
  select count(*) into v_count from brain.memories m
   where m.status = 'active' and m.urgent and (case when v_main then true else m.user_id = v_uid end);
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_items from (
    select jsonb_build_object('id', m.id, 'text', m.content, 'kind', m.kind, 'at', m.created_at, 'mine', m.user_id = v_uid, 'urgent', true) x
      from brain.memories m
     where m.status = 'active' and m.urgent and (m.user_id = v_uid or (v_main and m.user_id is null))
     order by m.created_at desc limit 40) s;
  -- Plus contradictions waiting to be settled (the user's own, in both views).
  v_count := v_count + (select count(*) from brain.conflicts c where c.user_id = v_uid and c.status = 'open');
  v_items := coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'kind', 'conflict', 'at', c.created_at, 'mine', true,
                         'text', n.content, 'old', o.content) order by c.created_at desc)
                         from brain.conflicts c join brain.memories n on n.id = c.new_id join brain.memories o on o.id = c.old_id
                        where c.user_id = v_uid and c.status = 'open'), '[]'::jsonb) || v_items;
  v_out := v_out || jsonb_build_object('id', 'amygdala', 'count', v_count, 'items', v_items);

  -- Thalamus: what the router filed in the last 7 days, by section.
  select count(*) into v_count from brain.memories m
   where m.created_at > now() - interval '7 days' and (case when v_main then true else m.user_id = v_uid end);
  select coalesce(jsonb_agg(jsonb_build_object('text', n || ' filed to ' || region, 'kind', 'routed') order by n desc), '[]'::jsonb) into v_items from (
    select m.region, count(*) n from brain.memories m
     where m.created_at > now() - interval '7 days' and (case when v_main then true else m.user_id = v_uid end)
     group by m.region) s;
  v_out := v_out || jsonb_build_object('id', 'thalamus', 'count', v_count, 'items', v_items);

  -- Hypothalamus: the body clock, scheduled jobs that ran this week.
  select count(*) into v_count from public.job_runs j
   where j.started_at > now() - interval '7 days' and (case when v_main then true else j.user_id = v_uid end);
  select coalesce(jsonb_agg(jsonb_build_object('text', n || ' x ' || replace(job, '_', ' '), 'kind', 'job') order by n desc), '[]'::jsonb) into v_items from (
    select j.job, count(*) n from public.job_runs j
     where j.started_at > now() - interval '7 days' and (case when v_main then true else j.user_id = v_uid end)
     group by j.job) s;
  v_out := v_out || jsonb_build_object('id', 'hypothalamus', 'count', v_count, 'items', v_items);

  -- Parietal: the senses, connected accounts (Gmail and Calendar through Google).
  select count(*) into v_count from public.google_connections c
   where case when v_main then true else c.user_id = v_uid end;
  select coalesce(jsonb_agg(jsonb_build_object('text', 'Google: Gmail and Calendar' || case when c.last_error is not null then ' (needs reconnecting)' else '' end, 'kind', 'sense')), '[]'::jsonb)
    into v_items from public.google_connections c where c.user_id = v_uid;
  v_out := v_out || jsonb_build_object('id', 'parietal', 'count', v_count, 'items', v_items);

  -- Basal ganglia: habits, Tali's skills (her own routines, shown in the main brain).
  if v_main then
    select count(*) into v_count from brain.skills s where coalesce(s.status, 'active') <> 'retired';
    select coalesce(jsonb_agg(jsonb_build_object('text', s.name || coalesce(': ' || s.purpose, ''), 'kind', 'skill', 'at', s.updated_at) order by s.uses desc nulls last), '[]'::jsonb)
      into v_items from (select * from brain.skills s where coalesce(s.status, 'active') <> 'retired' order by s.uses desc nulls last limit 40) s;
  else
    v_count := 0; v_items := '[]'::jsonb;
  end if;
  v_out := v_out || jsonb_build_object('id', 'basal_ganglia', 'count', v_count, 'items', v_items);

  -- Brainstem: the core keeps every memory searchable; this is what is still waiting.
  select count(*) into v_count from brain.memories m
   where m.status = 'active' and m.embedding is null and (case when v_main then true else m.user_id = v_uid end);
  v_out := v_out || jsonb_build_object('id', 'brainstem', 'count', v_count, 'items',
    jsonb_build_array(jsonb_build_object('text', case when v_count = 0 then 'Every memory is searchable' else v_count || ' memories waiting to be made searchable' end, 'kind', 'core')));

  -- Corpus callosum: the shared brain every Tali learns from (never personal details).
  select count(*) into v_count from brain.memories m where m.status = 'active' and m.user_id is null;
  v_out := v_out || jsonb_build_object('id', 'corpus_callosum', 'count', v_count, 'items',
    case when v_main then coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'text', m.content, 'kind', m.kind, 'at', m.created_at, 'mine', false)) from (select * from brain.memories m where m.status = 'active' and m.user_id is null order by m.created_at desc limit 40) m), '[]'::jsonb)
         else jsonb_build_array(jsonb_build_object('text', 'Lessons shared by every Tali, with no personal details', 'kind', 'shared')) end);

  -- Links: names (people, clients, products) that show up in more than one section. Drawn as lines
  -- across the brain. Built from readable memories only, so another user's client names never show.
  return jsonb_build_object(
    'links', coalesce((select jsonb_agg(jsonb_build_object('name', l.name, 'regions', l.regions, 'count', l.n) order by l.n desc)
                from (select a.name, array_agg(distinct a.region) regions, count(*) n
                        from (select lower(btrim(x)) name, m.region from brain.memories m, unnest(m.about) x
                               where m.status = 'active' and (m.user_id = v_uid or (v_main and m.user_id is null))
                                 and btrim(x) <> '') a
                       group by a.name having count(distinct a.region) > 1
                       order by count(*) desc limit 16) l), '[]'::jsonb),
    'scope', case when v_main then 'main' else 'mine' end,
    'total', (select count(*) from brain.memories m where m.status = 'active' and (case when v_main then true else m.user_id = v_uid end)),
    'regions', v_out);
end $$;
revoke all on function public.my_brain(text) from public, anon;
grant execute on function public.my_brain(text) to authenticated;


-- 4. Memory ids in chat context -----------------------------------------------------------------
-- Same as 20261101 tali_context with id added to memories and recent, so tali-chat can flag a
-- contradiction or record whether a lesson held.
create or replace function public.tali_context(p_user_id uuid, p_query text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  select jsonb_build_object(
    'profile', (select jsonb_build_object('first_name', pr.first_name, 'business_name', pr.business_name,
                  'business_type', pr.business_type, 'about_me', pr.about_me, 'timezone', pr.timezone)
                  from public.profiles pr where pr.id = p_user_id),
    'memories', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'content', r.content, 'about', r.about))
                  from brain.recall(p_user_id, coalesce(nullif(trim(p_query), ''), 'business'), 10, null, true) r), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind, 'content', m.content) order by m.created_at desc)
                  from (select id, kind, content, created_at from brain.memories
                         where user_id = p_user_id and status = 'active' and importance >= 4
                         order by created_at desc limit 8) m), '[]'::jsonb),
    'journal', coalesce((select jsonb_agg(jsonb_build_object('when', j.created_at::date, 'title', j.title, 'body', left(j.body, 600)) order by j.created_at desc)
                  from (select title, body, created_at from public.journal_entries
                         where user_id = p_user_id and private_to_tali = false
                         order by created_at desc limit 5) j), '[]'::jsonb)
  ) into v;
  return v;
end $$;

-- 5. Contradictions -----------------------------------------------------------------------------
create table if not exists brain.conflicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  new_id uuid not null references brain.memories(id) on delete cascade,
  old_id uuid not null references brain.memories(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'kept_new', 'kept_old', 'both')),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (new_id, old_id)
);
create index if not exists conflicts_open_idx on brain.conflicts (user_id) where status = 'open';
alter table brain.conflicts enable row level security;

-- Called by tali-chat (service role). Only the user's own memories can be in a conflict.
create or replace function public.brain_flag_conflict_for(p_user_id uuid, p_new uuid, p_old uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_new = p_old then return false; end if;
  if (select count(*) from brain.memories where id in (p_new, p_old) and user_id = p_user_id and status = 'active') <> 2 then
    return false;
  end if;
  insert into brain.conflicts (user_id, new_id, old_id) values (p_user_id, p_new, p_old) on conflict do nothing;
  return found;
end $$;
revoke all on function public.brain_flag_conflict_for(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.brain_flag_conflict_for(uuid, uuid, uuid) to service_role;

-- The user settles one: 'new' keeps the newer memory, 'old' keeps the older, 'both' means both true.
-- The one not kept is marked merged into the one kept (never deleted, so history stays).
create or replace function public.settle_conflict(p_id uuid, p_keep text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  if p_keep not in ('new', 'old', 'both') then raise exception 'keep must be new, old or both'; end if;
  select * into c from brain.conflicts where id = p_id and user_id = (select auth.uid()) and status = 'open' for update;
  if not found then return false; end if;
  if p_keep = 'new' then
    update brain.memories set status = 'merged', merged_into = c.new_id where id = c.old_id and user_id = c.user_id;
  elsif p_keep = 'old' then
    update brain.memories set status = 'merged', merged_into = c.old_id where id = c.new_id and user_id = c.user_id;
  end if;
  update brain.conflicts set status = case p_keep when 'new' then 'kept_new' when 'old' then 'kept_old' else 'both' end,
         settled_at = now() where id = p_id;
  return true;
end $$;
revoke all on function public.settle_conflict(uuid, text) from public, anon;
grant execute on function public.settle_conflict(uuid, text) to authenticated;

-- 6. Lessons that prove themselves --------------------------------------------------------------
alter table brain.memories add column if not exists broken_count integer not null default 0;

-- Called by tali-chat (service role) with the lessons, rules, mistakes and preferences she used in a
-- reply: held = it was right, broken = it turned out wrong. Own memories only.
create or replace function public.brain_evidence_for(p_user_id uuid, p_held uuid[], p_broken uuid[])
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer := 0;
begin
  update brain.memories set confirmed_count = coalesce(confirmed_count, 0) + 1, last_recalled_at = now()
   where id = any(coalesce(p_held, '{}')) and user_id = p_user_id and status = 'active'
     and kind in ('lesson', 'rule', 'mistake', 'preference');
  get diagnostics n = row_count;
  update brain.memories set broken_count = broken_count + 1
   where id = any(coalesce(p_broken, '{}')) and user_id = p_user_id and status = 'active'
     and kind in ('lesson', 'rule', 'mistake', 'preference');
  -- Proven lessons are recalled first; shaky ones drop to the bottom.
  update brain.memories set importance = greatest(importance, 4::smallint)
   where user_id = p_user_id and id = any(coalesce(p_held, '{}')) and coalesce(confirmed_count, 0) >= 3 and broken_count = 0;
  update brain.memories set importance = 1::smallint
   where user_id = p_user_id and id = any(coalesce(p_broken, '{}')) and broken_count >= 2 and broken_count > coalesce(confirmed_count, 0);
  return n;
end $$;
revoke all on function public.brain_evidence_for(uuid, uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.brain_evidence_for(uuid, uuid[], uuid[]) to service_role;
