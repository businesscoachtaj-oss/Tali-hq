// 11 Nov 2026 (Taj: "the 5 parts of your world... it's all so bare and empty"): the lists that fill
// Your world in, and the "right now" lines each part opens with.
import { supabase } from '@/lib/supabase';
import { addDays, isoDate, today } from '@/lib/dates';
import type { SkinId } from '@/components/PageSkin';

export type ListKind = 'todo' | 'checkup' | 'admin' | 'home' | 'habit' | 'learning' | 'win' | 'someday' | 'idea';
export type LifeItem = {
  id: string;
  kind: ListKind;
  title: string;
  note: string;
  due_date: string | null;
  repeat_months: number | null;
  done_at: string | null;
  local_date: string | null;
  created_by: 'user' | 'tali';
  created_at: string;
};

// What each list is called and how it behaves. "ask" starts a chat with Tali already typed.
export const LISTS: Record<ListKind, {
  title: string; sub: string; skin: SkinId; back: string; add: string; placeholder: string; ask: string; example: string;
  due: boolean; repeat: boolean; tick: string | null; empty: string;
}> = {
  todo: { title: 'To do', sub: 'What is on your plate. Tell Tali and she adds it, or type it in.', skin: 'planner', back: 'Work', add: 'Add something to do', placeholder: 'Send the quote to Mia', ask: 'Add to my to do list: ', example: '"Add to my to do: send the quote to Mia by Friday."', due: true, repeat: false, tick: 'Done', empty: 'Nothing on your plate. Nice.' },
  checkup: { title: 'Check ups', sub: 'Doctor, dentist, scripts and anything else for your body that comes round again.', skin: 'gym', back: 'Health', add: 'Add a check up', placeholder: 'Dentist check up', ask: 'Add a check up: ', example: '"Dentist every 6 months, next one in March."', due: true, repeat: true, tick: 'Done', empty: 'No check ups yet.' },
  admin: { title: 'Life admin', sub: 'Rego, insurance, renewals, warranties. The dates you do not want to miss.', skin: 'receipt', back: 'Home and money', add: 'Add something', placeholder: 'Car rego', ask: 'Add to my life admin: ', example: '"Car rego is due 29 November, every year."', due: true, repeat: true, tick: 'Done', empty: 'Nothing here yet.' },
  home: { title: 'Home', sub: 'Jobs around the house and who to call.', skin: 'cork', back: 'Home and money', add: 'Add a job', placeholder: 'Fix the back gate', ask: 'Add a job around the house: ', example: '"The back gate needs fixing. Dave the handyman did it last time."', due: true, repeat: false, tick: 'Done', empty: 'No jobs. The house is behaving.' },
  habit: { title: 'Habits', sub: 'Small things you are building. Tick each one on the days you do it.', skin: 'finish', back: 'Growth', add: 'Add a habit', placeholder: 'Read 20 pages', ask: 'I want to build a habit: ', example: '"I want to read 20 pages a day."', due: false, repeat: false, tick: null, empty: 'No habits yet. Start with one small one.' },
  learning: { title: 'Learning', sub: 'What you are reading, watching or studying.', skin: 'nightschool', back: 'Growth', add: 'Add something', placeholder: 'Atomic Habits', ask: 'I am learning: ', example: '"I am reading Atomic Habits."', due: false, repeat: false, tick: 'Finished', empty: 'Nothing on the go yet.' },
  win: { title: 'Wins', sub: 'The good stuff, kept so you can look back on it.', skin: 'finish', back: 'Growth', add: 'Add a win', placeholder: 'Signed my biggest client yet', ask: 'A win today: ', example: '"Win: signed my biggest client yet."', due: false, repeat: false, tick: null, empty: 'No wins written down yet. Something went right this week.' },
  someday: { title: 'Someday', sub: 'Trips, dreams and things you want to do one day.', skin: 'dusk', back: 'Growth', add: 'Add something', placeholder: 'Take the kids to Japan', ask: 'Someday I want to: ', example: '"Someday I want to take the kids to Japan."', due: false, repeat: false, tick: 'Did it', empty: 'Nothing here yet. What would you love to do one day?' },
  idea: { title: 'Ideas', sub: 'Half thoughts she keeps warm for you.', skin: 'journal', back: 'Your words', add: 'Add an idea', placeholder: 'A weekend workshop for new mums', ask: 'An idea: ', example: '"Idea: a weekend workshop for new mums."', due: false, repeat: false, tick: 'Used it', empty: 'No ideas saved yet.' },
};

const COLS = 'id, kind, title, note, due_date, repeat_months, done_at, local_date, created_by, created_at';

export async function lifeItems(kind: ListKind): Promise<LifeItem[]> {
  const { data, error } = await supabase.from('life_items').select(COLS).eq('kind', kind).order('created_at', { ascending: false }).limit(300);
  if (error) throw error;
  return (data as LifeItem[]) ?? [];
}

export async function saveLifeItem(i: { id?: string; kind: ListKind; title: string; note?: string; due_date?: string | null; repeat_months?: number | null; local_date?: string | null }) {
  const row = {
    kind: i.kind,
    title: i.title.trim().slice(0, 200),
    note: (i.note ?? '').trim().slice(0, 2000),
    due_date: i.due_date || null,
    repeat_months: i.repeat_months || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = i.id
    ? await supabase.from('life_items').update(row).eq('id', i.id)
    : await supabase.from('life_items').insert({ ...row, local_date: i.local_date ?? today() });
  if (error) throw error;
}

export async function deleteLifeItem(id: string) {
  const { error } = await supabase.from('life_items').delete().eq('id', id);
  if (error) throw error;
}

// The same day of the month, n months on. 31 Jan plus a month lands on the last day of February.
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const first = new Date(y, m - 1 + n, 1, 12);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return isoDate(new Date(first.getFullYear(), first.getMonth(), Math.min(d, last), 12));
}

// Ticking something that comes round again moves its date on instead of closing it.
export async function tickLifeItem(i: LifeItem) {
  if (i.repeat_months && !i.done_at) {
    const from = i.due_date && i.due_date > today() ? i.due_date : today();
    const { error } = await supabase.from('life_items').update({ due_date: addMonths(from, i.repeat_months), updated_at: new Date().toISOString() }).eq('id', i.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('life_items').update({ done_at: i.done_at ? null : new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', i.id);
  if (error) throw error;
}

// ---------- Habits ----------
// The days each habit was done, over the last 60 days, keyed by habit id.
export async function habitTicks(): Promise<Record<string, string[]>> {
  const since = isoDate(addDays(new Date(), -60));
  const { data, error } = await supabase.from('habit_ticks').select('item_id, local_date').gte('local_date', since).order('local_date', { ascending: false });
  if (error) throw error;
  const out: Record<string, string[]> = {};
  for (const r of (data as { item_id: string; local_date: string }[]) ?? []) (out[r.item_id] ??= []).push(r.local_date);
  return out;
}

export async function setHabitDay(itemId: string, day: string, on: boolean) {
  const { error } = on
    ? await supabase.from('habit_ticks').upsert({ item_id: itemId, local_date: day }, { onConflict: 'item_id,local_date' })
    : await supabase.from('habit_ticks').delete().eq('item_id', itemId).eq('local_date', day);
  if (error) throw error;
}

// Days in a row up to today. A day not ticked yet today does not break a streak that ran to yesterday.
export function streak(days: string[]): number {
  const set = new Set(days);
  let d = new Date();
  if (!set.has(isoDate(d))) d = addDays(d, -1);
  let n = 0;
  while (set.has(isoDate(d))) { n++; d = addDays(d, -1); }
  return n;
}

// ---------- Birthdays ----------
export const NO_YEAR = 1904;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// "14 December", "14 Dec 1961" or "14/12" in, a date out. Null when it cannot be read.
export function parseBirthday(text: string): string | null {
  const t = text.trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, '$1').replace(/,/g, ' ');
  if (!t) return null;
  let day = 0, month = 0, year = NO_YEAR;
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const slash = t.match(/^(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?$/);
  const words = t.match(/^(\d{1,2})\s+([a-z]{3,})(?:\s+(\d{4}))?$/) ?? null;
  const wordsUs = t.match(/^([a-z]{3,})\s+(\d{1,2})(?:\s+(\d{4}))?$/) ?? null;
  const monthOf = (w: string) => MONTHS.findIndex((m) => m.toLowerCase().startsWith(w.slice(0, 3))) + 1;
  if (iso) { year = +iso[1]; month = +iso[2]; day = +iso[3]; }
  else if (slash) { day = +slash[1]; month = +slash[2]; if (slash[3]) year = slash[3].length === 2 ? (+slash[3] > 30 ? 1900 : 2000) + +slash[3] : +slash[3]; }
  else if (words) { day = +words[1]; month = monthOf(words[2]); if (words[3]) year = +words[3]; }
  else if (wordsUs) { month = monthOf(wordsUs[1]); day = +wordsUs[2]; if (wordsUs[3]) year = +wordsUs[3]; }
  else return null;
  if (month < 1 || month > 12 || day < 1 || year < 1900 || year > new Date().getFullYear()) return null;
  if (day > new Date(year, month, 0).getDate()) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function birthdayText(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}${y === NO_YEAR ? '' : ` ${y}`}`;
}

// Days until the next time it comes round (0 is today), and the age they turn if the year is known.
export function birthdayNext(iso: string): { days: number; date: string; turning: number | null } {
  const [y, m, d] = iso.split('-').map(Number);
  const now = new Date(`${today()}T12:00:00`);
  const on = (year: number) => {
    const last = new Date(year, m, 0).getDate();
    return new Date(year, m - 1, Math.min(d, last), 12);
  };
  let next = on(now.getFullYear());
  if (next.getTime() < now.getTime()) next = on(now.getFullYear() + 1);
  return { days: Math.round((next.getTime() - now.getTime()) / 86400000), date: isoDate(next), turning: y === NO_YEAR ? null : next.getFullYear() - y };
}

export function inDays(n: number): string {
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n < 0) return n === -1 ? 'yesterday' : `${-n} days ago`;
  return `in ${n} days`;
}

// ---------- Right now ----------
type Next = { title: string; days: number } | null;
export type WorldNow = {
  people: { family: number; friend: number; client: number; lead: number; new_leads: number; next_birthday: { name: string; days: number } | null; birthdays_30: number; stale: { name: string; days: number } | null };
  work: { emails_need: number; drafts_pending: number; owed: number; owed_count: number; todo_open: number; todo_today: number };
  health: { checkups: number; checkup_next: Next; moods_7: number };
  home: { admin_open: number; home_open: number; admin_next: Next };
  growth: { goals_business: number; goals_personal: number; habits: number; habits_today: number; learning: number; wins_month: number; someday: number };
  words: { last_journal: string | null; journal: number; notes: number; ideas: number };
};

export async function myWorld(): Promise<WorldNow | null> {
  const { data, error } = await supabase.rpc('my_world', { p_today: today() });
  if (error) throw error;
  const d = data as any;
  if (!d) return null;
  d.work.owed = Number(d.work.owed ?? 0);
  return d as WorldNow;
}

// "29 Nov", "29/11" or "2026-11-29" in, the next time that day comes round out. Null when it cannot be read.
export function parseDue(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(t)) {
    const [y, m, d] = t.split('-').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > new Date(y, m, 0).getDate() || y < 2000 || y > 2100) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const withYear = t.match(/(\d{4})\s*$/);
  const b = parseBirthday(withYear ? t.replace(/[\s\/.\-]*\d{4}\s*$/, '') : t);
  if (!b) return null;
  const [, m, d] = b.split('-').map(Number);
  if (withYear) {
    const y = +withYear[1];
    if (y < 2000 || y > 2100 || d > new Date(y, m, 0).getDate()) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return birthdayNext(`${NO_YEAR}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`).date;
}
