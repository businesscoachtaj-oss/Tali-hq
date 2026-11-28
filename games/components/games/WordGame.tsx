// Six Tries (5 letters, everyone and Gentle) and Word Hop (4 letters with a picture, Kids).
import { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { C, F } from '../theme';
import { useScale } from '../ui';
import type { Finish } from '../game';
import { sound } from '../../lib/sound';

type Mark = 'hit' | 'near' | 'miss';
export function marks(guess: string, answer: string): Mark[] {
  const n = answer.length; const out: Mark[] = Array(n).fill('miss'); const left: Record<string, number> = {};
  for (let i = 0; i < n; i++) { if (guess[i] === answer[i]) out[i] = 'hit'; else left[answer[i]] = (left[answer[i]] || 0) + 1; }
  for (let i = 0; i < n; i++) if (out[i] !== 'hit' && left[guess[i]]) { out[i] = 'near'; left[guess[i]]--; }
  return out;
}
const QWERTY = ['QWERTYUIOP', 'ASDFGHJKL', '↵ZXCVBNM⌫'];
const ABC = ['ABCDEFG', 'HIJKLMN', 'OPQRSTU', '⌫VWXYZ↵'];

export default function WordGame({ answer, valid, finish, clue, kids, start = [], typed = '', tries = 6, hint, strict }: { answer: string; valid: (w: string) => boolean; finish: Finish; clue?: string; kids?: boolean; start?: string[]; typed?: string; tries?: number; hint?: boolean; strict?: boolean }) {
  const n = answer.length; const scale = useScale();
  const [shown, setShown] = useState<number | null>(null);
  const COL = { hit: kids ? '#3E9B57' : C.teal, near: kids ? '#E0A82E' : C.amber, miss: '#A39B8C' } as const;
  const [guesses, setGuesses] = useState<string[]>(start);
  const [cur, setCur] = useState(typed);
  const [msg, setMsg] = useState('');
  const shake = useRef(new Animated.Value(0)).current;
  const won = guesses.includes(answer); const over = won || guesses.length >= tries;
  const keyMark: Record<string, Mark> = {};
  guesses.forEach(g => marks(g, answer).forEach((m, i) => { const k = g[i]; if (keyMark[k] !== 'hit' && !(keyMark[k] === 'near' && m === 'miss')) keyMark[k] = m; }));
  const nope = (t: string) => { setMsg(t); sound.bad(); Animated.sequence([0, 1, 2, 3].map(i => Animated.timing(shake, { toValue: i === 3 ? 0 : i % 2 ? -8 : 8, duration: 60, useNativeDriver: true }))).start(); };
  function press(k: string) {
    if (over) return; setMsg('');
    if (k === '⌫') return setCur(cur.slice(0, -1));
    if (k === '↵') {
      if (cur.length < n) return nope(kids ? `${n} letters, please!` : 'Not enough letters');
      if (!valid(cur)) return nope(kids ? 'Hmm, try another word' : 'Not in our word list');
      if (strict) { // Hard: letters you've found must be used, the right-spot ones in the same spot
        for (const g of guesses) { const m = marks(g, answer); for (let i = 0; i < n; i++) { if (m[i] === 'hit' && cur[i] !== g[i]) return nope(`Letter ${i + 1} must be ${g[i]}`); if (m[i] === 'near' && !cur.includes(g[i])) return nope(`Use the ${g[i]} you found`); } }
      }
      const next = [...guesses, cur]; setGuesses(next); setCur('');
      if (cur === answer || next.length >= tries) {
        const win = cur === answer;
        const grid = next.map(g => marks(g, answer).map(m => (m === 'hit' ? '🟩' : m === 'near' ? '🟨' : '⬜')).join('')).join('\n');
        setTimeout(() => finish({ won: win, score: win ? next.length : 0, detail: win ? `${next.length} of ${tries}` : `The word was ${answer}`, share: grid, stars: win ? (next.length <= 3 ? 3 : next.length <= 4 ? 2 : 1) : 1 }), 900);
      }
      return;
    }
    if (cur.length < n) setCur(cur + k);
  }
  const rows = [...guesses.map(g => ({ g, m: marks(g, answer) as Mark[] | null })), ...(guesses.length < tries ? [{ g: cur, m: null }] : [])];
  while (rows.length < tries) rows.push({ g: '', m: null });
  const cell = n <= 3 ? 72 : n === 4 ? 62 : n === 6 ? 52 : scale > 1.1 ? 64 : 58;
  return (
    <View style={{ flex: 1 }}>
      {clue ? <View style={s.clue}><Text style={{ fontSize: 46 }}>{clue}</Text><Text style={s.clueT}>What's the word?</Text></View> : null}
      <View style={[s.board, { gap: 7 }]}>
        {rows.map((r, ri) => (
          <Animated.View key={ri} style={[s.row, ri === guesses.length && { transform: [{ translateX: shake }] }]}>
            {Array.from({ length: n }).map((_, i) => {
              const ch = r.g[i] || ''; const m = r.m?.[i];
              return (
                <View key={i} style={[s.cell, { width: cell, height: cell }, ch && !m && s.typed, m && { backgroundColor: COL[m], borderColor: COL[m] }]}>
                  <Text style={[s.cellT, { fontSize: cell * 0.48 }, m && { color: '#fff' }]}>{ch}</Text>
                </View>
              );
            })}
          </Animated.View>
        ))}
      </View>
      {hint && !over ? <Text onPress={() => setShown(shown ?? [...Array(n).keys()].find(i => !guesses.some(g => g[i] === answer[i])) ?? 0)} style={s.hintBtn}>{shown === null ? 'Show me a letter' : `Letter ${shown + 1} is ${answer[shown]}`}</Text> : null}
      <Text style={[s.hint, { fontSize: 14 * Math.min(scale, 1.3) }, msg && { color: C.bad, fontFamily: F.bold }]}>{msg || (won ? `Got it: ${answer}` : over ? `The word was ${answer}` : kids ? 'Green is the right spot. Yellow is in the word.' : 'Teal is the right spot. Amber is in the word.')}</Text>
      <View style={s.keys}>
        {(kids ? ABC : QWERTY).map((row, ri) => (
          <View key={ri} style={s.keyRow}>
            {row.split('').map(k => {
              const m = keyMark[k]; const wide = k === '↵' || k === '⌫';
              return (
                <Pressable key={k} onPress={() => press(k)} accessibilityRole="button" accessibilityLabel={k === '↵' ? 'Enter' : k === '⌫' ? 'Delete' : k}
                  style={({ pressed }) => [s.key, { height: 50 * Math.min(scale, 1.15), maxWidth: kids ? 46 : 34 }, wide && s.keyWide, m && { backgroundColor: COL[m] }, pressed && { opacity: 0.7 }]}>
                  <Text style={[s.keyT, { fontSize: 15 * Math.min(scale, 1.2) }, m && { color: '#fff' }, wide && { fontSize: 13 }]}>{k === '↵' ? (kids ? 'Go' : 'Enter') : k}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  clue: { alignItems: 'center', marginTop: 2, marginBottom: 4 },
  clueT: { fontFamily: F.display, fontSize: 18, color: C.ink },
  board: { alignSelf: 'center', marginTop: 8 },
  row: { flexDirection: 'row', gap: 7 },
  cell: { borderRadius: 14, borderWidth: 2, borderColor: C.line, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  typed: { borderColor: C.ink },
  cellT: { fontFamily: F.display, color: C.ink },
  hint: { fontFamily: F.med, fontSize: 14, color: C.soft, textAlign: 'center', marginTop: 14, paddingHorizontal: 24, minHeight: 20 },
  hintBtn: { fontFamily: F.bold, fontSize: 14, color: C.teal, textAlign: 'center', marginTop: 10 },
  keys: { marginTop: 'auto', paddingHorizontal: 6, paddingBottom: 28, gap: 8 },
  keyRow: { flexDirection: 'row', justifyContent: 'center', gap: 5 },
  key: { flex: 1, borderRadius: 10, backgroundColor: C.key, alignItems: 'center', justifyContent: 'center' },
  keyWide: { maxWidth: 58, flex: 1.5 },
  keyT: { fontFamily: F.bold, color: C.ink },
});
