// 9 Nov 2026 "life with a growing brain": the front door to her brain is your life, not her 13 parts.
// Memories grouped by what they are about you; the parts and the globe sit underneath for the curious.
// 10 Nov 2026 (Taj: "I can't click these to expand"): every card opens. Tap a card to see everything
// in it, tap a memory to read it in full, and Show more brings the next ten.
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Brain } from '@/lib/brain';
import { colours, radius, space } from '@/constants/theme';

const AREAS: { title: string; kinds: string[]; colour: string }[] = [
  { title: 'Your people', kinds: ['person', 'client', 'lead'], colour: '#8EF0C8' },
  { title: 'How you like things', kinds: ['preference', 'rule'], colour: '#9FB7FF' },
  { title: 'Your life and work', kinds: ['fact', 'event', 'note', 'email', 'journal', 'video'], colour: '#FFE38A' },
  { title: 'Plans and ideas', kinds: ['idea', 'plan', 'goal', 'decision'], colour: '#FFC37A' },
  { title: 'What she has learned', kinds: ['lesson', 'mistake', 'skill'], colour: '#D7B5FF' },
];

export function KnowsAbout({ brain, openGroup, openStamp }: { brain: Brain; openGroup?: string; openStamp?: string }) {
  const items = brain.regions.flatMap((r) => r.items);
  const [open, setOpen] = useState<string | null>(openGroup && AREAS.some((a) => a.title === openGroup) ? openGroup : null);
  // Arriving from a "New memory" pill in Talk: open that group.
  useEffect(() => {
    if (openGroup && AREAS.some((a) => a.title === openGroup)) { setOpen(openGroup); setShown(10); setFull(null); }
  }, [openGroup, openStamp]);
  const [shown, setShown] = useState(10);
  const [full, setFull] = useState<number | null>(null);
  return (
    <View style={{ gap: 10, marginBottom: space.lg }}>
      {AREAS.map((a) => {
        const list = items.filter((i) => a.kinds.includes(i.kind));
        if (!list.length) return null;
        const isOpen = open === a.title;
        const rows = isOpen ? list.slice(0, shown) : list.slice(0, 2);
        return (
          <View key={a.title} style={{ backgroundColor: a.colour + '26', borderRadius: radius.card, borderWidth: 1, borderColor: a.colour + (isOpen ? 'CC' : '88'), shadowColor: a.colour, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } }}>
            <Pressable
              onPress={() => { setOpen(isOpen ? null : a.title); setShown(10); setFull(null); }}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              accessibilityLabel={`${a.title}, ${list.length} ${list.length === 1 ? 'memory' : 'memories'}`}
              style={{ padding: space.lg, paddingBottom: isOpen ? space.sm : space.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: a.colour, shadowColor: a.colour, shadowOpacity: 1, shadowRadius: 8 }} />
                <Text style={{ flex: 1, color: colours.text, fontSize: 22, fontFamily: 'InstrumentSerif_400Regular' }}>{a.title}</Text>
                <Text style={{ color: colours.muted, fontSize: 13 }}>{list.length}</Text>
                <Text style={{ color: a.colour, fontSize: 18, fontWeight: '700', width: 14, textAlign: 'center' }}>{isOpen ? '−' : '+'}</Text>
              </View>
              {!isOpen ? rows.map((it, k) => (
                <Text key={k} style={{ color: colours.muted, fontSize: 14, lineHeight: 20, marginTop: 8 }} numberOfLines={2}>{it.text}</Text>
              )) : null}
              {!isOpen && list.length > 2 ? <Text style={{ color: a.colour, fontSize: 13, fontWeight: '700', marginTop: 10 }}>See all {list.length}</Text> : null}
            </Pressable>
            {isOpen ? (
              <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}>
                {rows.map((it, k) => (
                  <Pressable key={k} onPress={() => setFull(full === k ? null : k)} accessibilityRole="button" style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: a.colour + '33' }}>
                    <Text style={{ color: colours.text, fontSize: 14.5, lineHeight: 21 }} numberOfLines={full === k ? undefined : 3}>{it.text}</Text>
                  </Pressable>
                ))}
                {list.length > shown ? (
                  <Pressable onPress={() => setShown((n) => n + 10)} accessibilityRole="button" style={{ alignSelf: 'flex-start', marginTop: 10, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: a.colour + '88' }}>
                    <Text style={{ color: a.colour, fontSize: 13, fontWeight: '700' }}>Show more ({list.length - shown} left)</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
