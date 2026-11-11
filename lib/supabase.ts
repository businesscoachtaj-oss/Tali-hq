import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

// EAS builds from a clean git checkout, so .env never reaches the cloud builder.
// The values live in eas.json's env blocks (both are public). Fail loudly instead
// of crashing natively if they are ever missing (the Totality Nutrition 1.0.0 (8) lesson).
if (!url || !key) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY. Check eas.json or .env.');
}

// 11 Nov 2026 (Taj hit "Please sign in again." on Shut down with no way forward): when one of Tali's
// functions says the sign in is no good, get a fresh one and try once more. If a fresh one cannot be
// had (signed out on another device, password changed), sign out here so the sign in screen shows
// instead of a dead end.
let fixingSession: Promise<string | null> | null = null;
async function freshToken(): Promise<string | null> {
  fixingSession ??= supabase.auth.refreshSession()
    .then(({ data, error }) => (error || !data.session ? null : data.session.access_token))
    .catch(() => null)
    .finally(() => { fixingSession = null; });
  return fixingSession;
}
const fetchWithFreshSession: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (res.status !== 401 || !target.includes('/functions/v1/')) return res;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return res;
  const token = await freshToken();
  if (!token) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    return res;
  }
  const headers = new Headers(init?.headers ?? (typeof input === 'object' && 'headers' in input ? input.headers : undefined));
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
};

export const supabase = createClient(url, key, {
  global: { fetch: fetchWithFreshSession },
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Only the web build can read a session out of an emailed link.
    detectSessionInUrl: Platform.OS === 'web',
  },
});
