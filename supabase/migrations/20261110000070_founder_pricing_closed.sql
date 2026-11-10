-- Founder pricing closed to new sign-ups (10 Nov 2026, Taj's call).
-- The Tali HQ page said "Sign up now and you become a founding member" until today, so everyone who
-- signed up while it said that keeps the 42.5% off: they are marked as founding members here.
-- New sign-ups only get it if their email is already on the founding list (one person), and
-- nobody is added to that list from now on.
update public.subscriptions s
   set founding_member = true
  from auth.users u
 where u.id = s.user_id and not s.founding_member and u.created_at < timestamptz '2026-11-10 13:00:00+00';
comment on table public.founding_emails is 'Closed 10 Nov 2026: founder pricing is no longer offered. Do not add emails.';
