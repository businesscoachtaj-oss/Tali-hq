// supabase/functions/tali-link-app/index.ts  (Tali HQ project jbyzblwrywgxilhmfyjt)
//
// One brain (10 Nov 2026, asked for by Taj). "Use Totality too?" on Her brain. The signed in Tali HQ
// person gives their Totality email and password. This function:
//   1. checks they have not tried too often (5 an hour)
//   2. signs in to Totality as them (the Livewell project), with Totality's public app key
//   3. calls Totality's my_summary_for_tali_hq() as them: picked sign-up answers only, no free text,
//      nothing about clients, health, weight, food or payments
//   4. signs that Totality session out again
//   5. turns the answers into plain memories and saves them with app_link_save
// The password is used for step 2 only. It is never stored and never logged. Tali HQ holds no
// service key to the Totality database.
// Deployed with verify_jwt false (it checks the caller's sign in itself, like tali-chat).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const TOTALITY_URL = 'https://spqazfyxxhzizbtmxklr.supabase.co';
// Totality's public app key, the same one shipped inside the Totality apps. Not a secret.
const TOTALITY_KEY = Deno.env.get('TOTALITY_PUBLISHABLE_KEY') ?? 'sb_publishable_zlny2kAAjetWEHlrFR_i3A_RrKixrSt';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
// Problems the person can fix come back as 200 with ok false, so the app can show the message.
const sorry = (message: string) => json({ ok: false, message });

const ROLE: Record<string, string> = { trainer: 'a personal trainer', gym_admin: 'a gym owner', client: 'a member', nutrition_only: 'a Totality Nutrition member' };
const PLAN: Record<string, string> = { solo_10: 'Solo 10', solo_20: 'Solo 20', solo_50: 'Solo 50', solo_100: 'Solo 100', studio: 'Studio', club: 'Club', enterprise: 'Enterprise' };
const clean = (v: unknown, max = 60) => String(v ?? '').replace(/[\u2013\u2014]/g, ' to ').replace(/\s+/g, ' ').trim().slice(0, max);

type Item = { kind: 'fact' | 'preference'; content: string };

export function toMemories(s: any): Item[] {
  const out: Item[] = [];
  const role = ROLE[String(s?.role ?? '')];
  const business = clean(s?.business_name, 80);
  if (role) out.push({ kind: 'fact', content: `Uses Totality as ${role}${business && s.role !== 'client' ? `, trading as ${business}` : ''}.` });
  const plan = PLAN[String(s?.plan ?? '')];
  if (plan && (s?.role === 'trainer' || s?.role === 'gym_admin') && s?.plan_status === 'active') out.push({ kind: 'fact', content: `Their Totality plan is ${plan}.` });
  const t = s?.training ?? {};
  const goal = clean(t.goal);
  if (goal) out.push({ kind: 'fact', content: `Main training goal, chosen in Totality: ${goal}.` });
  const days = Number(t.days_per_week ?? s?.nutrition?.days_per_week);
  if (Number.isInteger(days) && days >= 1 && days <= 7) out.push({ kind: 'fact', content: `Trains ${days} ${days === 1 ? 'day' : 'days'} a week.` });
  const exp = clean(t.experience);
  if (exp) out.push({ kind: 'fact', content: `Training experience: ${exp}.` });
  const equipment = clean(t.equipment);
  const style = clean(t.style);
  if (equipment) out.push({ kind: 'preference', content: `Trains with: ${equipment}.` });
  if (style && style !== equipment) out.push({ kind: 'preference', content: `Likes to train: ${style}.` });
  const nGoal = clean(s?.nutrition?.goal);
  if (nGoal && nGoal !== goal) out.push({ kind: 'fact', content: `Main goal in Totality Nutrition: ${nGoal}.` });
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, message: 'POST only' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: u } = await admin.auth.getUser(token);
  const user = u?.user;
  if (!user) return json({ ok: false, message: 'Please sign in again.' }, 401);

  const body: any = await req.json().catch(() => ({}));
  if (body?.action !== 'link') return sorry('Nothing to do.');
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');
  if (!email || !password || email.length > 200 || password.length > 200) return sorry('Enter the email and password you use for Totality.');

  const { data: allowed } = await admin.rpc('app_link_allowed', { p_user_id: user.id });
  if (allowed !== true) return sorry('Too many tries. Give it an hour, then try again.');

  let access = '';
  try {
    const res = await fetch(`${TOTALITY_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: TOTALITY_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.status === 400 || res.status === 401 || res.status === 422) return sorry('That email and password did not match a Totality account.');
    if (!res.ok) return sorry('Totality did not answer. Try again in a minute.');
    access = String((await res.json())?.access_token ?? '');
    if (!access) return sorry('Totality did not answer. Try again in a minute.');
  } catch {
    return sorry('Could not reach Totality. Try again in a minute.');
  }

  let summary: any = null;
  try {
    const res = await fetch(`${TOTALITY_URL}/rest/v1/rpc/my_summary_for_tali_hq`, {
      method: 'POST',
      headers: { apikey: TOTALITY_KEY, Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (res.ok) summary = await res.json();
  } catch {
    summary = null;
  } finally {
    // close the Totality session this function opened; the person's own devices stay signed in
    await fetch(`${TOTALITY_URL}/auth/v1/logout?scope=local`, { method: 'POST', headers: { apikey: TOTALITY_KEY, Authorization: `Bearer ${access}` } }).catch(() => {});
  }
  if (!summary?.user_id) return sorry('I could not read your Totality account just now. Try again in a minute.');

  const items = toMemories(summary);
  const { data: saved, error } = await admin.rpc('app_link_save', { p_user_id: user.id, p_app: 'totality', p_remote_user_id: summary.user_id, p_items: items });
  if (error) {
    console.error('tali-link-app: save failed', error.message);
    return sorry('I could not save that. Try again in a minute.');
  }
  if (saved?.ok !== true) return sorry(saved?.why === 'taken' ? 'That Totality account is already linked to another Tali HQ account.' : 'I could not save that. Try again in a minute.');
  return json({ ok: true, brought: Number(saved.brought ?? 0) });
});
