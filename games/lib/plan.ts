// Which games are free inside Learnéd (28 Nov 2026, Taj: "the daily games are free for everyone").
// Free: Six Tries, Four by Four, Trail, Keys and Breathe, every day. A paid plan (or a live trial)
// opens every game, every level and the archive.
import { useEffect, useState } from 'react';
import { myCredits } from '@/lib/data';
import { isPaid } from '@/lib/plan';

export const FREE_GAMES = ['six', 'four', 'trail', 'keys', 'breathe'];

let cached: boolean | null = null;
const subs = new Set<(v: boolean) => void>();
export function refreshPaid() {
  return myCredits().then((c) => { cached = isPaid(c); subs.forEach((f) => f(cached!)); return cached; }).catch(() => false);
}

export function usePlus() {
  const [paid, setPaid] = useState<boolean>(cached ?? false);
  useEffect(() => {
    subs.add(setPaid);
    if (cached === null) refreshPaid();
    return () => { subs.delete(setPaid); };
  }, []);
  return { plus: paid, can: (id: string) => paid || FREE_GAMES.includes(id) };
}
