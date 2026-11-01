-- Tali HQ 010: founding members from the waitlist, and push tokens for brief notifications.

-- 1. Founding members. Emails from the Tali HQ waitlist go here (server only).
--    Anyone who signs up with one of these emails gets founding_member = true, which
--    create-checkout turns into the founding coupon (42.5% off for life).
create table if not exists public.founding_emails (
  email text primary key check (email = lower(email)),
  source text not null default 'waitlist',
  added_at timestamptz not null default now()
);
alter table public.founding_emails enable row level security;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, first_name)
  values (new.id, nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), ''))
  on conflict (id) do nothing;
  insert into public.subscriptions (user_id, plan_id, status, trial_ends_at, founding_member)
  values (new.id, 'hq', 'trialing', now() + interval '14 days',
          exists (select 1 from public.founding_emails f where f.email = lower(new.email)))
  on conflict (user_id) do nothing;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Someone who joined the waitlist after signing up still gets it.
create or replace function public.founding_backfill() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.subscriptions s set founding_member = true
    from auth.users u
   where u.id = s.user_id and lower(u.email) = new.email and s.founding_member = false;
  return new;
end $$;
revoke all on function public.founding_backfill() from public, anon, authenticated;
create trigger founding_emails_backfill after insert on public.founding_emails
  for each row execute function public.founding_backfill();

-- 2. Push tokens (Expo push). One row per device; users manage only their own.
create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  platform text not null check (platform in ('ios', 'android', 'web')),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
create policy "own push tokens all" on public.push_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
