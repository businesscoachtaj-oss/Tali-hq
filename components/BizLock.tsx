// 12 Nov 2026 (Taj): the business tools come with Tali HQ Business. Everyone else sees what the tool
// does and a way to the Plans screen. `paid` is for things any paid plan includes.
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Screen } from '@/components/ui';
import { BLUE, Head, Line, type Icon } from '@/components/Biz';
import { colours, radius } from '@/constants/theme';

export function BizLock({ title, sub, points, paid }: { title: string; sub: string; points: { icon: Icon; title: string; sub: string }[]; paid?: boolean }) {
  return (
    <Screen>
      <Head over={paid ? 'Your world' : 'Business'} title={title} sub={sub} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start', borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: BLUE + '26', borderWidth: 1, borderColor: BLUE + '80', marginBottom: 14 }}>
        <Ionicons name="lock-closed-outline" size={16} color={BLUE} />
        <Text style={{ color: BLUE, fontWeight: '800', fontSize: 13 }}>{paid ? 'Comes with any paid plan' : 'Comes with Tali HQ Business'}</Text>
      </View>
      <View style={{ backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, paddingHorizontal: 14 }}>
        {points.map((p, i) => <Line key={p.title} first={!i} icon={p.icon} title={p.title} sub={p.sub} />)}
      </View>
      <View style={{ height: 14 }} />
      <Button title="See the plans" onPress={() => router.push('/plans')} />
    </Screen>
  );
}
