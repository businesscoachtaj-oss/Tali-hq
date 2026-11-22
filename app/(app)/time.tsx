// 23 Nov 2026 (Taj: "I really love the weeks as a reminder... more stuff like that, even on its own
// separate reminders page. You only get 4000 weeks, you only get x amount of chances to tell them how
// you feel"). Your time: a few honest counts from your birthday and the people you add, each with a
// short thought from Tali. Every number is an average and says so. Opened from the Journal's life in
// weeks card and from Me.
import { useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { supabase } from '@/lib/supabase';
import { OFTEN, RELATIONS, addTimePerson, ageFrom, myTimePeople, removeTimePerson, round, visitsLeft, yearsLeftAt, type Often, type Relation, type TimePerson } from '@/lib/time';
import { COLS, WeeksOfLife, YEARS, weeksLived } from '@/components/WeeksOfLife';
import { SkinHeader } from '@/components/PageSkin';
import { Screen, goBack } from '@/components/ui';
import { colours, radius, space } from '@/constants/theme';

const fmt = (n: number) => round(n).toLocaleString('en-AU');

function Count({ kicker, big, line, thought }: { kicker: string; big: string; line: string; thought: string }) {
  return (
    <View style={{ paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: colours.border }}>
      <Text style={{ color: colours.purple, fontSize: 11, fontWeight: '800', letterSpacing: 1.8 }}>{kicker}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
        <Text style={{ color: colours.text, fontSize: 46, lineHeight: 52, fontFamily: 'EBGaramond_500Medium' }}>{big}</Text>
        <Text style={{ color: colours.text, fontSize: 19, lineHeight: 25, flexShrink: 1, fontFamily: 'EBGaramond_500Medium' }}>{line}</Text>
      </View>
      <Text style={{ color: colours.muted, fontSize: 16, lineHeight: 23, marginTop: 6, fontFamily: 'EBGaramond_400Regular_Italic' }}>{thought}</Text>
    </View>
  );
}

function PersonCount({ p, myYears, onRemove }: { p: TimePerson; myYears: number; onRemove: () => void }) {
  const child = p.relation === 'Child';
  const n = child ? Math.max(0, Math.round((18 - p.age) * 52)) : visitsLeft(p, myYears);
  const often = OFTEN[p.often].label.toLowerCase();
  return (
    <View style={{ paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: colours.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, color: colours.purple, fontSize: 11, fontWeight: '800', letterSpacing: 1.8 }}>{`${p.name.toUpperCase()}, ${p.age}`}{child ? '' : `  ·  ${often.toUpperCase()}`}</Text>
        <Pressable onPress={onRemove} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Take ${p.name} off`}>
          <Text style={{ color: colours.faint, fontSize: 12, textDecorationLine: 'underline' }}>Take off</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
        <Text style={{ color: colours.text, fontSize: 46, lineHeight: 52, fontFamily: 'EBGaramond_500Medium' }}>{fmt(n)}</Text>
        <Text style={{ color: colours.text, fontSize: 19, lineHeight: 25, flexShrink: 1, fontFamily: 'EBGaramond_500Medium' }}>
          {child ? `more weekends before ${p.name} turns 18.` : n === 1 ? 'more time together, on the averages.' : 'more times together, on the averages.'}
        </Text>
      </View>
      <Text style={{ color: colours.muted, fontSize: 16, lineHeight: 23, marginTop: 6, fontFamily: 'EBGaramond_400Regular_Italic' }}>
        {child
          ? `Most of the time you'll ever spend with ${p.name} happens in these years. After that the weekends are theirs, and you'll be glad of every one they give you.`
          : `That's about ${fmt(n)} more chances to tell ${p.name} how you feel. Seeing them a little more often is the one way to make this number bigger.`}
      </Text>
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? colours.ink : colours.border, backgroundColor: on ? colours.ink : colours.surface }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: on ? colours.bg : colours.text }}>{label}</Text>
    </Pressable>
  );
}

function AddPerson({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState('');
  const [relation, setRelation] = useState<Relation>('Mum');
  const [age, setAge] = useState('');
  const [often, setOften] = useState<Often>('monthly');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const add = async () => {
    const a = Number(age);
    if (!name.trim()) { setErr('Add their name.'); return; }
    if (!Number.isFinite(a) || a < 0 || a > 115) { setErr('Add their age in years.'); return; }
    setErr(null); setBusy(true);
    try { await addTimePerson({ name: name.trim(), relation, age: Math.round(a), often }); setName(''); setAge(''); onAdded(); }
    catch { setErr("That didn't save. Try again in a moment."); }
    finally { setBusy(false); }
  };
  const field = { borderWidth: 1, borderColor: colours.ink, borderRadius: radius.input, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colours.text, backgroundColor: colours.bg } as const;
  return (
    <View style={{ marginTop: space.lg, padding: space.md, backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.ink, borderRadius: radius.card }}>
      <Text style={{ color: colours.text, fontSize: 21, fontFamily: 'EBGaramond_500Medium' }}>Add someone you love</Text>
      <Text style={{ color: colours.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }}>Tali works out roughly how many more times you'll see them. Only you see this.</Text>
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
        <TextInput value={name} onChangeText={setName} placeholder="Their name" placeholderTextColor={colours.faint} style={[field, { flex: 2 }]} accessibilityLabel="Their name" />
        <TextInput value={age} onChangeText={setAge} placeholder="Age" placeholderTextColor={colours.faint} keyboardType="number-pad" maxLength={3} style={[field, { flex: 1 }]} accessibilityLabel="Their age" />
      </View>
      <Text style={{ color: colours.text, fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginTop: space.md, marginBottom: 8 }}>WHO THEY ARE</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {RELATIONS.map((r) => <Chip key={r} label={r} on={relation === r} onPress={() => setRelation(r)} />)}
      </View>
      {relation !== 'Child' ? (
        <>
          <Text style={{ color: colours.text, fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginTop: space.md, marginBottom: 8 }}>HOW OFTEN YOU SEE THEM</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(Object.keys(OFTEN) as Often[]).map((o) => <Chip key={o} label={OFTEN[o].label} on={often === o} onPress={() => setOften(o)} />)}
          </View>
        </>
      ) : null}
      <Pressable onPress={add} disabled={busy} accessibilityRole="button" style={{ marginTop: space.md, backgroundColor: colours.ink, borderRadius: radius.pill, paddingVertical: 13, alignItems: 'center', opacity: busy ? 0.5 : 1 }}>
        <Text style={{ color: colours.bg, fontWeight: '800', fontSize: 13, letterSpacing: 1.2 }}>ADD</Text>
      </Pressable>
      {err ? <Text style={{ color: colours.danger, fontSize: 12.5, marginTop: 6 }}>{err}</Text> : null}
    </View>
  );
}

export default function YourTime() {
  const [birth, setBirth] = useState<string | null | undefined>(undefined);
  const [people, setPeople] = useState<TimePerson[]>([]);
  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase.from('profiles').select('birth_date').eq('id', u.user.id).maybeSingle();
    setBirth((data as { birth_date: string | null } | null)?.birth_date ?? null);
    setPeople(await myTimePeople());
  }, []);
  useFocusLoad(load);

  const total = YEARS * COLS;
  const weeksLeft = birth ? Math.max(0, total - weeksLived(birth)) : 0;
  const years = weeksLeft / 52;
  const age = birth ? ageFrom(birth) : 0;

  return (
    <Screen skin="time" onRefresh={load}>
      <SkinHeader id="time" title="Your time" sub="A few honest counts, worked out from your birthday and the people you add. Use them to decide what this week is for." onBack={() => goBack('/journal')} />

      {birth === null ? <WeeksOfLife /> : null}

      {birth ? (
        <View style={{ borderTopWidth: 1, borderTopColor: colours.ink }}>
          <Count kicker="YOUR WEEKS" big={weeksLeft.toLocaleString('en-AU')} line="weeks left in an average life."
            thought="About four thousand is all anyone gets. The ones that count are rarely the busy ones. They're the weeks you meant." />
          <Count kicker="YOUR SUMMERS" big={fmt(years)} line="more summers, and as many Christmases."
            thought="Each one comes round once a year, which makes them easy to waste and hard to get back. Plan one thing for the next one now." />
          <Count kicker="YOUR MORNINGS" big={fmt(years * 365.25)} line="more mornings to wake up to."
            thought="How you spend the first hour tends to decide the rest. Tomorrow's first hour is the easiest one to change." />
          <Count kicker="YOUR FULL MOONS" big={fmt(years * 12.37)} line="more full moons."
            thought="Most of them will rise while you're inside. Go and look at the next one, it takes two minutes." />
          {age > 0 && yearsLeftAt(age) > years + 2 ? (
            <Text style={{ color: colours.faint, fontSize: 12, lineHeight: 17, marginTop: space.sm }}>
              You've already beaten some of the odds just by getting to {Math.floor(age)}: on the life tables someone your age has about {Math.round(yearsLeftAt(age))} years to go.
            </Text>
          ) : null}
        </View>
      ) : null}

      <Text style={{ color: colours.text, fontSize: 11, fontWeight: '800', letterSpacing: 1.8, marginTop: space.xl }}>THE PEOPLE YOU LOVE</Text>
      <View style={{ borderTopWidth: 1, borderTopColor: colours.ink, marginTop: 8 }}>
        {people.length === 0 ? (
          <Text style={{ color: colours.muted, fontSize: 17, lineHeight: 24, paddingVertical: space.lg, fontFamily: 'EBGaramond_400Regular_Italic' }}>
            If you see your mum once a month and she's 64, you might have around 260 more visits on the averages. Add the people who matter and Tali will count yours.
          </Text>
        ) : people.map((p) => (
          <PersonCount key={p.id} p={p} myYears={birth ? years : 40} onRemove={async () => { await removeTimePerson(p.id).catch(() => {}); void load(); }} />
        ))}
      </View>
      <AddPerson onAdded={() => void load()} />

      <Text style={{ color: colours.faint, fontSize: 11.5, lineHeight: 17, marginTop: space.lg, marginBottom: space.xl }}>
        Averages from Australian life tables (ABS, 2021 to 2023), both sexes, about {YEARS} years at birth. Real lives vary a lot, in both directions. These are here to help you choose, nothing more. {''}
        <Text onPress={() => router.navigate('/journal')} style={{ color: colours.purple, fontWeight: '700' }}>See your weeks ›</Text>
      </Text>
    </Screen>
  );
}
