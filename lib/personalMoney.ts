// Personal money (11 Nov 2026, asked for by Taj): the Personal side of Money. Spends come in by
// telling Tali, snapping a receipt or typing them in. One weekly "left to spend" amount, monthly
// budgets by category and bills that repeat. Nothing here moves money.
import { supabase } from './supabase';

export const SPEND_CATEGORIES = ['Groceries', 'Rent', 'Bills', 'Eating out', 'Transport', 'Fun', 'Health', 'Shopping', 'Other'] as const;
export type SpendCategory = (typeof SPEND_CATEGORIES)[number];

export type Spend = { id: string; local_date: string; amount: number; description: string; category: string; source: 'tali' | 'receipt' | 'manual' | 'repeat' };
export type Repeat = { id: string; description: string; amount: number; category: string; every: 'week' | 'fortnight' | 'month'; next_date: string };
export type CategoryLine = { category: string; budget: number | null; spent: number };

export type PersonalMoney = {
  today: string;
  weekStart: string;
  weeklyAmount: number | null;
  weekSpent: number;
  monthSpent: number;
  monthBudget: number | null;
  categories: CategoryLine[];
  recent: Spend[];
  repeats: Repeat[];
};

// The phone's own date, so "today" and "this week" follow where the person is.
export const localToday = () => new Intl.DateTimeFormat('en-CA').format(new Date());

export const dollars = (n: number) => `A$${Math.round(n).toLocaleString('en-AU')}`;
export const cents = (n: number) => `A$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function loadPersonalMoney(): Promise<PersonalMoney> {
  const { data, error } = await supabase.rpc('my_personal_money', { p_today: localToday() });
  if (error) throw new Error('Could not load your personal money.');
  const d = (data ?? {}) as any;
  return {
    today: String(d.today ?? localToday()),
    weekStart: String(d.week_start ?? localToday()),
    weeklyAmount: d.weekly_amount == null ? null : Number(d.weekly_amount),
    weekSpent: Number(d.week_spent ?? 0),
    monthSpent: Number(d.month_spent ?? 0),
    monthBudget: d.month_budget == null ? null : Number(d.month_budget),
    categories: ((d.categories ?? []) as any[]).map((c) => ({ category: String(c.category), budget: c.budget == null ? null : Number(c.budget), spent: Number(c.spent ?? 0) })),
    recent: ((d.recent ?? []) as any[]).map((s) => ({ ...s, amount: Number(s.amount) })) as Spend[],
    repeats: ((d.repeats ?? []) as any[]).map((r) => ({ ...r, amount: Number(r.amount) })) as Repeat[],
  };
}

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Sign in first.');
  return data.user.id;
}

export async function addSpend(s: { amount: number; description: string; category: string; local_date: string; source: 'manual' | 'receipt' }) {
  const { error } = await supabase.from('personal_spends').insert({ ...s, user_id: await uid() });
  if (error) throw new Error('Could not save that spend. Check the details and try again.');
}

export async function updateSpend(id: string, s: { amount: number; description: string; category: string; local_date: string }) {
  const { error } = await supabase.from('personal_spends').update(s).eq('id', id);
  if (error) throw new Error('Could not save that change.');
}

export async function deleteSpend(id: string) {
  const { error } = await supabase.from('personal_spends').delete().eq('id', id);
  if (error) throw new Error('Could not delete that spend.');
}

// Saves the weekly amount and every category budget in one go. A blank or zero budget removes it.
export async function saveBudgets(weekly: number | null, budgets: Record<string, number | null>) {
  const user_id = await uid();
  const now = new Date().toISOString();
  const { error: e1 } = await supabase.from('personal_money_settings').upsert({ user_id, weekly_amount: weekly, updated_at: now });
  if (e1) throw new Error('Could not save your weekly amount.');
  const keep = Object.entries(budgets).filter(([, v]) => v != null && v > 0).map(([category, monthly]) => ({ user_id, category, monthly, updated_at: now }));
  const drop = Object.entries(budgets).filter(([, v]) => v == null || v <= 0).map(([category]) => category);
  if (keep.length) {
    const { error } = await supabase.from('personal_budgets').upsert(keep);
    if (error) throw new Error('Could not save your budgets.');
  }
  if (drop.length) {
    const { error } = await supabase.from('personal_budgets').delete().eq('user_id', user_id).in('category', drop);
    if (error) throw new Error('Could not save your budgets.');
  }
}

export async function addRepeat(r: { description: string; amount: number; category: string; every: Repeat['every']; next_date: string }) {
  const { error } = await supabase.from('personal_repeats').insert({ ...r, user_id: await uid() });
  if (error) throw new Error('Could not save that bill. Check the details and try again.');
}

export async function deleteRepeat(id: string) {
  const { error } = await supabase.from('personal_repeats').delete().eq('id', id);
  if (error) throw new Error('Could not remove that bill.');
}

// What Tali says at the top of the Personal side. Plain facts from the numbers, nothing invented.
export function taliPersonalLine(p: PersonalMoney): string {
  if (p.weeklyAmount == null && !p.recent.length) return 'Tell me what you spend, or snap a receipt, and I will keep the tally. Set a weekly amount and I will tell you what is left.';
  if (p.weeklyAmount == null) return `You have spent ${dollars(p.weekSpent)} this week. Set a weekly amount and I will tell you what is left.`;
  const left = p.weeklyAmount - p.weekSpent;
  if (left < 0) return `You are ${dollars(-left)} over for the week. It resets Monday.`;
  const over = p.categories.find((c) => c.budget != null && c.spent > c.budget);
  return `${dollars(left)} left for the week.${over ? ` ${over.category} is ${dollars(over.spent - (over.budget ?? 0))} over for the month.` : ''}`;
}
