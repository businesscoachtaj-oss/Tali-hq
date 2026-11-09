// supabase/functions/sending-health/index.ts  (Tali HQ project jbyzblwrywgxilhmfyjt)
//
// "Check before sending" (9 Nov 2026, Tali's Tuesday list). For one draft on Today, says which
// address it will go out from and how many emails from that address bounced in the last 30 days.
// Mirrors tali-send's choice of route: Gmail first, then Outlook, then the Tali address.
// Bounces are only known for the Tali address (Resend); for Gmail and Outlook bounces_30d is null
// and the app shows nothing. Read only: never sends or changes anything.
//
// Secrets: RESEND_API_KEY, optional INBOUND_DOMAIN (defaults to tali.totality360.com.au).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const INBOUND_DOMAIN = (Deno.env.get('INBOUND_DOMAIN') || 'tali.totality360.com.au').toLowerCase();

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function resendBounces(address: string): Promise<number | null> {
  if (!RESEND_KEY) return null;
  const since = Date.now() - 30 * 86400000;
  try {
    const r = await fetch('https://api.resend.com/emails?limit=100', { headers: { Authorization: `Bearer ${RESEND_KEY}` } });
    if (!r.ok) return null;
    const data = await r.json();
    const list: any[] = Array.isArray(data?.data) ? data.data : [];
    return list.filter((e) =>
      String(e.from ?? '').toLowerCase().includes(address) &&
      String(e.last_event ?? '') === 'bounced' &&
      Date.parse(e.created_at ?? '') >= since,
    ).length;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ address: null, bounces_30d: null }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: u } = await admin.auth.getUser(token);
  const user = u?.user;
  if (!user) return json({ address: null, bounces_30d: null }, 401);

  const body = await req.json().catch(() => ({}));
  const approvalId = String(body.approvalId ?? '');
  const { data: a } = await admin.from('approvals').select('id, draft').eq('id', approvalId).eq('user_id', user.id).maybeSingle();
  if (!a) return json({ address: null, bounces_30d: null });
  const d = (a.draft ?? {}) as Record<string, any>;

  const [{ data: g }, { data: ms }, { data: inbox }] = await Promise.all([
    admin.from('google_connections').select('google_email').eq('user_id', user.id).maybeSingle(),
    admin.from('microsoft_connections').select('ms_email').eq('user_id', user.id).maybeSingle(),
    admin.from('tali_inboxes').select('alias').eq('user_id', user.id).maybeSingle(),
  ]);

  if (d.action === 'gmail_send' || (!d.action && g?.google_email)) return json({ address: g?.google_email ?? null, via: 'gmail', bounces_30d: null });
  if (d.action === 'outlook_send' || (!d.action && ms?.ms_email)) return json({ address: ms?.ms_email ?? null, via: 'outlook', bounces_30d: null });
  if (!inbox?.alias) return json({ address: null, bounces_30d: null });

  const address = `${inbox.alias}@${INBOUND_DOMAIN}`.toLowerCase();
  return json({ address, via: 'tali', bounces_30d: await resendBounces(address) });
});
