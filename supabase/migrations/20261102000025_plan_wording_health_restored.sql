-- 025: the 12-hourly health check IS live for every paid user (health_nudges, cron tali-health at 8:07am and 6:07pm Sydney).
-- Migration 024 removed the claim by mistake. Put it back.
update public.plans
set features = (select jsonb_agg(case when f = 'Morning brief and a business health check' then 'Morning brief and 12-hourly health checks' else f end order by ord)
                from jsonb_array_elements_text(features) with ordinality as t(f, ord))
where id = 'hq';
