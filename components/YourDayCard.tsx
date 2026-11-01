import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { LifeSummary } from '@/lib/data';
import { Card } from '@/components/ui';
import { colours, radius, space } from '@/constants/theme';

// Today's food (Tali's estimates), today's session and the week, all logged by chatting with Tali.
export function YourDayCard({ life, onTick }: { life: LifeSummary; onTick: () => void }) {
  const f = life.food_today;
  const hasFood = f.items > 0;
  const hasPlan = life.sessions_planned > 0;
  const change = life.weight && life.weight_week_ago ? Math.round((life.weight.kg - life.weight_week_ago) * 10) / 10 : null;

  return (
    <Pressable onPress={() => router.navigate('/life')} accessibilityRole="button">
      <Card>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Text style={small}>Food today</Text>
            {hasFood ? (
              <>
                <Text style={big}>about {Math.round(f.calories).toLocaleString('en-AU')} cal</Text>
                <Text style={muted}>{Math.round(f.protein_g)}g protein</Text>
              </>
            ) : (
              <Text style={muted}>Tell Tali what you ate</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={small}>Weight</Text>
            {life.weight ? (
              <>
                <Text style={big}>{life.weight.kg} kg</Text>
                {change !== null ? <Text style={muted}>{change > 0 ? '+' : ''}{change} kg this week</Text> : null}
              </>
            ) : (
              <Text style={muted}>Not logged yet</Text>
            )}
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: colours.border, marginVertical: space.md }} />

        {hasPlan ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Text style={small}>Training today</Text>
              <Text style={big}>{life.today_session ?? 'Rest day'}</Text>
              <Text style={muted}>
                {life.sessions_done_this_week} of {life.sessions_planned} this week{life.streak_weeks ? `, ${life.streak_weeks} week streak` : ''}
              </Text>
            </View>
            {life.today_session && !life.today_done ? (
              <Pressable onPress={onTick} accessibilityRole="button" hitSlop={8}
                style={{ backgroundColor: colours.purple, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14 }}>
                <Text style={{ color: colours.onPurple, fontWeight: '700' }}>Done</Text>
              </Pressable>
            ) : life.today_done ? (
              <Text style={{ color: colours.good, fontWeight: '800' }}>Done {'✓'}</Text>
            ) : null}
          </View>
        ) : (
          <Text style={muted}>No training plan yet. Ask Tali: "write me a 4 day gym programme".</Text>
        )}
        {hasFood ? <Text style={{ fontSize: 11, color: colours.faint, marginTop: space.sm }}>Food numbers are Tali's estimates.</Text> : null}
      </Card>
    </Pressable>
  );
}

const small = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.6, textTransform: 'uppercase' as const, color: colours.muted };
const big = { fontSize: 18, fontWeight: '800' as const, color: colours.text, marginTop: 2 };
const muted = { fontSize: 13, color: colours.muted, marginTop: 2 };
