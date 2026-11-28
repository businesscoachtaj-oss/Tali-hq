// The frame every game sits in (25 Nov 2026): the top bar, the part of the brain it works, how to play
// (shown the first time), saving the result, and the finished card with Share and Next.
// 28 Nov 2026: brought into Learnéd (was Tali HQ). Grown-ups only, back goes to Learn, and the paid games
// point to Plans.
import { ReactNode, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { goBack } from '@/components/ui';
import { C, F, R } from './theme';
import { PartChip, Sheet, Btn, Stars, useScale } from './ui';
import { gameById, TODAY, type Game } from '../lib/games';
import { REGIONS } from '../lib/brain';
import { dayNumber, q, localDate } from '../lib/daily';
import { playDate } from './games';
import { sound } from '../lib/sound';
import { usePlus } from '../lib/plan';
import { useStore, usePlayer, saveResult, resultToday, sawHowTo, defaultLevel, setLevel, levelKey, LEVELS, type Result, type Level } from '../lib/store';
import { hasLevels, LEVEL_NAME } from '../lib/levels';

export type Finish = (r: Omit<Result, 'at'>) => void;
const PUZZLES = new Set(['six', 'four', 'trail', 'word-hop', 'room']); // once a day; the rest can be played again for practice
export const gameHref = (id: string) => `/game?id=${id}` as any;

export function GameShell({ id, right, startLevel, children }: { id: string; right?: string; startLevel?: Level; children: (finish: Finish, level: Level) => ReactNode }) {
  const g = gameById(id)!;
  const st = useStore(); const p = usePlayer(); const scale = useScale(); const insets = useSafeAreaInsets();
  const [level, pickLevel] = useState<Level>(() => startLevel || (q('level') as Level) || defaultLevel(p, id));
  // The archive plays an earlier day's puzzle. It's saved today, under its own key, so it never changes a streak.
  const date = playDate(); const archive = date !== localDate();
  const key = archive ? `${levelKey(id, level)}#${date}` : levelKey(id, level);
  const done = archive ? st.results[p.id]?.[localDate()]?.[key] : resultToday(st, p.id, id, level);
  const [again, setAgain] = useState(false);
  const [how, setHow] = useState(() => !(st.howTo[p.id] ?? []).includes(id) && q('how') !== '0' && !q('demo'));
  const kids = false;
  const name = g.name;
  const finish: Finish = (r) => { saveResult(key, { ...r, level }); sound.done(); setAgain(false); };
  const showDone = !!done && !again && q('demo') === null;
  const plusInfo = usePlus(); const locked = !plusInfo.can(id) || (archive && !plusInfo.plus);
  return (
    <View style={{ flex: 1, backgroundColor: C.paper, paddingTop: insets.top + 12, paddingBottom: insets.bottom }}>
      <View style={s.top}>
        <Pressable onPress={() => goBack('/learn')} hitSlop={12} accessibilityRole="button"><Text style={s.back}>{'‹'} Back</Text></Pressable>
        <Text style={[s.name, { color: g.colour, fontSize: 20 * Math.min(scale, 1.2) }]}>{name}</Text>
        <Pressable onPress={() => setHow(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="How to play" style={s.help}><Text style={s.helpT}>?</Text></Pressable>
      </View>
      <View style={s.under}>
        <PartChip region={g.region} kids={kids} />
        {right ?? (g.daily && !kids ? <Text style={s.no}>No. {dayNumber(date) + 1}{archive ? `  ·  from the archive, ${new Date(date + 'T12:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : ''}</Text> : null)}
        {hasLevels(id) && !locked ? (
          <View style={s.levels} accessibilityRole="radiogroup">
            {LEVELS.map(l => (
              <Pressable key={l} onPress={() => { pickLevel(l); setLevel(id, l); setAgain(false); }} accessibilityRole="radio" accessibilityState={{ selected: level === l }} style={[s.lvl, level === l && { backgroundColor: g.colour, borderColor: g.colour }]}>
                <Text style={[s.lvlT, level === l && { color: C.cream }]}>{LEVEL_NAME[l]}{resultToday(st, p.id, id, l) ? ' ✓' : ''}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      {locked ? <Locked g={g} /> : showDone ? <Done g={g} r={done!} kind={p.kind} onAgain={PUZZLES.has(id) ? undefined : () => setAgain(true)} /> : <View key={level} style={{ flex: 1 }}>{children(finish, level)}</View>}
      <Sheet visible={how && !locked} onClose={() => { setHow(false); sawHowTo(id); }} title={`How to play ${name}`}>
        {g.how.map((line, i) => (
          <View key={i} style={s.howRow}><View style={[s.howN, { backgroundColor: g.colour }]}><Text style={s.howNT}>{i + 1}</Text></View><Text style={[s.howT, { fontSize: 16 * Math.min(scale, 1.3) }]}>{line}</Text></View>
        ))}
        <View style={[s.howPart, { borderColor: REGIONS[g.region].colour }]}>
          <Text style={s.howPartK}>WORKS YOUR {REGIONS[g.region].name.toUpperCase()}</Text>
          <Text style={s.howPartT}>{REGIONS[g.region].does}</Text>
        </View>
        <Btn label="Got it" onPress={() => { setHow(false); sawHowTo(id); }} kind="colour" colour={g.colour} />
      </Sheet>
    </View>
  );
}

function share(text: string, then: (m: string) => void) {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      if ((navigator as any).share) { (navigator as any).share({ text }).catch(() => {}); return; }
      navigator.clipboard?.writeText(text).then(() => then('Copied. Paste it anywhere.'), () => then('Could not copy.'));
    }
  } catch { then('Could not copy.'); }
}

function Locked({ g }: { g: Game }) {
  return (
    <View style={s.done}>
      <View style={[s.doneCard, { backgroundColor: g.soft }]}>
        <Text style={s.doneEmoji}>🔒</Text>
        <Text style={[s.doneHead, { textAlign: 'center' }]}>{g.name} comes with a plan</Text>
        <Text style={[s.doneSmall, { fontSize: 15, color: C.ink }]}>Six Tries, Four by Four, Trail, Keys and Breathe are free every day. A plan opens every game, every level and the archive.</Text>
      </View>
      <Btn label="See the plans" onPress={() => router.push('/plans' as any)} />
      <Btn label="Play Six Tries, free every day" kind="ghost" onPress={() => router.replace(gameHref('six'))} />
    </View>
  );
}

export function Done({ g, r, kind, onAgain }: { g: Game; r: Result; kind: string; onAgain?: () => void }) {
  const st = useStore(); const p = usePlayer();
  const [note, setNote] = useState('');
  const kids = kind === 'kids';
  const list = [...TODAY.everyone, 'recall', 'sums', 'spot', 'focus', 'room', 'mirror', 'stop'];
  const plusInfo = usePlus();
  const next = list.map(gameById).find(x => x && x.id !== g.id && plusInfo.can(x.id) && !resultToday(st, p.id, x.id));
  const part = REGIONS[g.region];
  const head = kids ? (r.stars === 3 ? 'Amazing!' : r.stars === 2 ? 'Great job!' : 'Well done!') : r.won === false ? 'Not today' : r.won ? 'Got it' : 'Done for today';
  return (
    <View style={s.done}>
      <View style={[s.doneCard, { backgroundColor: g.soft }]}>
        <Text style={s.doneEmoji}>{kids ? (r.stars === 3 ? '🏆' : '⭐') : g.emoji}</Text>
        <Text style={s.doneHead}>{head}</Text>
        {kids ? <Stars n={r.stars ?? 1} size={30} /> : null}
        {r.detail ? <Text style={s.doneDetail}>{r.detail}{r.level && !kids ? `  ·  ${LEVEL_NAME[r.level]}` : ''}</Text> : null}
        {r.share && !kids ? <Text style={s.grid}>{r.share}</Text> : null}
        {!kids && g.daily ? <Text style={s.doneSmall}>A new one at midnight. Everyone gets the same one.</Text> : null}
      </View>
      <View style={[s.partCard, { borderColor: part.colour }]}>
        <View style={[s.partDot, { backgroundColor: part.colour }]} />
        <View style={{ flex: 1 }}>
          <Text style={s.partK}>{kids ? `YOU USED YOUR ${part.kidName.toUpperCase()}` : `WORKED YOUR ${part.name.toUpperCase()}`}</Text>
          <Text style={s.partT}>{kids ? part.kid : part.tip}</Text>
        </View>
      </View>
      <View style={{ gap: 10 }}>
        {next ? <Btn label={`Next: ${next.name}`} kind="colour" colour={next.colour} onPress={() => router.replace(gameHref(next.id))} /> : <Btn label="All done for today" onPress={() => goBack('/learn')} />}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {r.share && !kids ? <Btn label="Share" kind="ghost" style={{ flex: 1 }} onPress={() => share(`Learnéd ${g.name} No. ${dayNumber() + 1}\n${r.detail ?? ''}\n${r.share}`, setNote)} /> : null}
          {onAgain ? <Btn label={kids ? 'Play again' : 'Practise again'} kind="ghost" style={{ flex: 1 }} onPress={onAgain} /> : null}
        </View>
        {note ? <Text style={[s.doneSmall, { textAlign: 'center' }]}>{note}</Text> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  back: { fontFamily: F.med, fontSize: 15, color: C.soft, minWidth: 64 },
  name: { fontFamily: F.display },
  help: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginLeft: 34 },
  helpT: { fontFamily: F.bold, fontSize: 14, color: C.soft },
  under: { alignItems: 'center', gap: 4, paddingBottom: 6 },
  no: { fontFamily: F.med, fontSize: 12, color: C.faint },
  levels: { flexDirection: 'row', gap: 6, marginTop: 2 },
  lvl: { borderRadius: R.pill, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingHorizontal: 12, paddingVertical: 5 },
  lvlT: { fontFamily: F.bold, fontSize: 12.5, color: C.ink },
  howRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  howN: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  howNT: { fontFamily: F.bold, color: C.cream, fontSize: 13 },
  howT: { flex: 1, fontFamily: F.body, lineHeight: 23, color: C.ink },
  howPart: { borderLeftWidth: 4, backgroundColor: C.card, borderRadius: 12, padding: 12, gap: 4 },
  howPartK: { fontFamily: F.bold, fontSize: 10.5, letterSpacing: 1.4, color: C.soft },
  howPartT: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: C.ink },
  done: { flex: 1, paddingHorizontal: 20, gap: 14, paddingTop: 8 },
  doneCard: { borderRadius: R.card + 4, padding: 22, alignItems: 'center', gap: 8 },
  doneEmoji: { fontSize: 46 },
  doneHead: { fontFamily: F.display, fontSize: 32, color: C.ink },
  doneDetail: { fontFamily: F.bold, fontSize: 17, color: C.ink },
  grid: { fontSize: 20, lineHeight: 26, textAlign: 'center', letterSpacing: 2 },
  doneSmall: { fontFamily: F.body, fontSize: 13, color: C.soft, textAlign: 'center' },
  partCard: { flexDirection: 'row', gap: 12, backgroundColor: C.card, borderRadius: R.card, borderWidth: 1, borderLeftWidth: 5, padding: 14, alignItems: 'flex-start' },
  partDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  partK: { fontFamily: F.bold, fontSize: 10.5, letterSpacing: 1.4, color: C.soft },
  partT: { fontFamily: F.body, fontSize: 14.5, lineHeight: 21, color: C.ink, marginTop: 2 },
});
