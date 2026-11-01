// supabase/functions/delete-account/index.ts  (Tali HQ project jbyzblwrywgxilhmfyjt)
//
// Deletes the signed-in user's account and everything tied to it (Apple and Google both
// require in-app account deletion). Deleting the auth user cascades to their profile,
// subscription row, usage, journal, chats, briefs, approvals, job runs and their private
// brain (memories, entities, queries). Her shared brain is untouched.
//
// The app asks the user to type DELETE first; this function checks that too.
// Taj's own account is protected because Tali's scheduled jobs run on its brain.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const PROTECTED = new Set(['e89ca9de-a86e-4dd6-8094-bc518566352e']);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, message: 'POST only' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data, error } = await admin.auth.getUser(token);
  const user = data?.user;
  if (error || !user) return json({ ok: false, code: 'unauthorized', message: 'Please sign in again.' }, 401);

  let body: { confirm?: string } = {};
  try {
    body = await req.json();
  } catch {}
  if (String(body.confirm ?? '').trim().toUpperCase() !== 'DELETE') {
    return json({ ok: false, code: 'bad_request', message: 'Type DELETE to confirm.' }, 400);
  }
  if (PROTECTED.has(user.id)) {
    return json({ ok: false, code: 'protected', message: "This account runs Tali's own jobs, so it can't be deleted from the app." }, 403);
  }

  // A live Stripe subscription would keep billing after deletion. Block until it is cancelled.
  const { data: sub } = await admin.from('subscriptions').select('status, stripe_subscription_id').eq('user_id', user.id).maybeSingle();
  if (sub?.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(sub.status)) {
    return json({ ok: false, code: 'active_subscription', message: 'Cancel your Tali HQ subscription first, then delete your account.' }, 409);
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) {
    console.error('delete-account failed', delErr.message);
    return json({ ok: false, code: 'server_error', message: 'Something went wrong. Try again, or email us and we will do it for you.' }, 500);
  }
  return json({ ok: true });
});
