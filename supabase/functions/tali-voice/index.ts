// supabase/functions/tali-voice/index.ts  (Tali HQ project jbyzblwrywgxilhmfyjt)
//
// Pro: Tali reads one of her replies out loud in her own voice (the Kokoro blend from her videos).
// The app sends { messageId }. We check the caller owns that message and is on Pro, reuse the clip
// if it was made before, otherwise ask the voice server (voice-server/ in the repo) for an MP3,
// save it in the private `voice` bucket and return a signed link valid for an hour.
// A new clip costs 1 credit; playing it again is free.
//
// Secrets: TALI_VOICE_URL (the voice server's https address), TALI_VOICE_KEY (its shared key).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const VOICE_URL = (Deno.env.get('TALI_VOICE_URL') ?? '').replace(/\/+$/, '');
const VOICE_KEY = Deno.env.get('TALI_VOICE_KEY') ?? '';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const fail = (code: string, message: string, status = 400) => json({ ok: false, code, message }, status);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('bad_request', 'POST only', 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: u } = await admin.auth.getUser(token);
  const user = u?.user;
  if (!user) return fail('unauthorized', 'Please sign in again.', 401);

  const { data: pro } = await admin.rpc('has_pro', { p_user_id: user.id });
  if (pro !== true) return fail('not_pro', 'Tali reading her replies out loud is part of Tali HQ Pro.', 402);
  if (!VOICE_URL || !VOICE_KEY) return fail('not_configured', "My voice switches on very soon. Hang tight.", 503);

  let body: { messageId?: string };
  try {
    body = await req.json();
  } catch {
    return fail('bad_request', 'Bad request.');
  }
  const messageId = String(body.messageId ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) return fail('bad_request', 'Bad request.');

  const { data: msg } = await admin.from('messages').select('id, user_id, role, content').eq('id', messageId).maybeSingle();
  if (!msg || msg.user_id !== user.id || msg.role !== 'assistant') return fail('not_found', 'That message was not found.', 404);

  const path = `${user.id}/${messageId}.mp3`;
  const signed = async () => (await admin.storage.from('voice').createSignedUrl(path, 3600)).data?.signedUrl ?? null;

  // Made before: free.
  const existing = await signed();
  if (existing) {
    const head = await fetch(existing, { method: 'HEAD' });
    if (head.ok) return json({ ok: true, url: existing, cached: true });
  }

  const { data: consume } = await admin.rpc('chat_try_consume', { p_user_id: user.id, p_feature: 'voice', p_credits: 1 });
  if (!consume?.ok) return fail(consume?.reason ?? 'no_access', "You've used this month's Tali credits.", 402);

  try {
    const res = await fetch(`${VOICE_URL}/speak`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-voice-key': VOICE_KEY },
      body: JSON.stringify({ text: String(msg.content).slice(0, 3000) }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) throw new Error(`voice server ${res.status}`);
    const mp3 = new Uint8Array(await res.arrayBuffer());
    const { error } = await admin.storage.from('voice').upload(path, mp3, { contentType: 'audio/mpeg', upsert: true });
    if (error) throw error;
    await admin.rpc('chat_finish', { p_usage_id: consume.usage_id, p_model: 'kokoro', p_tokens_in: 0, p_tokens_out: 0 });
    return json({ ok: true, url: await signed(), cached: false });
  } catch (e) {
    await admin.rpc('chat_refund', { p_usage_id: consume.usage_id });
    console.error('tali-voice failed', String(e));
    return fail('voice_unavailable', "I've lost my voice for a sec. Try again in a minute.", 503);
  }
});
