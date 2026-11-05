-- Tali HQ, 6 Nov 2026: the shared brain learns from everyone (asked for by Taj).
--
-- Lessons, mistakes and rules from every user (Taj included), and every night school lesson, go to
-- the shared brain (brain.memories with user_id null) that every Tali learns from, but only after a
-- nightly scrub (edge function tali-brain-share) rewrites each one as a general lesson with no
-- names, clients, prices or other personal details, or drops it when it can't be made general.
-- Facts, people, events and what she saw in photos are never shared.
--   Night school lessons qualify straight away. Chat lessons, mistakes and rules qualify once they
--   have proven themselves (held 3 times or more, never broken).
--   On by default. Each user can switch it off (profiles.share_learning, Settings, and the last step
--   of the tour says how) and can mark any one memory private (brain.memories.private).
--   The source memory gets shared_at once it has been looked at, shared or not, so it is never
--   sent twice. The privacy policy on totality360.com.au says this (6 Nov 2026).

alter table public.profiles add column if not exists share_learning boolean not null default true;
alter table brain.memories add column if not exists private boolean not null default false;
alter table brain.memories add column if not exists shared_at timestamptz;

-- The user marks one of their own memories private (or not).
create or replace function public.set_memory_private(p_id uuid, p_private boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update brain.memories set private = coalesce(p_private, true)
   where id = p_id and user_id = (select auth.uid());
  return found;
end $$;
revoke all on function public.set_memory_private(uuid, boolean) from public, anon;
grant execute on function public.set_memory_private(uuid, boolean) to authenticated;

-- What the nightly scrub looks at. Service role only.
create or replace function public.brain_share_candidates(p_limit integer default 40)
returns table(id uuid, kind text, content text)
language sql stable security definer set search_path = '' as $$
  select m.id, m.kind, m.content
    from brain.memories m
    join public.profiles p on p.id = m.user_id
   where m.user_id is not null and m.status = 'active' and not m.private and m.shared_at is null
     and p.share_learning
     and m.kind in ('lesson', 'mistake', 'rule')
     and (m.source = 'night school' or (coalesce(m.confirmed_count, 0) >= 3 and m.broken_count = 0))
   order by m.created_at
   limit least(coalesce(p_limit, 40), 100);
$$;
revoke all on function public.brain_share_candidates(integer) from public, anon, authenticated;
grant execute on function public.brain_share_candidates(integer) to service_role;

-- Records the scrub's answer: p_general is the rewritten lesson, or null when it stays private.
-- Re-checks the source is still shareable in case the user changed their mind mid-run.
create or replace function public.brain_share_promote(p_source uuid, p_general text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; ok boolean;
begin
  select exists (select 1 from brain.memories m join public.profiles p on p.id = m.user_id
                  where m.id = p_source and not m.private and m.status = 'active' and p.share_learning) into ok;
  update brain.memories set shared_at = now() where id = p_source;
  if not ok or p_general is null or length(btrim(p_general)) < 12 then return null; end if;
  v_id := brain.remember(null, 'lesson', btrim(p_general), 'shared from users', '{}', array['shared'], 3::smallint, 0.75::real, null);
  return v_id;
end $$;
revoke all on function public.brain_share_promote(uuid, text) from public, anon, authenticated;
grant execute on function public.brain_share_promote(uuid, text) to service_role;

-- The Brain screen shows private and shared on each memory.
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

  foreach r in array array['hippocampus','temporal','cerebellum','frontal','prefrontal','occipital'] loop
    select count(*) into v_count from brain.memories m
     where m.status = 'active' and m.region = r
       and (case when v_main then true else m.user_id = v_uid end);
    select coalesce(jsonb_agg(x order by x->>'at' desc), '[]'::jsonb) into v_items from (
      select jsonb_build_object('id', m.id, 'text', m.content, 'kind', m.kind, 'at', m.created_at,
                                'mine', m.user_id = v_uid, 'urgent', m.urgent,
                                'held', coalesce(m.confirmed_count, 0), 'broken', m.broken_count,
                                'private', m.private, 'shared', m.shared_at is not null) x
        from brain.memories m
       where m.status = 'active' and m.region = r
         and (m.user_id = v_uid or (v_main and m.user_id is null))
       order by m.created_at desc limit 40) s;
    if r = 'prefrontal' then
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

  select count(*) into v_count from brain.memories m
   where m.status = 'active' and m.urgent and (case when v_main then true else m.user_id = v_uid end);
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_items from (
    select jsonb_build_object('id', m.id, 'text', m.content, 'kind', m.kind, 'at', m.created_at, 'mine', m.user_id = v_uid, 'urgent', true) x
      from brain.memories m
     where m.status = 'active' and m.urgent and (m.user_id = v_uid or (v_main and m.user_id is null))
     order by m.created_at desc limit 40) s;
  v_count := v_count + (select count(*) from brain.conflicts c where c.user_id = v_uid and c.status = 'open');
  v_items := coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'kind', 'conflict', 'at', c.created_at, 'mine', true,
                         'text', n.content, 'old', o.content) order by c.created_at desc)
                         from brain.conflicts c join brain.memories n on n.id = c.new_id join brain.memories o on o.id = c.old_id
                        where c.user_id = v_uid and c.status = 'open'), '[]'::jsonb) || v_items;
  v_out := v_out || jsonb_build_object('id', 'amygdala', 'count', v_count, 'items', v_items);

  select count(*) into v_count from brain.memories m
   where m.created_at > now() - interval '7 days' and (case when v_main then true else m.user_id = v_uid end);
  select coalesce(jsonb_agg(jsonb_build_object('text', n || ' filed to ' || region, 'kind', 'routed') order by n desc), '[]'::jsonb) into v_items from (
    select m.region, count(*) n from brain.memories m
     where m.created_at > now() - interval '7 days' and (case when v_main then true else m.user_id = v_uid end)
     group by m.region) s;
  v_out := v_out || jsonb_build_object('id', 'thalamus', 'count', v_count, 'items', v_items);

  select count(*) into v_count from public.job_runs j
   where j.started_at > now() - interval '7 days' and (case when v_main then true else j.user_id = v_uid end);
  select coalesce(jsonb_agg(jsonb_build_object('text', n || ' x ' || replace(job, '_', ' '), 'kind', 'job') order by n desc), '[]'::jsonb) into v_items from (
    select j.job, count(*) n from public.job_runs j
     where j.started_at > now() - interval '7 days' and (case when v_main then true else j.user_id = v_uid end)
     group by j.job) s;
  v_out := v_out || jsonb_build_object('id', 'hypothalamus', 'count', v_count, 'items', v_items);

  select count(*) into v_count from public.google_connections c
   where case when v_main then true else c.user_id = v_uid end;
  select coalesce(jsonb_agg(jsonb_build_object('text', 'Google: Gmail and Calendar' || case when c.last_error is not null then ' (needs reconnecting)' else '' end, 'kind', 'sense')), '[]'::jsonb)
    into v_items from public.google_connections c where c.user_id = v_uid;
  v_out := v_out || jsonb_build_object('id', 'parietal', 'count', v_count, 'items', v_items);

  if v_main then
    select count(*) into v_count from brain.skills s where coalesce(s.status, 'active') <> 'retired';
    select coalesce(jsonb_agg(jsonb_build_object('text', s.name || coalesce(': ' || s.purpose, ''), 'kind', 'skill', 'at', s.updated_at) order by s.uses desc nulls last), '[]'::jsonb)
      into v_items from (select * from brain.skills s where coalesce(s.status, 'active') <> 'retired' order by s.uses desc nulls last limit 40) s;
  else
    v_count := 0; v_items := '[]'::jsonb;
  end if;
  v_out := v_out || jsonb_build_object('id', 'basal_ganglia', 'count', v_count, 'items', v_items);

  select count(*) into v_count from brain.memories m
   where m.status = 'active' and m.embedding is null and (case when v_main then true else m.user_id = v_uid end);
  v_out := v_out || jsonb_build_object('id', 'brainstem', 'count', v_count, 'items',
    jsonb_build_array(jsonb_build_object('text', case when v_count = 0 then 'Every memory is searchable' else v_count || ' memories waiting to be made searchable' end, 'kind', 'core')));

  select count(*) into v_count from brain.memories m where m.status = 'active' and m.user_id is null;
  v_out := v_out || jsonb_build_object('id', 'corpus_callosum', 'count', v_count, 'items',
    case when v_main then coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'text', m.content, 'kind', m.kind, 'at', m.created_at, 'mine', false)) from (select * from brain.memories m where m.status = 'active' and m.user_id is null order by m.created_at desc limit 40) m), '[]'::jsonb)
         else jsonb_build_array(jsonb_build_object('text', 'Lessons shared by every Tali, with no personal details', 'kind', 'shared')) end);

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

-- Every hour at :37, up to 40 at a time, so the backlog clears in a few runs and new ones are
-- shared within the hour after they qualify.
select cron.unschedule('tali-brain-share') where exists (select 1 from cron.job where jobname = 'tali-brain-share');
select cron.schedule('tali-brain-share', '37 * * * *', $cron$
  select net.http_post(
    url := 'https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/tali-brain-share',
    headers := jsonb_build_object('Content-Type','application/json','x-tali-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'tali_brain_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000)
  where exists (select 1 from public.brain_share_candidates(1));
$cron$);
