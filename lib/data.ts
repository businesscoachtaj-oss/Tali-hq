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
  content: { headline?: string; lines?: string[] };
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

export type Approval = { id: string; kind: string; title: string; status: string; created_at: string };

export async function pendingApprovals(): Promise<Approval[]> {
  const { data, error } = await supabase
    .from('approvals')
    .select('id, kind, title, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data as Approval[]) ?? [];
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
  | { ok: true; reply: string; messageId?: string; remembered: number; remaining: number | null }
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
