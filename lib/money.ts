// Money picture (3 Nov 2026): the owner's view of cash in, owed, overdue, going out and runway.
// Read only. Tali HQ never runs billing; the numbers come from the app's invoices and, when
// connected, the business's own Stripe through the stripe-invoices function (action 'money').
import { supabase } from './supabase';

export type OverdueInvoice = { id: string; number: string; client_name: string; client_id: string | null; total: number; due_date: string; stripe_url: string | null };

export type MoneySummary = {
  paid_this_month: number;
  owed: number;
  overdue: number;
  overdue_invoices: OverdueInvoice[];
  monthly_costs: number | null;
  cash_on_hand: number | null;
  money_updated_at: string | null;
  month_start: string;
};

export type StripeMoney = { connected: boolean; cash_in?: number; charges?: number; available?: number | null; currency?: string };

export type MoneyPicture = {
  cashIn: number;            // Stripe charges this month when connected, else invoices marked paid this month
  cashInSource: 'stripe' | 'invoices';
  owed: number;
  overdue: number;
  overdueInvoices: OverdueInvoice[];
  goingOut: number | null;   // profiles.monthly_costs
  cashOnHand: number | null; // profiles.cash_on_hand, or Stripe available balance when not set
  cashSource: 'entered' | 'stripe' | null;
  runwayWeeks: number | null; // only when monthly_costs is set and there is a cash figure
  updatedAt: string | null;
};

export async function moneySummary(): Promise<MoneySummary> {
  const { data, error } = await supabase.rpc('my_money_summary');
  if (error) throw error;
  const d = (data ?? {}) as any;
  return {
    paid_this_month: Number(d.paid_this_month ?? 0),
    owed: Number(d.owed ?? 0),
    overdue: Number(d.overdue ?? 0),
    overdue_invoices: ((d.overdue_invoices as any[]) ?? []).map((i) => ({ ...i, total: Number(i.total) })),
    monthly_costs: d.monthly_costs == null ? null : Number(d.monthly_costs),
    cash_on_hand: d.cash_on_hand == null ? null : Number(d.cash_on_hand),
    money_updated_at: d.money_updated_at ?? null,
    month_start: d.month_start ?? '',
  };
}

// Cash in through their connected Stripe this month. Returns connected:false when there is no Stripe.
export async function stripeMoney(): Promise<StripeMoney> {
  const { data, error } = await supabase.functions.invoke('stripe-invoices', { body: { action: 'money' } });
  if (error || !data?.ok) return { connected: false };
  return data as StripeMoney;
}

// The five numbers plus runway, worked out from the summary and Stripe (when connected).
export function buildPicture(s: MoneySummary, st: StripeMoney | null): MoneyPicture {
  const stripeOn = !!st?.connected;
  const cashIn = stripeOn ? Number(st?.cash_in ?? 0) : s.paid_this_month;
  const cashOnHand = s.cash_on_hand != null ? s.cash_on_hand : stripeOn && st?.available != null ? Number(st.available) : null;
  const cashSource: MoneyPicture['cashSource'] = s.cash_on_hand != null ? 'entered' : cashOnHand != null ? 'stripe' : null;
  const costs = s.monthly_costs;
  const runwayWeeks = costs && costs > 0 && cashOnHand != null ? Math.max(0, cashOnHand / (costs / 4.33)) : null;
  return {
    cashIn,
    cashInSource: stripeOn ? 'stripe' : 'invoices',
    owed: s.owed,
    overdue: s.overdue,
    overdueInvoices: s.overdue_invoices,
    goingOut: costs,
    cashOnHand,
    cashSource,
    runwayWeeks,
    updatedAt: s.money_updated_at,
  };
}

export async function loadMoneyPicture(): Promise<MoneyPicture> {
  const [s, st] = await Promise.all([moneySummary(), stripeMoney().catch(() => null)]);
  return buildPicture(s, st);
}

export async function saveMoneySettings(monthlyCosts: number | null, cashOnHand: number | null) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Please sign in again.');
  const { error } = await supabase
    .from('profiles')
    .update({ monthly_costs: monthlyCosts, cash_on_hand: cashOnHand, money_updated_at: new Date().toISOString() })
    .eq('id', u.user.id);
  if (error) throw error;
}

export const money0 = (n: number) => `A$${Math.round(Number(n) || 0).toLocaleString('en-AU')}`;

// Tali's one line about the picture. Plain rules, no Claude call, no credits.
export function taliMoneyLine(p: MoneyPicture): string {
  const n = p.overdueInvoices.length;
  if (n > 0) {
    const who = n === 1 ? `${p.overdueInvoices[0].client_name}'s invoice is overdue` : `${n === 2 ? 'Two' : n === 3 ? 'Three' : n} invoices overdue`;
    return `${who}, ${money0(p.overdue)}. Worth a nudge.`;
  }
  if (p.runwayWeeks != null && p.runwayWeeks < 6) {
    return `Nothing overdue, but about ${Math.round(p.runwayWeeks)} weeks of runway. Keep an eye on it.`;
  }
  if (p.owed > 0) return `Nothing overdue. ${money0(p.owed)} still to come in.`;
  if (p.cashIn > 0) return `Nothing overdue. ${money0(p.cashIn)} in so far this month. Nice.`;
  return 'Nothing overdue. Nice.';
}

export function runwayLabel(weeks: number | null) {
  if (weeks == null) return null;
  if (weeks >= 104) return '2 years+';
  if (weeks >= 52) return `${(weeks / 52).toFixed(1)} years`;
  return `${Math.round(weeks)} wk${Math.round(weeks) === 1 ? '' : 's'}`;
}
