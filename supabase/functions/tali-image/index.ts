// supabase/functions/tali-image/index.ts  (Tali HQ project jbyzblwrywgxilhmfyjt)
//
// Tali makes images (6 Nov 2026, asked for by Taj). When someone asks Tali for an image in Talk,
// tali-chat saves her reply with a placeholder attachment {kind: image, making: true, prompt, shape}
// and the app calls this with { messageId, index }. We check the caller owns the message, reserve one
// image (image_try_consume: Free none, trial 5, Tali HQ 30 a month, Pro 100 a month), ask OpenAI to
// draw it, save the picture to the private chat-uploads bucket next to the conversation's other files,
// swap the placeholder for the real attachment and remember it in the visual part of her brain
// (kind 'seen', region occipital). If anything fails the image is refunded and the placeholder says so.
//
// Secrets: OPENAI_API_KEY (required), TALI_IMAGE_MODEL (optional, default gpt-image-2).
// Deployed with verify_jwt false; the JWT is checked here, like tali-chat.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const MODEL = Deno.env.get('TALI_IMAGE_MODEL') ?? 'gpt-image-2';
const BUCKET = 'chat-uploads';
const SIZES: Record<string, string> = { square: '1024x1024', portrait: '1024x1536', landscape: '1536x1024' };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const fail = (code: string, message: string, status = 400, extra: Record<string, unknown> = {}) => json({ ok: false, code, message, ...extra }, status);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('bad_request', 'POST only', 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: u } = await admin.auth.getUser(token);
  const user = u?.user;
  if (!user) return fail('unauthorized', 'Please sign in again.', 401);

  let body: { messageId?: string; index?: number };
  try {
    body = await req.json();
  } catch {
    return fail('bad_request', 'Bad request.');
  }
  const messageId = String(body.messageId ?? '');
  const index = Math.max(0, Math.floor(Number(body.index) || 0));
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) return fail('bad_request', 'That image was not found.', 404);

  const { data: msg } = await admin
    .from('messages')
    .select('id, conversation_id, user_id, role, attachments')
    .eq('id', messageId)
    .maybeSingle();
  const atts: any[] = Array.isArray(msg?.attachments) ? msg!.attachments : [];
  const job = atts[index];
  if (!msg || msg.user_id !== user.id || msg.role !== 'assistant' || job?.kind !== 'image' || !job?.prompt) {
    return fail('bad_request', 'That image was not found.', 404);
  }
  if (job.path) return json({ ok: true, attachment: job, already: true });
  if (job.deleted) return fail('deleted', 'You deleted this image.', 410);

  const setJob = async (patch: Record<string, unknown>) => {
    const next = atts.map((a, i) => (i === index ? { ...a, ...patch } : a));
    await admin.from('messages').update({ attachments: next }).eq('id', messageId);
    return next[index];
  };

  if (!OPENAI_KEY) {
    await setJob({ making: false, failed: 'Images are not switched on yet.' });
    return fail('not_configured', 'Images are not switched on yet.', 503);
  }

  const { data: consume, error: consumeErr } = await admin.rpc('image_try_consume', { p_user_id: user.id });
  if (consumeErr || !consume?.ok) {
    const reason = consume?.reason ?? 'no_access';
    const copy: Record<string, string> = {
      no_access: 'Images are part of Tali HQ. Move up a plan and Tali can make them for you.',
      out_of_images: consume?.trial
        ? "You've made the 5 images that come with the trial. Pick a plan for 30 or 100 a month."
        : `You've made all ${consume?.allowance ?? 'of'} this month's images. They top up on the 1st, or you can buy more from Top up on Me.`,
      slow_down: 'Easy, one at a time. Give it a minute.',
    };
    // slow_down can be tried again; the others cannot until the plan or month changes.
    if (reason !== 'slow_down') await setJob({ making: false, failed: copy[reason] ?? copy.no_access });
    return fail(reason, copy[reason] ?? copy.no_access, reason === 'slow_down' ? 429 : 402, { remaining: consume?.remaining ?? 0 });
  }
  const usageId = consume.usage_id as number;

  try {
    await setJob({ making: true, failed: null });
    const size = SIZES[String(job.shape)] ?? SIZES.square;
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt: String(job.prompt).slice(0, 3000), size, quality: 'medium', n: 1, user: user.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = data?.error?.code ?? '';
      // OpenAI turned the prompt down (their safety system): tell the user plainly, no charge.
      const blocked = code === 'moderation_blocked' || /safety|moderation/i.test(String(data?.error?.message ?? ''));
      throw new Error(blocked ? 'blocked' : `OpenAI ${res.status}: ${String(data?.error?.message ?? 'error').slice(0, 200)}`);
    }
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error('OpenAI returned no image');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

    const path = `${user.id}/${msg.conversation_id}/tali-${crypto.randomUUID()}.png`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/png', upsert: false });
    if (upErr) throw new Error(`upload: ${upErr.message}`);

    const attachment = await setJob({ making: false, failed: null, path, name: 'Tali image.png', size: bytes.length, made_at: new Date().toISOString() });
    await admin.from('usage').update({ model: MODEL }).eq('id', usageId);

    // The visual part of her brain remembers what she made, so she can make more in the same style.
    await admin.rpc('brain_remember_for', {
      p_user_id: user.id,
      p_kind: 'seen',
      p_content: `Made an image for them: ${String(job.prompt).replace(/\s*[–—]\s*/g, ', ').slice(0, 400)}`,
      p_about: ['image'],
      p_source_ref: `messages/${messageId}`,
      p_urgent: false,
    });

    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, 3600);
    return json({ ok: true, attachment: { ...attachment, url: signed?.signedUrl }, remaining: consume.remaining });
  } catch (e) {
    await admin.from('usage').delete().eq('id', usageId);
    const blocked = String(e).includes('blocked');
    const message = blocked
      ? "I can't make that one, it got knocked back by the image maker's safety check. Try describing it another way."
      : "That image didn't come through. It wasn't counted, try again.";
    await setJob({ making: false, failed: message });
    console.error('tali-image failed', String(e));
    return fail(blocked ? 'blocked' : 'server_error', message, blocked ? 422 : 500);
  }
});
