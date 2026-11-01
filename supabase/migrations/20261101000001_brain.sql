-- Tali HQ project (jbyzblwrywgxilhmfyjt) migration 001: Tali's brain.
-- Ported from Livewell's tali_brain schema (1 Nov 2026), split into her shared brain
-- (user_id is null: lessons and know-how for everyone, never personal details) and a
-- private brain per user (user_id set). Memories imported from Livewell that belong to
-- Taj sit under legacy_owner = 'taj' until his Tali HQ account exists, then
-- brain.claim_legacy() attaches them to his user id.

create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists brain;
revoke all on schema brain from public, anon, authenticated;
grant usage on schema brain to service_role;

create table brain.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  legacy_owner text,
  kind text not null check (kind in ('event','fact','lesson','mistake','preference','person','idea','rule')),
  content text not null check (length(content) between 3 and 4000),
  about text[] not null default '{}',
  tags text[] not null default '{}',
  source text not null,
  source_ref text,
  importance smallint not null default 3 check (importance between 1 and 5),
  confidence real not null default 0.7 check (confidence between 0 and 1),
  status text not null default 'active' check (status in ('active','faded','merged','wrong','retired')),
  merged_into uuid references brain.memories(id),
  created_at timestamptz not null default now(),
  last_recalled_at timestamptz,
  recall_count integer not null default 0,
  confirmed_count integer not null default 0,
  embedding extensions.vector(384),
  fts tsvector
);
comment on table brain.memories is 'Tali''s memories. user_id null = her shared brain (no personal details). user_id set = that user''s private brain.';
create index memories_user_kind_status_idx on brain.memories (user_id, kind, status, created_at desc);
create index memories_legacy_idx on brain.memories (legacy_owner) where legacy_owner is not null;
create index memories_fts_idx on brain.memories using gin (fts);
create index memories_about_idx on brain.memories using gin (about);
create index memories_trgm_idx on brain.memories using gin (content extensions.gin_trgm_ops);
create index memories_embedding_idx on brain.memories using hnsw (embedding extensions.vector_ip_ops);

create table brain.entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  legacy_owner text,
  name text not null,
  type text not null check (type in ('person','club','company','campaign','product','community','place','other')),
  summary text,
  aliases text[] not null default '{}',
  updated_at timestamptz not null default now()
);
create unique index entities_owner_name_key on brain.entities (coalesce(user_id::text, coalesce(legacy_owner, 'shared')), lower(name));

create table brain.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  purpose text not null,
  steps text not null,
  status text not null default 'draft' check (status in ('draft','tested','proposed','skill','retired')),
  uses integer not null default 0,
  wins integer not null default 0,
  last_used_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table brain.skills is 'Shared skills Tali uses for everyone. New ones need Taj''s approval before status = skill.';

create table brain.rules (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  why text,
  active boolean not null default true,
  approved_at timestamptz,
  approved_by text,
  created_at timestamptz not null default now()
);
comment on table brain.rules is 'Shared rules (her notebook). Tali can propose, only Taj approves.';

create table brain.queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  embedding extensions.vector(384)
);

create table brain.sleep_log (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  merged integer not null default 0,
  faded integer not null default 0,
  promoted integer not null default 0,
  conflicts integer not null default 0,
  notes text
);

alter table brain.memories enable row level security;
alter table brain.entities enable row level security;
alter table brain.skills enable row level security;
alter table brain.rules enable row level security;
alter table brain.queries enable row level security;
alter table brain.sleep_log enable row level security;
grant all on all tables in schema brain to service_role;

create or replace function brain.memories_fts() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.fts := to_tsvector('english',
    coalesce(new.content,'') || ' ' || array_to_string(new.about,' ') || ' ' || array_to_string(new.tags,' '));
  if tg_op = 'UPDATE' and new.content is distinct from old.content then
    new.embedding := null;
  end if;
  return new;
end $$;
create trigger memories_fts before insert or update on brain.memories
  for each row execute function brain.memories_fts();

-- remember: p_user_id null writes to the shared brain.
create or replace function brain.remember(
  p_user_id uuid, p_kind text, p_content text, p_source text,
  p_about text[] default '{}', p_tags text[] default '{}',
  p_importance smallint default 3, p_confidence real default 0.7, p_source_ref text default null)
returns uuid language plpgsql set search_path = '' as $$
declare v_id uuid;
begin
  select m.id into v_id from brain.memories m
   where m.status = 'active' and m.user_id is not distinct from p_user_id
     and lower(trim(m.content)) = lower(trim(p_content)) limit 1;
  if v_id is not null then
    update brain.memories set confirmed_count = confirmed_count + 1,
           confidence = least(1, confidence + 0.05),
           about = (select array(select distinct unnest(about || coalesce(p_about,'{}')))),
           tags  = (select array(select distinct unnest(tags || coalesce(p_tags,'{}'))))
     where id = v_id;
    return v_id;
  end if;
  insert into brain.memories(user_id, kind, content, source, about, tags, importance, confidence, source_ref)
  values (p_user_id, p_kind, trim(p_content), p_source, coalesce(p_about,'{}'), coalesce(p_tags,'{}'),
          coalesce(p_importance,3), coalesce(p_confidence,0.7), p_source_ref)
  returning id into v_id;
  return v_id;
end $$;

-- recall: the user's private memories plus her shared brain (p_include_shared).
create or replace function brain.recall(
  p_user_id uuid, p_query text, p_limit integer default 12,
  p_kinds text[] default null, p_include_shared boolean default true)
returns table(id uuid, owner text, kind text, content text, about text[], importance smallint,
              confidence real, created_at timestamptz, score real)
language plpgsql set search_path = '' as $$
begin
  return query
  with hits as (
    select m.id, case when m.user_id is null then 'shared' else 'private' end as owner,
           m.kind, m.content, m.about, m.importance, m.confidence, m.created_at,
           (ts_rank(m.fts, websearch_to_tsquery('english', p_query)) * 4
            + greatest(extensions.similarity(m.content, p_query), 0)
            + m.importance * 0.05 + m.confidence * 0.1)::real as score
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
end $$;

create or replace function brain.related(p_id uuid, p_limit integer default 8)
returns table(id uuid, kind text, content text, similarity real)
language sql set search_path = '' as $$
  select m.id, m.kind, m.content, (-(m.embedding operator(extensions.<#>) s.embedding))::real
    from brain.memories m, brain.memories s
   where s.id = p_id and s.embedding is not null and m.embedding is not null
     and m.id <> s.id and m.status = 'active'
     and m.user_id is not distinct from s.user_id
   order by m.embedding operator(extensions.<#>) s.embedding
   limit least(coalesce(p_limit,8), 50);
$$;

create or replace function brain.near_duplicates(p_user_id uuid, p_threshold real default 0.92, p_limit integer default 40)
returns table(a uuid, b uuid, a_content text, b_content text, similarity real)
language sql set search_path = '' as $$
  select x.id, y.id, x.content, y.content, (-(x.embedding operator(extensions.<#>) y.embedding))::real
    from brain.memories x
    join lateral (
      select m.* from brain.memories m
       where m.status = 'active' and m.embedding is not null and m.id > x.id
         and m.user_id is not distinct from x.user_id
       order by m.embedding operator(extensions.<#>) x.embedding limit 3
    ) y on true
   where x.status = 'active' and x.embedding is not null
     and x.user_id is not distinct from p_user_id
     and -(x.embedding operator(extensions.<#>) y.embedding) >= p_threshold
   order by 5 desc
   limit least(coalesce(p_limit,40), 200);
$$;

create or replace function brain.stats(p_user_id uuid default null)
returns jsonb language sql set search_path = '' as $$
  select jsonb_build_object(
    'scope', case when p_user_id is null then 'shared' else 'private' end,
    'memories', (select count(*) from brain.memories where status = 'active' and user_id is not distinct from p_user_id and legacy_owner is null),
    'byKind', (select coalesce(jsonb_object_agg(kind, n), '{}'::jsonb) from (select kind, count(*) n from brain.memories where status='active' and user_id is not distinct from p_user_id and legacy_owner is null group by kind) k),
    'newThisWeek', (select count(*) from brain.memories where status='active' and user_id is not distinct from p_user_id and legacy_owner is null and created_at > now() - interval '7 days'),
    'faded', (select count(*) from brain.memories where status='faded' and user_id is not distinct from p_user_id),
    'unembedded', (select count(*) from brain.memories where embedding is null and status='active' and user_id is not distinct from p_user_id),
    'legacyWaiting', (select count(*) from brain.memories where legacy_owner is not null),
    'skills', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) n from brain.skills group by status) s),
    'lastSleep', (select ran_at from brain.sleep_log order by ran_at desc limit 1)
  );
$$;

-- Attach imported memories to their owner's Tali HQ account once it exists.
create or replace function brain.claim_legacy(p_owner text, p_user_id uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare m int; e int;
begin
  update brain.memories set user_id = p_user_id, legacy_owner = null where legacy_owner = p_owner;
  get diagnostics m = row_count;
  update brain.entities set user_id = p_user_id, legacy_owner = null where legacy_owner = p_owner;
  get diagnostics e = row_count;
  return jsonb_build_object('memories', m, 'entities', e);
end $$;

revoke all on all functions in schema brain from public, anon, authenticated;
grant execute on all functions in schema brain to service_role;
