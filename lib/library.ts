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

// ---------------------------------------------------------------------------
// Tali's library, open to read (11 Nov 2026, Taj's idea). The whole shelf, one book with
// everything she kept from it, and the passages of a book she has finished.
// ---------------------------------------------------------------------------
export type LibraryNote = { n: number; text: string };
export type LibraryBookDetail = LibraryBook & { finished: boolean; notes: LibraryNote[] };
export type LibraryPassage = { n: number; text: string; kept: string[] };

function toBook(b: any): LibraryBook {
  return {
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
  };
}

// Finished books first, then the ones she is furthest through.
export async function libraryShelf(): Promise<LibraryBook[]> {
  const { data, error } = await supabase.rpc('library_shelf');
  if (error || !Array.isArray(data)) return [];
  return (data as any[]).map(toBook);
}

export async function libraryBook(id: string): Promise<LibraryBookDetail | null> {
  const { data, error } = await supabase.rpc('library_book', { p_book: id });
  if (error || !data) return null;
  const b: any = data;
  const finished = b.finished === true;
  return {
    ...toBook({ ...b, state: finished ? 'finished' : 'reading' }),
    finished,
    notes: Array.isArray(b.notes) ? b.notes.map((n: any) => ({ n: Number(n?.n ?? 0), text: String(n?.text ?? '') })).filter((n: LibraryNote) => n.text) : [],
  };
}

// Passages of a finished book, from passage `from`. Empty when the book is not finished yet.
export async function libraryRead(id: string, from: number, count = 8): Promise<LibraryPassage[]> {
  const { data, error } = await supabase.rpc('library_read', { p_book: id, p_from: from, p_count: count });
  if (error || !Array.isArray(data)) return [];
  return (data as any[]).map((p) => ({ n: Number(p?.n ?? 0), text: String(p?.text ?? ''), kept: Array.isArray(p?.kept) ? p.kept.map(String) : [] }));
}

// The books are stored exactly as published, with a line break every 70 characters or so. For
// reading, each block of lines becomes one paragraph. The transcriber's credit line is left out.
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim())
    .filter((p) => p && !/^(produced by|e-text prepared by|transcribed by)\b/i.test(p));
}
