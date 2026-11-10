// Her library (10 Nov 2026, asked for by Taj). The books Tali is working through, a few pages a
// night. Every one is out of copyright and free to read, and each row links to the book itself.
// Folded to the three she is closest to; "See the whole shelf" opens the rest.
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Card } from '@/components/ui';
import { colours, space } from '@/constants/theme';
import { REGIONS } from '@/lib/brain';
import { myLibrary, type LibraryBook } from '@/lib/library';

function status(b: LibraryBook) {
  if (b.state === 'finished') return 'Finished';
  if (b.state === 'reading') return `${Math.max(1, Math.round((b.studied / Math.max(1, b.passages)) * 100))}% read`;
  return 'On the shelf';
}

function Book({ b }: { b: LibraryBook }) {
  const colour = REGIONS[b.region]?.colour ?? colours.purple;
  const pct = b.passages ? Math.min(1, b.studied / b.passages) : 0;
  return (
    <Pressable onPress={() => Linking.openURL(b.source_url)} accessibilityRole="link" accessibilityLabel={`${b.title} by ${b.author}. Opens the book.`} style={{ flexDirection: 'row', gap: space.md, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colours.border }}>
      <View style={{ width: 8, borderRadius: 4, backgroundColor: colour, opacity: b.state === 'reading' || b.state === 'finished' ? 1 : 0.45 }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colours.text, fontSize: 15, fontWeight: '800' }}>{b.title}</Text>
        <Text style={{ color: colours.muted, fontSize: 13, marginTop: 2 }}>
          {b.author} · {b.subject}
        </Text>
        {b.state === 'reading' || b.state === 'finished' ? (
          <View style={{ height: 5, borderRadius: 3, backgroundColor: colours.border, marginTop: 8, overflow: 'hidden' }}>
            <View style={{ width: `${Math.max(3, Math.round(pct * 100))}%`, height: 5, borderRadius: 3, backgroundColor: colour }} />
          </View>
        ) : null}
        <Text style={{ color: colours.faint, fontSize: 12, marginTop: 6 }}>
          {status(b)}
          {b.lessons ? ` · ${b.lessons} ${b.lessons === 1 ? 'thing' : 'things'} kept` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

export function LibraryShelf() {
  const [books, setBooks] = useState<LibraryBook[] | null>(null);
  const [all, setAll] = useState(false);
  useEffect(() => {
    myLibrary().then(setBooks).catch(() => setBooks([]));
  }, []);
  if (!books || !books.length) return null;
  const reading = books.filter((b) => b.state === 'reading').length;
  const shown = all ? books : books.slice(0, 3);
  return (
    <Card style={{ marginBottom: space.lg }}>
      <Text style={{ color: colours.text, fontSize: 22, fontFamily: 'InstrumentSerif_400Regular' }}>Her library</Text>
      <Text style={{ color: colours.muted, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: space.sm }}>
        {reading
          ? `${books.length} books on my shelf. I read a few pages each night and keep what is still worth knowing.`
          : `${books.length} books on my shelf. I start tonight, a few pages each night, and keep what is still worth knowing.`}
      </Text>
      {shown.map((b) => (
        <Book key={b.id} b={b} />
      ))}
      {books.length > 3 ? (
        <Pressable onPress={() => setAll(!all)} accessibilityRole="button" style={{ alignSelf: 'flex-start', paddingTop: space.md, borderTopWidth: 1, borderTopColor: colours.border, width: '100%' }}>
          <Text style={{ color: colours.purple, fontWeight: '800', fontSize: 14 }}>{all ? 'Show less' : `See the whole shelf (${books.length})`}</Text>
        </Pressable>
      ) : null}
      <Text style={{ color: colours.faint, fontSize: 12, lineHeight: 17, marginTop: space.md }}>
        Every book here is out of copyright and free to read. Tap one to open it. I leave old health and medical books off the shelf, because a lot of that advice has since been proven wrong.
      </Text>
    </Card>
  );
}
