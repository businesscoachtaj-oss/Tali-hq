// Learnéd (28 Nov 2026, Taj): the pieces the learning, games and reminders screens share. Paper and ink,
// like the rest of the app. Lessons come from lib/learn.ts, games from games/ (the brain games app,
// brought in), reminders from the reminders table.
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colours, radius, space } from '@/constants/theme';
import type { LearnPath } from '@/lib/learn';
import { AREAS, type Area } from '@/lib/areas';
import { gameById, TODAY, type Game } from '@/games/lib/games';
import { REGIONS as GAME_REGIONS } from '@/games/lib/brain';
import { useStore, resultToday, streak } from '@/games/lib/store';
import { usePlus } from '@/games/lib/plan';

export const kicker = { color: colours.text, fontSize: 11, fontWeight: '800' as const, letterSpacing: 1.8 };
export const serif = 'EBGaramond_500Medium';

export function PHeader({ kick, title, sub, onBack, backLabel = 'Back' }: { kick: string; title: string; sub?: string; onBack?: () => void; backLabel?: string }) {
  return (
    <View style={{ marginBottom: 20, marginTop: 6 }}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" style={{ marginBottom: 18 }}>
          <Text style={{ color: colours.purple, fontSize: 15, fontWeight: '600' }}>{'‹'} {backLabel}</Text>
        </Pressable>
      ) : null}
      <Text style={{ color: colours.purple, fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>{kick}</Text>
      <Text style={{ color: colours.text, fontSize: 40, lineHeight: 44, letterSpacing: -0.4, marginTop: 6, fontFamily: serif }}>{title}</Text>
      {sub ? <Text style={{ color: colours.muted, fontSize: 15, lineHeight: 22, marginTop: 8 }}>{sub}</Text> : null}
    </View>
  );
}

export function SectionHead({ children, right, onRight }: { children: string; right?: string; onRight?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: space.xl, marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colours.ink }}>
      <Text style={[kicker, { flex: 1 }]}>{children}</Text>
      {right ? <Pressable onPress={onRight} hitSlop={8} accessibilityRole="button"><Text style={{ color: colours.purple, fontSize: 13, fontWeight: '700' }}>{right} ›</Text></Pressable> : null}
    </View>
  );
}

export const lessonHref = (id: string) => ({ pathname: '/lesson', params: { id } }) as any;
export const pathHref = (id: string) => ({ pathname: '/path', params: { id } }) as any;
export const gameHref = (id: string) => ({ pathname: '/game', params: { id } }) as any;

/** Today's lesson: the next one in the path you were last on. */
export function LessonCard({ path }: { path: LearnPath }) {
  const now = path.next;
  if (!now) return null;
  const total = Math.max(path.planned, path.live, 1);
  return (
    <Pressable onPress={() => router.navigate(lessonHref(now.id))} accessibilityRole="button" accessibilityLabel={`Start lesson ${now.n}: ${now.title}`}
      style={{ backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.ink, borderRadius: radius.card, padding: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: path.colour }} />
        <Text style={[kicker, { flex: 1, color: path.colour }]} numberOfLines={1}>{path.title.toUpperCase()} · LESSON {now.n} OF {total}</Text>
        <Text style={{ color: colours.faint, fontSize: 12, fontWeight: '600' }}>{now.mins} min</Text>
      </View>
      <Text style={{ color: colours.text, fontSize: 26, lineHeight: 30, marginTop: 8, fontFamily: serif }}>{now.title}</Text>
      {now.teaser ? <Text style={{ color: colours.muted, fontSize: 14, lineHeight: 20, marginTop: 4 }}>{now.teaser}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 3, marginTop: space.md }}>
        {Array.from({ length: Math.min(total, 30) }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < path.done ? path.colour : i === path.done ? path.colour + '55' : 'rgba(28,26,23,0.12)' }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.md }}>
        <Text style={{ flex: 1, color: colours.muted, fontSize: 12.5 }}>Then 3 quick questions so it sticks</Text>
        <View style={{ backgroundColor: colours.ink, borderRadius: radius.pill, paddingVertical: 9, paddingHorizontal: 16 }}>
          <Text style={{ color: colours.bg, fontWeight: '800', fontSize: 12, letterSpacing: 1.2 }}>START</Text>
        </View>
      </View>
    </Pressable>
  );
}

/** When there is no lesson waiting: done for today, or nothing picked yet. */
export function LessonDone({ path }: { path: LearnPath | null }) {
  return (
    <Pressable onPress={() => router.navigate(path ? pathHref(path.id) : ('/courses' as any))} accessibilityRole="button"
      style={{ backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.border, borderRadius: radius.card, padding: space.lg }}>
      <Text style={[kicker, { color: path?.colour ?? colours.purple }]}>{path ? `${path.title.toUpperCase()} · DONE FOR TODAY` : 'START SOMETHING NEW'}</Text>
      <Text style={{ color: colours.text, fontSize: 22, lineHeight: 27, marginTop: 6, fontFamily: serif }}>
        {path ? 'Nice work. The next lesson opens tomorrow.' : 'Pick something to learn, a lesson a day.'}
      </Text>
      <Text style={{ color: colours.muted, fontSize: 13.5, lineHeight: 19, marginTop: 4 }}>
        {path ? 'One a day is how it sticks. Your recall cards bring it back in a couple of days.' : 'Philosophy, money, history, science, the body and more. About seven minutes a day.'}
      </Text>
    </Pressable>
  );
}

export function GameTile({ g, done, locked, wide }: { g: Game; done?: string; locked?: boolean; wide?: boolean }) {
  const part = GAME_REGIONS[g.region];
  return (
    <Pressable onPress={() => router.navigate(gameHref(g.id))} accessibilityRole="button" accessibilityLabel={`${g.name}. ${done ? 'Done today' : g.what}`}
      style={{ width: wide ? '100%' : '48.5%', backgroundColor: g.soft, borderRadius: radius.card, padding: 12, minHeight: 104, borderWidth: 1, borderColor: g.colour + '40' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, color: g.colour, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2 }} numberOfLines={1}>{(PART[g.region] ?? part.human).toUpperCase()}</Text>
        {done ? <Ionicons name="checkmark-circle" size={18} color={g.colour} /> : locked ? <Ionicons name="lock-closed" size={14} color={g.colour} /> : <Text style={{ color: g.colour, fontSize: 11, fontWeight: '700' }}>{g.mins} min</Text>}
      </View>
      <Text style={{ color: colours.text, fontSize: 21, marginTop: 6, fontFamily: serif }}>{g.name}</Text>
      <Text style={{ color: colours.muted, fontSize: 12.5, lineHeight: 17, marginTop: 1 }} numberOfLines={2}>{done ? done : g.what}</Text>
    </Pressable>
  );
}

// Short names for the part of the brain each game works, for the small tiles.
const PART: Record<string, string> = { frontal: 'Self-control', prefrontal: 'Planning', parietal: 'Numbers', temporal: 'Words', occipital: 'Seeing', cerebellum: 'Timing', hippocampus: 'Memory', amygdala: 'Feelings', thalamus: 'Focus', hypothalamus: 'Body clock', basal_ganglia: 'Habits', brainstem: 'Calm', corpus_callosum: 'Both halves' };

const doneLine = (r: { detail?: string; won?: boolean } | undefined) => (r ? (r.detail ? `Done: ${r.detail}` : 'Done today') : undefined);

/** Today's four games, with the streak. */
export function TodaysGames() {
  const st = useStore();
  const me = st.current;
  const list = TODAY.everyone.map(gameById).filter(Boolean) as Game[];
  const played = list.filter((g) => resultToday(st, me, g.id)).length;
  const days = streak(st, me);
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Text style={{ flex: 1, color: colours.muted, fontSize: 13 }}>{played} of {list.length} played · about 15 minutes · free every day</Text>
        {days > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colours.orange, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 9 }}>
            <Ionicons name="flame" size={13} color={colours.orange} />
            <Text style={{ color: colours.orange, fontWeight: '800', fontSize: 12 }}>{days} day streak</Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
        {list.map((g) => <GameTile key={g.id} g={g} done={doneLine(resultToday(st, me, g.id))} />)}
      </View>
    </View>
  );
}

/** Every other game. Breathe is free; the rest come with a plan. */
export function MoreGames({ limit }: { limit?: number }) {
  const st = useStore();
  const plus = usePlus();
  const list = ['recall', 'sums', 'focus', 'room', 'stop', 'spot', 'mirror', 'breathe'].map(gameById).filter(Boolean) as Game[];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
      {list.slice(0, limit ?? list.length).map((g) => <GameTile key={g.id} g={g} locked={!plus.can(g.id)} done={doneLine(resultToday(st, st.current, g.id))} />)}
    </View>
  );
}

export function PathRow({ p, last }: { p: LearnPath; last?: boolean }) {
  const total = Math.max(p.planned, p.live, 1);
  const pct = Math.round((p.done / total) * 100);
  return (
    <Pressable onPress={() => router.navigate(pathHref(p.id))} accessibilityRole="button"
      style={{ paddingVertical: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: colours.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.colour, marginTop: 10 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colours.text, fontSize: 22, fontFamily: serif }}>{p.title}</Text>
          <Text style={{ color: colours.muted, fontSize: 13.5, marginTop: 1 }} numberOfLines={1}>
            {p.next ? (p.done_today ? `Tomorrow: ${p.next.title}` : `Next: ${p.next.title}`) : p.done >= total ? 'Finished' : 'Tali is writing the next one'}
          </Text>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(28,26,23,0.10)', marginTop: 8 }}>
            <View style={{ width: `${pct}%`, height: 4, borderRadius: 2, backgroundColor: p.colour }} />
          </View>
        </View>
        <Text style={{ color: colours.faint, fontSize: 12.5, fontWeight: '700', marginTop: 8 }}>{p.done} of {total}</Text>
      </View>
    </Pressable>
  );
}

export function AreaDot({ area }: { area: Area | null | undefined }) {
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: area ? AREAS[area].colour : colours.faint }} />;
}
