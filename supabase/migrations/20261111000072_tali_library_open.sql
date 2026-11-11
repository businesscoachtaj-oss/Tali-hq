-- Tali's library, open to read (11 Nov 2026, Taj's idea: "all the books and stuff she's read and
-- stored, but only the ones she's fully read are available for others to read").
--
-- The shelf and her notes are public: they are her own words about books that are out of copyright,
-- kept in the shared brain, with nothing personal in them. The full text of a book only opens once
-- she has finished it. In the app that is for anyone signed in. On the website it sits behind an
-- email (library_open), which Taj asked for.
--
--   library_shelf()                      anyone: the shelf and how far through each book she is
--   library_book(book)                   anyone: one book and everything she kept from it
--   library_read(book, from, count)      signed in: passages of a finished book, with her notes
--   library_open(email, book, from, count)  website: the same, after leaving an email
--   public.library_readers               the emails left on the website (server only)
-- Additive: nothing the live app calls is changed.

create table if not exists public.library_readers (
  email text primary key,
  first_book text,
  opens integer not null default 1,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
alter table public.library_readers enable row level security;
revoke all on public.library_readers from anon, authenticated;

create or replace function public.library_shelf()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object('id', b.id, 'title', b.title, 'author', b.author, 'people', b.people, 'region', b.region,
             'subject', b.subject, 'source_url', b.source_url, 'licence_note', b.licence_note,
             'state', case when b.state <> 'loaded' then 'waiting' when b.studied >= b.passages then 'finished' when b.studied > 0 then 'reading' else 'next' end,
             'passages', b.passages, 'studied', b.studied, 'lessons', b.lessons, 'last_read_at', b.last_read_at)
           order by (b.studied >= b.passages and b.passages > 0) desc, (b.studied::numeric / greatest(b.passages, 1)) desc, b.shelf_order)
      from brain.library_books b where b.state = 'loaded' and b.passages > 0), '[]'::jsonb);
$$;

-- One book and everything she kept from it, in the order she read it.
create or replace function public.library_book(p_book text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select (
    select jsonb_build_object('id', b.id, 'title', b.title, 'author', b.author, 'people', b.people, 'region', b.region, 'subject', b.subject,
             'source_url', b.source_url, 'licence_note', b.licence_note, 'passages', b.passages, 'studied', b.studied, 'lessons', b.lessons,
             'finished', (b.passages > 0 and b.studied >= b.passages), 'last_read_at', b.last_read_at,
             'notes', coalesce((
               select jsonb_agg(jsonb_build_object('n', split_part(m.source_ref, '/', 3)::integer, 'text', m.content)
                        order by split_part(m.source_ref, '/', 3)::integer, m.created_at)
                 from brain.memories m
                where m.user_id is null and m.status = 'active' and m.source_ref like 'library/' || b.id || '/%'
                  and split_part(m.source_ref, '/', 3) ~ '^[0-9]+$'), '[]'::jsonb))
      from brain.library_books b where b.id = p_book and b.state = 'loaded');
$$;

-- The passages themselves. Only for a book she has finished. Server side helper, not callable directly.
create or replace function brain.library_passages_of(p_book text, p_from integer, p_count integer)
returns jsonb language sql stable set search_path = '' as $$
  select case when not exists (select 1 from brain.library_books b where b.id = p_book and b.state = 'loaded' and b.passages > 0 and b.studied >= b.passages)
    then null
    else coalesce((
      select jsonb_agg(jsonb_build_object('n', p.n, 'text', p.content,
               'kept', coalesce((select jsonb_agg(m.content order by m.created_at) from brain.memories m
                                  where m.user_id is null and m.status = 'active' and m.source_ref = 'library/' || p_book || '/' || p.n), '[]'::jsonb))
             order by p.n)
        from brain.library_passages p
       where p.book_id = p_book and p.n >= greatest(coalesce(p_from, 1), 1) and p.n < greatest(coalesce(p_from, 1), 1) + least(greatest(coalesce(p_count, 10), 1), 40)), '[]'::jsonb)
  end;
$$;

create or replace function public.library_read(p_book text, p_from integer default 1, p_count integer default 10)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when (select auth.uid()) is null then null else brain.library_passages_of(p_book, p_from, p_count) end;
$$;

-- The website: leave an email, then read. The email is saved once and counted after that.
create or replace function public.library_open(p_email text, p_book text, p_from integer default 1, p_count integer default 10)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare e text := lower(trim(coalesce(p_email, '')));
begin
  if length(e) > 200 or e !~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$' then
    return jsonb_build_object('ok', false, 'reason', 'email');
  end if;
  insert into public.library_readers (email, first_book) values (e, p_book)
  on conflict (email) do update set opens = public.library_readers.opens + 1, last_seen_at = now();
  return jsonb_build_object('ok', true, 'passages', brain.library_passages_of(p_book, p_from, p_count));
end $$;

revoke all on function public.library_shelf(), public.library_book(text), public.library_read(text, integer, integer),
  public.library_open(text, text, integer, integer) from public;
revoke all on function brain.library_passages_of(text, integer, integer) from public, anon, authenticated;
grant execute on function public.library_shelf(), public.library_book(text), public.library_open(text, text, integer, integer) to anon, authenticated, service_role;
grant execute on function public.library_read(text, integer, integer) to authenticated, service_role;
