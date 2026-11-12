-- 12 Nov 2026 (Taj: "Build it all"): more than one business on one account.
--
-- The business an account already has stays exactly as it is: it is the main business, it has
-- no row here, and everything that belongs to it keeps business_id null. Nothing that exists
-- today is touched or moved. Each EXTRA business gets a row in public.businesses, and jobs,
-- invoices, bookings, projects and receipts made while it is the one in use carry its id.
--
-- Which business is in use is kept on the profile (set_current_business). New rows pick it up
-- by themselves through a column default, so every screen that saves a job or an invoice keeps
-- working unchanged. Rows made by the server with no person signed in land in the main business.
--
-- Customers are one list for the whole account, with one set of notes. clients.business_tags
-- says which businesses a customer belongs to ('main' or a business id). No tags means the
-- main business, which is every customer that exists today.
--
-- An extra business keeps its own invoice numbers, and its own ABN and payment details when
-- they are filled in. Removing a business moves its work back to the main business (the
-- business_id columns go back to null), nothing is lost.
--
-- Adding and removing a business goes through the business-admin function because it bills.

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  about text not null default '',
  colour text not null default '#7FE0B0' check (colour ~ '^#[0-9A-Fa-f]{6}$'),
  -- Its own details for invoices. Empty means "the same as the main business".
  abn text,
  payment_details text,
  next_number integer not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists businesses_user_idx on public.businesses (user_id);
alter table public.businesses enable row level security;
revoke all on public.businesses from anon, authenticated;
grant select on public.businesses to authenticated;
grant update (name, about, colour, abn, payment_details) on public.businesses to authenticated;
create policy "businesses: own read" on public.businesses for select to authenticated using (user_id = (select auth.uid()));
create policy "businesses: own update" on public.businesses for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table public.profiles
  add column if not exists current_business_id uuid references public.businesses(id) on delete set null;

-- The business the signed-in person is working in (null is the main business).
create or replace function public.my_current_business()
returns uuid language sql stable security definer set search_path to '' as $function$
  select p.current_business_id from public.profiles p where p.id = (select auth.uid());
$function$;
create or replace function public.my_current_business_tags()
returns text[] language sql stable security definer set search_path to '' as $function$
  select case when public.my_current_business() is null then '{}'::text[] else array[public.my_current_business()::text] end;
$function$;

create or replace function public.set_current_business(p_business uuid)
returns boolean language plpgsql security definer set search_path to '' as $function$
begin
  if p_business is not null and not exists (select 1 from public.businesses b where b.id = p_business and b.user_id = (select auth.uid())) then
    return false;
  end if;
  update public.profiles set current_business_id = p_business where id = (select auth.uid());
  return found;
end;
$function$;
revoke all on function public.set_current_business(uuid) from public, anon;
grant execute on function public.set_current_business(uuid) to authenticated;
grant execute on function public.my_current_business() to authenticated;
grant execute on function public.my_current_business_tags() to authenticated;

-- The column goes on first with no default, so existing rows stay null (the main business)
-- without the table being rewritten. Then new rows get the business in use.
alter table public.jobs add column if not exists business_id uuid references public.businesses(id) on delete set null;
alter table public.invoices add column if not exists business_id uuid references public.businesses(id) on delete set null;
alter table public.bookings add column if not exists business_id uuid references public.businesses(id) on delete set null;
alter table public.projects add column if not exists business_id uuid references public.businesses(id) on delete set null;
alter table public.receipts add column if not exists business_id uuid references public.businesses(id) on delete set null;
alter table public.jobs alter column business_id set default public.my_current_business();
alter table public.invoices alter column business_id set default public.my_current_business();
alter table public.bookings alter column business_id set default public.my_current_business();
alter table public.projects alter column business_id set default public.my_current_business();
alter table public.receipts alter column business_id set default public.my_current_business();

alter table public.clients add column if not exists business_tags text[] not null default '{}';
alter table public.clients alter column business_tags set default public.my_current_business_tags();

-- A person can only file something under a business that is theirs.
create or replace function public.business_id_guard()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if new.business_id is not null and not exists (select 1 from public.businesses b where b.id = new.business_id and b.user_id = new.user_id) then
    new.business_id := null;
  end if;
  return new;
end;
$function$;
create or replace trigger jobs_business_guard before insert or update of business_id on public.jobs for each row execute function public.business_id_guard();
create or replace trigger invoices_business_guard before insert or update of business_id on public.invoices for each row execute function public.business_id_guard();
create or replace trigger bookings_business_guard before insert or update of business_id on public.bookings for each row execute function public.business_id_guard();
create or replace trigger projects_business_guard before insert or update of business_id on public.projects for each row execute function public.business_id_guard();
create or replace trigger receipts_business_guard before insert or update of business_id on public.receipts for each row execute function public.business_id_guard();

-- Invoice numbers: an extra business counts its own. The main business is unchanged.
create or replace function public.invoices_prepare()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare sub numeric(12,2); n integer;
begin
  select coalesce(sum(round(coalesce((i->>'qty')::numeric, 1) * coalesce((i->>'unit_price')::numeric, 0), 2)), 0)
    into sub from jsonb_array_elements(new.items) i;
  new.subtotal := sub;
  new.gst_amount := case when new.gst then round(sub * 0.10, 2) else 0 end;
  new.total := new.subtotal + new.gst_amount;
  if new.number is null or trim(new.number) = '' then
    if new.business_id is not null then
      update public.businesses set next_number = next_number + 1
       where id = new.business_id and user_id = new.user_id returning next_number - 1 into n;
    end if;
    if n is null then
      insert into public.invoice_settings(user_id) values (new.user_id) on conflict (user_id) do nothing;
      update public.invoice_settings set next_number = next_number + 1 where user_id = new.user_id returning next_number - 1 into n;
    end if;
    new.number := 'INV-' || lpad(n::text, 4, '0');
  end if;
  if new.status = 'sent' and new.sent_at is null then new.sent_at := now(); end if;
  if new.status = 'paid' and new.paid_at is null then new.paid_at := now(); end if;
  return new;
end $function$;

-- Team seats: someone invited who already has a Tali HQ login joins straight away
-- (business-admin calls this right after the invite is saved).
create or replace function public.team_link_existing(p_id uuid)
returns boolean language plpgsql security definer set search_path to '' as $function$
begin
  update public.team_members t
     set member_id = u.id, status = 'active', joined_at = now()
    from auth.users u
   where t.id = p_id and t.member_id is null and lower(u.email) = t.email
     and u.email_confirmed_at is not null and u.id <> t.owner_id;
  return found;
end;
$function$;
revoke all on function public.team_link_existing(uuid) from public, anon, authenticated;
