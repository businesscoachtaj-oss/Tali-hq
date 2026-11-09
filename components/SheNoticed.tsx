// 9 Nov 2026 "life with a growing brain": what she learned about you lately, on Today. Each line is a
// real memory from this week, with the colour of the part of her brain it went to.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { myBrain, REGIONS, type BrainItem, type RegionId } from '@/lib/brain';
import { colours, radius, space } from '@/constants/theme';

export function SheNoticed() {
  const [items, setItems] = useState<(BrainItem & { region: RegionId })[]>([]);
  useFocusEffect(useCallback(() => {
    myBrain('mine').then((b) => {
      const weekAgo = Date.now() - 7 * 86400000;
      const all = b.regions.flatMap((r) => r.items.filter((i) => i.mine && i.at && new Date(i.at).getTime() > weekAgo).map((i) => ({ ...i, region: r.id })));
      all.sort((a, c) => new Date(c.at!).getTime() - new Date(a.at!).getTime());
      setItems(all.slice(0, 3));
    }).catch(() => setItems([]));
  }, []));
  if (!items.length) return null;
  return (
    <Pressable onPress={() => router.navigate('/brain')} accessibilityRole="button" style={{ marginBottom: space.lg }}>
      <Text style={{ color: colours.text, fontSize: 24, fontFamily: 'InstrumentSerif_400Regular', marginBottom: 10 }}>She learned this week</Text>
      <View style={{ backgroundColor: 'rgba(142,240,200,0.14)', borderRadius: radius.card, borderWidth: 1, borderColor: 'rgba(142,240,200,0.55)', padding: space.lg, gap: 12, shadowColor: '#8EF0C8', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } }}>
        {items.map((it, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 7, backgroundColor: REGIONS[it.region].colour, shadowColor: REGIONS[it.region].colour, shadowOpacity: 1, shadowRadius: 6 }} />
            <Text style={{ flex: 1, color: colours.text, fontSize: 15, lineHeight: 21 }}>{it.text}</Text>
          </View>
        ))}
        <Text style={{ color: colours.purple, fontSize: 14, fontWeight: '700' }}>Everything she knows {'›'}</Text>
      </View>
    </Pressable>
  );
}
