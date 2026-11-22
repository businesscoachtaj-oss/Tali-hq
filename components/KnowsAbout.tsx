// 9 Nov 2026 "life with a growing brain": the front door to her brain is your life, not her 13 parts.
// Memories grouped by what they are about you; the parts and the globe sit underneath for the curious.
// 10 Nov 2026 (Taj: "I can't click these to expand"): every card opens. Tap a card to see everything
// in it, tap a memory to read it in full, and Show more brings the next ten.
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Brain } from '@/lib/brain';
import { colours, radius, space } from '@/constants/theme';

const AREAS: { title: string; kinds: string[]; colour: string }[] = [
  { title: 'Your people', kinds: ['person', 'client', 'lead'], colour: '#2E7D4F' },
  { title: 'How you like things', kinds: ['preference', 'rule'], colour: '#3B3F9E' },
  { title: 'Your life and work', kinds: ['fact', 'event', 'note', 'email', 'journal', 'video'], colour: '#A8841C' },
  { title: 'Plans and ideas', kinds: ['idea', 'plan', 'goal', 'decision'], colour: '#A8561A' },
  { title: 'What she has learned', kinds: ['lesson', 'mistake', 'skill'], colour: '#8A4FB8' },
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
    // 23 Nov 2026 (paper and ink): a ruled list, like the contents page of a book.
    <View style={{ marginBottom: space.lg, borderTopWidth: 1, borderTopColor: colours.ink }}>
      {AREAS.map((a) => {
        const list = items.filter((i) => a.kinds.includes(i.kind));
        if (!list.length) return null;
        const isOpen = open === a.title;
        const rows = isOpen ? list.slice(0, shown) : list.slice(0, 2);
        return (
          <View key={a.title} style={{ borderBottomWidth: 1, borderBottomColor: colours.border }}>
            <Pressable
              onPress={() => { setOpen(isOpen ? null : a.title); setShown(10); setFull(null); }}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              accessibilityLabel={`${a.title}, ${list.length} ${list.length === 1 ? 'memory' : 'memories'}`}
              style={{ paddingVertical: 14, paddingBottom: isOpen ? space.sm : 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: a.colour }} />
                <Text style={{ flex: 1, color: colours.text, fontSize: 22, fontFamily: 'EBGaramond_500Medium' }}>{a.title}</Text>
                <Text style={{ color: colours.muted, fontSize: 13 }}>{list.length}</Text>
                <Text style={{ color: a.colour, fontSize: 18, fontWeight: '700', width: 14, textAlign: 'center' }}>{isOpen ? '−' : '+'}</Text>
              </View>
              {!isOpen ? rows.map((it, k) => (
                <Text key={k} style={{ color: colours.muted, fontSize: 14, lineHeight: 20, marginTop: 8 }} numberOfLines={2}>{it.text}</Text>
              )) : null}
              {!isOpen && list.length > 2 ? <Text style={{ color: a.colour, fontSize: 13, fontWeight: '700', marginTop: 10 }}>See all {list.length}</Text> : null}
            </Pressable>
            {isOpen ? (
              <View style={{ paddingLeft: 19, paddingBottom: space.md }}>
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
