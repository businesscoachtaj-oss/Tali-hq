// Founder-only data for the Tuesday list (9 Nov 2026): trials and conversions across all three
// apps, the health light and the To confirm list. Taj only.
//   founder-ops (edge function): Totality and Nutrition numbers come from the Livewell project
//     (tali_hq_founder_snapshot, a key-checked read of counts only), Tali HQ's from this project.
//   founder_to_confirm / founder_confirm_done / founder_model_checked: RPCs in this project that
//     refuse anyone but FOUNDER_USER_ID.
import { supabase } from '@/lib/supabase';

export type AppFunnel = { app: string; label: string; signups_7d: number; trialing: number; trials_ending_3d: number; paid_7d: number; cancelled_24h: number; locked_unpaid: number };
export type FounderApps = { generated_at: string; apps: AppFunnel[]; excluded: number };
export type Light = { key: string; label: string; status: 'green' | 'amber' | 'red'; detail: string };
export type FounderHealth = { checked_at: string; model: string | null; model_changed_at: string | null; model_checked: boolean; lights: Light[] };
export type ToConfirm = { id: string; text: string; added_at: string };
export type FounderOpsData = { apps: FounderApps | null; health: FounderHealth | null; error?: string };

export async function founderOps(): Promise<FounderOpsData> {
  const { data, error } = await supabase.functions.invoke('founder-ops', { body: {} });
  if (error) throw error;
  return data as FounderOpsData;
}

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T | null> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return (data as T) ?? null;
}

export const founderToConfirm = async () => (await call<ToConfirm[]>('founder_to_confirm')) ?? [];
export const founderConfirmDone = (id: string) => call('founder_confirm_done', { p_id: id });
export const founderModelChecked = (model: string) => call('founder_model_checked', { p_model: model });
