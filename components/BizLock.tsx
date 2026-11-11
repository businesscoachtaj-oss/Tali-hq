// 12 Nov 2026 (Taj): the business tools belong to the Business plans. Until those plans are on sale,
// everyone else sees what the tool does and that it is coming, with nothing to buy yet.
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '@/components/ui';
import { BLUE, Head, Line, type Icon } from '@/components/Biz';
import { colours, radius } from '@/constants/theme';

export function BizLock({ title, sub, points }: { title: string; sub: string; points: { icon: Icon; title: string; sub: string }[] }) {
  return (
    <Screen>
      <Head over="Business" title={title} sub={sub} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start', borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: BLUE + '26', borderWidth: 1, borderColor: BLUE + '80', marginBottom: 14 }}>
        <Ionicons name="time-outline" size={16} color={BLUE} />
        <Text style={{ color: BLUE, fontWeight: '800', fontSize: 13 }}>Coming soon, with the Business plans</Text>
      </View>
      <View style={{ backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, paddingHorizontal: 14 }}>
        {points.map((p, i) => <Line key={p.title} first={!i} icon={p.icon} title={p.title} sub={p.sub} />)}
      </View>
    </Screen>
  );
}
