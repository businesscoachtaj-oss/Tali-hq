-- 2 Nov 2026: web push for the PWA. Until now push only worked in a native build, so the
-- morning brief, "email needs you" and health checks never reached a phone running the web app.
--
-- 1. push_tokens gains the browser's push subscription (the token is its endpoint).
-- 2. web_push_keys holds the VAPID key pair. The push-send function generates it on first use
--    and keeps it here (server only), so nobody has to paste a secret anywhere.
-- 3. vapid_public_key(): the app reads the public key to subscribe.
-- 4. push_user(): one call that sends to every device a user has (Expo and web) through the
--    push-send edge function. The reminder and health cron jobs use it instead of posting
--    straight to Expo, which would have choked on web endpoints.

alter table public.push_tokens add column if not exists subscription jsonb;

create table if not exists public.web_push_keys (
  id integer primary key default 1 check (id = 1),
  public_key text not null,
  private_key_jwk jsonb not null,
  public_key_jwk jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.web_push_keys enable row level security;
revoke all on public.web_push_keys from anon, authenticated;

create or replace function public.vapid_public_key()
returns text language sql stable security definer set search_path = '' as $$
  select public_key from public.web_push_keys where id = 1;
$$;
grant execute on function public.vapid_public_key() to authenticated;

create or replace function public.push_user(p_user_id uuid, p_title text, p_body text, p_url text default '/')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.push_tokens t where t.user_id = p_user_id) then return; end if;
  perform net.http_post(
    url := 'https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/push-send',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-tali-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'tali_brain_key')),
    body := jsonb_build_object('user_id', p_user_id, 'title', left(p_title, 80), 'body', left(p_body, 160), 'url', coalesce(p_url, '/')),
    timeout_milliseconds := 15000);
end $$;
revoke all on function public.push_user(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.send_due_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; n integer := 0;
begin
  for r in
    select rm.id, rm.user_id, rm.text
      from public.reminders rm
      join public.profiles p on p.id = rm.user_id
     where rm.done_at is null and rm.notified_at is null and rm.due_at <= now()
       and rm.due_at > now() - interval '1 day'
     order by rm.due_at
     limit 200
  loop
    perform public.push_user(r.user_id, 'Reminder from Tali', r.text, '/');
    update public.reminders set notified_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.health_nudges()
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; h jsonb; n integer := 0; body text;
begin
  for r in
    select s.user_id from public.subscriptions s join public.profiles p on p.id = s.user_id
     where p.onboarded_at is not null
       and ((s.status = 'trialing' and s.trial_ends_at > now()) or (s.status = 'active' and s.plan_id in ('hq', 'pro')))
       and not exists (select 1 from public.job_runs j where j.user_id = s.user_id and j.job = 'health_check' and j.started_at > now() - interval '11 hours')
  loop
    h := public.business_health(r.user_id);
    insert into public.job_runs(user_id, job, status, summary, finished_at)
    values (r.user_id, 'health_check', 'ok', h->>'status' || ': ' || jsonb_array_length(h->'items') || ' items', now());
    if h->>'status' <> 'green' then
      body := (select string_agg(x->>'text', ', ') from (select x from jsonb_array_elements(h->'items') x limit 3) t);
      perform public.push_user(r.user_id,
        case when h->>'status' = 'red' then 'Tali: something needs you' else 'Tali: a few things to check' end,
        coalesce(body, ''), '/');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
