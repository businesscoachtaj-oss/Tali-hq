// Mirror: copy the pattern on the right, flipped like a mirror. Six rounds, each a bit bigger.
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { C, F } from '../theme';
import { Btn } from '../ui';
import type { Finish } from '../game';
import { todayRng } from '../../lib/daily';

export default function Mirror({ finish, demo, cfg }: { finish: Finish; demo?: boolean; cfg: { sizes: number[]; both: boolean } }) {
  // Hard: some rounds flip top to bottom instead, like a lake.
  const rounds = useMemo(() => { const r = todayRng(29 + cfg.sizes[5]); return cfg.sizes.map((n, k) => { const on = new Set<number>(); while (on.size < n + k) on.add(Math.floor(r() * n * n)); return { n, on: [...on], down: cfg.both && k % 2 === 1 }; }); }, [cfg]);
  const [k, setK] = useState(demo ? 2 : 0); const R = rounds[k];
  const [mine, setMine] = useState<number[]>(demo ? [R.on[0] - (R.on[0] % R.n) + (R.n - 1 - (R.on[0] % R.n))] : []); const [miss, setMiss] = useState(0); const [msg, setMsg] = useState('');
  const flip = (i: number) => (R.down ? (R.n - 1 - Math.floor(i / R.n)) * R.n + (i % R.n) : Math.floor(i / R.n) * R.n + (R.n - 1 - (i % R.n)));
  const want = R.on.map(flip).sort().join();
  function check() {
    if ([...mine].sort().join() === want) { setMsg(''); if (k === 5) finish({ score: 6 - Math.min(6, miss), detail: miss ? `6 patterns, ${miss} to fix` : '6 patterns, all first go', share: '🪞'.repeat(6), stars: miss === 0 ? 3 : miss < 3 ? 2 : 1 }); else { setK(k + 1); setMine([]); } }
    else { setMiss(miss + 1); setMsg('Not quite. Check which side each square is on.'); }
  }
  const size = 150; const gap = 5; const cell = (size - gap * (R.n - 1)) / R.n;
  const Grid = ({ cells, tap, ghost }: { cells: number[]; tap?: (i: number) => void; ghost?: boolean }) => (
    <View style={[s.grid, { width: size, gap }]}>
      {Array.from({ length: R.n * R.n }).map((_, i) => (
        <Pressable key={i} disabled={!tap} onPress={() => tap?.(i)} style={{ width: cell, height: cell, borderRadius: 6, backgroundColor: cells.includes(i) ? (ghost ? C.plum : C.ink) : C.card, borderWidth: 1, borderColor: C.line }} />
      ))}
    </View>
  );
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 16 }}>
      <Text style={s.round}>Pattern {k + 1} of 6</Text>
      <View style={s.pair}>
        <View style={{ alignItems: 'center', gap: 6 }}><Text style={s.lab}>THIS</Text><Grid cells={R.on} ghost /></View>
        <View style={[s.mirror, R.down && { opacity: 0.12 }]} />
        <View style={{ alignItems: 'center', gap: 6 }}><Text style={s.lab}>{R.down ? 'UPSIDE DOWN' : 'IN THE MIRROR'}</Text><Grid cells={mine} tap={i => setMine(mine.includes(i) ? mine.filter(x => x !== i) : [...mine, i])} /></View>
      </View>
      <Text style={s.msg}>{msg || `Tap ${R.on.length} squares`}</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn label="Clear" kind="ghost" small onPress={() => setMine([])} disabled={!mine.length} />
        <Btn label="Check" small onPress={check} disabled={mine.length !== R.on.length} />
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  round: { fontFamily: F.med, fontSize: 13, color: C.soft, marginTop: 4 },
  pair: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 24 },
  mirror: { width: 3, height: 170, borderRadius: 2, backgroundColor: C.plum, opacity: 0.35 },
  lab: { fontFamily: F.bold, fontSize: 10.5, letterSpacing: 1.4, color: C.soft },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  msg: { fontFamily: F.med, fontSize: 14, color: C.soft, marginVertical: 18, textAlign: 'center' },
});
