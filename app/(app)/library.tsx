// MOCKUP (11 Nov 2026, Taj's idea): Tali's library. Every book she has read or is reading. The ones
// she has finished are open for anyone to read, with what she kept from them beside the text.
// The books, counts, notes and text below are real ones from her shelf, typed in for the mockup.
// Nothing here talks to the server yet.
import { useState } from 'react';
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

function Shelf({ open }: { open: (b: Book) => void }) {
  const done = BOOKS.filter((b) => b.studied >= b.passages);
  const reading = BOOKS.filter((b) => b.studied < b.passages);
  return (
    <>
      <BackLink onPress={() => goBack('/(app)/brain')} label="Her brain" />
      <Title sub="Every book I have read or am reading. The ones I have finished are open for you to read too.">Tali's library</Title>
      <TaliSays pose="idle">12 books on my shelf. I have finished 2 and kept 901 things so far. I read a few pages every night.</TaliSays>

      <Text style={{ color: colours.faint, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginTop: space.lg, marginBottom: space.sm }}>FINISHED, OPEN TO READ</Text>
      {done.map((b) => (
        <Pressable key={b.id} onPress={() => open(b)} accessibilityRole="button" accessibilityLabel={`${b.title} by ${b.author}. Open.`}>
          <Card style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', marginBottom: space.md }}>
            <Spine b={b} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colours.text, fontSize: 20, lineHeight: 24, fontFamily: serif }}>{b.title}</Text>
              <Text style={{ color: colours.muted, fontSize: 13, marginTop: 3 }}>{b.author} · {b.subject}</Text>
              <Text style={{ color: colours.good, fontSize: 12, fontWeight: '700', marginTop: 6 }}>Finished · {b.lessons} things kept</Text>
            </View>
            <View style={{ backgroundColor: colours.purple, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 }}>
              <Text style={{ color: colours.onPurple, fontWeight: '800', fontSize: 13 }}>Open</Text>
            </View>
          </Card>
        </Pressable>
      ))}

      <Text style={{ color: colours.faint, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginTop: space.md, marginBottom: space.sm }}>STILL READING</Text>
      <Card>
        {reading.map((b, i) => {
          const pct = Math.round((b.studied / b.passages) * 100);
          return (
            <View key={b.id} style={{ flexDirection: 'row', gap: space.md, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colours.border, opacity: 0.92 }}>
              <View style={{ width: 8, borderRadius: 4, backgroundColor: hue(b) }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: colours.text, fontSize: 15, fontWeight: '800' }}>{b.title}</Text>
                <Text style={{ color: colours.muted, fontSize: 13, marginTop: 2 }}>{b.author} · {b.subject}</Text>
                <View style={{ height: 5, borderRadius: 3, backgroundColor: colours.border, marginTop: 8, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.max(3, pct)}%`, height: 5, borderRadius: 3, backgroundColor: hue(b) }} />
                </View>
                <Text style={{ color: colours.faint, fontSize: 12, marginTop: 6 }}>{pct}% read · opens when I finish it</Text>
              </View>
            </View>
          );
        })}
      </Card>
      <Text style={{ color: colours.faint, fontSize: 12, lineHeight: 17, marginTop: space.md }}>Every book here is out of copyright and free to read.</Text>
    </>
  );
}

function BookPage({ b, back, read }: { b: Book; back: () => void; read: () => void }) {
  return (
    <>
      <BackLink onPress={back} label="Library" />
      <Card style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center', marginBottom: space.lg }}>
        <Spine b={b} h={110} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colours.text, fontSize: 28, lineHeight: 31, fontFamily: serif }}>{b.title}</Text>
          <Text style={{ color: colours.muted, fontSize: 14, marginTop: 6 }}>{b.author}</Text>
          <Text style={{ color: colours.faint, fontSize: 12, marginTop: 8 }}>{b.passages} passages · finished 10 November</Text>
        </View>
      </Card>
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
