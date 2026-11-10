-- Gmail by forwarding (10 Nov 2026, asked for by Taj).
--
-- Reading Gmail directly (the gmail.readonly permission) needs a paid security assessment from
-- Google every year. Sending is a lighter permission. So mail now reaches Tali by the owner
-- switching on Gmail's own auto-forward to a Tali address, and replies still go out from their own
-- Gmail. Paid plans only, the same as inbox sorting today. A public address for enquiries stays Pro.
--
--   public.gmail_forwarding      where each person's set-up is up to: Gmail's confirmation code,
--                                then "working" once the first forwarded email arrives
--   has_paid(user)               any plan but Free, active, past due or in a live trial
--   my_gmail_forwarding()        for the guide on the Email screen. Gives a paid person an address
--                                the first time it is asked for
--   forwarding_code / forwarding_seen   service only, called by inbound-email
--   A trigger on inbound_emails  once forwarding works for someone, mail read the old way through
--                                Google is skipped for them, so nothing shows up twice
-- Additive. The old way keeps working for anyone who has not set up forwarding.

alter table public.inbound_emails add column if not exists message_id text;

create table if not exists public.gmail_forwarding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gmail text,
  code text,
  confirm_url text,
  state text not null default 'code' check (state in ('code', 'working')),
  code_at timestamptz,
  first_at timestamptz,
  last_at timestamptz
);
alter table public.gmail_forwarding enable row level security;
revoke all on table public.gmail_forwarding from anon, authenticated;

create or replace function public.has_paid(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.subscriptions s where s.user_id = p_user_id and s.plan_id <> 'free'
                  and (s.status in ('active', 'past_due') or (s.status = 'trialing' and s.trial_ends_at > now())));
$$;
revoke all on function public.has_paid(uuid) from public, anon, authenticated;
grant execute on function public.has_paid(uuid) to service_role;

-- Tali's addresses live on this domain (the INBOUND_DOMAIN secret of inbound-email).
create or replace function public.my_gmail_forwarding()
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); a text; f public.gmail_forwarding%rowtype;
begin
  if u is null or not public.has_paid(u) then return null; end if;
  select alias into a from public.tali_inboxes where user_id = u;
  if a is null then
    a := public.suggest_tali_alias();
    begin
      insert into public.tali_inboxes (user_id, alias) values (u, a);
    exception when unique_violation then
      select alias into a from public.tali_inboxes where user_id = u;
      if a is null then return null; end if;
    end;
  end if;
  select * into f from public.gmail_forwarding where user_id = u;
  return jsonb_build_object(
    'address', a || '@tali.totality360.com.au',
    'state', case when f.state = 'working' then 'working' when f.code is not null then 'code' else 'not_started' end,
    'code', case when f.state = 'code' then f.code end,
    'confirm_url', case when f.state = 'code' then f.confirm_url end,
    'gmail', f.gmail,
    'last_at', f.last_at);
end $$;
revoke all on function public.my_gmail_forwarding() from public, anon;
grant execute on function public.my_gmail_forwarding() to authenticated;

create or replace function public.forwarding_code(p_user_id uuid, p_gmail text, p_code text, p_confirm_url text)
returns void
language sql security definer set search_path = '' as $$
  insert into public.gmail_forwarding (user_id, gmail, code, confirm_url, state, code_at)
  values (p_user_id, lower(p_gmail), p_code, p_confirm_url, 'code', now())
  on conflict (user_id) do update
    set gmail = excluded.gmail, code = excluded.code, confirm_url = excluded.confirm_url, code_at = now(),
        state = case when public.gmail_forwarding.gmail is distinct from excluded.gmail then 'code' else public.gmail_forwarding.state end;
$$;

create or replace function public.forwarding_seen(p_user_id uuid, p_gmail text)
returns void
language sql security definer set search_path = '' as $$
  insert into public.gmail_forwarding (user_id, gmail, state, first_at, last_at)
  values (p_user_id, lower(p_gmail), 'working', now(), now())
  on conflict (user_id) do update
    set state = 'working', gmail = excluded.gmail, first_at = coalesce(public.gmail_forwarding.first_at, now()), last_at = now();
$$;

revoke all on function public.forwarding_code(uuid, text, text, text), public.forwarding_seen(uuid, text) from public, anon, authenticated;
grant execute on function public.forwarding_code(uuid, text, text, text), public.forwarding_seen(uuid, text) to service_role;

-- No doubles: once forwarding works for someone, a row the Google sync tries to add for them is
-- quietly skipped (the sync treats that as "already have it").
create or replace function public.inbound_skip_api_when_forwarding() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.source = 'gmail' and new.provider_id like 'gmail:%'
     and exists (select 1 from public.gmail_forwarding f where f.user_id = new.user_id and f.state = 'working') then
    return null;
  end if;
  return new;
end $$;
revoke all on function public.inbound_skip_api_when_forwarding() from public, anon, authenticated;
drop trigger if exists inbound_skip_api_when_forwarding on public.inbound_emails;
create trigger inbound_skip_api_when_forwarding before insert on public.inbound_emails
  for each row execute function public.inbound_skip_api_when_forwarding();
