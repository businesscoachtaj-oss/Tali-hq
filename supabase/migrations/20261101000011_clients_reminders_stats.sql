-- Tali HQ 011: clients and leads, reminders, and the owner's app stats.

-- 1. Clients and leads: the user's own list. Tali reads it before chats and briefs,
--    and adds or updates rows only when the user asks her to in chat.
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (length(trim(name)) between 1 and 120),
  kind text not null default 'client' check (kind in ('client', 'lead')),
  status text not null default 'active' check (status in ('active', 'quiet', 'paused', 'new', 'talking', 'won', 'lost', 'past')),
  email text check (email is null or length(email) <= 200),
  phone text check (phone is null or length(phone) <= 40),
  notes text not null default '' check (length(notes) <= 4000),
  next_follow_up date,
  last_contact_at date,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clients_user_idx on public.clients (user_id, kind, status);
create index if not exists clients_follow_up_idx on public.clients (user_id, next_follow_up) where next_follow_up is not null;
alter table public.clients enable row level security;
create policy "own clients all" on public.clients for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger clients_touch before update on public.clients for each row execute function public.touch_updated_at();

-- 2. Reminders: "remind me Friday to chase Jordan". Shown on Today when due, pushed once.
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  text text not null check (length(trim(text)) between 1 and 300),
  due_at timestamptz not null,
  client_id uuid references public.clients(id) on delete set null,
  done_at timestamptz,
  notified_at timestamptz,
  created_by text not null default 'user' check (created_by in ('user', 'tali')),
  created_at timestamptz not null default now()
);
create index if not exists reminders_user_due_idx on public.reminders (user_id, due_at) where done_at is null;
create index if not exists reminders_client_idx on public.reminders (client_id);
alter table public.reminders enable row level security;
create policy "own reminders all" on public.reminders for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Push due reminders straight from the database (Expo push API through pg_net). Runs every 5 minutes.
create or replace function public.send_due_reminders() returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; n integer := 0; msgs jsonb;
begin
  for r in
    select rm.id, rm.user_id, rm.text
      from public.reminders rm
      join public.profiles p on p.id = rm.user_id
     where rm.done_at is null and rm.notified_at is null and rm.due_at <= now()
       and rm.due_at > now() - interval '1 day'
     order by rm.due_at
     limit 200
  loop
    select jsonb_agg(jsonb_build_object('to', t.token, 'title', 'Reminder from Tali', 'body', left(r.text, 160), 'sound', 'default', 'data', jsonb_build_object('url', '/')))
      into msgs from public.push_tokens t where t.user_id = r.user_id;
    if msgs is not null then
      perform net.http_post(url := 'https://exp.host/--/api/v2/push/send',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
        body := msgs);
    end if;
    update public.reminders set notified_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.send_due_reminders() from public, anon, authenticated;

select cron.schedule('tali-reminders', '*/5 * * * *', $cron$
  select public.send_due_reminders()
   where exists (select 1 from public.reminders where done_at is null and notified_at is null and due_at <= now());
$cron$);

-- 3. Server-side helpers for tali-chat: save a client or reminder Tali was asked to add.
create or replace function public.tali_save_client(p_user_id uuid, p_name text, p_kind text, p_status text, p_notes text, p_next_follow_up date, p_email text default null, p_phone text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select id into v_id from public.clients where user_id = p_user_id and lower(name) = lower(trim(p_name)) limit 1;
  if v_id is null then
    insert into public.clients(user_id, name, kind, status, notes, next_follow_up, email, phone, source)
    values (p_user_id, trim(p_name), coalesce(p_kind, 'client'),
            coalesce(p_status, case when p_kind = 'lead' then 'new' else 'active' end),
            coalesce(p_notes, ''), p_next_follow_up, p_email, p_phone, 'tali')
    returning id into v_id;
  else
    update public.clients set
      kind = coalesce(p_kind, kind),
      status = coalesce(p_status, status),
      notes = case when coalesce(p_notes, '') = '' then notes when notes = '' then p_notes else left(notes || E'\n' || p_notes, 4000) end,
      next_follow_up = coalesce(p_next_follow_up, next_follow_up),
      email = coalesce(p_email, email),
      phone = coalesce(p_phone, phone)
     where id = v_id;
  end if;
  return v_id;
end $$;

create or replace function public.tali_add_reminder(p_user_id uuid, p_text text, p_due_at timestamptz, p_client_name text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_client uuid;
begin
  if p_client_name is not null then
    select id into v_client from public.clients where user_id = p_user_id and lower(name) = lower(trim(p_client_name)) limit 1;
  end if;
  insert into public.reminders(user_id, text, due_at, client_id, created_by)
  values (p_user_id, trim(p_text), greatest(p_due_at, now()), v_client, 'tali')
  returning id into v_id;
  return v_id;
end $$;

-- What Tali sees about clients and reminders (added to tali_context and brief_context).
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
                  from public.reminders r where r.user_id = p_user_id and r.done_at is null and r.due_at < now() + interval '7 days'), '[]'::jsonb)
  );
$$;

revoke all on function public.tali_save_client(uuid, text, text, text, text, date, text, text) from public, anon, authenticated;
revoke all on function public.tali_add_reminder(uuid, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.tali_work_context(uuid) from public, anon, authenticated;
grant execute on function public.tali_save_client(uuid, text, text, text, text, date, text, text), public.tali_add_reminder(uuid, text, timestamptz, text),
  public.tali_work_context(uuid), public.send_due_reminders() to service_role;

-- 4. The owner's numbers for the Tali HQ dashboard (read by Taj's Supabase connector, never by app users).
create or replace function public.admin_stats() returns jsonb
language sql security definer set search_path = '' as $$
  select jsonb_build_object(
    'asOf', now(),
    'users', (select count(*) from auth.users),
    'onboarded', (select count(*) from public.profiles where onboarded_at is not null),
    'newUsers7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'plans', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (
               select case when status = 'trialing' and trial_ends_at > now() then 'trial'
                           when status = 'active' and plan_id in ('hq','pro') and stripe_subscription_id is not null then plan_id
                           else 'free' end as k, count(*) n
                 from public.subscriptions group by 1) x),
    'founding', (select count(*) from public.subscriptions where founding_member),
    'trialsEnding7d', (select count(*) from public.subscriptions where status = 'trialing' and trial_ends_at between now() and now() + interval '7 days'),
    'messages7d', (select count(*) from public.messages where role = 'user' and created_at > now() - interval '7 days'),
    'activeUsers7d', (select count(distinct user_id) from public.messages where role = 'user' and created_at > now() - interval '7 days'),
    'credits30d', (select coalesce(sum(credits), 0) from public.usage where created_at > now() - interval '30 days'),
    'tokensIn30d', (select coalesce(sum(tokens_in), 0) from public.usage where created_at > now() - interval '30 days'),
    'tokensOut30d', (select coalesce(sum(tokens_out), 0) from public.usage where created_at > now() - interval '30 days'),
    'byFeature30d', (select coalesce(jsonb_object_agg(feature, n), '{}'::jsonb) from (select feature, count(*) n from public.usage where created_at > now() - interval '30 days' group by feature) f),
    'briefs7d', (select count(*) from public.job_runs where job in ('morning_brief','weekly_checkin') and status = 'ok' and started_at > now() - interval '7 days'),
    'briefFailures7d', (select count(*) from public.job_runs where job in ('morning_brief','weekly_checkin') and status = 'failed' and started_at > now() - interval '7 days'),
    'journalEntries7d', (select count(*) from public.journal_entries where created_at > now() - interval '7 days'),
    'clients', (select count(*) from public.clients),
    'remindersOpen', (select count(*) from public.reminders where done_at is null),
    'draftsPending', (select count(*) from public.approvals where status = 'pending'),
    'memories', (select count(*) from brain.memories where status = 'active' and user_id is not null),
    'sharedMemories', (select count(*) from brain.memories where status = 'active' and user_id is null),
    'waitlistFounding', (select count(*) from public.founding_emails)
  );
$$;
revoke all on function public.admin_stats() from public, anon, authenticated;
