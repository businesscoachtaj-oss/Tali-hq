// Focus: which way does the middle arrow point? The others try to pull you the wrong way.
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { C, F } from '../theme';
import { Btn } from '../ui';
import type { Finish } from '../game';
import { todayRng } from '../../lib/daily';

export default function Focus({ finish, demo, cfg }: { finish: Finish; demo?: boolean; cfg: { arrows: number; same: number; limit: number } }) {
  const turns = 30; const half = Math.floor(cfg.arrows / 2);
  const plan = useMemo(() => { const r = todayRng(23 + cfg.arrows); return Array.from({ length: turns }, () => ({ mid: r() < 0.5 ? 'L' : 'R', same: r() < cfg.same })); }, [cfg]);
  const [i, setI] = useState(demo ? 9 : -1); const [right, setRight] = useState(demo ? 9 : 0); const [fb, setFb] = useState<'ok' | 'no' | null>(null);
  const t0 = useRef(0); const times = useRef<number[]>([]);
  const T = plan[Math.max(0, i)];
  const row = T ? (() => { const side = T.same ? T.mid : T.mid === 'L' ? 'R' : 'L'; const a = (d: string) => (d === 'L' ? '←' : '→'); return [...Array(half).fill(a(side)), a(T.mid), ...Array(half).fill(a(side))]; })() : [];
  // Hard has a time limit on each turn that shrinks the further you get.
  useEffect(() => { if (!cfg.limit || i < 0 || demo) return; const t = setTimeout(() => answer(T.mid === 'L' ? 'R' : 'L'), Math.max(600, cfg.limit - i * 20)); return () => clearTimeout(t); }, [i]);
  function answer(d: 'L' | 'R') {
    if (i < 0 || fb) return; const ok = d === T.mid; if (ok) { setRight(right + 1); times.current.push(Date.now() - t0.current); }
    setFb(ok ? 'ok' : 'no');
    setTimeout(() => { setFb(null); if (i + 1 >= turns) { const avg = Math.round(times.current.reduce((a, b) => a + b, 0) / Math.max(1, times.current.length)); const sc = right + (ok ? 1 : 0); finish({ score: sc, detail: `${sc} of ${turns} right, ${avg} ms on average`, share: `🎯 ${sc}/${turns}` }); } else { setI(i + 1); t0.current = Date.now(); } }, 260);
  }
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 20 }}>
      <Text style={s.count}>{i < 0 ? `${turns} turns` : `${i + 1} of ${turns}  ·  ${right} right`}</Text>
      <View style={[s.stage, fb === 'ok' && { borderColor: C.teal }, fb === 'no' && { borderColor: C.bad }]}>
        {i < 0 ? <Text style={s.hint}>Look only at the middle arrow</Text> : (
          <View style={s.arrows}>{row.map((a, k) => <Text key={k} style={[s.arrow, cfg.arrows > 5 && { fontSize: 40 }, k === half && { color: C.ink }]}>{a}</Text>)}</View>
        )}
      </View>
      {i < 0 ? <Btn label="Start" kind="colour" colour={C.amber} onPress={() => { setI(0); t0.current = Date.now(); }} style={{ minWidth: 180, marginTop: 20 }} /> : (
        <View style={s.buttons}>
          <Pressable onPress={() => answer('L')} style={s.btn} accessibilityRole="button" accessibilityLabel="Left"><Text style={s.btnT}>←</Text></Pressable>
          <Pressable onPress={() => answer('R')} style={s.btn} accessibilityRole="button" accessibilityLabel="Right"><Text style={s.btnT}>→</Text></Pressable>
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  count: { fontFamily: F.med, fontSize: 14, color: C.soft, marginTop: 6 },
  stage: { width: '100%', height: 220, borderRadius: 24, backgroundColor: C.card, borderWidth: 3, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  arrows: { flexDirection: 'row', gap: 6 },
  arrow: { fontFamily: F.bold, fontSize: 50, color: '#8F877A' },
  hint: { fontFamily: F.display, fontSize: 20, color: C.soft },
  buttons: { flexDirection: 'row', gap: 16, marginTop: 26 },
  btn: { width: 130, height: 96, borderRadius: 22, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  btnT: { fontSize: 44, color: C.cream, fontFamily: F.bold },
});
