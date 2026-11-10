// One brain (10 Nov 2026, asked for by Taj). Someone who also uses Totality or Totality Nutrition
// can bring across what they told Tali there. Opt in, proved by signing in, one way into Tali HQ.
// See docs/PLAN_ONE_BRAIN.md.
import { supabase } from '@/lib/supabase';

export type AppLink = { app: 'totality'; linked_at: string; brought: number };

export async function myAppLink(): Promise<AppLink | null> {
  const { data, error } = await supabase.rpc('my_app_links');
  if (error || !Array.isArray(data) || !data.length) return null;
  const l = data[0] as any;
  return { app: 'totality', linked_at: String(l.linked_at ?? ''), brought: Number(l.brought ?? 0) };
}

// The password goes straight to the server over a secure connection, is used once to sign in to
// Totality, and is never stored or logged.
export async function linkTotality(email: string, password: string): Promise<{ ok: boolean; brought?: number; message?: string }> {
  const { data, error } = await supabase.functions.invoke('tali-link-app', { body: { action: 'link', email: email.trim(), password } });
  if (error || !data) return { ok: false, message: 'Could not reach Totality. Try again in a minute.' };
  return { ok: !!(data as any).ok, brought: Number((data as any).brought ?? 0), message: (data as any).message };
}

export async function unlinkTotality(): Promise<boolean> {
  const { data, error } = await supabase.rpc('my_app_unlink', { p_app: 'totality' });
  return !error && data !== false;
}
