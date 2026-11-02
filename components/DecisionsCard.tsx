// Decisions on Today (3 Nov 2026): the last two decisions, tap to open the log. All plans, 0 credits.
// Renders nothing until there is at least one decision. Mount on Today under a <Label>Decisions</Label>,
// after Your morning brief.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { decisions as loadDecisions, type Decision } from '@/lib/decisions';
import { friendlyDate } from '@/lib/dates';
import { Card } from '@/components/ui';
import { colours, space } from '@/constants/theme';

export function DecisionsCard() {
  const [list, setList] = useState<Decision[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadDecisions(2).then((d) => setList(d.slice(0, 2))).catch(() => setList([]));
    }, []),
  );

  if (!list.length) return null;

  return (
    <Pressable onPress={() => router.navigate('/decisions')} accessibilityRole="button">
      <Card>
        {list.map((d, i) => (
          <View key={d.id} style={{ paddingTop: i ? space.md : 0, marginTop: i ? space.md : 0, borderTopWidth: i ? 1 : 0, borderTopColor: colours.border }}>
            <Text style={{ fontSize: 12, color: colours.muted, fontWeight: '700' }}>{friendlyDate(d.decided_at)}</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colours.text, marginTop: 2, lineHeight: 21 }} numberOfLines={2}>{d.decision}</Text>
            {d.reasoning ? <Text style={{ fontSize: 13, color: colours.muted, marginTop: 2, lineHeight: 18 }} numberOfLines={2}>{d.reasoning}</Text> : null}
          </View>
        ))}
        <Text style={{ fontSize: 13, color: colours.purple, fontWeight: '700', marginTop: space.md }}>Open the decision log {'›'}</Text>
      </Card>
    </Pressable>
  );
}
