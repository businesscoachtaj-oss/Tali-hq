// 9 Nov 2026 look refresh: her brain on Today, so it isn't hidden away. How many memories, what she
// learned this week and the newest thing, with a tap through to the Brain tab.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { myBrain, REGIONS, type BrainItem, type RegionId } from '@/lib/brain';
import { heading, radius, space } from '@/constants/theme';

const DOTS = [[30, 14, '#8EF0C8'], [44, 10, '#8EF0C8'], [58, 12, '#9FB7FF'], [70, 18, '#B9A6FF'], [22, 26, '#8EF0C8'], [36, 26, '#7FD1FF'], [52, 24, '#D7B5FF'], [66, 30, '#B9A6FF'], [78, 30, '#D7B5FF'], [28, 40, '#FFE38A'], [42, 40, '#9FB7FF'], [56, 38, '#FFC37A'], [70, 44, '#9FB7FF'], [24, 54, '#FF9EC4'], [36, 58, '#FF9EC4'], [50, 54, '#FF7A6E'], [62, 58, '#FF9EC4'], [46, 70, '#A6B0C8']] as const;

export function BrainNow() {
  const [total, setTotal] = useState<number | null>(null);
  const [fresh, setFresh] = useState<(BrainItem & { region: RegionId })[]>([]);
  useFocusEffect(
    useCallback(() => {
      myBrain('mine')
        .then((b) => {
          setTotal(b.total);
          const weekAgo = Date.now() - 7 * 86400000;
          const items = b.regions.flatMap((r) => r.items.filter((i) => i.mine && i.at && new Date(i.at).getTime() > weekAgo).map((i) => ({ ...i, region: r.id })));
          items.sort((a, b2) => new Date(b2.at!).getTime() - new Date(a.at!).getTime());
          setFresh(items);
        })
        .catch(() => setTotal(null));
    }, []),
  );
  if (total === null) return null;
  const newest = fresh[0];
  return (
    <Pressable onPress={() => router.navigate('/brain')} accessibilityRole="button" accessibilityLabel="Open Tali's brain"
      style={{ marginTop: space.md, borderRadius: radius.card, backgroundColor: '#1F1D4A', padding: space.lg, flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 19, ...heading }}>Her brain</Text>
        <Text style={{ color: '#CFC6FF', fontSize: 13.5, marginTop: 3 }}>
          {total.toLocaleString('en-AU')} memories{fresh.length ? `, ${fresh.length} new this week` : ''}
        </Text>
        {newest ? (
          <Text style={{ color: '#FFFFFF', fontSize: 14, lineHeight: 20, marginTop: space.md }} numberOfLines={2}>
            <Text style={{ color: REGIONS[newest.region].colour, fontWeight: '800' }}>Just learned: </Text>{newest.text}
          </Text>
        ) : (
          <Text style={{ color: '#E6E1FF', fontSize: 14, lineHeight: 20, marginTop: space.md }}>Tell her about your business in Talk and watch it fill up.</Text>
        )}
      </View>
      <View style={{ width: 96, height: 84 }}>
        {DOTS.map(([x, y, c], i) => (
          <View key={i} style={{ position: 'absolute', left: x, top: y, width: i % 3 ? 9 : 12, height: i % 3 ? 9 : 12, borderRadius: 6, backgroundColor: c, opacity: 0.9 }} />
        ))}
      </View>
    </Pressable>
  );
}
