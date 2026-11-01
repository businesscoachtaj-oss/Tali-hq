-- Tali HQ 012: invoices, business health checks, Pro rules, Tali email inbox, Tali's weekly journal.

-- ---------- Invoices ----------
create table if not exists public.invoice_settings (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  business_name text,
  abn text check (abn is null or length(abn) <= 20),
  address text check (address is null or length(address) <= 300),
  email text,
  phone text,
  payment_details text check (payment_details is null or length(payment_details) <= 600),
  gst_registered boolean not null default false,
  default_due_days integer not null default 7 check (default_due_days between 0 and 90),
  next_number integer not null default 1 check (next_number > 0),
  footer text check (footer is null or length(footer) <= 300),
  updated_at timestamptz not null default now()
);
alter table public.invoice_settings enable row level security;
create policy "own invoice settings all" on public.invoice_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger invoice_settings_touch before update on public.invoice_settings for each row execute function public.touch_updated_at();

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null check (length(trim(client_name)) between 1 and 120),
  client_email text,
  number text,
  issue_date date not null default current_date,
  due_date date not null default (current_date + 7),
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array'),
  gst boolean not null default false,
  subtotal numeric(12,2) not null default 0,
  gst_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'void')),
  sent_at timestamptz,
  paid_at timestamptz,
  notes text not null default '' check (length(notes) <= 1000),
  created_by text not null default 'user' check (created_by in ('user', 'tali')),
  reminder_drafted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists invoices_user_status_idx on public.invoices (user_id, status, due_date);
create index if not exists invoices_client_idx on public.invoices (client_id);
alter table public.invoices enable row level security;
create policy "own invoices all" on public.invoices for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger invoices_touch before update on public.invoices for each row execute function public.touch_updated_at();

-- Totals always come from the line items; numbers come from the user's own sequence.
create or replace function public.invoices_prepare() returns trigger
language plpgsql security definer set search_path = '' as $$
declare sub numeric(12,2); n integer;
begin
  select coalesce(sum(round(coalesce((i->>'qty')::numeric, 1) * coalesce((i->>'unit_price')::numeric, 0), 2)), 0)
    into sub from jsonb_array_elements(new.items) i;
  new.subtotal := sub;
  new.gst_amount := case when new.gst then round(sub * 0.10, 2) else 0 end;
  new.total := new.subtotal + new.gst_amount;
  if new.number is null or trim(new.number) = '' then
    insert into public.invoice_settings(user_id) values (new.user_id) on conflict (user_id) do nothing;
    update public.invoice_settings set next_number = next_number + 1 where user_id = new.user_id returning next_number - 1 into n;
    new.number := 'INV-' || lpad(n::text, 4, '0');
  end if;
  if new.status = 'sent' and new.sent_at is null then new.sent_at := now(); end if;
  if new.status = 'paid' and new.paid_at is null then new.paid_at := now(); end if;
  return new;
end $$;
revoke all on function public.invoices_prepare() from public, anon, authenticated;
create trigger invoices_prepare before insert or update on public.invoices for each row execute function public.invoices_prepare();

-- ---------- Pro check ----------
create or replace function public.has_pro(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.subscriptions s where s.user_id = p_user_id and s.plan_id = 'pro'
                  and (s.status in ('active', 'past_due') or (s.status = 'trialing' and s.trial_ends_at > now())));
$$;
revoke all on function public.has_pro(uuid) from public, anon;
revoke all on function public.has_pro(uuid) from authenticated;
grant execute on function public.has_pro(uuid) to service_role;

-- ---------- Business health ----------
create or replace function public.business_health(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz text; d date; items jsonb := '[]'::jsonb; score integer := 0;
  n integer; amt numeric; oldest integer;
begin
  select coalesce(timezone, 'Australia/Sydney') into tz from public.profiles where id = p_user_id;
  d := (now() at time zone coalesce(tz, 'Australia/Sydney'))::date;

  select count(*), coalesce(sum(total), 0), coalesce(max(d - due_date), 0) into n, amt, oldest
    from public.invoices where user_id = p_user_id and status = 'sent' and due_date < d;
  if n > 0 then
    items := items || jsonb_build_object('area', 'invoices', 'level', case when oldest > 14 then 'red' else 'amber' end,
      'text', n || case when n = 1 then ' invoice overdue, A$' else ' invoices overdue, A$' end || to_char(amt, 'FM999,999,990.00') || ', oldest ' || oldest || ' days');
  end if;

  select count(*) into n from public.clients where user_id = p_user_id and next_follow_up < d and status not in ('lost', 'past');
  if n > 0 then
    items := items || jsonb_build_object('area', 'follow_ups', 'level', case when n > 3 then 'red' else 'amber' end,
      'text', n || case when n = 1 then ' follow-up overdue' else ' follow-ups overdue' end);
  end if;

  select count(*) into n from public.clients where user_id = p_user_id and kind = 'client' and status = 'active'
     and coalesce(last_contact_at, created_at::date) < d - 14;
  if n > 0 then
    items := items || jsonb_build_object('area', 'quiet_clients', 'level', 'amber',
      'text', n || case when n = 1 then ' active client with no contact in 2 weeks' else ' active clients with no contact in 2 weeks' end);
  end if;

  select count(*) into n from public.clients where user_id = p_user_id and kind = 'lead' and status = 'new'
     and next_follow_up is null and created_at < now() - interval '2 days';
  if n > 0 then
    items := items || jsonb_build_object('area', 'leads', 'level', 'amber',
      'text', n || case when n = 1 then ' new lead with no follow-up set' else ' new leads with no follow-up set' end);
  end if;

  select count(*) into n from public.approvals where user_id = p_user_id and status = 'pending' and created_at < now() - interval '2 days';
  if n > 0 then
    items := items || jsonb_build_object('area', 'drafts', 'level', 'amber',
      'text', n || case when n = 1 then ' draft waiting more than 2 days' else ' drafts waiting more than 2 days' end);
  end if;

  select count(*) into n from public.reminders where user_id = p_user_id and done_at is null and due_at < now() - interval '1 day';
  if n > 0 then
    items := items || jsonb_build_object('area', 'reminders', 'level', 'amber',
      'text', n || case when n = 1 then ' reminder overdue by more than a day' else ' reminders overdue by more than a day' end);
  end if;

  return jsonb_build_object(
    'status', case when exists (select 1 from jsonb_array_elements(items) x where x->>'level' = 'red') then 'red'
                   when jsonb_array_length(items) > 0 then 'amber' else 'green' end,
    'items', items, 'checkedAt', now());
end $$;
revoke all on function public.business_health(uuid) from public, anon, authenticated;
grant execute on function public.business_health(uuid) to service_role;

create or replace function public.my_business_health() returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.business_health((select auth.uid()));
$$;
revoke all on function public.my_business_health() from public, anon;
grant execute on function public.my_business_health() to authenticated;

-- Twice a day: nudge trial and paid users whose health is amber or red (at most once per 12 hours).
create or replace function public.health_nudges() returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; h jsonb; n integer := 0; msgs jsonb; body text;
begin
  for r in
    select s.user_id from public.subscriptions s join public.profiles p on p.id = s.user_id
     where p.onboarded_at is not null
       and ((s.status = 'trialing' and s.trial_ends_at > now()) or (s.status = 'active' and s.plan_id in ('hq', 'pro')))
       and not exists (select 1 from public.job_runs j where j.user_id = s.user_id and j.job = 'health_check' and j.started_at > now() - interval '11 hours')
  loop
    h := public.business_health(r.user_id);
    insert into public.job_runs(user_id, job, status, summary, finished_at)
    values (r.user_id, 'health_check', 'ok', h->>'status' || ': ' || jsonb_array_length(h->'items') || ' items', now());
    if h->>'status' <> 'green' then
      body := (select string_agg(x->>'text', ', ') from (select x from jsonb_array_elements(h->'items') x limit 3) t);
      select jsonb_agg(jsonb_build_object('to', t.token, 'title', case when h->>'status' = 'red' then 'Tali: something needs you' else 'Tali: a few things to check' end,
                                          'body', left(body, 160), 'sound', 'default', 'data', jsonb_build_object('url', '/')))
        into msgs from public.push_tokens t where t.user_id = r.user_id;
      if msgs is not null then
        perform net.http_post(url := 'https://exp.host/--/api/v2/push/send',
          headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'), body := msgs);
      end if;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.health_nudges() from public, anon, authenticated;
-- 8:07am and 6:07pm Sydney (21:07 and 07:07 UTC in summer).
select cron.schedule('tali-health', '7 7,21 * * *', $cron$ select public.health_nudges(); $cron$);

-- ---------- Pro rules (Tali acts inside rules the user sets; nothing leaves the app) ----------
create table if not exists public.rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  type text not null check (type in ('quiet_client', 'overdue_invoice', 'weekly_reminder', 'new_lead')),
  params jsonb not null default '{}',
  enabled boolean not null default true,
  last_run_at timestamptz,
  runs integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists rules_user_idx on public.rules (user_id);
alter table public.rules enable row level security;
create policy "own rules all" on public.rules for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function public.run_rules() returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; tz text; d date; ln timestamp; n integer; total integer := 0; days integer;
begin
  for r in select ru.* from public.rules ru where ru.enabled and public.has_pro(ru.user_id) loop
    select coalesce(timezone, 'Australia/Sydney') into tz from public.profiles where id = r.user_id;
    ln := now() at time zone coalesce(tz, 'Australia/Sydney'); d := ln::date; n := 0;
    days := greatest(coalesce((r.params->>'days')::integer, 14), 1);

    if r.type = 'quiet_client' then
      update public.clients set status = 'quiet', next_follow_up = coalesce(next_follow_up, d)
       where user_id = r.user_id and kind = 'client' and status = 'active' and coalesce(last_contact_at, created_at::date) < d - days;
      get diagnostics n = row_count;

    elsif r.type = 'new_lead' then
      update public.clients set next_follow_up = d + 1
       where user_id = r.user_id and kind = 'lead' and status = 'new' and next_follow_up is null;
      get diagnostics n = row_count;

    elsif r.type = 'overdue_invoice' then
      days := greatest(coalesce((r.params->>'days')::integer, 7), 1);
      with due as (
        update public.invoices i set reminder_drafted_at = now()
         where i.user_id = r.user_id and i.status = 'sent' and i.due_date < d - days and i.reminder_drafted_at is null
        returning i.id, i.number, i.client_name, i.total, i.due_date
      )
      insert into public.approvals(user_id, kind, title, draft)
      select r.user_id, 'invoice', 'Reminder for ' || due.client_name || ', ' || due.number,
             jsonb_build_object('to', due.client_name, 'body',
               'Hi ' || split_part(due.client_name, ' ', 1) || ', just a friendly reminder that invoice ' || due.number || ' for A$' ||
               to_char(due.total, 'FM999,999,990.00') || ' was due on ' || to_char(due.due_date, 'FMDD Mon') ||
               '. Could you pop it through when you get a chance? Thanks!', 'from', 'rule/' || r.id)
        from due;
      get diagnostics n = row_count;

    elsif r.type = 'weekly_reminder' then
      if extract(isodow from ln) = coalesce((r.params->>'weekday')::integer, 1)
         and extract(hour from ln) >= coalesce((r.params->>'hour')::integer, 9)
         and (r.last_run_at is null or r.last_run_at < now() - interval '6 days')
         and coalesce(trim(r.params->>'text'), '') <> '' then
        insert into public.reminders(user_id, text, due_at, created_by) values (r.user_id, left(trim(r.params->>'text'), 300), now(), 'tali');
        n := 1;
      end if;
    end if;

    if n > 0 then
      update public.rules set last_run_at = now(), runs = runs + n where id = r.id;
      total := total + n;
    end if;
  end loop;
  return total;
end $$;
revoke all on function public.run_rules() from public, anon, authenticated;
select cron.schedule('tali-rules', '23 * * * *', $cron$ select public.run_rules() where exists (select 1 from public.rules where enabled); $cron$);

-- ---------- Tali email inbox (Pro) ----------
create table if not exists public.tali_inboxes (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  alias text not null unique check (alias ~ '^[a-z0-9][a-z0-9.-]{2,30}$'),
  created_at timestamptz not null default now()
);
alter table public.tali_inboxes enable row level security;
create policy "own inbox read" on public.tali_inboxes for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.inbound_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_email text,
  from_name text,
  subject text,
  body_text text check (body_text is null or length(body_text) <= 20000),
  summary text,
  status text not null default 'new' check (status in ('new', 'handled', 'spam')),
  approval_id uuid references public.approvals(id) on delete set null,
  provider_id text unique,
  received_at timestamptz not null default now()
);
create index if not exists inbound_user_idx on public.inbound_emails (user_id, received_at desc);
create index if not exists inbound_approval_idx on public.inbound_emails (approval_id);
alter table public.inbound_emails enable row level security;
create policy "own inbound read" on public.inbound_emails for select to authenticated using (user_id = (select auth.uid()));
create policy "own inbound update" on public.inbound_emails for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on public.inbound_emails from authenticated;
grant update (status) on public.inbound_emails to authenticated;

-- Pro users claim their address (first name based, made unique).
create or replace function public.claim_tali_inbox() returns text
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); base text; cand text; i integer := 0; existing text;
begin
  if u is null then raise exception 'not signed in'; end if;
  if not public.has_pro(u) then raise exception 'Tali email is part of Tali HQ Pro'; end if;
  select alias into existing from public.tali_inboxes where user_id = u;
  if existing is not null then return existing; end if;
  select lower(regexp_replace(coalesce(nullif(business_name, ''), nullif(first_name, ''), 'hello'), '[^a-zA-Z0-9]+', '', 'g'))
    into base from public.profiles where id = u;
  base := left(coalesce(nullif(base, ''), 'hello'), 24);
  if length(base) < 3 then base := base || 'hq'; end if;
  cand := base;
  while exists (select 1 from public.tali_inboxes where alias = cand) loop
    i := i + 1; cand := base || i;
  end loop;
  insert into public.tali_inboxes(user_id, alias) values (u, cand);
  return cand;
end $$;
revoke all on function public.claim_tali_inbox() from public, anon;
grant execute on function public.claim_tali_inbox() to authenticated;

-- ---------- Tali's weekly journal (Sundays, trial and paid plans) ----------
create or replace function public.due_briefs(p_limit integer default 25)
returns table(user_id uuid, kind text, local_date date, plan text)
language sql security definer set search_path = '' as $$
  with base as (
    select p.id as user_id, coalesce(p.timezone, 'Australia/Sydney') as tz, p.brief_time,
           s.plan_id, s.status, s.trial_ends_at
      from public.profiles p
      join public.subscriptions s on s.user_id = p.id
     where p.onboarded_at is not null
  ), local as (
    select b.*, (now() at time zone b.tz) as local_now,
           ((b.status = 'trialing' and b.trial_ends_at > now()) or (b.status = 'active' and b.plan_id in ('hq','pro'))) as paid
      from base b
  ), wanted as (
    select l.user_id, case when l.paid then 'morning' else 'weekly' end as kind, l.local_now::date as local_date,
           case when l.paid then l.plan_id else 'free' end as plan,
           (l.local_now >= l.local_now::date + l.brief_time and l.local_now < l.local_now::date + l.brief_time + interval '3 hours'
             and (l.paid or extract(isodow from l.local_now) = 5)) as due
      from local l
    union all
    select l.user_id, 'journal', l.local_now::date, l.plan_id,
           (l.paid and extract(isodow from l.local_now) = 7 and extract(hour from l.local_now) between 17 and 21)
      from local l
  )
  select w.user_id, w.kind, w.local_date, w.plan
    from wanted w
   where w.due
     and not exists (select 1 from public.briefs br where br.user_id = w.user_id and br.kind = w.kind and br.for_date = w.local_date)
   limit least(coalesce(p_limit, 25), 100);
$$;
revoke all on function public.due_briefs(integer) from public, anon, authenticated;
grant execute on function public.due_briefs(integer) to service_role;

-- Clients, follow-ups, reminders, invoices and health, for chat and briefs.
create or replace function public.tali_work_context(p_user_id uuid)
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object(
    'clients', coalesce((select jsonb_agg(jsonb_build_object('name', c.name, 'kind', c.kind, 'status', c.status,
                  'next_follow_up', c.next_follow_up, 'last_contact', c.last_contact_at, 'notes', left(c.notes, 300)) order by c.next_follow_up nulls last, c.updated_at desc)
                  from (select * from public.clients where user_id = p_user_id and status not in ('lost', 'past') order by updated_at desc limit 40) c), '[]'::jsonb),
    'follow_ups_due', coalesce((select jsonb_agg(jsonb_build_object('name', c.name, 'due', c.next_follow_up))
                  from public.clients c where c.user_id = p_user_id and c.next_follow_up is not null
                   and c.next_follow_up <= (now() at time zone coalesce((select timezone from public.profiles where id = p_user_id), 'Australia/Sydney'))::date + 1), '[]'::jsonb),
    'reminders', coalesce((select jsonb_agg(jsonb_build_object('text', r.text, 'due_at', r.due_at) order by r.due_at)
                  from public.reminders r where r.user_id = p_user_id and r.done_at is null and r.due_at < now() + interval '7 days'), '[]'::jsonb),
    'invoices_open', coalesce((select jsonb_agg(jsonb_build_object('number', i.number, 'client', i.client_name, 'total', i.total, 'status', i.status, 'due', i.due_date) order by i.due_date)
                  from public.invoices i where i.user_id = p_user_id and i.status in ('draft', 'sent')), '[]'::jsonb),
    'health', public.business_health(p_user_id)
  );
$$;
revoke all on function public.tali_work_context(uuid) from public, anon, authenticated;
grant execute on function public.tali_work_context(uuid) to service_role;

-- Tali drafts an invoice when asked (status draft; the user reviews and sends it themselves).
create or replace function public.tali_draft_invoice(p_user_id uuid, p_client_name text, p_items jsonb, p_due_days integer default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_client uuid; s record;
begin
  select id into v_client from public.clients where user_id = p_user_id and lower(name) = lower(trim(p_client_name)) limit 1;
  select gst_registered, default_due_days into s from public.invoice_settings where user_id = p_user_id;
  insert into public.invoices(user_id, client_id, client_name, items, gst, due_date, notes, created_by)
  values (p_user_id, v_client, trim(p_client_name), coalesce(p_items, '[]'::jsonb), coalesce(s.gst_registered, false),
          current_date + coalesce(p_due_days, s.default_due_days, 7), coalesce(p_notes, ''), 'tali')
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.tali_draft_invoice(uuid, text, jsonb, integer, text) from public, anon, authenticated;
grant execute on function public.tali_draft_invoice(uuid, text, jsonb, integer, text) to service_role;
