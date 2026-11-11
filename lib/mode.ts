// MOCK (12 Nov 2026, Taj's brainstorm): one Tali, two views. Business mode is a dashboard, Life mode is
// your day. Talk, Her brain and Me never change. The mode only changes what you look at.
import { useSyncExternalStore } from 'react';

export type Mode = 'business' | 'life';
export const MODE = {
  business: { label: 'Business', colour: '#7FA8FF', icon: 'briefcase-outline' as const },
  life: { label: 'Life', colour: '#FF9EC4', icon: 'heart-outline' as const },
};

const KEY = 'tali.mode';
function read(): Mode {
  try { const v = globalThis.localStorage?.getItem(KEY); if (v === 'life' || v === 'business') return v; } catch {}
  return 'business';
}
let mode: Mode = read();
const subs = new Set<() => void>();
export function setMode(m: Mode) {
  mode = m;
  try { globalThis.localStorage?.setItem(KEY, m); } catch {}
  subs.forEach((f) => f());
}
export function useMode(): Mode {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => mode, () => mode);
}
/** Everything carries a tag. Until something is tagged, it sits with business (reminders, follow-ups). */
export function tagOf(x: any, fallback: Mode = 'business'): Mode {
  return x?.tag === 'life' || x?.tag === 'business' ? x.tag : fallback;
}
