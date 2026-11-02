// Today's week card (3 Nov 2026). Self loading, so Today mounts it with one line:
//   <WeekCard credits={credits} />
// This week's three commitments with tick boxes, and on the review day (and after it, until the
// review is done) a "Do your weekly review" button. Free users see the card with a line and a
// Plans button. Renders nothing for paid users with no commitments outside review time.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { myCredits, type Credits } from '@/lib/data';
import { isPaid } from '@/lib/plan';
import { commitmentsFor, isReviewDayOrLater, reviewFor, reviewWeekStart, rhythmSettings, thisWeekStart, toggleCommitment, type Commitment } from '@/lib/rhythm';
import { Card, Label } from '@/components/ui';
import { colours, elevation, radius, space } from '@/constants/theme';

export type WeekCardState = { paid: boolean; commitments: Commitment[]; reviewDue: boolean; loaded: boolean };

const realNow = () => new Date();

export function useWeekCard(credits?: Credits | null, now: () => Date = realNow): WeekCardState & { reload: () => void; tick: (c: Commitment) => Promise<void> } {
  const [state, setState] = useState<WeekCardState>({ paid: false, commitments: [], reviewDue: false, loaded: false });

  const reload = useCallback(async () => {
    try {
      const c = credits === undefined ? await myCredits().catch(() => null) : credits;
      const paid = isPaid(c);
      if (!paid) return setState({ paid: false, commitments: [], reviewDue: false, loaded: true });
      const s = await rhythmSettings();
      const [commitments, last] = await Promise.all([commitmentsFor(thisWeekStart()), reviewFor(reviewWeekStart(s.review_day, now()))]);
      setState({ paid, commitments, reviewDue: !last && isReviewDayOrLater(s.review_day, s.review_time.slice(0, 5), now()), loaded: true });
    } catch {
      setState((x) => ({ ...x, loaded: true }));
    }
  }, [credits, now]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const tick = useCallback(async (c: Commitment) => {
    const done = !c.done_at;
    setState((x) => ({ ...x, commitments: x.commitments.map((k) => (k.id === c.id ? { ...k, done_at: done ? new Date().toISOString() : null } : k)) }));
    await toggleCommitment(c.id, done).catch(() => reload());
  }, [reload]);

  return { ...state, reload, tick };
}

export function WeekCard({ credits, now }: { credits?: Credits | null; now?: () => Date }) {
  const s = useWeekCard(credits, now);
  if (!s.loaded) return null;
  if (s.paid && !s.commitments.length && !s.reviewDue) return null;
  return (
    <>
      <View style={{ height: space.sm }} />
      <Label>Your week</Label>
      <WeekCardView paid={s.paid} commitments={s.commitments} reviewDue={s.reviewDue} onTick={s.tick} />
    </>
  );
}

// The card itself, with no loading, for Today and for tests.
export function WeekCardView({ paid, commitments, reviewDue, onTick }: { paid: boolean; commitments: Commitment[]; reviewDue: boolean; onTick: (c: Commitment) => void }) {
  if (!paid) {
    return (
      <Card>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text }}>Weekly review is part of Tali HQ</Text>
        <Text style={{ fontSize: 13, color: colours.muted, marginTop: 2, lineHeight: 18 }}>Ten minutes a week: what moved, the money, who went quiet, and your three for next week.</Text>
        <Pressable onPress={() => router.navigate('/plans')} accessibilityRole="button" style={{ alignSelf: 'flex-start', marginTop: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colours.borderStrong, paddingVertical: 8, paddingHorizontal: 14 }}>
          <Text style={{ color: colours.text, fontWeight: '700' }}>Plans</Text>
        </Pressable>
      </Card>
    );
  }
  const done = commitments.filter((c) => c.done_at).length;
  return (
    <Card>
      {commitments.length ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text }}>Your three this week</Text>
            <Text style={{ fontSize: 12, color: done === commitments.length ? colours.good : colours.muted, fontWeight: '700' }}>{done} of {commitments.length}</Text>
          </View>
          {commitments.map((c, i) => (
            <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colours.border }}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: !!c.done_at }}
                accessibilityLabel={`Done: ${c.text}`}
                onPress={() => onTick(c)}
                hitSlop={8}
                style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colours.purple, backgroundColor: c.done_at ? colours.purple : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {c.done_at ? <Text style={{ color: colours.onPurple, fontWeight: '800', fontSize: 14 }}>✓</Text> : null}
              </Pressable>
              <Text style={{ flex: 1, fontSize: 15, lineHeight: 21, color: c.done_at ? colours.muted : colours.text, textDecorationLine: c.done_at ? 'line-through' : 'none' }}>{c.text}</Text>
            </View>
          ))}
        </>
      ) : null}
      {reviewDue ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: commitments.length ? space.md : 0, paddingTop: commitments.length ? space.md : 0, borderTopWidth: commitments.length ? 1 : 0, borderTopColor: colours.border }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colours.text }}>Your week, in ten minutes</Text>
            <Text style={{ fontSize: 13, color: colours.muted, marginTop: 2, lineHeight: 18 }}>Tali has the week ready. Come and set your next three.</Text>
          </View>
          <Pressable
            onPress={() => router.navigate('/review')}
            accessibilityRole="button"
            hitSlop={8}
            style={{ backgroundColor: colours.purple, borderRadius: radius.pill, paddingVertical: 9, paddingHorizontal: 14, ...elevation.button(colours.purple) }}>
            <Text style={{ color: colours.onPurple, fontWeight: '700' }}>Review</Text>
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}
