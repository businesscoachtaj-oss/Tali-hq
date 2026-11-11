// 11 Nov 2026 (Your world, Health): your mood across the last two weeks, from the mood you pick when
// you write in your journal. Nothing here is worked out or guessed: it only shows what you chose.
import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { journalEntries, type JournalEntry } from '@/lib/data';
import { addDays, friendlyDate, isoDate } from '@/lib/dates';
import { Body, Button, Card, ErrorText, Screen, TaliSays } from '@/components/ui';
import { SkinHeader } from '@/components/PageSkin';
import { colours, space } from '@/constants/theme';

const MOODS = ['Rough', 'Meh', 'Okay', 'Good', 'Great'];
const MOOD_COLOUR = ['#E7A6CF', '#FFB561', '#B9A6FF', '#7FE0B0', '#4FD39A'];
const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function Headspace() {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      setEntries(await journalEntries());
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your journal.');
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const days = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const e of entries ?? []) {
      if (e.kind !== 'journal' || !e.mood) continue;
      const d = isoDate(new Date(e.created_at));
      if (!byDay.has(d)) byDay.set(d, e.mood);
    }
    return Array.from({ length: 14 }, (_, i) => {
      const d = addDays(new Date(), i - 13);
      return { date: d, iso: isoDate(d), mood: byDay.get(isoDate(d)) ?? null };
    });
  }, [entries]);
  const logged = days.filter((d) => d.mood);
  const counts = MOODS.map((_, i) => logged.filter((d) => d.mood === i + 1).length);
  const most = logged.length ? counts.indexOf(Math.max(...counts)) : -1;

  return (
    <Screen skin="journal" onRefresh={load}>
      <SkinHeader id="journal" title="Headspace" sub="Your mood across the last two weeks, from the mood you pick when you write in your journal." onBack={() => router.navigate('/world')} backLabel="Your world" />
      <ErrorText>{error}</ErrorText>
      {entries && !logged.length ? <TaliSays pose="idle">No moods in the last two weeks. Pick one when you write in your journal and it shows up here.</TaliSays> : null}
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {days.map((d) => (
            <View key={d.iso} style={{ width: `${100 / 7}%`, padding: 3, alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colours.faint, marginBottom: 4 }}>{DAY_LETTER[d.date.getDay()]}</Text>
              <View accessibilityLabel={`${friendlyDate(d.iso)}: ${d.mood ? MOODS[d.mood - 1] : 'no mood'}`}
                style={{ width: '100%', aspectRatio: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: d.mood ? MOOD_COLOUR[d.mood - 1] : 'rgba(255,255,255,0.07)' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: d.mood ? colours.onPurple : colours.faint }}>{d.date.getDate()}</Text>
              </View>
            </View>
          ))}
        </View>
      </Card>
      {logged.length ? (
        <Card>
          <Text style={{ fontWeight: '800', color: colours.text, fontSize: 16 }}>Mostly {MOODS[most].toLowerCase()}</Text>
          <Text style={{ color: colours.muted, marginTop: 2, marginBottom: space.sm }}>{logged.length} of the last 14 days have a mood.</Text>
          {MOODS.map((m, i) => counts[i] ? (
            <View key={m} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: MOOD_COLOUR[i] }} />
              <Text style={{ color: colours.text, flex: 1 }}>{m}</Text>
              <Text style={{ color: colours.muted }}>{counts[i]} {counts[i] === 1 ? 'day' : 'days'}</Text>
            </View>
          ) : null)}
        </Card>
      ) : null}
      <Body muted>Only you see this. It is not medical advice.</Body>
      <View style={{ height: space.md }} />
      <Button title="Write in your journal" onPress={() => router.navigate('/journal')} />
    </Screen>
  );
}
