-- 9 Nov 2026 (Tali's Tuesday list items 6 and 7): the To confirm list and the health light's
-- "I tested the new model" tick on the Founder screen. Taj only; nothing here is visible to users.

create table if not exists public.founder_to_confirm (
  id uuid primary key default gen_random_uuid(),
  text text not null check (length(btrim(text)) between 1 and 300),
  source text not null default 'tali',
  added_at timestamptz not null default now(),
  done_at timestamptz
);
alter table public.founder_to_confirm enable row level security;
-- No policies: read and written only through the functions below.

create table if not exists public.founder_flags (
  key text primary key,
  at timestamptz not null default now()
);
alter table public.founder_flags enable row level security;

create or replace function public.founder_to_confirm()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is distinct from 'e89ca9de-a86e-4dd6-8094-bc518566352e'::uuid then raise exception 'not allowed'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'text', c.text, 'added_at', c.added_at) order by c.added_at)
    from public.founder_to_confirm c where c.done_at is null), '[]'::jsonb);
end $$;

create or replace function public.founder_confirm_done(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is distinct from 'e89ca9de-a86e-4dd6-8094-bc518566352e'::uuid then raise exception 'not allowed'; end if;
  update public.founder_to_confirm set done_at = now() where id = p_id and done_at is null;
end $$;

create or replace function public.founder_model_checked(p_model text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is distinct from 'e89ca9de-a86e-4dd6-8094-bc518566352e'::uuid then raise exception 'not allowed'; end if;
  insert into public.founder_flags (key) values ('model_checked:' || coalesce(nullif(btrim(p_model), ''), 'unknown'))
  on conflict (key) do update set at = now();
end $$;

-- For Tali's scheduled jobs (they run as postgres through the Supabase connector): add an item.
create or replace function public.founder_add_to_confirm(p_text text, p_source text default 'tali')
returns uuid language sql security definer set search_path = '' as $$
  insert into public.founder_to_confirm (text, source) values (btrim(p_text), coalesce(p_source, 'tali')) returning id;
$$;

revoke all on function public.founder_to_confirm() from public, anon;
revoke all on function public.founder_confirm_done(uuid) from public, anon;
revoke all on function public.founder_model_checked(text) from public, anon;
revoke all on function public.founder_add_to_confirm(text, text) from public, anon, authenticated;
grant execute on function public.founder_to_confirm() to authenticated;
grant execute on function public.founder_confirm_done(uuid) to authenticated;
grant execute on function public.founder_model_checked(text) to authenticated;

-- The two items Tali already flagged as open.
insert into public.founder_to_confirm (text, source) values
  ('Check the Google Workspace billing', 'tali'),
  ('Approve the draft for support ticket c2286926', 'tali');
