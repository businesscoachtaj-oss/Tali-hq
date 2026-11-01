-- Tali HQ migration 003: advisor fixes.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
create index if not exists entities_user_idx on brain.entities (user_id);
create index if not exists memories_merged_into_idx on brain.memories (merged_into);
create index if not exists queries_user_idx on brain.queries (user_id);
create index if not exists subscriptions_plan_idx on public.subscriptions (plan_id);
