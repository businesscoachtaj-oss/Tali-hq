// app/hq/[slug].tsx
// ADDED (16 Nov 2026, Taj): what someone sees when they open a shared HQ layout link. They can copy
// it into their own Tali HQ, or start free if they don't have Tali HQ yet.
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { MiniLayout } from '@/components/Widgets';
import { TaliAvatar } from '@/components/TaliAvatar';
import { colours, space } from '@/constants/theme';
import { blankNumbers, DEMO_LAYOUT } from '@/lib/widgets';

export default function SharedLayout() {
  const layout = blankNumbers(DEMO_LAYOUT.life);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colours.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TaliAvatar pose="head" size={40} />
          <Text style={{ color: colours.purple, fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>A TALI HQ LAYOUT</Text>
        </View>
        <Text style={{ color: '#fff', fontSize: 34, lineHeight: 38, marginTop: space.md, fontFamily: 'InstrumentSerif_400Regular' }}>Sam's life HQ</Text>
        <Text style={{ color: colours.muted, fontSize: 15, lineHeight: 21, marginTop: 6, marginBottom: space.lg }}>Water, gym, a house deposit, reading and sleep, with the day's reminders and food and training. Copy it and make it yours.</Text>
        <View style={{ borderRadius: 24, padding: 14, backgroundColor: 'rgba(30,24,88,0.6)', borderWidth: 1, borderColor: colours.border }}>
          <MiniLayout widgets={layout} blank />
        </View>
        <View style={{ height: space.lg }} />
        <Button title="Use this layout" onPress={() => router.navigate('/')} />
        <View style={{ height: space.sm }} />
        <Button kind="ghost" title="New to Tali HQ? Start free" onPress={() => router.navigate('/sign-up' as any)} />
        <Text style={{ color: colours.faint, fontSize: 12.5, marginTop: space.md, textAlign: 'center' }}>Only the layout is shared. Sam's numbers stay private.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
