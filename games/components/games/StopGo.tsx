// Stop Go (everyone) and Frog Stop (Kids): tap for go, hold back for stop. Works self-control.
import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { C, F } from '../theme';
import { Btn } from '../ui';
import type { Finish } from '../game';
import { todayRng } from '../../lib/daily';

export default function StopGo({ finish, kids, demo, cfg }: { finish: Finish; kids?: boolean; demo?: boolean; cfg: { ms: number; stop: number; turns: number } }) {
  const turns = cfg.turns;
  const plan = useRef((() => { const r = todayRng((kids ? 33 : 3) + turns); return Array.from({ length: turns }, () => r() >= cfg.stop); })()).current;
  // Shown for less time the further you get (down to 60%), on every level.
  const showMs = (i: number) => cfg.ms * Math.max(0.6, 1 - Math.max(0, i) * 0.012);
  const [i, setI] = useState(demo ? 14 : -1); const [on, setOn] = useState<boolean | null>(demo ? true : null);
  const [right, setRight] = useState(demo ? 13 : 0); const [fb, setFb] = useState<'ok' | 'oops' | null>(null);
  const tapped = useRef(false); const times = useRef<number[]>([]); const shownAt = useRef(0); const score = useRef(0);
  useEffect(() => {
    if (i < 0 || demo) return;
    if (i >= turns) { const avg = times.current.length ? Math.round(times.current.reduce((a, b) => a + b, 0) / times.current.length) : 0; const pct = Math.round((score.current / turns) * 100);
      finish({ score: pct, detail: kids ? `${score.current} of ${turns} right` : `${pct}% right, ${avg} ms on average`, share: `🚦 ${pct}%`, stars: pct >= 90 ? 3 : pct >= 70 ? 2 : 1 }); return; }
    tapped.current = false; setOn(plan[i]); shownAt.current = Date.now();
    const t = setTimeout(() => {
      if (!tapped.current) { const good = !plan[i]; if (good) { score.current++; setRight(score.current); } setFb(good ? null : 'oops'); }
      setOn(null); setTimeout(() => { setFb(null); setI(i + 1); }, 380);
    }, showMs(i));
    return () => clearTimeout(t);
  }, [i]);
  function tap() {
    if (on === null || tapped.current) return; tapped.current = true;
    if (on) { score.current++; setRight(score.current); times.current.push(Date.now() - shownAt.current); setFb('ok'); } else setFb('oops');
  }
  const go = on === true, stop = on === false;
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 20 }}>
      <Text style={s.count}>{i < 0 ? `${turns} turns` : `${Math.min(i + 1, turns)} of ${turns}  ·  ${right} right`}</Text>
      <Pressable onPressIn={tap} accessibilityRole="button" accessibilityLabel="Tap area" style={[s.pad, fb === 'oops' && { borderColor: C.bad }, fb === 'ok' && { borderColor: C.teal }]}>
        {kids ? (
          on === null ? <Text style={s.pond}>🌊</Text> : <View style={[s.lily, { backgroundColor: go ? '#5DA65B' : '#D2483B' }]}><Text style={{ fontSize: 64 }}>🐸</Text></View>
        ) : go ? <View style={s.goShape} /> : stop ? <View style={s.stopShape} /> : <Text style={s.plus}>+</Text>}
        {fb === 'oops' ? <Text style={s.fb}>{kids ? 'Oops! Red means stop' : stop ? 'That was a stop' : 'Too slow'}</Text> : null}
      </Pressable>
      <View style={s.key}>
        <View style={s.keyRow}>{kids ? <Text style={{ fontSize: 18 }}>🟢</Text> : <View style={[s.goShape, { width: 18, height: 18 }]} />}<Text style={s.keyT}>Tap</Text></View>
        <View style={s.keyRow}>{kids ? <Text style={{ fontSize: 18 }}>🔴</Text> : <View style={[s.stopShape, { width: 16, height: 16 }]} />}<Text style={s.keyT}>Don't tap</Text></View>
      </View>
      {i < 0 ? <Btn label="Start" kind="colour" colour={C.rose} onPress={() => setI(0)} style={{ minWidth: 180, marginTop: 10 }} /> : null}
    </View>
  );
}
const s = StyleSheet.create({
  count: { fontFamily: F.med, fontSize: 14, color: C.soft, marginTop: 6 },
  pad: { width: '100%', height: 340, borderRadius: 26, backgroundColor: C.card, borderWidth: 3, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  goShape: { width: 130, height: 130, borderRadius: 65, backgroundColor: '#3E9B57' },
  stopShape: { width: 120, height: 120, borderRadius: 14, backgroundColor: C.bad },
  plus: { fontFamily: F.display, fontSize: 40, color: C.faint },
  pond: { fontSize: 56, opacity: 0.6 },
  lily: { width: 170, height: 170, borderRadius: 85, alignItems: 'center', justifyContent: 'center' },
  fb: { position: 'absolute', bottom: 18, fontFamily: F.bold, fontSize: 15, color: C.bad },
  key: { flexDirection: 'row', gap: 26, marginTop: 16 },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  keyT: { fontFamily: F.med, fontSize: 14, color: C.soft },
});
