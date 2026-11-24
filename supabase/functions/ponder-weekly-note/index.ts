// ponder-weekly-note (25 Nov 2026): each Sunday, a short note to the grown-up a Gentle player in Ponder
// chose to share with. Which days they played and which games, never answers or scores.
// NOT SCHEDULED. Turn it on at launch with pg_cron (Sunday 5pm Sydney), after Taj says yes.
// verify_jwt false: called by pg_cron with the service role key in the Authorization header.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const FROM = Deno.env.get('PONDER_FROM') || 'Ponder <tali@tali.totality360.com.au>';
const NAMES: Record<string, string> = { six: 'Six Tries', four: 'Four by Four', pairs: 'Pairs', recall: 'Recall', sums: 'Sums', spot: 'Spot', room: 'Read the Room', breathe: 'Breathe', winddown: 'Wind Down', habits: 'Habits' };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

Deno.serve(async (req) => {
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (req.headers.get('Authorization') !== `Bearer ${service}`) return new Response('no', { status: 401 });
  const key = Deno.env.get('RESEND_API_KEY'); if (!key) return new Response('RESEND_API_KEY not set', { status: 500 });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, service);
  const { data, error } = await admin.rpc('ponder_weekly_notes');
  if (error) return new Response(error.message, { status: 500 });
  let sent = 0;
  for (const n of data ?? []) {
    const games = (n.games as string[]).map((g) => NAMES[g] ?? g).join(', ') || 'none this week';
    const subject = `${n.player}'s week in Ponder`;
    const text = `${n.player} played on ${n.days_played} of the last 7 days.\nGames: ${games}.\n${n.talked ? `Said yes to "Have you spoken with someone today?" on ${n.talked} day${n.talked === 1 ? '' : 's'}.\n` : ''}\nA nice next step: give ${n.player} a call, or play Pairs together next time you visit.\n\nThis shows which games and how often, never answers or scores. ${n.player} can stop sharing at any time.`;
    const html = `<div style="font-family:Arial,sans-serif;color:#1F1B16;max-width:520px"><p style="color:#5B4A86;font-size:12px;letter-spacing:1.5px">PONDER · ${esc(n.player.toUpperCase())}'S WEEK</p><h2 style="font-family:Georgia,serif">${esc(n.player)} played on ${n.days_played} of the last 7 days</h2><p>Games: ${esc(games)}.</p>${n.talked ? `<p>Said yes to "Have you spoken with someone today?" on ${n.talked} day${n.talked === 1 ? '' : 's'}.</p>` : ''}<p style="background:#DCEFEA;padding:12px;border-radius:10px">A nice next step: give ${esc(n.player)} a call, or play Pairs together next time you visit.</p><p style="color:#6B6358;font-size:12px">This shows which games and how often, never answers or scores. ${esc(n.player)} can stop sharing at any time.</p></div>`;
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: FROM, to: [n.email], subject, html, text }) });
    if (r.ok) sent++;
  }
  return Response.json({ sent });
});
