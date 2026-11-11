// Tali's library (10 Nov 2026, asked for by Taj). A shelf of real books that are out of copyright,
// which she works through a few pages a night. What she keeps goes into the shared brain as
// knowledge. The shelf is the same for everyone: it is her library, not one person's.
import AsyncStorage from '@react-native-async-storage/async-storage';
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

// What is yours in her library (11 Nov 2026, asked for by Taj): the books you put on your shelf,
// the page you are up to in each one, and the day you finished it. The READ stamp is yours, not
// hers. Saved to your account (public.library_mine, your own row only) so it follows you between
// phone and web app, with a copy on the device so the shelf shows straight away and offline.
export type LibraryMine = { shelf: string[] | null; place: Record<string, number>; done: Record<string, string> };
export const NO_MINE: LibraryMine = { shelf: null, place: {}, done: {} };
const MINE_KEY = 'tali.library.mine';
const tidy = (m: any): LibraryMine => ({
  shelf: Array.isArray(m?.shelf) ? m.shelf.map(String) : null,
  place: m?.place && typeof m.place === 'object' ? m.place : {},
  done: m?.done && typeof m.done === 'object' ? m.done : {},
});

export async function loadMineLocal(): Promise<LibraryMine> {
  try {
    const raw = await AsyncStorage.getItem(MINE_KEY);
    return raw ? tidy(JSON.parse(raw)) : NO_MINE;
  } catch {
    return NO_MINE;
  }
}

// The account copy. Null when there is none yet or it could not be reached.
export async function loadMineAccount(): Promise<LibraryMine | null> {
  try {
    const { data, error } = await supabase.from('library_mine').select('shelf, place, done').maybeSingle();
    if (error || !data) return null;
    return tidy(data);
  } catch {
    return null;
  }
}

// Two copies of the same person's library, joined: the furthest page and the earliest finish day
// win for each book, and the account's shelf wins if it has one.
export function joinMine(account: LibraryMine | null, local: LibraryMine): LibraryMine {
  if (!account) return local;
  const place: Record<string, number> = { ...local.place };
  for (const [k, v] of Object.entries(account.place)) place[k] = Math.max(Number(v) || 0, Number(place[k]) || 0);
  const done: Record<string, string> = { ...local.done };
  for (const [k, v] of Object.entries(account.done)) done[k] = done[k] && done[k] < v ? done[k] : v;
  return { shelf: account.shelf ?? local.shelf, place, done };
}

export async function saveMine(m: LibraryMine): Promise<void> {
  AsyncStorage.setItem(MINE_KEY, JSON.stringify(m)).catch(() => {});
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return;
    await supabase.from('library_mine').upsert({ user_id: u.user.id, shelf: m.shelf, place: m.place, done: m.done, updated_at: new Date().toISOString() });
  } catch {
    // The device copy still has it. It goes up with the next change.
  }
}
