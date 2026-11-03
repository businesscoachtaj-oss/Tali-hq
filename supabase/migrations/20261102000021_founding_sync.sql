-- Tali HQ 021: the waitlist on totality360.com.au (Totality project, public.talihq_waitlist) sends each
-- new email here so it becomes a founding member. The Totality project calls this RPC with the
-- shared key kept in both vaults (Tali HQ: founding_sync_key). Wrong key, nothing happens.
create or replace function public.add_founding_emails(p_emails text[], p_key text)
returns integer language plpgsql security definer set search_path = '' as $$
declare k text; n integer;
begin
  select decrypted_secret into k from vault.decrypted_secrets where name = 'founding_sync_key';
  if k is null or p_key is distinct from k then return 0; end if;
  insert into public.founding_emails (email, source)
  select distinct lower(trim(e)), 'waitlist' from unnest(p_emails) e
   where e ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  on conflict (email) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.add_founding_emails(text[], text) from public;
grant execute on function public.add_founding_emails(text[], text) to anon, authenticated;
