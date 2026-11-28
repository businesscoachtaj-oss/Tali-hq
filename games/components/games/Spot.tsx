// Spot: one tile is a slightly different shade. Ten rounds, the grid grows and the difference shrinks.
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { C, F } from '../theme';
import { useScale } from '../ui';
import type { Finish } from '../game';
import { todayRng } from '../../lib/daily';

const HUES = [168, 32, 262, 8, 96, 205, 330];
export default function Spot({ finish, demo, cfg }: { finish: Finish; gentle?: boolean; demo?: boolean; cfg: { grow: number; diff: number; drop: number } }) {
  const scale = useScale();
  const rounds = useMemo(() => { const r = todayRng(17 + cfg.diff); return Array.from({ length: 10 }, (_, k) => ({ size: Math.min(7, 3 + Math.floor(k / cfg.grow)), odd: 0, hue: HUES[Math.floor(r() * HUES.length)], diff: Math.max(4, cfg.diff - k * cfg.drop), r: r() })).map(x => ({ ...x, odd: Math.floor(x.r * x.size * x.size) })); }, [cfg]);
  const [k, setK] = useState(demo ? 5 : 0); const [miss, setMiss] = useState(0); const [start] = useState(Date.now()); const [wrong, setWrong] = useState<number | null>(null);
  const R = rounds[k]; const n = R.size * R.size; const W = Math.min(330, 310 * Math.min(scale, 1.1)); const gap = R.size > 5 ? 5 : 8; const cell = (W - gap * (R.size - 1)) / R.size;
  const base = `hsl(${R.hue}, 45%, 52%)`; const odd = `hsl(${R.hue}, 45%, ${52 + R.diff}%)`;
  function tap(i: number) {
    if (i === R.odd) { if (k === 9) { const secs = Math.round((Date.now() - start) / 1000); finish({ score: 10 - miss, detail: `10 rounds in ${secs} seconds${miss ? `, ${miss} miss${miss === 1 ? '' : 'es'}` : ''}`, share: `👁️ ${secs}s`, stars: miss === 0 ? 3 : miss < 3 ? 2 : 1 }); } else setK(k + 1); }
    else { setMiss(miss + 1); setWrong(i); setTimeout(() => setWrong(null), 300); }
  }
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={s.round}>Round {k + 1} of 10</Text>
      <Text style={s.prompt}>Tap the one that's different</Text>
      <View style={[s.grid, { width: W, gap }]}>
        {Array.from({ length: n }).map((_, i) => (
          <Pressable key={i} onPress={() => tap(i)} accessibilityRole="button" accessibilityLabel={`Tile ${i + 1}`}
            style={{ width: cell, height: cell, borderRadius: cell / 4, backgroundColor: i === R.odd ? odd : base, opacity: wrong === i ? 0.4 : 1 }} />
        ))}
      </View>
      <Text style={s.miss}>{miss ? `${miss} miss${miss === 1 ? '' : 'es'}` : ' '}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  round: { fontFamily: F.med, fontSize: 13, color: C.soft, marginTop: 4 },
  prompt: { fontFamily: F.display, fontSize: 22, color: C.ink, marginVertical: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  miss: { fontFamily: F.med, fontSize: 14, color: C.bad, marginTop: 14 },
});
