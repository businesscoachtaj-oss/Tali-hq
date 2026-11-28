// Learn (28 Nov 2026, Taj): the Learnéd tab. Today's lesson, today's games, what to remember, your
// paths, learn anything, and the way into philosophy, her library and night school.
// Lessons come from the shared lesson library Tali writes a lesson a night for in every category
// (supabase/functions/tali-learn), plus paths of your own on a paid plan.
import { useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ErrorText, Screen } from '@/components/ui';
import { LessonCard, LessonDone, MoreGames, PHeader, PathRow, SectionHead, TodaysGames, kicker, pathHref, serif } from '@/components/Learned';
import { answerRecall, learnHome, startOwnPath, todaysPath, SUGGESTED, type LearnHome, type RecallCard } from '@/lib/learn';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { colours, radius, space } from '@/constants/theme';

function MoreRow({ icon, title, sub, to, last }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; sub: string; to: string; last?: boolean }) {
  return (
    <Pressable onPress={() => router.navigate(to as any)} accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: colours.border }}>
      <Ionicons name={icon} size={21} color={colours.purple} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colours.text, fontSize: 16, fontWeight: '600' }}>{title}</Text>
        <Text style={{ color: colours.muted, fontSize: 13, marginTop: 1 }}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colours.faint} />
    </Pressable>
  );
}

/** One recall card at a time: show the answer, then say if you knew it. */
function Recall({ cards, due, onDone }: { cards: RecallCard[]; due: number; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const c = cards[i];
  if (!c) {
    return (
      <View style={{ backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, padding: space.lg }}>
        <Text style={{ color: colours.text, fontSize: 19, fontFamily: serif }}>All remembered for today.</Text>
        <Text style={{ color: colours.muted, fontSize: 13.5, marginTop: 4 }}>The next ones come back in a day or two.</Text>
      </View>
    );
  }
  const answer = async (knew: boolean) => {
    await answerRecall(c.id, knew).catch(() => {});
    setShown(false);
    if (i + 1 >= cards.length) onDone();
    setI(i + 1);
  };
  const btn = (fill: boolean) => ({ flex: 1, alignItems: 'center' as const, paddingVertical: 11, borderRadius: radius.pill, borderWidth: 1, borderColor: colours.ink, backgroundColor: fill ? colours.ink : 'transparent' });
  return (
    <View style={{ backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, padding: space.lg }}>
      <Text style={[kicker, { color: colours.muted }]}>{i + 1} OF {Math.min(due, cards.length)} TO REMEMBER</Text>
      <Text style={{ color: colours.text, fontSize: 21, lineHeight: 27, marginTop: 8, fontFamily: serif }}>{c.q}</Text>
      {shown ? <Text style={{ color: colours.muted, fontSize: 15, lineHeight: 22, marginTop: 8 }}>{c.a}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: space.md }}>
        {shown ? (
          <>
            <Pressable onPress={() => answer(false)} accessibilityRole="button" style={btn(false)}><Text style={{ fontWeight: '700', color: colours.text }}>Forgot it</Text></Pressable>
            <Pressable onPress={() => answer(true)} accessibilityRole="button" style={btn(true)}><Text style={{ fontWeight: '700', color: colours.bg }}>Knew it</Text></Pressable>
          </>
        ) : (
          <Pressable onPress={() => setShown(true)} accessibilityRole="button" style={btn(false)}><Text style={{ fontWeight: '700', color: colours.text }}>Show the answer</Text></Pressable>
        )}
      </View>
      <Text style={{ color: colours.faint, fontSize: 12, lineHeight: 17, marginTop: 10 }}>What you forget comes back sooner. What you know comes back in a few weeks, so it sticks for good.</Text>
    </View>
  );
}

function LearnAnything() {
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const go = async (t = topic) => {
    if (t.trim().length < 3 || busy) return;
    setBusy(true); setError('');
    try {
      const c = await startOwnPath(t.trim());
      setTopic('');
      router.navigate(pathHref(c.id));
    } catch (e: any) {
      setError(e?.code === 'no_access' ? 'Paths of your own come with a plan. The lesson library is free for everyone.' : e?.message ?? "Tali couldn't plan that one just now.");
    }
    setBusy(false);
  };
  return (
    <View style={{ backgroundColor: colours.purpleSoft, borderRadius: radius.card, padding: space.lg, marginTop: space.md }}>
      <Text style={{ color: colours.text, fontSize: 21, fontFamily: serif }}>What do you want to learn next?</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <TextInput value={topic} onChangeText={setTopic} onSubmitEditing={() => go()} placeholder="Anything. Wine, Rome, how to argue well..." placeholderTextColor={colours.faint} maxLength={160} editable={!busy}
          accessibilityLabel="What you want to learn" returnKeyType="go"
          style={{ flex: 1, borderWidth: 1, borderColor: colours.borderStrong, backgroundColor: colours.surface, borderRadius: radius.input, paddingVertical: 11, paddingHorizontal: 12, fontSize: 15, color: colours.text }} />
        <Pressable onPress={() => go()} disabled={busy || topic.trim().length < 3} accessibilityRole="button" accessibilityLabel="Plan this path"
          style={{ backgroundColor: colours.ink, borderRadius: radius.pill, paddingHorizontal: 14, justifyContent: 'center', opacity: busy || topic.trim().length < 3 ? 0.4 : 1 }}>
          <Text style={{ color: colours.bg, fontWeight: '800', fontSize: 12, letterSpacing: 1 }}>{busy ? 'PLANNING' : 'GO'}</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {SUGGESTED.slice(0, 4).map((s) => (
          <Pressable key={s} onPress={() => { setTopic(s); go(s); }} disabled={busy} accessibilityRole="button" style={{ borderWidth: 1, borderColor: colours.borderStrong, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 10 }}>
            <Text style={{ color: colours.text, fontSize: 13 }}>{s}</Text>
          </Pressable>
        ))}
      </View>
      {busy ? <Text style={{ color: colours.purple, fontSize: 13, marginTop: 10 }}>Tali is planning your path. This takes about a minute.</Text> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Text style={{ color: colours.muted, fontSize: 12.5, lineHeight: 18, marginTop: 10 }}>Tali plans it from the books in her library and what is well known: short lessons, a few questions after each, and cards that bring it back. Paths of your own come with a plan.</Text>
    </View>
  );
}

export default function Learn() {
  const [home, setHome] = useState<LearnHome | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setHome(await learnHome()); setError(''); } catch (e: any) { setError(e?.message ?? 'Could not load your learning.'); }
  }, []);
  useFocusLoad(load);
  const today = todaysPath(home);
  const lastPath = home?.paths[0] ?? null;
  return (
    <Screen onRefresh={load}>
      <PHeader kick="A LITTLE BETTER EVERY DAY" title="Learn" sub="A lesson, a few games and one big idea. About twenty minutes, and Tali remembers where you got to." />
      {error ? <ErrorText>{error}</ErrorText> : null}

      <SectionHead>TODAY'S LESSON</SectionHead>
      {today ? <LessonCard path={today} /> : home ? <LessonDone path={lastPath && lastPath.done_today ? lastPath : null} /> : <Text style={{ color: colours.faint }}>Loading...</Text>}

      <SectionHead right="All games" onRight={() => router.navigate('/games' as any)}>TODAY'S GAMES</SectionHead>
      <TodaysGames />

      {home && home.recall.length ? (
        <>
          <SectionHead>REMEMBER THIS</SectionHead>
          <Recall cards={home.recall} due={home.recall_due} onDone={load} />
        </>
      ) : null}

      <SectionHead right="Everything to learn" onRight={() => router.navigate('/courses' as any)}>YOUR PATHS</SectionHead>
      {home && home.paths.length ? home.paths.map((p, i) => <PathRow key={p.id} p={p} last={i === home.paths.length - 1} />) : (
        <Pressable onPress={() => router.navigate('/courses' as any)} accessibilityRole="button" style={{ paddingVertical: 14 }}>
          <Text style={{ color: colours.text, fontSize: 16 }}>You're not on a path yet.</Text>
          <Text style={{ color: colours.purple, fontSize: 14, fontWeight: '700', marginTop: 4 }}>Pick one from the library ›</Text>
        </Pressable>
      )}
      <LearnAnything />

      <SectionHead right="All games" onRight={() => router.navigate('/games' as any)}>MORE GAMES</SectionHead>
      <MoreGames limit={4} />

      <SectionHead>THE BIG IDEAS</SectionHead>
      <MoreRow icon="compass-outline" title="Your philosophy" sub="The schools you follow, their texts, things to try" to="/philosophy" />
      <MoreRow icon="library-outline" title="Tali's library" sub="Every book she has read, open to you" to="/library" />
      <MoreRow icon="moon-outline" title="Night school" sub="What she studied while you slept" to="/night-school" />
      <MoreRow icon="hourglass-outline" title="Your time" sub="Your weeks, counted" to="/time" last />
      <View style={{ height: space.xl }} />
    </Screen>
  );
}
