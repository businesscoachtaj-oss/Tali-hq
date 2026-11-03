// Today's goals card (3 Nov 2026). Self loading, so Today mounts it with one line:
//   <GoalsCard credits={credits} />
// Up to three active goals with progress and days left. Tap opens Goals. Renders nothing on Free
// (Goals are part of Tali HQ; the Goals screen itself explains that) and when there are no goals.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { myCredits, type Credits } from '@/lib/data';
import { isPaid } from '@/lib/plan';
import { activeGoals, behindPace, daysLeft, goalLine, goalProgress, type Goal } from '@/lib/rhythm';
import { Card, Label } from '@/components/ui';
import { colours, space } from '@/constants/theme';

export function useGoalsCard(credits?: Credits | null) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const reload = useCallback(async () => {
    try {
      const c = credits === undefined ? await myCredits().catch(() => null) : credits;
      setGoals(isPaid(c) ? await activeGoals(3) : []);
    } catch {
      setGoals([]);
    }
  }, [credits]);
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  return { goals, reload };
}

export function GoalsCard({ credits }: { credits?: Credits | null }) {
  const { goals } = useGoalsCard(credits);
  if (!goals.length) return null;
  return (
    <>
      <View style={{ height: space.sm }} />
      <Label>Goals</Label>
      <GoalsCardView goals={goals} />
    </>
  );
}

// The card itself, with no loading, for Today and for tests.
export function GoalsCardView({ goals }: { goals: Goal[] }) {
  return (
    <Pressable onPress={() => router.navigate('/goals')} accessibilityRole="button">
      <Card>
        {goals.map((g, i) => {
          const p = goalProgress(g);
          const left = daysLeft(g);
          const behind = behindPace(g);
          return (
            <View key={g.id} style={{ paddingVertical: space.sm, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colours.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: '700', color: colours.text }}>{g.title}</Text>
                {left !== null ? (
                  <Text style={{ fontSize: 12, fontWeight: '700', color: behind ? colours.orange : colours.muted }}>
                    {left < 0 ? `${-left}d over` : left === 0 ? 'due today' : `${left}d left`}
                  </Text>
                ) : null}
              </View>
              <Text style={{ fontSize: 13, color: colours.muted, marginTop: 1 }}>{goalLine(g)}{behind ? ', behind pace' : ''}</Text>
              {p !== null ? (
                <View style={{ height: 6, backgroundColor: colours.sunk, borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.round(p * 100)}%`, height: 6, backgroundColor: behind ? colours.orange : colours.purple, borderRadius: 3 }} />
                </View>
              ) : null}
            </View>
          );
        })}
        <Text style={{ fontSize: 12, color: colours.faint, marginTop: space.sm }}>Tap to update or add a goal.</Text>
      </Card>
    </Pressable>
  );
}
