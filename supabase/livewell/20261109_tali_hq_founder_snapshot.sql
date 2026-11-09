-- Run in the LIVEWELL project (spqazfyxxhzizbtmxklr), not Tali HQ. 9 Nov 2026.
-- Counts for the Tali HQ Founder screen: Totality and Nutrition signups, trials, paid, cancelled
-- and lapsed accounts, Tali-in-the-apps failures, and payments past due. Counts only, no names
-- or emails. Test and gifted accounts are left out. Callable with the anon key, but only with the
-- shared key kept in the vault (tali_hq_founder_key); Tali HQ's founder-ops function holds the same key.

create or replace function public.tali_hq_founder_snapshot(p_key text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  k text;
  latest text;
  since timestamptz;
begin
  select decrypted_secret into k from vault.decrypted_secrets where name = 'tali_hq_founder_key';
  if k is null or p_key is distinct from k then raise exception 'not allowed'; end if;

  select model into latest from public.ai_usage where model is not null order by created_at desc limit 1;
  -- When the current model first appeared, but only if an older, different model was used before it.
  select case when exists (select 1 from public.ai_usage where model is not null and model <> latest)
              then (select min(created_at) from public.ai_usage where model = latest
                      and created_at > (select max(created_at) from public.ai_usage where model is not null and model <> latest))
         end into since;

  return jsonb_build_object(
    'apps', jsonb_build_array(
      (select jsonb_build_object(
        'app', 'totality', 'label', 'Totality',
        'signups_7d', count(*) filter (where p.created_at > now() - interval '7 days'),
        'trialing', count(*) filter (where p.subscription_status = 'trialing' and p.trial_ends_at > now()),
        'trials_ending_3d', count(*) filter (where p.subscription_status = 'trialing' and p.trial_ends_at between now() and now() + interval '3 days'),
        'paid_7d', count(*) filter (where p.subscription_status = 'active' and p.subscription_updated_at > now() - interval '7 days'),
        'cancelled_24h', count(*) filter (where p.subscription_status in ('canceled', 'cancelled') and p.subscription_updated_at > now() - interval '1 day'),
        'locked_unpaid', count(*) filter (where coalesce(p.sa_locked, false) or (p.subscription_status = 'trialing' and p.trial_ends_at < now())))
       from public.profiles p
       where p.role in ('solo', 'trainer', 'gym_admin')
         and not coalesce(p.is_test_account, false) and not coalesce(p.is_gifted, false)),
      (select jsonb_build_object(
        'app', 'nutrition', 'label', 'Nutrition',
        'signups_7d', count(*) filter (where p.created_at > now() - interval '7 days'),
        'trialing', count(*) filter (where p.nutrition_subscription_status = 'trialing' and coalesce(p.trial_ends_at, p.trial_started_at + interval '7 days') > now()),
        'trials_ending_3d', count(*) filter (where p.nutrition_subscription_status = 'trialing' and coalesce(p.trial_ends_at, p.trial_started_at + interval '7 days') between now() and now() + interval '3 days'),
        'paid_7d', count(*) filter (where p.nutrition_subscription_status = 'active' and p.nutrition_subscription_updated_at > now() - interval '7 days'),
        'cancelled_24h', count(*) filter (where p.nutrition_subscription_status in ('canceled', 'cancelled') and p.nutrition_subscription_updated_at > now() - interval '1 day'),
        'locked_unpaid', count(*) filter (where p.nutrition_subscription_status = 'trialing' and coalesce(p.trial_ends_at, p.trial_started_at + interval '7 days') < now()))
       from public.profiles p
       where p.role = 'nutrition_only'
         and not coalesce(p.is_test_account, false) and not coalesce(p.nutrition_is_gifted, false))
    ),
    'excluded', (select count(*) from public.profiles p
                 where p.role in ('solo', 'trainer', 'gym_admin', 'nutrition_only')
                   and (coalesce(p.is_test_account, false) or coalesce(p.is_gifted, false) or coalesce(p.nutrition_is_gifted, false))),
    'tali_ai', jsonb_build_object(
      'errors_24h', (select count(*) from public.ai_usage a
                     where a.created_at > now() - interval '24 hours'
                       and (a.status not in ('done', 'reserved') or (a.status = 'reserved' and a.created_at < now() - interval '10 minutes'))),
      'calls_24h', (select count(*) from public.ai_usage a where a.created_at > now() - interval '24 hours'),
      'model', latest,
      'model_since', since),
    'payments', jsonb_build_object(
      'past_due', (select count(*) from public.profiles p
                   where not coalesce(p.is_test_account, false)
                     and (p.subscription_status = 'past_due' or p.nutrition_subscription_status = 'past_due')))
  );
end $$;

revoke all on function public.tali_hq_founder_snapshot(text) from public;
grant execute on function public.tali_hq_founder_snapshot(text) to anon;
