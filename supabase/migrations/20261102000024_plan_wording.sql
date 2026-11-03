-- 024: plans only claim what is live (Taj, 2 Nov 2026). Users get a business health check on Today, not 12-hourly checks.
update public.plans
set features = (select jsonb_agg(case when f = 'Morning brief and 12-hourly health checks' then 'Morning brief and a business health check' else f end order by ord)
                from jsonb_array_elements_text(features) with ordinality as t(f, ord))
where id = 'hq';
