// app/(app)/home-share.tsx
// ADDED (16 Nov 2026, Taj): share your HQ layout as a link. People who open it can copy the
// layout into their own Tali HQ. Only the layout goes by default: which blocks, their targets and
// how they look. Your numbers stay yours unless you switch them on.
import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BackLink, Button, Screen, Title } from '@/components/ui';
import { MiniLayout } from '@/components/Widgets';
import { colours, radius, space } from '@/constants/theme';
import { blankNumbers, useHomeLayout } from '@/lib/widgets';
import { MODE, type Mode } from '@/lib/mode';
import { useAuth } from '@/lib/auth';

export default function HomeShare() {
  const q = useLocalSearchParams<{ mode?: string }>();
  const mode: Mode = q.mode === 'business' ? 'business' : 'life';
  const { profile } = useAuth();
  const [layout] = useHomeLayout(mode);
  const [numbers, setNumbers] = useState(false);
  const [name, setName] = useState(`${profile?.first_name || 'My'}'s ${MODE[mode].label.toLowerCase()} HQ`);
  const shown = numbers ? layout : blankNumbers(layout);

  return (
    <Screen>
      <BackLink onPress={() => router.navigate(`/home-edit?mode=${mode}` as any)} label="Edit home" />
      <Title sub="Send it to a friend, a teammate or your followers. They can copy it into their own HQ.">Share your layout</Title>

      <View style={{ borderRadius: 24, padding: 16, backgroundColor: 'rgba(30,24,88,0.6)', borderWidth: 1, borderColor: colours.purple, marginBottom: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Ionicons name="planet-outline" size={18} color={colours.purple} />
          <Text style={{ color: colours.text, fontSize: 18, fontWeight: '800', flex: 1 }}>{name}</Text>
          <Text style={{ color: colours.faint, fontSize: 12 }}>{layout.filter((w) => !w.hidden).length} blocks</Text>
        </View>
        <MiniLayout widgets={shown} blank={!numbers} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.border, marginBottom: space.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colours.text, fontWeight: '800' }}>Show my numbers</Text>
          <Text style={{ color: colours.muted, fontSize: 12.5 }}>Off: they see the layout and targets only. On: they also see where you're at today.</Text>
        </View>
        <Switch value={numbers} onValueChange={setNumbers} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.input, backgroundColor: colours.sunk, borderWidth: 1, borderColor: colours.border, marginVertical: space.md }}>
        <Ionicons name="link" size={16} color={colours.purple} />
        <Text style={{ flex: 1, color: colours.text, fontSize: 14 }} selectable>talihq.com.au/hq/sam-7k2x</Text>
        <Pressable style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colours.purpleSoft }}><Text style={{ color: colours.purpleInk, fontWeight: '800' }}>Copy</Text></Pressable>
      </View>
      <Button title="Share" onPress={() => {}} />
      <Text style={{ color: colours.faint, fontSize: 12.5, marginTop: space.md, lineHeight: 18 }}>Nothing from your brain, journal, people or messages is ever in a shared layout. You can turn the link off any time.</Text>
      <View style={{ height: space.xl }} />
    </Screen>
  );
}
