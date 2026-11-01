-- Tali HQ 018: businesses connect their own Stripe (Standard, OAuth) so Tali can send
-- invoices through it on their yes, and mark them paid when the client pays.

-- One connected Stripe account per user. Written by the stripe-invoices function only.
create table if not exists public.stripe_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_id text not null,
  business_name text,
  livemode boolean not null default true,
  connected_at timestamptz not null default now()
);
alter table public.stripe_connections enable row level security;
create policy "own stripe connection read" on public.stripe_connections for select to authenticated
  using (user_id = (select auth.uid()));

-- Short-lived OAuth state, so the callback knows which user is connecting. Server only.
create table if not exists public.stripe_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.stripe_oauth_states enable row level security;

-- Stripe details on each invoice sent through Stripe.
alter table public.invoices add column if not exists stripe_invoice_id text;
alter table public.invoices add column if not exists stripe_url text;
alter table public.invoices add column if not exists paid_via text check (paid_via is null or paid_via in ('stripe', 'manual'));
create index if not exists invoices_stripe_open_idx on public.invoices (stripe_invoice_id) where stripe_invoice_id is not null and status = 'sent';

-- Tali's invoice drafts pick up the client's email from their list, and when the business has
-- Stripe connected the draft also lands on Today with a Send button (an approval, so nothing
-- goes out without their tap).
create or replace function public.tali_draft_invoice(p_user_id uuid, p_client_name text, p_items jsonb, p_due_days integer default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_client uuid; v_email text; s record; v_total numeric; v_number text;
begin
  select id, email into v_client, v_email from public.clients where user_id = p_user_id and lower(name) = lower(trim(p_client_name)) limit 1;
  select gst_registered, default_due_days into s from public.invoice_settings where user_id = p_user_id;
  insert into public.invoices(user_id, client_id, client_name, client_email, items, gst, due_date, notes, created_by)
  values (p_user_id, v_client, trim(p_client_name), v_email, coalesce(p_items, '[]'::jsonb), coalesce(s.gst_registered, false),
          current_date + coalesce(p_due_days, s.default_due_days, 7), coalesce(p_notes, ''), 'tali')
  returning id, total, number into v_id, v_total, v_number;
  if exists (select 1 from public.stripe_connections where user_id = p_user_id) then
    insert into public.approvals(user_id, kind, title, draft)
    values (p_user_id, 'invoice', v_number || ' for ' || trim(p_client_name) || ', A$' || to_char(v_total, 'FM999,990.00'),
            jsonb_build_object('action', 'stripe_send', 'invoice_id', v_id, 'to', trim(p_client_name), 'email', v_email,
              'body', 'Ready to send through your Stripe. ' || case when v_email is null then 'Add ' || trim(p_client_name) || '''s email on the invoice first.' else 'Stripe emails it to ' || v_email || ' with a pay by card link.' end));
  end if;
  return v_id;
end $$;
revoke all on function public.tali_draft_invoice(uuid, text, jsonb, integer, text) from public, anon, authenticated;
grant execute on function public.tali_draft_invoice(uuid, text, jsonb, integer, text) to service_role;

-- Every 15 minutes, check open Stripe invoices for payment (only when there are any).
select cron.schedule('tali-stripe-invoices', '*/15 * * * *', $cron$
  select net.http_post(
    url := 'https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/stripe-invoices',
    headers := jsonb_build_object('Content-Type','application/json','x-tali-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'tali_brain_key')),
    body := '{"action":"sync"}'::jsonb,
    timeout_milliseconds := 60000)
  where exists (select 1 from public.invoices where stripe_invoice_id is not null and status = 'sent');
$cron$);

-- Where to send them back after connecting (checked against APP_URLS).
alter table public.stripe_oauth_states add column if not exists return_to text;
