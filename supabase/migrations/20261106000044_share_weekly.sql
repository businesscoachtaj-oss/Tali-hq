-- Tali HQ, 6 Nov 2026: the shared brain scrub runs once a week instead of hourly (Taj's call, to keep
-- the cost down). Sunday 2:47am Sydney is Saturday 15:47 UTC (cron runs in UTC; an hour off in
-- winter, which doesn't matter for this job). tali-brain-share works through the week's backlog.
select cron.unschedule('tali-brain-share') where exists (select 1 from cron.job where jobname = 'tali-brain-share');
select cron.schedule('tali-brain-share', '47 15 * * 6', $cron$
  select net.http_post(
    url := 'https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/tali-brain-share',
    headers := jsonb_build_object('Content-Type','application/json','x-tali-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'tali_brain_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000)
  where exists (select 1 from public.brain_share_candidates(1));
$cron$);
