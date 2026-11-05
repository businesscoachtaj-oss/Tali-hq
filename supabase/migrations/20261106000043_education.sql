-- Tali HQ, 6 Nov 2026: Tali's education (asked for by Taj: "It's an actual brain").
--
-- Every night a scheduled task studies real subjects for a part of the brain (philosophy for the
-- frontal lobe, sports science for the cerebellum, coding for the thalamus and so on) and saves what
-- it learnt to the shared brain, so every Tali grows more learned over weeks, months and years.
-- These memories are kind 'knowledge', user_id null (shared, no personal details), and carry the
-- part of the brain they belong to in region (set by brain_learn, so the router leaves it alone).
-- my_brain now counts memories in every part, and shows shared knowledge in everyone's brain.

alter table brain.memories drop constraint if exists memories_kind_check;
alter table brain.memories add constraint memories_kind_check
  check (kind = any (array['event', 'fact', 'lesson', 'mistake', 'preference', 'person', 'idea', 'rule', 'plan', 'seen', 'knowledge']));

-- Saves one thing learnt to the shared brain under a part of the brain. Same text twice is
-- counted as confirmed rather than saved again. Service role (and the SQL editor) only.
create or replace function public.brain_learn(p_region text, p_content text, p_about text[] default '{}', p_ref text default null, p_confidence real default 0.8)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_region not in ('frontal','prefrontal','parietal','temporal','occipital','cerebellum','hippocampus','amygdala',
                      'thalamus','hypothalamus','basal_ganglia','brainstem','corpus_callosum') then
    raise exception 'unknown part of the brain %', p_region;
  end if;
  if length(btrim(coalesce(p_content, ''))) < 12 then return null; end if;
  select m.id into v_id from brain.memories m
   where m.user_id is null and m.status = 'active' and lower(btrim(m.content)) = lower(btrim(p_content)) limit 1;
  if v_id is not null then
    update brain.memories set confirmed_count = coalesce(confirmed_count, 0) + 1 where id = v_id;
    return v_id;
  end if;
  insert into brain.memories (user_id, kind, content, source, about, tags, importance, confidence, source_ref, region)
  values (null, 'knowledge', btrim(p_content), 'education', coalesce(p_about, '{}'), array['education', p_region], 3,
          least(1, greatest(0, coalesce(p_confidence, 0.8))), p_ref, p_region)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.brain_learn(text, text, text[], text, real) from public, anon, authenticated;
grant execute on function public.brain_learn(text, text, text[], text, real) to service_role;

-- How far each part's education has got: what it has learnt, by subject. For the nightly task.
create or replace function public.brain_education_progress()
returns table(region text, subject text, lessons bigint, last_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.region, coalesce(m.about[1], 'general'), count(*), max(m.created_at)
    from brain.memories m
   where m.user_id is null and m.kind = 'knowledge' and m.status = 'active'
   group by 1, 2 order by 1, 4 desc;
$$;
revoke all on function public.brain_education_progress() from public, anon, authenticated;
grant execute on function public.brain_education_progress() to service_role;

create or replace function public.my_brain(p_scope text default 'mine')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_main boolean := p_scope = 'main' and v_uid = 'e89ca9de-a86e-4dd6-8094-bc518566352e'::uuid;
  v_out jsonb := '[]'::jsonb;
  r text;
  v_count bigint;
  v_items jsonb;
  v_extra_count bigint;
  v_extra jsonb;
begin
  if v_uid is null then return null; end if;

  -- Memories in every part. Readable: your own, the shared brain's education (everyone sees Tali's
  -- schooling), and in the founder's main brain the rest of the shared brain. Other users' memories
  -- only count, in the main brain.
  foreach r in array array['hippocampus','temporal','cerebellum','frontal','prefrontal','occipital','amygdala','thalamus',
                           'hypothalamus','parietal','basal_ganglia','brainstem','corpus_callosum'] loop
    select count(*) into v_count from brain.memories m
     where m.status = 'active' and m.region = r
       and (m.user_id = v_uid or (m.user_id is null and (v_main or m.kind = 'knowledge'))
            or (v_main and m.user_id is not null));
    select coalesce(jsonb_agg(x order by x->>'at' desc), '[]'::jsonb) into v_items from (
      select jsonb_build_object('id', m.id, 'text', m.content, 'kind', m.kind, 'at', m.created_at,
                                'mine', m.user_id = v_uid, 'urgent', m.urgent,
                                'held', coalesce(m.confirmed_count, 0), 'broken', m.broken_count,
                                'private', m.private, 'shared', m.shared_at is not null,
                                'about', m.about) x
        from brain.memories m
       where m.status = 'active' and m.region = r
         and (m.user_id = v_uid or (m.user_id is null and (v_main or m.kind = 'knowledge')))
       order by m.created_at desc limit 40) s;
    v_extra_count := 0; v_extra := '[]'::jsonb;

    if r = 'prefrontal' then
      v_extra_count := (select count(*) from public.goals g where g.user_id = v_uid and coalesce(g.status, 'active') = 'active')
                     + (select count(*) from public.decisions d where d.user_id = v_uid and d.outcome is null);
      v_extra := coalesce((select jsonb_agg(jsonb_build_object('text', 'Goal: ' || g.title, 'kind', 'goal', 'at', g.created_at, 'mine', true) order by g.created_at desc)
                             from public.goals g where g.user_id = v_uid and coalesce(g.status, 'active') = 'active'), '[]'::jsonb)
              || coalesce((select jsonb_agg(jsonb_build_object('text', 'Decision: ' || d.decision, 'kind', 'decision', 'at', d.created_at, 'mine', true) order by d.created_at desc)
                             from (select * from public.decisions d where d.user_id = v_uid and d.outcome is null order by d.created_at desc limit 20) d), '[]'::jsonb);
    elsif r = 'amygdala' then
      -- Anything flagged urgent, and contradictions waiting to be settled.
      v_extra_count := (select count(*) from brain.memories m where m.status = 'active' and m.urgent and coalesce(m.region, '') <> 'amygdala'
                          and (case when v_main then true else m.user_id = v_uid end))
                     + (select count(*) from brain.conflicts c where c.user_id = v_uid and c.status = 'open');
      v_extra := coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'kind', 'conflict', 'at', c.created_at, 'mine', true,
                             'text', n.content, 'old', o.content) order by c.created_at desc)
                             from brain.conflicts c join brain.memories n on n.id = c.new_id join brain.memories o on o.id = c.old_id
                            where c.user_id = v_uid and c.status = 'open'), '[]'::jsonb)
              || coalesce((select jsonb_agg(x) from (
                   select jsonb_build_object('id', m.id, 'text', m.content, 'kind', m.kind, 'at', m.created_at, 'mine', m.user_id = v_uid, 'urgent', true) x
                     from brain.memories m
                    where m.status = 'active' and m.urgent and coalesce(m.region, '') <> 'amygdala'
                      and (m.user_id = v_uid or (v_main and m.user_id is null))
                    order by m.created_at desc limit 40) s), '[]'::jsonb);
    elsif r = 'thalamus' then
      -- The router: what it filed this week.
      v_extra_count := (select count(*) from brain.memories m where m.created_at > now() - interval '7 days'
                          and m.user_id is not null and (case when v_main then true else m.user_id = v_uid end));
      v_extra := coalesce((select jsonb_agg(jsonb_build_object('text', n || ' filed to ' || region, 'kind', 'routed') order by n desc) from (
                   select m.region, count(*) n from brain.memories m
                    where m.created_at > now() - interval '7 days' and m.user_id is not null
                      and (case when v_main then true else m.user_id = v_uid end)
                    group by m.region) s), '[]'::jsonb);
    elsif r = 'hypothalamus' then
      -- The body clock: scheduled jobs that ran this week.
      v_extra_count := (select count(*) from public.job_runs j where j.started_at > now() - interval '7 days'
                          and (case when v_main then true else j.user_id = v_uid end));
      v_extra := coalesce((select jsonb_agg(jsonb_build_object('text', n || ' x ' || replace(job, '_', ' '), 'kind', 'job') order by n desc) from (
                   select j.job, count(*) n from public.job_runs j
                    where j.started_at > now() - interval '7 days' and (case when v_main then true else j.user_id = v_uid end)
                    group by j.job) s), '[]'::jsonb);
    elsif r = 'parietal' then
      -- The senses: connected accounts.
      v_extra_count := (select count(*) from public.google_connections c where case when v_main then true else c.user_id = v_uid end);
      v_extra := coalesce((select jsonb_agg(jsonb_build_object('text', 'Google: Gmail and Calendar' || case when c.last_error is not null then ' (needs reconnecting)' else '' end, 'kind', 'sense'))
                             from public.google_connections c where c.user_id = v_uid), '[]'::jsonb);
    elsif r = 'basal_ganglia' and v_main then
      -- Habits: Tali's own skills.
      v_extra_count := (select count(*) from brain.skills s where coalesce(s.status, 'active') <> 'retired');
      v_extra := coalesce((select jsonb_agg(jsonb_build_object('text', s.name || coalesce(': ' || s.purpose, ''), 'kind', 'skill', 'at', s.updated_at) order by s.uses desc nulls last)
                             from (select * from brain.skills s where coalesce(s.status, 'active') <> 'retired' order by s.uses desc nulls last limit 40) s), '[]'::jsonb);
    elsif r = 'brainstem' then
      -- The core: memories still waiting to be made searchable.
      v_extra_count := 0;
      v_extra := jsonb_build_array(jsonb_build_object('kind', 'core', 'text',
        coalesce((select case when count(*) = 0 then 'Every memory is searchable' else count(*) || ' memories waiting to be made searchable' end
                    from brain.memories m where m.status = 'active' and m.embedding is null
                     and (case when v_main then true else m.user_id = v_uid end)), 'Every memory is searchable')));
    elsif r = 'corpus_callosum' then
      -- The shared brain every Tali learns from (everything shared, not just this part's schooling).
      v_extra_count := (select count(*) from brain.memories m where m.status = 'active' and m.user_id is null and coalesce(m.region, '') <> 'corpus_callosum');
      v_extra := case when v_main then coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'text', m.content, 'kind', m.kind, 'at', m.created_at, 'mine', false))
                        from (select * from brain.memories m where m.status = 'active' and m.user_id is null and m.kind <> 'knowledge' order by m.created_at desc limit 40) m), '[]'::jsonb)
                      else jsonb_build_array(jsonb_build_object('text', 'Lessons shared by every Tali, with no personal details', 'kind', 'shared')) end;
    end if;

    v_out := v_out || jsonb_build_object('id', r, 'count', v_count + v_extra_count, 'items', v_extra || v_items);
  end loop;

  return jsonb_build_object(
    'links', coalesce((select jsonb_agg(jsonb_build_object('name', l.name, 'regions', l.regions, 'count', l.n) order by l.n desc)
                from (select a.name, array_agg(distinct a.region) regions, count(*) n
                        from (select lower(btrim(x)) name, m.region from brain.memories m, unnest(m.about) x
                               where m.status = 'active' and m.region is not null
                                 and (m.user_id = v_uid or (m.user_id is null and (v_main or m.kind = 'knowledge')))
                                 and btrim(x) <> '') a
                       group by a.name having count(distinct a.region) > 1
                       order by count(*) desc limit 16) l), '[]'::jsonb),
    'scope', case when v_main then 'main' else 'mine' end,
    'total', (select count(*) from brain.memories m where m.status = 'active'
               and (m.user_id = v_uid or (m.user_id is null and (v_main or m.kind = 'knowledge')) or (v_main and m.user_id is not null))),
    'regions', v_out);
end $$;
revoke all on function public.my_brain(text) from public, anon;
grant execute on function public.my_brain(text) to authenticated;
