// Trail: every letter belongs to one word on today's theme. The words snake through the grid on a path
// worked out from today's date, so the grid is the same for everyone and different every day.
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { C, F } from '../theme';
import { Btn } from '../ui';
import type { Finish } from '../game';
import { rng } from '../../lib/daily';

let COLS = 6, ROWS = 8, N = 48;
const near = (i: number) => { const r = Math.floor(i / COLS), c = i % COLS, out: number[] = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) out.push(rr * COLS + cc); } return out; };
// A path through every cell once (Warnsdorff's rule with seeded tie breaks, retried until it works).
function snake(seed: number): number[] {
  for (let t = 0; t < 200; t++) {
    const r = rng(seed + t); const seen = new Set<number>(); let at = Math.floor(r() * N); const path = [at]; seen.add(at);
    while (path.length < N) {
      const opts = near(at).filter(x => !seen.has(x)); if (!opts.length) break;
      opts.sort((a, b) => near(a).filter(x => !seen.has(x)).length - near(b).filter(x => !seen.has(x)).length || r() - 0.5);
      at = opts[0]; path.push(at); seen.add(at);
    }
    if (path.length === N) return path;
  }
  return Array.from({ length: N }, (_, i) => i);
}
const GOLD = '#E2B13C';
export default function Trail({ theme, words, seed, finish, startFound = [], cols = 6, rows = 8, firstLetters }: { theme: string; words: string[]; seed: number; finish: Finish; startFound?: string[]; cols?: number; rows?: number; firstLetters?: boolean }) {
  COLS = cols; ROWS = rows; N = cols * rows;
  const { grid, cellsOf } = useMemo(() => {
    const p = snake(seed); const grid: string[] = Array(N).fill(''); const cellsOf: Record<string, number[]> = {}; let k = 0;
    for (const w of words) { cellsOf[w] = []; for (const ch of w) { grid[p[k]] = ch; cellsOf[w].push(p[k]); k++; } }
    return { grid, cellsOf };
  }, [seed, words, cols, rows]);
  const [found, setFound] = useState<string[]>(startFound);
  const [sel, setSel] = useState<number[]>([]);
  const [hints, setHints] = useState(0);
  const [hinted, setHinted] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const owner = (i: number) => found.find(w => cellsOf[w].includes(i));
  const adj = (a: number, b: number) => near(a).includes(b);
  function tap(i: number) {
    setMsg('');
    if (owner(i)) return;
    if (sel.length && sel[sel.length - 1] === i) return check(sel);
    if (sel.includes(i)) return setSel(sel.slice(0, sel.indexOf(i) + 1));
    if (sel.length && !adj(sel[sel.length - 1], i)) return setSel([i]);
    setSel([...sel, i]);
  }
  function check(cells: number[]) {
    const word = cells.map(i => grid[i]).join('');
    const hit = words.find(w => !found.includes(w) && cellsOf[w].length === cells.length && cellsOf[w].every((c, k) => c === cells[k]));
    if (hit) {
      const nf = [...found, hit]; setFound(nf); setSel([]); setHinted(null); setMsg(`${hit[0]}${hit.slice(1).toLowerCase()}!`);
      if (nf.length === words.length) setTimeout(() => finish({ won: true, score: words.length, detail: `All ${words.length} words${hints ? `, ${hints} hint${hints === 1 ? '' : 's'}` : ', no hints'}`, share: words.map(() => '🟢').join('') + (hints ? ' ' + '💡'.repeat(hints) : '') }), 900);
    } else { setMsg(word.length < 3 ? 'Too short' : words.includes(word) ? 'Right word, try another path' : 'Not one of today\'s words'); setSel([]); }
  }
  function hint() { const next = words.find(w => !found.includes(w)); if (!next) return; setHints(hints + 1); setHinted(cellsOf[next][0]); setMsg(`A word starts with the glowing letter`); }
  const typed = sel.map(i => grid[i]).join('');
  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
      <View style={s.theme}><Text style={s.themeK}>TODAY'S THEME</Text><Text style={s.themeT}>{theme}</Text></View>
      <Text style={s.typed}>{typed || ' '}</Text>
      <View style={[s.grid, { width: cols * 52 }]}>
        {grid.map((ch, i) => {
          const w = owner(i); const on = sel.includes(i); const first = firstLetters && words.some(x => !found.includes(x) && cellsOf[x][0] === i);
          return (
            <Pressable key={i} onPress={() => tap(i)} accessibilityRole="button" accessibilityLabel={ch} style={s.cellWrap}>
              <View style={[s.cell, w && { backgroundColor: C.moss }, on && { backgroundColor: C.ink }, (hinted === i || first) && !w && { borderWidth: 2.5, borderColor: GOLD }]}>
                <Text style={[s.cellT, (w || on) && { color: C.cream }]}>{ch}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={s.msg}>{msg || `${found.length} of ${words.length} words found${firstLetters ? '. Gold letters start a word.' : ''}`}</Text>
      <View style={s.row}>
        <Btn label={`Hint${hints ? ` (${hints})` : ''}`} kind="ghost" small onPress={hint} />
        <Btn label="Clear" kind="ghost" small onPress={() => setSel([])} disabled={!sel.length} />
        <Btn label="Enter" small onPress={() => check(sel)} disabled={sel.length < 3} />
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  theme: { alignSelf: 'center', backgroundColor: C.mossSoft, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 8, alignItems: 'center' },
  themeK: { fontFamily: F.bold, fontSize: 10, letterSpacing: 1.4, color: C.moss },
  themeT: { fontFamily: F.display, fontSize: 20, color: C.ink },
  typed: { fontFamily: F.display, fontSize: 22, color: C.ink, textAlign: 'center', letterSpacing: 3, minHeight: 32, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'center' },
  cellWrap: { width: 52, height: 50, alignItems: 'center', justifyContent: 'center' },
  cell: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cellT: { fontFamily: F.display, fontSize: 21, color: C.ink },
  msg: { fontFamily: F.med, fontSize: 14, color: C.soft, textAlign: 'center', marginTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 10 },
});
