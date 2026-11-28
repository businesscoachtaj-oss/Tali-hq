// Recall: squares light up one by one, tap them back in order. One more each round, three lives.
import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { C, F } from '../theme';
import { Btn, useScale } from '../ui';
import type { Finish } from '../game';
import { todayRng } from '../../lib/daily';

export default function Recall({ finish, demo, size = 4, startLen = 3, ms = 600 }: { finish: Finish; gentle?: boolean; demo?: boolean; size?: number; startLen?: number; ms?: number }) {
  const scale = useScale(); const cells = size * size;
  const r = useRef(todayRng(5)).current;
  const [seq, setSeq] = useState<number[]>(demo ? [5, 2, 9, 14, 7] : []);
  const [lit, setLit] = useState<number | null>(null);
  const [mode, setMode] = useState<'ready' | 'show' | 'you' | 'over'>(demo ? 'you' : 'ready');
  const [pos, setPos] = useState(demo ? 2 : 0);
  const [lives, setLives] = useState(demo ? 2 : 3);
  const [flash, setFlash] = useState<{ i: number; ok: boolean } | null>(null);
  const best = useRef(0);
  // The flashes get quicker every round, on every level (never faster than 250 ms).
  const show = (s: number[]) => {
    const speed = Math.max(250, ms * Math.pow(0.95, Math.max(0, s.length - startLen)));
    setMode('show'); let k = 0;
    const step = () => { if (k >= s.length) { setLit(null); setMode('you'); setPos(0); return; } setLit(s[k]); setTimeout(() => { setLit(null); k++; setTimeout(step, speed * 0.35); }, speed); };
    setTimeout(step, 500);
  };
  const begin = () => { const s = Array.from({ length: startLen }, () => Math.floor(r() * cells)); setSeq(s); show(s); };
  function tap(i: number) {
    if (mode !== 'you') return;
    if (i === seq[pos]) {
      setFlash({ i, ok: true }); setTimeout(() => setFlash(null), 180);
      if (pos + 1 === seq.length) { best.current = Math.max(best.current, seq.length); const s = [...seq, Math.floor(r() * cells)]; setSeq(s); setTimeout(() => show(s), 500); }
      else setPos(pos + 1);
    } else {
      setFlash({ i, ok: false }); setTimeout(() => setFlash(null), 300);
      const l = lives - 1; setLives(l);
      if (l <= 0) { setMode('over'); const b = best.current || seq.length - 1; setTimeout(() => finish({ score: b, detail: `You remembered ${b} in a row`, share: `🧠 ${b}`, stars: b >= 7 ? 3 : b >= 5 ? 2 : 1 }), 700); }
      else setTimeout(() => show(seq), 600);
    }
  }
  const W = Math.min(330, 300 * Math.min(scale, 1.15)); const gap = 10; const cell = (W - gap * (size - 1)) / size;
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={s.big}>{seq.length || startLen}</Text>
      <Text style={s.sub}>{mode === 'show' ? 'Watch…' : mode === 'you' ? `Your turn: ${pos} of ${seq.length}` : mode === 'over' ? 'Well done' : 'squares to remember'}</Text>
      <View style={[s.grid, { width: W, gap }]}>
        {Array.from({ length: cells }).map((_, i) => (
          <Pressable key={i} onPress={() => tap(i)} accessibilityRole="button" accessibilityLabel={`Square ${i + 1}`}
            style={[s.cell, { width: cell, height: cell }, lit === i && { backgroundColor: C.sky }, flash?.i === i && { backgroundColor: flash.ok ? C.teal : C.bad }]} />
        ))}
      </View>
      <Text style={s.lives}>{'♥'.repeat(lives)}<Text style={{ color: C.line }}>{'♥'.repeat(3 - lives)}</Text></Text>
      {mode === 'ready' ? <Btn label="Start" kind="colour" colour={C.sky} onPress={begin} style={{ marginTop: 10, minWidth: 180 }} /> : null}
    </View>
  );
}
const s = StyleSheet.create({
  big: { fontFamily: F.display, fontSize: 44, color: C.ink, marginTop: 6 },
  sub: { fontFamily: F.med, fontSize: 14, color: C.soft, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  lives: { fontSize: 22, color: C.bad, marginTop: 18 },
});
