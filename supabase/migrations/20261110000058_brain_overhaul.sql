-- Brain overhaul (10 Nov 2026, asked for by Taj). Additive only: nothing here drops or rewrites what
-- the live app uses today. The old 384 number search column stays and keeps being filled.
--
--  1. Better search: a second, stronger search column on memories and queries, filled by
--     tali-brain-embed. Chat recall becomes "words and meaning together" (brain.recall_hybrid),
--     and falls back to the old word search whenever the new column or the query vector is missing.
--  2. Real connections: public.my_connections(text) for the app, built from who a memory is about,
--     the names she knows, and meaning.
--  3. Dates: memories can carry a date (due_on, yearly). public.my_upcoming() lists what is coming.
--  4. Correct a memory: public.my_memory_update(id, text).
--  5. The tidy: a careful weekly merge of repeats for customers (the founder's own nightly Sleep job
--     is untouched).
--
-- Order: deploy tali-brain-embed and tali-chat first or second, either works. Each side checks for
-- the other and carries on the old way if it is not there yet.
-- Roll back: see docs/BRAIN_OVERHAUL.md.

-- ============================================================================================
-- 0. Columns, index, and a one row switchboard
-- ============================================================================================
alter table brain.memories add column if not exists embedding_v2 extensions.vector(1024);
alter table brain.queries  add column if not exists embedding_v2 extensions.vector(1024);
alter table brain.memories add column if not exists due_on date;
alter table brain.memories add column if not exists yearly boolean not null default false;
alter table brain.memories add column if not exists corrected_at timestamptz;

create index if not exists memories_embedding_v2_idx on brain.memories using hnsw (embedding_v2 extensions.vector_cosine_ops);
create index if not exists memories_due_idx on brain.memories (user_id, due_on) where due_on is not null and status = 'active';

-- One row. v2_on is switched off by the embed function when the key is missing or the calls keep
-- failing, so cron stops knocking, and back on the next time it works. The two floors are how alike
-- two memories must be before "meaning" alone counts as a connection, and recall_margin is how far
-- behind the best match a memory can be and still be recalled by meaning (tune here, no deploy needed).
create table if not exists brain.embed_state (
  id boolean primary key default true check (id),
  v2_on boolean not null default true,
  v2_model text,
  v2_last_ok timestamptz,
  v2_last_error text,
  conn_floor_v2 real not null default 0.62,
  conn_floor_v1 real not null default 0.86,
  recall_margin real not null default 0.2,
  updated_at timestamptz not null default now()
);
insert into brain.embed_state (id) values (true) on conflict (id) do nothing;
alter table brain.embed_state enable row level security;

-- ============================================================================================
-- 1. Better search
-- ============================================================================================
-- What still needs the new search numbers. Memories oldest first, so the backfill works through
-- the brain in order. Questions only while they are fresh.
create or replace function public.brain_pending_v2(p_limit integer default 48)
returns table(tbl text, id uuid, body text)
language sql security definer set search_path = '' as $$
  (select 'queries'::text, q.id, q.text from brain.queries q
    where q.embedding_v2 is null and q.created_at > now() - interval '1 hour'
    order by q.created_at limit least(coalesce(p_limit, 48), 8))
  union all
  (select 'memories'::text, m.id, m.content from brain.memories m
    where m.embedding_v2 is null and m.status = 'active'
    order by m.created_at limit least(coalesce(p_limit, 48), 128));
$$;

-- Saves a batch: [{ "tbl": "memories" | "queries", "id": "...", "embedding": "[0.1,0.2,...]" }]
create or replace function public.brain_set_embeddings_v2(p_rows jsonb, p_model text default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare r jsonb; n integer := 0;
begin
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    if r->>'tbl' = 'memories' then
      update brain.memories set embedding_v2 = (r->>'embedding')::extensions.vector(1024) where id = (r->>'id')::uuid;
    elsif r->>'tbl' = 'queries' then
      update brain.queries set embedding_v2 = (r->>'embedding')::extensions.vector(1024) where id = (r->>'id')::uuid;
    else
      raise exception 'unknown table %', r->>'tbl';
    end if;
    if found then n := n + 1; end if;
  end loop;
  update brain.embed_state set v2_on = true, v2_model = coalesce(p_model, v2_model), v2_last_ok = now(), v2_last_error = null, updated_at = now() where id;
  return n;
end $$;

-- The embed function tells us how it went, so cron only calls it for the backfill while it can work.
create or replace function public.brain_embed_v2_note(p_on boolean, p_error text default null)
returns void
language sql security definer set search_path = '' as $$
  update brain.embed_state
     set v2_on = coalesce(p_on, v2_on), v2_last_error = left(p_error, 300),
         v2_last_ok = case when p_on and p_error is null then now() else v2_last_ok end, updated_at = now()
   where id;
$$;

-- How the backfill is going, for the founder and for docs/BRAIN_OVERHAUL.md.
create or replace function public.brain_embed_v2_progress()
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'on', (select v2_on from brain.embed_state),
    'model', (select v2_model from brain.embed_state),
    'last_ok', (select v2_last_ok from brain.embed_state),
    'last_error', (select v2_last_error from brain.embed_state),
    'done', (select count(*) from brain.memories where status = 'active' and embedding_v2 is not null),
    'to_go', (select count(*) from brain.memories where status = 'active' and embedding_v2 is null));
$$;

revoke all on function public.brain_pending_v2(integer), public.brain_set_embeddings_v2(jsonb, text),
  public.brain_embed_v2_note(boolean, text), public.brain_embed_v2_progress() from public, anon, authenticated;
grant execute on function public.brain_pending_v2(integer), public.brain_set_embeddings_v2(jsonb, text),
  public.brain_embed_v2_note(boolean, text), public.brain_embed_v2_progress() to service_role;

-- Words and meaning together. Same columns as brain.recall. The word half is brain.recall's own
-- scoring; the meaning half is the nearest memories by the new search numbers; the two lists are
-- blended by rank (reciprocal rank fusion), so neither scale has to match the other. A memory with
-- no new numbers yet can still be found by its words, which is the fallback during the backfill.
create or replace function brain.recall_hybrid(
  p_user_id uuid, p_query text, p_qvec extensions.vector(1024), p_limit integer default 12,
  p_kinds text[] default null, p_include_shared boolean default true)
returns table(id uuid, owner text, kind text, content text, about text[], importance smallint,
              confidence real, created_at timestamptz, score real)
language plpgsql set search_path = '' as $$
declare n integer := least(coalesce(p_limit, 12), 50); margin real := coalesce((select e.recall_margin from brain.embed_state e), 0.2);
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
            + m.importance * 0.05 + m.confidence * 0.1) as s
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
           (f.rrf * 30 + m.importance * 0.005 + m.confidence * 0.01)::real as score
      from fused f join brain.memories m on m.id = f.mid
     order by 9 desc
     limit n
  ), bump as (
    update brain.memories u set recall_count = u.recall_count + 1, last_recalled_at = now()
      from hits where u.id = hits.id returning u.id
  )
  select h.* from hits h order by h.score desc;
end $$;
revoke all on function brain.recall_hybrid(uuid, text, extensions.vector, integer, text[], boolean) from public, anon, authenticated;
grant execute on function brain.recall_hybrid(uuid, text, extensions.vector, integer, text[], boolean) to service_role;

-- What tali-chat is given before it answers. A fourth argument carries the question as search
-- numbers ("[0.1,0.2,...]"). The two and three argument versions the live app calls are untouched.
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
      'memories', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'content', r.content, 'about', r.about))
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

-- brain.answer (the ask then answer path the scheduled jobs use): same signature, now prefers the
-- new numbers when the question and the memory both have them. Memories still waiting on the
-- backfill are found the old way and slotted in by rank.
create or replace function brain.answer(p_query_id uuid, p_limit integer default 10, p_kinds text[] default null, p_include_shared boolean default true)
returns table(id uuid, owner text, kind text, content text, about text[], similarity real, ready boolean)
language plpgsql set search_path = '' as $$
declare q extensions.vector(384); q2 extensions.vector(1024); u uuid; n integer := least(coalesce(p_limit, 10), 50);
begin
  select qq.embedding, qq.embedding_v2, qq.user_id into q, q2, u from brain.queries qq where qq.id = p_query_id;
  if q is null and q2 is null then
    return query select null::uuid, null::text, null::text, 'not ready yet, try again in a few seconds'::text, null::text[], null::real, false;
    return;
  end if;
  return query
    with new_hits as (
      select m.id as mid, (1 - (m.embedding_v2 operator(extensions.<=>) q2))::real as sim,
             row_number() over (order by m.embedding_v2 operator(extensions.<=>) q2) as rn, 0 as src
        from brain.memories m
       where q2 is not null and m.status = 'active' and m.embedding_v2 is not null and m.legacy_owner is null
         and ((u is not null and m.user_id = u) or (m.user_id is null and (p_include_shared or u is null)))
         and (p_kinds is null or m.kind = any(p_kinds))
       order by m.embedding_v2 operator(extensions.<=>) q2
       limit n
    ), old_hits as (
      select m.id as mid, (-(m.embedding operator(extensions.<#>) q))::real as sim,
             row_number() over (order by m.embedding operator(extensions.<#>) q) as rn, 1 as src
        from brain.memories m
       where q is not null and m.status = 'active' and m.embedding is not null and m.legacy_owner is null
         and (q2 is null or m.embedding_v2 is null)
         and ((u is not null and m.user_id = u) or (m.user_id is null and (p_include_shared or u is null)))
         and (p_kinds is null or m.kind = any(p_kinds))
       order by m.embedding operator(extensions.<#>) q
       limit n
    ), picked as (
      select z.mid, z.sim, z.rn, z.src from (select * from new_hits union all select * from old_hits) z
       order by z.rn, z.src limit n
    ), bump as (
      update brain.memories x set recall_count = x.recall_count + 1, last_recalled_at = now()
        from picked where x.id = picked.mid returning x.id
    )
    select m.id, case when m.user_id is null then 'shared' else 'private' end, m.kind, m.content, m.about, p.sim, true
      from picked p join brain.memories m on m.id = p.mid
     order by p.rn, p.src;
end $$;

-- brain.related: same signature, uses the new numbers when the memory has them.
create or replace function brain.related(p_id uuid, p_limit integer default 8)
returns table(id uuid, kind text, content text, similarity real)
language plpgsql set search_path = '' as $$
declare s brain.memories%rowtype;
begin
  select * into s from brain.memories x where x.id = p_id;
  if s.embedding_v2 is not null then
    return query
      select m.id, m.kind, m.content, (1 - (m.embedding_v2 operator(extensions.<=>) s.embedding_v2))::real
        from brain.memories m
       where m.embedding_v2 is not null and m.id <> s.id and m.status = 'active'
         and m.user_id is not distinct from s.user_id
       order by m.embedding_v2 operator(extensions.<=>) s.embedding_v2
       limit least(coalesce(p_limit, 8), 50);
  elsif s.embedding is not null then
    return query
      select m.id, m.kind, m.content, (-(m.embedding operator(extensions.<#>) s.embedding))::real
        from brain.memories m
       where m.embedding is not null and m.id <> s.id and m.status = 'active'
         and m.user_id is not distinct from s.user_id
       order by m.embedding operator(extensions.<#>) s.embedding
       limit least(coalesce(p_limit, 8), 50);
  end if;
end $$;

-- The every minute job now also wakes for the backfill, but only while the new search is working.
select cron.unschedule('tali-brain-embed') where exists (select 1 from cron.job where jobname = 'tali-brain-embed');
select cron.schedule('tali-brain-embed', '* * * * *', $cron$
  select net.http_post(
    url := 'https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/tali-brain-embed',
    headers := jsonb_build_object('Content-Type','application/json','x-tali-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'tali_brain_key')),
    body := '{}'::jsonb)
  where exists (select 1 from brain.memories where embedding is null and status = 'active')
     or exists (select 1 from brain.queries where embedding is null)
     or ((select v2_on from brain.embed_state)
         and exists (select 1 from brain.memories where embedding_v2 is null and status = 'active'));
$cron$);

-- ============================================================================================
-- 3. Dates (before connections and saving, which use these helpers)
-- ============================================================================================
create or replace function brain.safe_date(p_year integer, p_month integer, p_day integer)
returns date language sql immutable set search_path = '' as $$
  select case when p_month between 1 and 12 and p_day between 1 and 31 and p_year between 1900 and 2200
    then make_date(p_year, p_month, least(p_day, extract(day from (make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day'))::integer))
    end;
$$;

-- The next time a date comes round, on or after p_today.
create or replace function brain.next_occurrence(p_date date, p_today date)
returns date language sql immutable set search_path = '' as $$
  select case
    when p_date is null or p_today is null then null
    when brain.safe_date(extract(year from p_today)::integer, extract(month from p_date)::integer, extract(day from p_date)::integer) >= p_today
      then brain.safe_date(extract(year from p_today)::integer, extract(month from p_date)::integer, extract(day from p_date)::integer)
    else brain.safe_date(extract(year from p_today)::integer + 1, extract(month from p_date)::integer, extract(day from p_date)::integer)
  end;
$$;

-- Reads one clear date out of a sentence, or nothing. Careful on purpose:
--   * exactly one date in the sentence ("14 December", "14th of Dec 2026", "December 14")
--   * not a range ("3 to 5 March"), not the word "may" in lower case ("3 may be enough")
--   * it must be a birthday or anniversary (yearly), or read as something still to come. A note
--     about a day that has been ("On 4 Nov 2026 the health check found...") is not a date to keep
create or replace function brain.date_in_text(p_text text, p_ref date default current_date)
returns table(due_on date, yearly boolean)
language plpgsql immutable set search_path = '' as $$
declare
  mon constant text := '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  re_dm constant text := '\m(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?' || mon || '\M(?:,?\s+((?:19|20)\d{2})\M)?';
  re_md constant text := '\m' || mon || '\s+(\d{1,2})(?:st|nd|rd|th)?\M(?:,?\s+((?:19|20)\d{2})\M)?';
  r text[]; n integer := 0;
  v_day integer; v_mon_txt text; v_year integer; v_mon integer; v_date date; v_yearly boolean;
begin
  if p_text is null or length(p_text) < 5 then return; end if;
  -- a range is not one date
  if p_text ~* ('\d(?:st|nd|rd|th)?\s*(?:to|and|or|until|through|-)\s*\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?' || mon || '\M') then return; end if;
  for r in select regexp_matches(p_text, re_dm, 'gi') loop
    if r[2] = 'may' then continue; end if;
    n := n + 1; v_day := r[1]::integer; v_mon_txt := r[2]; v_year := nullif(r[3], '')::integer;
  end loop;
  for r in select regexp_matches(p_text, re_md, 'gi') loop
    if r[1] = 'may' then continue; end if;
    n := n + 1; v_mon_txt := r[1]; v_day := r[2]::integer; v_year := nullif(r[3], '')::integer;
  end loop;
  if n <> 1 then return; end if;
  v_mon := 1 + (strpos('janfebmaraprmayjunjulaugsepoctnovdec', lower(left(v_mon_txt, 3))) - 1) / 3;
  if v_day < 1 or v_day > 31 or v_mon < 1 or v_mon > 12 then return; end if;
  -- a real day of that month (no 31 June)
  if v_day > extract(day from (make_date(2028, v_mon, 1) + interval '1 month' - interval '1 day'))::integer then return; end if;
  v_yearly := p_text ~* '\m(birthday|birthdays|anniversary|every year|each year|yearly|annual|annually)\M';
  if v_yearly then
    -- a birthday or anniversary: the year in the sentence, if any, is when it first happened
    v_date := brain.next_occurrence(brain.safe_date(2028, v_mon, v_day), p_ref);
  elsif p_text ~* '\m(due|by|on|until|deadline|starts?|starting|ends?|ending|booked|booking|appointment|meeting|trip|flight|flying|launch|launches|launching|renews?|renewal|expires?|will|going|plans?|planning|next|opens?|closes?|moving|wedding|party|holiday)\M'
        and p_text !~* '\m(was|were|did|had|launched|started|ended|since|ago|last|sent|paid|joined|signed|happened|went|moved|opened|closed|found|showed|came|ran|added|chose|approved|created)\M' then
    -- something still to come: reads as the future, and is not a note about a day that has been
    if v_year is not null then
      v_date := brain.safe_date(v_year, v_mon, v_day);
      if v_date < p_ref then return; end if;
    else
      v_date := brain.next_occurrence(brain.safe_date(2028, v_mon, v_day), p_ref);
    end if;
  else
    return;
  end if;
  if v_date is null then return; end if;
  due_on := v_date; yearly := v_yearly;
  return next;
end $$;

-- What is coming up, from her memories. For the signed in user only.
-- [{ "id": uuid, "text": string, "kind": string, "date": "YYYY-MM-DD", "days_away": int, "yearly": bool }]
create or replace function public.my_upcoming(p_days integer default 45)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); v_today date; v_days integer := least(greatest(coalesce(p_days, 45), 1), 366); v jsonb;
begin
  if uid is null then return '[]'::jsonb; end if;
  select (now() at time zone coalesce(p.timezone, 'Australia/Sydney'))::date into v_today from public.profiles p where p.id = uid;
  v_today := coalesce(v_today, (now() at time zone 'Australia/Sydney')::date);
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'text', x.content, 'kind', x.kind, 'date', x.nxt,
                                               'days_away', x.nxt - v_today, 'yearly', x.yearly) order by x.nxt, x.importance desc), '[]'::jsonb)
    into v
    from (
      select y.id, y.content, y.kind, y.yearly, y.importance, y.nxt
        from (
          select m.id, m.content, m.kind, m.yearly, m.importance,
                 case when m.yearly then brain.next_occurrence(m.due_on, v_today) else m.due_on end as nxt
            from brain.memories m
           where m.user_id = uid and m.status = 'active' and m.legacy_owner is null and m.due_on is not null
        ) y
       where y.nxt between v_today and v_today + v_days
       order by y.nxt, y.importance desc
       limit 10
    ) x;
  return v;
end $$;
revoke all on function public.my_upcoming(integer) from public, anon;
grant execute on function public.my_upcoming(integer) to authenticated;

-- Best effort backfill: only what she kept from people's chats (facts, people, events, plans and
-- ideas), only where the sentence holds one clear date still to come or a birthday, read against
-- the day the memory was saved. Anything unclear is left.
update brain.memories m
   set due_on = x.due_on, yearly = x.yearly
  from (select mm.id, d.due_on, d.yearly
          from brain.memories mm
          cross join lateral brain.date_in_text(mm.content, mm.created_at::date) d
         where mm.user_id is not null and mm.legacy_owner is null and mm.status = 'active' and mm.due_on is null
           and mm.kind in ('fact', 'person', 'event', 'plan', 'idea')
           -- only what she kept from chats. The scheduled jobs' own notes start with the day they ran.
           and mm.source = 'tali hq chat') x
 where x.id = m.id;

-- ============================================================================================
-- 2. Real connections
-- ============================================================================================
create or replace function brain.re_escape(p text)
returns text language sql immutable set search_path = '' as $$
  select regexp_replace(coalesce(p, ''), '([\\.^$|()\[\]{}*+?-])', '\\\1', 'g');
$$;

-- Saving, version 2 (service role only). Does what brain_remember_for does, then:
--   * if she left "about" short, adds the names she already knows that the sentence mentions
--     (people and things in her brain, and their clients and leads)
--   * keeps a card for each person a "person" memory is about, so names link up later
--   * keeps the date the memory carries (given by her, or one clear date read from the sentence)
create or replace function public.brain_remember_v2(
  p_user_id uuid, p_kind text, p_content text, p_about text[] default '{}'::text[],
  p_source_ref text default null, p_urgent boolean default false,
  p_due_on date default null, p_yearly boolean default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_about text[] := coalesce(p_about, '{}'); v_today date; v_d date; v_y boolean; a text;
begin
  if p_user_id is null then raise exception 'user id required'; end if;
  if cardinality(v_about) < 5 then
    select array(
      select z.n from (
        select u.n, 0 as ord from unnest(v_about) u(n)
        union all
        select e.name, 1 from brain.entities e
         where e.user_id = p_user_id and length(e.name) >= 3
           and (p_content ~* ('\m' || brain.re_escape(e.name) || '\M')
                or exists (select 1 from unnest(e.aliases) al where length(al) >= 3 and p_content ~* ('\m' || brain.re_escape(al) || '\M')))
        union all
        select c.name, 2 from public.clients c
         where c.user_id = p_user_id and length(c.name) >= 3 and p_content ~* ('\m' || brain.re_escape(c.name) || '\M')
      ) z
      group by lower(z.n), z.n
      order by min(z.ord), z.n
      limit 6) into v_about;
    -- the same name in two spellings of capitals only needs to be there once
    select array(select distinct on (lower(n)) n from unnest(v_about) n order by lower(n)) into v_about;
  end if;

  v_id := public.brain_remember_for(p_user_id, p_kind, p_content, v_about, p_source_ref, p_urgent);
  if v_id is null then return null; end if;

  select (now() at time zone coalesce(p.timezone, 'Australia/Sydney'))::date into v_today from public.profiles p where p.id = p_user_id;
  v_today := coalesce(v_today, (now() at time zone 'Australia/Sydney')::date);
  if p_due_on is not null and p_due_on between v_today - 366 and v_today + 3660 then
    v_d := p_due_on;
    v_y := coalesce(p_yearly, p_content ~* '\m(birthday|birthdays|anniversary)\M');
  elsif p_kind in ('fact', 'person', 'event', 'plan', 'idea') then
    select d.due_on, d.yearly into v_d, v_y from brain.date_in_text(p_content, v_today) d;
  end if;
  if v_d is not null then
    update brain.memories set due_on = v_d, yearly = coalesce(v_y, false) where id = v_id and user_id = p_user_id;
  end if;

  -- A card only for the names she gave for a person, never for a client name that was added above.
  if p_kind = 'person' then
    foreach a in array coalesce(p_about, '{}') loop
      if length(trim(a)) between 2 and 80
         and not exists (select 1 from public.clients c where c.user_id = p_user_id and lower(c.name) = lower(trim(a))) then
        insert into brain.entities (user_id, name, type) values (p_user_id, trim(a), 'person') on conflict do nothing;
      end if;
    end loop;
  end if;
  return v_id;
end $$;
revoke all on function public.brain_remember_v2(uuid, text, text, text[], text, boolean, date, boolean) from public, anon, authenticated;
grant execute on function public.brain_remember_v2(uuid, text, text, text[], text, boolean, date, boolean) to service_role;

-- What she knows that genuinely connects to a piece of text, for the signed in user only.
-- p_text can be a name ("Bayside Physio"), a sender, or the words of one of their own memories
-- (the app may pass it cut short with "…" on the end). Never another person's rows, never the
-- shared brain.  [{ "id": uuid, "text": string, "kind": string, "region": string }]
-- Three kinds of evidence, strongest first:
--   3  it is about the same name (or a name she knows goes by that name)
--   2  its words mention the name
--   1+ it means nearly the same thing as the memory you tapped (only above the floor in embed_state)
create or replace function public.my_connections(p_text text, p_limit integer default 3)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  t text := trim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g'));
  n integer := least(greatest(coalesce(p_limit, 3), 1), 10);
  cut boolean := false;
  s brain.memories%rowtype;
  names text[] := '{}';
  f2 real; f1 real; v jsonb;
begin
  if uid is null then return '[]'::jsonb; end if;
  if right(t, 1) = '…' or right(t, 3) = '...' then
    cut := true; t := trim(regexp_replace(t, '(…|\.\.\.)$', ''));
  end if;
  if length(t) < 2 then return '[]'::jsonb; end if;
  select coalesce(conn_floor_v2, 0.62), coalesce(conn_floor_v1, 0.86) into f2, f1 from brain.embed_state;
  f2 := coalesce(f2, 0.62); f1 := coalesce(f1, 0.86);

  -- Is this one of their own memories? Then start from it.
  select m.* into s from brain.memories m
   where m.user_id = uid and m.status = 'active' and m.legacy_owner is null
     and (lower(trim(m.content)) = lower(t)
          or (cut and length(t) >= 12 and left(lower(m.content), length(t)) = lower(t)))
   order by m.created_at desc limit 1;

  if s.id is not null then
    names := coalesce(s.about, '{}') || array(
      select e.name from brain.entities e
       where e.user_id = uid and length(e.name) >= 3 and s.content ~* ('\m' || brain.re_escape(e.name) || '\M'))
      || array(
      select c.name from public.clients c
       where c.user_id = uid and length(c.name) >= 3 and s.content ~* ('\m' || brain.re_escape(c.name) || '\M'));
  else
    names := array(
      select e.name from brain.entities e
       where e.user_id = uid and length(e.name) >= 3
         and (t ~* ('\m' || brain.re_escape(e.name) || '\M')
              or exists (select 1 from unnest(e.aliases) al where length(al) >= 3 and t ~* ('\m' || brain.re_escape(al) || '\M'))))
      || array(
      select c.name from public.clients c
       where c.user_id = uid and length(c.name) >= 3 and t ~* ('\m' || brain.re_escape(c.name) || '\M'));
    -- a short piece of text is treated as a name in its own right
    if length(t) <= 60 then names := names || t; end if;
  end if;
  -- other names the same person or thing goes by
  names := names || array(
    select al from brain.entities e, unnest(e.aliases) al
     where e.user_id = uid and lower(e.name) in (select lower(x) from unnest(names) x))
    || array(
    select e.name from brain.entities e
     where e.user_id = uid and exists (select 1 from unnest(e.aliases) al where lower(al) in (select lower(x) from unnest(names) x)));
  names := array(select distinct on (lower(x)) x from unnest(names) x where length(trim(x)) >= 2 order by lower(x));

  with mine as (
    select m.id, m.content, m.kind, m.region, m.about, m.importance, m.created_at, m.embedding, m.embedding_v2, m.fts
      from brain.memories m
     where m.user_id = uid and m.status = 'active' and m.legacy_owner is null
       and (s.id is null or m.id <> s.id)
  ), by_about as (
    select m.id, 3.0::real as w from mine m
     where exists (select 1 from unnest(m.about) a where lower(a) in (select lower(x) from unnest(names) x))
  ), by_words as (
    select m.id, 2.0::real as w from mine m
     where exists (select 1 from unnest(names) x where length(x) >= 3 and m.content ~* ('\m' || brain.re_escape(x) || '\M'))
  ), by_meaning as (
    select q.id, (1.0 + q.sim)::real as w from (
      select m.id, (1 - (m.embedding_v2 operator(extensions.<=>) s.embedding_v2))::real as sim
        from mine m
       where s.id is not null and s.embedding_v2 is not null and m.embedding_v2 is not null
       order by m.embedding_v2 operator(extensions.<=>) s.embedding_v2 limit 6) q
     where q.sim >= f2
    union all
    select q.id, (1.0 + q.sim)::real from (
      select m.id, (-(m.embedding operator(extensions.<#>) s.embedding))::real as sim
        from mine m
       where s.id is not null and s.embedding_v2 is null and s.embedding is not null and m.embedding is not null
       order by m.embedding operator(extensions.<#>) s.embedding limit 6) q
     where q.sim >= f1
  ), by_search as (
    -- a longer piece of text that is not one of their memories and names nobody she knows
    select m.id, least(ts_rank(m.fts, websearch_to_tsquery('english', t)) * 4, 1.5)::real as w
      from mine m
     where s.id is null and length(t) > 60
       and m.fts @@ websearch_to_tsquery('english', t)
  ), scored as (
    select z.id, sum(z.w) as w from (
      select * from by_about union all select * from by_words union all select * from by_meaning union all select * from by_search) z
     group by z.id
  ), top as (
    select m.id, m.content, m.kind, m.region, sc.w, m.importance, m.created_at
      from scored sc join mine m on m.id = sc.id
     order by sc.w desc, m.importance desc, m.created_at desc
     limit n
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', tp.id, 'text', tp.content, 'kind', tp.kind, 'region', tp.region)
                            order by tp.w desc, tp.importance desc, tp.created_at desc), '[]'::jsonb)
    into v from top tp;
  return v;
end $$;
revoke all on function public.my_connections(text, integer) from public, anon;
grant execute on function public.my_connections(text, integer) to authenticated;

-- ============================================================================================
-- 4. Correct a memory
-- ============================================================================================
-- The signed in user fixes the words of one of their own memories. It is searched afresh (both sets
-- of search numbers are cleared so the every minute job redoes them), its date is read again when
-- the new words hold one clear date, and it is marked as corrected by them. Returns false when the
-- memory is not theirs, not active, or the words are too short or too long (3 to 600 characters).
create or replace function public.my_memory_update(p_id uuid, p_content text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); t text := trim(regexp_replace(coalesce(p_content, ''), '\s+', ' ', 'g'));
        v_today date; v_d date; v_y boolean; v_kind text;
begin
  if uid is null or p_id is null then return false; end if;
  if length(t) < 3 or length(t) > 600 then return false; end if;
  select m.kind into v_kind from brain.memories m
   where m.id = p_id and m.user_id = uid and m.status = 'active' and m.legacy_owner is null;
  if not found then return false; end if;

  select (now() at time zone coalesce(p.timezone, 'Australia/Sydney'))::date into v_today from public.profiles p where p.id = uid;
  v_today := coalesce(v_today, (now() at time zone 'Australia/Sydney')::date);
  if v_kind in ('fact', 'person', 'event', 'plan', 'idea') then
    select d.due_on, d.yearly into v_d, v_y from brain.date_in_text(t, v_today) d;
  end if;

  update brain.memories m
     set content = t,
         embedding = null,
         embedding_v2 = null,
         corrected_at = now(),
         confidence = greatest(m.confidence, 0.95),
         due_on = coalesce(v_d, m.due_on),
         yearly = case when v_d is not null then coalesce(v_y, false) else m.yearly end
   where m.id = p_id and m.user_id = uid and m.status = 'active' and m.legacy_owner is null;
  return found;
end $$;
revoke all on function public.my_memory_update(uuid, text) from public, anon;
grant execute on function public.my_memory_update(uuid, text) to authenticated;

-- ============================================================================================
-- 5. The tidy, for customers
-- ============================================================================================
-- Today the only tidy is the founder's nightly Sleep job, which runs outside the database on his
-- brain alone. Customers had nothing. This is the careful version for them: once a week, merge
-- memories that are repeats of each other. A pair is only merged when ALL of these hold:
--   same person, same kind, both active, neither is urgent, neither is in an unsettled conflict,
--   the old search numbers say they are nearly identical (0.95 or more), and the words themselves
--   are mostly the same (0.55 or more).
-- The stronger one is kept (more confirmations, then more important, then older) and takes on the
-- other's "about", tags and confirmations. The other is marked merged and points at the keeper, so
-- it can be put back: update brain.memories set status = 'active', merged_into = null where id = ...
-- Nothing is ever deleted and nothing is "retired" here: that needs judgement.
create or replace function public.brain_tidy_customers(p_max_per_user integer default 20)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u record; p record; keep uuid; gone uuid; per_user integer; total integer := 0; users integer := 0;
        founder constant uuid := 'e89ca9de-a86e-4dd6-8094-bc518566352e';
begin
  for u in select distinct m.user_id from brain.memories m
            where m.user_id is not null and m.user_id <> founder and m.status = 'active' loop
    per_user := 0;
    for p in
      select x.id as a, y.id as b,
             (x.confirmed_count > y.confirmed_count
              or (x.confirmed_count = y.confirmed_count and x.importance > y.importance)
              or (x.confirmed_count = y.confirmed_count and x.importance = y.importance and x.created_at <= y.created_at)) as keep_a
        from brain.memories x
        join brain.memories y
          on y.user_id = x.user_id and y.id > x.id and y.kind = x.kind and y.status = 'active'
       where x.user_id = u.user_id and x.status = 'active'
         and x.embedding is not null and y.embedding is not null
         and not coalesce(x.urgent, false) and not coalesce(y.urgent, false)
         and -(x.embedding operator(extensions.<#>) y.embedding) >= 0.95
         and extensions.similarity(x.content, y.content) >= 0.55
         and not exists (select 1 from brain.conflicts c where c.status = 'open' and (c.new_id in (x.id, y.id) or c.old_id in (x.id, y.id)))
       order by -(x.embedding operator(extensions.<#>) y.embedding) desc
       limit least(coalesce(p_max_per_user, 20), 50)
    loop
      keep := case when p.keep_a then p.a else p.b end;
      gone := case when p.keep_a then p.b else p.a end;
      -- either may already have been merged earlier in this run
      if exists (select 1 from brain.memories z where z.id in (keep, gone) and z.status <> 'active') then continue; end if;
      update brain.memories k
         set about = (select array(select distinct v from unnest(k.about || g.about) v)),
             tags = (select array(select distinct v from unnest(k.tags || g.tags) v)),
             confirmed_count = k.confirmed_count + g.confirmed_count + 1,
             private = k.private or g.private,
             due_on = coalesce(k.due_on, g.due_on),
             yearly = k.yearly or g.yearly
        from brain.memories g
       where k.id = keep and g.id = gone;
      update brain.memories set status = 'merged', merged_into = keep where id = gone;
      per_user := per_user + 1;
    end loop;
    if per_user > 0 then users := users + 1; total := total + per_user; end if;
  end loop;
  if total > 0 then
    insert into brain.sleep_log (merged, faded, promoted, conflicts, notes)
    values (total, 0, 0, 0, 'Weekly tidy for customers: merged ' || total || ' repeat' || case when total = 1 then '' else 's' end || ' across ' || users || ' brain' || case when users = 1 then '' else 's' end || '. Nothing deleted.');
  end if;
  return jsonb_build_object('merged', total, 'brains', users);
end $$;
revoke all on function public.brain_tidy_customers(integer) from public, anon, authenticated;
grant execute on function public.brain_tidy_customers(integer) to service_role;

-- Sunday 3:17am Sydney summer time (Saturday 16:17 UTC). To switch it off: select cron.unschedule('tali-brain-tidy');
select cron.unschedule('tali-brain-tidy') where exists (select 1 from cron.job where jobname = 'tali-brain-tidy');
select cron.schedule('tali-brain-tidy', '17 16 * * 6', $cron$ select public.brain_tidy_customers(); $cron$);
