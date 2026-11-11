import type { Credits } from './data';

// Trial or paid Tali HQ / Pro / Max. Health checks, invoices, web search and Tali's journal.
export function isPaid(c: Credits | null | undefined) {
  if (!c) return false;
  if (c.status === 'trialing') return !!c.trialEndsAt && new Date(c.trialEndsAt).getTime() > Date.now();
  return (c.plan === 'hq' || c.plan === 'pro' || c.plan === 'max') && (c.status === 'active' || c.status === 'past_due');
}

// Pro and Max: voice, Tali's email address and rules.
export function isPro(c: Credits | null | undefined) {
  return !!c && (c.plan === 'pro' || c.plan === 'max') && isPaid(c);
}

// Max (10 Nov 2026): Deep think, Big brain and second opinions at half the credits. Paying members only, not a trial.
export function isMax(c: Credits | null | undefined) {
  return !!c && c.plan === 'max' && (c.status === 'active' || c.status === 'past_due');
}

// 12 Nov 2026 (Taj): the Business plans. Jobs and quotes, Pipeline, Bookings, Projects, Website and
// On autopilot come with them. A Business member sits on plan 'max' for credits, and businessTier says
// which Business plan they pay for. The founder's account always has the business tools.
import { FOUNDER_USER_ID } from '@/constants/business';
export const BUSINESS_PLANS = ['biz', 'biz_pro', 'biz_max'];
export function hasBusinessTools(c: Credits | null | undefined, userId?: string | null) {
  if (userId && userId === FOUNDER_USER_ID) return true;
  return !!c && !!c.businessTier && BUSINESS_PLANS.includes(c.businessTier) && (c.status === 'active' || c.status === 'past_due');
}
