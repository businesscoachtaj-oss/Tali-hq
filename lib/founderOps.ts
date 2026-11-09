// Founder-only data for the Tuesday list (9 Nov 2026): trials and conversions across all three
// apps, the health light, the To confirm list and affiliates. Each is one RPC that refuses anyone
// but FOUNDER_USER_ID. Totality and Nutrition live in the Livewell project, so those RPCs read a
// snapshot a scheduled job copies across (test and gifted accounts already left out).
import { supabase } from '@/lib/supabase';

export type AppFunnel = { app: string; label: string; signups_7d: number; trialing: number; trials_ending_3d: number; paid_7d: number; cancelled_24h: number; locked_unpaid: number };
export type FounderApps = { generated_at: string; apps: AppFunnel[]; excluded: number };
export type Light = { key: string; label: string; status: 'green' | 'amber' | 'red'; detail: string };
export type FounderHealth = { checked_at: string; model_changed_at: string | null; model_checked: boolean; lights: Light[] };
export type ToConfirm = { id: string; text: string; added_at: string };
export type Affiliate = { id: string; name: string; handle: string | null; code: string | null; app: string; status: 'new' | 'active' | 'paused'; paying: number; owed_cents: number; audience?: string | null; platforms?: string[] };
export type FounderAffiliates = { applications: number; paying: number; owed_cents: number; paid_cents: number; affiliates: Affiliate[] };

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T | null> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return (data as T) ?? null;
}

export const founderApps = () => call<FounderApps>('founder_apps');
export const founderHealth = () => call<FounderHealth>('founder_health');
export const founderToConfirm = async () => (await call<ToConfirm[]>('founder_to_confirm')) ?? [];
export const founderConfirmDone = (id: string) => call('founder_confirm_done', { p_id: id });
export const founderModelChecked = () => call('founder_model_checked');
export const founderAffiliates = () => call<FounderAffiliates>('founder_affiliates');
export const founderApproveAffiliate = (id: string) => call('founder_approve_affiliate', { p_id: id });
