// 23 Nov 2026 (Taj): Your philosophy. Pick the schools that speak to you and Tali brings their texts,
// lessons, things to try, further reading and a thought each morning on Today (components/QuoteOfDay).
// Free for everyone. Content lives in lib/philosophy.ts.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { SCHOOLS, allQuotes, myPhilosophies, savedQuoteIds, setPhilosophies, unsaveQuote, type School } from '@/lib/philosophy';
import { SkinHeader } from '@/components/PageSkin';
import { Screen, goBack } from '@/components/ui';
import { colours, radius, space } from '@/constants/theme';

const kicker = { color: colours.text, fontSize: 11, fontWeight: '800' as const, letterSpacing: 1.8 };

function Detail({ s, following, onFollow }: { s: School; following: boolean; onFollow: () => void }) {
  const q = s.quotes[0];
  return (
    <View style={{ paddingBottom: space.lg, paddingLeft: 18 }}>
      <Text style={{ color: colours.text, fontSize: 16, lineHeight: 24, fontFamily: 'EBGaramond_400Regular' }}>{s.idea}</Text>

      <Text style={[kicker, { marginTop: space.md }]}>THREE LESSONS</Text>
      {s.lessons.map((l, i) => (
        <View key={l.title} style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
          <Text style={{ color: s.colour, fontSize: 18, width: 16, fontFamily: 'EBGaramond_500Medium' }}>{i + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colours.text, fontSize: 17, fontFamily: 'EBGaramond_500Medium' }}>{l.title}</Text>
            <Text style={{ color: colours.muted, fontSize: 13.5, lineHeight: 20, marginTop: 1 }}>{l.text}</Text>
          </View>
        </View>
      ))}

      <Text style={[kicker, { marginTop: space.md }]}>TRY THIS WEEK</Text>
      {s.actions.map((a) => (
        <View key={a} style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
          <View style={{ width: 14, height: 14, borderWidth: 1, borderColor: colours.ink, marginTop: 3 }} />
          <Text style={{ flex: 1, color: colours.text, fontSize: 14, lineHeight: 20 }}>{a}</Text>
        </View>
      ))}

      <Text style={[kicker, { marginTop: space.md }]}>READ FIRST</Text>
      {s.read.map((b) => (
        <Pressable key={b.title} disabled={!b.book} onPress={() => b.book && router.navigate({ pathname: '/library', params: { book: b.book } } as any)} accessibilityRole={b.book ? 'link' : 'text'}
          style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
          <Text style={{ flex: 1, color: colours.text, fontSize: 15 }}>
            <Text style={{ fontFamily: 'EBGaramond_400Regular_Italic', fontSize: 17 }}>{b.title}</Text>{`  ${b.author}`}
          </Text>
          <Text style={{ color: b.book ? colours.purple : colours.faint, fontSize: 12, fontWeight: '700' }}>{b.book ? 'In her library ›' : 'Not in her library yet'}</Text>
        </Pressable>
      ))}

      <Text style={[kicker, { marginTop: space.md }]}>FURTHER READING</Text>
      {s.further.map((b) => (
        <Text key={b.title} style={{ color: colours.text, fontSize: 15, marginTop: 8 }}>
          <Text style={{ fontFamily: 'EBGaramond_400Regular_Italic', fontSize: 17 }}>{b.title}</Text>{`  ${b.author}`}
        </Text>
      ))}

      {q ? (
        <View style={{ marginTop: space.md, borderLeftWidth: 2, borderLeftColor: s.colour, paddingLeft: 12 }}>
          <Text style={{ color: colours.text, fontSize: 18, lineHeight: 26, fontFamily: 'EBGaramond_400Regular_Italic' }}>{q.text}</Text>
          <Text style={{ color: colours.muted, fontSize: 12, marginTop: 4 }}>{q.who}, {q.from}</Text>
        </View>
      ) : null}

      <Pressable onPress={onFollow} accessibilityRole="button" style={{ marginTop: space.md, alignSelf: 'flex-start', borderRadius: radius.pill, borderWidth: 1, borderColor: colours.ink, backgroundColor: following ? colours.surface : colours.ink, paddingVertical: 11, paddingHorizontal: 18 }}>
        <Text style={{ color: following ? colours.text : colours.bg, fontWeight: '800', fontSize: 12, letterSpacing: 1.2 }}>{following ? 'STOP FOLLOWING' : `FOLLOW ${s.name.toUpperCase()}`}</Text>
      </Pressable>
    </View>
  );
}

export default function YourPhilosophy() {
  const [mine, setMine] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [kept, setKept] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const m = await myPhilosophies();
    setMine(m);
    setOpen((o) => o ?? m[0] ?? null);
    setKept(await savedQuoteIds());
  }, []);
  useFocusLoad(load);

  const toggle = async (id: string) => {
    const next = mine.includes(id) ? mine.filter((x) => x !== id) : [...mine, id];
    setMine(next);
    setErr(null);
    try { await setPhilosophies(next); } catch { setErr("That didn't save. Try again in a moment."); setMine(mine); }
  };
  const quotes = allQuotes().filter((q) => kept.includes(q.id));

  return (
    <Screen skin="philosophy" onRefresh={load}>
      <SkinHeader id="philosophy" title="Your philosophy" sub="Follow the schools that speak to you. Tali brings you their best texts, a few lessons, things to try this week, and a thought on Today each morning." onBack={() => goBack('/me')} />

      <Text style={kicker}>{mine.length ? `YOU FOLLOW ${mine.length === 1 ? 'ONE SCHOOL' : `${mine.length} SCHOOLS`}` : 'PICK ONE OR A FEW'}</Text>
      <View style={{ borderTopWidth: 1, borderTopColor: colours.ink, marginTop: 8 }}>
        {SCHOOLS.map((s) => {
          const on = mine.includes(s.id); const isOpen = open === s.id;
          return (
            <View key={s.id} style={{ borderBottomWidth: 1, borderBottomColor: colours.border }}>
              <Pressable onPress={() => setOpen(isOpen ? null : s.id)} accessibilityRole="button" accessibilityState={{ expanded: isOpen, selected: on }}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 14 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.colour, marginTop: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colours.text, fontSize: 22, fontFamily: 'EBGaramond_500Medium' }}>{s.name}</Text>
                  <Text style={{ color: colours.muted, fontSize: 13.5, lineHeight: 19, marginTop: 1 }}>{s.line}</Text>
                </View>
                {on ? <Text style={{ color: colours.purple, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 8 }}>FOLLOWING</Text> : null}
                <Text style={{ color: colours.faint, fontSize: 18, marginTop: 4 }}>{isOpen ? '−' : '+'}</Text>
              </Pressable>
              {isOpen ? <Detail s={s} following={on} onFollow={() => void toggle(s.id)} /> : null}
            </View>
          );
        })}
      </View>
      {err ? <Text style={{ color: colours.danger, fontSize: 12.5, marginTop: 6 }}>{err}</Text> : null}

      <Text style={[kicker, { marginTop: space.xl }]}>QUOTES YOU KEPT</Text>
      <View style={{ borderTopWidth: 1, borderTopColor: colours.ink, marginTop: 8, marginBottom: space.lg }}>
        {quotes.length ? quotes.map((q) => (
          <View key={q.id} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colours.border }}>
            <Text style={{ color: colours.text, fontSize: 18, lineHeight: 26, fontFamily: 'EBGaramond_400Regular_Italic' }}>{q.text}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Text style={{ flex: 1, color: colours.muted, fontSize: 12 }}>{q.who}, {q.from}</Text>
              <Pressable onPress={async () => { await unsaveQuote(q.id).catch(() => {}); setKept((k) => k.filter((x) => x !== q.id)); }} hitSlop={8} accessibilityRole="button">
                <Text style={{ color: colours.faint, fontSize: 12, textDecorationLine: 'underline' }}>Remove</Text>
              </Pressable>
            </View>
          </View>
        )) : (
          <Text style={{ color: colours.muted, fontSize: 16, lineHeight: 23, paddingVertical: 14, fontFamily: 'EBGaramond_400Regular_Italic' }}>
            Each morning Today shows a thought from the schools you follow. Keep the ones you want to come back to and they gather here.
          </Text>
        )}
      </View>
      <Text style={{ color: colours.faint, fontSize: 11.5, lineHeight: 17, marginBottom: space.xl }}>
        Quotes are word for word from public domain translations, named under each one. Lessons and things to try are Tali's plain-English summaries.
      </Text>
    </Screen>
  );
}
