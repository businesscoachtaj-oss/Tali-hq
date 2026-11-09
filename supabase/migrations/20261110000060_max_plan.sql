-- Tali HQ Max (10 Nov 2026, Taj): the premium plan. A$99.99 a month, A$1,019.90 a year (15% off).
-- 10,000 credits and 300 images a month. Half-price Deep think, Big brain and second opinions and the
-- wider memory recall live in the tali-chat function. Everything Pro can do, Max can do.
-- Safe to run twice.

alter table public.plans drop constraint if exists plans_id_check;
alter table public.plans add constraint plans_id_check check (id in ('free','hq','pro','max'));

insert into public.plans (id, name, monthly_price_aud, yearly_price_aud, credits_month, messages_month, features, sort, images_month, searches_month, deep_month)
values ('max', 'Tali HQ Max', 99.99, 1019.90, 10000, null,
  '["Everything in Tali HQ Pro, with 10,000 credits and 300 images a month","Deep think, Big brain and second opinions at half the credits","More of her brain in every answer: she brings up to twice as many memories to each reply","Her voice included when it arrives, with no add-on to pay","First to get every new part of her brain"]'::jsonb,
  4, 300, 0, 0)
on conflict (id) do update set name = excluded.name, monthly_price_aud = excluded.monthly_price_aud, yearly_price_aud = excluded.yearly_price_aud,
  credits_month = excluded.credits_month, features = excluded.features, sort = excluded.sort, images_month = excluded.images_month;

-- Every database function that asks "is this a paid plan?" lists ('hq','pro'). Add 'max' to each one
-- where it stands, so nothing else about those functions changes. has_pro (Tali email, rules, night
-- school picks) counts Max as Pro.
do $$
declare f record; def text; fresh text;
begin
  for f in
    select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'brain') and p.prokind = 'f' and p.prosrc ~ '''pro'''
  loop
    def := pg_get_functiondef(f.oid);
    fresh := regexp_replace(def, '\(\s*''hq''\s*,\s*''pro''\s*\)', '(''hq'',''pro'',''max'')', 'g');
    if f.proname = 'has_pro' then
      fresh := regexp_replace(fresh, 'plan_id\s*=\s*''pro''', 'plan_id in (''pro'',''max'')', 'g');
    end if;
    if fresh <> def then execute fresh; end if;
  end loop;
end $$;
