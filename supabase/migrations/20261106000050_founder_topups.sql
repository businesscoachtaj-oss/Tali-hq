-- Tali HQ, 6 Nov 2026 (asked for by Taj): top ups count in the founder revenue numbers.
-- Dollars and packs sold this month (Sydney time) and all time, from public.topups. Founder only.
create or replace function public.founder_topups() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when (select auth.uid()) <> 'e89ca9de-a86e-4dd6-8094-bc518566352e'::uuid then null else
    jsonb_build_object(
      'month_aud', coalesce((select sum(t.amount_cents) from public.topups t
                              where t.created_at >= date_trunc('month', now() at time zone 'Australia/Sydney') at time zone 'Australia/Sydney'), 0) / 100.0,
      'month_count', (select count(*) from public.topups t
                       where t.created_at >= date_trunc('month', now() at time zone 'Australia/Sydney') at time zone 'Australia/Sydney'),
      'total_aud', coalesce((select sum(t.amount_cents) from public.topups t), 0) / 100.0,
      'total_count', (select count(*) from public.topups t))
  end;
$$;
revoke all on function public.founder_topups() from public, anon;
grant execute on function public.founder_topups() to authenticated;
