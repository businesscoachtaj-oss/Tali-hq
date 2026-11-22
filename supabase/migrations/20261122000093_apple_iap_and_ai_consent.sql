-- 22 Nov 2026 (Taj): App Review fixes for Tali HQ 1.0.2.
-- 1. Apple In-App Purchase on iPhone (guideline 3.1.1), the same way Totality Nutrition does it:
--    the Apple subscription is written onto public.subscriptions by the tali-apple-verify and
--    tali-apple-notifications Edge Functions (service role only).
-- 2. A yes to Tali using AI before any of your data goes to an AI company (guidelines 5.1.1(i)
--    and 5.1.2(i)). Stored on the profile; the user sets it themselves on the consent screen.

alter table public.subscriptions
  add column if not exists billing_source text not null default 'stripe' check (billing_source in ('stripe', 'apple')),
  add column if not exists apple_original_transaction_id text unique,
  add column if not exists apple_product_id text,
  add column if not exists apple_expires_at timestamptz,
  add column if not exists apple_environment text;

create table if not exists public.tali_apple_events (
  id bigint generated always as identity primary key,
  source text not null check (source in ('client_verify', 'notification')),
  notification_uuid text unique,
  notification_type text,
  subtype text,
  original_transaction_id text,
  transaction_id text,
  product_id text,
  environment text,
  expires_at timestamptz,
  user_id uuid references auth.users(id) on delete set null,
  result text,
  created_at timestamptz not null default now()
);
alter table public.tali_apple_events enable row level security;
-- No policies: written and read by the service role only.
create index if not exists tali_apple_events_user_idx on public.tali_apple_events (user_id);

alter table public.profiles add column if not exists ai_consent_at timestamptz;
