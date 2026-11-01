-- First-run tour on Today, like the Totality apps. Null means the user has not
-- finished or skipped the tour yet. Users can set it on their own profile only
-- (row policy "own profile update" already limits rows to auth.uid()).
alter table public.profiles add column if not exists tour_done_at timestamptz;
grant update (tour_done_at) on public.profiles to authenticated;
