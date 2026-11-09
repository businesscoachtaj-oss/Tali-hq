// supabase/functions/tali-transcribe/index.ts  (Tali HQ project jbyzblwrywgxilhmfyjt)
//
// Voice notes (3 Nov 2026): talk to Tali instead of typing. The app records a clip (up to 3 minutes),
// uploads it to the private chat-uploads bucket under <user id>/voice/<id>.<ext>, then calls this with
// { path, duration }. We check the caller owns that path, reserve 1 credit (feature voice_note), apply
// the plan gate (Free: no; HQ and trial: 1,800 seconds a month; Pro: no cap), download the clip with
// the service role, send it to OpenAI gpt-4o-mini-transcribe, write the clip length onto the usage row,
// delete the clip and return the text. The text lands in the Talk composer for a quick check, so nothing
// is sent to Tali from here.
//
// Secrets: OPENAI_API_KEY (required; without it the app shows "Voice notes are not switched on yet").
// Deployed with verify_jwt false; the JWT is checked here, like tali-chat.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const MODEL = 'gpt-4o-mini-transcribe';
const BUCKET = 'chat-uploads';
const MAX_SECONDS = 180;
const HQ_MONTHLY_SECONDS = 1800;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const fail = (code: string, message: string, status = 400, extra: Record<string, unknown> = {}) => json({ ok: false, code, message, ...extra }, status);

const strip = (s: string) => String(s ?? '').replace(/\s*[–—]\s*/g, ', ').replace(/\s+/g, ' ').trim();

function minutesLeft(seconds: number) {
  const m = Math.floor(Math.max(seconds, 0) / 60);
  return m === 1 ? '1 minute' : `${m} minutes`;
}

const mimeFor = (ext: string) =>
  ({ webm: 'audio/webm', mp4: 'audio/mp4', m4a: 'audio/mp4', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', '3gp': 'audio/3gpp' } as Record<string, string>)[ext] ?? 'application/octet-stream';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('bad_request', 'POST only', 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: u } = await admin.auth.getUser(token);
  const user = u?.user;
  if (!user) return fail('unauthorized', 'Please sign in again.', 401);

  let body: { path?: string; duration?: number };
  try {
    body = await req.json();
  } catch {
    return fail('bad_request', 'Bad request.');
  }
  const path = String(body.path ?? '');
  const prefix = `${user.id}/voice/`;
  const m = /^[0-9a-f-]{36}\/voice\/[A-Za-z0-9-]{1,80}\.(webm|mp4|m4a|mp3|ogg|wav|3gp)$/i.exec(path);
  if (!m || !path.startsWith(prefix)) return fail('bad_request', 'That voice note was not found.', 404);
  const ext = m[1].toLowerCase();
  const duration = Math.min(MAX_SECONDS, Math.max(1, Math.round(Number(body.duration) || 0)));
  const removeClip = () => admin.storage.from(BUCKET).remove([path]).catch(() => {});

  if (!OPENAI_KEY) {
    await removeClip();
    return fail('not_configured', 'Voice notes are not switched on yet.', 503);
  }

  // 1 credit, reserved before any work. Free gets no_access from chat_try_consume for anything but chat.
  const { data: consume, error: consumeErr } = await admin.rpc('chat_try_consume', { p_user_id: user.id, p_feature: 'voice_note', p_credits: 1 });
  if (consumeErr || !consume?.ok) {
    await removeClip();
    const reason = consume?.reason ?? 'no_access';
    if (reason === 'no_access') return fail('no_access', 'Voice notes are part of Tali HQ.', 402);
    if (reason === 'slow_down') return fail('slow_down', 'Easy, one at a time. Give it a minute.', 429);
    return fail(reason, "You've used this month's Tali credits.", 402);
  }
  const usageId = consume.usage_id as number;
  const plan = String(consume.plan ?? 'hq');

  // The monthly cap on HQ (and the trial). Pro has no cap.
  let secondsLeft: number | null = null;
  if (plan !== 'pro' && plan !== 'max') {
    const { data: used } = await admin.rpc('voice_seconds_this_month', { p_user_id: user.id });
    const usedSeconds = Number(used ?? 0);
    if (usedSeconds + duration > HQ_MONTHLY_SECONDS) {
      await admin.rpc('chat_refund', { p_usage_id: usageId });
      await removeClip();
      const left = Math.max(HQ_MONTHLY_SECONDS - usedSeconds, 0);
      const msg = left < 60
        ? "That's this month's 30 minutes of voice notes used. Pro has no cap, or type it for now."
        : `You've got ${minutesLeft(left)} of voice notes left this month and that clip is longer. Pro has no cap, or try a shorter one.`;
      return fail('voice_cap', msg, 402, { secondsLeft: left });
    }
    secondsLeft = HQ_MONTHLY_SECONDS - usedSeconds - duration;
  }

  try {
    const { data: file, error: dlErr } = await admin.storage.from(BUCKET).download(path);
    if (dlErr || !file) throw new Error(`download: ${dlErr?.message ?? 'empty'}`);

    const form = new FormData();
    form.append('file', new File([await file.arrayBuffer()], `note.${ext}`, { type: mimeFor(ext) }));
    form.append('model', MODEL);
    form.append('language', 'en');
    form.append('response_format', 'json');
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}` },
      body: form,
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const text = strip(data?.text ?? '');

    await admin.rpc('chat_finish', { p_usage_id: usageId, p_model: MODEL, p_tokens_in: 0, p_tokens_out: 0 });
    await admin.from('usage').update({ seconds: duration }).eq('id', usageId);
    await removeClip();

    if (!text) return json({ ok: true, text: '', seconds: duration, secondsLeft, empty: true, message: "I couldn't make out any words in that one. Have another go?" });
    return json({ ok: true, text, seconds: duration, secondsLeft });
  } catch (e) {
    await admin.rpc('chat_refund', { p_usage_id: usageId });
    await removeClip();
    console.error('tali-transcribe failed', String(e));
    return fail('transcribe_failed', "I couldn't hear that one properly. Try again, or type it.", 503);
  }
});
