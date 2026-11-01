import { supabase } from './supabase';

export type Credits = {
  plan: 'free' | 'hq' | 'pro';
  status: string;
  trialEndsAt: string | null;
  creditsMonth: number;
  messagesMonth: number | null;
  used: number;
};

export async function myCredits(): Promise<Credits | null> {
  const { data, error } = await supabase.rpc('my_credits');
  if (error) throw error;
  return (data as Credits | null) ?? null;
}

export type Brief = {
  id: string;
  kind: 'morning' | 'health' | 'weekly' | 'journal';
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
  draft: { to?: string | null; subject?: string; body?: string } | null;
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

export type Message = { id: string; role: 'user' | 'assistant' | 'tool'; content: string; created_at: string };

// One running conversation for now; threads come later.
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
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data as Message[]) ?? [];
}

export type ChatResult =
  | { ok: true; reply: string; messageId?: string; remembered: number; drafted?: number; clientsSaved?: number; remindersSet?: number; invoicesDrafted?: number; searched?: number; remaining: number | null }
  | { ok: false; code: string; message: string; remaining?: number };

// One turn with Tali. The tali-chat edge function saves both messages, checks the plan and
// remembers anything worth keeping in this user's private brain.
export async function sendMessage(conversationId: string, text: string): Promise<ChatResult> {
  const { data, error } = await supabase.functions.invoke('tali-chat', { body: { conversationId, text } });
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
  credits_month: number;
  messages_month: number | null;
  features: string[];
  sort: number;
};

export async function plans(): Promise<Plan[]> {
  const { data, error } = await supabase.from('plans').select('id, name, monthly_price_aud, credits_month, messages_month, features, sort').order('sort');
  if (error) throw error;
  return (data as Plan[]) ?? [];
}

export async function mySubscription(): Promise<{ plan_id: string; status: string; founding_member: boolean; stripe_customer_id: string | null; current_period_end: string | null } | null> {
  const { data } = await supabase.from('subscriptions').select('plan_id, status, founding_member, stripe_customer_id, current_period_end').maybeSingle();
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
export const startCheckout = (plan: 'hq' | 'pro', returnUrl: string) => invokeForUrl('create-checkout', { plan, interval: 'month', returnUrl });
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

const INVOICE_COLS = 'id, client_id, client_name, client_email, number, issue_date, due_date, items, gst, subtotal, gst_amount, total, status, sent_at, paid_at, notes, created_by, created_at';

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
};

export async function myInbox(): Promise<string | null> {
  const { data } = await supabase.from('tali_inboxes').select('alias').maybeSingle();
  return (data as any)?.alias ?? null;
}

export async function claimInbox(): Promise<string> {
  const { data, error } = await supabase.rpc('claim_tali_inbox');
  if (error) throw error;
  return data as string;
}

export async function inboundEmails(): Promise<InboundEmail[]> {
  const { data, error } = await supabase
    .from('inbound_emails')
    .select('id, from_email, from_name, subject, body_text, summary, status, approval_id, received_at')
    .order('received_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as InboundEmail[]) ?? [];
}

export async function setEmailStatus(id: string, status: InboundEmail['status']) {
  const { error } = await supabase.from('inbound_emails').update({ status }).eq('id', id);
  if (error) throw error;
}
