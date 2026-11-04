// supabase/functions/tali-send/index.ts  (Tali HQ project jbyzblwrywgxilhmfyjt)
//
// ADDED (2 Nov 2026): one-tap send for replies to email that arrived at the user's own Tali
// address (<alias>@tali.totality360.com.au, Pro). The user taps "Send" on the draft on Today.
// Tali never sends on her own: this only runs from the user's tap.
//
// CHANGED (4 Nov 2026): if the user has Gmail or Outlook connected (with send), the reply goes out
// from that mailbox, the same way replies to their Gmail or Outlook mail do, so it comes from an
// address the other person knows. Only when neither is connected does it send from the Tali
// address through Resend. With no connection and no Resend key, the app falls back to copy.
//
// POST { approvalId }  (signed-in user). verify_jwt true.
// Returns { ok, from, via: 'gmail' | 'outlook' | 'tali' }.
// Secrets: RESEND_API_KEY, optional INBOUND_DOMAIN (defaults to tali.totality360.com.au).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { GoogleError, gmailSend, loadConnection as loadGoogle } from '../_shared/google.ts';
import { MsError, loadConnection as loadMicrosoft, mailSend } from '../_shared/microsoft.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const INBOUND_DOMAIN = (Deno.env.get('INBOUND_DOMAIN') || 'tali.totality360.com.au').toLowerCase();

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const fail = (code: string, message: string, status = 400) => json({ ok: false, code, message }, status);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// A display name safe to put in a From header.
const headerName = (s: string) => s.replace(/["<>\r\n]/g, '').trim().slice(0, 80);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('bad_request', 'POST only', 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: u } = await admin.auth.getUser(token);
  const user = u?.user;
  if (!user) return fail('unauthorized', 'Please sign in again.', 401);

  const body = await req.json().catch(() => ({}));
  const approvalId = String(body.approvalId ?? '');
  if (!approvalId) return fail('bad_request', 'Nothing to send.');

  const { data: a } = await admin.from('approvals').select('id, status, draft').eq('id', approvalId).eq('user_id', user.id).maybeSingle();
  if (!a) return fail('not_found', "Couldn't find that one.", 404);
  if (a.status !== 'pending' && a.status !== 'approved') return fail('done', 'That one is already done.');
  const d = (a.draft ?? {}) as Record<string, any>;

  // Only replies to email that came in to their Tali address.
  const emailId = String(d.from ?? '').startsWith('email/') ? String(d.from).slice(6) : '';
  if (!emailId || d.action) return fail('bad_request', 'That is not something I can send from here.');
  const { data: em } = await admin.from('inbound_emails').select('id, source').eq('id', emailId).eq('user_id', user.id).maybeSingle();
  if (!em || em.source !== 'tali_inbox') return fail('bad_request', 'That is not something I can send from here.');

  const { data: pro } = await admin.rpc('has_pro', { p_user_id: user.id });
  if (pro !== true) return fail('not_pro', 'Sending from your Tali address is part of Pro.');
  const { data: inbox } = await admin.from('tali_inboxes').select('alias').eq('user_id', user.id).maybeSingle();
  if (!inbox?.alias) return fail('no_address', 'Set up your Tali address on the Email screen first.');

  const to = String(d.to ?? '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return fail('bad_request', 'That email address does not look right.');
  const text = String(d.body ?? '').trim();
  if (!text) return fail('bad_request', 'That draft is empty.');
  const subject = String(d.subject ?? '').slice(0, 300) || '(no subject)';

  const { data: prof } = await admin.from('profiles').select('first_name, business_name').eq('id', user.id).maybeSingle();
  const address = `${inbox.alias}@${INBOUND_DOMAIN}`;

  const finish = async (from: string, via: 'gmail' | 'outlook' | 'tali', sentId: string | null) => {
    const now = new Date().toISOString();
    await admin.from('approvals').update({ status: 'done', decided_at: now, draft: { ...d, sent_id: sentId, sent_at: now, sent_from: from, sent_via: via } }).eq('id', a.id);
    await admin.from('inbound_emails').update({ status: 'handled' }).eq('id', emailId).eq('user_id', user.id);
    return json({ ok: true, from, via });
  };

  // 1. Their connected Gmail, if they have one with send.
  const google = await loadGoogle(admin, user.id).catch(() => null);
  if (google && google.scopes.includes('gmail')) {
    try {
      const sent = await gmailSend(admin, google, { to, subject, body: text, from_name: prof?.first_name ?? null });
      return await finish(google.google_email, 'gmail', sent?.id ?? null);
    } catch (e) {
      const msg = e instanceof GoogleError && e.status === 401 ? 'Google signed you out. Reconnect in Settings.' : "Gmail didn't take that one. Try again in a minute.";
      console.error('tali-send gmail failed', String(e));
      return fail('google_error', msg, 502);
    }
  }

  // 2. Their connected Outlook.
  const microsoft = await loadMicrosoft(admin, user.id).catch(() => null);
  if (microsoft && microsoft.scopes.includes('mail')) {
    try {
      const sent = await mailSend(admin, microsoft, { to, subject, body: text });
      return await finish(microsoft.ms_email, 'outlook', sent?.id ?? null);
    } catch (e) {
      const msg = e instanceof MsError && e.status === 401 ? 'Microsoft signed you out. Reconnect in Settings.' : "Outlook didn't take that one. Try again in a minute.";
      console.error('tali-send outlook failed', String(e));
      return fail('ms_error', msg, 502);
    }
  }

  // 3. Neither connected: from the Tali address itself, so the reply comes back to Tali.
  if (!RESEND_KEY) return fail('copy_only', 'Copy the reply and send it from your own email for now.', 503);
  const name = headerName(String(prof?.business_name || prof?.first_name || 'Tali HQ'));
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: name ? `${name} <${address}>` : address,
      to: [to],
      reply_to: address,
      subject,
      text,
      html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#272626;white-space:pre-wrap">${esc(text)}</div>`,
    }),
  });
  if (!res.ok) {
    console.error('tali-send resend failed', res.status, (await res.text()).slice(0, 300));
    return fail('send_failed', "That didn't send. Try again in a minute.", 502);
  }
  const sent = await res.json().catch(() => ({}));
  return await finish(address, 'tali', sent?.id ?? null);
});
