// Which of Tali's extra abilities are switched on (10 Nov 2026). The server answers from which keys are
// set, so adding a key later turns a feature on with no new app build. Anything it does not report
// (or an older server) counts as off, and the app shows it as "Coming soon".
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type Capabilities = { video: boolean; second_opinion: boolean; better_memory: boolean; web_sources: boolean; voice: boolean; documents: boolean };
export const NO_CAPABILITIES: Capabilities = { video: false, second_opinion: false, better_memory: false, web_sources: false, voice: false, documents: false };

let cached: Capabilities | null = null;
let inFlight: Promise<Capabilities> | null = null;

export function capabilities(): Promise<Capabilities> {
  if (cached) return Promise.resolve(cached);
  if (!inFlight) {
    inFlight = supabase.functions
      .invoke('tali-chat', { body: { action: 'capabilities' } })
      .then(({ data, error }) => {
        const c = !error && data && typeof data === 'object' ? (data.capabilities ?? data) : null;
        const out: Capabilities = { ...NO_CAPABILITIES };
        if (c) for (const k of Object.keys(out) as (keyof Capabilities)[]) out[k] = c[k] === true;
        // Only remember a real answer, so a blip does not hide features for the whole session.
        if (c) cached = out;
        return out;
      })
      .catch(() => ({ ...NO_CAPABILITIES }))
      .finally(() => { inFlight = null; });
  }
  return inFlight;
}

export function useCapabilities(): Capabilities {
  const [caps, setCaps] = useState<Capabilities>(cached ?? NO_CAPABILITIES);
  useEffect(() => {
    let live = true;
    capabilities().then((c) => { if (live) setCaps(c); });
    return () => { live = false; };
  }, []);
  return caps;
}
