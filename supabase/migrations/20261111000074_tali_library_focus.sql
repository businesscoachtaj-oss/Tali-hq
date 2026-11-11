-- 11 Nov 2026 (asked for by Taj: "Can you finish 2 more books?"). A book can be marked "finish this
-- next". Tali reads marked books before the others until they are done. Nothing else changes.
-- Already applied to the live project. Used to finish The Chemical History of a Candle and The Prince.
alter table brain.library_books add column if not exists focus boolean not null default false;

create or replace function public.library_next_passages(p_limit integer default 4)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_book brain.library_books; v_out jsonb;
begin
  select b.* into v_book from brain.library_books b
   where b.state = 'loaded' and b.studied < b.passages
   order by b.focus desc, b.last_read_at nulls first, b.shelf_order limit 1;
  if v_book.id is null then return null; end if;
  select jsonb_agg(jsonb_build_object('n', p.n, 'content', p.content) order by p.n) into v_out
    from (select n, content from brain.library_passages
           where book_id = v_book.id and studied_at is null order by n
           limit least(greatest(coalesce(p_limit, 4), 1), 8)) p;
  return jsonb_build_object('book', jsonb_build_object('id', v_book.id, 'title', v_book.title, 'author', v_book.author,
    'region', v_book.region, 'subject', v_book.subject, 'passages', v_book.passages, 'studied', v_book.studied), 'passages', coalesce(v_out, '[]'::jsonb));
end $$;

-- The catch-up job: every 2 minutes while a marked book is unfinished, one catch-up call (it stops
-- itself after 45 seconds, so calls never overlap). Clears the marks and removes itself when done.
-- To finish a book: set focus = true on it, then schedule 'tali-library-focus' as below.
create or replace function brain.library_focus_tick()
returns void language plpgsql security definer set search_path = '' as $$
begin
  update brain.library_books set focus = false where focus and studied >= passages and passages > 0;
  if not exists (select 1 from brain.library_books where focus and state = 'loaded') then
    perform cron.unschedule('tali-library-focus') where exists (select 1 from cron.job where jobname = 'tali-library-focus');
    return;
  end if;
  perform net.http_post(
    url := 'https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/tali-library',
    headers := jsonb_build_object('Content-Type','application/json','x-tali-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'tali_brain_key')),
    body := '{"rounds": 20}'::jsonb,
    timeout_milliseconds := 100000);
end $$;
revoke all on function brain.library_focus_tick() from public, anon, authenticated;

-- select cron.schedule('tali-library-focus', '*/2 * * * *', $cron$ select brain.library_focus_tick(); $cron$);
