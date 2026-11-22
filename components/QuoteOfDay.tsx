// 23 Nov 2026 (Taj): "depending on the philosophy or philosophies you pick, it can give you a quote of
// the day on the main page which you can save or dismiss". Shows on Today only once you follow a school.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { dismissQuoteToday, myPhilosophies, quoteDismissedToday, quoteForToday, saveQuote, savedQuoteIds, schoolById } from '@/lib/philosophy';

const INK = '#1C1A17', MUTED = '#5E574E', FAINT = '#8C8478', PAPER = '#F5F0E6', LINE = 'rgba(28,26,23,0.16)';

export function QuoteOfDay() {
  const [ids, setIds] = useState<string[] | null>(null);
  const [gone, setGone] = useState(true);
  const [kept, setKept] = useState(false);
  useFocusEffect(useCallback(() => {
    let live = true;
    (async () => {
      const [m, d] = await Promise.all([myPhilosophies(), quoteDismissedToday()]);
      if (!live) return;
      setIds(m); setGone(d);
      const q = quoteForToday(m);
      if (q) setKept((await savedQuoteIds()).includes(q.id));
    })();
    return () => { live = false; };
  }, []));
  const q = ids ? quoteForToday(ids) : null;
  if (!q || gone) return null;
  const s = schoolById(q.school);
  return (
    <View style={{ marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: LINE }}>
      <Text style={{ color: s?.colour ?? INK, fontSize: 11, fontWeight: '800', letterSpacing: 1.8 }}>{`A THOUGHT FOR TODAY  ·  ${(s?.name ?? '').toUpperCase()}`}</Text>
      <Text style={{ color: INK, fontSize: 20, lineHeight: 28, marginTop: 6, fontFamily: 'EBGaramond_400Regular_Italic' }}>{q.text}</Text>
      <Text style={{ color: MUTED, fontSize: 12, marginTop: 6 }}>{q.who}, {q.from}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <Pressable disabled={kept} onPress={async () => { setKept(true); await saveQuote(q.id).catch(() => setKept(false)); }} accessibilityRole="button"
          style={{ backgroundColor: kept ? 'transparent' : INK, borderWidth: 1, borderColor: INK, borderRadius: 3, paddingVertical: 9, paddingHorizontal: 14 }}>
          <Text style={{ color: kept ? INK : PAPER, fontWeight: '800', fontSize: 13 }}>{kept ? 'Kept' : 'Keep it'}</Text>
        </Pressable>
        <Pressable onPress={async () => { setGone(true); await dismissQuoteToday(); }} accessibilityRole="button" style={{ paddingVertical: 9, paddingHorizontal: 6 }}>
          <Text style={{ color: MUTED, fontWeight: '700', fontSize: 13 }}>Not today</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => router.navigate('/philosophy' as any)} hitSlop={8} accessibilityRole="link">
          <Text style={{ color: FAINT, fontSize: 12.5, fontWeight: '700' }}>{s ? `More ${s.name} ›` : 'More ›'}</Text>
        </Pressable>
      </View>
    </View>
  );
}
