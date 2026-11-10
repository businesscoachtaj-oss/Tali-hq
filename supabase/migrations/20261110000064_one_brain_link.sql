-- One brain (10 Nov 2026, asked for by Taj; his three answers: opt in with a sign in, basics only,
-- one way). Someone who also uses Totality or Totality Nutrition can bring across what they told
-- Tali there. See docs/PLAN_ONE_BRAIN.md and docs/ONE_BRAIN.md.
--
-- How it works: the edge function tali-link-app signs the person in to Totality with their own
-- details (never stored), calls Totality's my_summary_for_tali_hq() as them, and hands the result
-- here. Tali HQ holds no key to the Totality database.
--
--   public.app_links            who is linked, to which Totality account, and how much came across
--   public.app_link_attempts    sign in tries, so this cannot be used to guess Totality passwords
--   app_link_allowed(user)      service: counts a try, false after 5 in an hour
--   app_link_save(...)          service: saves the memories (source 'totality') and the link
--   my_app_links()              the signed in person's link, for the card on Her brain
--   my_app_unlink('totality')   removes the link and every memory that came from it
-- Additive. Nothing the live app calls is changed.

create table if not exists public.app_links (
  user_id uuid not null references auth.users(id) on delete cascade,
  app text not null check (app in ('totality')),
  remote_user_id uuid not null,
  linked_at timestamptz not null default now(),
  brought integer not null default 0,
  primary key (user_id, app),
  unique (app, remote_user_id)
);
alter table public.app_links enable row level security;
revoke all on table public.app_links from anon, authenticated;

create table if not exists public.app_link_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists app_link_attempts_user_idx on public.app_link_attempts (user_id, at desc);
alter table public.app_link_attempts enable row level security;
revoke all on table public.app_link_attempts from anon, authenticated;

create or replace function public.app_link_allowed(p_user_id uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_user_id is null then return false; end if;
  delete from public.app_link_attempts where at < now() - interval '1 day';
  if (select count(*) from public.app_link_attempts a where a.user_id = p_user_id and a.at > now() - interval '1 hour') >= 5 then
    return false;
  end if;
  insert into public.app_link_attempts (user_id) values (p_user_id);
  return true;
end $$;

-- p_items: [{ "kind": "fact" | "preference", "content": "..." }]. Linking again refreshes what came across.
create or replace function public.app_link_save(p_user_id uuid, p_app text, p_remote_user_id uuid, p_items jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r jsonb; n integer := 0; txt text;
begin
  if p_user_id is null or p_remote_user_id is null or p_app is distinct from 'totality' then return jsonb_build_object('ok', false, 'why', 'bad request'); end if;
  if exists (select 1 from public.app_links l where l.app = p_app and l.remote_user_id = p_remote_user_id and l.user_id <> p_user_id) then
    return jsonb_build_object('ok', false, 'why', 'taken');
  end if;
  delete from brain.memories m where m.user_id = p_user_id and m.source = 'totality';
  for r in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) limit 12 loop
    txt := trim(regexp_replace(replace(replace(coalesce(r->>'content', ''), chr(8212), ', '), chr(8211), ' to '), '\s+', ' ', 'g'));
    if r->>'kind' not in ('fact', 'preference') or length(txt) < 3 or length(txt) > 300 then continue; end if;
    perform brain.remember(p_user_id, r->>'kind', txt, 'totality', '{}'::text[], array['totality'], 3::smallint, 0.9::real, 'totality/link');
    n := n + 1;
  end loop;
  insert into public.app_links (user_id, app, remote_user_id, brought) values (p_user_id, p_app, p_remote_user_id, n)
  on conflict (user_id, app) do update set remote_user_id = excluded.remote_user_id, brought = excluded.brought, linked_at = now();
  delete from public.app_link_attempts where user_id = p_user_id;
  return jsonb_build_object('ok', true, 'brought', n);
end $$;

revoke all on function public.app_link_allowed(uuid), public.app_link_save(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.app_link_allowed(uuid), public.app_link_save(uuid, text, uuid, jsonb) to service_role;

create or replace function public.my_app_links()
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('app', l.app, 'linked_at', l.linked_at, 'brought', l.brought)), '[]'::jsonb)
    from public.app_links l where l.user_id = (select auth.uid());
$$;

-- Unlink really removes what came across (this is the one place brain memories are deleted, because
-- the promise on the card is that unlinking takes them back out).
create or replace function public.my_app_unlink(p_app text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null or p_app is distinct from 'totality' then return false; end if;
  delete from brain.memories m where m.user_id = uid and m.source = 'totality';
  delete from public.app_links l where l.user_id = uid and l.app = p_app;
  return true;
end $$;

revoke all on function public.my_app_links(), public.my_app_unlink(text) from public, anon;
grant execute on function public.my_app_links(), public.my_app_unlink(text) to authenticated;
