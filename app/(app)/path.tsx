// One learning path (28 Nov 2026): the lessons in order, where you are, and the reading behind it.
// One new lesson a day, so it sticks and Tali always has the next one written.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, ErrorText, Screen, goBack } from '@/components/ui';
import { PHeader, SectionHead, lessonHref, serif } from '@/components/Learned';
import { course, enrol, learnHome, leavePath, type Course, type LearnPath, type LessonRow } from '@/lib/learn';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { colours, radius, space } from '@/constants/theme';

export default function PathScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<{ course: Course; lessons: LessonRow[]; done: Set<string> } | null>(null);
  const [mine, setMine] = useState<LearnPath | null>(null);
  const [colour, setColour] = useState<string>(colours.purple);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [c, h] = await Promise.all([course(id), learnHome()]);
      setData(c);
      setMine(h.paths.find((p) => p.id === id) ?? null);
      setColour(h.categories.find((k) => k.id === c.course.category)?.colour ?? h.paths.find((p) => p.id === id)?.colour ?? colours.purple);
      setError('');
    } catch (e: any) {
      setError(e?.message ?? 'Could not open that path.');
    }
  }, [id]);
  useFocusLoad(load);

  if (!data) return <Screen><PHeader kick="YOUR PATH" title="" onBack={() => goBack('/learn')} backLabel="Learn" />{error ? <ErrorText>{error}</ErrorText> : <Text style={{ color: colours.faint }}>Loading...</Text>}</Screen>;

  const { course: c, lessons, done } = data;
  const total = Math.max(c.outline.length, lessons.length, 1);
  const doneCount = lessons.filter((l) => done.has(l.id)).length;
  const next = lessons.find((l) => !done.has(l.id));
  const today = !!mine?.done_today;
  const start = async () => {
    setBusy(true);
    try { await enrol(c.id); await load(); if (next) router.navigate(lessonHref(next.id)); } catch (e: any) { setError(e?.message ?? 'Could not start that.'); }
    setBusy(false);
  };
  const leave = async () => {
    try { await leavePath(c.id); goBack('/learn'); } catch (e: any) { setError(e?.message ?? 'Could not change that.'); }
  };

  return (
    <Screen onRefresh={load}>
      <PHeader kick={c.owner ? 'YOUR OWN PATH' : 'A PATH IN THE LIBRARY'} title={c.title}
        sub={`${total} short lessons, about 7 minutes each.${c.sources ? ` ${c.sources}.` : ''}`} onBack={() => goBack('/learn')} backLabel="Learn" />
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {Array.from({ length: Math.min(total, 40) }, (_, i) => <View key={i} style={{ flex: 1, height: 5, borderRadius: 2, backgroundColor: i < doneCount ? colour : i === doneCount ? colour + '55' : 'rgba(28,26,23,0.12)' }} />)}
      </View>
      <Text style={{ color: colours.muted, fontSize: 13, marginTop: 8 }}>{doneCount} of {total} done · one new lesson a day</Text>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!mine ? <View style={{ marginTop: space.lg }}><Button title="Start this path" onPress={start} busy={busy} /></View> : null}
      {c.line ? <Text style={{ color: colours.text, fontSize: 18, lineHeight: 25, marginTop: space.lg, fontFamily: 'EBGaramond_400Regular' }}>{c.line}</Text> : null}

      <SectionHead>THE LESSONS</SectionHead>
      {c.outline.map((o, i) => {
        const l = lessons.find((x) => x.n === o.n);
        const isDone = !!l && done.has(l.id);
        const isNext = !!l && next?.id === l.id && !!mine;
        const open = isDone || (isNext && !today);
        const sub = isDone ? 'Done. Tap to read it again' : isNext ? (today ? 'Tomorrow. One a day so it sticks' : `Today · ${l!.mins} min, then 3 questions`) : l ? 'Coming up' : 'Tali is writing this one';
        return (
          <Pressable key={o.n} onPress={() => (open && l ? router.navigate(lessonHref(l.id)) : undefined)} disabled={!open} accessibilityRole="button" accessibilityState={{ disabled: !open }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: isNext ? 14 : 11, paddingHorizontal: isNext ? 12 : 0, marginHorizontal: isNext ? -12 : 0, backgroundColor: isNext ? colours.surface : 'transparent', borderWidth: isNext ? 1 : 0, borderColor: colours.ink, borderRadius: radius.card, borderBottomWidth: isNext ? 1 : i === c.outline.length - 1 ? 0 : 1, borderBottomColor: isNext ? colours.ink : colours.border }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: isDone ? colour : 'transparent', borderWidth: isDone ? 0 : 1, borderColor: isNext ? colours.ink : colours.border }}>
              {isDone ? <Ionicons name="checkmark" size={15} color={colours.bg} /> : <Text style={{ color: isNext ? colours.text : colours.faint, fontSize: 12, fontWeight: '700' }}>{o.n}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: isDone || isNext ? colours.text : colours.muted, fontSize: isNext ? 20 : 17, fontFamily: serif }}>{l?.title ?? o.title}</Text>
              <Text style={{ color: colours.muted, fontSize: 12.5, marginTop: 2 }}>{sub}</Text>
            </View>
            {isNext && !today ? (
              <View style={{ backgroundColor: colours.ink, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14 }}>
                <Text style={{ color: colours.bg, fontWeight: '800', fontSize: 11.5, letterSpacing: 1.2 }}>START</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}

      <Text style={{ color: colours.faint, fontSize: 12, lineHeight: 17, marginTop: space.lg }}>Today's lesson shows on Today. If it is still open at 7pm, Tali checks in.</Text>
      {mine ? (
        <Pressable onPress={leave} accessibilityRole="button" style={{ marginTop: space.md, marginBottom: space.xl }}>
          <Text style={{ color: colours.muted, fontSize: 13.5, textDecorationLine: 'underline' }}>Take this path off my list</Text>
        </Pressable>
      ) : <View style={{ height: space.xl }} />}
    </Screen>
  );
}
