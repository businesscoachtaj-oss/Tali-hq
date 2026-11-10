// Does this person run a business? (10 Nov 2026) Answered in onboarding, changed in Settings.
// Until they answer, anyone with a business name or type counts as yes, so nothing changes for
// people who signed up before the question had its own answer.
import { useAuth, type Profile } from './auth';

export function hasBusiness(p: Profile | null | undefined): boolean {
  if (!p) return true; // still loading: show everything rather than flash the short version
  if (p.has_business === true || p.has_business === false) return p.has_business;
  return !!p.business_type || !!p.business_name;
}

export function useHasBusiness(): boolean {
  return hasBusiness(useAuth().profile);
}
