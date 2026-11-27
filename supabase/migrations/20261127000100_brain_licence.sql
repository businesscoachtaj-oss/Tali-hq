-- 27 Nov 2026 (Taj): the Tali Brain licence. Software companies (licensees) put Tali's brain inside
-- their own product. Every business on their platform gets its own private brain: short facts about
-- the business and each of its clients, learned from what the licensee's software sends.
-- Everything here is server only (RLS on, no policies). The brain-api edge function is the only way in:
-- API keys for the licensee's servers, a sign in for the console, short lived tokens for the panel.
-- Nothing in these tables is ever mixed with Tali HQ users' own brains (schema brain) or with Totality.

create table if not exists public.licensees (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid unique references auth.users(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  country text not null default 'AU' check (char_length(country) = 2),
  plan text check (plan in ('starter', 'pilot', 'growth', 'platform')),
  status text not null default 'sandbox' check (status in ('sandbox', 'active', 'past_due', 'cancelled')),
  stripe_customer_id text,
  stripe_subscription_id text,
  period_start timestamptz,
  period_end timestamptz,
  settings jsonb not null default '{}'::jsonb,
  setup_paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.licence_keys (
  id uuid primary key default gen_random_uuid(),
  licensee_id uuid not null references public.licensees(id) on delete cascade,
  name text not null default 'Key',
  mode text not null check (mode in ('live', 'test')),
  key_hash text not null unique,
  last4 text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists licence_keys_licensee_idx on public.licence_keys (licensee_id);

-- One row per business on the licensee's platform. external_id is the licensee's own id for it.
create table if not exists public.licence_businesses (
  id uuid primary key default gen_random_uuid(),
  licensee_id uuid not null references public.licensees(id) on delete cascade,
  mode text not null check (mode in ('live', 'test')),
  external_id text not null check (char_length(external_id) between 1 and 120),
  name text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (licensee_id, mode, external_id)
);

create table if not exists public.licence_clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.licence_businesses(id) on delete cascade,
  external_id text not null check (char_length(external_id) between 1 and 120),
  name text,
  created_at timestamptz not null default now(),
  unique (business_id, external_id)
);

-- The brain. client_id null means a fact about the business itself (prices, hours, how they work).
-- status 'suggested' is something Tali noticed that a person has not said yes to yet.
create table if not exists public.licence_memories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.licence_businesses(id) on delete cascade,
  client_id uuid references public.licence_clients(id) on delete cascade,
  kind text not null default 'other',
  fact text not null check (char_length(btrim(fact)) between 1 and 400),
  source text not null default 'api',
  source_date date,
  status text not null default 'kept' check (status in ('kept', 'suggested')),
  until date,
  created_at timestamptz not null default now(),
  fts tsvector generated always as (to_tsvector('english', fact)) stored
);
create index if not exists licence_memories_lookup_idx on public.licence_memories (business_id, client_id, status);
create index if not exists licence_memories_fts_idx on public.licence_memories using gin (fts);

-- What the licensee's software told Tali happened (a note, a message, a booking, a call).
create table if not exists public.licence_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.licence_businesses(id) on delete cascade,
  client_id uuid references public.licence_clients(id) on delete cascade,
  external_id text,
  type text not null default 'note',
  direction text not null default 'internal' check (direction in ('in', 'out', 'internal')),
  body text not null check (char_length(body) <= 20000),
  happened_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists licence_events_external_idx on public.licence_events (business_id, external_id) where external_id is not null;
create index if not exists licence_events_client_idx on public.licence_events (business_id, client_id, happened_at desc);

-- Every answer Tali gave. This is also the usage record: answers is how many it counted for.
create table if not exists public.licence_answers (
  id uuid primary key default gen_random_uuid(),
  licensee_id uuid not null references public.licensees(id) on delete cascade,
  business_id uuid references public.licence_businesses(id) on delete set null,
  client_id uuid references public.licence_clients(id) on delete set null,
  mode text not null check (mode in ('live', 'test')),
  kind text not null,
  answers integer not null default 1 check (answers >= 0),
  output jsonb,
  outcome text check (outcome in ('approved', 'edited', 'rejected')),
  model text,
  tokens_in integer,
  tokens_out integer,
  created_at timestamptz not null default now()
);
create index if not exists licence_answers_usage_idx on public.licence_answers (licensee_id, mode, created_at desc);
create index if not exists licence_answers_business_idx on public.licence_answers (business_id, created_at desc);

alter table public.licensees enable row level security;
alter table public.licence_keys enable row level security;
alter table public.licence_businesses enable row level security;
alter table public.licence_clients enable row level security;
alter table public.licence_memories enable row level security;
alter table public.licence_events enable row level security;
alter table public.licence_answers enable row level security;
revoke all on public.licensees, public.licence_keys, public.licence_businesses, public.licence_clients,
  public.licence_memories, public.licence_events, public.licence_answers from anon, authenticated;

-- Answers used since a point in time (the start of the billing period).
create or replace function public.licence_answers_used(p_licensee uuid, p_mode text, p_from timestamptz)
returns bigint language sql stable security definer set search_path = '' as $$
  select coalesce(sum(answers), 0) from public.licence_answers
   where licensee_id = p_licensee and mode = p_mode and created_at >= p_from;
$$;

-- The numbers behind the console.
create or replace function public.licence_stats(p_licensee uuid, p_mode text, p_from timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  with b as (select id, name, external_id from public.licence_businesses where licensee_id = p_licensee and mode = p_mode),
  a as (select * from public.licence_answers where licensee_id = p_licensee and mode = p_mode and created_at >= p_from),
  d as (select * from public.licence_answers where licensee_id = p_licensee and mode = p_mode and created_at >= now() - interval '30 days')
  select jsonb_build_object(
    'businesses', (select count(*) from b),
    'clients', (select count(*) from public.licence_clients c where c.business_id in (select id from b)),
    'memories', (select count(*) from public.licence_memories m where m.business_id in (select id from b) and m.status = 'kept'),
    'answers', (select coalesce(sum(answers), 0) from a),
    'decided', (select count(*) from a where outcome is not null),
    'approved', (select count(*) from a where outcome in ('approved', 'edited')),
    'by_kind', (select coalesce(jsonb_object_agg(kind, n), '{}'::jsonb) from (select kind, sum(answers) n from a group by kind) k),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'answers', n) order by day), '[]'::jsonb) from (
      select g::date as day, coalesce((select sum(answers) from d where (d.created_at at time zone 'Australia/Sydney')::date = g::date), 0) n
        from generate_series((now() at time zone 'Australia/Sydney')::date - 29, (now() at time zone 'Australia/Sydney')::date, interval '1 day') g) s),
    'top', (select coalesce(jsonb_agg(t order by (t->>'answers')::int desc), '[]'::jsonb) from (
      select jsonb_build_object('name', coalesce(b.name, b.external_id), 'answers', sum(a.answers),
        'decided', count(*) filter (where a.outcome is not null), 'approved', count(*) filter (where a.outcome in ('approved', 'edited'))) t
        from a join b on b.id = a.business_id group by b.id, b.name, b.external_id order by sum(a.answers) desc limit 5) x)
  );
$$;

-- Founder only: every licence at a glance (Tali HQ, Me, Founder).
create or replace function public.licence_founder_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me constant uuid := 'e89ca9de-a86e-4dd6-8094-bc518566352e';
begin
  if auth.uid() is distinct from me then raise exception 'not allowed'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'name', l.name, 'country', l.country, 'plan', l.plan, 'status', l.status, 'created_at', l.created_at,
      'businesses', (select count(*) from public.licence_businesses b where b.licensee_id = l.id and b.mode = 'live'),
      'answers', public.licence_answers_used(l.id, 'live', coalesce(l.period_start, date_trunc('month', now()))),
      'test_answers', public.licence_answers_used(l.id, 'test', date_trunc('month', now()))
    ) order by l.created_at desc), '[]'::jsonb) from public.licensees l);
end $$;

revoke all on function public.licence_answers_used(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.licence_stats(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.licence_founder_stats() from public, anon;
grant execute on function public.licence_founder_stats() to authenticated;

-- Once a day: check each licence against Stripe and bill answers over the plan for the period that ended.
do $$ begin
  if exists (select 1 from cron.job where jobname = 'licence-daily') then perform cron.unschedule('licence-daily'); end if;
end $$;
select cron.schedule('licence-daily', '17 16 * * *', $cron$
  select net.http_post(
    url := 'https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/brain-api/internal/daily',
    headers := jsonb_build_object('Content-Type','application/json','x-tali-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'tali_brain_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000);
$cron$);

-- When a licence ends, its live brains are deleted 30 days later (licence terms, section 5).
do $$ begin
  if exists (select 1 from cron.job where jobname = 'licence-ended-tidy') then perform cron.unschedule('licence-ended-tidy'); end if;
end $$;
select cron.schedule('licence-ended-tidy', '41 16 * * *', $cron$
  delete from public.licence_businesses b using public.licensees l
   where b.licensee_id = l.id and b.mode = 'live' and l.status = 'cancelled'
     and l.period_end is not null and l.period_end < now() - interval '30 days';
$cron$);
