-- 027: Free plan gets 150 messages a month (was 50): about 5 a day, enough to get to know Tali (Taj, 2 Nov 2026).
update public.plans
set messages_month = 150,
    features = (select jsonb_agg(case when f = 'Chat with Tali, 50 messages a month' then 'Chat with Tali, 150 messages a month' else f end order by ord)
                from jsonb_array_elements_text(features) with ordinality as t(f, ord))
where id = 'free';
