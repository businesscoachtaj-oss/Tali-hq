// 12 Nov 2026 (Taj): Projects. The bigger pieces of work, each with its tasks.
import { supabase } from './supabase';

export type Project = { id: string; client_id: string | null; job_id: string | null; name: string; who_for: string; status: 'active' | 'paused' | 'done'; due_date: string | null; notes: string; updated_at: string };
export type ProjectTask = { id: string; project_id: string; title: string; who: string; due_date: string | null; done_at: string | null; sort: number };
const P = 'id, client_id, job_id, name, who_for, status, due_date, notes, updated_at';
const T = 'id, project_id, title, who, due_date, done_at, sort';

export async function projects(): Promise<Project[]> {
  const { data, error } = await supabase.from('projects').select(P).order('updated_at', { ascending: false }).limit(200);
  if (error) throw error;
  return (data as Project[]) ?? [];
}
export async function allTasks(): Promise<ProjectTask[]> {
  const { data, error } = await supabase.from('project_tasks').select(T).order('sort').order('created_at').limit(2000);
  if (error) throw error;
  return (data as ProjectTask[]) ?? [];
}
export async function saveProject(p: { id?: string; name: string; who_for: string; due_date: string | null; notes: string; status?: Project['status']; client_id?: string | null; job_id?: string | null }): Promise<Project> {
  const row = { name: p.name.trim().slice(0, 160), who_for: p.who_for.trim().slice(0, 120), due_date: p.due_date || null, notes: p.notes.slice(0, 4000), ...(p.status ? { status: p.status } : {}), ...(p.client_id !== undefined ? { client_id: p.client_id } : {}), ...(p.job_id !== undefined ? { job_id: p.job_id } : {}) };
  const q = p.id ? supabase.from('projects').update(row).eq('id', p.id) : supabase.from('projects').insert(row);
  const { data, error } = await q.select(P).single();
  if (error) throw error;
  return data as Project;
}
export async function deleteProject(id: string) {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}
export async function addTask(projectId: string, title: string, who = '', sort = 0) {
  const { error } = await supabase.from('project_tasks').insert({ project_id: projectId, title: title.trim().slice(0, 200), who: who.trim().slice(0, 80), sort });
  if (error) throw error;
}
export async function tickTask(t: ProjectTask) {
  const { error } = await supabase.from('project_tasks').update({ done_at: t.done_at ? null : new Date().toISOString() }).eq('id', t.id);
  if (error) throw error;
}
export async function deleteTask(id: string) {
  const { error } = await supabase.from('project_tasks').delete().eq('id', id);
  if (error) throw error;
}
