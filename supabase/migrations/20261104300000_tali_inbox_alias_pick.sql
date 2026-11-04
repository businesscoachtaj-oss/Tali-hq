-- 4 Nov 2026: pick the word before the @ on Tali's address, and keep inbound emails tidy.
--
-- 1. claim_tali_inbox(p_alias) replaces the no-arg version. Same rules as before (Pro only, returns
--    the existing alias if one is already claimed), plus:
--      - p_alias given: lowercased, letters and numbers only, 3 to 24 long, must be free.
--      - p_alias null: built from the business name with company words (pty, ltd, limited, co, inc,
--        llc, the) stripped first, then first name, then 'hello', made unique with a number.
-- 2. suggest_tali_alias() returns that cleaned suggestion without claiming it, to pre-fill the box.
-- 3. When an approval tied to an inbound email is sent, done or declined, the email is marked
--    handled, whichever path decided it (Gmail, Outlook, Tali's address or a tap in the app).

-- ---------- the cleaned suggestion ----------
create or replace function public.tali_alias_base(p_business text, p_first text) returns text
language sql immutable set search_path = '' as $$
  select left(
    coalesce(
      nullif(lower(regexp_replace(regexp_replace(coalesce(p_business, ''), '\m(pty|ltd|limited|co|inc|llc|the)\M', '', 'gi'), '[^a-zA-Z0-9]+', '', 'g')), ''),
      nullif(lower(regexp_replace(coalesce(p_first, ''), '[^a-zA-Z0-9]+', '', 'g')), ''),
      'hello'
    ), 24);
$$;
revoke all on function public.tali_alias_base(text, text) from public, anon;
grant execute on function public.tali_alias_base(text, text) to authenticated;

create or replace function public.suggest_tali_alias() returns text
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); base text; cand text; i integer := 0; existing text;
begin
  if u is null then raise exception 'not signed in'; end if;
  select alias into existing from public.tali_inboxes where user_id = u;
  if existing is not null then return existing; end if;
  select public.tali_alias_base(business_name, first_name) into base from public.profiles where id = u;
  base := coalesce(base, 'hello');
  if length(base) < 3 then base := left(base || 'hq', 24); end if;
  cand := base;
  while exists (select 1 from public.tali_inboxes where alias = cand) loop
    i := i + 1; cand := left(base, 24 - length(i::text)) || i;
  end loop;
  return cand;
end $$;
revoke all on function public.suggest_tali_alias() from public, anon;
grant execute on function public.suggest_tali_alias() to authenticated;

-- ---------- claiming ----------
drop function if exists public.claim_tali_inbox();

create or replace function public.claim_tali_inbox(p_alias text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); cand text; existing text;
begin
  if u is null then raise exception 'not signed in'; end if;
  if not public.has_pro(u) then raise exception 'Tali email is part of Tali HQ Pro'; end if;
  select alias into existing from public.tali_inboxes where user_id = u;
  if existing is not null then return existing; end if;

  if nullif(trim(p_alias), '') is not null then
    cand := regexp_replace(lower(p_alias), '[^a-z0-9]', '', 'g');
    if length(cand) < 3 or length(cand) > 24 then
      raise exception 'Use 3 to 24 letters or numbers';
    end if;
    if exists (select 1 from public.tali_inboxes where alias = cand) then
      raise exception 'That one is taken';
    end if;
  else
    cand := public.suggest_tali_alias();
  end if;

  begin
    insert into public.tali_inboxes(user_id, alias) values (u, cand);
  exception when unique_violation then
    raise exception 'That one is taken';
  end;
  return cand;
end $$;
revoke all on function public.claim_tali_inbox(text) from public, anon;
grant execute on function public.claim_tali_inbox(text) to authenticated;

-- ---------- a decided approval marks its email handled ----------
create or replace function public.inbound_email_follow_approval() returns trigger
language plpgsql security definer set search_path = '' as $$
declare eid uuid;
begin
  if new.status in ('done', 'approved', 'rejected') and new.status is distinct from old.status then
    if new.draft ? 'from' and (new.draft->>'from') like 'email/%' then
      begin
        eid := substr(new.draft->>'from', 7)::uuid;
      exception when others then
        eid := null;
      end;
    end if;
    update public.inbound_emails
       set status = 'handled'
     where user_id = new.user_id
       and status = 'new'
       and (approval_id = new.id or (eid is not null and id = eid));
  end if;
  return new;
end $$;

drop trigger if exists approvals_mark_email_handled on public.approvals;
create trigger approvals_mark_email_handled
  after update of status on public.approvals
  for each row execute function public.inbound_email_follow_approval();
