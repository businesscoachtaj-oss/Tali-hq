-- Tali's level on Today (3 Nov 2026). One read-only call that counts what Tali has learnt and
-- done for the signed-in user, plus what they have put in. lib/level.ts turns it into XP and a level.
--   memories      active memories in their private brain (Tali's growth)
--   night_school  nights she has studied for them (Tali's growth)
--   journal       journal entries and notes they have written, private ones included (their effort)
--   jobs_done     scheduled jobs that ran ok for them, like briefs and checks (Tali's work)
--   chats_learnt  chats they have had with her (their effort)
-- Security definer because brain is server-only; it only ever counts auth.uid()'s own rows.
create or replace function public.my_tali_level()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'memories', (select count(*) from brain.memories m where m.user_id = auth.uid() and m.status = 'active'),
    'night_school', (select count(*) from public.night_school_notes n where n.user_id = auth.uid()),
    'journal', (select count(*) from public.journal_entries j where j.user_id = auth.uid()),
    'jobs_done', (select count(*) from public.job_runs r where r.user_id = auth.uid() and r.status = 'ok'),
    'chats_learnt', (select count(*) from public.conversations c where c.user_id = auth.uid())
  ) end;
$$;

revoke all on function public.my_tali_level() from public, anon;
grant execute on function public.my_tali_level() to authenticated;
