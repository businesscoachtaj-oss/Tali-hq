-- Tali HQ 006: meaning search, the embed worker's helpers and its every-minute job.
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Embed worker key, generated in the database (never shown).
select vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'tali_brain_key', 'x-tali-key for the tali-brain-embed edge function')
 where not exists (select 1 from vault.secrets where name = 'tali_brain_key');

create or replace function public.brain_check_key(p_key text) returns boolean
language sql security definer set search_path = '' as $$
  select exists(select 1 from vault.decrypted_secrets where name = 'tali_brain_key' and decrypted_secret = p_key);
$$;
create or replace function public.brain_pending(p_limit integer default 5)
returns table(tbl text, id uuid, body text) language sql security definer set search_path = '' as $$
  (select 'queries'::text, q.id, q.text from brain.queries q where q.embedding is null order by q.created_at limit p_limit)
  union all
  (select 'memories'::text, m.id, m.content from brain.memories m where m.embedding is null and m.status = 'active' order by m.created_at limit p_limit);
$$;
create or replace function public.brain_set_embedding(p_tbl text, p_id uuid, p_embedding text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_tbl = 'memories' then
    update brain.memories set embedding = p_embedding::extensions.vector(384) where id = p_id;
  elsif p_tbl = 'queries' then
    update brain.queries set embedding = p_embedding::extensions.vector(384) where id = p_id;
  else
    raise exception 'unknown table %', p_tbl;
  end if;
end $$;
revoke all on function public.brain_check_key(text) from public, anon, authenticated;
revoke all on function public.brain_pending(integer) from public, anon, authenticated;
revoke all on function public.brain_set_embedding(text, uuid, text) from public, anon, authenticated;
grant execute on function public.brain_check_key(text), public.brain_pending(integer), public.brain_set_embedding(text, uuid, text) to service_role;

-- Everything about a person, club or product, in one user's brain (plus shared when p_user_id is null).
create or replace function brain.about(p_user_id uuid, p_name text, p_limit integer default 20)
returns table(id uuid, kind text, content text, importance smallint, created_at timestamptz)
language sql set search_path = '' as $$
  select m.id, m.kind, m.content, m.importance, m.created_at
    from brain.memories m
   where m.status = 'active' and m.user_id is not distinct from p_user_id and m.legacy_owner is null
     and exists (
       select 1 from unnest(m.about) a
        where lower(a) = lower(p_name)
           or lower(a) in (select lower(x) from brain.entities e, unnest(e.aliases) x
                            where lower(e.name) = lower(p_name) and e.user_id is not distinct from p_user_id)
           or lower(p_name) in (select lower(x) from brain.entities e, unnest(e.aliases) x
                            where lower(e.name) = lower(a) and e.user_id is not distinct from p_user_id))
   order by m.importance desc, m.created_at desc
   limit least(coalesce(p_limit,20), 100);
$$;

-- Meaning search: ask() queues the question and pokes the embed worker; answer() reads the result.
create or replace function brain.ask(p_user_id uuid, p_text text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_key text;
begin
  insert into brain.queries(user_id, text) values (p_user_id, p_text) returning id into v_id;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'tali_brain_key';
  perform net.http_post(
    url := 'https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/tali-brain-embed',
    headers := jsonb_build_object('Content-Type','application/json','x-tali-key', v_key),
    body := '{}'::jsonb);
  return v_id;
end $$;

create or replace function brain.answer(p_query_id uuid, p_limit integer default 10, p_kinds text[] default null, p_include_shared boolean default true)
returns table(id uuid, owner text, kind text, content text, about text[], similarity real, ready boolean)
language plpgsql set search_path = '' as $$
declare q extensions.vector(384); u uuid;
begin
  select qq.embedding, qq.user_id into q, u from brain.queries qq where qq.id = p_query_id;
  if q is null then
    return query select null::uuid, null::text, null::text, 'not ready yet, try again in a few seconds'::text, null::text[], null::real, false;
    return;
  end if;
  return query
    with hits as (
      select m.id, case when m.user_id is null then 'shared' else 'private' end as owner, m.kind, m.content, m.about,
             (-(m.embedding operator(extensions.<#>) q))::real as sim
        from brain.memories m
       where m.status = 'active' and m.embedding is not null and m.legacy_owner is null
         and ((u is not null and m.user_id = u) or (m.user_id is null and (p_include_shared or u is null)))
         and (p_kinds is null or m.kind = any(p_kinds))
       order by m.embedding operator(extensions.<#>) q
       limit least(coalesce(p_limit,10), 50)
    ), bump as (
      update brain.memories x set recall_count = x.recall_count + 1, last_recalled_at = now()
        from hits where x.id = hits.id returning x.id
    )
    select h.id, h.owner, h.kind, h.content, h.about, h.sim, true from hits h order by h.sim desc;
end $$;

revoke all on all functions in schema brain from public, anon, authenticated;
grant execute on all functions in schema brain to service_role;

-- Embed worker: every minute, only when something is waiting.
select cron.schedule('tali-brain-embed', '* * * * *', $cron$
  select net.http_post(
    url := 'https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/tali-brain-embed',
    headers := jsonb_build_object('Content-Type','application/json','x-tali-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'tali_brain_key')),
    body := '{}'::jsonb)
  where exists (select 1 from brain.memories where embedding is null and status = 'active')
     or exists (select 1 from brain.queries where embedding is null);
$cron$);
