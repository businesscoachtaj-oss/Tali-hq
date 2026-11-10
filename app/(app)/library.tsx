// Tali's library (11 Nov 2026, Taj's idea). Every book she has read or is reading, standing on a
// timber bookcase. The ones she has finished are open to read, a passage a page, with what she
// kept from each passage under it. Books she is still reading show her notes so far and open the
// night she finishes them. The shelf is the same for everyone: it is her library.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BackLink, Button, Card, ErrorText, Loading, Screen, TaliSays, Title, goBack } from '@/components/ui';
import { colours, space } from '@/constants/theme';
import { REGIONS } from '@/lib/brain';
import { libraryBook, libraryRead, libraryShelf, paragraphs, type LibraryBook, type LibraryBookDetail, type LibraryPassage } from '@/lib/library';

type Book = LibraryBook;
const serif = 'InstrumentSerif_400Regular';
const hue = (b: { region: string }) => (REGIONS as any)[b.region]?.colour ?? colours.purple;
const isDone = (b: { passages: number; studied: number }) => b.passages > 0 && b.studied >= b.passages;
// The date on the library card stamp: "READ · 10 NOV 2026".
function stamp(iso: string | null) {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d.getTime())) return '';
  return ' · ' + d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
}
const PLACE = 'tali.library.place.'; // where you got to in each book, on this device

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

function ShelfRow({ books, wide, open, extra }: { books: Book[]; wide?: boolean; open: (b: Book) => void; extra?: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5, paddingHorizontal: 12, minHeight: 176 }}>
        {books.map((b) => {
          const s = size(b.id, !!wide);
          return <Standing key={b.id} b={b} w={s.w} h={s.h} onPress={() => open(b)} />;
        })}
        {extra}
      </View>
      <View style={{ height: 5, backgroundColor: WOOD.plankTop, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
      <View style={{ height: 11, backgroundColor: WOOD.plank, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 6 } }} />
      <View style={{ flexDirection: 'row', gap: 5, paddingHorizontal: 12, marginTop: 6 }}>
        {books.map((b) => (
          <Text key={b.id} style={{ width: size(b.id, !!wide).w, textAlign: 'center', color: isDone(b) ? '#F1D58F' : '#C9B8A6', fontSize: 10, fontWeight: '800' }}>
            {isDone(b) ? 'OPEN' : b.studied > 0 ? `${Math.round((b.studied / Math.max(1, b.passages)) * 100)}%` : 'NEXT'}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Shelf({ books, open }: { books: Book[]; open: (b: Book) => void }) {
  const done = books.filter(isDone);
  const reading = books.filter((b) => !isDone(b));
  const kept = books.reduce((n, b) => n + b.lessons, 0);
  const rows: Book[][] = [];
  for (let i = 0; i < reading.length; i += 6) rows.push(reading.slice(i, i + 6));
  return (
    <>
      <BackLink onPress={() => goBack('/(app)/brain')} label="Her brain" />
      <Title sub="Every book I have read or am reading. Tap a finished one to take it off the shelf.">Tali's library</Title>
      <TaliSays pose="idle">
        {books.length} books on my shelf. I have finished {done.length} and kept {kept.toLocaleString('en-AU')} things so far. I read a few pages every night.
      </TaliSays>

      <View style={{ marginTop: space.lg, backgroundColor: WOOD.back, borderRadius: 14, borderWidth: 6, borderColor: WOOD.post, paddingTop: 16, paddingBottom: 4, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }}>
        <Plaque>FINISHED · OPEN TO READ</Plaque>
        <ShelfRow
          books={done.slice(0, 5)}
          wide
          open={open}
          extra={
            done.length < 4 ? (
              <View style={{ flex: 1, alignItems: 'flex-end', paddingRight: 6 }}>
                <Text style={{ color: '#C9B8A6', fontSize: 12, lineHeight: 16, textAlign: 'right', marginBottom: 10, maxWidth: 150 }}>
                  {done.length ? 'Room on this shelf for the next one I finish.' : 'Nothing finished yet. The first one lands here.'}
                </Text>
              </View>
            ) : null
          }
        />
        {done.length > 5 ? <ShelfRow books={done.slice(5, 10)} wide open={open} /> : null}
        {rows.length ? <Plaque>STILL READING</Plaque> : null}
        {rows.map((r, i) => (
          <ShelfRow key={i} books={r} open={open} />
        ))}
      </View>
      <Text style={{ color: colours.faint, fontSize: 12, lineHeight: 17, marginTop: space.md }}>
        The red ribbon is my bookmark. A book opens for you the night I finish it. Every book here is out of copyright and free to read. I leave old health and medical books off the shelf, because a lot of that advice has since been proven wrong.
      </Text>
    </>
  );
}

function BookPage({ b, back, read }: { b: LibraryBookDetail; back: () => void; read: () => void }) {
  const [all, setAll] = useState(false);
  const done = b.finished;
  const pct = Math.round((b.studied / Math.max(1, b.passages)) * 100);
  const shown = all ? b.notes : b.notes.slice(0, 4);
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
        <View style={{ alignSelf: 'flex-end', marginTop: 12, borderWidth: 2, borderColor: done ? '#B23A30' : '#6C3483', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, transform: [{ rotate: '-6deg' }] }}>
          <Text style={{ color: done ? '#B23A30' : '#6C3483', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 }}>
            {done ? `READ${stamp(b.last_read_at)}` : `READING · ${pct}%`}
          </Text>
        </View>
      </View>
      {done ? (
        <Button title="Read the book" onPress={read} />
      ) : (
        <Card>
          <Text style={{ color: colours.text, fontSize: 15, lineHeight: 22 }}>I am {pct}% of the way through this one. It opens for you the night I finish it. Until then, here is what I have kept so far.</Text>
        </Card>
      )}
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

function Reader({ b, back }: { b: LibraryBookDetail; back: () => void }) {
  const [n, setN] = useState<number | null>(null);
  const [pages, setPages] = useState<Record<number, LibraryPassage>>({});
  const [error, setError] = useState('');

  // Pick up where you left off in this book.
  useEffect(() => {
    AsyncStorage.getItem(PLACE + b.id)
      .then((v) => setN(Math.min(Math.max(1, Number(v) || 1), b.passages)))
      .catch(() => setN(1));
  }, [b.id, b.passages]);

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
    AsyncStorage.setItem(PLACE + b.id, String(next)).catch(() => {});
  };
  const page = n != null ? pages[n] : undefined;
  return (
    <>
      <BackLink onPress={back} label={b.title} />
      <View style={{ backgroundColor: colours.paper, borderRadius: 18, padding: 22, minHeight: 320, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }}>
        <Text style={{ color: '#7A6F8F', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 12 }}>PASSAGE {n ?? 1} OF {b.passages}</Text>
        {page ? (
          <>
            {paragraphs(page.text).map((p, i) => (
              <Text key={i} style={{ color: colours.ink, fontSize: 20, lineHeight: 29, fontFamily: serif, marginBottom: 14 }}>{p}</Text>
            ))}
            {page.kept.map((k, i) => (
              <View key={i} style={{ backgroundColor: 'rgba(108,52,131,0.10)', borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: '#6C3483', marginTop: i ? 8 : 0 }}>
                <Text style={{ color: '#6C3483', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 4 }}>TALI KEPT THIS</Text>
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

export default function LibraryScreen() {
  const params = useLocalSearchParams<{ book?: string }>();
  const [books, setBooks] = useState<Book[] | null>(null);
  const [book, setBook] = useState<LibraryBookDetail | null>(null);
  const [opening, setOpening] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setBooks(await libraryShelf());
    } catch {
      setBooks([]);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const open = useCallback(async (id: string) => {
    setError('');
    setOpening(true);
    try {
      const d = await libraryBook(id);
      if (!d) setError('I could not take that one off the shelf. Try again in a moment.');
      else {
        setReading(false);
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
          <Reader b={book} back={() => setReading(false)} />
        ) : (
          <BookPage b={book} back={() => setBook(null)} read={() => setReading(true)} />
        )
      ) : books == null ? (
        <Loading />
      ) : (
        <>
          <Shelf books={books} open={(b) => open(b.id)} />
          {opening ? <Text style={{ color: colours.muted, marginTop: space.md }}>Taking it off the shelf...</Text> : null}
          {error ? <ErrorText>{error}</ErrorText> : null}
        </>
      )}
    </Screen>
  );
}
