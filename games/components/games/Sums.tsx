// Sums (everyone, Gentle) and Count Up (Kids): tap tiles that add up to the target. Five rounds.
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { C, F } from '../theme';
import { Btn, useScale } from '../ui';
import type { Finish } from '../game';
import { todayRng } from '../../lib/daily';

type Cfg = { tiles: number; pick: number[]; top: number; clock: number };
function makeRounds(cfg: Cfg, salt: number) {
  const r = todayRng(salt);
  return Array.from({ length: 5 }, (_, k) => {
    const top = cfg.top + k * Math.ceil(cfg.top / 4);
    const tiles = Array.from({ length: cfg.tiles }, () => 1 + Math.floor(r() * top));
    const pick = tiles.map((_, i) => i).sort(() => r() - 0.5).slice(0, cfg.pick[k]);
    return { tiles, pick, target: pick.reduce((a, i) => a + tiles[i], 0) };
  });
}
export default function Sums({ finish, kids, demo, cfg }: { finish: Finish; kids?: boolean; demo?: boolean; cfg: Cfg }) {
  const scale = useScale(); const rounds = useMemo(() => makeRounds(cfg, (kids ? 21 : 7) + cfg.tiles), [kids, cfg]);
  const [secs, setSecs] = useState(cfg.clock);
  const [k, setK] = useState(0); const [sel, setSel] = useState<number[]>(demo ? rounds[0].pick : []); const [misses, setMisses] = useState(0); const [ok, setOk] = useState(false);
  const R = rounds[k]; const total = sel.reduce((a, i) => a + R.tiles[i], 0);
  // Hard has a clock on each round. Run out and that round counts as a try again.
  useEffect(() => { if (!cfg.clock || demo) return; setSecs(cfg.clock); const t = setInterval(() => setSecs(x => { if (x <= 1) { setMisses(m => m + 1); setSel([]); setK(kk => (kk < 4 ? kk + 1 : kk)); return cfg.clock; } return x - 1; }), 1000); return () => clearInterval(t); }, [k]);
  function tap(i: number) { if (ok) return; setSel(sel.includes(i) ? sel.filter(x => x !== i) : [...sel, i]); }
  function check() {
    if (total === R.target) {
      setOk(true);
      setTimeout(() => {
        setOk(false); setSel([]);
        if (k === 4) finish({ won: true, score: 5 - Math.min(5, misses), detail: misses ? `5 rounds, ${misses} tr${misses === 1 ? 'y' : 'ies'} again` : '5 rounds, all first go', share: '➕'.repeat(5), stars: misses === 0 ? 3 : misses <= 2 ? 2 : 1 });
        else setK(k + 1);
      }, 700);
    } else setMisses(misses + 1);
  }
  const accent = kids ? C.amber : C.amber;
  const over = total > R.target;
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 16 }}>
      <Text style={s.round}>Round {k + 1} of 5{cfg.clock ? `  ·  ${secs} s` : ''}</Text>
      <View style={[s.target, { borderColor: accent }]}><Text style={s.targetK}>{kids ? 'MAKE' : 'TARGET'}</Text><Text style={s.targetN}>{R.target}</Text></View>
      <Text style={[s.total, over && { color: C.bad }, ok && { color: C.teal }]}>{ok ? (kids ? 'Yes! 🎉' : 'Spot on') : sel.length ? `${sel.map(i => R.tiles[i]).join(' + ')} = ${total}` : 'Tap the tiles'}</Text>
      <View style={s.grid}>
        {R.tiles.map((n, i) => {
          const on = sel.includes(i);
          return (
            <Pressable key={i} onPress={() => tap(i)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[s.tile, { width: cfg.tiles > 9 ? 70 : kids ? 92 : 86, height: (cfg.tiles > 9 ? 62 : kids ? 92 : 78) * Math.min(scale, 1.15) }, on && { backgroundColor: accent, borderColor: accent }]}>
              <Text style={[s.tileT, { fontSize: 28 * Math.min(scale, 1.2) }, on && { color: '#fff' }]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <Btn label="Clear" kind="ghost" small onPress={() => setSel([])} disabled={!sel.length} />
        <Btn label="Check" small onPress={check} disabled={!sel.length} />
      </View>
      {misses ? <Text style={s.miss}>{kids ? 'Nearly! Have another go.' : `Not quite. ${R.target - total > 0 ? `${R.target - total} short` : `${total - R.target} over`}.`}</Text> : null}
    </View>
  );
}
const s = StyleSheet.create({
  round: { fontFamily: F.med, fontSize: 13, color: C.soft, marginTop: 4 },
  target: { borderWidth: 3, borderRadius: 22, paddingHorizontal: 28, paddingVertical: 8, alignItems: 'center', marginTop: 10, backgroundColor: C.card },
  targetK: { fontFamily: F.bold, fontSize: 11, letterSpacing: 1.6, color: C.soft },
  targetN: { fontFamily: F.display, fontSize: 52, color: C.ink, lineHeight: 60 },
  total: { fontFamily: F.bold, fontSize: 16, color: C.soft, marginVertical: 14, minHeight: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 320 },
  tile: { borderRadius: 18, backgroundColor: C.card, borderWidth: 2, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  tileT: { fontFamily: F.display, color: C.ink },
  miss: { fontFamily: F.med, fontSize: 14, color: C.bad, marginTop: 12 },
});
