-- Tali HQ project migration 002: the app side (Phase 1 foundation).
-- Every user table is private to its owner (RLS on auth.uid()). Billing, usage and job
-- rows are written by the server (service role) only; users can read their own.

-- Plans (public price list). Prices are the AUD proposals from the Tali HQ plans mockup.
create table public.plans (
  id text primary key check (id in ('free','hq','pro')),
  name text not null,
  monthly_price_aud numeric(8,2) not null,
  yearly_price_aud numeric(8,2),
  credits_month integer not null,
  messages_month integer,
  features jsonb not null default '[]',
  sort smallint not null default 0
);
alter table public.plans enable row level security;
create policy "plans are public" on public.plans for select to anon, authenticated using (true);
insert into public.plans (id, name, monthly_price_aud, yearly_price_aud, credits_month, messages_month, features, sort) values
  ('free', 'Free', 0, 0, 0, 50, '["Chat with Tali, 50 messages a month","Food, training and journal","Friday check-in"]', 1),
  ('hq', 'Tali HQ', 19.99, null, 1000, null, '["Morning brief and 12-hourly health checks","Clients, leads and invoices","Drafts replies and follow-ups for your yes","Night school, web search and her weekly journal","1,000 Tali credits a month"]', 2),
  ('pro', 'Tali HQ Pro', 39.99, null, 3000, null, '["Everything in Tali HQ, 3,000 credits a month","Talk to Tali in her own voice","Your own Tali email address for enquiries","Automatic actions inside rules you set"]', 3);

-- Profiles: one per user, made by the sign-up trigger.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  business_name text,
  business_type text,
  about_me text,
  timezone text not null default 'Australia/Sydney',
  brief_time time not null default '07:00',
  brief_push boolean not null default true,
  brief_email boolean not null default true,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "own profile update" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Subscriptions: server-written (Stripe webhook), user can read their own.
create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null default 'free' references public.plans(id),
  status text not null default 'active' check (status in ('active','trialing','past_due','canceled','incomplete')),
  founding_member boolean not null default false,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "own subscription read" on public.subscriptions for select to authenticated using (user_id = (select auth.uid()));

-- Usage: one row per AI call, server-written.
create table public.usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  credits integer not null default 1 check (credits >= 0),
  model text,
  tokens_in integer,
  tokens_out integer,
  created_at timestamptz not null default now()
);
create index usage_user_created_idx on public.usage (user_id, created_at desc);
alter table public.usage enable row level security;
create policy "own usage read" on public.usage for select to authenticated using (user_id = (select auth.uid()));

-- Journal and notepad: the user's own writing, which Tali learns from.
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind text not null default 'journal' check (kind in ('journal','note')),
  title text,
  body text not null default '' check (length(body) <= 20000),
  mood smallint check (mood between 1 and 5),
  tags text[] not null default '{}',
  pinned boolean not null default false,
  private_to_tali boolean not null default false,
  learned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.journal_entries.private_to_tali is 'When true, Tali never reads or learns from this entry.';
create index journal_user_created_idx on public.journal_entries (user_id, created_at desc);
alter table public.journal_entries enable row level security;
create policy "own journal all" on public.journal_entries for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Chat with Tali.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_user_idx on public.conversations (user_id, updated_at desc);
alter table public.conversations enable row level security;
create policy "own conversations all" on public.conversations for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  role text not null check (role in ('user','assistant','tool')),
  content text not null default '',
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index messages_conv_created_idx on public.messages (conversation_id, created_at);
create index messages_user_idx on public.messages (user_id);
alter table public.messages enable row level security;
create policy "own messages read" on public.messages for select to authenticated using (user_id = (select auth.uid()));
create policy "own user messages insert" on public.messages for insert to authenticated
  with check (user_id = (select auth.uid()) and role = 'user'
              and exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = (select auth.uid())));

-- Briefs: morning brief, health checks, weekly check-in. Server-written.
create table public.briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('morning','health','weekly','journal')),
  for_date date not null default current_date,
  title text,
  content jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, kind, for_date)
);
alter table public.briefs enable row level security;
create policy "own briefs read" on public.briefs for select to authenticated using (user_id = (select auth.uid()));
create policy "own briefs mark read" on public.briefs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Approvals: everything Tali wants to send, spend or change waits here for a yes.
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('message','follow_up','invoice','booking','rule','other')),
  title text not null,
  draft jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending','approved','rejected','done','expired')),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index approvals_user_status_idx on public.approvals (user_id, status, created_at desc);
alter table public.approvals enable row level security;
create policy "own approvals read" on public.approvals for select to authenticated using (user_id = (select auth.uid()));

-- Job runs: Tali's scheduled work (briefs, health checks, night school, sleep).
create table public.job_runs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  job text not null,
  status text not null default 'running' check (status in ('running','ok','failed','skipped')),
  summary text,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index job_runs_user_idx on public.job_runs (user_id, started_at desc);
alter table public.job_runs enable row level security;
create policy "own job runs read" on public.job_runs for select to authenticated using (user_id = (select auth.uid()));

-- updated_at stamps
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger journal_touch before update on public.journal_entries for each row execute function public.touch_updated_at();
create trigger conversations_touch before update on public.conversations for each row execute function public.touch_updated_at();
create trigger subscriptions_touch before update on public.subscriptions for each row execute function public.touch_updated_at();

-- Users may only change their own profile fields, never ids or timestamps they don't own.
revoke update on public.profiles from authenticated;
grant update (first_name, business_name, business_type, about_me, timezone, brief_time, brief_push, brief_email, onboarded_at) on public.profiles to authenticated;
revoke update on public.briefs from authenticated;
grant update (read_at) on public.briefs to authenticated;

-- Sign-up: make the profile and a Free subscription with a 14 day Tali HQ trial.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, first_name)
  values (new.id, nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), ''))
  on conflict (id) do nothing;
  insert into public.subscriptions (user_id, plan_id, status, trial_ends_at)
  values (new.id, 'hq', 'trialing', now() + interval '14 days')
  on conflict (user_id) do nothing;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Credits used this calendar month (in the user's timezone).
create or replace function public.my_credits() returns jsonb
language sql stable security invoker set search_path = '' as $$
  with s as (
    select s.plan_id, s.status, s.trial_ends_at, p.credits_month, p.messages_month, coalesce(pr.timezone,'Australia/Sydney') tz
      from public.subscriptions s join public.plans p on p.id = s.plan_id
      left join public.profiles pr on pr.id = s.user_id
     where s.user_id = (select auth.uid())
  )
  select jsonb_build_object(
    'plan', s.plan_id, 'status', s.status, 'trialEndsAt', s.trial_ends_at,
    'creditsMonth', s.credits_month, 'messagesMonth', s.messages_month,
    'used', coalesce((select sum(u.credits) from public.usage u
                       where u.user_id = (select auth.uid())
                         and u.created_at >= (date_trunc('month', now() at time zone s.tz) at time zone s.tz)), 0))
  from s;
$$;
revoke all on function public.my_credits() from public, anon;
grant execute on function public.my_credits() to authenticated;

-- "What Tali knows about me": read and delete your own private memories.
create or replace function public.my_memories(p_limit integer default 200)
returns table(id uuid, kind text, content text, about text[], source text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.id, m.kind, m.content, m.about, m.source, m.created_at
    from brain.memories m
   where m.user_id = (select auth.uid()) and m.status = 'active'
   order by m.created_at desc
   limit least(coalesce(p_limit,200), 1000);
$$;
create or replace function public.forget_memory(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  delete from brain.memories where id = p_id and user_id = (select auth.uid());
  return found;
end $$;
revoke all on function public.my_memories(integer) from public, anon;
revoke all on function public.forget_memory(uuid) from public, anon;
grant execute on function public.my_memories(integer) to authenticated;
grant execute on function public.forget_memory(uuid) to authenticated;
