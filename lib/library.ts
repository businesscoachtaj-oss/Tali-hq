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

// How a block of book text should be set on the page (11 Nov 2026, asked for by Taj: "books have
// different fonts for different parts like normal books do"). The books are stored exactly as
// published, with headings, verse and footnotes as plain lines. The words are kept as written.
// The website reader (totality-website js/library.js) uses the same rules.
export type BookBlock =
  | { kind: 'number' | 'heading' | 'sign' | 'caption' | 'footnote'; text: string }
  | { kind: 'contents' | 'verse'; lines: string[] }
  | { kind: 'p'; text: string; lead: boolean };

export function bookBlocks(text: string): BookBlock[] {
  const out: BookBlock[] = [];
  let lead = false;
  for (const raw of text.replace(/\r/g, '').split(/\n\s*\n+/)) {
    const lines = raw.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim());
    if (!lines.length) continue;
    const flat = lines.map((l) => l.trim()).join(' ').replace(/\s{2,}/g, ' ');
    if (/^(produced by|e-text prepared by|transcribed by)\b/i.test(flat)) continue;
    const letters = flat.replace(/[^A-Za-z\u00C0-\u024F]/g, '');
    const upper = letters.replace(/[^A-Z\u00C0-\u00DE]/g, '').length;
    const caps = letters.length > 0 && upper / letters.length >= 0.8;
    const clean = (t: string) => t.replace(/_([^_]+)_/g, '$1');
    if (/^\[illustration/i.test(flat)) {
      const cap = flat.replace(/^\[illustration:?\s*/i, '').replace(/\]$/, '');
      if (cap) out.push({ kind: 'caption', text: clean(cap) });
    } else if (/^\[(\d+|footnote)/i.test(flat)) {
      out.push({ kind: 'footnote', text: clean(flat) });
    } else if (lines.every((l) => /\s{3,}\d+$/.test(l))) {
      out.push({ kind: 'contents', lines: lines.map((l) => clean(l.replace(/\s{3,}\d+$/, '').trim())) });
    } else if (caps && flat.length <= 90) {
      const first = lines[0].trim();
      if (flat.length <= 14 && /\.$/.test(flat) && /\.\s*[A-Z]/.test(flat) && !/^(CHAPTER|LECTURE|BOOK|PART)\b/.test(flat)) out.push({ kind: 'sign', text: flat });
      else if (/^[IVXLC]+\.?$/.test(flat)) { out.push({ kind: 'number', text: flat.replace(/\.$/, '') }); lead = true; }
      else if (/^(CHAPTER|LECTURE|BOOK|PART|SECTION)\s+[IVXLC\d]+\.?$/.test(first)) {
        out.push({ kind: 'number', text: first.replace(/\.$/, '') });
        const rest = lines.slice(1).map((l) => l.trim()).join(' ');
        if (rest) out.push({ kind: 'heading', text: clean(rest) });
        lead = true;
      } else { out.push({ kind: 'heading', text: clean(flat) }); lead = true; }
    } else if (lines.length >= 2 && lines.every((l) => l.trim().length < 56)) {
      out.push({ kind: 'verse', lines: lines.map((l) => clean(l.trim())) });
    } else {
      out.push({ kind: 'p', text: clean(flat), lead });
      lead = false;
    }
  }
  return out;
}
