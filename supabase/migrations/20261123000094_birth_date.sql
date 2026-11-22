-- 23 Nov 2026 (Taj): "your life in weeks" on the journal page needs a birthday. Opt in, null until the
-- person adds it, and they can clear it. Covered by the existing profiles RLS (own row only).
alter table public.profiles add column if not exists birth_date date;
alter table public.profiles drop constraint if exists profiles_birth_date_sane;
alter table public.profiles add constraint profiles_birth_date_sane check (birth_date is null or birth_date >= date '1900-01-01');
comment on column public.profiles.birth_date is 'Optional. Only used to draw the weeks-of-life chart on the journal page.';
-- profiles uses column grants, so the new column needs its own.
grant select (birth_date), update (birth_date) on public.profiles to authenticated;
