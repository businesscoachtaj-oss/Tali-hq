// Read the Room (everyone, Gentle): a short moment, what are they most likely feeling, and why.
// Feelings (Kids): a face, pick the feeling.
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { C, F } from '../theme';
import { Btn, useScale } from '../ui';
import type { Finish } from '../game';
import { todayRng, shuffled } from '../../lib/daily';
import { KID_FEELINGS, ROOM_MOMENTS } from '../../lib/content';

const EXTRA = ['Relieved', 'Bored', 'Jealous', 'Embarrassed', 'Confused', 'Calm', 'Nervous', 'Proud', 'Guilty', 'Hopeful', 'Lonely', 'Amused'];
const KID_EXTRA = ['Silly', 'Bored', 'Sleepy', 'Proud', 'Shy', 'Calm'];
export default function Choice({ finish, kids, demo, options = 4 }: { finish: Finish; kids?: boolean; demo?: boolean; options?: number }) {
  const scale = useScale();
  const qs = useMemo(() => {
    const r = todayRng(kids ? 41 : 43);
    const pool = kids ? KID_FEELINGS.map(f => ({ top: f.face, right: f.right, other: f.other, why: '' })) : ROOM_MOMENTS.map(m => ({ top: m.moment, right: m.right, other: m.other, why: m.why }));
    return shuffled(pool, r).slice(0, kids ? 6 : 5).map(q => { const more = shuffled((kids ? KID_EXTRA : EXTRA).filter(x => x !== q.right && !q.other.includes(x)), r); return { ...q, opts: shuffled([q.right, ...[...q.other, ...more].slice(0, options - 1)], r) }; });
  }, [kids, options]);
  const [k, setK] = useState(0); const [pick, setPick] = useState<string | null>(demo ? qs[0].right : null); const [right, setRight] = useState(0);
  const Q = qs[k];
  function choose(o: string) { if (pick) return; setPick(o); if (o === Q.right) setRight(right + 1); }
  function next() {
    if (k + 1 >= qs.length) { const n = right; finish({ score: n, detail: `${n} of ${qs.length}`, share: `💬 ${n}/${qs.length}`, stars: n >= qs.length - 1 ? 3 : n >= qs.length / 2 ? 2 : 1 }); return; }
    setK(k + 1); setPick(null);
  }
  return (
    <View style={{ flex: 1, paddingHorizontal: 20 }}>
      <Text style={s.count}>{k + 1} of {qs.length}</Text>
      <View style={[s.card, kids && { alignItems: 'center', paddingVertical: 26 }]}>
        {kids ? <Text style={{ fontSize: 110 }}>{Q.top}</Text> : <Text style={[s.moment, { fontSize: 21 * Math.min(scale, 1.25), lineHeight: 29 * Math.min(scale, 1.25) }]}>{Q.top}</Text>}
        <Text style={s.ask}>{kids ? 'How is this person feeling?' : 'What are they most likely feeling?'}</Text>
      </View>
      <View style={s.opts}>
        {Q.opts.map(o => {
          const isRight = pick && o === Q.right; const isWrong = pick === o && o !== Q.right;
          return (
            <Pressable key={o} onPress={() => choose(o)} accessibilityRole="button" style={[s.opt, { paddingVertical: 15 * Math.min(scale, 1.2) }, isRight && { backgroundColor: C.teal, borderColor: C.teal }, isWrong && { backgroundColor: C.claySoft, borderColor: C.clay }]}>
              <Text style={[s.optT, { fontSize: 17 * Math.min(scale, 1.25) }, isRight && { color: '#fff' }]}>{o}</Text>
            </Pressable>
          );
        })}
      </View>
      {pick ? (
        <View style={{ gap: 10, marginTop: 12 }}>
          <Text style={s.why}>{pick === Q.right ? (kids ? 'Yes! 🎉' : 'Yes. ') : kids ? `It's ${Q.right.toLowerCase()}.` : `Most likely ${Q.right.toLowerCase()}. `}{kids ? '' : Q.why}</Text>
          <Btn label={k + 1 >= qs.length ? 'Finish' : 'Next'} onPress={next} />
        </View>
      ) : null}
    </View>
  );
}
const s = StyleSheet.create({
  count: { fontFamily: F.med, fontSize: 13, color: C.soft, textAlign: 'center', marginTop: 4, marginBottom: 10 },
  card: { backgroundColor: C.card, borderRadius: 22, borderWidth: 1, borderColor: C.line, padding: 20, gap: 12 },
  moment: { fontFamily: F.display, color: C.ink },
  ask: { fontFamily: F.med, fontSize: 14, color: C.soft },
  opts: { gap: 10, marginTop: 14 },
  opt: { borderRadius: 16, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card, alignItems: 'center' },
  optT: { fontFamily: F.bold, color: C.ink },
  why: { fontFamily: F.body, fontSize: 15, lineHeight: 22, color: C.ink, textAlign: 'center' },
});
