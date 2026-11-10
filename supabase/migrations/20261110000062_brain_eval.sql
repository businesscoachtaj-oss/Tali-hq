-- Brain recall test (10 Nov 2026, asked for by Taj: "overhaul the brain itself").
--
-- Until now nothing measured whether Tali pulls the right memory. This adds a test set of real
-- questions with the memory that should come back, and a score that can be rerun after any change.
--
--   brain.eval_cases   one row per question: who is asking, the question, the memories that count
--                      as a right answer, and the question's search numbers.
--   brain.eval_runs    one row per test run: the score for words only and for words and meaning.
--   brain.eval_prepare()        gets search numbers for new questions (through brain.queries and
--                               the every minute embed job). Returns how many are still waiting.
--   brain.eval_run(label)       runs every ready question both ways and saves the score.
--
-- What is measured: the database step of recall (brain.recall and brain.recall_hybrid). The
-- reranker that tali-chat runs on top is not part of this score.
-- A test run leaves the brain as it found it: recall counts and "last recalled" are put back.
-- Server only, like the rest of schema brain. Additive: nothing the live app calls is changed.

create table if not exists brain.eval_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  question text not null,
  expect uuid[] not null,
  qvec extensions.vector(1024),
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, question)
);
alter table brain.eval_cases enable row level security;

create table if not exists brain.eval_runs (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  label text,
  settings jsonb not null default '{}'::jsonb,
  cases integer not null default 0,
  words_top1 real, words_top5 real, words_mrr real,
  both_top1 real, both_top5 real, both_mrr real,
  detail jsonb not null default '[]'::jsonb
);
alter table brain.eval_runs enable row level security;

-- Copies finished search numbers onto the questions, then queues the ones still missing.
create or replace function brain.eval_prepare()
returns integer
language plpgsql security definer set search_path = '' as $$
declare waiting integer;
begin
  update brain.eval_cases c set qvec = q.embedding_v2
    from brain.queries q
   where c.qvec is null and q.embedding_v2 is not null and q.text = c.question and q.user_id is not distinct from c.user_id;
  -- the queue rows have done their job
  delete from brain.queries q using brain.eval_cases c
   where q.text = c.question and q.user_id is not distinct from c.user_id and c.qvec is not null;
  insert into brain.queries (user_id, text)
  select c.user_id, c.question from brain.eval_cases c
   where c.qvec is null and c.active
     and not exists (select 1 from brain.queries q where q.text = c.question and q.user_id is not distinct from c.user_id
                       and q.created_at > now() - interval '50 minutes');
  select count(*) into waiting from brain.eval_cases where qvec is null and active;
  return waiting;
end $$;

create or replace function brain.eval_run(p_label text default null, p_limit integer default 10)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c record; snap jsonb; want uuid[]; rw integer; rb integer; n integer := 0;
        w1 real := 0; w5 real := 0; wm real := 0; b1 real := 0; b5 real := 0; bm real := 0;
        detail jsonb := '[]'::jsonb; lim integer := least(greatest(coalesce(p_limit, 10), 1), 50); out jsonb;
begin
  perform brain.eval_prepare();
  -- recall bumps "times recalled"; a test must not, so remember the counts and put them back
  select jsonb_agg(jsonb_build_object('id', m.id, 'c', m.recall_count, 't', m.last_recalled_at)) into snap from brain.memories m;

  for c in select * from brain.eval_cases where active and qvec is not null order by created_at, id loop
    -- a memory merged since the case was written still counts through the one it was merged into
    select array_agg(distinct coalesce(case when m.status = 'merged' then m.merged_into end, m.id)) into want
      from brain.memories m where m.id = any(c.expect);
    if want is null then continue; end if;
    select min(r.rn) into rw from (
      select x.id, row_number() over (order by x.score desc) as rn
        from brain.recall(c.user_id, c.question, lim, null, true) x) r where r.id = any(want);
    select min(r.rn) into rb from (
      select x.id, row_number() over (order by x.score desc) as rn
        from brain.recall_hybrid(c.user_id, c.question, c.qvec, lim, null, true) x) r where r.id = any(want);
    n := n + 1;
    if rw = 1 then w1 := w1 + 1; end if;
    if rw <= 5 then w5 := w5 + 1; end if;
    if rw is not null then wm := wm + 1.0 / rw; end if;
    if rb = 1 then b1 := b1 + 1; end if;
    if rb <= 5 then b5 := b5 + 1; end if;
    if rb is not null then bm := bm + 1.0 / rb; end if;
    detail := detail || jsonb_build_object('q', c.question, 'words', rw, 'both', rb);
  end loop;

  update brain.memories m set recall_count = (s->>'c')::integer, last_recalled_at = (s->>'t')::timestamptz
    from jsonb_array_elements(coalesce(snap, '[]'::jsonb)) s
   where m.id = (s->>'id')::uuid
     and (m.recall_count is distinct from (s->>'c')::integer or m.last_recalled_at is distinct from (s->>'t')::timestamptz);

  if n = 0 then return jsonb_build_object('cases', 0, 'note', 'No question has search numbers yet. Try again in a few minutes.'); end if;
  insert into brain.eval_runs (label, settings, cases, words_top1, words_top5, words_mrr, both_top1, both_top5, both_mrr, detail)
  values (p_label,
          jsonb_build_object('limit', lim, 'recall_margin', (select e.recall_margin from brain.embed_state e), 'model', (select e.v2_model from brain.embed_state e)),
          n, w1 / n, w5 / n, wm / n, b1 / n, b5 / n, bm / n, detail)
  returning jsonb_build_object('run', id, 'label', label, 'cases', cases,
    'words', jsonb_build_object('top1', round(words_top1::numeric, 3), 'top5', round(words_top5::numeric, 3), 'mrr', round(words_mrr::numeric, 3)),
    'both', jsonb_build_object('top1', round(both_top1::numeric, 3), 'top5', round(both_top5::numeric, 3), 'mrr', round(both_mrr::numeric, 3))) into out;
  return out;
end $$;

revoke all on function brain.eval_prepare(), brain.eval_run(text, integer) from public, anon, authenticated;
grant execute on function brain.eval_prepare(), brain.eval_run(text, integer) to service_role;

-- The every minute embed job now also wakes for a fresh question that only needs the new search
-- numbers. Before this, test questions could sit waiting once their old numbers were done.
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
         and (exists (select 1 from brain.memories where embedding_v2 is null and status = 'active')
              or exists (select 1 from brain.queries where embedding_v2 is null and created_at > now() - interval '1 hour')));
$cron$);
