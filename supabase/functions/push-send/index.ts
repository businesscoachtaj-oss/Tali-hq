// supabase/functions/push-send/index.ts  (Tali HQ project jbyzblwrywgxilhmfyjt)
//
// One place to send a push to a user, on every device they have (Expo and web). Added 2 Nov 2026.
//   POST {user_id, title, body, url?}   with x-tali-key (vault key): from public.push_user() in
//                                       the reminder and health cron jobs
//   POST {test: true}                   signed in: sends "Tali is on" to the caller's own devices,
//                                       so the Settings screen can confirm notifications work
//   GET  ?key=public                    the VAPID public key (also available as rpc vapid_public_key)
// verify_jwt is off; the signed-in path checks the JWT itself.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { pushUser } from '../_shared/push.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tali-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  if (req.method === 'GET') {
    const { data } = await admin.rpc('vapid_public_key');
    return json({ ok: true, publicKey: data ?? null });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, message: 'Bad request.' }, 400);
  }

  const key = req.headers.get('x-tali-key') ?? '';
  if (key) {
    const { data: ok } = await admin.rpc('brain_check_key', { p_key: key });
    if (ok !== true) return new Response('forbidden', { status: 403 });
    const userId = String(body.user_id ?? '');
    const title = String(body.title ?? '').slice(0, 80);
    const text = String(body.body ?? '').slice(0, 160);
    if (!userId || !title) return json({ ok: false, message: 'user_id and title are required.' }, 400);
    const sent = await pushUser(admin, userId, { title, body: text, url: String(body.url ?? '/') });
    return json({ ok: true, ...sent });
  }

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return json({ ok: false, code: 'unauthorized', message: 'Please sign in again.' }, 401);
  if (body.test) {
    const sent = await pushUser(admin, u.user.id, { title: 'Tali is on', body: "Notifications are working. I'll ping you when something needs you.", url: '/' });
    return json({ ok: true, ...sent });
  }
  return json({ ok: false, message: 'Unknown action.' }, 400);
});
