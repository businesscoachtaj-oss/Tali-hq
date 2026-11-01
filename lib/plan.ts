import type { Credits } from './data';

// Trial or paid Tali HQ / Pro. Health checks, invoices, web search and Tali's journal.
export function isPaid(c: Credits | null | undefined) {
  if (!c) return false;
  if (c.status === 'trialing') return !!c.trialEndsAt && new Date(c.trialEndsAt).getTime() > Date.now();
  return (c.plan === 'hq' || c.plan === 'pro') && (c.status === 'active' || c.status === 'past_due');
}

// Pro only: voice, Tali's email address and rules.
export function isPro(c: Credits | null | undefined) {
  return !!c && c.plan === 'pro' && isPaid(c);
}
