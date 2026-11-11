-- 12 Nov 2026 (Taj): the business side, stage 2. Jobs and quotes, and a pipeline.
-- A quote becomes a job, and a job becomes an invoice. Totals always come from the line items and
-- quote numbers from the person's own sequence, the same way invoices work.

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null default '' check (length(client_name) <= 120),
  client_email text,
  title text not null check (length(trim(title)) between 1 and 160),
  address text not null default '' check (length(address) <= 300),
  number text,
  -- quote: being written. sent: with the customer. accepted: they said yes. on: the work is under way.
  -- done: finished, not invoiced. invoiced: an invoice exists for it. lost: they said no.
  status text not null default 'quote' check (status in ('quote', 'sent', 'accepted', 'on', 'done', 'invoiced', 'lost')),
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array'),
  gst boolean not null default false,
  subtotal numeric(12,2) not null default 0,
  gst_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  valid_days integer not null default 30 check (valid_days between 1 and 365),
  notes text not null default '' check (length(notes) <= 2000),
  sent_at timestamptz,
  accepted_at timestamptz,
  done_at timestamptz,
  invoice_id uuid references public.invoices(id) on delete set null,
  created_by text not null default 'user' check (created_by in ('user', 'tali')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jobs_user_status_idx on public.jobs (user_id, status, updated_at desc);
create index if not exists jobs_client_idx on public.jobs (client_id);
alter table public.jobs enable row level security;
drop policy if exists "own jobs all" on public.jobs;
create policy "own jobs all" on public.jobs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop trigger if exists jobs_touch on public.jobs;
create trigger jobs_touch before update on public.jobs for each row execute function public.touch_updated_at();

create or replace function public.jobs_prepare() returns trigger
language plpgsql security definer set search_path = '' as $$
declare sub numeric(12,2); n integer;
begin
  select coalesce(sum(round(coalesce((i->>'qty')::numeric, 1) * coalesce((i->>'unit_price')::numeric, 0), 2)), 0)
    into sub from jsonb_array_elements(new.items) i;
  new.subtotal := sub;
  new.gst_amount := case when new.gst then round(sub * 0.10, 2) else 0 end;
  new.total := new.subtotal + new.gst_amount;
  if new.number is null or trim(new.number) = '' then
    select count(*) + 1 into n from public.jobs j where j.user_id = new.user_id;
    new.number := 'Q-' || lpad(n::text, 4, '0');
  end if;
  if new.status = 'sent' and new.sent_at is null then new.sent_at := now(); end if;
  if new.status in ('accepted', 'on') and new.accepted_at is null then new.accepted_at := now(); end if;
  if new.status in ('done', 'invoiced') and new.done_at is null then new.done_at := now(); end if;
  return new;
end $$;
revoke all on function public.jobs_prepare() from public, anon, authenticated;
drop trigger if exists jobs_prepare on public.jobs;
create trigger jobs_prepare before insert or update on public.jobs for each row execute function public.jobs_prepare();

-- The pipeline: what a lead could be worth, so the stages can be added up.
alter table public.clients add column if not exists est_value numeric(12,2) check (est_value is null or est_value >= 0);
