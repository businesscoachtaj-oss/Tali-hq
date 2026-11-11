-- 12 Nov 2026 (Taj): the business side, stage 4. Projects: the bigger pieces of work, each with its tasks.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  client_id uuid references public.clients(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 160),
  who_for text not null default '' check (length(who_for) <= 120),
  status text not null default 'active' check (status in ('active', 'paused', 'done')),
  due_date date,
  notes text not null default '' check (length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_user_idx on public.projects (user_id, status, updated_at desc);
alter table public.projects enable row level security;
drop policy if exists "own projects all" on public.projects;
create policy "own projects all" on public.projects for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  who text not null default '' check (length(who) <= 80),
  due_date date,
  done_at timestamptz,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists project_tasks_project_idx on public.project_tasks (project_id, sort, created_at);
alter table public.project_tasks enable row level security;
drop policy if exists "own project tasks all" on public.project_tasks;
create policy "own project tasks all" on public.project_tasks for all to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())));
