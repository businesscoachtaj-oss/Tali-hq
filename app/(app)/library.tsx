// MOCKUP (11 Nov 2026, Taj's idea): Tali's library. Every book she has read or is reading. The ones
// she has finished are open for anyone to read, with what she kept from them beside the text.
// The books, counts, notes and text below are real ones from her shelf, typed in for the mockup.
// Nothing here talks to the server yet.
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BackLink, Button, Card, Screen, TaliSays, Title, goBack } from '@/components/ui';
import { colours, radius, space } from '@/constants/theme';
import { REGIONS } from '@/lib/brain';

type Book = { id: string; title: string; author: string; region: string; subject: string; passages: number; studied: number; lessons: number };
const BOOKS: Book[] = [
  { id: 'pg2274', title: 'How to Live on 24 Hours a Day', author: 'Arnold Bennett', region: 'basal_ganglia', subject: 'habits', passages: 48, studied: 48, lessons: 45 },
  { id: 'pg37134', title: 'The Elements of Style', author: 'William Strunk', region: 'temporal', subject: 'writing', passages: 52, studied: 52, lessons: 48 },
  { id: 'pg14474', title: 'The Chemical History of a Candle', author: 'Michael Faraday', region: 'parietal', subject: 'physics', passages: 150, studied: 100, lessons: 87 },
  { id: 'pg1232', title: 'The Prince', author: 'Niccolo Machiavelli', region: 'prefrontal', subject: 'strategy', passages: 203, studied: 100, lessons: 95 },
  { id: 'pg2680', title: 'Meditations', author: 'Marcus Aurelius', region: 'frontal', subject: 'philosophy', passages: 282, studied: 104, lessons: 102 },
  { id: 'pg148', title: 'The Autobiography of Benjamin Franklin', author: 'Benjamin Franklin', region: 'basal_ganglia', subject: 'habits', passages: 283, studied: 100, lessons: 87 },
  { id: 'pg16287', title: 'Talks to Teachers on Psychology', author: 'William James', region: 'hippocampus', subject: 'learning', passages: 260, studied: 100, lessons: 93 },
  { id: 'pg1228', title: 'On the Origin of Species', author: 'Charles Darwin', region: 'corpus_callosum', subject: 'big ideas', passages: 631, studied: 100, lessons: 87 },
];
const NOTES = [
  'Arnold Bennett held that we never get more time, because we have always had all the time there is. Putting off the things that matter until we have more time is the habit to break.',
  'Arnold Bennett held that you simply begin, since waiting for a better moment only makes the start harder, and that a clear time-table on paper will not do the work for you.',
  'Arnold Bennett advised starting small and quietly, because a failed grand plan damages self-respect, which is the root of all purposefulness.',
  'Arnold Bennett noticed that people who have something definite to look forward to in the evening find more energy and vitality through the whole day, even when they are tired.',
];
const PASSAGE = [
  'The fact is, I, the author, ought to have foreseen that I should appeal most strongly to those who already had an interest in existence. It is always the man who has tasted life who demands more of it. And it is always the man who never gets out of bed who is the most difficult to rouse.',
  'Well, you of the minority, let us assume that the intensity of your daily money-getting will not allow you to carry out quite all the suggestions in the following pages. Some of the suggestions may yet stand. I admit that you may not be able to use the time spent on the journey home at night; but the suggestion for the journey to the office in the morning is as practicable for you as for anybody.',
];
const serif = 'InstrumentSerif_400Regular';
const hue = (b: Book) => (REGIONS as any)[b.region]?.colour ?? colours.purple;

function Spine({ b, h = 64 }: { b: Book; h?: number }) {
  return (
    <View style={{ width: 44, height: h, borderRadius: 6, backgroundColor: hue(b), justifyContent: 'flex-end', padding: 5, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }}>
      <View style={{ height: 2, backgroundColor: 'rgba(255,255,255,0.55)', marginBottom: 3 }} />
      <View style={{ height: 2, backgroundColor: 'rgba(255,255,255,0.35)' }} />
    </View>
  );
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
  const done = b.studied >= b.passages;
  const pct = Math.round((b.studied / b.passages) * 100);
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
        {!done ? <View style={{ position: 'absolute', top: 0, right: 9, width: 8, height: 16 + Math.round(pct * 0.34), backgroundColor: '#C8372D', borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }} /> : null}
      </View>
    </Pressable>
  );
}

function ShelfRow({ books, widths, heights, open, extra }: { books: Book[]; widths: number[]; heights: number[]; open: (b: Book) => void; extra?: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5, paddingHorizontal: 12, minHeight: 176 }}>
        {books.map((b, i) => (
          <Standing key={b.id} b={b} w={widths[i % widths.length]} h={heights[i % heights.length]} onPress={b.studied >= b.passages ? () => open(b) : undefined} />
        ))}
        {extra}
      </View>
      <View style={{ height: 5, backgroundColor: WOOD.plankTop, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
      <View style={{ height: 11, backgroundColor: WOOD.plank, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 6 } }} />
      <View style={{ flexDirection: 'row', gap: 5, paddingHorizontal: 12, marginTop: 6 }}>
        {books.map((b, i) => {
          const done = b.studied >= b.passages;
          return (
            <Text key={b.id} style={{ width: widths[i % widths.length], textAlign: 'center', color: done ? '#F1D58F' : '#C9B8A6', fontSize: 10, fontWeight: '800' }}>
              {done ? 'OPEN' : `${Math.round((b.studied / b.passages) * 100)}%`}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

function Shelf({ open }: { open: (b: Book) => void }) {
  const done = BOOKS.filter((b) => b.studied >= b.passages);
  const reading = BOOKS.filter((b) => b.studied < b.passages);
  return (
    <>
      <BackLink onPress={() => goBack('/(app)/brain')} label="Her brain" />
      <Title sub="Every book I have read or am reading. Tap a finished one to take it off the shelf.">Tali's library</Title>
      <TaliSays pose="idle">12 books on my shelf. I have finished 2 and kept 901 things so far. I read a few pages every night.</TaliSays>

      <View style={{ marginTop: space.lg, backgroundColor: WOOD.back, borderRadius: 14, borderWidth: 6, borderColor: WOOD.post, paddingTop: 16, paddingBottom: 4, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }}>
        <Plaque>FINISHED · OPEN TO READ</Plaque>
        <ShelfRow books={done} widths={[62, 58]} heights={[168, 156]} open={open} extra={<View style={{ flex: 1, alignItems: 'flex-end', paddingRight: 6 }}><Text style={{ color: '#C9B8A6', fontSize: 12, lineHeight: 16, textAlign: 'right', marginBottom: 10, maxWidth: 150 }}>Room on this shelf for the next one I finish.</Text></View>} />
        <Plaque>STILL READING</Plaque>
        <ShelfRow books={reading} widths={[47, 44, 48, 46, 44, 48]} heights={[170, 158, 166, 160, 172, 164]} open={open} />
      </View>
      <Text style={{ color: colours.faint, fontSize: 12, lineHeight: 17, marginTop: space.md }}>The red ribbon is my bookmark. A book opens for you the night I finish it. Every book here is out of copyright and free to read.</Text>
    </>
  );
}

function BookPage({ b, back, read }: { b: Book; back: () => void; read: () => void }) {
  return (
    <>
      <BackLink onPress={back} label="Library" />
      {/* An old library card: cream stock, ruled lines, a date stamp */}
      <View style={{ backgroundColor: colours.paper, borderRadius: 10, padding: 18, marginBottom: space.lg, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }}>
        <Text style={{ color: '#8A7B66', fontSize: 10, fontWeight: '900', letterSpacing: 1.6 }}>TALI'S LIBRARY · {b.subject.toUpperCase()}</Text>
        <Text style={{ color: colours.ink, fontSize: 30, lineHeight: 33, fontFamily: serif, marginTop: 8 }}>{b.title}</Text>
        <View style={{ borderBottomWidth: 1, borderBottomColor: '#CDBFA6', marginTop: 10, paddingBottom: 6 }}><Text style={{ color: colours.ink, fontSize: 15 }}>{b.author}</Text></View>
        <View style={{ borderBottomWidth: 1, borderBottomColor: '#CDBFA6', marginTop: 8, paddingBottom: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: '#6B5E4C', fontSize: 13 }}>{b.passages} passages</Text>
          <Text style={{ color: '#6B5E4C', fontSize: 13 }}>{b.lessons} things kept</Text>
        </View>
        <View style={{ alignSelf: 'flex-end', marginTop: 12, borderWidth: 2, borderColor: '#B23A30', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, transform: [{ rotate: '-6deg' }] }}>
          <Text style={{ color: '#B23A30', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 }}>READ · 10 NOV 2026</Text>
        </View>
      </View>
      <Button title="Read the book" onPress={read} />
      <Text style={{ color: colours.text, fontSize: 22, fontFamily: serif, marginTop: space.xl, marginBottom: 4 }}>What I kept</Text>
      <Text style={{ color: colours.muted, fontSize: 14, lineHeight: 20, marginBottom: space.md }}>{b.lessons} things from this book went into my brain. These are four of them.</Text>
      {NOTES.map((n, i) => (
        <Card key={i} style={{ marginBottom: space.sm, borderLeftWidth: 3, borderLeftColor: hue(b) }}>
          <Text style={{ color: colours.text, fontSize: 15, lineHeight: 22 }}>{n}</Text>
        </Card>
      ))}
      <Pressable accessibilityRole="button" style={{ paddingVertical: space.md }}>
        <Text style={{ color: colours.purple, fontWeight: '800', fontSize: 14 }}>See all {b.lessons}</Text>
      </Pressable>
    </>
  );
}

function Reader({ b, back }: { b: Book; back: () => void }) {
  return (
    <>
      <BackLink onPress={back} label={b.title} />
      <View style={{ backgroundColor: colours.paper, borderRadius: radius.card, padding: 22, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }}>
        <Text style={{ color: '#7A6F8F', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 12 }}>PASSAGE 4 OF {b.passages}</Text>
        {PASSAGE.map((p, i) => (
          <Text key={i} style={{ color: colours.ink, fontSize: 20, lineHeight: 29, fontFamily: serif, marginBottom: 14 }}>{p}</Text>
        ))}
        <View style={{ backgroundColor: 'rgba(108,52,131,0.10)', borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: '#6C3483' }}>
          <Text style={{ color: '#6C3483', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 4 }}>TALI KEPT THIS</Text>
          <Text style={{ color: colours.ink, fontSize: 14, lineHeight: 20 }}>Arnold Bennett held that there is no average person, so each day should be judged by its own case.</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.lg }}>
        <View style={{ flex: 1 }}><Button title="Back a page" kind="ghost" onPress={() => {}} /></View>
        <View style={{ flex: 1 }}><Button title="Next page" onPress={() => {}} /></View>
      </View>
    </>
  );
}

export default function LibraryScreen() {
  const [book, setBook] = useState<Book | null>(null);
  const [reading, setReading] = useState(false);
  return (
    <Screen>
      {!book ? <Shelf open={setBook} /> : reading ? <Reader b={book} back={() => setReading(false)} /> : <BookPage b={book} back={() => setBook(null)} read={() => setReading(true)} />}
    </Screen>
  );
}
