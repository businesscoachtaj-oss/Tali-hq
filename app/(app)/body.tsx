// 11 Nov 2026 (Your world, Health): your weight and how it is trending. Logged by telling Tali.
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { weights, type WeightLog } from '@/lib/data';
import { friendlyDate } from '@/lib/dates';
import { Body as P, Button, Card, ErrorText, Screen, TaliSays } from '@/components/ui';
import { SkinHeader } from '@/components/PageSkin';
import { colours, space } from '@/constants/theme';

const round1 = (n: number) => Math.round(n * 10) / 10;

export default function BodyScreen() {
  const [list, setList] = useState<WeightLog[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      setList(await weights(60));
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your weight.');
    }
  }, []);
  useFocusLoad(load); // Speed pass (13 Nov 2026): see lib/useFocusLoad.ts

  const rows = list ?? [];
  const latest = rows[0];
  const oldest = rows[rows.length - 1];
  const change = latest && oldest && rows.length > 1 ? round1(latest.kg - oldest.kg) : null;
  const lo = rows.length ? Math.min(...rows.map((r) => r.kg)) : 0;
  const hi = rows.length ? Math.max(...rows.map((r) => r.kg)) : 0;
  const shown = [...rows].slice(0, 30).reverse();

  return (
    <Screen skin="gym" onRefresh={load}>
      <SkinHeader id="gym" title="Body" sub="Your weight and how it is trending. Tell Tali what you weigh and it lands here." onBack={() => router.navigate('/world')} backLabel="Your world" />
      <ErrorText>{error}</ErrorText>
      {list && !rows.length ? (
        <>
          <TaliSays pose="idle">No weigh ins yet. Tell me what you weigh whenever you step on the scales.</TaliSays>
          <Card><P muted>Try "I'm 82.4 kg this morning" in Talk.</P></Card>
        </>
      ) : null}
      {latest ? (
        <Card style={{ backgroundColor: colours.sunk }}>
          <Text style={{ fontSize: 34, fontWeight: '800', color: colours.text }}>{latest.kg} kg</Text>
          <Text style={{ color: colours.muted, marginTop: 2 }}>{friendlyDate(latest.local_date)}</Text>
          {change !== null ? (
            <Text style={{ color: colours.text, marginTop: space.sm, fontWeight: '700' }}>
              {change === 0 ? 'No change' : `${change > 0 ? 'Up' : 'Down'} ${Math.abs(change)} kg`} since {friendlyDate(oldest.local_date)}
            </Text>
          ) : null}
        </Card>
      ) : null}
      {shown.length > 1 ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 3 }}>
            {shown.map((r) => (
              <View key={r.id} style={{ flex: 1, height: `${hi === lo ? 60 : 25 + ((r.kg - lo) / (hi - lo)) * 75}%`, backgroundColor: '#FF9EC4', borderRadius: 4, opacity: r.id === latest.id ? 1 : 0.55 }} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={{ color: colours.faint, fontSize: 12 }}>{friendlyDate(shown[0].local_date)}</Text>
            <Text style={{ color: colours.faint, fontSize: 12 }}>Low {lo} kg, high {hi} kg</Text>
          </View>
        </Card>
      ) : null}
      {rows.slice(0, 12).map((r) => (
        <View key={r.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colours.border }}>
          <Text style={{ color: colours.muted }}>{friendlyDate(r.local_date)}</Text>
          <Text style={{ color: colours.text, fontWeight: '700' }}>{r.kg} kg</Text>
        </View>
      ))}
      <View style={{ height: space.md }} />
      <Button title="Tell Tali your weight" onPress={() => router.navigate({ pathname: '/talk', params: { ask: 'I weigh ' } })} />
      <Button title="Food and training" kind="ghost" onPress={() => router.navigate('/life')} />
    </Screen>
  );
}
