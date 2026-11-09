-- 9 Nov 2026 (Tuesday list): skills on the Brain screen show uses, wins, last used and status.
-- Same my_brain as before; the only change is four extra keys on each skill item.
CREATE OR REPLACE FUNCTION public.my_brain(p_scope text DEFAULT 'mine'::text)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE SECURITY DEFINER
  SET search_path TO ''
AS $function$
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
  v_extra_count := (select count(*) from brain.memories m where m.created_at > now() - interval '7 days'
  and m.user_id is not null and (case when v_main then true else m.user_id = v_uid end));
  v_extra := coalesce((select jsonb_agg(jsonb_build_object('text', n || ' filed to ' || region, 'kind', 'routed') order by n desc) from (
  select m.region, count(*) n from brain.memories m
  where m.created_at > now() - interval '7 days' and m.user_id is not null
  and (case when v_main then true else m.user_id = v_uid end)
  group by m.region) s), '[]'::jsonb);
  elsif r = 'hypothalamus' then
  v_extra_count := (select count(*) from public.job_runs j where j.started_at > now() - interval '7 days'
  and (case when v_main then true else j.user_id = v_uid end));
  v_extra := coalesce((select jsonb_agg(jsonb_build_object('text', n || ' x ' || replace(job, '_', ' '), 'kind', 'job') order by n desc) from (
  select j.job, count(*) n from public.job_runs j
  where j.started_at > now() - interval '7 days' and (case when v_main then true else j.user_id = v_uid end)
  group by j.job) s), '[]'::jsonb);
  elsif r = 'parietal' then
  v_extra_count := (select count(*) from public.google_connections c where case when v_main then true else c.user_id = v_uid end);
  v_extra := coalesce((select jsonb_agg(jsonb_build_object('text', 'Google: Gmail and Calendar' || case when c.last_error is not null then ' (needs reconnecting)' else '' end, 'kind', 'sense'))
  from public.google_connections c where c.user_id = v_uid), '[]'::jsonb);
  elsif r = 'basal_ganglia' and v_main then
  v_extra_count := (select count(*) from brain.skills s where coalesce(s.status, 'active') <> 'retired');
  v_extra := coalesce((select jsonb_agg(jsonb_build_object('text', s.name || coalesce(': ' || s.purpose, ''), 'kind', 'skill', 'at', s.updated_at, 'uses', coalesce(s.uses, 0), 'wins', coalesce(s.wins, 0), 'last_used', s.last_used_at, 'status', s.status) order by s.uses desc nulls last)
  from (select * from brain.skills s where coalesce(s.status, 'active') <> 'retired' order by s.uses desc nulls last limit 40) s), '[]'::jsonb);
  elsif r = 'brainstem' then
  v_extra_count := 0;
  v_extra := jsonb_build_array(jsonb_build_object('kind', 'core', 'text',
  coalesce((select case when count(*) = 0 then 'Every memory is searchable' else count(*) || ' memories waiting to be made searchable' end
  from brain.memories m where m.status = 'active' and m.embedding is null
  and (case when v_main then true else m.user_id = v_uid end)), 'Every memory is searchable')));
  elsif r = 'corpus_callosum' then
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
  end $function$;
