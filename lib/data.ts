import { supabase } from './supabase';

export type Credits = {
  plan: 'free' | 'hq' | 'pro';
  status: string;
  trialEndsAt: string | null;
  creditsMonth: number;
  messagesMonth: number | null;
  used: number;
  // ADDED (6 Nov 2026, images): images are counted on their own, not in credits.
  images?: { allowance: number; used: number; remaining: number; trial?: boolean; extra?: number } | null;
  // ADDED (6 Nov 2026, top ups): extra credits bought, never expire, used after the month's.
  extra?: number;
  // ADDED (6 Nov 2026): Free gets a few web searches a month (null on paid plans, where searching costs credits).
  searches?: { allowance: number; used: number; remaining: number } | null;
  // ADDED (6 Nov 2026): Free's Deep think count (null on paid plans, where it costs credits).
  deep?: { allowance: number; used: number; remaining: number } | null;
};

export async function myCredits(): Promise<Credits | null> {
  const { data, error } = await supabase.rpc('my_credits');
  if (error) throw error;
  return (data as Credits | null) ?? null;
}

export type Brief = {
  id: string;
  kind: 'morning' | 'health' | 'weekly' | 'journal' | 'patterns';
  for_date: string;
  title: string | null;
  content: { headline?: string; lines?: string[]; paragraphs?: string[] };
  read_at: string | null;
  created_at: string;
};

export async function recentBriefs(limit = 5): Promise<Brief[]> {
  const { data, error } = await supabase
    .from('briefs')
    .select('id, kind, for_date, title, content, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Brief[]) ?? [];
}

export async function markBriefRead(id: string) {
  await supabase.from('briefs').update({ read_at: new Date().toISOString() }).eq('id', id);
}

export type Approval = {
  id: string;
  kind: string;
  title: string;
  status: string;
  draft: { to?: string | null; to_name?: string | null; from?: string; subject?: string; body?: string; action?: string; invoice_id?: string; email?: string | null; email_id?: string | null; summary?: string | null; title?: string; start?: string; end?: string; attendee_email?: string | null; location?: string | null; link?: string | null } | null;
  created_at: string;
};

export async function pendingApprovals(): Promise<Approval[]> {
  const { data, error } = await supabase
    .from('approvals')
    .select('id, kind, title, status, draft, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data as Approval[]) ?? [];
}

// The user's call on a draft: done (they sent it themselves) or rejected (not needed).
export async function decideApproval(id: string, status: 'done' | 'rejected') {
  const { error } = await supabase.from('approvals').update({ status, decided_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export type JournalEntry = {
  id: string;
  kind: 'journal' | 'note';
  title: string | null;
  body: string;
  mood: number | null;
  private_to_tali: boolean;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

export async function journalEntries(): Promise<JournalEntry[]> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, kind, title, body, mood, private_to_tali, pinned, created_at, updated_at')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data as JournalEntry[]) ?? [];
}

export async function saveJournalEntry(entry: {
  id?: string;
  kind: 'journal' | 'note';
  title: string | null;
  body: string;
  mood: number | null;
  private_to_tali: boolean;
}) {
  if (entry.id) {
    const { id, ...rest } = entry;
    const { error } = await supabase.from('journal_entries').update(rest).eq('id', id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('journal_entries').insert(entry);
    if (error) throw error;
  }
}

export async function deleteJournalEntry(id: string) {
  const { error } = await supabase.from('journal_entries').delete().eq('id', id);
  if (error) throw error;
}

export type Memory = { id: string; kind: string; content: string; about: string[]; source: string; created_at: string };

export async function myMemories(): Promise<Memory[]> {
  const { data, error } = await supabase.rpc('my_memories', { p_limit: 200 });
  if (error) throw error;
  return (data as Memory[]) ?? [];
}

export async function forgetMemory(id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('forget_memory', { p_id: id });
  if (error) throw error;
  return data === true;
}

// Photos and files in Talk (3 Nov 2026). `path` is the file in the private chat-uploads bucket;
// `url` is a signed link filled in when messages load (good for an hour).
// Images Tali makes (6 Nov 2026) start as a placeholder with no path: making is true while she draws
// it, failed holds the reason if it did not come through, prompt is what she asked for.
export type Attachment = { kind: 'image' | 'pdf'; path: string; name: string; size?: number; url?: string; making?: boolean; failed?: string | null; prompt?: string; shape?: string; deleted?: boolean };
// meta.deep marks a Deep think reply; meta.suggest_deep is Tali offering one (6 Nov 2026).
export type DeepLevel = 'deep' | 'deepest';
export type Message = { id: string; role: 'user' | 'assistant' | 'tool'; content: string; created_at: string; attachments?: Attachment[] | null; meta?: { deep?: DeepLevel; suggest_deep?: boolean } | null };
export const MAX_ATTACHMENTS = 4;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

// Uploads one file for a chat and returns the attachment to send with the message.
export async function uploadAttachment(conversationId: string, file: { blob: Blob; name: string; mime: string }): Promise<Attachment> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error('Not signed in');
  const isPdf = file.mime === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf && !file.mime.startsWith('image/')) throw new Error('Photos and PDFs only for now.');
  if (file.blob.size > MAX_FILE_BYTES) throw new Error(`${file.name} is over 10 MB.`);
  const ext = isPdf ? 'pdf' : file.mime === 'image/png' ? 'png' : file.mime === 'image/webp' ? 'webp' : file.mime === 'image/gif' ? 'gif' : 'jpg';
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const path = `${uid}/${conversationId}/${id}.${ext}`;
  const { error } = await supabase.storage.from('chat-uploads').upload(path, file.blob, { contentType: isPdf ? 'application/pdf' : file.mime, upsert: false });
  if (error) throw error;
  return { kind: isPdf ? 'pdf' : 'image', path, name: file.name.slice(0, 80), size: file.blob.size };
}

async function signAttachments(rows: Message[]): Promise<Message[]> {
  const paths = rows.flatMap((m) => (m.attachments ?? []).map((a) => a.path)).filter(Boolean);
  if (!paths.length) return rows;
  const { data } = await supabase.storage.from('chat-uploads').createSignedUrls(Array.from(new Set(paths)), 3600);
  const urls = new Map((Array.isArray(data) ? data : []).map((d) => [d.path, d.signedUrl]));
  return rows.map((m) => (m.attachments?.length ? { ...m, attachments: m.attachments.map((a) => ({ ...a, url: urls.get(a.path) ?? a.url })) } : m));
}

async function removeChatFiles(conversationId: string) {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return;
  const folder = `${uid}/${conversationId}`;
  const { data: files } = await supabase.storage.from('chat-uploads').list(folder, { limit: 1000 });
  if (files?.length) await supabase.storage.from('chat-uploads').remove(files.map((f) => `${folder}/${f.name}`));
}

// Chat history (3 Nov 2026): many chats, pinned first. Titles come from the first message
// unless the user renames the chat.
export type ConversationRow = { id: string; title: string; pinned: boolean; updated_at: string; last_message: string | null; message_count: number };

export async function listConversations(): Promise<ConversationRow[]> {
  const { data, error } = await supabase.rpc('my_conversations');
  if (error) throw error;
  return (data ?? []) as ConversationRow[];
}

export async function renameConversation(id: string, title: string) {
  const { error } = await supabase.from('conversations').update({ title: title.trim().slice(0, 80), title_set_by_user: true }).eq('id', id);
  if (error) throw error;
}

export async function pinConversation(id: string, pinned: boolean) {
  const { error } = await supabase.from('conversations').update({ pinned }).eq('id', id);
  if (error) throw error;
}

export async function deleteConversation(id: string) {
  await removeChatFiles(id).catch(() => {});
  const { error } = await supabase.from('conversations').delete().eq('id', id);
  if (error) throw error;
}

// The most recent chat (the one Talk opens by default).
export async function currentConversation(): Promise<string> {
  const { data } = await supabase.from('conversations').select('id').order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (data?.id) return data.id as string;
  const { data: created, error } = await supabase.from('conversations').insert({ title: 'Chat with Tali' }).select('id').single();
  if (error) throw error;
  return created.id as string;
}

export async function newConversation(): Promise<string> {
  const { data, error } = await supabase.from('conversations').insert({ title: 'Chat with Tali' }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function messages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, role, content, created_at, attachments, meta')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  return signAttachments((data as Message[]) ?? []);
}

export type ChatResult =
  | { ok: true; reply: string; messageId?: string; remembered: number; drafted?: number; clientsSaved?: number; remindersSet?: number; goalsSaved?: number; decisionsLogged?: number; invoicesDrafted?: number; foodLogged?: number; weightLogged?: boolean; workoutsLogged?: number; planSaved?: boolean; searched?: number; image?: { messageId: string; index: number } | null; deep?: DeepLevel | null; suggestDeep?: boolean; remaining: number | null }
  | { ok: false; code: string; message: string; remaining?: number };

// One turn with Tali. The tali-chat edge function saves both messages, checks the plan and
// remembers anything worth keeping in this user's private brain.
export async function sendMessage(conversationId: string, text: string, attachments: Attachment[] = [], deep: DeepLevel | null = null): Promise<ChatResult> {
  const files = attachments.map(({ kind, path, name, size }) => ({ kind, path, name, size }));
  const { data, error } = await supabase.functions.invoke('tali-chat', { body: { conversationId, text, attachments: files, ...(deep ? { deep } : {}) } });
  if (error) {
    // Non-2xx answers still carry our JSON body with a friendly message.
    try {
      const body = await (error as any).context?.json?.();
      if (body?.message) return { ok: false, code: body.code ?? 'error', message: body.message, remaining: body.remaining };
    } catch {}
    return { ok: false, code: 'network', message: "I couldn't reach Tali. Check your connection and try again." };
  }
  return data as ChatResult;
}

// Tali draws an image she promised in a reply (tali-image). Takes about half a minute.
export type ImageResult = { ok: true; attachment: Attachment; remaining?: number } | { ok: false; code: string; message: string };
export async function makeImage(messageId: string, index = 0): Promise<ImageResult> {
  const { data, error } = await supabase.functions.invoke('tali-image', { body: { messageId, index } });
  if (error) {
    try {
      const body = await (error as any).context?.json?.();
      if (body?.message) return { ok: false, code: body.code ?? 'error', message: body.message };
    } catch {}
    return { ok: false, code: 'network', message: "That image didn't come through. It wasn't counted, try again." };
  }
  return data as ImageResult;
}

// Permanently deletes the signed-in account and everything Tali knows about them.
export async function deleteAccount(confirm: string): Promise<{ ok: boolean; message?: string }> {
  const { data, error } = await supabase.functions.invoke('delete-account', { body: { confirm } });
  if (error) {
    try {
      const body = await (error as any).context?.json?.();
      if (body?.message) return { ok: false, message: body.message };
    } catch {}
    return { ok: false, message: "Couldn't reach the server. Try again." };
  }
  return data as { ok: boolean; message?: string };
}

export type Plan = {
  id: 'free' | 'hq' | 'pro';
  name: string;
  monthly_price_aud: number;
  yearly_price_aud: number | null;
  credits_month: number;
  messages_month: number | null;
  features: string[];
  sort: number;
};

export async function plans(): Promise<Plan[]> {
  const { data, error } = await supabase.from('plans').select('id, name, monthly_price_aud, yearly_price_aud, credits_month, messages_month, features, sort').order('sort');
  if (error) throw error;
  return (data as Plan[]) ?? [];
}

export async function mySubscription(): Promise<{ plan_id: string; status: string; founding_member: boolean; stripe_customer_id: string | null; stripe_subscription_id: string | null; current_period_end: string | null } | null> {
  const { data } = await supabase.from('subscriptions').select('plan_id, status, founding_member, stripe_customer_id, stripe_subscription_id, current_period_end').maybeSingle();
  return (data as any) ?? null;
}

async function invokeForUrl(fn: string, body: Record<string, unknown>): Promise<{ ok: boolean; url?: string; message?: string }> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    try {
      const b = await (error as any).context?.json?.();
      if (b?.message) return { ok: false, message: b.message };
    } catch {}
    return { ok: false, message: "Couldn't reach the server. Try again." };
  }
  return data;
}

// Web only for now. In the iOS and Android apps, upgrades will go through the stores.
export const startCheckout = (plan: 'hq' | 'pro', returnUrl: string, interval: 'month' | 'year' = 'month') =>
  invokeForUrl('create-checkout', { plan, interval, returnUrl });
// Top up (6 Nov 2026): a one-off Stripe payment for a pack in supabase/functions/_shared/topups.ts.
export const startTopup = (pack: string, returnUrl: string) => invokeForUrl('create-checkout', { topup: pack, returnUrl });
export const openBillingPortal = (returnUrl: string) => invokeForUrl('billing-portal', { returnUrl });

// ---------- Clients and leads ----------
export type Client = {
  id: string;
  name: string;
  kind: 'client' | 'lead';
  status: string;
  email: string | null;
  phone: string | null;
  notes: string;
  next_follow_up: string | null;
  last_contact_at: string | null;
  source: string | null;
  updated_at: string;
};

const CLIENT_COLS = 'id, name, kind, status, email, phone, notes, next_follow_up, last_contact_at, source, updated_at';

export async function clients(): Promise<Client[]> {
  const { data, error } = await supabase.from('clients').select(CLIENT_COLS).order('name');
  if (error) throw error;
  return (data as Client[]) ?? [];
}

export async function saveClient(c: Partial<Client> & { name: string; kind: 'client' | 'lead'; status: string }) {
  const row = {
    name: c.name.trim(),
    kind: c.kind,
    status: c.status,
    email: c.email?.trim() || null,
    phone: c.phone?.trim() || null,
    notes: c.notes ?? '',
    next_follow_up: c.next_follow_up || null,
    last_contact_at: c.last_contact_at || null,
  };
  if (c.id) {
    const { error } = await supabase.from('clients').update(row).eq('id', c.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('clients').insert({ ...row, source: 'app' });
    if (error) throw error;
  }
}

export async function deleteClient(id: string) {
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) throw error;
}

// Follow-ups due today or overdue, in the user's local date.
export async function followUpsDue(localDate: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select(CLIENT_COLS)
    .not('next_follow_up', 'is', null)
    .lte('next_follow_up', localDate)
    .not('status', 'in', '(lost,past)')
    .order('next_follow_up');
  if (error) throw error;
  return (data as Client[]) ?? [];
}

// ---------- Reminders ----------
export type Reminder = { id: string; text: string; due_at: string; done_at: string | null; client_id: string | null; created_by: string };

export async function openReminders(untilIso: string): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select('id, text, due_at, done_at, client_id, created_by')
    .is('done_at', null)
    .lte('due_at', untilIso)
    .order('due_at');
  if (error) throw error;
  return (data as Reminder[]) ?? [];
}

export async function completeReminder(id: string) {
  const { error } = await supabase.from('reminders').update({ done_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

// 4 Nov 2026: snooze and delete from Today's Due list.
export async function rescheduleReminder(id: string, dueAt: Date) {
  const { error } = await supabase.from('reminders').update({ due_at: dueAt.toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function deleteReminder(id: string) {
  const { error } = await supabase.from('reminders').delete().eq('id', id);
  if (error) throw error;
}

export async function addReminder(text: string, dueAt: Date) {
  const { error } = await supabase.from('reminders').insert({ text: text.trim(), due_at: dueAt.toISOString() });
  if (error) throw error;
}

// ---------- Tali's weekly journal ----------
export async function taliJournal(limit = 8): Promise<Brief[]> {
  const { data, error } = await supabase
    .from('briefs')
    .select('id, kind, for_date, title, content, read_at, created_at')
    .eq('kind', 'journal')
    .order('for_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Brief[]) ?? [];
}

// ---------- Business health ----------
export type HealthItem = { area: string; level: 'amber' | 'red'; text: string };
export type Health = { status: 'green' | 'amber' | 'red'; items: HealthItem[]; checkedAt: string };

export async function myHealth(): Promise<Health | null> {
  const { data, error } = await supabase.rpc('my_business_health');
  if (error) throw error;
  return (data as Health) ?? null;
}

// ---------- Invoices ----------
export type InvoiceItem = { description: string; qty: number; unit_price: number };
export type Invoice = {
  id: string;
  client_id: string | null;
  client_name: string;
  client_email: string | null;
  number: string;
  issue_date: string;
  due_date: string;
  items: InvoiceItem[];
  gst: boolean;
  subtotal: number;
  gst_amount: number;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'void';
  sent_at: string | null;
  paid_at: string | null;
  notes: string;
  created_by: 'user' | 'tali';
  created_at: string;
  stripe_invoice_id: string | null;
  stripe_url: string | null;
  paid_via: 'stripe' | 'manual' | null;
};
export type InvoiceSettings = {
  business_name: string | null;
  abn: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  payment_details: string | null;
  gst_registered: boolean;
  default_due_days: number;
  next_number: number;
  footer: string | null;
};

const INVOICE_COLS = 'id, client_id, client_name, client_email, number, issue_date, due_date, items, gst, subtotal, gst_amount, total, status, sent_at, paid_at, notes, created_by, created_at, stripe_invoice_id, stripe_url, paid_via';

export async function invoices(): Promise<Invoice[]> {
  const { data, error } = await supabase.from('invoices').select(INVOICE_COLS).order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return ((data as any[]) ?? []).map((r) => ({ ...r, subtotal: Number(r.subtotal), gst_amount: Number(r.gst_amount), total: Number(r.total) }));
}

export async function saveInvoice(inv: {
  id?: string;
  client_id?: string | null;
  client_name: string;
  client_email?: string | null;
  issue_date: string;
  due_date: string;
  items: InvoiceItem[];
  gst: boolean;
  notes: string;
  status?: Invoice['status'];
}): Promise<Invoice> {
  const row = {
    client_id: inv.client_id ?? null,
    client_name: inv.client_name.trim(),
    client_email: inv.client_email?.trim() || null,
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    items: inv.items.filter((i) => i.description.trim()).map((i) => ({ description: i.description.trim(), qty: Number(i.qty) || 1, unit_price: Number(i.unit_price) || 0 })),
    gst: inv.gst,
    notes: inv.notes,
    ...(inv.status ? { status: inv.status } : {}),
  };
  const q = inv.id ? supabase.from('invoices').update(row).eq('id', inv.id) : supabase.from('invoices').insert(row);
  const { data, error } = await q.select(INVOICE_COLS).single();
  if (error) throw error;
  return { ...(data as any), subtotal: Number((data as any).subtotal), gst_amount: Number((data as any).gst_amount), total: Number((data as any).total) };
}

export async function setInvoiceStatus(id: string, status: Invoice['status']) {
  const { error } = await supabase.from('invoices').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteInvoice(id: string) {
  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) throw error;
}

export async function invoiceSettings(): Promise<InvoiceSettings | null> {
  const { data, error } = await supabase
    .from('invoice_settings')
    .select('business_name, abn, address, email, phone, payment_details, gst_registered, default_due_days, next_number, footer')
    .maybeSingle();
  if (error) throw error;
  return (data as InvoiceSettings) ?? null;
}

export async function saveInvoiceSettings(s: Partial<InvoiceSettings>) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from('invoice_settings').upsert({ user_id: u.user?.id, ...s });
  if (error) throw error;
}

// ---------- Pro: rules ----------
export type RuleType = 'quiet_client' | 'overdue_invoice' | 'weekly_reminder' | 'new_lead';
export type Rule = { id: string; type: RuleType; params: Record<string, any>; enabled: boolean; last_run_at: string | null; runs: number };

export async function rules(): Promise<Rule[]> {
  const { data, error } = await supabase.from('rules').select('id, type, params, enabled, last_run_at, runs').order('created_at');
  if (error) throw error;
  return (data as Rule[]) ?? [];
}

export async function saveRule(r: { id?: string; type: RuleType; params: Record<string, any>; enabled: boolean }) {
  const row = { type: r.type, params: r.params, enabled: r.enabled };
  const { error } = r.id ? await supabase.from('rules').update(row).eq('id', r.id) : await supabase.from('rules').insert(row);
  if (error) throw error;
}

export async function deleteRule(id: string) {
  const { error } = await supabase.from('rules').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Pro: Tali's email address ----------
export type InboundEmail = {
  id: string;
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  body_text: string | null;
  summary: string | null;
  status: 'new' | 'handled' | 'spam';
  approval_id: string | null;
  received_at: string;
  source: 'tali_inbox' | 'gmail' | 'outlook';
  category: 'needs_you' | 'fyi' | 'spam' | null;
  snippet: string | null;
};

export async function myInbox(): Promise<string | null> {
  const { data } = await supabase.from('tali_inboxes').select('alias').maybeSingle();
  return (data as any)?.alias ?? null;
}

// 4 Nov 2026: the user picks the word before the @ (letters and numbers, 3 to 24). Leave it out and
// the server builds one from the business name. The RPC raises a friendly message when it is taken.
export async function claimInbox(alias?: string): Promise<string> {
  const { data, error } = await supabase.rpc('claim_tali_inbox', { p_alias: alias?.trim() || null });
  if (error) throw error;
  return data as string;
}

// The suggestion the server would use, to pre-fill the box. Never claims anything.
export async function suggestInboxAlias(): Promise<string> {
  const { data, error } = await supabase.rpc('suggest_tali_alias');
  if (error) throw error;
  return String(data ?? '');
}

export async function inboundEmails(): Promise<InboundEmail[]> {
  const { data, error } = await supabase
    .from('inbound_emails')
    .select('id, from_email, from_name, subject, body_text, summary, status, approval_id, received_at, source, category, snippet')
    .order('received_at', { ascending: false })
    .limit(80);
  if (error) throw error;
  return (data as InboundEmail[]) ?? [];
}

export async function setEmailStatus(id: string, status: InboundEmail['status']) {
  const { error } = await supabase.from('inbound_emails').update({ status }).eq('id', id);
  if (error) throw error;
}

// ---------- Night school ----------
export type NightSchool = { enabled: boolean; topics: string[]; nights: 'every' | 'three' };
export type NightNote = { id: string; for_date: string; topic: string; headline: string; learnt: string[]; sources: { title: string; url: string }[]; read_at: string | null };

export async function nightSchool(): Promise<NightSchool | null> {
  const { data, error } = await supabase.from('night_school').select('enabled, topics, nights').maybeSingle();
  if (error) throw error;
  return (data as NightSchool) ?? null;
}

export async function saveNightSchool(n: NightSchool) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from('night_school').upsert({ user_id: u.user?.id, enabled: n.enabled, topics: n.topics, nights: n.nights });
  if (error) throw error;
}

export async function nightNotes(limit = 20): Promise<NightNote[]> {
  const { data, error } = await supabase
    .from('night_school_notes')
    .select('id, for_date, topic, headline, learnt, sources, read_at')
    .order('for_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as NightNote[]) ?? [];
}

export async function markNightNoteRead(id: string) {
  await supabase.from('night_school_notes').update({ read_at: new Date().toISOString() }).eq('id', id);
}

// ---------- Pro: Tali's voice ----------
// Returns a short-lived link to an MP3 of Tali reading that reply in her own voice.
export async function taliVoice(messageId: string): Promise<{ ok: true; url: string } | { ok: false; code: string; message: string }> {
  const { data, error } = await supabase.functions.invoke('tali-voice', { body: { messageId } });
  if (error) {
    try {
      const b = await (error as any).context?.json?.();
      if (b?.message) return { ok: false, code: b.code ?? 'error', message: b.message };
    } catch {}
    return { ok: false, code: 'network', message: "Couldn't reach Tali. Check your connection." };
  }
  return data;
}

// ---------- Food and training (logged by chatting with Tali) ----------
export type LifeSummary = {
  date: string;
  food_today: { calories: number; protein_g: number; carbs_g: number; fat_g: number; items: number };
  weight: { kg: number; date: string } | null;
  weight_week_ago: number | null;
  plan_name: string | null;
  today_session: string | null;
  today_done: boolean;
  sessions_planned: number;
  sessions_done_this_week: number;
  streak_weeks: number;
};
export type FoodLog = { id: string; local_date: string; meal: 'breakfast' | 'lunch' | 'dinner' | 'snack'; description: string; calories: number; protein_g: number; carbs_g: number; fat_g: number };
export type WeightLog = { id: string; local_date: string; kg: number };
export type PlanDay = { weekday: number; label: string; notes?: string };
export type TrainingPlan = { name: string; days: PlanDay[] };
export type WorkoutLog = { id: string; local_date: string; label: string; notes: string };

export async function lifeSummary(): Promise<LifeSummary | null> {
  const { data, error } = await supabase.rpc('my_life_summary');
  if (error) throw error;
  return (data as LifeSummary) ?? null;
}

export async function foodOn(localDate: string): Promise<FoodLog[]> {
  const { data, error } = await supabase
    .from('food_logs')
    .select('id, local_date, meal, description, calories, protein_g, carbs_g, fat_g')
    .eq('local_date', localDate)
    .order('created_at');
  if (error) throw error;
  return ((data as any[]) ?? []).map((f) => ({ ...f, protein_g: Number(f.protein_g), carbs_g: Number(f.carbs_g), fat_g: Number(f.fat_g) }));
}

export async function deleteFood(id: string) {
  const { error } = await supabase.from('food_logs').delete().eq('id', id);
  if (error) throw error;
}

export async function weights(limit = 30): Promise<WeightLog[]> {
  const { data, error } = await supabase.from('weight_logs').select('id, local_date, kg').order('local_date', { ascending: false }).limit(limit);
  if (error) throw error;
  return ((data as any[]) ?? []).map((w) => ({ ...w, kg: Number(w.kg) }));
}

export async function trainingPlan(): Promise<TrainingPlan | null> {
  const { data, error } = await supabase.from('training_plans').select('name, days').maybeSingle();
  if (error) throw error;
  return (data as TrainingPlan) ?? null;
}

export async function workoutsSince(localDate: string): Promise<WorkoutLog[]> {
  const { data, error } = await supabase.from('workout_logs').select('id, local_date, label, notes').gte('local_date', localDate).order('local_date', { ascending: false });
  if (error) throw error;
  return (data as WorkoutLog[]) ?? [];
}

export async function logWorkout(localDate: string, label: string) {
  const { error } = await supabase.from('workout_logs').insert({ local_date: localDate, label });
  if (error) throw error;
}

export async function deleteWorkout(id: string) {
  const { error } = await supabase.from('workout_logs').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Stripe: businesses connect their own Stripe so Tali can send invoices through it ----------
export type StripeConnection = { account_id: string; business_name: string | null; livemode: boolean; connected_at: string };

export async function stripeConnection(): Promise<StripeConnection | null> {
  const { data, error } = await supabase.from('stripe_connections').select('account_id, business_name, livemode, connected_at').maybeSingle();
  if (error) throw error;
  return (data as StripeConnection | null) ?? null;
}

async function stripeCall(body: Record<string, unknown>): Promise<{ ok: boolean; message?: string; url?: string | null; code?: string }> {
  const { data, error } = await supabase.functions.invoke('stripe-invoices', { body });
  if (error) {
    try {
      const b = await (error as any).context?.json?.();
      if (b?.message) return { ok: false, code: b.code, message: b.message };
    } catch {}
    return { ok: false, message: "Couldn't reach the server. Try again." };
  }
  return data as { ok: boolean; url?: string | null };
}

// Returns the Stripe page to open; Stripe sends them back to /settings?stripe=connected.
export const startStripeConnect = (returnUrl: string) => stripeCall({ action: 'connect', returnUrl });
export const disconnectStripe = () => stripeCall({ action: 'disconnect' });
// Creates the invoice in their Stripe and emails it to the client. Only ever called from their tap.
export const sendInvoiceWithStripe = (invoiceId: string) => stripeCall({ action: 'send', invoiceId });

// ---------- Google: Gmail and Google Calendar, one sign-in ----------
export type GoogleConnection = { google_email: string; scopes: string[]; last_mail_sync_at: string | null; last_error: string | null; connected_at: string };

export async function googleConnection(): Promise<GoogleConnection | null> {
  const { data, error } = await supabase.from('google_connections').select('google_email, scopes, last_mail_sync_at, last_error, connected_at').maybeSingle();
  if (error) throw error;
  return (data as GoogleConnection | null) ?? null;
}

export type CalendarToday = {
  connected: boolean;
  account?: string;
  events?: { title: string; when: string; location: string | null; attendees: string[] }[];
  free_today?: string[];
  error?: string;
};

async function googleCall(body: Record<string, unknown>): Promise<{ ok: boolean; message?: string; url?: string | null; code?: string; link?: string | null } & Partial<CalendarToday>> {
  const { data, error } = await supabase.functions.invoke('google-connect', { body });
  if (error) {
    try {
      const b = await (error as any).context?.json?.();
      if (b?.message) return { ok: false, code: b.code, message: b.message };
    } catch {}
    return { ok: false, message: "Couldn't reach the server. Try again." };
  }
  return data as { ok: boolean; url?: string | null };
}

// Returns Google's consent page to open; Google sends them back to /settings?google=connected.
export const startGoogleConnect = (returnUrl: string, what: 'both' | 'calendar' = 'both') => googleCall({ action: 'connect', returnUrl, what });
export const disconnectGoogle = () => googleCall({ action: 'disconnect' });
// Only ever called from their tap on Today.
export const sendEmailApproval = (approvalId: string) => googleCall({ action: 'send', approvalId });
export const bookEventApproval = (approvalId: string) => googleCall({ action: 'book', approvalId });

// ADDED (2 Nov 2026): a reply to email that arrived at their own Tali address (Pro). Only ever
// called from their tap on Today. 4 Nov 2026: goes out from their connected Gmail or Outlook when
// they have one (via 'gmail' | 'outlook'), otherwise from the Tali address itself (via 'tali').
export async function sendFromTaliAddress(approvalId: string): Promise<{ ok: boolean; message?: string; code?: string; from?: string; via?: 'gmail' | 'outlook' | 'tali' }> {
  const { data, error } = await supabase.functions.invoke('tali-send', { body: { approvalId } });
  if (error) {
    try {
      const b = await (error as any).context?.json?.();
      if (b?.message) return { ok: false, code: b.code, message: b.message };
    } catch {}
    return { ok: false, message: "Couldn't reach the server. Try again." };
  }
  return data as { ok: boolean; from?: string; via?: 'gmail' | 'outlook' | 'tali' };
}
export const calendarToday = () => googleCall({ action: 'calendar' }) as Promise<CalendarToday & { ok: boolean }>;

// ---------- Founder stats (Taj only, 2 Nov 2026) ----------
export type FounderStats = {
  accounts: number;
  onboarded: number;
  signups_7d: number;
  signups_30d: number;
  by_plan: Record<string, number>;
  trialing: number;
  trials_ending_7d: number;
  paid_active: number;
  paid_hq: number;
  paid_pro: number;
  founding: number;
  trial_expired_unpaid: number;
  waitlist_founding_emails: number;
  google_connected: number;
  stripe_connected: number;
  push_devices: number;
  push_web: number;
  tali_addresses: number;
  month: {
    credits: number;
    tokens_in: number;
    tokens_out: number;
    active_users: number;
    by_feature: Record<string, number>;
    chats_today: number;
    emails_sorted: number;
    approvals_done: number;
    approvals_pending: number;
  };
  top_users: { first_name: string | null; business_name: string | null; plan_id: string | null; status: string | null; credits: number; tokens_in: number; tokens_out: number }[];
  generated_at: string;
};

export async function founderStats(): Promise<FounderStats> {
  const { data, error } = await supabase.rpc('founder_stats');
  if (error) throw error;
  return data as FounderStats;
}

// Top ups sold (6 Nov 2026), founder only. Null for everyone else or before migration 050.
export type FounderTopups = { month_aud: number; month_count: number; total_aud: number; total_count: number };
export async function founderTopups(): Promise<FounderTopups | null> {
  const { data, error } = await supabase.rpc('founder_topups');
  if (error || !data) return null;
  return data as FounderTopups;
}

// ---------- Talk back to a draft (2 Nov 2026) ----------
// instruction: 'shorter' | 'warmer' | 'formal' | 'casual' or anything in the user's words.
export async function editDraft(approvalId: string, instruction: string): Promise<{ ok: true; body: string; subject: string | null } | { ok: false; message: string }> {
  const { data, error } = await supabase.functions.invoke('tali-draft-edit', { body: { approvalId, instruction } });
  if (error) {
    const ctx = (error as any)?.context;
    try {
      const j = ctx && typeof ctx.json === 'function' ? await ctx.json() : null;
      return { ok: false, message: j?.message ?? "I couldn't rework that one just now." };
    } catch {
      return { ok: false, message: "I couldn't rework that one just now." };
    }
  }
  if (!data?.ok) return { ok: false, message: data?.message ?? "I couldn't rework that one just now." };
  return { ok: true, body: String(data.body ?? ''), subject: data.subject ?? null };
}

// ---------- Microsoft 365 / Outlook (2 Nov 2026), the twin of the Google helpers ----------
export type MicrosoftConnection = { ms_email: string; scopes: string[]; last_mail_sync_at: string | null; last_error: string | null; connected_at: string };

export async function microsoftConnection(): Promise<MicrosoftConnection | null> {
  const { data, error } = await supabase.from('microsoft_connections').select('ms_email, scopes, last_mail_sync_at, last_error, connected_at').maybeSingle();
  if (error) throw error;
  return (data as MicrosoftConnection | null) ?? null;
}

async function msCall(body: Record<string, unknown>): Promise<{ ok: boolean; message?: string; url?: string | null; code?: string; link?: string | null } & Partial<CalendarToday>> {
  const { data, error } = await supabase.functions.invoke('ms-connect', { body });
  if (error) {
    try {
      const b = await (error as any).context?.json?.();
      if (b?.message) return { ok: false, code: b.code, message: b.message };
    } catch {}
    return { ok: false, message: "Couldn't reach the server. Try again." };
  }
  return data as { ok: boolean; url?: string | null };
}

export const startMicrosoftConnect = (returnUrl: string, what: 'both' | 'calendar' = 'both') => msCall({ action: 'connect', returnUrl, what });
export const disconnectMicrosoft = () => msCall({ action: 'disconnect' });
export const sendOutlookApproval = (approvalId: string) => msCall({ action: 'send', approvalId });
export const bookOutlookApproval = (approvalId: string) => msCall({ action: 'book', approvalId });
export const outlookCalendarToday = () => msCall({ action: 'calendar' }) as Promise<CalendarToday & { ok: boolean }>;

// Whichever calendar is connected (Google first, then Outlook), for Today.
export async function anyCalendarToday(): Promise<(CalendarToday & { ok: boolean }) | null> {
  const g = await calendarToday().catch(() => null);
  if (g?.connected) return g;
  const m = await outlookCalendarToday().catch(() => null);
  return m?.connected ? m : g ?? m;
}

// ---------- Founder: every account (4 Nov 2026, Taj only) ----------
export type FounderUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  first_name: string | null;
  business_name: string | null;
  business_type: string | null;
  about_me: string | null;
  timezone: string | null;
  onboarded_at: string | null;
  plan_id: string | null;
  status: string | null;
  trial_ends_at: string | null;
  founding_member: boolean | null;
  paying_stripe: boolean | null;
  current_period_end: string | null;
  credits_month: number;
  messages_total: number;
  last_message_at: string | null;
  journal_count: number;
  clients_count: number;
  google: boolean;
  stripe: boolean;
  devices: number;
};

export async function founderUsers(): Promise<FounderUser[]> {
  const { data, error } = await supabase.rpc('founder_users');
  if (error) throw error;
  return (data ?? []) as FounderUser[];
}
