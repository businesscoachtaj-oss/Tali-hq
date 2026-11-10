-- Sleep is switched on (10 Nov 2026, Taj approved the "While you slept" card with Undo).
-- Every hour at 37 past. The function only works on people for whom it is 2am to 5am.
-- To switch it off: select cron.unschedule('tali-brain-sleep');
select cron.unschedule('tali-brain-sleep') where exists (select 1 from cron.job where jobname = 'tali-brain-sleep');
select cron.schedule('tali-brain-sleep', '37 * * * *', $cron$
  select net.http_post(
    url := 'https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/tali-brain-sleep',
    headers := jsonb_build_object('Content-Type','application/json','x-tali-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'tali_brain_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000)
  where exists (select 1 from public.brain_sleep_due(1));
$cron$);
