// Keys: tiles fall to a song. Tap each before it crosses the line and you hear the note. Easy, Medium and
// Hard have their own songs and starting speed, and on every level it keeps getting faster the longer you
// last. When the song ends it starts again, quicker. Today's song is the same for everyone.
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { C, F } from '../theme';
import { Btn } from '../ui';
import type { Finish } from '../game';
import { pickDaily } from '../../lib/daily';
import { P } from '../../lib/levels';
import { SONGS, tilesOf } from '../../lib/songs';
import { NOTE, tone, sound } from '../../lib/sound';
import type { Level } from '../../lib/store';

const LANE_COL = [C.clay, C.amber, C.plum, C.teal];
type Tile = { id: number; lane: number; y: number; note: string; hit?: boolean };
export default function Keys({ finish, demo, level = 'medium' }: { finish: Finish; demo?: boolean; level?: Level }) {
  const { height } = useWindowDimensions(); const cfg = P.keys[level];
  const song = useMemo(() => pickDaily(SONGS[level], 81 + level.length), [level]); const tune = useMemo(() => tilesOf(song), [song]);
  const H = Math.min(500, height - 330); const TILE = 88; const LINE = H - 64;
  const [tiles, setTiles] = useState<Tile[]>(demo ? [{ id: 1, lane: 1, y: cfg.chords ? 150 : 30, note: '' }, { id: 2, lane: 3, y: 150, note: '' }, { id: 3, lane: 0, y: 250, note: '' }, { id: 4, lane: 2, y: LINE - 40, note: '', hit: true }] : []);
  const [score, setScore] = useState(demo ? 86 : 0); const [misses, setMisses] = useState(demo ? 1 : 0); const [run, setRun] = useState(demo ? 12 : 0); const [loop, setLoop] = useState(demo ? 2 : 1); const [pace, setPace] = useState(demo ? 1.3 : 1);
  const [playing, setPlaying] = useState(false);
  const st = useRef({ tiles: [] as Tile[], t: 0, next: 0, k: 0, id: 0, score: 0, misses: 0, run: 0, best: 0, loop: 1 });
  useEffect(() => {
    if (!playing) return; let raf = 0; let last = performance.now();
    const loopFn = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; const g = st.current; g.t += dt;
      const speedUp = 1 + (g.t * cfg.ramp) / 170; // the longer you last, the faster it gets
      const speed = cfg.speed * speedUp; const beat = cfg.gap / speedUp;
      if (g.t >= g.next) {
        const n = tune[g.k]; g.tiles.push({ id: ++g.id, lane: n.lane, y: -TILE, note: n.note });
        if (cfg.chords && g.k % 8 === 7) g.tiles.push({ id: ++g.id, lane: (n.lane + 2) % 4, y: -TILE, note: n.note });
        g.next = g.t + Math.max(0.3, n.beats * beat); g.k++;
        if (g.k >= tune.length) { g.k = 0; g.loop++; setLoop(g.loop); g.next += beat; }
      }
      for (const t of g.tiles) t.y += speed * dt;
      const gone = g.tiles.filter(t => t.y > LINE && !t.hit);
      if (gone.length) { g.misses += gone.length; g.run = 0; setMisses(g.misses); setRun(0); sound.bad(); }
      g.tiles = g.tiles.filter(t => (t.y <= LINE || t.hit) && t.y < H);
      setTiles([...g.tiles]); setPace(speedUp);
      if (g.misses >= 3) { setPlaying(false); finish({ score: g.score, detail: `${g.score} points, best run ${g.best}, ${song.name}${g.loop > 1 ? ` x${g.loop}` : ''}`, share: `🎹 ${g.score}` }); return; }
      raf = requestAnimationFrame(loopFn);
    };
    raf = requestAnimationFrame(loopFn); return () => cancelAnimationFrame(raf);
  }, [playing]);
  function tap(t: Tile) {
    if (!playing || t.hit) return; const g = st.current; const tile = g.tiles.find(x => x.id === t.id); if (!tile) return;
    tile.hit = true; if (NOTE[tile.note]) tone(NOTE[tile.note], 320);
    g.run++; g.best = Math.max(g.best, g.run); g.score += 1 + Math.floor(g.run / 10) + (g.loop - 1); setScore(g.score); setRun(g.run);
  }
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={s.song}>♪ {song.name}  ·  {song.by}</Text>
      <Text style={s.score}>{score}</Text>
      <Text style={s.run}>{run ? `${run} in a row` : ' '}  ·  {'♥'.repeat(3 - misses)}<Text style={{ color: C.line }}>{'♥'.repeat(misses)}</Text>  ·  speed {pace.toFixed(1)}x{loop > 1 ? `  ·  round ${loop}` : ''}</Text>
      <View style={[s.stage, { height: H }]}>
        {[0, 1, 2, 3].map(l => <View key={l} style={[s.lane, l > 0 && s.laneLine]} />)}
        <View style={[s.line, { top: LINE }]} />
        {tiles.map(t => (
          <Pressable key={t.id} onPressIn={() => tap(t)} style={[s.tile, { left: `${t.lane * 25}%`, top: t.y, height: TILE, backgroundColor: t.hit ? C.tealSoft : LANE_COL[t.lane] }]}>
            {t.hit ? <Text style={s.tick}>♪</Text> : null}
          </Pressable>
        ))}
        {!playing && !demo ? (
          <View style={s.start}><Btn label={score ? 'Go again' : 'Start'} kind="colour" colour={C.clay} onPress={() => { st.current = { tiles: [], t: 0, next: 0.4, k: 0, id: 0, score: 0, misses: 0, run: 0, best: 0, loop: 1 }; setScore(0); setMisses(0); setRun(0); setLoop(1); setPace(1); setTiles([]); setPlaying(true); }} /></View>
        ) : null}
      </View>
      <Text style={s.foot}>{level === 'hard' ? 'Some notes come in pairs. Tap both.' : 'Tap the tiles before they cross the line.'} It speeds up the longer you last.</Text>
    </View>
  );
}
const s = StyleSheet.create({
  song: { fontFamily: F.med, fontSize: 13, color: C.clay },
  score: { fontFamily: F.display, fontSize: 40, color: C.ink },
  run: { fontFamily: F.med, fontSize: 12.5, color: C.soft, marginBottom: 8 },
  stage: { width: '88%', borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, overflow: 'hidden', flexDirection: 'row' },
  lane: { flex: 1 }, laneLine: { borderLeftWidth: 1, borderColor: C.line },
  line: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: C.clay, opacity: 0.4 },
  tile: { position: 'absolute', width: '25%', borderRadius: 10, borderWidth: 3, borderColor: C.card, alignItems: 'center', justifyContent: 'center' },
  tick: { fontSize: 22, color: C.teal, fontFamily: F.bold },
  start: { position: 'absolute', left: 0, right: 0, top: '42%', alignItems: 'center' },
  foot: { fontFamily: F.body, fontSize: 12.5, color: C.soft, marginTop: 10, textAlign: 'center', paddingHorizontal: 24 },
});
