-- Recall: what Tali read in her library ranks under what she knows first hand (11 Nov 2026).
-- The big library run (10 Nov) added about 900 book lessons to the shared brain. On the 40 question
-- recall check, the right answer came first 80% of the time before the run and 70% after, because
-- a book lesson sometimes outranked the memory the question was really about.
-- Book lessons (source_ref 'library/...') now count for a share of their match score, set in
-- brain.embed_state.library_weight. They still come up when nothing first hand answers the question.
alter table brain.embed_state add column if not exists library_weight real not null default 0.5;

create or replace function brain.recall(p_user_id uuid, p_query text, p_limit integer default 12, p_kinds text[] default null, p_include_shared boolean default true)
returns table(id uuid, owner text, kind text, content text, about text[], importance smallint, confidence real, created_at timestamptz, score real)
language plpgsql set search_path to '' as $function$
declare lw real := coalesce((select e.library_weight from brain.embed_state e), 0.5);
begin
  return query
  with hits as (
    select m.id, case when m.user_id is null then 'shared' else 'private' end as owner,
           m.kind, m.content, m.about, m.importance, m.confidence, m.created_at,
           ((ts_rank(m.fts, websearch_to_tsquery('english', p_query)) * 4
            + greatest(extensions.similarity(m.content, p_query), 0)
            + m.importance * 0.05 + m.confidence * 0.1)
            * (case when m.source_ref like 'library/%' then lw else 1 end))::real as score
      from brain.memories m
     where m.status = 'active'
       and ((p_user_id is not null and m.user_id = p_user_id)
            or (m.user_id is null and m.legacy_owner is null and (p_include_shared or p_user_id is null)))
       and (p_kinds is null or m.kind = any(p_kinds))
       and (m.fts @@ websearch_to_tsquery('english', p_query)
            or extensions.similarity(m.content, p_query) > 0.15
            or exists (select 1 from unnest(m.about) a where a ilike '%' || p_query || '%'))
     order by score desc
     limit least(coalesce(p_limit,12), 50)
  ), bump as (
    update brain.memories u set recall_count = u.recall_count + 1, last_recalled_at = now()
      from hits where u.id = hits.id returning u.id
  )
  select h.* from hits h order by h.score desc;
end $function$;

create or replace function brain.recall_hybrid(p_user_id uuid, p_query text, p_qvec extensions.vector, p_limit integer default 12, p_kinds text[] default null, p_include_shared boolean default true)
returns table(id uuid, owner text, kind text, content text, about text[], importance smallint, confidence real, created_at timestamptz, score real)
language plpgsql set search_path to '' as $function$
declare n integer := least(coalesce(p_limit, 12), 50); margin real := coalesce((select e.recall_margin from brain.embed_state e), 0.2);
        lw real := coalesce((select e.library_weight from brain.embed_state e), 0.5);
begin
  if p_qvec is null then
    return query select * from brain.recall(p_user_id, p_query, p_limit, p_kinds, p_include_shared);
    return;
  end if;
  return query
  with lex_raw as (
    select m.id as mid,
           (ts_rank(m.fts, websearch_to_tsquery('english', p_query)) * 4
            + greatest(extensions.similarity(m.content, p_query), 0)
            + m.importance * 0.05 + m.confidence * 0.1)
            * (case when m.source_ref like 'library/%' then lw else 1 end) as s
      from brain.memories m
     where m.status = 'active'
       and ((p_user_id is not null and m.user_id = p_user_id)
            or (m.user_id is null and m.legacy_owner is null and (p_include_shared or p_user_id is null)))
       and (p_kinds is null or m.kind = any(p_kinds))
       and (m.fts @@ websearch_to_tsquery('english', p_query)
            or extensions.similarity(m.content, p_query) > 0.15
            or exists (select 1 from unnest(m.about) a where a ilike '%' || p_query || '%'))
     order by s desc
     limit n
  ), lex as (
    select l.mid, row_number() over (order by l.s desc) as rn from lex_raw l
  ), vec_raw as (
    select m.id as mid, (m.embedding_v2 operator(extensions.<=>) p_qvec) as d
      from brain.memories m
     where m.status = 'active' and m.embedding_v2 is not null
       and ((p_user_id is not null and m.user_id = p_user_id)
            or (m.user_id is null and m.legacy_owner is null and (p_include_shared or p_user_id is null)))
       and (p_kinds is null or m.kind = any(p_kinds))
     order by m.embedding_v2 operator(extensions.<=>) p_qvec
     limit n
  ), vec as (
    -- only what sits close to the best match by meaning, so a thin brain is not padded with noise
    select v.mid, row_number() over (order by v.d) as rn from vec_raw v
     where v.d <= (select min(v0.d) from vec_raw v0) + margin
  ), fused as (
    select coalesce(l.mid, v.mid) as mid,
           coalesce(1.0 / (60 + l.rn), 0) + coalesce(1.0 / (60 + v.rn), 0) as rrf
      from lex l full join vec v on v.mid = l.mid
  ), hits as (
    select m.id, case when m.user_id is null then 'shared' else 'private' end as owner,
           m.kind, m.content, m.about, m.importance, m.confidence, m.created_at,
           (f.rrf * 30 * (case when m.source_ref like 'library/%' then lw else 1 end)
            + m.importance * 0.005 + m.confidence * 0.01)::real as score
      from fused f join brain.memories m on m.id = f.mid
     order by 9 desc
     limit n
  ), bump as (
    update brain.memories u set recall_count = u.recall_count + 1, last_recalled_at = now()
      from hits where u.id = hits.id returning u.id
  )
  select h.* from hits h order by h.score desc;
end $function$;
