// Speed pass (13 Nov 2026): the screens all reloaded every list the moment they were opened,
// so switching tabs ran a burst of fetches and re-renders while the new screen was still
// appearing. useFocusLoad reloads on focus like before, but:
//   - after the switch has painted (next frame), not during it
//   - not again if the same screen loaded in the last few seconds (quick back and forth),
//     unless what it loads changed (load is a new function, e.g. a different person's page)
//   - not while a load for that screen is still running
// Actions on a screen still call load() straight away, and pull to refresh still works.
import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

export function useFocusLoad(load: () => unknown, minGapMs = 5000) {
  const last = useRef(0);
  const running = useRef(false);
  const lastFn = useRef<unknown>(null);
  useFocusEffect(
    useCallback(() => {
      const same = lastFn.current === load;
      if (same && (running.current || Date.now() - last.current < minGapMs)) return;
      let cancelled = false;
      const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (f: () => void) => setTimeout(f, 16) as unknown as number;
      const caf = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : (id: number) => clearTimeout(id);
      const id = raf(() => {
        if (cancelled) return;
        running.current = true;
        last.current = Date.now();
        lastFn.current = load;
        Promise.resolve()
          .then(load)
          .catch(() => {})
          .finally(() => { running.current = false; });
      });
      return () => { cancelled = true; caf(id); };
    }, [load, minGapMs]),
  );
}
