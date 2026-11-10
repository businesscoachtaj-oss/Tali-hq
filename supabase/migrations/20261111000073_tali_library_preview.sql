-- 11 Nov 2026: the free taste on the website. One page of a finished book, readable without an
-- email, so the page has the book's own words on it. Skips the title page and contents pages:
-- it is the first early passage Tali kept something from that reads as prose.
create or replace function public.library_preview(p_book text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_array(v) from jsonb_array_elements(brain.library_passages_of(p_book, 2, 20)) with ordinality t(v, i)
      where jsonb_array_length(coalesce(v->'kept', '[]'::jsonb)) > 0
        and length(v->>'text') > 700
        and (v->>'text') !~ '\s{5,}\d'
      order by i limit 1),
    brain.library_passages_of(p_book, 2, 1));
$$;
revoke all on function public.library_preview(text) from public;
grant execute on function public.library_preview(text) to anon, authenticated, service_role;
