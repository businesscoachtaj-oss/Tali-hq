// supabase/functions/tali-welcome/index.ts  (Tali HQ project jbyzblwrywgxilhmfyjt)
//
// ADDED (10 Nov 2026, asked for by Taj): the welcome email. One short hello from Tali, sent once,
// a few minutes after someone confirms their email.
//
// Called every 5 minutes by pg_cron (migration 20261110000055_welcome_email.sql) with the vault key
// in x-tali-key, and only when public.welcome_due() has someone waiting. Deployed with
// verify_jwt false; the key check below is the gate.
//
// Never twice: each person is claimed first (welcome_emails.sent_at is set in one atomic write,
// and only one caller can win it), then sent. If the send fails the claim is released so the next
// run tries again. The send also carries an Idempotency-Key, so a retry inside a day cannot
// double up even if a claim was released after Resend had already taken the email.
// Never to people who joined before this went live, and never to an unconfirmed address: both rules
// live in public.welcome_due().
//
// POST {}                  send to whoever is due (up to PER_RUN).
// POST { "dry_run": true } list who would get it, send nothing.
//
// Secrets: RESEND_API_KEY (required). Optional: WELCOME_FROM (default below), WELCOME_REPLY_TO (a
// mailbox a person reads; when set the email also says "or just reply to this email"),
// WELCOME_APP_URL (default https://talihq.com.au).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { WELCOME_HTML, WELCOME_SUBJECT, WELCOME_SUBJECT_NAMED, WELCOME_TEXT } from './template.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
// The same verified sending domain tali-send uses.
const FROM = Deno.env.get('WELCOME_FROM') || 'Tali <tali@tali.totality360.com.au>';
const REPLY_TO = (Deno.env.get('WELCOME_REPLY_TO') ?? '').trim();
const APP_URL = Deno.env.get('WELCOME_APP_URL') || 'https://talihq.com.au';
const PER_RUN = 20;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// A first name is free text someone typed. Keep it short and plain before it goes in a subject line.
const cleanName = (s: unknown) => String(s ?? '').replace(/[\r\n<>"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);

function render(firstName: string) {
  const title = firstName ? `Good to meet you, ${firstName}` : 'Good to meet you';
  const html = WELCOME_HTML
    .replace('{{title}}', () => esc(title))
    .replaceAll('{{app_url}}', () => esc(APP_URL))
    .replace('{{reply_line}}', REPLY_TO ? ' Or just reply to this email.' : '');
  const text = WELCOME_TEXT
    .replace('{{title_text}}', () => title)
    .replaceAll('{{app_url}}', () => APP_URL)
    .replace('{{reply_line_text}}', REPLY_TO ? ' Or just reply to this email.' : '');
  const subject = firstName ? WELCOME_SUBJECT_NAMED.replace('{{first_name}}', () => firstName) : WELCOME_SUBJECT;
  return { subject, html, text };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const key = req.headers.get('x-tali-key') ?? '';
  if (!key) return new Response('forbidden', { status: 403 });
  const { data: ok } = await admin.rpc('brain_check_key', { p_key: key });
  if (ok !== true) return new Response('forbidden', { status: 403 });

  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dry_run === true;

  const { data: due, error } = await admin.rpc('welcome_due', { p_limit: PER_RUN });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  const people = (due ?? []) as { user_id: string; email: string; first_name: string | null }[];
  if (dryRun) return Response.json({ ok: true, dry_run: true, would_send: people.length, to: people.map((p) => p.user_id) });
  if (!RESEND_KEY) return Response.json({ ok: false, error: 'RESEND_API_KEY is not set' }, { status: 503 });

  let sent = 0, failed = 0, skipped = 0;
  for (const person of people) {
    // Claim first. Only one caller can turn sent_at from null to a time.
    const { data: claimed } = await admin.rpc('welcome_claim', { p_user_id: person.user_id });
    if (claimed !== true) { skipped++; continue; }
    const { subject, html, text } = render(cleanName(person.first_name));
    let good = false;
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `tali-welcome/${person.user_id}` },
        body: JSON.stringify({ from: FROM, to: [person.email], ...(REPLY_TO ? { reply_to: REPLY_TO } : {}), subject, html, text }),
      });
      good = res.ok;
      if (!good) console.error('tali-welcome resend failed', res.status, (await res.text()).slice(0, 300));
    } catch (e) {
      console.error('tali-welcome send threw', String(e));
    }
    if (good) sent++;
    else {
      failed++;
      // Let the next run try again. After 3 goes welcome_due stops offering this person.
      await admin.rpc('welcome_release', { p_user_id: person.user_id });
    }
  }
  return Response.json({ ok: true, sent, failed, skipped });
});
