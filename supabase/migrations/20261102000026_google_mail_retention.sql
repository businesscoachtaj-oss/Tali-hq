-- 026: Google data retention (for Google's verification and because it is right).
-- Emails synced from a user's Gmail are kept for 90 days, then the body and snippet are removed
-- and the row is deleted. Replies the user already sent are kept as approvals (their own words).
create or replace function public.prune_gmail_emails() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.inbound_emails where source = 'gmail' and received_at < now() - interval '90 days';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.prune_gmail_emails() from public, anon, authenticated;
select cron.schedule('tali-gmail-prune', '41 3 * * *', $cron$ select public.prune_gmail_emails(); $cron$);
