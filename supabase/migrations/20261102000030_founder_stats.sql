-- 2 Nov 2026: founder_stats(), the numbers behind the Founder screen in the app (Me, visible to
-- Taj's account only). Sign-ups, plans, conversions, credits and tokens, Claude cost estimate,
-- connections, and the ten heaviest users this month. Only Taj's user id may call it.
create or replace function public.founder_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  me constant uuid := 'e89ca9de-a86e-4dd6-8094-bc518566352e';
  month_start timestamptz := date_trunc('month', now() at time zone 'Australia/Sydney') at time zone 'Australia/Sydney';
  out jsonb;
begin
  if auth.uid() is distinct from me then raise exception 'not allowed'; end if;

  select jsonb_build_object(
    'accounts', (select count(*) from public.profiles),
    'onboarded', (select count(*) from public.profiles where onboarded_at is not null),
    'signups_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'signups_30d', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'by_plan', (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from (
        select plan_id || '/' || status k, count(*) v from public.subscriptions group by 1) t),
    'trialing', (select count(*) from public.subscriptions where status = 'trialing' and trial_ends_at > now()),
    'trials_ending_7d', (select count(*) from public.subscriptions where status = 'trialing' and trial_ends_at between now() and now() + interval '7 days'),
    'paid_active', (select count(*) from public.subscriptions where status in ('active', 'past_due') and plan_id in ('hq', 'pro') and stripe_subscription_id is not null),
    'paid_hq', (select count(*) from public.subscriptions where status in ('active', 'past_due') and plan_id = 'hq' and stripe_subscription_id is not null),
    'paid_pro', (select count(*) from public.subscriptions where status in ('active', 'past_due') and plan_id = 'pro' and stripe_subscription_id is not null),
    'founding', (select count(*) from public.subscriptions where founding_member),
    'trial_expired_unpaid', (select count(*) from public.subscriptions where status = 'trialing' and trial_ends_at < now() and stripe_subscription_id is null),
    'waitlist_founding_emails', (select count(*) from public.founding_emails),
    'google_connected', (select count(*) from public.google_connections),
    'stripe_connected', (select count(*) from public.stripe_connections),
    'push_devices', (select count(*) from public.push_tokens),
    'push_web', (select count(*) from public.push_tokens where platform = 'web'),
    'tali_addresses', (select count(*) from public.tali_inboxes),
    'month', jsonb_build_object(
      'credits', (select coalesce(sum(credits), 0) from public.usage where created_at >= month_start),
      'tokens_in', (select coalesce(sum(tokens_in), 0) from public.usage where created_at >= month_start),
      'tokens_out', (select coalesce(sum(tokens_out), 0) from public.usage where created_at >= month_start),
      'active_users', (select count(distinct user_id) from public.usage where created_at >= month_start),
      'by_feature', (select coalesce(jsonb_object_agg(feature, n), '{}'::jsonb) from (
          select feature, count(*) n from public.usage where created_at >= month_start group by feature) t),
      'chats_today', (select count(*) from public.messages where role = 'user' and created_at > date_trunc('day', now() at time zone 'Australia/Sydney') at time zone 'Australia/Sydney'),
      'emails_sorted', (select count(*) from public.inbound_emails where received_at >= month_start),
      'approvals_done', (select count(*) from public.approvals where status = 'done' and decided_at >= month_start),
      'approvals_pending', (select count(*) from public.approvals where status = 'pending')
    ),
    'top_users', (select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select p.first_name, p.business_name, s.plan_id, s.status,
               coalesce(sum(u.credits), 0) credits, coalesce(sum(u.tokens_in), 0) tokens_in, coalesce(sum(u.tokens_out), 0) tokens_out
          from public.usage u
          join public.profiles p on p.id = u.user_id
          left join public.subscriptions s on s.user_id = u.user_id
         where u.created_at >= month_start
         group by p.id, p.first_name, p.business_name, s.plan_id, s.status
         order by 6 desc limit 10) t),
    'generated_at', now()
  ) into out;
  return out;
end $$;
revoke all on function public.founder_stats() from public, anon;
grant execute on function public.founder_stats() to authenticated;
