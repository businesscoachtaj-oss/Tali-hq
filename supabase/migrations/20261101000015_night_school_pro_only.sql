-- Night school is Tali HQ Pro only (Taj, 1 Nov 2026).
create or replace function public.due_night_school(p_limit integer default 10)
returns table(user_id uuid, topic text, topic_index integer, local_date date)
language sql security definer set search_path = '' as $$
  with base as (
    select n.user_id, n.topics, n.nights, n.next_topic,
           (now() at time zone coalesce(p.timezone, 'Australia/Sydney')) as local_now
      from public.night_school n
      join public.profiles p on p.id = n.user_id
     where n.enabled and cardinality(n.topics) > 0 and p.onboarded_at is not null
       and public.has_pro(n.user_id)
  ), b2 as (
    select b.*, case when extract(hour from b.local_now) >= 23 then b.local_now::date else (b.local_now - interval '1 day')::date end as night_of
      from base b
     where extract(hour from b.local_now) >= 23 or extract(hour from b.local_now) < 3
  )
  select b2.user_id, b2.topics[(b2.next_topic % cardinality(b2.topics)) + 1], b2.next_topic % cardinality(b2.topics), b2.night_of
    from b2
   where (b2.nights = 'every' or extract(isodow from b2.night_of) in (1, 3, 5))
     and not exists (select 1 from public.night_school_notes x where x.user_id = b2.user_id and x.for_date = b2.night_of)
   limit least(coalesce(p_limit, 10), 50);
$$;
revoke all on function public.due_night_school(integer) from public, anon, authenticated;
grant execute on function public.due_night_school(integer) to service_role;

update public.plans set features = case id
  when 'hq' then '["Morning brief and 12-hourly health checks","Clients, leads and invoices","Drafts replies and follow-ups for your yes","Web search and her weekly journal","1,000 Tali credits a month"]'::jsonb
  when 'pro' then '["Everything in Tali HQ, 3,000 credits a month","Night school: you pick what Tali studies each night","Tali reads her replies out loud in her own voice","Your own Tali email address for enquiries","Automatic actions inside rules you set"]'::jsonb
  else features end
where id in ('hq', 'pro');
