-- 12 Nov 2026 (Taj): the business side, stage 4. A simple website Tali HQ hosts at talihq.com.au/site/<name>,
-- and On autopilot: rules that put a nudge on the owner's To do so nothing slips. Nothing here sends a
-- message to anyone. Sending still needs the owner's yes.

create table if not exists public.sites (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  published boolean not null default false,
  kind text not null default 'business' check (kind in ('business', 'life')),
  title text not null default '' check (length(title) <= 80),
  tagline text not null default '' check (length(tagline) <= 160),
  about text not null default '' check (length(about) <= 2000),
  -- [{ "heading": "...", "text": "..." }], at most 8.
  sections jsonb not null default '[]'::jsonb check (jsonb_typeof(sections) = 'array' and jsonb_array_length(sections) <= 8 and length(sections::text) <= 12000),
  accent text not null default '#7FA8FF' check (accent ~ '^#[0-9A-Fa-f]{6}$'),
  show_services boolean not null default true,
  show_booking boolean not null default true,
  show_contact boolean not null default true,
  contact_email text check (contact_email is null or length(contact_email) <= 200),
  contact_phone text check (contact_phone is null or length(contact_phone) <= 40),
  updated_at timestamptz not null default now()
);
alter table public.sites enable row level security;
drop policy if exists "own site all" on public.sites;
create policy "own site all" on public.sites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop trigger if exists sites_touch on public.sites;
create trigger sites_touch before update on public.sites for each row execute function public.touch_updated_at();

create table if not exists public.site_enquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 2 and 120),
  email text check (email is null or length(email) <= 200),
  phone text check (phone is null or length(phone) <= 40),
  message text not null default '' check (length(message) <= 2000),
  client_id uuid references public.clients(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists site_enquiries_user_idx on public.site_enquiries (user_id, created_at desc);
alter table public.site_enquiries enable row level security;
drop policy if exists "own enquiries read" on public.site_enquiries;
create policy "own enquiries read" on public.site_enquiries for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "own enquiries delete" on public.site_enquiries;
create policy "own enquiries delete" on public.site_enquiries for delete to authenticated using (user_id = (select auth.uid()));
revoke insert, update on public.site_enquiries from anon, authenticated;

-- What the public site is allowed to see.
create or replace function public.site_public(p_slug text)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare st public.sites; pr record; bk text;
begin
  select * into st from public.sites where slug = lower(trim(p_slug)) and published;
  if not found then return null; end if;
  select coalesce(nullif(trim(business_name), ''), nullif(trim(first_name), ''), 'Welcome') as name into pr from public.profiles where id = st.user_id;
  if st.show_booking then select slug into bk from public.booking_pages where user_id = st.user_id and enabled; end if;
  return jsonb_build_object(
    'name', coalesce(nullif(trim(st.title), ''), pr.name), 'kind', st.kind, 'tagline', st.tagline, 'about', st.about,
    'sections', st.sections, 'accent', st.accent, 'book_slug', bk, 'show_contact', st.show_contact,
    'contact_email', case when st.show_contact then st.contact_email end,
    'contact_phone', case when st.show_contact then st.contact_phone end,
    'services', case when st.show_services then coalesce((select jsonb_agg(jsonb_build_object('name', s.name, 'minutes', s.minutes, 'price', s.price) order by s.created_at) from public.services s where s.user_id = st.user_id and s.active), '[]'::jsonb) else '[]'::jsonb end);
end $$;
revoke all on function public.site_public(text) from public;
grant execute on function public.site_public(text) to anon, authenticated, service_role;

-- Someone fills in the contact form. It lands as an enquiry, and on a business site as a new lead
-- with a nudge on the owner's To do.
create or replace function public.site_enquiry_public(p_slug text, p_name text, p_email text default null, p_phone text default null, p_message text default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare st public.sites; cid uuid;
  nm text := trim(coalesce(p_name, '')); em text := nullif(trim(coalesce(p_email, '')), ''); ph text := nullif(trim(coalesce(p_phone, '')), '');
  msg text := left(trim(coalesce(p_message, '')), 2000);
begin
  select * into st from public.sites where slug = lower(trim(p_slug)) and published and show_contact;
  if not found then return jsonb_build_object('ok', false, 'message', 'This page is not taking messages right now.'); end if;
  if length(nm) < 2 or length(nm) > 120 then return jsonb_build_object('ok', false, 'message', 'Add your name.'); end if;
  if em is null and ph is null then return jsonb_build_object('ok', false, 'message', 'Add an email or a phone number so they can reply.'); end if;
  if em is not null and (length(em) > 200 or em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then return jsonb_build_object('ok', false, 'message', 'That email does not look right.'); end if;
  if ph is not null and length(ph) > 40 then return jsonb_build_object('ok', false, 'message', 'That phone number is too long.'); end if;
  if (select count(*) from public.site_enquiries e where e.user_id = st.user_id and e.created_at > now() - interval '1 day') >= 20 then
    return jsonb_build_object('ok', false, 'message', 'They have had a lot of messages today. Try again tomorrow.');
  end if;
  if st.kind = 'business' then
    insert into public.clients (user_id, name, kind, status, email, phone, notes, source)
    values (st.user_id, nm, 'lead', 'new', em, ph, left(msg, 1000), 'website') returning id into cid;
    insert into public.reminders (user_id, text, due_at, client_id, created_by, side)
    values (st.user_id, left('Get back to ' || nm || ', who wrote in through your website', 300), now(), cid, 'tali', 'business');
  end if;
  insert into public.site_enquiries (user_id, name, email, phone, message, client_id) values (st.user_id, nm, em, ph, msg, cid);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.site_enquiry_public(text, text, text, text, text) from public;
grant execute on function public.site_enquiry_public(text, text, text, text, text) to anon, authenticated, service_role;

-- On autopilot. Each rule the owner switches on, and a log so one thing is only ever nudged once.
create table if not exists public.automations (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('quote_followup', 'invoice_overdue', 'new_lead', 'booking_request', 'job_to_invoice')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);
alter table public.automations enable row level security;
drop policy if exists "own automations all" on public.automations;
create policy "own automations all" on public.automations for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.automation_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  ref_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, ref_id)
);
alter table public.automation_log enable row level security;
drop policy if exists "own automation log read" on public.automation_log;
create policy "own automation log read" on public.automation_log for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.automation_log from anon, authenticated;

-- Runs the signed-in owner's rules. Only ever adds to their own To do. Returns how many nudges it added.
create or replace function public.automations_run()
returns integer language plpgsql security definer set search_path to '' as $$
declare me uuid := auth.uid(); n integer := 0; r record;
begin
  if me is null then return 0; end if;
  for r in
    select 'quote_followup'::text as kind, j.id as ref, j.client_id as cid, 'Follow up the quote for ' || coalesce(nullif(j.client_name, ''), 'your customer') || ': ' || j.title as txt
      from public.jobs j where j.user_id = me and j.status = 'sent' and j.sent_at < now() - interval '3 days'
    union all
    select 'invoice_overdue', i.id, i.client_id, 'Chase invoice ' || coalesce(i.number, '') || ' with ' || coalesce(nullif(i.client_name, ''), 'your customer') || ', it is past its due date'
      from public.invoices i where i.user_id = me and i.status = 'sent' and i.due_date < current_date
    union all
    select 'new_lead', c.id, c.id, 'Get back to ' || c.name || ', a new lead who has not heard from you'
      from public.clients c where c.user_id = me and c.kind = 'lead' and c.status = 'new' and c.last_contact_at is null and c.created_at < now() - interval '1 day' and coalesce(c.source, '') <> 'website'
    union all
    select 'booking_request', b.id, b.client_id, 'Say yes or no to the booking request from ' || coalesce(nullif(b.client_name, ''), 'a customer')
      from public.bookings b where b.user_id = me and b.status = 'requested' and b.starts_at > now()
    union all
    select 'job_to_invoice', j.id, j.client_id, 'Invoice ' || coalesce(nullif(j.client_name, ''), 'your customer') || ' for ' || j.title
      from public.jobs j where j.user_id = me and j.status = 'done' and j.invoice_id is null
  loop
    if exists (select 1 from public.automations a where a.user_id = me and a.kind = r.kind and a.enabled)
       and not exists (select 1 from public.automation_log l where l.user_id = me and l.kind = r.kind and l.ref_id = r.ref) then
      insert into public.automation_log (user_id, kind, ref_id) values (me, r.kind, r.ref);
      insert into public.reminders (user_id, text, due_at, client_id, created_by, side) values (me, left(r.txt, 300), now(), r.cid, 'tali', 'business');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.automations_run() from public;
grant execute on function public.automations_run() to authenticated;
