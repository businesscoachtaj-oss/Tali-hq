// lib/hqBoard.ts
// ADDED (17 Nov 2026, Taj): the numbers behind the Business blocks on the home (Team, Leads, Cash
// flow, Bookings today, Website visits, Quote win rate, Customer happiness). One call brings all of
// it. The owner sees everything; a teammate passes the owner and gets only what their seat allows.
// Read only: nothing here sends, spends or changes anything.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { todayKey } from './trackerMath';

export type Board = {
  locked?: boolean;
  can_money?: boolean; can_pipeline?: boolean; can_customers?: boolean;
  team?: { people: { name: string; role_title: string; status: string; me: boolean; jobs: string[]; tasks_open: number; overdue: number }[] };
  leads?: { new_week: number; need_reply: number; new: number; talking: number; won_month: number; names: string[] };
  bookings?: { today: { id: string; title: string; client_name: string; starts_at: string; minutes: number; status: string }[]; cancelled: number; requested: number; week: number };
  quote_rate?: { won: number; lost: number; waiting: number; won_value: number | null };
  cashflow?: { in_month: number; out_month: number; owed: number; late: number; due_30: number; costs_month: number | null };
  happiness?: { count: number; average: number | null; no_reply: number; recent: { id: string; name: string; rating: number; body: string; place: string; replied: boolean; day: string }[] };
  visits?: { has_site: boolean; week: number; last_week: number; top: string | null };
};

const cache = new Map<string, { at: number; board: Board | null }>();
const waiting = new Map<string, Promise<Board | null>>();

export function loadBoard(owner: string | null, business: string, force = false): Promise<Board | null> {
  const key = `${owner ?? 'me'}|${business}`;
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < 20000) return Promise.resolve(hit.board);
  const going = waiting.get(key);
  if (going) return going;
  const p = (async () => {
    const { data, error } = await supabase.rpc('hq_business_board', { p_owner: owner, p_business: business, p_today: todayKey() });
    const board = error ? null : ((data as Board | null) ?? null);
    cache.set(key, { at: Date.now(), board });
    waiting.delete(key);
    return board;
  })();
  waiting.set(key, p);
  return p;
}

/** The board for the Business blocks on a home. `tick` changes when Today reloads. */
export function useBoard(on: boolean, owner: string | null, business: string, tick: number) {
  const [board, setBoard] = useState<Board | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!on) return;
    let live = true;
    loadBoard(owner, business, tick > 0).then((b) => { if (live) { setBoard(b); setLoaded(true); } });
    return () => { live = false; };
  }, [on, owner, business, tick]);
  return { board, loaded };
}

export async function addReview(r: { name: string; rating: number; body: string; place: string }) {
  const { error } = await supabase.from('customer_reviews').insert({ name: r.name.trim().slice(0, 80), rating: r.rating, body: r.body.trim().slice(0, 1500), place: r.place.trim().slice(0, 40), day: todayKey() });
  if (error) throw new Error('Could not save that review. Try again.');
  cache.clear();
}
export async function markReplied(id: string, replied: boolean) {
  const { error } = await supabase.from('customer_reviews').update({ replied }).eq('id', id);
  if (error) throw new Error('Could not update that review.');
  cache.clear();
}
