// supabase/functions/_shared/consent.ts (22 Nov 2026, App Review 5.1.1(i) and 5.1.2(i))
//
// Nothing about a person goes to an AI company until they have said yes on the "Tali and your data"
// screen (profiles.ai_consent_at). Functions a person calls check this and answer with the code
// 'ai_consent', which the app turns into that screen. Scheduled jobs skip people who have not said yes.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';

export const AI_CONSENT_CODE = 'ai_consent';
export const AI_CONSENT_MESSAGE = 'Tali needs your yes before she uses AI. Turn her on in Me, then Tali and your data.';

export async function hasAiConsent(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin.from('profiles').select('ai_consent_at').eq('id', userId).maybeSingle();
  return !!data?.ai_consent_at;
}

// The ids in a list that have said yes, for scheduled jobs that work through many people.
export async function consentedIds(admin: SupabaseClient, userIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Set();
  const { data } = await admin.from('profiles').select('id').in('id', ids).not('ai_consent_at', 'is', null);
  return new Set((data ?? []).map((r: { id: string }) => r.id));
}
