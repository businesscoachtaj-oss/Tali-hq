-- Tali HQ 009: users can decide on Tali's drafts, and the morning brief job's SQL.

-- 1. Approvals: the user can mark a draft done (they sent it themselves) or not needed.
--    Only status and decided_at, only on their own rows, only to a decided state.
revoke update on public.approvals from authenticated;
grant update (status, decided_at) on public.approvals to authenticated;
create policy "own approvals decide" on public.approvals for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and status in ('approved', 'rejected', 'done'));

-- Tali can draft for: messages, follow-ups, invoices (reminders), bookings, rules, other.
-- The draft json is {to, body, channel?}.

-- 2. Who gets a brief right now. Trial or paid HQ/Pro: a morning brief every day at their brief_time.
--    Free: a weekly check-in on Friday at their brief_time. One per user, kind and local date.
create or replace function public.due_briefs(p_limit integer default 25)
returns table(user_id uuid, kind text, local_date date, plan text)
language sql security definer set search_path = '' as $$
  with base as (
    select p.id as user_id, coalesce(p.timezone, 'Australia/Sydney') as tz, p.brief_time,
           s.plan_id, s.status, s.trial_ends_at
      from public.profiles p
      join public.subscriptions s on s.user_id = p.id
     where p.onboarded_at is not null
  ), local as (
    select b.*, (now() at time zone b.tz) as local_now from base b
  ), eligible as (
    select l.user_id, l.local_now::date as local_date,
           case when (l.status = 'trialing' and l.trial_ends_at > now()) or (l.status = 'active' and l.plan_id in ('hq','pro'))
                then 'morning' else 'weekly' end as kind,
           case when (l.status = 'trialing' and l.trial_ends_at > now()) or (l.status = 'active' and l.plan_id in ('hq','pro'))
                then l.plan_id else 'free' end as plan,
           l.local_now, l.brief_time
      from local l
  )
  select e.user_id, e.kind, e.local_date, e.plan
    from eligible e
   where e.local_now >= e.local_date + e.brief_time
     and e.local_now < e.local_date + e.brief_time + interval '3 hours'
     and (e.kind = 'morning' or extract(isodow from e.local_now) = 5)
     and not exists (select 1 from public.briefs br where br.user_id = e.user_id and br.kind = e.kind and br.for_date = e.local_date)
   limit least(coalesce(p_limit, 25), 100);
$$;

-- 3. What Tali reads to write one person's brief.
create or replace function public.brief_context(p_user_id uuid, p_days integer default 1)
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object(
    'profile', (select jsonb_build_object('first_name', pr.first_name, 'business_name', pr.business_name,
                 'business_type', pr.business_type, 'about_me', pr.about_me, 'timezone', pr.timezone)
                 from public.profiles pr where pr.id = p_user_id),
    'important', coalesce((select jsonb_agg(jsonb_build_object('kind', m.kind, 'content', m.content) order by m.importance desc, m.created_at desc)
                 from (select kind, content, importance, created_at from brain.memories
                        where user_id = p_user_id and status = 'active' and kind in ('fact','preference','idea','person','event')
                        order by importance desc, created_at desc limit 15) m), '[]'::jsonb),
    'new_memories', coalesce((select jsonb_agg(jsonb_build_object('kind', m.kind, 'content', m.content) order by m.created_at)
                 from brain.memories m
                where m.user_id = p_user_id and m.status = 'active' and m.created_at > now() - make_interval(days => p_days)), '[]'::jsonb),
    'new_journal', coalesce((select jsonb_agg(jsonb_build_object('id', j.id, 'kind', j.kind, 'when', j.created_at, 'title', j.title, 'mood', j.mood, 'body', left(j.body, 2000)) order by j.created_at)
                 from public.journal_entries j
                where j.user_id = p_user_id and j.private_to_tali = false and j.learned_at is null
                  and j.created_at > now() - interval '14 days'), '[]'::jsonb),
    'chat', coalesce((select jsonb_agg(jsonb_build_object('role', x.role, 'content', left(x.content, 600)) order by x.created_at)
                 from (select role, content, created_at from public.messages
                        where user_id = p_user_id and role in ('user','assistant') and created_at > now() - make_interval(days => p_days)
                        order by created_at desc limit 30) x), '[]'::jsonb),
    'pending', coalesce((select jsonb_agg(jsonb_build_object('kind', a.kind, 'title', a.title, 'since', a.created_at))
                 from public.approvals a where a.user_id = p_user_id and a.status = 'pending'), '[]'::jsonb)
  );
$$;

-- 4. Mark journal entries as learnt from (server only).
create or replace function public.mark_journal_learned(p_user_id uuid, p_ids uuid[])
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.journal_entries set learned_at = now() where user_id = p_user_id and id = any(p_ids) and private_to_tali = false;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.due_briefs(integer) from public, anon, authenticated;
revoke all on function public.brief_context(uuid, integer) from public, anon, authenticated;
revoke all on function public.mark_journal_learned(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.due_briefs(integer), public.brief_context(uuid, integer), public.mark_journal_learned(uuid, uuid[]) to service_role;

-- 5. Every 15 minutes, only when someone is due. The function checks the same vault key as the embed worker.
select cron.schedule('tali-brief', '*/15 * * * *', $cron$
  select net.http_post(
    url := 'https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/tali-brief',
    headers := jsonb_build_object('Content-Type','application/json','x-tali-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'tali_brain_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000)
  where exists (select 1 from public.due_briefs(1));
$cron$);
