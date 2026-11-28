// Breathe (everyone, Gentle) and Balloon (Kids): in for 4, out for 6, for two minutes.
// A longer breath out helps the body settle.
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { C, F } from '../theme';
import { Btn, Chips, Chip } from '../ui';
import type { Finish } from '../game';

export default function Breathe({ finish, kids, demo, cfg }: { finish: Finish; kids?: boolean; demo?: boolean; cfg: { name: string; pattern: number[] } }) {
  const [inS, hold1, outS, hold2] = cfg.pattern;
  const [mins, setMins] = useState(kids ? 1 : 2); const [on, setOn] = useState(false); const [left, setLeft] = useState(0); const [phase, setPhase] = useState(demo ? 'Breathe in' : '');
  const size = useRef(new Animated.Value(demo ? 0.8 : 0.45)).current;
  useEffect(() => {
    if (!on) return; let stop = false; const total = mins * 60; const t0 = Date.now();
    const tick = setInterval(() => { const l = Math.max(0, total - Math.round((Date.now() - t0) / 1000)); setLeft(l); if (l === 0) { clearInterval(tick); stop = true; setOn(false); finish({ score: mins, detail: `${mins} minute${mins === 1 ? '' : 's'} of slow breathing`, stars: 3, share: '🌬️' }); } }, 500);
    const wait = (s: number, label: string, next: () => void) => { if (stop) return; if (!s) return next(); setPhase(label); setTimeout(next, s * 1000); };
    const cycle = () => { if (stop) return; setPhase(kids ? 'Breathe in, fill the balloon' : `Breathe in for ${inS}`);
      Animated.timing(size, { toValue: 1, duration: inS * 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }).start(() => wait(hold1, `Hold for ${hold1}`, () => { if (stop) return; setPhase(kids ? 'Slowly let it out' : `Breathe out for ${outS}`);
        Animated.timing(size, { toValue: 0.45, duration: outS * 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }).start(() => wait(hold2, `Hold for ${hold2}`, cycle)); })); };
    cycle(); return () => { stop = true; clearInterval(tick); size.stopAnimation(); };
  }, [on]);
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 20 }}>
      <View style={s.stage}>
        <Animated.View style={[s.circle, kids && { backgroundColor: 'transparent' }, { transform: [{ scale: size }] }]}>
          {kids ? <Text style={{ fontSize: 200 }}>🎈</Text> : null}
        </Animated.View>
        <Text style={[s.phase, kids && { position: 'relative', marginTop: 8 }]}>{phase || (kids ? 'Ready to blow up the balloon?' : 'Find a comfy spot')}</Text>
      </View>
      {on ? <Text style={s.left}>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} left</Text> : (
        <View style={{ alignItems: 'center', gap: 14 }}>
          <Chips>{(kids ? [1, 2] : [1, 2, 5]).map(m => <Chip key={m} label={`${m} min`} on={mins === m} onPress={() => setMins(m)} colour={C.slate} />)}</Chips>
          <Btn label="Start" kind="colour" colour={kids ? C.clay : '#5D6577'} onPress={() => setOn(true)} style={{ minWidth: 200 }} />
          <Text style={s.note}>{cfg.name}: {cfg.pattern.filter(Boolean).join(', ')}. If you feel dizzy, stop and breathe normally.</Text>
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  stage: { height: 380, width: '100%', alignItems: 'center', justifyContent: 'center' },
  circle: { width: 260, height: 260, borderRadius: 140, backgroundColor: '#C9D3E3', alignItems: 'center', justifyContent: 'center' },
  phase: { position: 'absolute', fontFamily: F.display, fontSize: 24, color: C.ink, textAlign: 'center' },
  left: { fontFamily: F.med, fontSize: 16, color: C.soft },
  note: { fontFamily: F.body, fontSize: 13, color: C.soft, textAlign: 'center', maxWidth: 300 },
});
