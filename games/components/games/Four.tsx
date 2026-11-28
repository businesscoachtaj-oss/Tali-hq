// Four by Four: find four groups of four. Four slips on Everyone, no limit on Gentle.
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { C, F } from '../theme';
import { Btn, useScale } from '../ui';
import type { Finish } from '../game';
import type { FourSet } from '../../lib/banks';
import { shuffled, rng } from '../../lib/daily';

const GROUP = [{ bg: '#E8C66A', e: '🟨' }, { bg: '#9CC59A', e: '🟩' }, { bg: '#9DB8DA', e: '🟦' }, { bg: '#B9A3D6', e: '🟪' }];
export default function Four({ set, finish, gentle, start, slipsMax = 4 }: { set: FourSet; finish: Finish; gentle?: boolean; start?: { found: number[]; sel: string[]; slips: number }; slipsMax?: number }) {
  const scale = useScale(); const { width } = useWindowDimensions();
  const [order, setOrder] = useState(() => shuffled(set.flatMap(g => g.words), rng(set[0].words[0].length * 31 + set[set.length - 1].words[1].length)));
  const [found, setFound] = useState<number[]>(start?.found ?? []);
  const [sel, setSel] = useState<string[]>(start?.sel ?? []);
  const [slips, setSlips] = useState(start?.slips ?? 0);
  const [tries, setTries] = useState<number[][]>([]);
  const [msg, setMsg] = useState(start?.slips ? 'One away' : '');
  const groupOf = useMemo(() => Object.fromEntries(set.flatMap((g, i) => g.words.map(w => [w, i]))), [set]);
  const left = order.filter(w => !found.includes(groupOf[w]));
  const max = gentle || slipsMax >= 99 ? Infinity : slipsMax; const G = set.length;
  function tap(w: string) { setMsg(''); setSel(sel.includes(w) ? sel.filter(x => x !== w) : sel.length < 4 ? [...sel, w] : sel); }
  function check() {
    const gs = sel.map(w => groupOf[w]); const t = [...tries, gs]; setTries(t);
    const counts: Record<number, number> = {}; gs.forEach(g => (counts[g] = (counts[g] || 0) + 1));
    const best = Math.max(...Object.values(counts));
    if (best === 4) {
      const nf = [...found, gs[0]]; setFound(nf); setSel([]); setMsg('');
      if (nf.length === G) end(true, t, slips);
    } else {
      const ns = slips + 1; setSlips(ns); setMsg(best === 3 ? 'One away' : 'Not a group');
      if (ns >= max) { setFound(set.map((_, i) => i)); setSel([]); end(false, t, ns); }
    }
  }
  function end(won: boolean, t: number[][], ns: number) {
    const grid = t.map(r => r.map(g => GROUP[g].e).join('')).join('\n');
    setTimeout(() => finish({ won, score: won ? Math.max(0, G - ns) : 0, detail: won ? (ns === 0 ? 'No slips. Perfect.' : `${ns} slip${ns === 1 ? '' : 's'}`) : 'Out of slips', share: grid }), 900);
  }
  const fs = 13 * Math.min(scale, 1.3);
  const tileW = (Math.min(width, 600) - 28) * 0.232 - 6; // web ignores adjustsFontSizeToFit, so size long words to fit
  const fit = (w: string) => Math.min(fs, Math.floor(tileW / (w.length * 0.7)));
  return (
    <View style={{ flex: 1, paddingHorizontal: 14 }}>
      <Text style={s.prompt}>Make {G === 3 ? 'three' : 'four'} groups of four.</Text>
      <View style={{ gap: 8 }}>
        {found.map(i => (
          <View key={i} style={[s.group, { backgroundColor: GROUP[i].bg }]}>
            <Text style={s.groupName}>{set[i].name.toUpperCase()}</Text>
            <Text style={s.groupWords}>{set[i].words.join(', ')}</Text>
          </View>
        ))}
        <View style={s.grid}>
          {left.map(w => {
            const on = sel.includes(w);
            return (
              <Pressable key={w} onPress={() => tap(w)} accessibilityRole="button" accessibilityState={{ selected: on }}
                style={[s.tile, { height: 70 * Math.min(scale, 1.2) }, on && { backgroundColor: C.ink }]}>
                <Text adjustsFontSizeToFit numberOfLines={1} style={[s.tileT, { fontSize: fit(w) }, on && { color: C.cream }]}>{w}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={s.slips}>
        {max === Infinity ? <Text style={s.slipT}>No limit on slips. Take your time.</Text> : (<>
          <Text style={s.slipT}>Slips left</Text>
          {Array.from({ length: max }).map((_, i) => <View key={i} style={[s.dot, i < max - slips && { backgroundColor: C.ink }]} />)}
        </>)}
      </View>
      <Text style={s.msg}>{msg}</Text>
      <View style={s.buttons}>
        <Btn label="Shuffle" kind="ghost" small onPress={() => setOrder(shuffled(order, Math.random))} />
        <Btn label="Clear" kind="ghost" small onPress={() => setSel([])} disabled={!sel.length} />
        <Btn label="Check" small onPress={check} disabled={sel.length !== 4} />
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  prompt: { fontFamily: F.med, fontSize: 14, color: C.soft, textAlign: 'center', marginBottom: 10 },
  group: { borderRadius: 14, paddingVertical: 12, alignItems: 'center', gap: 2 },
  groupName: { fontFamily: F.bold, fontSize: 12, letterSpacing: 1.2, color: C.ink },
  groupWords: { fontFamily: F.med, fontSize: 14, color: C.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  tile: { width: '23.2%', borderRadius: 12, backgroundColor: C.key, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  tileT: { fontFamily: F.bold, color: C.ink },
  slips: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18 },
  slipT: { fontFamily: F.med, fontSize: 14, color: C.soft },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.line },
  msg: { fontFamily: F.bold, fontSize: 14, color: C.bad, textAlign: 'center', minHeight: 22, marginTop: 8 },
  buttons: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 4 },
});
