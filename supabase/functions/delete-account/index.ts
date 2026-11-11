// supabase/functions/delete-account/index.ts  (Tali HQ project jbyzblwrywgxilhmfyjt)
//
// Deletes the signed-in user's account and everything tied to it (Apple and Google both
// require in-app account deletion). Deleting the auth user cascades to their profile,
// subscription row, usage, journal, chats, briefs, approvals, job runs and their private
// brain (memories, entities, queries). Her shared brain is untouched. Their stored files
// (chat uploads, receipts, exports, voice and profile photo) are removed first.
//
// The app asks the user to type DELETE first; this function checks that too.
// Taj's own account is protected because Tali's scheduled jobs run on its brain.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const PROTECTED = new Set(['e89ca9de-a86e-4dd6-8094-bc518566352e']);

const BUCKETS = ['chat-uploads', 'receipts', 'receipt-exports', 'voice', 'avatars'];

// Every bucket keeps one folder per person, named with their id. Folders can sit inside it (one per chat).
async function emptyFolder(bucket: string, folder: string, depth: number): Promise<void> {
  for (let page = 0; page < 20; page++) {
    const { data, error } = await admin.storage.from(bucket).list(folder, { limit: 1000 });
    if (error || !data?.length) return;
    const files = data.filter((x) => x.id).map((x) => `${folder}/${x.name}`);
    const folders = data.filter((x) => !x.id).map((x) => `${folder}/${x.name}`);
    if (depth < 4) for (const sub of folders) await emptyFolder(bucket, sub, depth + 1);
    if (files.length) await admin.storage.from(bucket).remove(files);
    if (!files.length) return;
  }
}

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

  // 12 Nov 2026: their files go too (chat uploads, receipts, exports, voice, profile photo). Deleting
  // the user does not remove stored files, so they are cleared first. A failure here never blocks the deletion.
  for (const bucket of BUCKETS) {
    try { await emptyFolder(bucket, user.id, 0); } catch (e) { console.error('delete-account files', bucket, String(e)); }
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) {
    console.error('delete-account failed', delErr.message);
    return json({ ok: false, code: 'server_error', message: 'Something went wrong. Try again, or email us and we will do it for you.' }, 500);
  }
  return json({ ok: true });
});
