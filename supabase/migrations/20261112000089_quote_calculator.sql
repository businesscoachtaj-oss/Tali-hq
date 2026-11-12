-- 12 Nov 2026 (Taj): Quote calculator, part of the Business plans. The owner sets a starting price
-- and a list of things a customer can pick (a quantity, a tick box, or one choice from a few). It is
-- hosted at talihq.com.au/quote/<name>. A customer sees a rough price as they pick, sends it, and it
-- lands in the Pipeline as a new lead with what they chose, the estimate, and a nudge on the To do.
-- The server works the price out again from the saved prices, so a customer cannot send their own total.

create table if not exists public.quote_calcs (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  enabled boolean not null default false,
  title text not null default '' check (length(title) <= 80),
  intro text not null default '' check (length(intro) <= 400),
  base numeric(10,2) not null default 0 check (base >= 0 and base <= 1000000),
  -- [{ id, label, kind: 'qty' | 'tick' | 'choice', price, unit, max, choices: [{ label, price }] }]
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 20 and length(items::text) <= 12000),
  updated_at timestamptz not null default now()
);
alter table public.quote_calcs enable row level security;
drop policy if exists "own quote calc all" on public.quote_calcs;
create policy "own quote calc all" on public.quote_calcs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- What the public page is allowed to see.
create or replace function public.quote_calc_public(p_slug text)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare qc public.quote_calcs; nm text;
begin
  select * into qc from public.quote_calcs where slug = lower(trim(p_slug)) and enabled;
  if not found then return null; end if;
  select coalesce(nullif(trim(business_name), ''), nullif(trim(first_name), ''), 'Get a quote') into nm from public.profiles where id = qc.user_id;
  return jsonb_build_object('name', coalesce(nm, 'Get a quote'), 'title', qc.title, 'intro', qc.intro, 'base', qc.base, 'items', qc.items);
end $$;
revoke all on function public.quote_calc_public(text) from public;
grant execute on function public.quote_calc_public(text) to anon, authenticated, service_role;

-- A customer sends their picks. p_answers is { "<item id>": number | true | choice index }.
create or replace function public.quote_request_public(p_slug text, p_name text, p_email text default null, p_phone text default null, p_note text default null, p_answers jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare qc public.quote_calcs; cid uuid; it jsonb; a jsonb; n numeric; pr numeric; ch jsonb; idx integer;
  total numeric := 0; picks text := '';
  nm text := trim(coalesce(p_name, '')); em text := nullif(trim(coalesce(p_email, '')), ''); ph text := nullif(trim(coalesce(p_phone, '')), '');
  note text := left(trim(coalesce(p_note, '')), 600);
begin
  select * into qc from public.quote_calcs where slug = lower(trim(p_slug)) and enabled;
  if not found then return jsonb_build_object('ok', false, 'message', 'This page is not taking quote requests right now.'); end if;
  if length(nm) < 2 or length(nm) > 120 then return jsonb_build_object('ok', false, 'message', 'Add your name.'); end if;
  if em is null and ph is null then return jsonb_build_object('ok', false, 'message', 'Add an email or a phone number so they can reply.'); end if;
  if em is not null and (length(em) > 200 or em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then return jsonb_build_object('ok', false, 'message', 'That email does not look right.'); end if;
  if ph is not null and length(ph) > 40 then return jsonb_build_object('ok', false, 'message', 'That phone number is too long.'); end if;
  if jsonb_typeof(coalesce(p_answers, '{}'::jsonb)) <> 'object' or length(p_answers::text) > 4000 then return jsonb_build_object('ok', false, 'message', 'Could not read those choices. Try again.'); end if;
  if (select count(*) from public.clients c where c.user_id = qc.user_id and c.source = 'quote calculator' and c.created_at > now() - interval '1 day') >= 20 then
    return jsonb_build_object('ok', false, 'message', 'They have had a lot of requests today. Try again tomorrow.');
  end if;

  total := qc.base;
  for it in select * from jsonb_array_elements(qc.items) loop
    a := p_answers -> (it ->> 'id');
    pr := coalesce(nullif(it ->> 'price', '')::numeric, 0);
    if it ->> 'kind' = 'qty' then
      if a is not null and jsonb_typeof(a) = 'number' then
        n := least(greatest(floor((a #>> '{}')::numeric), 0), least(coalesce(nullif(it ->> 'max', '')::numeric, 999), 9999));
        if n > 0 then
          total := total + pr * n;
          picks := picks || E'\n' || (it ->> 'label') || ': ' || n::text || coalesce(' ' || nullif(it ->> 'unit', ''), '');
        end if;
      end if;
    elsif it ->> 'kind' = 'tick' then
      if a is not null and jsonb_typeof(a) = 'boolean' and (a #>> '{}')::boolean then
        total := total + pr;
        picks := picks || E'\n' || (it ->> 'label') || ': yes';
      end if;
    elsif it ->> 'kind' = 'choice' then
      if a is not null and jsonb_typeof(a) = 'number' and jsonb_typeof(it -> 'choices') = 'array' then
        idx := floor((a #>> '{}')::numeric)::integer;
        if idx >= 0 and idx < jsonb_array_length(it -> 'choices') then
          ch := (it -> 'choices') -> idx;
          total := total + coalesce(nullif(ch ->> 'price', '')::numeric, 0);
          picks := picks || E'\n' || (it ->> 'label') || ': ' || (ch ->> 'label');
        end if;
      end if;
    end if;
  end loop;
  total := round(least(total, 99999999), 2);

  insert into public.clients (user_id, name, kind, status, email, phone, notes, source, est_value)
  values (qc.user_id, nm, 'lead', 'new', em, ph,
          left('Quote request, about A$' || trim(to_char(total, 'FM999,999,990.00')) || '.' || picks || case when note <> '' then E'\nThey said: ' || note else '' end, 1000),
          'quote calculator', total)
  returning id into cid;
  insert into public.reminders (user_id, text, due_at, client_id, created_by, side)
  values (qc.user_id, left('Quote request from ' || nm || ', about A$' || trim(to_char(total, 'FM999,999,990')) || '. Get back to them', 300), now(), cid, 'tali', 'business');
  return jsonb_build_object('ok', true, 'estimate', total);
end $$;
revoke all on function public.quote_request_public(text, text, text, text, text, jsonb) from public;
grant execute on function public.quote_request_public(text, text, text, text, text, jsonb) to anon, authenticated, service_role;

-- The public website can link to the quote calculator when it is live.
create or replace function public.site_public(p_slug text)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare st public.sites; pr record; bk text; qs text;
begin
  select * into st from public.sites where slug = lower(trim(p_slug)) and published;
  if not found then return null; end if;
  select coalesce(nullif(trim(business_name), ''), nullif(trim(first_name), ''), 'Welcome') as name into pr from public.profiles where id = st.user_id;
  if st.show_booking then select slug into bk from public.booking_pages where user_id = st.user_id and enabled; end if;
  if st.kind = 'business' then select slug into qs from public.quote_calcs where user_id = st.user_id and enabled; end if;
  return jsonb_build_object(
    'name', coalesce(nullif(trim(st.title), ''), pr.name), 'kind', st.kind, 'tagline', st.tagline, 'about', st.about,
    'sections', st.sections, 'accent', st.accent, 'book_slug', bk, 'quote_slug', qs, 'show_contact', st.show_contact,
    'contact_email', case when st.show_contact then st.contact_email end,
    'contact_phone', case when st.show_contact then st.contact_phone end,
    'services', case when st.show_services then coalesce((select jsonb_agg(jsonb_build_object('name', s.name, 'minutes', s.minutes, 'price', s.price) order by s.created_at) from public.services s where s.user_id = st.user_id and s.active), '[]'::jsonb) else '[]'::jsonb end);
end $$;
revoke all on function public.site_public(text) from public;
grant execute on function public.site_public(text) to anon, authenticated, service_role;
