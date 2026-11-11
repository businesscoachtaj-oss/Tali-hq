// 11 Nov 2026 (Your world, People): the dates that matter in the next three months, in one place.
// Birthdays from your people, check ups, life admin and anything dated on your lists, plus the dated
// things Tali already knows (lib/brain myUpcoming).
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { clients } from '@/lib/data';
import { myUpcoming } from '@/lib/brain';
import { friendlyDate, today } from '@/lib/dates';
import { LISTS, birthdayNext, inDays, lifeItems, type ListKind } from '@/lib/world';
import { Body, Button, Card, ErrorText, Screen, TaliSays } from '@/components/ui';
import { SkinHeader } from '@/components/PageSkin';
import { colours, space } from '@/constants/theme';

type Row = { key: string; title: string; sub: string; days: number; date: string; colour: string; go: () => void };
const DATED: ListKind[] = ['todo', 'checkup', 'admin', 'home'];

export default function Dates() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      const [people, known, ...lists] = await Promise.all([clients(), myUpcoming(90).catch(() => []), ...DATED.map((k) => lifeItems(k))]);
      const t = new Date(`${today()}T12:00:00`).getTime();
      const out: Row[] = [];
      for (const p of people) {
        if (!p.birthday) continue;
        const n = birthdayNext(p.birthday);
        if (n.days > 90) continue;
        out.push({ key: 'b' + p.id, title: `${p.name}'s birthday`, sub: n.turning ? `Turning ${n.turning}` : 'Birthday', days: n.days, date: n.date, colour: '#8EF0C8', go: () => router.navigate({ pathname: '/person', params: { id: p.id } } as any) });
      }
      lists.forEach((list, li) => {
        const kind = DATED[li];
        for (const i of list) {
          if (i.done_at || !i.due_date) continue;
          const days = Math.round((new Date(`${i.due_date}T12:00:00`).getTime() - t) / 86400000);
          if (days > 90) continue;
          out.push({ key: 'i' + i.id, title: i.title, sub: LISTS[kind].title, days, date: i.due_date, colour: kind === 'checkup' ? '#FF9EC4' : kind === 'todo' ? '#9FB7FF' : '#9FE8FF', go: () => router.navigate({ pathname: '/list', params: { kind } } as any) });
        }
      });
      const names = new Set(out.map((r) => r.title.toLowerCase()));
      for (const u of known) {
        if (names.has(u.text.toLowerCase())) continue;
        out.push({ key: 'm' + u.id, title: u.text, sub: u.yearly ? 'Every year' : 'Tali knows this', days: u.days_away, date: u.date, colour: '#D7B5FF', go: () => router.navigate('/brain') });
      }
      setRows(out.sort((a, b) => a.days - b.days));
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your dates.');
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <Screen skin="cork" onRefresh={load}>
      <SkinHeader id="cork" title="Dates that matter" sub="Birthdays and everything with a date on it, for the next three months." onBack={() => router.navigate('/world')} backLabel="Your world" />
      <ErrorText>{error}</ErrorText>
      {rows && !rows.length ? (
        <>
          <TaliSays pose="idle">Nothing dated in the next three months. Tell me a birthday and I will keep it.</TaliSays>
          <Card><Body muted>Try "Mum's birthday is 14 December" in Talk, or add a birthday when you edit someone in Your people.</Body></Card>
        </>
      ) : null}
      {(rows ?? []).map((r) => (
        <Pressable key={r.key} accessibilityRole="button" onPress={r.go}>
          <Card style={{ borderLeftWidth: 5, borderLeftColor: r.colour }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text, flex: 1 }}>{r.title}</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: r.days <= 7 ? colours.orange : colours.purpleInk }}>{r.days < 0 ? 'Overdue' : inDays(r.days)}</Text>
            </View>
            <Text style={{ fontSize: 13, color: colours.muted, marginTop: 3 }}>{r.sub}, {friendlyDate(r.date)}</Text>
          </Card>
        </Pressable>
      ))}
      <View style={{ height: space.md }} />
      <Button title="Tell Tali a date" onPress={() => router.navigate({ pathname: '/talk', params: { ask: 'Remember this date: ' } })} />
      <Button title="Your people" kind="ghost" onPress={() => router.navigate('/clients')} />
    </Screen>
  );
}
