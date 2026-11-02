// Sleep (2 Nov 2026). Pick a sound or two from seven categories, set a timer, Tali fades it out. Its own dark
// purple and blue look, on purpose: the rest of the app is for the day, this is for bed.
// Engine and prefs live in lib/sleep.ts so sound keeps going if you leave the screen.
import { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CATEGORIES, MAX_PICKS, SOUNDS, TIMERS, extend, fadeFactor, loadPrefs, pause, resume, setFade, setLevel, setTimer, setVolume, soundsIn, start, stop, timeLeft, togglePick, useSleep, type CategoryId, type SoundId } from '@/lib/sleep';

const ink = '#EEE9FF';
const muted = 'rgba(238,233,255,0.68)';
const faint = 'rgba(238,233,255,0.42)';
const glass = 'rgba(255,255,255,0.08)';
const line = 'rgba(255,255,255,0.14)';
const accent = '#B9A6FF';
const accent2 = '#7FD1FF';
const bg = '#1B2450';
const DIM_AFTER_MS = 20_000;

function Bar({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const width = useRef(1);
  const setFrom = (x: number) => onChange(Math.max(0, Math.min(1, x / width.current)));
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => (width.current = e.nativeEvent.layout.width || 1)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => setFrom(e.nativeEvent.locationX)}
      onResponderMove={(e) => setFrom(e.nativeEvent.locationX)}
      style={{ paddingVertical: 12 }}
      accessibilityRole="adjustable"
      accessibilityValue={{ now: Math.round(value * 100), min: 0, max: 100 }}>
      <View style={s.track}>
        <View style={[s.fill, { width: `${value * 100}%` }]} />
        <View style={[s.knob, { left: `${value * 100}%` }]} />
      </View>
    </View>
  );
}

export default function Sleep() {
  const st = useSleep();
  const [dim, setDim] = useState(false);
  const [cat, setCat] = useState<CategoryId>('noise');
  const dimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void loadPrefs();
  }, []);

  // Dim the screen after a while when playing. Any tap brings it back.
  const wake = () => {
    setDim(false);
    if (dimTimer.current) clearTimeout(dimTimer.current);
    if (st.status === 'playing') dimTimer.current = setTimeout(() => setDim(true), DIM_AFTER_MS);
  };
  useEffect(() => {
    wake();
    return () => {
      if (dimTimer.current) clearTimeout(dimTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.status]);

  const playing = st.status !== 'idle';
  const names = st.picks.map((p) => SOUNDS.find((x) => x.id === p.id)?.name).filter(Boolean);
  const left = timeLeft(st);
  const fading = st.fade && st.endsAt ? fadeFactor(st) < 1 : false;

  if (playing) {
    return (
      <SafeAreaView style={[s.safe, dim && { backgroundColor: '#05070F' }]}>
        <Pressable style={{ flex: 1 }} onPress={wake}>
          {dim ? (
            <View style={s.dimWrap}>
              <Text style={s.dimTime}>{left ?? '∞'}</Text>
              <Text style={s.dimSub}>{fading ? 'fading out' : 'tap to see controls'}</Text>
            </View>
          ) : (
            <View style={s.inner}>
              <View style={s.top}>
                <Pressable onPress={() => router.back()} hitSlop={12}>
                  <Text style={s.back}>{'‹'} Back</Text>
                </Pressable>
              </View>
              <View style={s.orbWrap}>
                <View style={s.ring2} />
                <View style={s.ring1} />
                <View style={s.orb}>
                  <Text style={s.orbTime}>{left ?? '∞'}</Text>
                  <Text style={s.orbSub}>{left ? (fading ? 'fading out now' : st.fade ? 'left, then a slow fade' : 'left') : 'until you stop it'}</Text>
                </View>
              </View>
              <Text style={s.np}>{names.join(' + ')}</Text>
              <Text style={s.npSub}>{st.status === 'paused' ? 'Paused' : 'Looping gently until the timer ends'}</Text>
              {st.picks.length === 2 ? (
                <View style={s.mixRow}>
                  {st.picks.map((p) => (
                    <View key={p.id} style={s.mixChip}>
                      <Text style={s.mixText}>
                        {SOUNDS.find((x) => x.id === p.id)?.name.split(' ')[0]} {Math.round(p.level * 100)}%
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={{ marginTop: 10 }}>
                <Bar value={st.volume} onChange={setVolume} />
                <View style={s.capRow}>
                  <Text style={s.cap}>Quieter</Text>
                  <Text style={s.cap}>Louder</Text>
                </View>
              </View>
              <View style={s.ctl}>
                <Pressable style={s.small} onPress={() => extend(15)} accessibilityLabel="Add 15 minutes">
                  <Text style={s.smallText}>+15</Text>
                </Pressable>
                <Pressable style={s.big} onPress={() => (st.status === 'paused' ? resume() : pause())} accessibilityLabel={st.status === 'paused' ? 'Resume' : 'Pause'}>
                  <Text style={s.bigText}>{st.status === 'paused' ? '▶' : '❚❚'}</Text>
                </Pressable>
                <Pressable style={s.small} onPress={stop} accessibilityLabel="Stop">
                  <Text style={s.smallText}>✕</Text>
                </Pressable>
              </View>
              <Text style={s.note}>
                Screen dims in a bit. Tap anywhere to see the time.{'\n'}
                {Platform.OS === 'web' ? 'Keep this tab open. Sound stops if the browser is closed.' : 'Keeps playing with the phone locked.'}
              </Text>
              <View style={s.taliRow}>
                <View style={s.bubble}>
                  <Text style={s.bubbleText}>Night. Your brief will be ready in the morning.</Text>
                </View>
                <Image source={require('@/assets/tali/tali_idle.png')} style={{ width: 54, height: 54 }} resizeMode="contain" />
              </View>
            </View>
          )}
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.inner}>
        <View style={s.top}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={s.back}>{'‹'} Me</Text>
          </Pressable>
        </View>
        <Text style={s.h1}>Sleep</Text>
        <Text style={s.sub}>Pick a sound or two, set the timer, and Tali fades it out once you're under.</Text>

        <Text style={s.label}>Sounds</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cats} style={{ marginHorizontal: -20 }}>
          {CATEGORIES.map((c) => {
            const on = c.id === cat;
            const count = st.picks.filter((p) => SOUNDS.find((x) => x.id === p.id)?.category === c.id).length;
            return (
              <Pressable key={c.id} onPress={() => setCat(c.id)} style={[s.chip, on && s.chipOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                <Text style={[s.chipText, on && { color: '#1B1340' }]}>
                  {c.emoji} {c.name}
                </Text>
                {count ? (
                  <View style={[s.badge, on && { backgroundColor: '#1B1340' }]}>
                    <Text style={[s.badgeText, on && { color: accent }]}>{count}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={s.grid}>
          {soundsIn(cat).map((snd) => {
            const on = st.picks.some((p) => p.id === snd.id);
            const full = !on && st.picks.length >= MAX_PICKS;
            return (
              <Pressable key={snd.id} onPress={() => togglePick(snd.id)} style={[s.tile, on && s.tileOn, full && { opacity: 0.55 }]} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                <Text style={{ fontSize: 22 }}>{snd.emoji}</Text>
                <Text style={s.tileName}>{snd.name}</Text>
                <Text style={s.tileSub}>{snd.sub}</Text>
                {on ? (
                  <View style={s.chk}>
                    <Text style={{ color: '#1B1340', fontWeight: '900', fontSize: 12 }}>✓</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <Text style={s.picked}>
          {st.picks.length ? `Picked: ${st.picks.map((p) => SOUNDS.find((x) => x.id === p.id)?.name).filter(Boolean).join(' + ')}` : `Pick up to ${MAX_PICKS} sounds from any category`}
        </Text>
        {st.picks.length === 2 ? (
          <View style={s.mixBox}>
            <Text style={s.mixTitle}>Mix</Text>
            {st.picks.map((p) => (
              <View key={p.id}>
                <View style={s.capRow}>
                  <Text style={s.mixText}>{SOUNDS.find((x) => x.id === p.id)?.name}</Text>
                  <Text style={s.cap}>{Math.round(p.level * 100)}%</Text>
                </View>
                <Bar value={p.level} onChange={(v) => setLevel(p.id as SoundId, v)} />
              </View>
            ))}
          </View>
        ) : null}

        <Text style={s.label}>Timer</Text>
        <View style={s.chips}>
          {TIMERS.map((t) => {
            const on = st.timerMinutes === t.minutes;
            return (
              <Pressable key={t.label} onPress={() => setTimer(t.minutes)} style={[s.chip, on && s.chipOn]}>
                <Text style={[s.chipText, on && { color: '#1B1340' }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle}>Fade out at the end</Text>
            <Text style={s.rowSub}>{st.timerMinutes ? 'Last 5 minutes get quieter, then it stops' : 'Needs a timer'}</Text>
          </View>
          <Switch value={st.fade && !!st.timerMinutes} onValueChange={setFade} disabled={!st.timerMinutes} trackColor={{ true: accent, false: 'rgba(255,255,255,0.2)' }} thumbColor="#fff" />
        </View>

        <Pressable style={[s.cta, !st.picks.length && { opacity: 0.5 }]} disabled={!st.picks.length} onPress={() => void start()} accessibilityRole="button">
          <Text style={s.ctaText}>▶  Start{st.timerMinutes ? `, ${TIMERS.find((t) => t.minutes === st.timerMinutes)?.label.replace(' min', ' minutes')}` : ''}</Text>
        </Pressable>
        <Text style={s.ghost}>{Platform.OS === 'web' ? 'Plays while this tab is open. No credits.' : 'Keeps playing with the screen off. No credits.'}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: bg },
  inner: { padding: 20, paddingBottom: 40, flexGrow: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { fontSize: 15, color: accent, fontWeight: '700' },
  h1: { fontSize: 30, fontWeight: '800', color: ink, marginTop: 14, marginBottom: 2 },
  sub: { color: muted, fontSize: 14, lineHeight: 20, marginBottom: 6 },
  label: { fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: faint, fontWeight: '800', marginTop: 18, marginBottom: 8 },
  cats: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  badge: { marginLeft: 6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#1B1340', fontSize: 11, fontWeight: '800' },
  picked: { color: muted, fontSize: 12, marginTop: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', flexGrow: 1, backgroundColor: glass, borderWidth: 1, borderColor: line, borderRadius: 18, padding: 14, minHeight: 92 },
  tileOn: { backgroundColor: 'rgba(185,166,255,0.22)', borderColor: 'rgba(185,166,255,0.6)' },
  tileName: { color: ink, fontSize: 15, fontWeight: '700', marginTop: 8 },
  tileSub: { color: muted, fontSize: 12, marginTop: 2 },
  chk: { position: 'absolute', top: 10, right: 10, width: 20, height: 20, borderRadius: 10, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' },
  mixBox: { marginTop: 12, backgroundColor: glass, borderWidth: 1, borderColor: line, borderRadius: 16, padding: 14 },
  mixTitle: { color: faint, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: line, backgroundColor: glass },
  chipOn: { backgroundColor: accent, borderColor: accent },
  chipText: { color: ink, fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: glass, borderWidth: 1, borderColor: line, borderRadius: 16, padding: 14, marginTop: 12 },
  rowTitle: { color: ink, fontSize: 14, fontWeight: '700' },
  rowSub: { color: muted, fontSize: 12, marginTop: 2 },
  cta: { marginTop: 22, height: 54, borderRadius: 16, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#141033', fontWeight: '800', fontSize: 16 },
  ghost: { textAlign: 'center', color: muted, fontSize: 12, marginTop: 10 },
  orbWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 26, height: 300 },
  ring1: { position: 'absolute', width: 266, height: 266, borderRadius: 133, borderWidth: 1, borderColor: 'rgba(185,166,255,0.25)' },
  ring2: { position: 'absolute', width: 310, height: 310, borderRadius: 155, borderWidth: 1, borderColor: 'rgba(127,209,255,0.14)' },
  orb: { width: 230, height: 230, borderRadius: 115, backgroundColor: 'rgba(185,166,255,0.28)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(127,209,255,0.35)' },
  orbTime: { color: ink, fontSize: 44, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  orbSub: { color: muted, fontSize: 12, marginTop: 2 },
  np: { color: ink, fontSize: 18, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  npSub: { color: muted, fontSize: 13, textAlign: 'center', marginTop: 2 },
  mixRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 12 },
  mixChip: { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  mixText: { color: ink, fontSize: 12, fontWeight: '700' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.14)' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2, backgroundColor: accent2 },
  knob: { position: 'absolute', top: -6, width: 16, height: 16, marginLeft: -8, borderRadius: 8, backgroundColor: '#fff' },
  capRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cap: { color: faint, fontSize: 11 },
  ctl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28, marginTop: 22 },
  small: { width: 44, height: 44, borderRadius: 22, backgroundColor: glass, borderWidth: 1, borderColor: line, alignItems: 'center', justifyContent: 'center' },
  smallText: { color: muted, fontSize: 14, fontWeight: '700' },
  big: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  bigText: { color: '#141033', fontSize: 24, fontWeight: '900' },
  note: { textAlign: 'center', color: muted, fontSize: 12, lineHeight: 18, marginTop: 16 },
  taliRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 8, marginTop: 'auto', paddingTop: 20 },
  bubble: { backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: line, borderRadius: 14, padding: 10, maxWidth: 220 },
  bubbleText: { color: ink, fontSize: 12, lineHeight: 16 },
  dimWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dimTime: { color: 'rgba(238,233,255,0.35)', fontSize: 40, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dimSub: { color: 'rgba(238,233,255,0.22)', fontSize: 12, marginTop: 6 },
});
