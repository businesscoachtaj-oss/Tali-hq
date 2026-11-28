// A lesson (28 Nov 2026): a short read in Tali's words, the original line from a book in her library,
// one thing to try today, then three quick questions so it sticks. Finishing saves the score and puts
// the lesson's recall cards in, first back in two days.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ErrorText, Screen, goBack } from '@/components/ui';
import { kicker, pathHref, serif } from '@/components/Learned';
import { course, finishLesson, lesson, type Course, type Lesson } from '@/lib/learn';
import { addReminder } from '@/lib/data';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { colours, radius, space } from '@/constants/theme';

const read = { color: colours.text, fontSize: 18.5, lineHeight: 28, fontFamily: 'EBGaramond_400Regular', marginTop: 14 } as const;

function tonight() {
  const d = new Date();
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 20, 0, 0);
  return t.getTime() > Date.now() + 15 * 60000 ? t : new Date(Date.now() + 60 * 60000);
}

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [l, setL] = useState<Lesson | null>(null);
  const [c, setC] = useState<Course | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const [finished, setFinished] = useState(false);
  const [reminded, setReminded] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const x = await lesson(id);
      setL(x);
      course(x.course_id).then((r) => setC(r.course)).catch(() => {});
      setQ(0); setPick(null); setRight(0); setFinished(false); setReminded(false);
      setError('');
    } catch (e: any) {
      setError(e?.message ?? 'Could not open that lesson.');
    }
  }, [id]);
  useFocusLoad(load);

  if (!l) return <Screen>{error ? <ErrorText>{error}</ErrorText> : <Text style={{ color: colours.faint, marginTop: 40 }}>Loading...</Text>}</Screen>;

  const total = Math.max(c?.outline.length ?? 0, l.n);
  const qs = l.questions ?? [];
  const cur = qs[q];
  const tryIt = l.body.find((b) => b.t === 'try');
  const answered = pick !== null;
  const nextQ = async () => {
    const got = right + (pick === cur.answer ? 1 : 0);
    if (q + 1 < qs.length) { setRight(got); setQ(q + 1); setPick(null); return; }
    setRight(got);
    try { await finishLesson(l.id, got, qs.length); } catch (e: any) { setError(e?.message ?? 'Could not save that.'); }
    setFinished(true);
  };
  const remind = async () => {
    if (!tryIt) return;
    try { await addReminder(tryIt.text.slice(0, 280), tonight(), 'life', { area: 'mind' }); setReminded(true); } catch { setError("Couldn't add that reminder."); }
  };

  return (
    <Screen>
      <Pressable onPress={() => (c ? router.navigate(pathHref(c.id)) : goBack('/learn'))} hitSlop={12} accessibilityRole="button" style={{ marginTop: 6, marginBottom: 18 }}>
        <Text style={{ color: colours.purple, fontSize: 15, fontWeight: '600' }}>{'‹'} {c?.title ?? 'Learn'}</Text>
      </Pressable>
      <Text style={[kicker, { color: colours.purple }]}>LESSON {l.n}{total ? ` OF ${total}` : ''} · {l.mins} MIN</Text>
      <Text style={{ color: colours.text, fontSize: 38, lineHeight: 42, marginTop: 6, fontFamily: serif }}>{l.title}</Text>
      {error ? <ErrorText>{error}</ErrorText> : null}

      {l.body.map((b, i) => {
        if (b.t === 'h') return <Text key={i} style={{ color: colours.text, fontSize: 22, marginTop: space.lg, fontFamily: serif }}>{b.text}</Text>;
        if (b.t === 'quote') return (
          <View key={i} style={{ marginTop: space.lg, borderLeftWidth: 2, borderLeftColor: colours.purple, paddingLeft: 14 }}>
            <Text style={{ color: colours.text, fontSize: 23, lineHeight: 30, fontFamily: 'EBGaramond_400Regular_Italic' }}>{b.text}</Text>
            {b.by ? <Text style={{ color: colours.muted, fontSize: 12.5, marginTop: 6 }}>{b.by}</Text> : null}
          </View>
        );
        if (b.t === 'try') return (
          <View key={i} style={{ marginTop: space.lg, backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.ink, borderRadius: radius.card, padding: space.lg }}>
            <Text style={kicker}>TRY IT TODAY</Text>
            <Text style={{ color: colours.text, fontSize: 16, lineHeight: 23, marginTop: 6 }}>{b.text}</Text>
            <Pressable onPress={remind} disabled={reminded} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <Ionicons name={reminded ? 'checkmark-circle' : 'alarm-outline'} size={16} color={colours.purple} />
              <Text style={{ color: colours.purple, fontSize: 13, fontWeight: '700' }}>{reminded ? 'In your reminders for tonight' : 'Remind me tonight'}</Text>
            </Pressable>
          </View>
        );
        return <Text key={i} style={read}>{b.text}</Text>;
      })}

      {finished ? (
        <View style={{ marginTop: space.xl, backgroundColor: colours.purpleSoft, borderRadius: radius.card, padding: space.lg }}>
          <Text style={[kicker, { color: colours.purple }]}>LESSON DONE</Text>
          <Text style={{ color: colours.text, fontSize: 24, marginTop: 6, fontFamily: serif }}>{right} of {qs.length} right. Nice work.</Text>
          <Text style={{ color: colours.muted, fontSize: 14, lineHeight: 20, marginTop: 6 }}>Your recall cards come back in two days. The next lesson opens tomorrow.</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: space.md }}>
            <Pressable onPress={() => router.navigate({ pathname: '/talk', params: { ask: `I just finished the lesson "${l.title}". Can we talk about it?` } } as any)} accessibilityRole="button" style={{ flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: radius.pill, borderWidth: 1, borderColor: colours.ink }}>
              <Text style={{ color: colours.text, fontWeight: '700' }}>Talk to Tali about it</Text>
            </Pressable>
            <Pressable onPress={() => router.navigate('/learn')} accessibilityRole="button" style={{ flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: radius.pill, backgroundColor: colours.ink }}>
              <Text style={{ color: colours.bg, fontWeight: '700' }}>Back to Learn</Text>
            </Pressable>
          </View>
        </View>
      ) : cur ? (
        <View>
          <Text style={[kicker, { marginTop: space.xl }]}>QUESTION {q + 1} OF {qs.length}</Text>
          <Text style={{ color: colours.text, fontSize: 22, lineHeight: 28, marginTop: 6, fontFamily: serif }}>{cur.q}</Text>
          <View style={{ gap: 8, marginTop: space.md }}>
            {cur.options.map((o, i) => {
              const chosen = pick === i, isRight = i === cur.answer, show = answered && (chosen || isRight);
              return (
                <Pressable key={i} onPress={() => (answered ? undefined : setPick(i))} disabled={answered} accessibilityRole="radio" accessibilityState={{ selected: chosen }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.card, borderWidth: 1, borderColor: show ? (isRight ? colours.good : colours.danger) : colours.border, backgroundColor: show ? (isRight ? 'rgba(46,125,79,0.08)' : 'rgba(179,57,47,0.07)') : colours.surface }}>
                  <Text style={{ flex: 1, color: colours.text, fontSize: 15, lineHeight: 21 }}>{o}</Text>
                  {show ? <Ionicons name={isRight ? 'checkmark-circle' : 'close-circle'} size={20} color={isRight ? colours.good : colours.danger} /> : null}
                </Pressable>
              );
            })}
          </View>
          {answered ? <Text style={{ color: colours.muted, fontSize: 14, lineHeight: 20, marginTop: 10 }}>{pick === cur.answer ? 'Right. ' : 'Not quite. '}{cur.why}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: space.lg, marginBottom: space.xl }}>
            <Pressable onPress={() => router.navigate({ pathname: '/talk', params: { ask: `About the lesson "${l.title}": ${cur.q}` } } as any)} accessibilityRole="button" style={{ flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: radius.pill, borderWidth: 1, borderColor: colours.ink }}>
              <Text style={{ color: colours.text, fontWeight: '700' }}>Ask Tali about it</Text>
            </Pressable>
            <Pressable onPress={nextQ} disabled={!answered} accessibilityRole="button" style={{ flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: radius.pill, backgroundColor: colours.ink, opacity: answered ? 1 : 0.35 }}>
              <Text style={{ color: colours.bg, fontWeight: '700' }}>{q + 1 < qs.length ? 'Next question' : 'Finish'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <View style={{ height: space.xl }} />
    </Screen>
  );
}
