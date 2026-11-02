// supabase/functions/tali-draft-edit/index.ts  (Tali HQ project jbyzblwrywgxilhmfyjt)
//
// "Talk back to a draft" (2 Nov 2026). From a draft card on Today the user says "shorter",
// "warmer", "say Thursday 6am works" and Tali rewrites the draft in place. 1 credit.
//   POST { approvalId, instruction }   signed in (verify_jwt true)
//   -> { ok, body, subject? }          the approval's draft is updated; the old text is kept in draft.previous
// Secrets: ANTHROPIC_API_KEY, optional TALI_MODEL.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const TALI_MODEL = Deno.env.get('TALI_MODEL') ?? 'claude-haiku-5-5';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const fail = (code: string, message: string, status = 400) => json({ ok: false, code, message }, status);
const strip = (s: unknown) => String(s ?? '').replace(/\s*[–—]\s*/g, ', ').trim();

const PRESETS: Record<string, string> = {
  shorter: 'Make it shorter. Keep the point, cut the padding. Aim for half the length.',
  warmer: 'Make it warmer and friendlier, like a message to someone you like. Still plain and brief.',
  formal: 'Make it a touch more professional. No slang. Still human.',
  casual: 'Make it more casual and relaxed, like a text to a mate.',
};

const TOOL = {
  name: 'rewrite_draft',
  description: 'The rewritten draft.',
  input_schema: {
    type: 'object',
    properties: {
      body: { type: 'string', description: 'The full rewritten text, ready to send. Keep the sign-off style of the original.' },
      subject: { type: 'string', description: 'A new subject line only if the draft is an email and the instruction changes it. Otherwise empty.' },
    },
    required: ['body', 'subject'],
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('bad_request', 'POST only', 405);
  if (!ANTHROPIC_KEY) return fail('not_ready', "I can't think straight right now.", 503);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: u } = await admin.auth.getUser(token);
  const user = u?.user;
  if (!user) return fail('unauthorized', 'Please sign in again.', 401);

  const body = await req.json().catch(() => ({}));
  const approvalId = String(body.approvalId ?? '');
  const raw = String(body.instruction ?? '').trim().slice(0, 500);
  const instruction = PRESETS[raw.toLowerCase()] ?? raw;
  if (!approvalId || !instruction) return fail('bad_request', 'Tell me what to change.');

  const { data: a } = await admin.from('approvals').select('id, kind, title, draft, status').eq('id', approvalId).eq('user_id', user.id).maybeSingle();
  if (!a) return fail('not_found', "Couldn't find that draft.", 404);
  if (a.status !== 'pending') return fail('done', 'That one is already done.');
  const d = (a.draft ?? {}) as Record<string, any>;
  const current = String(d.body ?? '').trim();
  if (!current) return fail('bad_request', 'There is no text to change on this one.');

  const { data: consume } = await admin.rpc('chat_try_consume', { p_user_id: user.id, p_feature: 'draft_edit', p_credits: 1 });
  if (!consume?.ok) {
    const msg = consume?.reason === 'out_of_credits' ? "You've used this month's Tali credits." : consume?.reason === 'out_of_messages' ? "That's your free messages for this month." : 'Your plan does not include this yet.';
    return fail(consume?.reason ?? 'no_access', msg, 402);
  }
  const usageId = consume.usage_id as number;

  try {
    const { data: prof } = await admin.from('profiles').select('first_name, business_name, business_type').eq('id', user.id).maybeSingle();
    const system = [
      'You are Tali (said "tally"), the AI inside Tali HQ, made in Australia by Totality 360. You are editing a draft you wrote for a small business owner, to their instruction.',
      'Plain Australian English. Warm, direct, short sentences. Never use em dashes or en dashes. No hype words.',
      'Change only what the instruction asks for. Keep names, facts, dates and anything in [square brackets] exactly unless the instruction fills them in. Never add promises, prices or dates the owner did not give you.',
      `The owner: ${JSON.stringify(prof ?? {})}`,
    ].join(' ');
    const userMsg = [
      `Draft kind: ${a.kind}. Title: ${a.title}.`,
      d.to ? `To: ${d.to_name ?? ''} <${d.to}>` : '',
      d.subject ? `Subject: ${d.subject}` : '',
      d.summary ? `What they said: ${d.summary}` : '',
      `Current draft:\n<draft>\n${current}\n</draft>`,
      `Instruction from the owner: ${instruction}`,
    ].filter(Boolean).join('\n');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: TALI_MODEL, max_tokens: 1200, system, tools: [TOOL], tool_choice: { type: 'tool', name: TOOL.name }, messages: [{ role: 'user', content: userMsg }] }),
    });
    if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const block = (data.content ?? []).find((c: any) => c.type === 'tool_use' && c.name === TOOL.name);
    if (!block) throw new Error('no structured output');
    const next = strip(block.input?.body).slice(0, 6000);
    if (!next) throw new Error('empty rewrite');
    const subject = strip(block.input?.subject).slice(0, 300);
    const draft = { ...d, body: next, ...(subject && d.subject ? { subject } : {}), previous: [...(Array.isArray(d.previous) ? d.previous : []), current].slice(-3), edited_at: new Date().toISOString() };
    const { error } = await admin.from('approvals').update({ draft }).eq('id', a.id);
    if (error) throw error;
    await admin.rpc('chat_finish', { p_usage_id: usageId, p_model: data.model ?? TALI_MODEL, p_tokens_in: data.usage?.input_tokens ?? 0, p_tokens_out: data.usage?.output_tokens ?? 0 });
    return json({ ok: true, body: next, subject: subject && d.subject ? subject : d.subject ?? null });
  } catch (e) {
    await admin.rpc('chat_refund', { p_usage_id: usageId });
    console.error('draft edit failed', String(e));
    return fail('ai_unavailable', "I couldn't rework that one just now. Try again in a minute.", 503);
  }
});
