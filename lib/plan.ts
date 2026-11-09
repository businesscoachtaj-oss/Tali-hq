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
