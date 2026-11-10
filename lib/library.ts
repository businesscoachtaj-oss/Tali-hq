// Tali's library (10 Nov 2026, asked for by Taj). A shelf of real books that are out of copyright,
// which she works through a few pages a night. What she keeps goes into the shared brain as
// knowledge. The shelf is the same for everyone: it is her library, not one person's.
import { supabase } from '@/lib/supabase';
import type { RegionId } from '@/lib/brain';

export type LibraryBook = {
  id: string;
  title: string;
  author: string;
  people: string | null; // translator or editor
  region: RegionId;
  subject: string;
  source_url: string;
  licence_note: string;
  state: 'waiting' | 'next' | 'reading' | 'finished';
  passages: number;
  studied: number;
  lessons: number;
  last_read_at: string | null;
};

export async function myLibrary(): Promise<LibraryBook[]> {
  const { data, error } = await supabase.rpc('my_library');
  if (error || !Array.isArray(data)) return [];
  return (data as any[]).map((b) => ({
    id: String(b.id),
    title: String(b.title ?? ''),
    author: String(b.author ?? ''),
    people: b.people ?? null,
    region: b.region as RegionId,
    subject: String(b.subject ?? ''),
    source_url: String(b.source_url ?? ''),
    licence_note: String(b.licence_note ?? ''),
    state: b.state === 'reading' || b.state === 'finished' || b.state === 'next' ? b.state : 'waiting',
    passages: Number(b.passages ?? 0),
    studied: Number(b.studied ?? 0),
    lessons: Number(b.lessons ?? 0),
    last_read_at: b.last_read_at ?? null,
  }));
}
