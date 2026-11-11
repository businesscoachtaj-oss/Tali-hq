// Tali's library (11 Nov 2026, Taj's idea). Every book she has read or is reading, standing on a
// timber bookcase. The ones she has finished are open to read, a passage a page, with what she
// kept from each passage under it. Books she is still reading show her notes so far and open the
// night she finishes them. The books are the same for everyone. What is yours: the shelf you
// choose, the page you are on and the READ stamp you earn by finishing a book (saved to your account).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { BackLink, Button, Card, ErrorText, Field, Loading, Screen, TaliSays, Title, goBack } from '@/components/ui';
import { colours, space } from '@/constants/theme';
import { REGIONS } from '@/lib/brain';
import { libraryBook, libraryRead, libraryShelf, bookBlocks, joinMine, loadMineAccount, loadMineLocal, saveMine, NO_MINE, type LibraryMine, type BookBlock, type LibraryBook, type LibraryBookDetail, type LibraryPassage } from '@/lib/library';

type Book = LibraryBook;
const serif = 'InstrumentSerif_400Regular';
const hue = (b: { region: string }) => (REGIONS as any)[b.region]?.colour ?? colours.purple;
const isDone = (b: { passages: number; studied: number }) => b.passages > 0 && b.studied >= b.passages;

type Mine = LibraryMine;
type Status = 'read' | 'reading' | 'open' | 'tali';
function statusOf(b: Book, m: Mine): Status {
  if (m.done[b.id]) return 'read';
  if (isDone(b) && (m.place[b.id] ?? 0) > 1) return 'reading';
  return isDone(b) ? 'open' : 'tali';
}

// Spines are not all the same size on a real shelf. Each book keeps its own width and height.
function size(id: string, wide: boolean) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973;
  return { w: (wide ? 56 : 43) + (h % 7), h: 154 + (h % 19) };
}

// The bookcase: timber shelves, books standing on them with the title down the spine, a brass
// plaque over each shelf. A ribbon bookmark shows how far she is through a book she is still reading.
const WOOD = { back: '#24150E', plank: '#7A4A2A', plankTop: '#A06A40', post: '#5B3620', brass: '#D4AE5C', brassInk: '#3B2A0A' };

function Plaque({ children }: { children: string }) {
  return (
    <View style={{ alignSelf: 'center', backgroundColor: WOOD.brass, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 10, borderWidth: 1, borderColor: '#F1D58F', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }}>
      <Text style={{ color: WOOD.brassInk, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 }}>{children}</Text>
    </View>
  );
}

function Standing({ b, w, h, onPress }: { b: Book; w: number; h: number; onPress?: () => void }) {
  const done = isDone(b);
  const pct = Math.round((b.studied / Math.max(1, b.passages)) * 100);
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={`${b.title} by ${b.author}. ${done ? 'Finished. Open.' : `${pct}% read.`}`} style={{ alignItems: 'center' }}>
      <View style={{ width: w, height: h, backgroundColor: hue(b), borderTopLeftRadius: 5, borderTopRightRadius: 5, borderRadius: 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 5, shadowOffset: { width: 2, height: 0 } }}>
        {/* shading down the left edge and bands top and bottom, like a cloth bound spine */}
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: 'rgba(255,255,255,0.28)' }} />
        <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, backgroundColor: 'rgba(0,0,0,0.16)' }} />
        <View style={{ position: 'absolute', left: 0, right: 0, top: 12, height: 3, backgroundColor: 'rgba(40,24,60,0.45)' }} />
        <View style={{ position: 'absolute', left: 0, right: 0, top: 18, height: 1, backgroundColor: 'rgba(40,24,60,0.45)' }} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 12, height: 3, backgroundColor: 'rgba(40,24,60,0.45)' }} />
        <View style={{ width: h - 52, height: w - 8, transform: [{ rotate: '-90deg' }], alignItems: 'center', justifyContent: 'center' }}>
          <Text numberOfLines={2} style={{ color: '#1C1433', fontSize: w > 50 ? 15 : 12, lineHeight: w > 50 ? 17 : 14, fontFamily: serif, textAlign: 'center' }}>{b.title}</Text>
        </View>
        {!done && b.studied > 0 ? <View style={{ position: 'absolute', top: 0, right: 9, width: 8, height: 16 + Math.round(pct * 0.34), backgroundColor: '#C8372D', borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }} /> : null}
      </View>
    </Pressable>
  );
}

function ShelfRow({ books, mine, open, extra }: { books: Book[]; mine: Mine; open: (b: Book) => void; extra?: React.ReactNode }) {
  const label = (b: Book) => {
    const st = statusOf(b, mine);
    if (st === 'read') return 'READ';
    if (st === 'reading') return `P. ${mine.place[b.id]}`;
    if (st === 'open') return 'OPEN';
    return `${Math.round((b.studied / Math.max(1, b.passages)) * 100)}%`;
  };
  return (
    <View style={{ marginBottom: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5, paddingHorizontal: 12, minHeight: 176 }}>
        {books.map((b) => {
          const s = size(b.id, books.length <= 5);
          return <Standing key={b.id} b={b} w={s.w} h={s.h} onPress={() => open(b)} />;
        })}
        {extra}
      </View>
      <View style={{ height: 5, backgroundColor: WOOD.plankTop, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
      <View style={{ height: 11, backgroundColor: WOOD.plank, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 6 } }} />
      <View style={{ flexDirection: 'row', gap: 5, paddingHorizontal: 12, marginTop: 6 }}>
        {books.map((b) => (
          <Text key={b.id} style={{ width: size(b.id, books.length <= 5).w, textAlign: 'center', color: statusOf(b, mine) === 'read' ? '#FF9C8F' : isDone(b) ? '#F1D58F' : '#C9B8A6', fontSize: 10, fontWeight: '800' }}>
            {label(b)}
          </Text>
        ))}
      </View>
    </View>
  );
}

// A small clothbound book, seen slightly from the right so the page block shows: the cover in
// the book's colour with a pressed frame, the real title set on it, a rounded spine with two
// raised bands, and cream page edges down the fore edge and along the foot.
function Cover({ b, w = 58 }: { b: { title: string; author: string; region: string }; w?: number }) {
  const h = Math.round(w * 1.42);
  const c = hue(b);
  const spine = Math.round(w * 0.13);
  const words = b.title.length;
  const fs = words > 34 ? w * 0.125 : words > 18 ? w * 0.15 : w * 0.185;
  return (
    <View style={{ width: w + 5, height: h + 5 }}>
      {/* the back board: the same cloth, in shadow, joined to the front all the way down the spine */}
      <View style={{ position: 'absolute', left: 0, top: 5, width: w + 5, height: h, backgroundColor: c, borderTopLeftRadius: 5, borderBottomLeftRadius: 5, borderTopRightRadius: 3, borderBottomRightRadius: 4, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(28,20,51,0.42)' }} />
      </View>
      {/* the page block between the boards, showing down the fore edge and along the foot */}
      <View style={{ position: 'absolute', left: spine, top: 3, width: w - spine + 3, height: h, backgroundColor: '#F6F0E2', borderTopRightRadius: 2, borderBottomRightRadius: 3, overflow: 'hidden' }}>
        {[0, 1].map((i) => (
          <View key={i} style={{ position: 'absolute', left: 0, right: 0, bottom: 1 + i * 1.5, height: 0.5, backgroundColor: '#C9BCA2' }} />
        ))}
        {[0, 1].map((i) => (
          <View key={i} style={{ position: 'absolute', top: 0, bottom: 0, right: 0.8 + i * 1.2, width: 0.5, backgroundColor: '#C9BCA2' }} />
        ))}
      </View>
      {/* the front board */}
      <View style={{ width: w, height: h, backgroundColor: c, borderTopLeftRadius: 5, borderBottomLeftRadius: 5, borderTopRightRadius: 3, borderBottomRightRadius: 3, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 5, shadowOffset: { width: 2, height: 3 } }}>
        {/* rounded spine: dark at the hinge, a soft highlight, two raised bands */}
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: spine, backgroundColor: 'rgba(28,20,51,0.30)' }} />
        <View style={{ position: 'absolute', left: 1.5, top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(255,255,255,0.30)' }} />
        <View style={{ position: 'absolute', left: spine, top: 0, bottom: 0, width: 1.5, backgroundColor: 'rgba(28,20,51,0.28)' }} />
        <View style={{ position: 'absolute', left: spine + 1.5, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.35)' }} />
        <View style={{ position: 'absolute', left: 0, width: spine, top: Math.round(h * 0.14), height: 2, backgroundColor: 'rgba(255,255,255,0.45)' }} />
        <View style={{ position: 'absolute', left: 0, width: spine, bottom: Math.round(h * 0.14), height: 2, backgroundColor: 'rgba(255,255,255,0.45)' }} />
        {/* the pressed frame with the title set inside it */}
        <View style={{ position: 'absolute', left: spine + 5, right: 4, top: 5, bottom: 5, borderWidth: 1, borderColor: 'rgba(28,20,51,0.45)', borderRadius: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 }}>
          <View style={{ position: 'absolute', left: 1.5, right: 1.5, top: 1.5, bottom: 1.5, borderWidth: 0.5, borderColor: 'rgba(28,20,51,0.30)', borderRadius: 1 }} />
          <Text numberOfLines={5} style={{ color: '#1C1433', fontFamily: serif, fontSize: fs, lineHeight: fs * 1.08, textAlign: 'center' }}>{b.title}</Text>
          <View style={{ width: 10, height: 1, backgroundColor: 'rgba(28,20,51,0.55)', marginVertical: 3 }} />
          <Text numberOfLines={1} style={{ color: 'rgba(28,20,51,0.78)', fontSize: Math.min(w * 0.085, (w * 0.86) / Math.max(6, b.author.split(' ').slice(-1)[0].length)), fontWeight: '800', textAlign: 'center' }}>{b.author.split(' ').slice(-1)[0].toUpperCase()}</Text>
        </View>
      </View>
    </View>
  );
}

function Chip({ on, children, onPress }: { on: boolean; children: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: on ? colours.purple : colours.purpleSoft, borderWidth: 1, borderColor: on ? colours.purple : colours.border }}>
      <Text style={{ color: on ? colours.onPurple : colours.text, fontSize: 13, fontWeight: '800' }}>{children}</Text>
    </Pressable>
  );
}

const STATUS_WORDS: Record<Status, string> = { read: 'You have read it', reading: 'You are reading it', open: 'Open to read', tali: 'Tali is still reading' };

function Shelf({ books, mine, open, toggle, resume }: { books: Book[]; mine: Mine; open: (b: Book) => void; toggle: (b: Book) => void; resume: (b: Book) => void }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Status | 'all'>('all');
  const [subject, setSubject] = useState('all');
  const done = books.filter(isDone);
  const kept = books.reduce((n, b) => n + b.lessons, 0);
  // Your shelf: the books you chose. Until you choose, it starts with the ones she has finished.
  const shelfIds = mine.shelf ?? done.map((b) => b.id);
  const onShelf = shelfIds.map((id) => books.find((b) => b.id === id)).filter(Boolean) as Book[];
  const rows: Book[][] = [];
  for (let i = 0; i < onShelf.length; i += 6) rows.push(onShelf.slice(i, i + 6));
  const subjects = useMemo(() => Array.from(new Set(books.map((b) => b.subject))).sort(), [books]);
  const going = books.filter((b) => statusOf(b, mine) === 'reading').sort((a, b) => (mine.place[b.id] ?? 0) - (mine.place[a.id] ?? 0))[0];
  const term = q.trim().toLowerCase();
  const found = books.filter(
    (b) =>
      (status === 'all' || statusOf(b, mine) === status) &&
      (subject === 'all' || b.subject === subject) &&
      (!term || b.title.toLowerCase().includes(term) || b.author.toLowerCase().includes(term) || b.subject.toLowerCase().includes(term)),
  );
  return (
    <>
      <BackLink onPress={() => goBack('/(app)/brain')} label="Her brain" />
      <Title sub="Every book I have read or am reading. Put the ones you like on your shelf.">Tali's library</Title>
      <TaliSays pose="idle">
        {books.length} books in my library. I have finished {done.length} and kept {kept.toLocaleString('en-AU')} things so far. I read a few pages every night.
      </TaliSays>

      {going ? (
        <Pressable onPress={() => resume(going)} accessibilityRole="button" style={{ marginTop: space.lg, backgroundColor: colours.paper, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Cover b={going} w={46} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#8A7B66', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 }}>PICK UP WHERE YOU LEFT OFF</Text>
            <Text numberOfLines={1} style={{ color: colours.ink, fontSize: 19, fontFamily: serif, marginTop: 2 }}>{going.title}</Text>
            <Text style={{ color: '#6B5E4C', fontSize: 13 }}>Page {mine.place[going.id]} of {going.passages}</Text>
          </View>
          <View style={{ backgroundColor: '#6C3483', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Keep reading</Text>
          </View>
        </Pressable>
      ) : null}

      <View style={{ marginTop: space.lg, backgroundColor: WOOD.back, borderRadius: 14, borderWidth: 6, borderColor: WOOD.post, paddingTop: 16, paddingBottom: 4, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }}>
        <Plaque>YOUR SHELF</Plaque>
        {rows.length ? (
          rows.map((r, i) => <ShelfRow key={i} books={r} mine={mine} open={open} />)
        ) : (
          <ShelfRow books={[]} mine={mine} open={open} extra={<Text style={{ color: '#C9B8A6', fontSize: 13, lineHeight: 18, marginBottom: 60, flex: 1, textAlign: 'center' }}>Your shelf is empty. Add any book from the catalogue below.</Text>} />
        )}
      </View>

      <Text style={{ color: colours.text, fontSize: 26, fontFamily: serif, marginTop: space.xl, marginBottom: space.sm }}>The catalogue</Text>
      <Field value={q} onChangeText={setQ} placeholder="Search by title, author or subject" accessibilityLabel="Search the library" autoCorrect={false} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
        <Chip on={status === 'all'} onPress={() => setStatus('all')}>All</Chip>
        <Chip on={status === 'open'} onPress={() => setStatus('open')}>Open to read</Chip>
        <Chip on={status === 'reading'} onPress={() => setStatus('reading')}>You're reading</Chip>
        <Chip on={status === 'read'} onPress={() => setStatus('read')}>You've read</Chip>
        <Chip on={status === 'tali'} onPress={() => setStatus('tali')}>Tali still reading</Chip>
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingBottom: space.md }}>
        <Chip on={subject === 'all'} onPress={() => setSubject('all')}>Every subject</Chip>
        {subjects.map((x) => (
          <Chip key={x} on={subject === x} onPress={() => setSubject(x)}>{x.charAt(0).toUpperCase() + x.slice(1)}</Chip>
        ))}
      </ScrollView>
      <Text style={{ color: colours.faint, fontSize: 12, marginBottom: space.sm }}>{found.length} of {books.length} books</Text>
      {found.map((b) => {
        const st = statusOf(b, mine);
        const on = shelfIds.includes(b.id);
        return (
          <Card key={b.id} style={{ marginBottom: space.sm, padding: 12 }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Pressable onPress={() => open(b)} accessibilityRole="button" accessibilityLabel={`${b.title} by ${b.author}`} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flex: 1 }}>
                <Cover b={b} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colours.text, fontSize: 18, lineHeight: 21, fontFamily: serif }}>{b.title}</Text>
                  <Text style={{ color: colours.muted, fontSize: 13, marginTop: 1 }}>{b.author} · {b.subject}</Text>
                  <Text style={{ color: st === 'read' ? '#FF9C8F' : st === 'tali' ? colours.faint : '#C6F08A', fontSize: 12, fontWeight: '800', marginTop: 3 }}>
                    {st === 'reading' ? `You are on page ${mine.place[b.id]} of ${b.passages}` : st === 'tali' ? `Tali is ${Math.round((b.studied / Math.max(1, b.passages)) * 100)}% through` : STATUS_WORDS[st]}
                  </Text>
                </View>
              </Pressable>
              <Pressable onPress={() => toggle(b)} accessibilityRole="button" accessibilityLabel={on ? `Take ${b.title} off your shelf` : `Put ${b.title} on your shelf`} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: on ? '#C6F08A' : colours.border, backgroundColor: on ? 'rgba(198,240,138,0.14)' : 'transparent' }}>
                <Text style={{ color: on ? '#C6F08A' : colours.purpleInk, fontSize: 12, fontWeight: '800' }}>{on ? 'On shelf' : '+ Shelf'}</Text>
              </Pressable>
            </View>
          </Card>
        );
      })}
      {!found.length ? <Text style={{ color: colours.muted, fontSize: 14, marginTop: space.sm }}>No books match that. Try another word or clear the filters.</Text> : null}
      <Text style={{ color: colours.faint, fontSize: 12, lineHeight: 17, marginTop: space.md }}>
        A book opens for you the night I finish it. Every book here is out of copyright and free to read. I leave old health and medical books off the shelf, because a lot of that advice has since been proven wrong.
      </Text>
    </>
  );
}

function BookPage({ b, mine, back, read, toggle }: { b: LibraryBookDetail; mine: Mine; back: () => void; read: () => void; toggle: () => void }) {
  const [all, setAll] = useState(false);
  const done = b.finished;
  const pct = Math.round((b.studied / Math.max(1, b.passages)) * 100);
  const shown = all ? b.notes : b.notes.slice(0, 4);
  const st = statusOf(b, mine);
  const on = (mine.shelf ?? (done ? [b.id] : [])).includes(b.id);
  const day = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <>
      <BackLink onPress={back} label="Library" />
      {/* An old library card: cream stock, ruled lines, a date stamp */}
      <View style={{ backgroundColor: colours.paper, borderRadius: 10, padding: 18, marginBottom: space.lg, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }}>
        <Text style={{ color: '#8A7B66', fontSize: 10, fontWeight: '900', letterSpacing: 1.6 }}>TALI'S LIBRARY · {b.subject.toUpperCase()}</Text>
        <Text style={{ color: colours.ink, fontSize: 30, lineHeight: 33, fontFamily: serif, marginTop: 8 }}>{b.title}</Text>
        <View style={{ borderBottomWidth: 1, borderBottomColor: '#CDBFA6', marginTop: 10, paddingBottom: 6 }}>
          <Text style={{ color: colours.ink, fontSize: 15 }}>{b.author}</Text>
          {b.people ? <Text style={{ color: '#6B5E4C', fontSize: 12, marginTop: 2 }}>{b.people}</Text> : null}
        </View>
        <View style={{ borderBottomWidth: 1, borderBottomColor: '#CDBFA6', marginTop: 8, paddingBottom: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: '#6B5E4C', fontSize: 13 }}>{b.passages} passages</Text>
          <Text style={{ color: '#6B5E4C', fontSize: 13 }}>{b.lessons} {b.lessons === 1 ? 'thing' : 'things'} kept</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, minHeight: 34 }}>
          <Text style={{ color: '#8A7B66', fontSize: 12, flex: 1 }}>
            {done ? `Tali finished it${b.last_read_at ? ' on ' + day(b.last_read_at) : ''}` : `Tali is ${pct}% through`}
          </Text>
          {st === 'read' ? (
            <View style={{ borderWidth: 2, borderColor: '#B23A30', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, transform: [{ rotate: '-6deg' }] }}>
              <Text style={{ color: '#B23A30', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 }}>READ · {day(mine.done[b.id]).toUpperCase()}</Text>
            </View>
          ) : st === 'reading' ? (
            <View style={{ borderWidth: 2, borderColor: '#6C3483', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, transform: [{ rotate: '-4deg' }] }}>
              <Text style={{ color: '#6C3483', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 }}>YOU ARE ON PAGE {mine.place[b.id]}</Text>
            </View>
          ) : null}
        </View>
      </View>
      {done ? (
        <Button title={st === 'reading' ? `Keep reading from page ${mine.place[b.id]}` : st === 'read' ? 'Read it again' : 'Read the book'} onPress={read} />
      ) : (
        <Card>
          <Text style={{ color: colours.text, fontSize: 15, lineHeight: 22 }}>I am {pct}% of the way through this one. It opens for you the night I finish it. Until then, here is what I have kept so far.</Text>
        </Card>
      )}
      <View style={{ marginTop: space.sm }}>
        <Button title={on ? 'On your shelf. Take it off' : 'Put it on my shelf'} kind="ghost" onPress={toggle} />
      </View>
      <Text style={{ color: colours.text, fontSize: 22, fontFamily: serif, marginTop: space.xl, marginBottom: 4 }}>{done ? 'What I kept' : 'What I have kept so far'}</Text>
      <Text style={{ color: colours.muted, fontSize: 14, lineHeight: 20, marginBottom: space.md }}>
        {b.notes.length
          ? `${b.notes.length} ${b.notes.length === 1 ? 'thing' : 'things'} from this book went into my brain.`
          : 'Nothing from this book yet.'}
      </Text>
      {shown.map((n, i) => (
        <Card key={i} style={{ marginBottom: space.sm, borderLeftWidth: 3, borderLeftColor: hue(b) }}>
          <Text style={{ color: colours.text, fontSize: 15, lineHeight: 22 }}>{n.text}</Text>
        </Card>
      ))}
      {b.notes.length > 4 ? (
        <Pressable accessibilityRole="button" onPress={() => setAll(!all)} style={{ paddingVertical: space.md }}>
          <Text style={{ color: colours.purple, fontWeight: '800', fontSize: 14 }}>{all ? 'Show less' : `See all ${b.notes.length}`}</Text>
        </Pressable>
      ) : null}
    </>
  );
}

function Reader({ b, start, back, turned }: { b: LibraryBookDetail; start: number; back: () => void; turned: (n: number) => void }) {
  const [n, setN] = useState<number | null>(null);
  const [pages, setPages] = useState<Record<number, LibraryPassage>>({});
  const [error, setError] = useState('');

  // Pick up where you left off in this book.
  useEffect(() => {
    setN(Math.min(Math.max(1, start || 1), b.passages));
  }, [b.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (n == null || pages[n]) return;
    let live = true;
    setError('');
    libraryRead(b.id, n, 8)
      .then((list) => {
        if (!live) return;
        if (!list.length) return setError('I could not open that page. Try again in a moment.');
        setPages((p) => ({ ...p, ...Object.fromEntries(list.map((x) => [x.n, x])) }));
      })
      .catch(() => live && setError('I could not open that page. Try again in a moment.'));
    return () => {
      live = false;
    };
  }, [b.id, n, pages]);

  const go = (to: number) => {
    const next = Math.min(Math.max(1, to), b.passages);
    setN(next);
    turned(next);
  };
  const page = n != null ? pages[n] : undefined;
  return (
    <>
      <BackLink onPress={back} label={b.title} />
      <View style={{ backgroundColor: colours.paper, borderRadius: 18, padding: 22, minHeight: 320, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }}>
        <Text style={{ color: '#7A6F8F', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 12 }}>PAGE {n ?? 1} OF {b.passages}</Text>
        {page ? (
          <>
            {bookBlocks(page.text).map((blk, i) => <Block key={i} b={blk} />)}
            {page.kept.map((k, i) => (
              <View key={i} style={{ backgroundColor: '#EFEAFB', borderRadius: 12, padding: 12, borderLeftWidth: 4, borderLeftColor: '#6C3483', marginTop: 8 }}>
                <Text style={{ color: '#6C3483', fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: 4 }}>TALI'S NOTE</Text>
                <Text style={{ color: colours.ink, fontSize: 14, lineHeight: 20 }}>{k}</Text>
              </View>
            ))}
          </>
        ) : error ? (
          <Text style={{ color: '#B23A30', fontSize: 15 }}>{error}</Text>
        ) : (
          <Text style={{ color: '#7A6F8F', fontSize: 15 }}>Turning the page...</Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.lg }}>
        <View style={{ flex: 1 }}><Button title="Back a page" kind="ghost" disabled={(n ?? 1) <= 1} onPress={() => go((n ?? 1) - 1)} /></View>
        <View style={{ flex: 1 }}><Button title={(n ?? 1) >= b.passages ? 'The end' : 'Next page'} disabled={(n ?? 1) >= b.passages} onPress={() => go((n ?? 1) + 1)} /></View>
      </View>
    </>
  );
}

// One block of the book, set the way a printed book would set it: chapter numbers and headings
// in the heading font, the book's own words in the serif, verse in italics, footnotes small.
function Block({ b }: { b: BookBlock }) {
  const body = { color: colours.ink, fontSize: 20, lineHeight: 29, fontFamily: serif } as const;
  if (b.kind === 'number')
    return (
      <View style={{ alignItems: 'center', marginTop: 18, marginBottom: 6 }}>
        <Text style={{ color: '#B23A30', fontSize: 14, fontWeight: '800', letterSpacing: 3 }}>{b.text}</Text>
        <View style={{ width: 40, height: 2, backgroundColor: '#CDBFA6', marginTop: 10 }} />
      </View>
    );
  if (b.kind === 'heading')
    return <Text accessibilityRole="header" style={{ color: '#1C1433', fontSize: 21, lineHeight: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', textAlign: 'center', marginTop: 10, marginBottom: 16 }}>{b.text}</Text>;
  if (b.kind === 'sign') return <Text style={{ ...body, textAlign: 'right', letterSpacing: 1.5, fontSize: 17, marginBottom: 14 }}>{b.text}</Text>;
  if (b.kind === 'caption') return <Text style={{ color: '#7A6F8F', fontSize: 15, lineHeight: 21, fontStyle: 'italic', textAlign: 'center', marginBottom: 14 }}>{b.text}</Text>;
  if (b.kind === 'footnote')
    return <Text style={{ color: '#7A6F8F', fontSize: 13, lineHeight: 19, marginBottom: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#CDBFA6' }}>{b.text}</Text>;
  if (b.kind === 'contents')
    return (
      <View style={{ marginBottom: 6 }}>
        {b.lines.map((l, i) => (
          <Text key={i} style={{ color: colours.ink, fontSize: 15, lineHeight: 21, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#DDD2BC' }}>{l}</Text>
        ))}
      </View>
    );
  if (b.kind === 'verse')
    return (
      <View style={{ marginLeft: 18, paddingLeft: 14, borderLeftWidth: 2, borderLeftColor: '#CDBFA6', marginBottom: 16, marginTop: 2 }}>
        {b.lines.map((l, i) => (
          <Text key={i} style={{ ...body, fontSize: 19, lineHeight: 27, fontStyle: 'italic' }}>{l}</Text>
        ))}
      </View>
    );
  if (b.kind !== 'p') return null;
  if (b.lead && b.text.length > 1)
    return (
      <Text style={{ ...body, marginBottom: 14 }}>
        <Text style={{ color: '#B23A30', fontSize: 30 }}>{b.text.slice(0, 1)}</Text>
        {b.text.slice(1)}
      </Text>
    );
  return <Text style={{ ...body, marginBottom: 14 }}>{b.text}</Text>;
}

export default function LibraryScreen() {
  const params = useLocalSearchParams<{ book?: string }>();
  const [books, setBooks] = useState<Book[] | null>(null);
  const [book, setBook] = useState<LibraryBookDetail | null>(null);
  const [mine, setMine] = useState<Mine>(NO_MINE);
  const [opening, setOpening] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const local = await loadMineLocal();
    setMine(local);
    try {
      setBooks(await libraryShelf());
    } catch {
      setBooks([]);
    }
    // Your shelf and page numbers follow your account. Join the two copies and keep both in step.
    const account = await loadMineAccount();
    const joined = joinMine(account, local);
    setMine(joined);
    if (JSON.stringify(joined) !== JSON.stringify(account ?? NO_MINE)) saveMine(joined);
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  const change = useCallback((fn: (m: Mine) => Mine) => {
    setMine((m) => {
      const next = fn(m);
      saveMine(next);
      return next;
    });
  }, []);
  // Put a book on your shelf or take it off. The first change starts from what the shelf shows now.
  const toggle = useCallback(
    (id: string) =>
      change((m) => {
        const now = m.shelf ?? (books ?? []).filter(isDone).map((b) => b.id);
        return { ...m, shelf: now.includes(id) ? now.filter((x) => x !== id) : [...now, id] };
      }),
    [change, books],
  );
  // Turning a page saves your place. Reaching the last page is what earns the READ stamp.
  const turned = useCallback(
    (id: string, n: number, last: number) =>
      change((m) => ({ ...m, place: { ...m.place, [id]: n }, done: n >= last && !m.done[id] ? { ...m.done, [id]: new Date().toISOString() } : m.done })),
    [change],
  );

  const open = useCallback(async (id: string, straightIn = false) => {
    setError('');
    setOpening(true);
    try {
      const d = await libraryBook(id);
      if (!d) setError('I could not take that one off the shelf. Try again in a moment.');
      else {
        setReading(straightIn && d.finished);
        setBook(d);
      }
    } catch {
      setError('I could not take that one off the shelf. Try again in a moment.');
    } finally {
      setOpening(false);
    }
  }, []);

  // Her brain links straight to a book: /library?book=pg2680
  useEffect(() => {
    if (typeof params.book === 'string' && params.book) open(params.book);
  }, [params.book, open]);

  return (
    <Screen onRefresh={book ? undefined : load}>
      {book ? (
        reading ? (
          <Reader b={book} start={mine.place[book.id] ?? 1} back={() => setReading(false)} turned={(n) => turned(book.id, n, book.passages)} />
        ) : (
          <BookPage b={book} mine={mine} back={() => setBook(null)} read={() => setReading(true)} toggle={() => toggle(book.id)} />
        )
      ) : books == null ? (
        <Loading />
      ) : (
        <>
          <Shelf books={books} mine={mine} open={(b) => open(b.id)} toggle={(b) => toggle(b.id)} resume={(b) => open(b.id, true)} />
          {opening ? <Text style={{ color: colours.muted, marginTop: space.md }}>Taking it off the shelf...</Text> : null}
          {error ? <ErrorText>{error}</ErrorText> : null}
        </>
      )}
    </Screen>
  );
}
