// 12 Nov 2026 (Taj): one Tali, two views. Business mode is the business dashboard, Life mode is your day.
// Talk, Her brain and Me never change. The mode only changes what you look at.
import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { useAuth } from './auth';

export type Mode = 'business' | 'life';
export const MODE = {
  business: { label: 'Business', colour: '#7FA8FF', icon: 'briefcase-outline' as const },
  life: { label: 'Life', colour: '#FF9EC4', icon: 'heart-outline' as const },
};

const KEY = 'tali.mode';
let mode: Mode = 'business';
// What the clock last asked for, so a switch by hand holds until work starts or ends again.
let lastAuto: Mode | null = null;
const subs = new Set<() => void>();
const tell = () => subs.forEach((f) => f());

AsyncStorage.getItem(KEY).then((v) => {
  if ((v === 'life' || v === 'business') && v !== mode) { mode = v; tell(); }
}).catch(() => {});

export function setMode(m: Mode) {
  if (m === mode) return;
  mode = m;
  AsyncStorage.setItem(KEY, m).catch(() => {});
  tell();
}
export function useMode(): Mode {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => mode, () => mode);
}

/** Which side a thing belongs to. Unsorted things fall back to the side given. */
export function sideOf(x: { side?: string | null } | null | undefined, fallback: Mode): Mode {
  return x?.side === 'life' || x?.side === 'business' ? x.side : fallback;
}

const mins = (t: string | null | undefined, fallback: number) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(t ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : fallback;
};

/** Business in work hours, Life the rest of the time, in the person's own timezone. */
export type ClockSettings = { mode_auto: boolean; work_start: string; work_end: string; work_days: 'mon_fri' | 'mon_sat' | 'every_day' };
export const CLOCK_DEFAULTS: ClockSettings = { mode_auto: false, work_start: '09:00', work_end: '17:00', work_days: 'mon_fri' };
let clock: ClockSettings = CLOCK_DEFAULTS;

export async function loadClockSettings(userId: string): Promise<ClockSettings> {
  const { data, error } = await supabase.from('profiles').select('mode_auto, work_start, work_end, work_days').eq('id', userId).maybeSingle();
  if (error || !data) return clock;
  const d = data as any;
  clock = { mode_auto: !!d.mode_auto, work_start: String(d.work_start ?? '09:00').slice(0, 5), work_end: String(d.work_end ?? '17:00').slice(0, 5), work_days: ['mon_sat', 'every_day'].includes(d.work_days) ? d.work_days : 'mon_fri' };
  tell();
  return clock;
}
export async function saveClockSettings(userId: string, s: ClockSettings) {
  const { error } = await supabase.from('profiles').update({ mode_auto: s.mode_auto, work_start: `${s.work_start}:00`, work_end: `${s.work_end}:00`, work_days: s.work_days }).eq('id', userId);
  if (error) throw error;
  clock = s;
  lastAuto = null;
  tell();
}

export function clockMode(p: { timezone?: string | null; work_start?: string | null; work_end?: string | null; work_days?: string | null }, now = new Date()): Mode {
  let day = now.getDay(), minute = now.getHours() * 60 + now.getMinutes();
  try {
    const parts = new Intl.DateTimeFormat('en-AU', { timeZone: p.timezone || undefined, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
    const get = (t: string) => parts.find((x) => x.type === t)?.value ?? '';
    const d = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    if (d >= 0) day = d;
    minute = (Number(get('hour')) % 24) * 60 + Number(get('minute'));
  } catch {}
  const days = p.work_days === 'every_day' ? [0, 1, 2, 3, 4, 5, 6] : p.work_days === 'mon_sat' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
  const from = mins(p.work_start, 9 * 60), to = mins(p.work_end, 17 * 60);
  return days.includes(day) && minute >= from && minute < to ? 'business' : 'life';
}

/** Mount once (Today does). When "Switch by the clock" is on, follows work hours; a switch by hand holds until the next change. */
export function useClockMode() {
  const { profile, session } = useAuth();
  const uid = session?.user.id;
  const tz = profile?.timezone;
  // Re-run when the settings change (saveClockSettings and loadClockSettings both tell subscribers).
  const settings = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => clock, () => clock);
  useEffect(() => { if (uid) loadClockSettings(uid).catch(() => {}); }, [uid]);
  useEffect(() => {
    if (!settings.mode_auto) { lastAuto = null; return; }
    const check = () => {
      const want = clockMode({ timezone: tz ?? 'Australia/Sydney', ...settings });
      if (want !== lastAuto) { lastAuto = want; setMode(want); }
    };
    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, [settings, tz]);
}

/** Where an unsorted list item sits: work things with business, the rest with life. */
export function listFallback(kind: string, hasBusiness: boolean): Mode {
  return hasBusiness && (kind === 'todo' || kind === 'idea') ? 'business' : 'life';
}
