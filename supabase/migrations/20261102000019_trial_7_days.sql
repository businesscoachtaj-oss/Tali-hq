-- Tali HQ 019: new sign-ups get a 7 day Tali HQ trial (was 14). Existing trials keep their end date.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, first_name)
  values (new.id, nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), ''))
  on conflict (id) do nothing;
  insert into public.subscriptions (user_id, plan_id, status, trial_ends_at, founding_member)
  values (new.id, 'hq', 'trialing', now() + interval '7 days',
          exists (select 1 from public.founding_emails f where f.email = lower(new.email)))
  on conflict (user_id) do nothing;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
