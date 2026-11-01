-- Tali HQ 007: stats() also reports merged and entities, matching what Tali HQ's brain tab reads.
create or replace function brain.stats(p_user_id uuid default null)
returns jsonb language sql set search_path = '' as $$
  select jsonb_build_object(
    'scope', case when p_user_id is null then 'shared' else 'private' end,
    'memories', (select count(*) from brain.memories where status = 'active' and user_id is not distinct from p_user_id and legacy_owner is null),
    'byKind', (select coalesce(jsonb_object_agg(kind, n), '{}'::jsonb) from (select kind, count(*) n from brain.memories where status='active' and user_id is not distinct from p_user_id and legacy_owner is null group by kind) k),
    'newThisWeek', (select count(*) from brain.memories where status='active' and user_id is not distinct from p_user_id and legacy_owner is null and created_at > now() - interval '7 days'),
    'faded', (select count(*) from brain.memories where status='faded' and user_id is not distinct from p_user_id),
    'merged', (select count(*) from brain.memories where status='merged' and user_id is not distinct from p_user_id),
    'entities', (select count(*) from brain.entities where user_id is not distinct from p_user_id),
    'unembedded', (select count(*) from brain.memories where embedding is null and status='active' and user_id is not distinct from p_user_id),
    'legacyWaiting', (select count(*) from brain.memories where legacy_owner is not null),
    'skills', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) n from brain.skills group by status) s),
    'lastSleep', (select ran_at from brain.sleep_log order by ran_at desc limit 1)
  );
$$;
revoke all on function brain.stats(uuid) from public, anon, authenticated;
grant execute on function brain.stats(uuid) to service_role;
