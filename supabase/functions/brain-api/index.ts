// supabase/functions/brain-api/index.ts  (Tali HQ project jbyzblwrywgxilhmfyjt)
//
// 27 Nov 2026 (Taj): the Tali Brain licence. Software companies put Tali's brain inside their own
// product. Each business on their platform gets its own private brain. Deployed with verify_jwt false:
// it checks API keys, console sign ins and panel tokens itself.
//
// Four ways in:
//   API key (Authorization: Bearer thb_live_... or thb_test_...), from the licensee's servers:
//     GET    /v1/me                                   plan, mode and answers used
//     GET    /v1/businesses                           the businesses that have a brain
//     PUT    /v1/businesses/{id}                      { name } make or rename one (also made on first sight)
//     GET    /v1/businesses/{id}/export               everything in that brain
//     DELETE /v1/businesses/{id}                      delete that brain
//     PUT    /v1/businesses/{id}/clients/{id}         { name }
//     DELETE /v1/businesses/{id}/clients/{id}         forget a client
//     POST   /v1/events                               what happened. Tali keeps the facts that last. Free.
//     GET    /v1/memories?business_id=&client_id=&q=  what Tali knows
//     POST   /v1/memories                             tell Tali a fact
//     PATCH  /v1/memories/{id}   DELETE /v1/memories/{id}
//     POST   /v1/answers                              draft, brief, summary, booking or ask. 1 answer each.
//     POST   /v1/answers/{id}/outcome                 { outcome: approved | edited | rejected }
//     POST   /v1/panel-tokens                         a short lived token for the drop in panel
//   Panel token (Bearer thp_...), from the panel page in the licensee's product: /panel/*
//   Console sign in (a Supabase session), POST /console { action }: keys, settings, usage, billing.
//   Cron (x-tali-key), POST /internal/daily: checks Stripe and bills answers over the plan.
// GET /public/plans is open: the pricing page reads it so prices live in one place.
//
// Tali never sends, books or spends here. She returns drafts and suggestions; the licensee's software
// acts only after its user says yes, and reports back with /outcome.
// Secrets: ANTHROPIC_API_KEY, STRIPE_SECRET_KEY, APP_URLS, optional OPENAI_API_KEY (voice notes), TALI_MODEL.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(Deno.env.get('SUPABASE_URL')!, SERVICE, { auth: { persistSession: false } });
const ANTHROPIC = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const OPENAI = Deno.env.get('OPENAI_API_KEY') ?? '';
const STRIPE = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const MODEL = Deno.env.get('TALI_MODEL') ?? 'claude-haiku-5-5';
const ALLOWED = (Deno.env.get('APP_URLS') ?? 'http://localhost:8081').split(',').map((s) => s.trim()).filter(Boolean);
const SITE = Deno.env.get('BRAIN_SITE_URL') ?? 'https://talihq.com.au';
// Where checkout may send people back to: the app's allowed addresses plus the licence site itself.
const ORIGINS = [...ALLOWED, new URL(SITE).origin, new URL(SITE).origin.replace('://', '://www.')];

// The plans. Prices are A$ a month plus GST. over is A$ per 1,000 answers past the included ones.
// Stripe prices were made 27 Nov 2026 in the Totality 360 account (product prod_Vhf7Tcfg1dqf2d).
type Plan = { name: string; price: number; price_id: string; businesses: number | null; answers: number; over: number; months: number; own_name: boolean; colours: boolean; white: boolean; actions: boolean };
const PLANS: Record<string, Plan> = {
  starter: { name: 'Starter', price: 290, price_id: 'price_1UgFnpPy9YlWBZ02hjqB3z8P', businesses: 10, answers: 2000, over: 70, months: 1, own_name: false, colours: false, white: false, actions: false },
  pilot: { name: 'Pilot', price: 990, price_id: 'price_1UgFnpPy9YlWBZ02Un9A8a0R', businesses: 50, answers: 10000, over: 60, months: 3, own_name: false, colours: false, white: false, actions: false },
  growth: { name: 'Growth', price: 2990, price_id: 'price_1UgFnqPy9YlWBZ0298CjGaKe', businesses: 500, answers: 50000, over: 50, months: 12, own_name: true, colours: true, white: false, actions: false },
  platform: { name: 'Platform', price: 7500, price_id: 'price_1UgFnrPy9YlWBZ02hM3NySdk', businesses: null, answers: 100000, over: 40, months: 12, own_name: true, colours: true, white: true, actions: true },
};
const PRICE_SETUP = 'price_1UgFnrPy9YlWBZ02tBREnVsW'; // A$3,000 one-off
const SETUP_PRICE = 3000;
// Stripe billing portal set ups (made 27 Nov 2026). Inside a plan's minimum term the portal has no cancel button.
const PORTAL_LOCKED = 'bpc_1UgGHjPy9YlWBZ02fVjFw5W2';
const PORTAL_OPEN = 'bpc_1UgGHkPy9YlWBZ02qafzL4PZ';
// How Stripe Checkout looks for a licence, so it says Tali Brain and not Totality.
const CHECKOUT_LOOK = { display_name: 'Tali Brain', background_color: '#F5F0E6', button_color: '#3B3F9E', border_style: 'rectangular', icon: { type: 'url', url: 'https://talihq.com.au/icon-512.png' }, logo: { type: 'url', url: 'https://talihq.com.au/icon-512.png' } };
const SANDBOX = { businesses: 5, answers: 300 }; // test keys, each calendar month, free
const EVERYTHING = { own_name: true, colours: true, white: true, actions: true };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const fail = (status: number, code: string, message: string) => json({ error: { code, message } }, status);
const clean = (v: unknown, max: number) => String(v ?? '').replace(/[–—]/g, ', ').replace(/\s+/g, ' ').trim().slice(0, max);
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(new Date());
const isDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const monthStart = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString(); };

const b64u = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
async function sha256(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function hmac(s: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(`brain-panel:${SERVICE}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(s))));
}
function newKey(mode: 'live' | 'test') {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return `thb_${mode}_` + Array.from(crypto.getRandomValues(new Uint8Array(40))).map((b) => abc[b % abc.length]).join('');
}

// ── Settings: what a licensee can shape. Plan gates are applied when they are read. ──────────────
const TONES: Record<string, string> = {
  warm: 'Warm and personal, like someone who knows the client well.',
  plain: 'Plain and friendly. Short sentences. No jargon.',
  formal: 'Polite and professional. Complete sentences. No slang.',
  short: 'As short as possible while still kind. Two or three sentences.',
};
const DEFAULT_KINDS = [
  { key: 'wants', label: 'What they want' }, { key: 'likes', label: 'Likes and dislikes' }, { key: 'life', label: 'Life right now' },
  { key: 'money', label: 'Budget and money' }, { key: 'history', label: 'History with us' }, { key: 'other', label: 'Other' },
];
const ABILITIES = ['draft', 'brief', 'summary', 'booking', 'ask'] as const;
const slug = (s: string) => clean(s, 40).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'other';

// Tidies whatever the console sends before it is saved.
function tidySettings(s: any) {
  const kinds = (Array.isArray(s?.kinds) ? s.kinds : []).map((k: any) => ({ key: slug(k?.key || k?.label), label: clean(k?.label, 40) })).filter((k: any) => k.label).slice(0, 12);
  const actions = (Array.isArray(s?.actions) ? s.actions : []).map((a: any) => ({ name: slug(a?.name), description: clean(a?.description, 200) })).filter((a: any) => a.description).slice(0, 10);
  const abilities: Record<string, boolean> = {};
  for (const a of ABILITIES) abilities[a] = s?.abilities?.[a] !== false;
  const cap = Number(s?.cap);
  return {
    assistant_name: clean(s?.assistant_name, 30) || 'Tali',
    powered_by: s?.powered_by !== false,
    tone: TONES[s?.tone] ? s.tone : 'plain',
    spelling: ['au', 'uk', 'us'].includes(s?.spelling) ? s.spelling : 'au',
    rules: (Array.isArray(s?.rules) ? s.rules : []).map((r: unknown) => clean(r, 200)).filter(Boolean).slice(0, 12),
    kinds: kinds.length ? kinds : DEFAULT_KINDS,
    abilities,
    colour: /^#[0-9a-fA-F]{6}$/.test(s?.colour ?? '') ? s.colour : '#3B3F9E',
    actions,
    cap: Number.isFinite(cap) && cap > 0 ? Math.round(cap) : null,
  };
}
// What is in force for this licensee in this mode. The sandbox can try everything.
function settingsOf(lic: any, mode: string) {
  const s = tidySettings(lic.settings ?? {});
  const feat = mode === 'test' ? EVERYTHING : (PLANS[lic.plan] ?? { own_name: false, colours: false, white: false, actions: false });
  const name = feat.own_name ? s.assistant_name : 'Tali';
  return { ...s, assistant_name: name, colour: feat.colours ? s.colour : '#3B3F9E', actions: feat.actions ? s.actions : [], powered_by: name === 'Tali' ? false : feat.white ? s.powered_by : true };
}

type Ctx = { lic: any; mode: 'live' | 'test'; s: ReturnType<typeof settingsOf> };

// ── Limits ───────────────────────────────────────────────────────────────────────────────────────
const periodFrom = (c: Ctx) => (c.mode === 'live' && c.lic.period_start ? c.lic.period_start : monthStart());
async function used(c: Ctx) {
  const { data } = await admin.rpc('licence_answers_used', { p_licensee: c.lic.id, p_mode: c.mode, p_from: periodFrom(c) });
  return Number(data ?? 0);
}
const capOf = (c: Ctx) => (c.mode === 'test' ? SANDBOX.answers : c.s.cap ?? (PLANS[c.lic.plan]?.answers ?? 0) * 3);
async function guard(c: Ctx, units: number): Promise<Response | null> {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin.from('licence_answers').select('id', { count: 'exact', head: true }).eq('licensee_id', c.lic.id).gte('created_at', since);
  if ((count ?? 0) >= 120) return fail(429, 'slow_down', 'Too many requests this minute. Try again shortly.');
  const u = await used(c);
  if (u + units > capOf(c)) {
    return c.mode === 'test'
      ? fail(429, 'sandbox_limit', `The sandbox includes ${SANDBOX.answers} answers a month. Pick a plan in the console for more.`)
      : fail(429, 'cap_reached', 'This licence has reached its answer cap for the period. Raise the cap in the console, under Usage and billing.');
  }
  return null;
}
const record = (c: Ctx, row: Record<string, unknown>) => admin.from('licence_answers').insert({ licensee_id: c.lic.id, mode: c.mode, ...row }).select('id').single();

// ── Businesses and clients ───────────────────────────────────────────────────────────────────────
async function business(c: Ctx, ext: unknown, name?: unknown, create = true): Promise<any | Response> {
  const id = clean(ext, 120);
  if (!id) return fail(400, 'missing_business', 'business_id is needed.');
  const { data: had } = await admin.from('licence_businesses').select('*').eq('licensee_id', c.lic.id).eq('mode', c.mode).eq('external_id', id).maybeSingle();
  const nm = clean(name, 120) || null;
  if (had) {
    const stale = Date.now() - new Date(had.last_seen_at).getTime() > 3600_000;
    if (stale || (nm && nm !== had.name)) await admin.from('licence_businesses').update({ last_seen_at: new Date().toISOString(), ...(nm ? { name: nm } : {}) }).eq('id', had.id);
    return { ...had, name: nm ?? had.name };
  }
  if (!create) return fail(404, 'no_business', 'No brain for that business yet.');
  const max = c.mode === 'test' ? SANDBOX.businesses : PLANS[c.lic.plan]?.businesses ?? null;
  if (max !== null) {
    const { count } = await admin.from('licence_businesses').select('id', { count: 'exact', head: true }).eq('licensee_id', c.lic.id).eq('mode', c.mode);
    if ((count ?? 0) >= max) return fail(402, 'business_limit', c.mode === 'test' ? `The sandbox holds ${max} businesses.` : `Your plan covers ${max} businesses. Move up a plan in the console to add more.`);
  }
  const { data, error } = await admin.from('licence_businesses').insert({ licensee_id: c.lic.id, mode: c.mode, external_id: id, name: nm }).select('*').single();
  if (error) { // made at the same moment by another request
    const { data: again } = await admin.from('licence_businesses').select('*').eq('licensee_id', c.lic.id).eq('mode', c.mode).eq('external_id', id).maybeSingle();
    return again ?? fail(500, 'server_error', 'Could not make that brain.');
  }
  return data;
}
async function client(biz: any, ext: unknown, name?: unknown, create = true): Promise<any | null> {
  const id = clean(ext, 120);
  if (!id) return null;
  const nm = clean(name, 120) || null;
  const { data: had } = await admin.from('licence_clients').select('*').eq('business_id', biz.id).eq('external_id', id).maybeSingle();
  if (had) {
    if (nm && nm !== had.name) await admin.from('licence_clients').update({ name: nm }).eq('id', had.id);
    return { ...had, name: nm ?? had.name };
  }
  if (!create) return null;
  const { data } = await admin.from('licence_clients').insert({ business_id: biz.id, external_id: id, name: nm }).select('*').single();
  if (data) return data;
  const { data: again } = await admin.from('licence_clients').select('*').eq('business_id', biz.id).eq('external_id', id).maybeSingle();
  return again;
}

// ── Claude ───────────────────────────────────────────────────────────────────────────────────────
async function claude(system: string, content: unknown, tool: Record<string, unknown>, maxTokens: number) {
  const body: Record<string, unknown> = { model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content }], tools: [tool], tool_choice: { type: 'tool', name: tool.name } };
  const send = (b: unknown) => fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': ANTHROPIC, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify(b) });
  let res = await send(body);
  if (res.status === 400) { // some models refuse a forced tool: ask again and tell her to use it
    const t = await res.text();
    if (!/tool_choice/i.test(t)) throw new Error(`claude 400: ${t.slice(0, 200)}`);
    res = await send({ ...body, system: `${system}\n\nAnswer only by calling the ${tool.name} tool.`, tool_choice: { type: 'auto' } });
  }
  if (!res.ok) throw new Error(`claude ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const block = (data.content ?? []).find((b: any) => b.type === 'tool_use');
  if (!block) throw new Error('claude: no tool call');
  return { input: block.input as any, tokens_in: data.usage?.input_tokens ?? 0, tokens_out: data.usage?.output_tokens ?? 0 };
}

const PRIVACY = 'Never keep card, bank account or government ID numbers, or passwords. Keep a health, money or legal detail only if the client plainly said it or a staff member wrote it down. Never guess one.';
const spelling = (s: string) => (s === 'us' ? 'American English' : s === 'uk' ? 'British English' : 'Australian English');

// ── The brain: load, learn, save ─────────────────────────────────────────────────────────────────
const MEM_COLS = 'id, client_id, kind, fact, source, source_date, status, until, created_at';
async function loadBrain(biz: any, cl: any | null, about: string) {
  const live = `until.is.null,until.gte.${today()}`;
  const [cf, recent, ev] = await Promise.all([
    cl ? admin.from('licence_memories').select(MEM_COLS).eq('business_id', biz.id).eq('client_id', cl.id).eq('status', 'kept').or(live).order('created_at', { ascending: false }).limit(60) : Promise.resolve({ data: [] as any[] }),
    admin.from('licence_memories').select(MEM_COLS).eq('business_id', biz.id).is('client_id', null).eq('status', 'kept').or(live).order('created_at', { ascending: false }).limit(10),
    cl ? admin.from('licence_events').select('type, direction, body, happened_at').eq('business_id', biz.id).eq('client_id', cl.id).order('happened_at', { ascending: false }).limit(8) : Promise.resolve({ data: [] as any[] }),
  ]);
  // Business facts that match what is being asked, found by word search.
  const words = [...new Set((about.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []))].slice(0, 14);
  let found: any[] = [];
  if (words.length) {
    const { data } = await admin.from('licence_memories').select(MEM_COLS).eq('business_id', biz.id).is('client_id', null).eq('status', 'kept').or(live).textSearch('fts', words.join(' or '), { type: 'websearch', config: 'english' }).limit(10);
    found = data ?? [];
  }
  const seen = new Set<string>();
  const bizFacts = [...found, ...(recent.data ?? [])].filter((m) => !seen.has(m.id) && seen.add(m.id)).slice(0, 14);
  return { clientFacts: (cf.data ?? []) as any[], bizFacts, events: ((ev.data ?? []) as any[]).reverse() };
}

async function saveFacts(biz: any, cl: any | null, facts: any[], kinds: { key: string }[], source: string, forceStatus?: 'kept' | 'suggested') {
  const out: any[] = [];
  if (!facts?.length) return out;
  const { data: have } = await admin.from('licence_memories').select('fact, client_id').eq('business_id', biz.id).limit(500);
  const known = new Set((have ?? []).map((m: any) => `${m.client_id ?? ''}|${String(m.fact).toLowerCase()}`));
  for (const f of facts.slice(0, 5)) {
    const fact = clean(f?.fact, 400);
    const aboutBiz = f?.about === 'business' || !cl;
    const key = `${aboutBiz ? '' : cl.id}|${fact.toLowerCase()}`;
    if (!fact || known.has(key)) continue;
    known.add(key);
    const { data } = await admin.from('licence_memories').insert({
      business_id: biz.id, client_id: aboutBiz ? null : cl.id, kind: kinds.some((k) => k.key === f?.kind) ? f.kind : 'other', fact, source,
      source_date: today(), status: forceStatus ?? (f?.sure === false ? 'suggested' : 'kept'), until: isDate(f?.until) ? f.until : null,
    }).select(MEM_COLS).single();
    if (data) out.push({ ...data, about: aboutBiz ? 'business' : 'client' });
  }
  return out;
}

const factProps = (kinds: { key: string }[]) => ({
  kind: { type: 'string', enum: kinds.map((k) => k.key) },
  fact: { type: 'string', description: 'One short sentence in the third person, e.g. "Wants to walk to the beach."' },
  until: { type: 'string', description: 'YYYY-MM-DD, only if the fact stops mattering after a date.' },
});

async function learn(c: Ctx, biz: any, cl: any | null, text: string, source: string) {
  const { clientFacts, bizFacts } = await loadBrain(biz, cl, text);
  const tool = {
    name: 'remember', description: 'Save the lasting facts, or none.',
    input_schema: { type: 'object', required: ['facts'], properties: { facts: { type: 'array', maxItems: 5, items: { type: 'object', required: ['about', 'kind', 'fact', 'sure'], properties: {
      about: { type: 'string', enum: ['client', 'business'] }, ...factProps(c.s.kinds),
      sure: { type: 'boolean', description: 'true if it was plainly stated. false if it is your own reading of things.' } } } } } },
  };
  const system = [
    `You keep the memory for ${biz.name ?? 'a business'}. Read what happened and save only facts that will still matter in a month: what the client wants, likes, dislikes, their situation, dates that matter, and how this business works (prices, hours, policies).`,
    'At most 5. None if nothing new. Never repeat something already known. Small talk, greetings and one-off logistics are not facts.',
    `Kinds: ${c.s.kinds.map((k: any) => `${k.key} (${k.label})`).join(', ')}.`, PRIVACY, `Write in ${spelling(c.s.spelling)}. No em dashes.`,
  ].join('\n');
  const user = [
    cl ? `Client: ${cl.name ?? cl.external_id}` : 'No client: this is about the business.',
    `Already known about the client:\n${clientFacts.map((m) => `- ${m.fact}`).join('\n') || '(nothing)'}`,
    `Already known about the business:\n${bizFacts.map((m) => `- ${m.fact}`).join('\n') || '(nothing)'}`,
    `What happened:\n${text.slice(0, 12000)}`,
  ].join('\n\n');
  const r = await claude(system, user, tool, 600);
  const saved = await saveFacts(biz, cl, r.input?.facts ?? [], c.s.kinds, source);
  await record(c, { business_id: biz.id, client_id: cl?.id ?? null, kind: 'learn', answers: 0, model: MODEL, tokens_in: r.tokens_in, tokens_out: r.tokens_out });
  return saved;
}

// Voice notes, documents and images become text first. These count as answers.
async function readMedia(media: any): Promise<{ text: string; units: number; kind: string } | Response> {
  const data = String(media?.data ?? '');
  if (!data || data.length > 11_000_000) return fail(400, 'bad_media', 'media.data must be base64, up to 8 MB.');
  const type = clean(media?.media_type, 60);
  if (media?.kind === 'audio') {
    if (!OPENAI) return fail(503, 'not_ready', 'Voice notes are not switched on yet.');
    const form = new FormData();
    form.append('file', new File([unb64u(data.replace(/\s/g, ''))], `note.${type.split('/')[1] || 'm4a'}`, { type: type || 'audio/mp4' }));
    form.append('model', 'gpt-4o-mini-transcribe'); form.append('response_format', 'json');
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${OPENAI}` }, body: form });
    if (!res.ok) return fail(400, 'bad_media', 'That audio could not be read.');
    const out = await res.json();
    const secs = Number(out?.usage?.seconds ?? 0) || Number(media?.minutes ?? 0) * 60 || data.length / 20000;
    return { text: String(out.text ?? '').slice(0, 20000), units: Math.max(1, Math.ceil(secs / 60)), kind: 'voice_note' };
  }
  const isPdf = media?.kind === 'document';
  if (isPdf ? type !== 'application/pdf' : !/^image\/(png|jpeg|webp|gif)$/.test(type)) return fail(400, 'bad_media', 'Documents must be application/pdf. Images must be png, jpeg, webp or gif.');
  const tool = { name: 'notes', description: 'What it says.', input_schema: { type: 'object', required: ['text'], properties: { text: { type: 'string', description: 'The details that matter, as plain notes. Up to 300 words.' } } } };
  const block = isPdf ? { type: 'document', source: { type: 'base64', media_type: type, data } } : { type: 'image', source: { type: 'base64', media_type: type, data } };
  const r = await claude(`Write out what this ${isPdf ? 'document' : 'image'} says that a business would want to remember about its client or itself. Facts only, nothing invented. ${PRIVACY}`, [block, { type: 'text', text: 'Write the notes.' }], tool, 900);
  return { text: clean(r.input?.text, 20000), units: 2, kind: isPdf ? 'document' : 'image' };
}

const EVENT_TYPES = ['note', 'message', 'email', 'call', 'booking', 'form', 'voice_note', 'document', 'image', 'other'];
async function postEvents(c: Ctx, body: any) {
  const biz = await business(c, body.business_id, body.business_name);
  if (biz instanceof Response) return biz;
  const cl = await client(biz, body.client_id, body.client_name);
  const list: any[] = (Array.isArray(body.events) ? body.events : [body]).slice(0, 20);
  let stored = 0, duplicates = 0, charged = 0;
  const texts: string[] = [];
  for (const e of list) {
    const ext = clean(e.id, 120) || null;
    if (ext) {
      const { data: dup } = await admin.from('licence_events').select('id').eq('business_id', biz.id).eq('external_id', ext).maybeSingle();
      if (dup) { duplicates++; continue; }
    }
    let text = String(e.text ?? '').trim().slice(0, 20000);
    let type = EVENT_TYPES.includes(e.type) ? e.type : 'note';
    if (e.media) {
      const stop = await guard(c, 2);
      if (stop) return stop;
      const m = await readMedia(e.media);
      if (m instanceof Response) return m;
      await record(c, { business_id: biz.id, client_id: cl?.id ?? null, kind: m.kind, answers: m.units });
      charged += m.units; type = m.kind; text = [text, m.text].filter(Boolean).join('\n');
    }
    if (!text) continue;
    const at = e.at && !isNaN(new Date(e.at).getTime()) ? new Date(e.at).toISOString() : new Date().toISOString();
    const { error } = await admin.from('licence_events').insert({ business_id: biz.id, client_id: cl?.id ?? null, external_id: ext, type, direction: ['in', 'out'].includes(e.direction) ? e.direction : 'internal', body: text, happened_at: at });
    if (error) { duplicates++; continue; }
    stored++;
    texts.push(`[${type}${e.direction === 'in' ? ' from the client' : e.direction === 'out' ? ' to the client' : ''}] ${text}`);
  }
  let learned: any[] = [], skipped: string | undefined;
  if (texts.length && body.learn !== false) {
    // Remembering is free, within fair use: ten times the plan's answers each period (twice, in the sandbox).
    const { count } = await admin.from('licence_answers').select('id', { count: 'exact', head: true }).eq('licensee_id', c.lic.id).eq('mode', c.mode).eq('kind', 'learn').gte('created_at', periodFrom(c));
    const fair = c.mode === 'test' ? SANDBOX.answers * 2 : (PLANS[c.lic.plan]?.answers ?? 0) * 10;
    if ((count ?? 0) >= fair) skipped = 'fair_use';
    else {
      try { learned = await learn(c, biz, cl, texts.join('\n\n'), list.length === 1 && EVENT_TYPES.includes(list[0].type) ? list[0].type : 'events'); }
      catch (e) { console.error('brain-api learn', String(e)); skipped = 'try_later'; }
    }
  }
  return json({ stored, duplicates, learned: learned.map(pubMem), ...(skipped ? { learning_skipped: skipped } : {}), answers_charged: charged });
}

const pubMem = (m: any) => ({ id: m.id, about: m.client_id ? 'client' : 'business', kind: m.kind, fact: m.fact, status: m.status, source: m.source, source_date: m.source_date, until: m.until });

// ── Answers ──────────────────────────────────────────────────────────────────────────────────────
async function answer(c: Ctx, biz: any, cl: any | null, body: any) {
  const kind = String(body.kind ?? '');
  if (!ABILITIES.includes(kind as any)) return fail(400, 'bad_kind', 'kind must be draft, brief, summary, booking or ask.');
  if (!c.s.abilities[kind]) return fail(403, 'switched_off', `${kind} is switched off in the console, under Customise.`);
  const stop = await guard(c, 1);
  if (stop) return stop;

  const message = String(body.message ?? '').trim().slice(0, 8000);
  const question = String(body.question ?? '').trim().slice(0, 2000);
  const context = typeof body.context === 'string' ? body.context.slice(0, 8000) : body.context ? JSON.stringify(body.context).slice(0, 8000) : '';
  const slots: string[] = (Array.isArray(body.free_slots) ? body.free_slots : []).map((s: unknown) => clean(s, 60)).filter(Boolean).slice(0, 40);
  const brain = await loadBrain(biz, cl, [message, question, context].join(' '));
  const lastIn = [...brain.events].reverse().find((e) => e.direction === 'in');
  const replyTo = message || (kind === 'draft' ? lastIn?.body ?? '' : '');
  if (kind === 'draft' && !replyTo) return fail(400, 'nothing_to_answer', 'Send the message to reply to, or send it as an event first.');
  if (kind === 'ask' && !question) return fail(400, 'no_question', 'question is needed.');
  if (kind === 'booking' && !slots.length) return fail(400, 'no_slots', 'free_slots is needed: the times that are open.');

  const facts = [...brain.clientFacts.map((m) => ({ ...m, who: 'client' })), ...brain.bizFacts.map((m) => ({ ...m, who: 'business' }))];
  const who = cl?.name ?? 'the client';
  const task: Record<string, string> = {
    draft: `Write the reply to ${who}'s message${body.channel ? ` (${clean(body.channel, 20)})` : ''}. Answer what they asked using only what you know. Ready to send as written.`,
    brief: `Write a short briefing for the staff member before they speak with ${who}: who they are, what matters to them, what is open, and one thing worth raising. Short lines.`,
    summary: cl ? `Summarise where things stand with ${who} in a few short lines.` : 'Summarise the context in a few short lines.',
    booking: `Pick the open time that suits ${who} best and write one line the staff member can approve. Put the time you picked in booking.slot exactly as given.`,
    ask: `Answer the staff member's question: ${question}`,
  };
  const system = [
    `You are ${c.s.assistant_name}, the assistant inside the software ${biz.name ?? 'this business'} uses. You work for ${biz.name ?? 'the business'}.`,
    `Tone: ${TONES[c.s.tone]}`, `Write in ${spelling(c.s.spelling)}. No em dashes.`,
    'You never send, book or spend anything. You write drafts and suggestions that a person will read and approve.',
    'Use only the facts you are given. Never invent a price, time, name or detail. If something needed is missing, leave a gap like [strata fee] or say what you would need.',
    'In used, list the numbers of the facts you relied on. In noticed, add at most 2 new lasting facts about the client that are in the message or context but not already known. None is fine.',
    PRIVACY,
    c.s.rules.length ? `House rules:\n${c.s.rules.map((r: string) => `- ${r}`).join('\n')}` : '',
    c.s.actions.length ? `You may suggest these actions for the staff member to approve, only when clearly useful:\n${c.s.actions.map((a: any) => `- ${a.name}: ${a.description}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');
  const user = [
    `Today is ${today()}.`, cl ? `Client: ${who}` : '',
    body.from_name ? `Staff member: ${clean(body.from_name, 60)}` : '',
    `What you know:\n${facts.map((m, i) => `${i + 1}. (${m.who}) ${m.fact}${m.until ? ` (until ${m.until})` : ''}`).join('\n') || '(nothing yet)'}`,
    brain.events.length ? `Recent history, oldest first:\n${brain.events.map((e) => `- ${String(e.happened_at).slice(0, 10)} ${e.type}${e.direction === 'in' ? ' from client' : e.direction === 'out' ? ' to client' : ''}: ${String(e.body).slice(0, 600)}`).join('\n')}` : '',
    context ? `Context from the software:\n${context}` : '',
    replyTo && kind !== 'ask' ? `Their message:\n${replyTo}` : '',
    slots.length ? `Open times:\n${slots.map((s) => `- ${s}`).join('\n')}` : '',
    `Task: ${task[kind]}`,
  ].filter(Boolean).join('\n\n');
  const tool = {
    name: 'answer', description: 'Your answer.',
    input_schema: { type: 'object', required: ['text', 'used'], properties: {
      text: { type: 'string' },
      used: { type: 'array', items: { type: 'integer' } },
      noticed: { type: 'array', maxItems: 2, items: { type: 'object', required: ['kind', 'fact'], properties: factProps(c.s.kinds) } },
      ...(slots.length ? { booking: { type: 'object', required: ['slot', 'title'], properties: { slot: { type: 'string', enum: slots }, title: { type: 'string' }, why: { type: 'string' } } } } : {}),
      ...(c.s.actions.length ? { actions: { type: 'array', maxItems: 2, items: { type: 'object', required: ['name'], properties: { name: { type: 'string', enum: c.s.actions.map((a: any) => a.name) }, details: { type: 'string' } } } } } : {}),
    } },
  };
  let r;
  try { r = await claude(system, user, tool, kind === 'draft' || kind === 'ask' ? 900 : 700); }
  catch (e) { console.error('brain-api answer', String(e)); return fail(502, 'try_again', 'Tali could not answer just now. Nothing was charged. Try again.'); }
  const o = r.input ?? {};
  const usedFacts = (Array.isArray(o.used) ? o.used : []).map((n: number) => facts[n - 1]).filter(Boolean).map((m: any) => ({ id: m.id, fact: m.fact }));
  const noticed = cl ? await saveFacts(biz, cl, (o.noticed ?? []).map((f: any) => ({ ...f, about: 'client' })), c.s.kinds, 'noticed', 'suggested') : [];
  const out = { text: clean(String(o.text ?? '').replace(/\n/g, '\u0001'), 6000).replace(/\u0001 ?/g, '\n'), booking: o.booking ?? null, actions: o.actions ?? [] };
  const { data: row } = await record(c, { business_id: biz.id, client_id: cl?.id ?? null, kind, answers: 1, output: { ...out, used: usedFacts.map((u: any) => u.id) }, model: MODEL, tokens_in: r.tokens_in, tokens_out: r.tokens_out });
  return json({ id: row?.id, kind, ...out, used: usedFacts, noticed: noticed.map(pubMem), answers_charged: 1, assistant: { name: c.s.assistant_name } });
}

async function outcome(c: Ctx, id: string, body: any) {
  if (!['approved', 'edited', 'rejected'].includes(body.outcome)) return fail(400, 'bad_outcome', 'outcome must be approved, edited or rejected.');
  const { data } = await admin.from('licence_answers').update({ outcome: body.outcome }).eq('id', id).eq('licensee_id', c.lic.id).select('id').maybeSingle();
  return data ? json({ ok: true }) : fail(404, 'not_found', 'No answer with that id.');
}

// A memory this licensee owns, in this mode.
async function ownMemory(c: Ctx, id: string) {
  const { data: m } = await admin.from('licence_memories').select(`${MEM_COLS}, business_id`).eq('id', id).maybeSingle();
  if (!m) return null;
  const { data: b } = await admin.from('licence_businesses').select('id').eq('id', m.business_id).eq('licensee_id', c.lic.id).eq('mode', c.mode).maybeSingle();
  return b ? m : null;
}
async function patchMemory(c: Ctx, id: string, body: any, only?: { business_id: string; client_id: string | null }) {
  const m = await ownMemory(c, id);
  if (!m || (only && (m.business_id !== only.business_id || (m.client_id ?? null) !== only.client_id))) return fail(404, 'not_found', 'No memory with that id.');
  const set: Record<string, unknown> = {};
  if (body.status === 'kept') set.status = 'kept';
  if (typeof body.fact === 'string' && clean(body.fact, 400)) set.fact = clean(body.fact, 400);
  if (body.until === null || isDate(body.until)) set.until = body.until;
  if (!Object.keys(set).length) return fail(400, 'nothing_to_change', 'Send status, fact or until.');
  const { data } = await admin.from('licence_memories').update(set).eq('id', id).select(MEM_COLS).single();
  return json(pubMem(data));
}
async function deleteMemory(c: Ctx, id: string, only?: { business_id: string; client_id: string | null }) {
  const m = await ownMemory(c, id);
  if (!m || (only && (m.business_id !== only.business_id || (m.client_id ?? null) !== only.client_id))) return fail(404, 'not_found', 'No memory with that id.');
  await admin.from('licence_memories').delete().eq('id', id);
  return json({ ok: true });
}
async function addMemory(c: Ctx, biz: any, cl: any | null, body: any, source: string) {
  const fact = clean(body.fact, 400);
  if (!fact) return fail(400, 'no_fact', 'fact is needed.');
  const saved = await saveFacts(biz, cl, [{ about: cl ? 'client' : 'business', kind: body.kind, fact, until: body.until }], c.s.kinds, source, 'kept');
  return saved[0] ? json(pubMem(saved[0]), 201) : json({ ok: true, existing: true });
}

// ── The API (keys) ───────────────────────────────────────────────────────────────────────────────
async function api(req: Request, c: Ctx, path: string, u: URL): Promise<Response> {
  const m = req.method;
  const body = m === 'GET' || m === 'DELETE' ? {} : await req.json().catch(() => ({}));
  const seg = path.split('/').filter(Boolean).map(decodeURIComponent); // ['v1', ...]
  if (seg[0] !== 'v1') return fail(404, 'not_found', 'Not found.');

  if (m === 'GET' && seg[1] === 'me') {
    const plan = PLANS[c.lic.plan];
    return json({ licensee: c.lic.name, mode: c.mode, plan: c.mode === 'test' ? 'sandbox' : c.lic.plan, answers_used: await used(c), answers_included: c.mode === 'test' ? SANDBOX.answers : plan?.answers ?? 0, answers_cap: capOf(c), period_start: periodFrom(c), assistant: { name: c.s.assistant_name } });
  }

  if (seg[1] === 'businesses') {
    if (m === 'GET' && !seg[2]) {
      const { data } = await admin.from('licence_businesses').select('external_id, name, created_at, last_seen_at').eq('licensee_id', c.lic.id).eq('mode', c.mode).order('last_seen_at', { ascending: false }).limit(Math.min(500, Number(u.searchParams.get('limit')) || 100));
      return json((data ?? []).map((b: any) => ({ id: b.external_id, name: b.name, created_at: b.created_at, last_seen_at: b.last_seen_at })));
    }
    if (!seg[2]) return fail(404, 'not_found', 'Not found.');
    if (m === 'PUT' && !seg[3]) {
      const biz = await business(c, seg[2], body.name);
      return biz instanceof Response ? biz : json({ id: biz.external_id, name: biz.name, created_at: biz.created_at });
    }
    const biz = await business(c, seg[2], undefined, false);
    if (biz instanceof Response) return biz;
    if (m === 'DELETE' && !seg[3]) { await admin.from('licence_businesses').delete().eq('id', biz.id); return json({ ok: true, deleted: 'business' }); }
    if (m === 'GET' && seg[3] === 'export') {
      const [cl, mem, ev] = await Promise.all([
        admin.from('licence_clients').select('id, external_id, name, created_at').eq('business_id', biz.id).limit(5000),
        admin.from('licence_memories').select(MEM_COLS).eq('business_id', biz.id).limit(20000),
        admin.from('licence_events').select('client_id, external_id, type, direction, body, happened_at').eq('business_id', biz.id).order('happened_at', { ascending: false }).limit(5000),
      ]);
      const ext = new Map((cl.data ?? []).map((x: any) => [x.id, x.external_id]));
      return json({
        business: { id: biz.external_id, name: biz.name, created_at: biz.created_at },
        clients: (cl.data ?? []).map((x: any) => ({ id: x.external_id, name: x.name, created_at: x.created_at })),
        memories: (mem.data ?? []).map((x: any) => ({ ...pubMem(x), client_id: x.client_id ? ext.get(x.client_id) : null })),
        events: (ev.data ?? []).map((x: any) => ({ id: x.external_id, client_id: x.client_id ? ext.get(x.client_id) : null, type: x.type, direction: x.direction, text: x.body, at: x.happened_at })),
      });
    }
    if (seg[3] === 'clients' && seg[4]) {
      if (m === 'PUT') { const cl = await client(biz, seg[4], body.name); return json({ id: cl.external_id, name: cl.name }); }
      if (m === 'DELETE') { await admin.from('licence_clients').delete().eq('business_id', biz.id).eq('external_id', seg[4]); return json({ ok: true, deleted: 'client' }); }
    }
    return fail(404, 'not_found', 'Not found.');
  }

  if (m === 'POST' && seg[1] === 'events') return postEvents(c, body);

  if (seg[1] === 'memories') {
    if (seg[2]) return m === 'PATCH' ? patchMemory(c, seg[2], body) : m === 'DELETE' ? deleteMemory(c, seg[2]) : fail(404, 'not_found', 'Not found.');
    const src = m === 'GET' ? Object.fromEntries(u.searchParams) : body;
    const biz = await business(c, src.business_id, undefined, m === 'POST');
    if (biz instanceof Response) return biz;
    const cl = await client(biz, src.client_id, src.client_name, m === 'POST');
    if (m === 'POST') return addMemory(c, biz, cl, body, 'api');
    if (m === 'GET') {
      if (src.client_id && !cl) return json([]);
      let q = admin.from('licence_memories').select(MEM_COLS).eq('business_id', biz.id).or(`until.is.null,until.gte.${today()}`).order('created_at', { ascending: false }).limit(200);
      q = cl ? q.eq('client_id', cl.id) : src.scope === 'all' ? q : q.is('client_id', null);
      const words = (String(src.q ?? '').toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).slice(0, 12);
      if (words.length) q = q.textSearch('fts', words.join(' or '), { type: 'websearch', config: 'english' });
      const { data } = await q;
      return json((data ?? []).map(pubMem));
    }
  }

  if (m === 'POST' && seg[1] === 'answers') {
    if (seg[2] && seg[3] === 'outcome') return outcome(c, seg[2], body);
    const biz = await business(c, body.business_id, body.business_name);
    if (biz instanceof Response) return biz;
    return answer(c, biz, await client(biz, body.client_id, body.client_name), body);
  }

  if (m === 'POST' && seg[1] === 'panel-tokens') {
    const biz = await business(c, body.business_id, body.business_name);
    if (biz instanceof Response) return biz;
    const cl = await client(biz, body.client_id, body.client_name);
    if (!cl) return fail(400, 'missing_client', 'client_id is needed.');
    const exp = Math.floor(Date.now() / 1000) + Math.min(720, Math.max(5, Number(body.minutes) || 60)) * 60;
    const payload = b64u(new TextEncoder().encode(JSON.stringify({ l: c.lic.id, b: biz.id, c: cl.id, m: c.mode, u: clean(body.user_name, 60), e: exp })));
    const token = `thp_${payload}.${await hmac(payload)}`;
    return json({ token, url: `${SITE}/brain/panel?token=${token}`, expires_at: new Date(exp * 1000).toISOString() }, 201);
  }
  return fail(404, 'not_found', 'Not found.');
}

// ── The panel (token) ────────────────────────────────────────────────────────────────────────────
async function panel(req: Request, token: string, path: string): Promise<Response> {
  const [payload, sig] = token.slice(4).split('.');
  if (!payload || !sig || sig !== (await hmac(payload))) return fail(401, 'bad_token', 'This panel link is not valid.');
  const t = JSON.parse(new TextDecoder().decode(unb64u(payload)));
  if (t.e * 1000 < Date.now()) return fail(401, 'expired', 'This panel link has run out. Reload the page.');
  const { data: lic } = await admin.from('licensees').select('*').eq('id', t.l).maybeSingle();
  if (!lic || (t.m === 'live' && !['active', 'past_due'].includes(lic.status))) return fail(402, 'not_active', 'This licence is not active.');
  const c: Ctx = { lic, mode: t.m, s: settingsOf(lic, t.m) };
  const [{ data: biz }, { data: cl }] = await Promise.all([
    admin.from('licence_businesses').select('*').eq('id', t.b).eq('licensee_id', lic.id).maybeSingle(),
    admin.from('licence_clients').select('*').eq('id', t.c).eq('business_id', t.b).maybeSingle(),
  ]);
  if (!biz || !cl) return fail(404, 'not_found', 'That client is no longer here.');
  const body = req.method === 'GET' || req.method === 'DELETE' ? {} : await req.json().catch(() => ({}));
  const only = { business_id: biz.id, client_id: cl.id };
  const seg = path.split('/').filter(Boolean);

  if (req.method === 'GET' && seg[1] === 'state') {
    const [{ data: mem }, { data: ev }] = await Promise.all([
      admin.from('licence_memories').select(MEM_COLS).eq('business_id', biz.id).eq('client_id', cl.id).or(`until.is.null,until.gte.${today()}`).order('created_at', { ascending: false }).limit(80),
      admin.from('licence_events').select('body, happened_at, type').eq('business_id', biz.id).eq('client_id', cl.id).eq('direction', 'in').order('happened_at', { ascending: false }).limit(1),
    ]);
    return json({
      assistant: { name: c.s.assistant_name, colour: c.s.colour, powered_by: c.s.powered_by }, abilities: c.s.abilities, kinds: c.s.kinds,
      client: { name: cl.name ?? cl.external_id }, user: t.u || null,
      kept: (mem ?? []).filter((x: any) => x.status === 'kept').map(pubMem), suggested: (mem ?? []).filter((x: any) => x.status === 'suggested').map(pubMem),
      last_message: ev?.[0] ? { text: ev[0].body, at: ev[0].happened_at, type: ev[0].type } : null,
    });
  }
  if (req.method === 'POST' && seg[1] === 'answer') return answer(c, biz, cl, { ...body, from_name: t.u });
  if (req.method === 'POST' && seg[1] === 'outcome') return outcome(c, String(body.id ?? ''), body);
  if (seg[1] === 'memories') {
    if (req.method === 'POST' && !seg[2]) return addMemory(c, biz, cl, body, 'staff');
    if (req.method === 'PATCH' && seg[2]) return patchMemory(c, seg[2], body, only);
    if (req.method === 'DELETE' && seg[2]) return deleteMemory(c, seg[2], only);
  }
  return fail(404, 'not_found', 'Not found.');
}

// ── Stripe ───────────────────────────────────────────────────────────────────────────────────────
function form(params: Record<string, unknown>, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === 'object' ? form(item as Record<string, unknown>, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))));
    else if (typeof v === 'object') form(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}
async function stripe(method: 'GET' | 'POST', path: string, params: Record<string, unknown> = {}, idem?: string): Promise<any> {
  const url = new URL(`https://api.stripe.com/v1/${path}`);
  const headers: Record<string, string> = { Authorization: `Bearer ${STRIPE}` };
  const init: RequestInit = { method, headers };
  if (method === 'GET') form(params).forEach((v, k) => url.searchParams.append(k, v));
  else { init.body = form(params); headers['Content-Type'] = 'application/x-www-form-urlencoded'; if (idem) headers['Idempotency-Key'] = idem; }
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${data?.error?.message ?? 'error'}`);
  return data;
}
// GST is added for Australian licensees only. The 10% rate is made once and found again by its tag.
async function gstRate(): Promise<string> {
  const list = await stripe('GET', 'tax_rates', { active: true, limit: 100 });
  const had = (list.data ?? []).find((r: any) => r.metadata?.tali === 'licence_gst');
  if (had) return had.id;
  return (await stripe('POST', 'tax_rates', { display_name: 'GST', percentage: 10, inclusive: false, country: 'AU', description: 'Australian GST', metadata: { tali: 'licence_gst' } })).id;
}
// When the plan's minimum term ends, or null if it has none or has passed.
function minimumUntil(lic: any): Date | null {
  const months = PLANS[lic.plan]?.months ?? 1;
  if (!lic.term_start || months <= 1 || !['active', 'past_due'].includes(lic.status)) return null;
  const d = new Date(lic.term_start);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.getTime() > Date.now() ? d : null;
}
const planForPrice = (id: string) => Object.keys(PLANS).find((k) => PLANS[k].price_id === id) ?? null;

// Brings a licence in line with Stripe, and bills answers over the plan for a period that has ended.
async function syncBilling(lic: any): Promise<any> {
  if (!STRIPE || !lic.stripe_customer_id) return lic;
  const list = await stripe('GET', 'subscriptions', { customer: lic.stripe_customer_id, status: 'all', limit: 10 });
  const mine = (list.data ?? []).filter((s: any) => s.metadata?.tali_licensee_id === lic.id);
  const sub = mine.find((s: any) => ['active', 'trialing', 'past_due', 'unpaid'].includes(s.status));
  let set: Record<string, unknown>;
  if (!sub) set = ['active', 'past_due'].includes(lic.status) ? { status: 'cancelled' } : {};
  else {
    const item = sub.items?.data?.[0];
    const ps = new Date((sub.current_period_start ?? item?.current_period_start) * 1000).toISOString();
    const pe = new Date((sub.current_period_end ?? item?.current_period_end) * 1000).toISOString();
    const plan = planForPrice(item?.price?.id) ?? sub.metadata?.licence_plan ?? lic.plan;
    // The stored period has ended: bill what went over it.
    if (lic.plan && lic.period_start && lic.period_end && new Date(ps).getTime() >= new Date(lic.period_end).getTime() - 1000) {
      const [a, b] = await Promise.all([
        admin.rpc('licence_answers_used', { p_licensee: lic.id, p_mode: 'live', p_from: lic.period_start }),
        admin.rpc('licence_answers_used', { p_licensee: lic.id, p_mode: 'live', p_from: lic.period_end }),
      ]);
      const over = Number(a.data ?? 0) - Number(b.data ?? 0) - PLANS[lic.plan].answers;
      if (over > 0) {
        const tag = `${lic.id}_${Math.floor(new Date(lic.period_end).getTime() / 1000)}`;
        const tax = lic.country === 'AU' ? [await gstRate()] : undefined;
        await stripe('POST', 'invoiceitems', {
          customer: lic.stripe_customer_id, currency: 'aud', amount: Math.round((over * PLANS[lic.plan].over * 100) / 1000), tax_rates: tax,
          description: `${over.toLocaleString('en-AU')} answers over the ${PLANS[lic.plan].name} licence, ${lic.period_start.slice(0, 10)} to ${lic.period_end.slice(0, 10)}`,
        }, `brain_over_item_${tag}`);
        await stripe('POST', 'invoices', { customer: lic.stripe_customer_id, auto_advance: true, collection_method: 'charge_automatically', pending_invoice_items_behavior: 'include', metadata: { tali_licensee_id: lic.id, kind: 'licence_overage' } }, `brain_over_inv_${tag}`);
      }
    }
    set = {
      plan, stripe_subscription_id: sub.id, period_start: ps, period_end: pe, term_start: new Date(sub.start_date * 1000).toISOString(),
      status: ['active', 'trialing'].includes(sub.status) ? 'active' : 'past_due',
      ...(sub.metadata?.setup === '1' && !lic.setup_paid_at && ['active', 'trialing'].includes(sub.status) ? { setup_paid_at: new Date().toISOString() } : {}),
    };
  }
  if (!Object.keys(set).length) return lic;
  const { data } = await admin.from('licensees').update(set).eq('id', lic.id).select('*').single();
  return data ?? lic;
}

// ── The console (signed in) ──────────────────────────────────────────────────────────────────────
const publicPlans = () => ({
  plans: Object.entries(PLANS).map(([id, p]) => ({ id, name: p.name, price: p.price, businesses: p.businesses, answers: p.answers, over: p.over, months: p.months, own_name: p.own_name, colours: p.colours, white: p.white, actions: p.actions })),
  setup: SETUP_PRICE, sandbox: SANDBOX, currency: 'AUD',
});
const KEY_COLS = 'id, name, mode, last4, created_at, last_used_at, revoked_at';

async function consoleState(lic: any) {
  const from = lic.period_start ?? monthStart();
  const [keys, live, test] = await Promise.all([
    admin.from('licence_keys').select(KEY_COLS).eq('licensee_id', lic.id).order('created_at', { ascending: false }),
    admin.rpc('licence_stats', { p_licensee: lic.id, p_mode: 'live', p_from: from }),
    admin.rpc('licence_stats', { p_licensee: lic.id, p_mode: 'test', p_from: monthStart() }),
  ]);
  return {
    licensee: { id: lic.id, name: lic.name, country: lic.country, plan: lic.plan, status: lic.status, period_start: lic.period_start, period_end: lic.period_end, minimum_until: minimumUntil(lic)?.toISOString() ?? null, settings: tidySettings(lic.settings ?? {}) },
    keys: keys.data ?? [], stats: { live: live.data, test: test.data }, ...publicPlans(), voice_notes: !!OPENAI, billing_ready: !!STRIPE,
  };
}

async function consoleApi(req: Request, token: string): Promise<Response> {
  const { data: who } = await admin.auth.getUser(token);
  const me = who?.user;
  if (!me) return fail(401, 'unauthorized', 'Please sign in again.');
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? '');
  let { data: lic } = await admin.from('licensees').select('*').eq('owner_id', me.id).maybeSingle();

  if (action === 'start') {
    if (lic) return json(await consoleState(lic));
    const name = clean(body.name, 120);
    const country = /^[A-Za-z]{2}$/.test(body.country ?? '') ? String(body.country).toUpperCase() : 'AU';
    if (!name) return fail(400, 'no_name', 'What is your company called?');
    const { data, error } = await admin.from('licensees').insert({ owner_id: me.id, name, country, settings: tidySettings({ spelling: country === 'US' ? 'us' : country === 'AU' || country === 'NZ' ? 'au' : 'uk' }) }).select('*').single();
    if (error) return fail(500, 'server_error', 'Could not set that up. Please try again.');
    return json(await consoleState(data));
  }
  if (!lic) return json({ licensee: null, ...publicPlans() });

  try {
    if (action === 'state') {
      if (lic.stripe_customer_id && (body.sync || !lic.period_end || new Date(lic.period_end).getTime() < Date.now())) lic = await syncBilling(lic);
      return json(await consoleState(lic));
    }
    if (action === 'create_key') {
      const mode = body.mode === 'live' ? 'live' : 'test';
      if (mode === 'live' && !['active', 'past_due'].includes(lic.status)) return fail(402, 'not_active', 'Live keys come with a plan. Pick one under Usage and billing.');
      const { count } = await admin.from('licence_keys').select('id', { count: 'exact', head: true }).eq('licensee_id', lic.id).eq('mode', mode).is('revoked_at', null);
      if ((count ?? 0) >= 5) return fail(400, 'too_many', 'You have 5 keys of that kind. Revoke one first.');
      const key = newKey(mode);
      const { data } = await admin.from('licence_keys').insert({ licensee_id: lic.id, mode, name: clean(body.name, 60) || (mode === 'live' ? 'Production' : 'Sandbox'), key_hash: await sha256(key), last4: key.slice(-4) }).select(KEY_COLS).single();
      return json({ key, row: data });
    }
    if (action === 'revoke_key') {
      await admin.from('licence_keys').update({ revoked_at: new Date().toISOString() }).eq('id', String(body.id ?? '')).eq('licensee_id', lic.id).is('revoked_at', null);
      return json({ ok: true });
    }
    if (action === 'save_settings') {
      const settings = tidySettings(body.settings);
      const name = clean(body.name, 120) || lic.name;
      await admin.from('licensees').update({ settings, name }).eq('id', lic.id);
      return json({ ok: true, settings });
    }
    if (action === 'businesses') {
      const mode = body.mode === 'live' ? 'live' : 'test';
      const { data } = await admin.from('licence_businesses').select('id, external_id, name, created_at, last_seen_at, licence_clients(count), licence_memories(count)').eq('licensee_id', lic.id).eq('mode', mode).order('last_seen_at', { ascending: false }).limit(200);
      return json({ businesses: (data ?? []).map((b: any) => ({ id: b.id, external_id: b.external_id, name: b.name, created_at: b.created_at, last_seen_at: b.last_seen_at, clients: b.licence_clients?.[0]?.count ?? 0, memories: b.licence_memories?.[0]?.count ?? 0 })) });
    }
    if (action === 'delete_business') {
      await admin.from('licence_businesses').delete().eq('id', String(body.id ?? '')).eq('licensee_id', lic.id);
      return json({ ok: true });
    }

    // Billing from here on.
    if (!STRIPE) return fail(503, 'not_ready', 'Billing opens soon.');
    let origin = '';
    try { origin = new URL(String(body.returnUrl ?? '')).origin; } catch { /* checked below */ }
    if (!ORIGINS.includes(origin)) return fail(400, 'bad_request', 'Bad return address.');

    if (action === 'checkout') {
      const plan = PLANS[body.plan];
      if (!plan) return fail(400, 'bad_plan', 'Pick a plan.');
      lic = await syncBilling(lic);
      if (lic.stripe_subscription_id && ['active', 'past_due'].includes(lic.status)) {
        // Already on a plan: move it to the new price. Stripe works out the difference.
        const until = minimumUntil(lic);
        if (until && plan.price < (PLANS[lic.plan]?.price ?? 0)) return fail(400, 'minimum_term', `You can move down a plan after ${until.toISOString().slice(0, 10)}, when your minimum term ends.`);
        const sub = await stripe('GET', `subscriptions/${lic.stripe_subscription_id}`);
        await stripe('POST', `subscriptions/${sub.id}`, { items: [{ id: sub.items.data[0].id, price: plan.price_id }], proration_behavior: 'create_prorations', metadata: { ...sub.metadata, licence_plan: body.plan } });
        await syncBilling(lic);
        return json({ ok: true, changed: true });
      }
      let customer = lic.stripe_customer_id;
      if (!customer) {
        customer = (await stripe('POST', 'customers', { email: me.email, name: lic.name, metadata: { tali_licensee_id: lic.id } })).id;
        await admin.from('licensees').update({ stripe_customer_id: customer }).eq('id', lic.id);
      }
      const tax = lic.country === 'AU' ? [await gstRate()] : undefined;
      const setup = body.setup === true && !lic.setup_paid_at;
      const params = {
        mode: 'subscription', customer,
        line_items: [{ price: plan.price_id, quantity: 1, tax_rates: tax }, ...(setup ? [{ price: PRICE_SETUP, quantity: 1, tax_rates: tax }] : [])],
        subscription_data: { metadata: { tali_licensee_id: lic.id, licence_plan: body.plan, setup: setup ? '1' : '0' } },
        metadata: { tali_licensee_id: lic.id, kind: 'brain_licence' },
        billing_address_collection: 'required', tax_id_collection: { enabled: true }, customer_update: { name: 'auto', address: 'auto' },
        custom_text: { submit: { message: `By subscribing you agree to the Tali Brain licence terms at ${SITE.replace(/^https?:\/\//, '')}/brain/terms.${plan.months > 1 ? ` This plan has a ${plan.months} month minimum.` : ''}` } },
        success_url: `${origin}/brain/console?paid=1`, cancel_url: `${origin}/brain/console?tab=billing`,
      };
      // Older Stripe API versions do not know branding_settings: fall back to the account's look.
      const session = await stripe('POST', 'checkout/sessions', { ...params, branding_settings: CHECKOUT_LOOK }).catch(() => stripe('POST', 'checkout/sessions', params));
      return json({ url: session.url });
    }
    if (action === 'portal') {
      if (!lic.stripe_customer_id) return fail(400, 'no_billing', 'There is no billing to manage yet.');
      const s = await stripe('POST', 'billing_portal/sessions', { customer: lic.stripe_customer_id, configuration: minimumUntil(lic) ? PORTAL_LOCKED : PORTAL_OPEN, return_url: `${origin}/brain/console?tab=billing` });
      return json({ url: s.url });
    }
  } catch (e) {
    console.error('brain-api console', action, String(e));
    return fail(500, 'server_error', 'Something went wrong. Please try again.');
  }
  return fail(400, 'bad_action', 'Unknown action.');
}

// ── Entry ────────────────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const u = new URL(req.url);
  const path = u.pathname.replace(/^.*\/brain-api/, '') || '/';
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  try {
    if (req.method === 'GET' && path === '/public/plans') return json(publicPlans());

    if (path === '/internal/daily') {
      const { data: ok } = await admin.rpc('brain_check_key', { p_key: req.headers.get('x-tali-key') ?? '' });
      if (!ok) return fail(401, 'unauthorized', 'No.');
      const { data } = await admin.from('licensees').select('*').not('stripe_customer_id', 'is', null);
      let done = 0;
      for (const lic of data ?? []) { try { await syncBilling(lic); done++; } catch (e) { console.error('brain-api daily', lic.id, String(e)); } }
      return json({ ok: true, checked: done });
    }

    if (path.startsWith('/panel/')) {
      const t = token || u.searchParams.get('token') || '';
      return t.startsWith('thp_') ? await panel(req, t, path) : fail(401, 'bad_token', 'This panel link is not valid.');
    }

    if (token.startsWith('thb_live_') || token.startsWith('thb_test_')) {
      const { data: key } = await admin.from('licence_keys').select('id, licensee_id, mode, revoked_at, last_used_at').eq('key_hash', await sha256(token)).maybeSingle();
      if (!key || key.revoked_at) return fail(401, 'bad_key', 'That API key is not working. Make a new one in the console.');
      const { data: lic } = await admin.from('licensees').select('*').eq('id', key.licensee_id).maybeSingle();
      if (!lic) return fail(401, 'bad_key', 'That API key is not working.');
      if (key.mode === 'live' && !['active', 'past_due'].includes(lic.status)) return fail(402, 'not_active', 'This licence is not active. Check Usage and billing in the console.');
      if (!key.last_used_at || Date.now() - new Date(key.last_used_at).getTime() > 60_000) await admin.from('licence_keys').update({ last_used_at: new Date().toISOString() }).eq('id', key.id);
      return await api(req, { lic, mode: key.mode, s: settingsOf(lic, key.mode) }, path, u);
    }

    if (req.method === 'POST' && path === '/console') return await consoleApi(req, token);
    return fail(401, 'unauthorized', 'Add your API key as a Bearer token.');
  } catch (e) {
    console.error('brain-api', String(e));
    return fail(500, 'server_error', 'Something went wrong. Please try again.');
  }
});
