// Day into night (10 Nov 2026, Taj: "it's just too dark... how it is now is how it should fade into at
// shut-off"). The app's sky is lighter through the day and fades to her deep night sky over the two
// hours before your shut the day down time. It is night straight away once you shut the day down,
// and it stays night until dawn.
// 0 is full day, 1 is full night.
import { useEffect, useState } from 'react';
import { rhythmSettings } from './rhythm';

let dayShut = false;
let cachedShutoff: string | undefined;
const listeners = new Set<() => void>();
/** Today calls this when it knows whether today has been shut down. */
export function setDayShut(done: boolean) {
  if (dayShut === done) return;
  dayShut = done;
  listeners.forEach((l) => l());
}

export function skyBlendAt(now: Date, shutoff: string | null | undefined, done: boolean): number {
  const m = now.getHours() * 60 + now.getMinutes();
  if (m < 5 * 60) return 1; // the small hours
  if (m < 6 * 60) return 1 - (m - 300) / 60; // dawn, 5am to 6am
  if (done) return 1;
  const [h, mi] = String(shutoff ?? '21:00').split(':').map(Number);
  const off = (Number.isFinite(h) ? h : 21) * 60 + (Number.isFinite(mi) ? mi : 0);
  if (m >= off) return 1;
  if (m >= off - 120) return (m - (off - 120)) / 120;
  return 0;
}

export function useSkyBlend(): number {
  // The same shut the day down time the Today card uses. Until it loads, 9pm.
  const [shutoff, setShutoff] = useState<string | undefined>(cachedShutoff);
  useEffect(() => {
    rhythmSettings().then((r) => { cachedShutoff = r.shutdown_time?.slice(0, 5); setShutoff(cachedShutoff); }).catch(() => {});
  }, []);
  const read = () => {
    const forced = (globalThis as any).__skyBlend; // set by the screenshot script only
    return typeof forced === 'number' ? forced : skyBlendAt(new Date(), shutoff, dayShut);
  };
  const [blend, setBlend] = useState(read);
  useEffect(() => {
    const tick = () => setBlend(read());
    tick();
    listeners.add(tick);
    const t = setInterval(tick, 60000);
    return () => { listeners.delete(tick); clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shutoff]);
  return blend;
}
