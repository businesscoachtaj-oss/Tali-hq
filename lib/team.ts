// 12 Nov 2026 (Taj: "Build it all"): team seats on the Business plans.
//
// The owner invites teammates, picks a Standard or Premium seat for each (their own Tali credits)
// and chooses what each one can see. A teammate always sees the jobs and tasks given to them.
// Reading goes through database functions that only hand back what that person is allowed to
// see. Anything that changes the bill goes through the business-admin function.
import { supabase } from './supabase';

export type Seat = 'standard' | 'premium';
export const SEATS: Record<Seat, { label: string; price: number; credits: number; line: string }> = {
  standard: { label: 'Standard seat', price: 19.99, credits: 1000, line: '1,000 Tali credits a month. Right for most people.' },
  premium: { label: 'Premium seat', price: 49.99, credits: 3000, line: '3,000 Tali credits a month. For someone who leans on Tali all day.' },
};
export type Access = { can_customers: boolean; can_prices: boolean; can_money: boolean; can_pipeline: boolean };
export type TeamMember = Access & {
  id: string; name: string; email: string; role_title: string; seat: Seat; status: 'invited' | 'active';
  created_at: string; joined_at: string | null; allowance: number; used: number; jobs: number; tasks_open: number; tasks_done: number;
};
export type MemberOf = Access & { id: string; owner_id: string; business: string; owner_name: string; role_title: string; seat: Seat; live: boolean };
export type Team = { members: TeamMember[]; member_of: MemberOf[] };

/** One line on what a person can see, for their card. */
export function accessLine(a: Access): string {
  const bits = [a.can_customers ? 'customers' : '', a.can_prices ? 'prices' : '', a.can_money ? 'money' : '', a.can_pipeline ? 'pipeline' : ''].filter(Boolean);
  return bits.length ? `Jobs, ${bits.join(', ')}` : 'Jobs and tasks only';
}
export const seatsCost = (members: { seat: Seat }[]) => Math.round(members.reduce((a, m) => a + SEATS[m.seat].price, 0) * 100) / 100;

export async function myTeam(): Promise<Team> {
  const { data, error } = await supabase.rpc('team_mine');
  if (error) throw error;
  const d = (data ?? {}) as Partial<Team>;
  return { members: (d.members ?? []).map((m) => ({ ...m, used: Number(m.used) || 0 })), member_of: d.member_of ?? [] };
}

/** Picks up any invite sent to this person's email. Safe to call on every start. */
export async function claimInvites(): Promise<number> {
  const { data, error } = await supabase.rpc('team_claim');
  if (error) return 0;
  return Number(data) || 0;
}

async function adminCall(body: Record<string, unknown>): Promise<{ ok: boolean; message?: string; code?: string; id?: string; joined?: boolean; emailed?: boolean }> {
  const { data, error } = await supabase.functions.invoke('business-admin', { body });
  if (error) {
    try {
      const b = await (error as any).context?.json?.();
      if (b?.message) return { ok: false, message: b.message, code: b.code };
    } catch {}
    return { ok: false, message: "Couldn't reach the server. Try again." };
  }
  return data;
}
export const inviteTeammate = (p: { name: string; email: string; role_title: string; seat: Seat } & Access) => adminCall({ action: 'team_invite', ...p });
export const setSeat = (id: string, seat: Seat) => adminCall({ action: 'team_seat', id, seat });
export const removeTeammate = (id: string) => adminCall({ action: 'team_remove', id });
export const addBusiness = (p: { name: string; about: string; abn: string; colour: string }) => adminCall({ action: 'business_add', ...p });
export const removeBusiness = (id: string) => adminCall({ action: 'business_remove', id });

export async function setAccess(m: { id: string; name: string; role_title: string } & Access) {
  const { data, error } = await supabase.rpc('team_set_access', { p_id: m.id, p_name: m.name, p_role_title: m.role_title, p_customers: m.can_customers, p_prices: m.can_prices, p_money: m.can_money, p_pipeline: m.can_pipeline });
  if (error) throw error;
  if (data !== true) throw new Error('Could not save that.');
}

/** Leaves a team you were added to. Your own account and everything in it stays. */
export async function leaveTeam(rowId: string) {
  const { error } = await supabase.from('team_members').delete().eq('id', rowId);
  if (error) throw error;
}

// Who is on which job.
export type JobPerson = { job_id: string; team_member_id: string };
export async function jobPeople(): Promise<JobPerson[]> {
  const { data, error } = await supabase.from('job_people').select('job_id, team_member_id').limit(2000);
  if (error) throw error;
  return (data as JobPerson[]) ?? [];
}
export async function setOnJob(jobId: string, memberId: string, on: boolean) {
  const { error } = on
    ? await supabase.from('job_people').upsert({ job_id: jobId, team_member_id: memberId }, { onConflict: 'job_id,team_member_id', ignoreDuplicates: true })
    : await supabase.from('job_people').delete().eq('job_id', jobId).eq('team_member_id', memberId);
  if (error) throw error;
}
export async function assignTask(taskId: string, memberId: string | null, who: string) {
  const { error } = await supabase.from('project_tasks').update({ assignee_id: memberId, who: who.slice(0, 80) }).eq('id', taskId);
  if (error) throw error;
}

// What a teammate has been given.
export type WorkJob = { id: string; title: string; client_name: string; address: string; status: string; number: string; total: number | null; with: string[] };
export type WorkTask = { id: string; title: string; project: string; due_date: string | null; done_at: string | null };
export type Work = Access & {
  team_id: string; business: string; owner_name: string; role_title: string;
  jobs: WorkJob[]; tasks: WorkTask[];
  customers: { id: string; name: string; phone: string | null; email: string | null; notes: string | null }[] | null;
  invoices: { id: string; number: string; client_name: string; total: number; status: string; due_date: string }[] | null;
  bookings: { id: string; title: string; client_name: string; starts_at: string; minutes: number; place: string | null }[] | null;
  leads: { id: string; name: string; status: string; next_follow_up: string | null }[] | null;
};
export async function myWork(): Promise<Work[]> {
  const { data, error } = await supabase.rpc('team_my_work');
  if (error) throw error;
  return (data as Work[]) ?? [];
}
export async function tickMyTask(id: string) {
  const { data, error } = await supabase.rpc('team_tick_task', { p_task: id });
  if (error) throw error;
  if (data !== true) throw new Error('Could not tick that.');
}
export async function addCustomerNote(teamId: string, clientId: string, note: string) {
  const { data, error } = await supabase.rpc('team_add_client_note', { p_team: teamId, p_client: clientId, p_note: note });
  if (error) throw error;
  if (data !== true) throw new Error('Could not add that note.');
}
