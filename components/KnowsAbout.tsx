// 9 Nov 2026 "life with a growing brain": the front door to her brain is your life, not her 13 parts.
// Memories grouped by what they are about you; the parts and the globe sit underneath for the curious.
import { Text, View } from 'react-native';
import type { Brain } from '@/lib/brain';
import { colours, radius, space } from '@/constants/theme';

const AREAS: { title: string; kinds: string[]; colour: string }[] = [
  { title: 'Your people', kinds: ['person', 'client', 'lead'], colour: '#8EF0C8' },
  { title: 'How you like things', kinds: ['preference', 'rule'], colour: '#9FB7FF' },
  { title: 'Your life and work', kinds: ['fact', 'event', 'note', 'email', 'journal', 'video'], colour: '#FFE38A' },
  { title: 'Plans and ideas', kinds: ['idea', 'plan', 'goal', 'decision'], colour: '#FFC37A' },
  { title: 'What she has learned', kinds: ['lesson', 'mistake', 'skill'], colour: '#D7B5FF' },
];

export function KnowsAbout({ brain }: { brain: Brain }) {
  const items = brain.regions.flatMap((r) => r.items);
  return (
    <View style={{ gap: 10, marginBottom: space.lg }}>
      {AREAS.map((a) => {
        const list = items.filter((i) => a.kinds.includes(i.kind));
        if (!list.length) return null;
        return (
          <View key={a.title} style={{ backgroundColor: a.colour + '26', borderRadius: radius.card, borderWidth: 1, borderColor: a.colour + '88', padding: space.lg, shadowColor: a.colour, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: a.colour, shadowColor: a.colour, shadowOpacity: 1, shadowRadius: 8 }} />
              <Text style={{ flex: 1, color: colours.text, fontSize: 22, fontFamily: 'InstrumentSerif_400Regular' }}>{a.title}</Text>
              <Text style={{ color: colours.muted, fontSize: 13 }}>{list.length}</Text>
            </View>
            {list.slice(0, 2).map((it, k) => (
              <Text key={k} style={{ color: colours.muted, fontSize: 14, lineHeight: 20, marginTop: 8 }} numberOfLines={2}>{it.text}</Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}
