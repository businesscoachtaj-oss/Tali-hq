-- 037 (4 Nov 2026): every account for the Founder screen's Users page, like Super Admin in
-- Totality. Taj's user id only; anyone else gets an error. Read only.
create or replace function public.founder_users()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  me constant uuid := 'e89ca9de-a86e-4dd6-8094-bc518566352e';
  month_start timestamptz := date_trunc('month', now() at time zone 'Australia/Sydney') at time zone 'Australia/Sydney';
  out jsonb;
begin
  if auth.uid() is distinct from me then raise exception 'not allowed'; end if;
  select coalesce(jsonb_agg(row_to_json(t) order by t.created_at desc), '[]'::jsonb) into out from (
    select u.id, u.email, u.created_at, u.last_sign_in_at,
           p.first_name, p.business_name, p.business_type, p.about_me, p.timezone, p.onboarded_at,
           s.plan_id, s.status, s.trial_ends_at, s.founding_member,
           (s.stripe_subscription_id is not null) as paying_stripe, s.current_period_end,
           (select coalesce(sum(x.credits), 0) from public.usage x where x.user_id = u.id and x.created_at >= month_start) as credits_month,
           (select count(*) from public.messages x where x.user_id = u.id and x.role = 'user') as messages_total,
           (select max(x.created_at) from public.messages x where x.user_id = u.id and x.role = 'user') as last_message_at,
           (select count(*) from public.journal_entries x where x.user_id = u.id) as journal_count,
           (select count(*) from public.clients x where x.user_id = u.id) as clients_count,
           exists (select 1 from public.google_connections x where x.user_id = u.id) as google,
           exists (select 1 from public.stripe_connections x where x.user_id = u.id) as stripe,
           (select count(*) from public.push_tokens x where x.user_id = u.id) as devices
      from auth.users u
      left join public.profiles p on p.id = u.id
      left join public.subscriptions s on s.user_id = u.id
  ) t;
  return out;
end $$;
revoke all on function public.founder_users() from public, anon;
grant execute on function public.founder_users() to authenticated;
