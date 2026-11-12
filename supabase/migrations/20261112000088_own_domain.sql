-- 12 Nov 2026 (Taj): your own domain for a hosted site. A one-off unlock (top up pack 'domain').
-- The owner asks for a domain they already own. Totality 360 connects it to the hosting, fills in the
-- two DNS records the owner has to add where they bought the domain, and marks it live once it answers.
-- Owners can read their own row. Every write goes through request_site_domain or the service role.

create table if not exists public.site_domains (
  user_id uuid primary key references auth.users(id) on delete cascade,
  domain text not null unique check (length(domain) <= 253 and domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$'),
  -- requested: waiting for Totality 360 to connect it. dns: records are ready for the owner to add. live: answering.
  status text not null default 'requested' check (status in ('requested', 'dns', 'live')),
  dns_a text check (dns_a is null or length(dns_a) <= 60),
  dns_cname text check (dns_cname is null or length(dns_cname) <= 120),
  requested_at timestamptz not null default now(),
  live_at timestamptz
);
alter table public.site_domains enable row level security;
drop policy if exists "own site domain read" on public.site_domains;
create policy "own site domain read" on public.site_domains for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.site_domains from anon, authenticated;

-- Has this person paid the one-off unlock? The founder's account always has it.
create or replace function public.site_domain_unlocked(p_user uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select p_user = 'e89ca9de-a86e-4dd6-8094-bc518566352e'::uuid
      or exists (select 1 from public.topups t where t.user_id = p_user and t.pack = 'domain');
$$;
revoke all on function public.site_domain_unlocked(uuid) from public, anon, authenticated;

create or replace function public.my_site_domain()
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object(
    'unlocked', public.site_domain_unlocked((select auth.uid())),
    'domain', d.domain, 'status', d.status, 'dns_a', d.dns_a, 'dns_cname', d.dns_cname)
  from (select 1) x left join public.site_domains d on d.user_id = (select auth.uid());
$$;
revoke all on function public.my_site_domain() from public;
grant execute on function public.my_site_domain() to authenticated;

-- The owner asks for a domain. It goes back to 'requested' if they change it. A nudge lands on the
-- founder's To do so it gets connected.
create or replace function public.request_site_domain(p_domain text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare me uuid := auth.uid(); d text; cur public.site_domains;
begin
  if me is null then return jsonb_build_object('ok', false, 'message', 'Please sign in again.'); end if;
  if not public.site_domain_unlocked(me) then return jsonb_build_object('ok', false, 'message', 'Unlock your own domain first.'); end if;
  if not exists (select 1 from public.sites s where s.user_id = me) then return jsonb_build_object('ok', false, 'message', 'Save your website first.'); end if;
  d := lower(trim(coalesce(p_domain, '')));
  d := regexp_replace(d, '^https?://', '');
  d := regexp_replace(d, '/.*$', '');
  d := regexp_replace(d, '^www\.', '');
  if length(d) > 253 or d !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$' then
    return jsonb_build_object('ok', false, 'message', 'That does not look like a domain. Try something like yourbusiness.com.au');
  end if;
  if d ~ '(^|\.)(talihq\.com\.au|totality360\.com\.au|totalityapp\.com\.au|vercel\.app)$' then
    return jsonb_build_object('ok', false, 'message', 'Use a domain you own.');
  end if;
  if exists (select 1 from public.site_domains x where x.domain = d and x.user_id <> me) then
    return jsonb_build_object('ok', false, 'message', 'That domain is already connected to another site.');
  end if;
  select * into cur from public.site_domains where user_id = me;
  if found and cur.domain = d then return jsonb_build_object('ok', true, 'domain', d, 'status', cur.status); end if;
  insert into public.site_domains (user_id, domain) values (me, d)
    on conflict (user_id) do update set domain = excluded.domain, status = 'requested', dns_a = null, dns_cname = null, requested_at = now(), live_at = null;
  insert into public.reminders (user_id, text, due_at, created_by, side)
  values ('e89ca9de-a86e-4dd6-8094-bc518566352e'::uuid, left('Connect the domain ' || d || ' for a Tali HQ website', 300), now(), 'tali', 'business');
  return jsonb_build_object('ok', true, 'domain', d, 'status', 'requested');
end $$;
revoke all on function public.request_site_domain(text) from public;
grant execute on function public.request_site_domain(text) to authenticated;

-- Which published site answers on this web address. Used by the web app when it is opened on a
-- domain that is not Tali HQ's own.
create or replace function public.site_slug_for_host(p_host text)
returns text language sql stable security definer set search_path to '' as $$
  select s.slug from public.site_domains d join public.sites s on s.user_id = d.user_id
   where d.status = 'live' and s.published
     and d.domain = regexp_replace(lower(trim(coalesce(p_host, ''))), '^www\.', '')
   limit 1;
$$;
revoke all on function public.site_slug_for_host(text) from public;
grant execute on function public.site_slug_for_host(text) to anon, authenticated;
