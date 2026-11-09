// supabase/functions/founder-ops/index.ts  (Tali HQ project jbyzblwrywgxilhmfyjt)
//
// The top of the Founder screen (9 Nov 2026, Tali's Tuesday list items 2 and 7). Taj only.
//   apps:   signups, trials, paid, cancelled and lapsed accounts for Totality, Nutrition and Tali HQ.
//           Totality and Nutrition come from the Livewell project through tali_hq_founder_snapshot,
//           which checks a shared key and returns counts only (no names or emails). Test and gifted
//           accounts are left out on that side.
//   health: a light for Tali in Totality and Nutrition (ai_usage failures in 24 hours), Tali HQ's
//           scheduled jobs (job_runs failures in 24 hours) and payments (past due in any app), plus
//           when the AI model last changed and whether Taj has tested it since.
// Read only. Deployed with verify_jwt on.
//
// Secrets: LIVEWELL_FOUNDER_KEY (same value as the Livewell vault secret tali_hq_founder_key).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const FOUNDER = 'e89ca9de-a86e-4dd6-8094-bc518566352e';
const LIVEWELL_URL = 'https://spqazfyxxhzizbtmxklr.supabase.co';
// Livewell's public anon key (already in the Totality apps). The key check happens in the RPC.
const LIVEWELL_ANON = 'sb_publishable_zlny2kAAjetWEHlrFR_i3A_RrKixrSt';
const LIVEWELL_KEY = Deno.env.get('LIVEWELL_FOUNDER_KEY') ?? '';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const DAY = 86400000;

async function livewell(): Promise<any | null> {
  if (!LIVEWELL_KEY) return null;
  try {
    const r = await fetch(`${LIVEWELL_URL}/rest/v1/rpc/tali_hq_founder_snapshot`, {
      method: 'POST',
      headers: { apikey: LIVEWELL_ANON, Authorization: `Bearer ${LIVEWELL_ANON}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_key: LIVEWELL_KEY }),
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

async function taliHq() {
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const { data: subs } = await admin.from('subscriptions').select('user_id, status, trial_ends_at, stripe_subscription_id, updated_at');
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const all = subs ?? [];
  const t = (s: any) => (s.trial_ends_at ? Date.parse(s.trial_ends_at) : 0);
  return {
    app: 'talihq',
    label: 'Tali HQ',
    signups_7d: (users?.users ?? []).filter((u) => Date.parse(u.created_at) > now - 7 * DAY).length,
    trialing: all.filter((s) => s.status === 'trialing' && t(s) > now).length,
    trials_ending_3d: all.filter((s) => s.status === 'trialing' && t(s) > now && t(s) < now + 3 * DAY).length,
    paid_7d: all.filter((s) => s.status === 'active' && s.stripe_subscription_id && Date.parse(s.updated_at ?? '') > now - 7 * DAY).length,
    cancelled_24h: all.filter((s) => ['canceled', 'cancelled'].includes(s.status) && Date.parse(s.updated_at ?? '') > now - DAY).length,
    locked_unpaid: all.filter((s) => s.status === 'trialing' && t(s) && t(s) < now && !s.stripe_subscription_id).length,
    past_due: all.filter((s) => s.status === 'past_due').length,
    _since: iso(now - DAY),
  };
}

const light = (n: number, okText: string, badText: (n: number) => string, redAt = 5) => ({
  status: n === 0 ? 'green' : n >= redAt ? 'red' : 'amber',
  detail: n === 0 ? okText : badText(n),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: u } = await admin.auth.getUser(token);
  if (u?.user?.id !== FOUNDER) return json({ error: 'not allowed' }, 403);

  const [lw, hq] = await Promise.all([livewell(), taliHq()]);
  const { count: jobFails } = await admin.from('job_runs').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('started_at', hq._since);
  const { _since, past_due: hqPastDue, ...hqApp } = hq;

  const apps = [...(lw?.apps ?? []), hqApp];
  const model: string | null = lw?.tali_ai?.model ?? null;
  const { data: checked } = model ? await admin.from('founder_flags').select('key').eq('key', `model_checked:${model}`).maybeSingle() : { data: null };

  const aiErrors = Number(lw?.tali_ai?.errors_24h ?? 0);
  const pastDue = Number(lw?.payments?.past_due ?? 0) + hqPastDue;
  const lights = [
    lw
      ? { key: 'tali_ai', label: 'Tali in Totality and Nutrition', ...light(aiErrors, 'All good', (n) => `${n} error${n === 1 ? '' : 's'} in 24 hours`) }
      : { key: 'tali_ai', label: 'Tali in Totality and Nutrition', status: 'amber', detail: 'Could not reach Livewell' },
    { key: 'jobs', label: 'Tali HQ scheduled jobs', ...light(jobFails ?? 0, 'All good', (n) => `${n} failed in 24 hours`) },
    { key: 'payments', label: 'Payments past due', ...light(pastDue, 'None', (n) => `${n} past due`, 3) },
  ];

  return json({
    apps: apps.length ? { generated_at: new Date().toISOString(), apps, excluded: Number(lw?.excluded ?? 0) } : null,
    health: {
      checked_at: new Date().toISOString(),
      model,
      model_changed_at: lw?.tali_ai?.model_since ?? null,
      model_checked: !!checked,
      lights,
    },
  });
});
