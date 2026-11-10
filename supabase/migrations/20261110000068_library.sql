-- Tali's library (10 Nov 2026, asked for by Taj: "her library, the books and stuff").
--
-- A shelf of real books that are out of copyright, for Tali to work through a few pages a night.
-- Every book on the shelf was checked before it went on: it is public domain in the USA (Project
-- Gutenberg's own check) and public domain in Australia (the author and any translator or editor
-- died before 1955). Health, nutrition and medicine books are left off on purpose: old advice in
-- those fields is often wrong, and Tali must not learn it as fact.
--
--   brain.library_books      the shelf: one row per book, where it came from and its licence
--   brain.library_passages   the book's own words, split into passages, exactly as published
--   library_next_to_load / library_save_passages / library_load_failed   loading a book (service only)
--   library_next_passages / library_mark_studied                         nightly reading (service only)
--   my_library()             signed in: the shelf and how far through each book she is
--
-- The edge function tali-library (cron, 3:23am Sydney) loads one waiting book a night, reads a few
-- passages and saves what is worth keeping to the shared brain with brain_learn, under the part of
-- the brain the book belongs to, with source_ref library/<book>/<passage>. The passages themselves
-- never go into recall: they stay on the shelf as the original text.
-- Server only, like the rest of schema brain. Additive: nothing the live app calls is changed.

create table if not exists brain.library_books (
  id text primary key,
  title text not null,
  author text not null,
  people text,
  region text not null,
  subject text not null,
  source_url text not null,
  text_url text not null,
  licence text not null default 'public domain',
  licence_note text not null,
  state text not null default 'queued' check (state in ('queued', 'loaded', 'failed')),
  passages integer not null default 0,
  studied integer not null default 0,
  lessons integer not null default 0,
  error text,
  shelf_order integer not null default 100,
  added_at timestamptz not null default now(),
  loaded_at timestamptz,
  last_read_at timestamptz
);
alter table brain.library_books enable row level security;

create table if not exists brain.library_passages (
  book_id text not null references brain.library_books(id) on delete cascade,
  n integer not null,
  content text not null,
  studied_at timestamptz,
  kept integer,
  primary key (book_id, n)
);
alter table brain.library_passages enable row level security;
create index if not exists library_passages_todo on brain.library_passages (book_id, n) where studied_at is null;

insert into brain.library_books (id, title, author, people, region, subject, source_url, text_url, licence_note, shelf_order) values
  ('pg2680', 'Meditations', 'Marcus Aurelius', 'Translated by Meric Casaubon (died 1671)', 'frontal', 'philosophy',
   'https://www.gutenberg.org/ebooks/2680', 'https://www.gutenberg.org/cache/epub/2680/pg2680.txt',
   'Author died 180, translator died 1671. Public domain in the USA and Australia.', 10),
  ('pg1232', 'The Prince', 'Niccolo Machiavelli', 'Translated by W. K. Marriott (died 1927)', 'prefrontal', 'strategy',
   'https://www.gutenberg.org/ebooks/1232', 'https://www.gutenberg.org/cache/epub/1232/pg1232.txt',
   'Author died 1527, translator died 1927. Public domain in the USA and Australia.', 20),
  ('pg3300', 'The Wealth of Nations', 'Adam Smith', null, 'prefrontal', 'economics',
   'https://www.gutenberg.org/ebooks/3300', 'https://www.gutenberg.org/cache/epub/3300/pg3300.txt',
   'Author died 1790. Public domain in the USA and Australia.', 30),
  ('pg14474', 'The Chemical History of a Candle', 'Michael Faraday', 'Edited by William Crookes (died 1919)', 'parietal', 'physics',
   'https://www.gutenberg.org/ebooks/14474', 'https://www.gutenberg.org/cache/epub/14474/pg14474.txt',
   'Author died 1867, editor died 1919. Public domain in the USA and Australia.', 40),
  ('pg37134', 'The Elements of Style', 'William Strunk', null, 'temporal', 'writing',
   'https://www.gutenberg.org/ebooks/37134', 'https://www.gutenberg.org/cache/epub/37134/pg37134.txt',
   'The 1918 first edition. Author died 1946. Public domain in the USA and Australia.', 50),
  ('pg5000', 'The Notebooks of Leonardo da Vinci', 'Leonardo da Vinci', 'Translated by Jean Paul Richter (died 1937)', 'occipital', 'art',
   'https://www.gutenberg.org/ebooks/5000', 'https://www.gutenberg.org/cache/epub/5000/pg5000.txt',
   'Author died 1519, translator died 1937. Public domain in the USA and Australia.', 60),
  ('pg16287', 'Talks to Teachers on Psychology', 'William James', null, 'hippocampus', 'learning',
   'https://www.gutenberg.org/ebooks/16287', 'https://www.gutenberg.org/cache/epub/16287/pg16287.txt',
   'Author died 1910. Public domain in the USA and Australia.', 70),
  ('pg1227', 'The Expression of the Emotions in Man and Animals', 'Charles Darwin', null, 'amygdala', 'emotions',
   'https://www.gutenberg.org/ebooks/1227', 'https://www.gutenberg.org/cache/epub/1227/pg1227.txt',
   'Author died 1882. Public domain in the USA and Australia.', 80),
  ('pg15114', 'An Investigation of the Laws of Thought', 'George Boole', null, 'thalamus', 'logic and computing',
   'https://www.gutenberg.org/ebooks/15114', 'https://www.gutenberg.org/cache/epub/15114/pg15114.txt',
   'Author died 1864. Public domain in the USA and Australia.', 90),
  ('pg2274', 'How to Live on 24 Hours a Day', 'Arnold Bennett', null, 'basal_ganglia', 'habits',
   'https://www.gutenberg.org/ebooks/2274', 'https://www.gutenberg.org/cache/epub/2274/pg2274.txt',
   'Author died 1931. Public domain in the USA and Australia.', 5),
  ('pg148', 'The Autobiography of Benjamin Franklin', 'Benjamin Franklin', 'Edited by Charles W. Eliot (died 1926)', 'basal_ganglia', 'habits',
   'https://www.gutenberg.org/ebooks/148', 'https://www.gutenberg.org/cache/epub/148/pg148.txt',
   'Author died 1790, editor died 1926. Public domain in the USA and Australia.', 100),
  ('pg1228', 'On the Origin of Species', 'Charles Darwin', null, 'corpus_callosum', 'big ideas',
   'https://www.gutenberg.org/ebooks/1228', 'https://www.gutenberg.org/cache/epub/1228/pg1228.txt',
   'Author died 1882. Public domain in the USA and Australia.', 110)
on conflict (id) do nothing;

-- The next book waiting to be loaded (one a night, shortest wait first).
create or replace function public.library_next_to_load()
returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(t) from (
    select b.id, b.title, b.text_url from brain.library_books b
     where b.state = 'queued' order by b.shelf_order, b.added_at limit 1) t;
$$;

-- Saves a book's passages (an array of strings, in order). Safe to call more than once.
create or replace function public.library_save_passages(p_book text, p_passages jsonb, p_done boolean default true)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_from integer; v_n integer;
begin
  if jsonb_typeof(p_passages) <> 'array' then raise exception 'passages must be a list'; end if;
  select coalesce(max(n), 0) into v_from from brain.library_passages where book_id = p_book;
  insert into brain.library_passages (book_id, n, content)
  select p_book, v_from + ord, btrim(val)
    from jsonb_array_elements_text(p_passages) with ordinality as x(val, ord)
   where length(btrim(val)) > 0;
  select count(*) into v_n from brain.library_passages where book_id = p_book;
  update brain.library_books
     set passages = v_n, state = case when p_done then 'loaded' else state end,
         loaded_at = case when p_done then now() else loaded_at end, error = null
   where id = p_book;
  return v_n;
end $$;

create or replace function public.library_load_failed(p_book text, p_error text)
returns void language sql security definer set search_path = '' as $$
  update brain.library_books set state = 'failed', error = left(p_error, 300) where id = p_book;
$$;

-- Tonight's reading: the next unread passages, from the book read least recently, so the shelf
-- moves along together. All from one book so the lessons hang together.
create or replace function public.library_next_passages(p_limit integer default 4)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_book brain.library_books; v_out jsonb;
begin
  select b.* into v_book from brain.library_books b
   where b.state = 'loaded' and b.studied < b.passages
   order by b.last_read_at nulls first, b.shelf_order limit 1;
  if v_book.id is null then return null; end if;
  select jsonb_agg(jsonb_build_object('n', p.n, 'content', p.content) order by p.n) into v_out
    from (select n, content from brain.library_passages
           where book_id = v_book.id and studied_at is null order by n
           limit least(greatest(coalesce(p_limit, 4), 1), 8)) p;
  return jsonb_build_object('book', jsonb_build_object('id', v_book.id, 'title', v_book.title, 'author', v_book.author,
    'region', v_book.region, 'subject', v_book.subject, 'passages', v_book.passages, 'studied', v_book.studied), 'passages', coalesce(v_out, '[]'::jsonb));
end $$;

-- Marks passages read and counts what was kept. p_read: [{"n": 12, "kept": 1}, ...]
create or replace function public.library_mark_studied(p_book text, p_read jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update brain.library_passages p
     set studied_at = now(), kept = coalesce((r->>'kept')::integer, 0)
    from jsonb_array_elements(p_read) r
   where p.book_id = p_book and p.n = (r->>'n')::integer and p.studied_at is null;
  update brain.library_books b
     set studied = (select count(*) from brain.library_passages where book_id = p_book and studied_at is not null),
         lessons = (select coalesce(sum(kept), 0) from brain.library_passages where book_id = p_book),
         last_read_at = now()
   where b.id = p_book;
end $$;

revoke all on function public.library_next_to_load(), public.library_save_passages(text, jsonb, boolean), public.library_load_failed(text, text),
  public.library_next_passages(integer), public.library_mark_studied(text, jsonb) from public, anon, authenticated;
grant execute on function public.library_next_to_load(), public.library_save_passages(text, jsonb, boolean), public.library_load_failed(text, text),
  public.library_next_passages(integer), public.library_mark_studied(text, jsonb) to service_role;

-- The shelf, for the app. The same for everyone: it is Tali's library, not one person's.
create or replace function public.my_library()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when (select auth.uid()) is null then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object('id', b.id, 'title', b.title, 'author', b.author, 'people', b.people, 'region', b.region,
             'subject', b.subject, 'source_url', b.source_url, 'licence_note', b.licence_note,
             'state', case when b.state <> 'loaded' then 'waiting' when b.studied >= b.passages then 'finished' when b.studied > 0 then 'reading' else 'next' end,
             'passages', b.passages, 'studied', b.studied, 'lessons', b.lessons, 'last_read_at', b.last_read_at)
           order by (b.last_read_at is null), b.last_read_at desc, b.shelf_order)
      from brain.library_books b where b.state <> 'failed'), '[]'::jsonb) end;
$$;
revoke all on function public.my_library() from public, anon;
grant execute on function public.my_library() to authenticated;

-- Every night at 3:23am Sydney summer time (16:23 UTC): load one waiting book, read a few passages.
select cron.unschedule('tali-library') where exists (select 1 from cron.job where jobname = 'tali-library');
select cron.schedule('tali-library', '23 16 * * *', $cron$
  select net.http_post(
    url := 'https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/tali-library',
    headers := jsonb_build_object('Content-Type','application/json','x-tali-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'tali_brain_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 140000);
$cron$);
