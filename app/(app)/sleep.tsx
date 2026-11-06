// Sleep (2 Nov 2026). Pick a sound or two from seven categories, set a timer, Tali fades it out. Its own dark
// purple and blue look, on purpose: the rest of the app is for the day, this is for bed.
// Engine and prefs live in lib/sleep.ts so sound keeps going if you leave the screen.
// 3 Nov 2026: night sky look to match the mockup (gradient sky, stars, glowing orb, gradient button), and the
// player's back button now goes to the sound picker while playing instead of leaving the screen.
// 4 Nov 2026: Tali's sign off no longer promises a brief (Free has none); the sky lives in NightSky.tsx.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Sky, night } from '@/components/NightSky';
import { useAuth } from '@/lib/auth';
import { CATEGORIES, MAX_PICKS, SOUNDS, TIMERS, extend, fadeFactor, loadPrefs, pause, preview, resume, setFade, setLevel, setTimer, setVolume, soundsIn, start, stop, stopPreview, timeLeft, togglePick, useSleep, type CategoryId, type SoundId } from '@/lib/sleep';

// 4 Nov 2026: the sky, stars and palette moved to components/NightSky.tsx so Today can use them too.
const { ink, muted, faint, glass, line, accent, accent2 } = night;
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
        <LinearGradient colors={[accent, accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.fill, { width: `${value * 100}%` }]} />
        <View style={[s.knob, { left: `${value * 100}%` }]} />
      </View>
    </View>
  );
}

export default function Sleep() {
  const st = useSleep();
  const [dim, setDim] = useState(false);
  const [cat, setCat] = useState<CategoryId>('noise');
  // While a sound plays, the player shows; "Sounds" flips back to the picker without leaving the screen.
  const [showPicker, setShowPicker] = useState(false);
  const dimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clock = useMemo(() => new Date().toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', ' '), [st.status]);

  const { session } = useAuth();
  // Sounds, timer and volume are remembered per account (5 Nov 2026), not per phone.
  useEffect(() => {
    void loadPrefs(session?.user.id);
  }, [session?.user.id]);

  useEffect(() => {
    // A preview is only ever a taste; don't let one carry on after leaving the screen.
    return () => stopPreview();
  }, []);

  // Dim the screen after a while when playing. Any tap brings it back.
  const wake = () => {
    setDim(false);
    if (dimTimer.current) clearTimeout(dimTimer.current);
    if (st.status === 'playing' && !showPicker) dimTimer.current = setTimeout(() => setDim(true), DIM_AFTER_MS);
  };
  useEffect(() => {
    wake();
    return () => {
      if (dimTimer.current) clearTimeout(dimTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.status, showPicker]);

  // A fresh start always lands on the player.
  const prevStatus = useRef(st.status);
  useEffect(() => {
    if (prevStatus.current === 'idle' && st.status !== 'idle') setShowPicker(false);
    prevStatus.current = st.status;
  }, [st.status]);

  const playing = st.status !== 'idle';
  const names = st.picks.map((p) => SOUNDS.find((x) => x.id === p.id)?.name).filter(Boolean);
  const left = timeLeft(st);
  const fading = st.fade && st.endsAt ? fadeFactor(st) < 1 : false;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/me' as any));

  if (playing && !showPicker) {
    return (
      <Sky dark={dim}>
        <SafeAreaView style={s.safe}>
          <Pressable style={{ flex: 1 }} onPress={wake}>
            {dim ? (
              <View style={s.dimWrap}>
                <Text style={s.dimTime}>{left ?? '∞'}</Text>
                <Text style={s.dimSub}>{fading ? 'fading out' : 'tap to see controls'}</Text>
              </View>
            ) : (
              <View style={s.inner}>
                <View style={s.top}>
                  <Pressable onPress={() => setShowPicker(true)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back to sounds">
                    <Text style={s.back}>{'‹'} Sounds</Text>
                  </Pressable>
                  <Text style={s.clock}>{clock}</Text>
                </View>
                <View style={s.orbWrap}>
                  <View style={s.ring2} />
                  <View style={s.ring1} />
                  <View style={s.glow} />
                  <View style={s.orb}>
                    <View style={s.orbInner} />
                    <View style={s.orbShine} />
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
                  Screen dims in 20 seconds. Tap anywhere to see the time.{'\n'}
                  {Platform.OS === 'web' ? 'Keep this tab open. Sound stops if the browser is closed.' : "Tali won't send anything or make a sound until morning."}
                </Text>
                <View style={s.taliRow}>
                  <View style={s.bubble}>
                    <Text style={s.bubbleText}>G'night 😊 I'll be here in the morning.</Text>
                  </View>
                  <Image source={require('@/assets/tali/tali_idle.png')} style={{ width: 54, height: 54 }} resizeMode="contain" />
                </View>
              </View>
            )}
          </Pressable>
        </SafeAreaView>
      </Sky>
    );
  }

  return (
    <Sky>
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.inner}>
          {/* 6 Nov 2026 (Taj): compact layout so the whole picker fits on one screen. */}
          <View style={s.top}>
            <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button">
              <Text style={s.back}>{'‹'} Me</Text>
            </Pressable>
            <Text style={s.clock}>{clock}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
            <Text style={s.h1}>Sleep</Text>
            <Text style={[s.sub, { flex: 1 }]} numberOfLines={2}>Pick up to {MAX_PICKS} sounds, set a timer, and Tali fades it out.</Text>
          </View>

          {playing ? (
            <Pressable style={s.nowRow} onPress={() => setShowPicker(false)} accessibilityRole="button">
              <View style={{ flex: 1 }}>
                <Text style={s.nowTitle}>{st.status === 'paused' ? 'Paused' : 'Now playing'}: {names.join(' + ')}</Text>
                <Text style={s.nowSub}>{left ? `${left} left` : 'Until you stop it'}. Tap to go back to the timer.</Text>
              </View>
              <Text style={s.nowArrow}>{'›'}</Text>
            </Pressable>
          ) : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cats} style={{ marginHorizontal: -20, flexGrow: 0 }}>
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
                  {on ? <LinearGradient colors={['rgba(185,166,255,0.28)', 'rgba(127,209,255,0.18)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 17 }]} /> : null}
                  <Text style={{ fontSize: 18 }}>{snd.emoji}</Text>
                  <Text style={s.tileName} numberOfLines={1}>{snd.name}</Text>
                  <Text style={s.tileSub} numberOfLines={1}>{snd.sub}</Text>
                  {on ? (
                    <View style={s.chk}>
                      <Text style={{ color: '#1B1340', fontWeight: '900', fontSize: 12 }}>✓</Text>
                    </View>
                  ) : null}
                  <Pressable
                    onPress={() => void preview(snd.id)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={st.previewId === snd.id ? `Stop hearing ${snd.name}` : `Hear ${snd.name}`}
                    style={[s.hear, st.previewId === snd.id && s.hearOn]}>
                    <Text style={[s.hearText, st.previewId === snd.id && { color: '#1B1340' }]}>{st.previewId === snd.id ? '■' : '▶'}</Text>
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
          <Text style={s.picked} numberOfLines={1}>
            {st.picks.length ? `Picked: ${names.join(' + ')}` : 'Tap a sound to pick it, ▶ to hear five seconds'}
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

          <View style={[s.top, { marginTop: 16, marginBottom: 8 }]}>
            <Text style={[s.label, { marginTop: 0, marginBottom: 0 }]}>Timer</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: st.timerMinutes ? 1 : 0.5 }}>
              <Text style={s.rowSub}>Fade out the last 5 min</Text>
              <Switch value={st.fade && !!st.timerMinutes} onValueChange={setFade} disabled={!st.timerMinutes} trackColor={{ true: accent, false: 'rgba(255,255,255,0.2)' }} thumbColor="#fff" />
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cats} style={{ marginHorizontal: -20, flexGrow: 0 }}>
            {TIMERS.map((t) => {
              const on = st.timerMinutes === t.minutes;
              return (
                <Pressable key={t.label} onPress={() => setTimer(t.minutes)} style={[s.chip, on && s.chipOn]}>
                  <Text style={[s.chipText, on && { color: '#1B1340' }]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable style={[s.cta, !st.picks.length && { opacity: 0.5 }]} disabled={!st.picks.length} onPress={() => void start()} accessibilityRole="button">
            <LinearGradient colors={[accent, accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />
            <Text style={s.ctaText}>
              {playing ? '▶  Restart' : '▶  Start'}
              {st.timerMinutes ? `, ${TIMERS.find((t) => t.minutes === st.timerMinutes)?.label.replace(' min', ' minutes')}` : ''}
            </Text>
          </Pressable>
          <Text style={s.ghost}>{Platform.OS === 'web' ? 'Plays while this tab is open. No credits.' : 'Keeps playing with the screen off. No credits.'}</Text>

          {/* 6 Nov 2026 (Taj): the space under Start. A glowing moon with Tali dozing on a cloud. */}
          <View style={s.scene} pointerEvents="none">
            <View style={[s.moonGlow, { width: 220, height: 220, top: 0 }]} />
            <View style={[s.moonGlow, { width: 170, height: 170, top: 25 }]} />
            <View style={s.moon}>
              <View style={[s.crater, { width: 22, height: 22, left: 30, top: 34 }]} />
              <View style={[s.crater, { width: 14, height: 14, left: 76, top: 24 }]} />
              <View style={[s.crater, { width: 30, height: 30, left: 62, top: 66 }]} />
            </View>
            <View style={s.cloudWrap}>
              <View style={[s.puffBack, { width: 80, height: 50, left: 8, top: 66 }]} />
              <View style={[s.puffBack, { width: 80, height: 50, left: 92, top: 62 }]} />
              <Image source={require('@/assets/tali/tali_blink.png')} style={s.taliBody} resizeMode="contain" />
              <View style={[s.puff, { width: 78, height: 54, left: 0, top: 84 }]} />
              <View style={[s.puff, { width: 84, height: 62, left: 48, top: 74 }]} />
              <View style={[s.puff, { width: 76, height: 52, left: 104, top: 86 }]} />
              <View style={[s.puff, { width: 180, height: 34, left: 0, top: 108, borderRadius: 17 }]} />
            </View>
            <Text style={[s.zz, { left: '18%', top: 70, fontSize: 13 }]}>z</Text>
            <Text style={[s.zz, { left: '14%', top: 50, fontSize: 17 }]}>z</Text>
            <Text style={[s.zz, { left: '9%', top: 26, fontSize: 22 }]}>Z</Text>
            <Text style={s.sceneText}>Tali's dozing off too. Sweet dreams.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Sky>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  inner: { padding: 20, paddingBottom: 40, flexGrow: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { fontSize: 15, color: accent, fontWeight: '700' },
  clock: { fontSize: 13, color: faint, fontVariant: ['tabular-nums'] },
  h1: { fontSize: 26, fontWeight: '800', color: ink },
  sub: { color: muted, fontSize: 13, lineHeight: 18 },
  label: { fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: faint, fontWeight: '800', marginTop: 18, marginBottom: 8 },
  nowRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, backgroundColor: 'rgba(185,166,255,0.18)', borderWidth: 1, borderColor: 'rgba(185,166,255,0.5)', borderRadius: 16, padding: 14 },
  nowTitle: { color: ink, fontSize: 14, fontWeight: '800' },
  nowSub: { color: muted, fontSize: 12, marginTop: 2 },
  nowArrow: { color: accent, fontSize: 24, fontWeight: '800' },
  cats: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 10, paddingTop: 14 },
  badge: { marginLeft: 6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#1B1340', fontSize: 11, fontWeight: '800' },
  picked: { color: muted, fontSize: 12, marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '31%', flexGrow: 1, backgroundColor: glass, borderWidth: 1, borderColor: line, borderRadius: 16, padding: 10, paddingBottom: 12, overflow: 'hidden' },
  tileOn: { borderColor: 'rgba(185,166,255,0.6)' },
  tileName: { color: ink, fontSize: 13, fontWeight: '700', marginTop: 6 },
  tileSub: { color: muted, fontSize: 11, marginTop: 1 },
  chk: { position: 'absolute', top: 8, right: 38, width: 20, height: 20, borderRadius: 10, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' },
  hear: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: glass, borderWidth: 1, borderColor: line, alignItems: 'center', justifyContent: 'center' },
  hearOn: { backgroundColor: accent2, borderColor: accent2 },
  hearText: { color: ink, fontSize: 11, fontWeight: '800' },
  mixBox: { marginTop: 12, backgroundColor: glass, borderWidth: 1, borderColor: line, borderRadius: 16, padding: 14 },
  mixTitle: { color: faint, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: line, backgroundColor: glass },
  chipOn: { backgroundColor: accent, borderColor: accent },
  chipText: { color: ink, fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: glass, borderWidth: 1, borderColor: line, borderRadius: 16, padding: 14, marginTop: 12 },
  rowTitle: { color: ink, fontSize: 14, fontWeight: '700' },
  rowSub: { color: muted, fontSize: 12, marginTop: 2 },
  cta: { marginTop: 16, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shadowColor: accent2, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 18, elevation: 6 },
  ctaText: { color: '#141033', fontWeight: '800', fontSize: 16 },
  ghost: { textAlign: 'center', color: muted, fontSize: 12, marginTop: 10 },
  orbWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 26, height: 310 },
  ring1: { position: 'absolute', width: 266, height: 266, borderRadius: 133, borderWidth: 1, borderColor: 'rgba(185,166,255,0.25)' },
  ring2: { position: 'absolute', width: 310, height: 310, borderRadius: 155, borderWidth: 1, borderColor: 'rgba(127,209,255,0.14)' },
  glow: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(127,209,255,0.10)', shadowColor: accent2, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 60 },
  orb: { width: 230, height: 230, borderRadius: 115, backgroundColor: 'rgba(185,166,255,0.30)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shadowColor: accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 40 },
  orbInner: { position: 'absolute', width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(185,166,255,0.34)' },
  orbShine: { position: 'absolute', top: 10, left: 20, width: 150, height: 110, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.07)' },
  orbTime: { color: ink, fontSize: 48, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  orbSub: { color: muted, fontSize: 12, marginTop: 2 },
  np: { color: ink, fontSize: 20, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  npSub: { color: muted, fontSize: 13, textAlign: 'center', marginTop: 2 },
  mixRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 12 },
  mixChip: { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  mixText: { color: ink, fontSize: 12, fontWeight: '700' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.14)' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2 },
  knob: { position: 'absolute', top: -6, width: 16, height: 16, marginLeft: -8, borderRadius: 8, backgroundColor: '#fff' },
  capRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cap: { color: faint, fontSize: 11 },
  ctl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28, marginTop: 22 },
  small: { width: 44, height: 44, borderRadius: 22, backgroundColor: glass, borderWidth: 1, borderColor: line, alignItems: 'center', justifyContent: 'center' },
  smallText: { color: muted, fontSize: 14, fontWeight: '700' },
  big: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 30, elevation: 8 },
  bigText: { color: '#141033', fontSize: 24, fontWeight: '900' },
  note: { textAlign: 'center', color: muted, fontSize: 12, lineHeight: 18, marginTop: 16 },
  taliRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 8, marginTop: 'auto', paddingTop: 20 },
  bubble: { backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: line, borderRadius: 14, padding: 10, maxWidth: 220 },
  bubbleText: { color: ink, fontSize: 12, lineHeight: 16 },
  dimWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scene: { flexGrow: 1, minHeight: 270, alignItems: 'center', justifyContent: 'flex-end', marginTop: 24 },
  moonGlow: { position: 'absolute', borderRadius: 200, backgroundColor: 'rgba(255,233,184,0.06)' },
  moon: { position: 'absolute', top: 50, width: 120, height: 120, borderRadius: 60, backgroundColor: '#FFF1C9', overflow: 'hidden', shadowColor: '#FFE9B8', shadowOpacity: 0.7, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } },
  crater: { position: 'absolute', borderRadius: 20, backgroundColor: 'rgba(214,190,130,0.35)' },
  cloudWrap: { position: 'absolute', top: 66, left: '50%', marginLeft: -170, width: 180, height: 142 },
  puff: { position: 'absolute', borderRadius: 40, backgroundColor: '#C9C2EC' },
  puffBack: { position: 'absolute', borderRadius: 40, backgroundColor: '#8F87C2' },
  taliBody: { position: 'absolute', left: 46, top: 0, width: 88, height: 132 },
  zz: { position: 'absolute', color: 'rgba(238,233,255,0.6)', fontWeight: '800' },
  sceneText: { color: muted, fontSize: 13, marginBottom: 8 },
  dimTime: { color: 'rgba(238,233,255,0.35)', fontSize: 40, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dimSub: { color: 'rgba(238,233,255,0.22)', fontSize: 12, marginTop: 6 },
});
