-- 27 Nov 2026 (Taj): Pay as you go for the Tali Brain licence, replacing the Starter plan.
-- Licensees buy answer credits up front (1,000, 5,000 or 20,000) with no monthly fee. Up to 10
-- businesses. Remembering costs 1 credit for every 5 learning calls, so nobody stores data for free.
-- Credits last 12 months from the last top up. A licensee on a monthly plan who has credits left uses
-- them before extra answers are billed.

-- The credits ledger. Packs add credits; 'overage' rows use credits against answers over a plan;
-- 'adjust' rows clear credits that ran out. ref makes each row once only (a Stripe Checkout session id).
create table if not exists public.licence_credits (
  id uuid primary key default gen_random_uuid(),
  licensee_id uuid not null references public.licensees(id) on delete cascade,
  credits integer not null,
  kind text not null check (kind in ('pack', 'overage', 'adjust')),
  pack text,
  amount_aud numeric(10, 2),
  ref text unique,
  created_at timestamptz not null default now()
);
create index if not exists licence_credits_licensee_idx on public.licence_credits (licensee_id, created_at desc);
alter table public.licence_credits enable row level security;
revoke all on public.licence_credits from anon, authenticated;

-- Answers given while on Pay as you go are paid from credits.
alter table public.licence_answers add column if not exists payg boolean not null default false;

alter table public.licensees drop constraint if exists licensees_plan_check;
alter table public.licensees add constraint licensees_plan_check check (plan in ('starter', 'pilot', 'growth', 'platform', 'payg'));

-- What a licensee has left. raw_balance ignores expiry; balance is 0 once credits have run out.
create or replace function public.licence_credit_balance(p_licensee uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with c as (
    select coalesce(sum(credits), 0) as net,
           coalesce(sum(credits) filter (where kind = 'pack'), 0) as bought,
           max(created_at) filter (where kind = 'pack') as last_pack
      from public.licence_credits where licensee_id = p_licensee),
  s as (
    select coalesce(sum(answers) filter (where kind <> 'learn'), 0) as answered,
           count(*) filter (where kind = 'learn') as learned
      from public.licence_answers where licensee_id = p_licensee and payg and mode = 'live'),
  r as (select c.*, s.*, (c.net - s.answered - ceil(s.learned / 5.0))::bigint as raw from c, s)
  select jsonb_build_object(
    'bought', bought, 'used', answered + ceil(learned / 5.0)::bigint, 'raw_balance', raw,
    'expired', last_pack is not null and last_pack < now() - interval '12 months',
    'balance', case when last_pack is null or last_pack < now() - interval '12 months' then 0 else greatest(raw, 0) end,
    'last_top_up', last_pack, 'expires_at', last_pack + interval '12 months', 'ever', last_pack is not null)
  from r;
$$;
revoke all on function public.licence_credit_balance(uuid) from public, anon, authenticated;

-- Founder card: add credit sales and balances.
create or replace function public.licence_founder_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me constant uuid := 'e89ca9de-a86e-4dd6-8094-bc518566352e';
begin
  if auth.uid() is distinct from me then raise exception 'not allowed'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'name', l.name, 'country', l.country, 'plan', l.plan, 'status', l.status, 'created_at', l.created_at,
      'businesses', (select count(*) from public.licence_businesses b where b.licensee_id = l.id and b.mode = 'live'),
      'answers', public.licence_answers_used(l.id, 'live', coalesce(l.period_start, date_trunc('month', now()))),
      'test_answers', public.licence_answers_used(l.id, 'test', date_trunc('month', now())),
      'credits_left', (public.licence_credit_balance(l.id) ->> 'balance')::bigint,
      'credits_aud_30d', (select coalesce(sum(amount_aud), 0) from public.licence_credits k where k.licensee_id = l.id and k.kind = 'pack' and k.created_at > now() - interval '30 days')
    ) order by l.created_at desc), '[]'::jsonb) from public.licensees l);
end $$;
revoke all on function public.licence_founder_stats() from public, anon;
grant execute on function public.licence_founder_stats() to authenticated;
