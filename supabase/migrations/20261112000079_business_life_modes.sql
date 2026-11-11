-- 12 Nov 2026 (Taj): Business and Life modes. One Tali, two views. Lists, reminders and journal entries
-- each carry a side (life or business). Null means not sorted yet, and the app falls back to a sensible side.
-- Switching by the clock is a setting on the profile, off until the person turns it on.

alter table public.life_items add column if not exists side text check (side in ('life', 'business'));
alter table public.reminders add column if not exists side text check (side in ('life', 'business'));
alter table public.journal_entries add column if not exists side text check (side in ('life', 'business'));

alter table public.profiles
  add column if not exists mode_auto boolean not null default false,
  add column if not exists work_start time not null default '09:00',
  add column if not exists work_end time not null default '17:00',
  add column if not exists work_days text not null default 'mon_fri' check (work_days in ('mon_fri', 'mon_sat', 'every_day'));
grant update (mode_auto, work_start, work_end, work_days) on public.profiles to authenticated;

-- What can be sorted without guessing: the lists that are about your life by nature, and reminders about a client.
update public.life_items set side = 'life' where side is null and kind in ('checkup', 'admin', 'home', 'habit');
update public.reminders set side = 'business' where side is null and client_id is not null;

-- Tali's reminders carry the side she picked. Replaces the four argument version so calls stay unambiguous.
drop function if exists public.tali_add_reminder(uuid, text, timestamptz, text);
create or replace function public.tali_add_reminder(p_user_id uuid, p_text text, p_due_at timestamptz, p_client_name text default null, p_side text default null)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare v_id uuid; v_client uuid;
begin
  if p_client_name is not null then
    select id into v_client from public.clients where user_id = p_user_id and lower(name) = lower(trim(p_client_name)) limit 1;
  end if;
  insert into public.reminders(user_id, text, due_at, client_id, created_by, side)
  values (p_user_id, trim(p_text), greatest(p_due_at, now()), v_client, 'tali',
          case when p_side in ('life', 'business') then p_side when v_client is not null then 'business' else null end)
  returning id into v_id;
  return v_id;
end $function$;
revoke all on function public.tali_add_reminder(uuid, text, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.tali_add_reminder(uuid, text, timestamptz, text, text) to service_role;
