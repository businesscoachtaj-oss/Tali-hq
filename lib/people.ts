// People memory (3 Nov 2026): one client, what Tali knows about them, and the pre meeting match.
import { supabase } from './supabase';
import { type CalendarToday, type Client, type Memory } from './data';

const CLIENT_COLS = 'id, name, kind, status, email, phone, notes, next_follow_up, last_contact_at, source, updated_at';

export async function client(id: string): Promise<Client | null> {
  const { data, error } = await supabase.from('clients').select(CLIENT_COLS).eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Client | null) ?? null;
}

// Memories about a person: brain.memories.about matched on the name (case insensitive), with a
// fallback text match. Uses my_memories_about() from migration 20261103000035; if that RPC is not
// there yet, filters my_memories() the same way on the device.
export async function memoriesAbout(name: string): Promise<Memory[]> {
  const q = name.trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase.rpc('my_memories_about', { p_name: q });
  if (!error) return (data as Memory[]) ?? [];
  const { data: all, error: e2 } = await supabase.rpc('my_memories', { p_limit: 500 });
  if (e2) throw e2;
  return filterMemories((all as Memory[]) ?? [], q);
}

export function filterMemories(all: Memory[], name: string): Memory[] {
  const q = name.trim().toLowerCase();
  const first = q.split(/\s+/)[0];
  return all.filter((m) => {
    const about = (m.about ?? []).map((a) => a.toLowerCase());
    if (about.some((a) => a.includes(q) || (first.length >= 3 && a === first))) return true;
    return m.content.toLowerCase().includes(q);
  });
}

export async function saveContact(id: string, patch: { last_contact_at?: string | null; next_follow_up?: string | null }) {
  const { error } = await supabase.from('clients').update(patch).eq('id', id);
  if (error) throw error;
}

// ---------- Pre meeting nudge ----------
export type MeetingMatch = { client: Client; title: string; when: string; time: string };

function normalise(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9@. ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// "9:00am" or "9am" from a calendar "when" string such as "9:00am to 10:00am" or "Tue 9:00am".
export function timeOf(when: string) {
  const m = when.match(/\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i);
  return m ? m[0].replace(/\s/g, '').toLowerCase() : when;
}

// Matches today's events to clients: an attendee email equal to the client's, or the client's
// full name (or a first name of 4+ letters that is unique in the list) in the title or attendees.
export function matchMeetings(cal: CalendarToday | null, people: Client[]): MeetingMatch[] {
  if (!cal?.connected || !cal.events?.length || !people.length) return [];
  const out: MeetingMatch[] = [];
  const firstCounts = new Map<string, number>();
  for (const c of people) {
    const f = normalise(c.name).split(' ')[0];
    firstCounts.set(f, (firstCounts.get(f) ?? 0) + 1);
  }
  for (const ev of cal.events) {
    const title = normalise(ev.title ?? '');
    const attendees = (ev.attendees ?? []).map((a) => normalise(a));
    const hay = [title, ...attendees].join(' | ');
    for (const c of people) {
      if (out.some((o) => o.client.id === c.id)) continue;
      const email = c.email ? normalise(c.email) : '';
      const full = normalise(c.name);
      const first = full.split(' ')[0];
      const byEmail = !!email && attendees.some((a) => a === email || a.includes(email));
      const byFull = full.length >= 3 && hay.includes(full);
      const byFirst = first.length >= 4 && firstCounts.get(first) === 1 && new RegExp(`(^|[^a-z])${first}([^a-z]|$)`).test(title);
      if (byEmail || byFull || byFirst) {
        out.push({ client: c, title: ev.title, when: ev.when, time: timeOf(ev.when) });
        break;
      }
    }
  }
  return out;
}
