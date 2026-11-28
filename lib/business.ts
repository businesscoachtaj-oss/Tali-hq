// Did this person run a business? (10 Nov 2026) Answered in onboarding, changed in Settings.
import { useAuth, type Profile } from './auth';

// 28 Nov 2026 (Taj): Tali HQ became Learnéd, for life and learning. There is no business side any more,
// so nobody gets the Business mode, tools or plans, whatever they answered before.
export function hasBusiness(_p?: Profile | null): boolean {
  return false;
}

export function useHasBusiness(): boolean {
  return hasBusiness(useAuth().profile);
}
