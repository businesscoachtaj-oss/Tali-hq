import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  deleteFood,
  deleteWorkout,
  foodOn,
  lifeSummary,
  logWorkout,
  trainingPlan,
  weights,
  workoutsSince,
  type FoodLog,
  type LifeSummary,
  type TrainingPlan,
  type WeightLog,
  type WorkoutLog,
} from '@/lib/data';
import { addDays, friendlyDate, isoDate, today } from '@/lib/dates';
import { BackLink, Body, Button, Card, ErrorText, Label, Screen, TaliSays, Title, goBack } from '@/components/ui';
import { SkinHeader } from '@/components/PageSkin';
import { colours, radius, space } from '@/constants/theme';

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Life() {
  const [date, setDate] = useState(today());
  const [life, setLife] = useState<LifeSummary | null>(null);
  const [food, setFood] = useState<FoodLog[]>([]);
  const [wts, setWts] = useState<WeightLog[]>([]);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (d = date) => {
    setError('');
    try {
      const weekStart = isoDate(addDays(new Date(), -((new Date().getDay() + 6) % 7)));
      const [l, f, w, p, wo] = await Promise.all([lifeSummary(), foodOn(d), weights(14), trainingPlan(), workoutsSince(weekStart)]);
      setLife(l);
      setFood(f);
      setWts(w);
      setPlan(p);
      setWorkouts(wo);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load.');
    }
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function shift(n: number) {
    const d = isoDate(addDays(new Date(`${date}T12:00:00`), n));
    if (d > today()) return;
    setDate(d);
    load(d);
  }

  async function removeFood(id: string) {
    if (confirm !== id) return setConfirm(id);
    setConfirm(null);
    try {
      await deleteFood(id);
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Could not delete.');
    }
  }

  async function removeWorkout(id: string) {
    if (confirm !== id) return setConfirm(id);
    setConfirm(null);
    try {
      await deleteWorkout(id);
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Could not delete.');
    }
  }

  async function tick() {
    if (!life?.today_session) return;
    try {
      await logWorkout(today(), life.today_session);
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Could not log that.');
    }
  }

  const totals = food.reduce((t, f) => ({ cal: t.cal + f.calories, p: t.p + f.protein_g, c: t.c + f.carbs_g, fat: t.fat + f.fat_g }), { cal: 0, p: 0, c: 0, fat: 0 });
  const todayWeekday = ((new Date().getDay() + 6) % 7) + 1;
  const hasPlan = !!plan && plan.days.length > 0;
  const tali = !food.length && !wts.length && !hasPlan
    ? "Just tell me in Talk what you ate, what you weigh or how you trained, and I'll keep it all here. Rough is fine, I'll estimate."
    : food.length
      ? `About ${Math.round(totals.cal).toLocaleString('en-AU')} cal and ${Math.round(totals.p)}g protein ${date === today() ? 'so far today' : 'that day'}.`
      : "Tell me what you've eaten and I'll add it up.";

  return (
    <Screen skin="gym">
      <SkinHeader id="gym" title="Food and training" sub="Logged by chatting with Tali. Tell her what you ate, what you weigh or that you trained." onBack={() => goBack('/')} />
      <ErrorText>{error}</ErrorText>

      {/* One Tali for the page (3 Nov 2026, Taj: three Talis was a lot). Sections below use plain hints. */}
      <TaliSays pose="idle">{tali}</TaliSays>

      {/* ---------- Food ---------- */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Label>Food</Label>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: 6 }}>
          <Pressable onPress={() => shift(-1)} hitSlop={10}><Text style={arrow}>{'‹'}</Text></Pressable>
          <Text style={{ fontWeight: '700', color: colours.text, minWidth: 80, textAlign: 'center' }}>{friendlyDate(date)}</Text>
          <Pressable onPress={() => shift(1)} hitSlop={10} disabled={date >= today()}><Text style={[arrow, date >= today() && { color: colours.border }]}>{'›'}</Text></Pressable>
        </View>
      </View>
      {food.length ? (
      <Card style={{ backgroundColor: colours.sunk }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colours.text }}>about {Math.round(totals.cal).toLocaleString('en-AU')} cal</Text>
        <Text style={{ color: colours.muted, marginTop: 2 }}>
          {Math.round(totals.p)}g protein, {Math.round(totals.c)}g carbs, {Math.round(totals.fat)}g fat
        </Text>
        <Text style={{ fontSize: 11, color: colours.faint, marginTop: 6 }}>Tali's estimates from what you told her, not exact.</Text>
      </Card>
      ) : null}
      {food.length === 0 ? (
        <Hint>{date === today() ? 'Nothing logged yet today. Try "two eggs on toast and a flat white" in Talk.' : 'Nothing logged that day.'}</Hint>
      ) : (
        MEALS.filter((m) => food.some((f) => f.meal === m)).map((m) => (
          <Card key={m} style={{ paddingVertical: space.md }}>
            <Text style={{ fontWeight: '800', color: colours.text, marginBottom: 4 }}>{MEAL_LABEL[m]}</Text>
            {food.filter((f) => f.meal === m).map((f) => (
              <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colours.text, fontSize: 15 }}>{f.description}</Text>
                  <Text style={{ color: colours.muted, fontSize: 12 }}>about {f.calories} cal, {Math.round(f.protein_g)}g protein</Text>
                </View>
                <Pressable onPress={() => removeFood(f.id)} hitSlop={8}>
                  <Text style={{ color: confirm === f.id ? colours.danger : colours.faint, fontWeight: '700', fontSize: 12 }}>{confirm === f.id ? 'Sure?' : 'Delete'}</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        ))
      )}

      {/* ---------- Weight ---------- */}
      <View style={{ height: space.md }} />
      <Label>Weight</Label>
      {wts.length === 0 ? (
        <Hint>Nothing yet. Try "82.4 this morning" in Talk and the trend shows here.</Hint>
      ) : (
        <Card>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colours.text }}>{wts[0].kg} kg</Text>
          <Text style={{ color: colours.muted }}>{friendlyDate(wts[0].local_date)}</Text>
          <WeightBars data={[...wts].reverse()} />
        </Card>
      )}

      {/* ---------- Training ---------- */}
      <View style={{ height: space.md }} />
      <Label>{plan?.name || 'Training'}</Label>
      {!plan || plan.days.length === 0 ? (
        <Hint>No plan yet. Try "write me a 3 day full body programme" in Talk.</Hint>
      ) : (
        <>
          <Card>
            <Text style={{ color: colours.muted, marginBottom: space.sm }}>
              {life?.sessions_done_this_week ?? 0} of {life?.sessions_planned ?? 0} sessions this week{life?.streak_weeks ? `. ${life.streak_weeks} week streak, nice.` : ''}
            </Text>
            {DAYS.map((name, i) => {
              const d = plan.days.find((x) => x.weekday === i + 1);
              const isToday = i + 1 === todayWeekday;
              const done = workouts.some((w) => new Date(`${w.local_date}T12:00:00`).getDay() === (i + 1) % 7);
              return (
                <Pressable key={name} onPress={() => setOpenDay(openDay === i + 1 ? null : i + 1)} style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colours.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                    <Text style={{ width: 36, fontWeight: '800', color: isToday ? colours.purple : colours.muted }}>{name}</Text>
                    <Text style={{ flex: 1, fontSize: 15, color: d && d.label.toLowerCase() !== 'rest' ? colours.text : colours.faint, fontWeight: isToday ? '700' : '400' }}>{d?.label ?? 'Rest'}</Text>
                    {done ? <Text style={{ color: colours.good, fontWeight: '800' }}>{'✓'}</Text> : null}
                  </View>
                  {openDay === i + 1 && d?.notes ? <Text style={{ color: colours.muted, fontSize: 14, lineHeight: 20, marginTop: 6, marginLeft: 48 }}>{d.notes}</Text> : null}
                </Pressable>
              );
            })}
          </Card>
          {life?.today_session && !life.today_done ? <Button title={`Done: ${life.today_session}`} onPress={tick} /> : null}
        </>
      )}

      {workouts.length ? (
        <>
          <View style={{ height: space.md }} />
          <Label>This week</Label>
          {workouts.map((w) => (
            <Card key={w.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: colours.text }}>{w.label}</Text>
                <Text style={{ color: colours.muted, fontSize: 13 }}>{friendlyDate(w.local_date)}{w.notes ? `, ${w.notes}` : ''}</Text>
              </View>
              <Pressable onPress={() => removeWorkout(w.id)} hitSlop={8}>
                <Text style={{ color: confirm === w.id ? colours.danger : colours.faint, fontWeight: '700', fontSize: 12 }}>{confirm === w.id ? 'Sure?' : 'Delete'}</Text>
              </Pressable>
            </Card>
          ))}
        </>
      ) : null}

      <Button title="Talk to Tali" kind="ghost" onPress={() => router.navigate('/talk')} />
    </Screen>
  );
}

function WeightBars({ data }: { data: WeightLog[] }) {
  if (data.length < 2) return null;
  const min = Math.min(...data.map((d) => d.kg)) - 0.5;
  const max = Math.max(...data.map((d) => d.kg)) + 0.5;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 60, marginTop: space.md }}>
      {data.map((d) => (
        <View key={d.id} style={{ flex: 1, height: `${Math.max(8, ((d.kg - min) / (max - min)) * 100)}%`, backgroundColor: colours.purpleSoft, borderRadius: radius.input / 2, borderTopWidth: 3, borderTopColor: colours.purple }} />
      ))}
    </View>
  );
}

const arrow = { fontSize: 22, fontWeight: '700' as const, color: colours.purple };

// A quiet empty-state line for a section, so Tali only appears once on the page.
function Hint({ children }: { children: string }) {
  return (
    <Card style={{ backgroundColor: colours.sunk, paddingVertical: space.md }}>
      <Text style={{ color: colours.muted, fontSize: 14, lineHeight: 20 }}>{children}</Text>
    </Card>
  );
}
