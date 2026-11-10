// Sleep (2 Nov 2026). Pick a sound or two from seven categories, set a timer, Tali fades it out. Its own dark
// purple and blue look, on purpose: the rest of the app is for the day, this is for bed.
// Engine and prefs live in lib/sleep.ts so sound keeps going if you leave the screen.
// 3 Nov 2026: night sky look to match the mockup (gradient sky, stars, glowing orb, gradient button), and the
// player's back button now goes to the sound picker while playing instead of leaving the screen.
// 4 Nov 2026: Tali's sign off no longer promises a brief (Free has none); the sky lives in NightSky.tsx.
import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Sky, night } from '@/components/NightSky';
import { useAuth } from '@/lib/auth';
import { BrainGlobe } from '@/components/BrainGlobe';
import { CATEGORIES, MAX_PICKS, SCENES, SOUNDS, TIMERS, extend, fadeFactor, isSaved, loadPrefs, mixName, pause, playMix, removeMix, resume, saveMix, setFade, setLevel, setTimer, setVolume, soundsIn, start, stop, stopPreview, timeLeft, toggleLive, useSleep, type CategoryId, type SoundId } from '@/lib/sleep';

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
  // 11 Nov 2026 (Taj: "a bit finicky"). Three views of one screen: the front page (one tap to sleep),
  // the player (mix by ear while it plays) and the builder (make your own, heard as you tap).
  const [view, setView] = useState<'home' | 'build'>('home');
  const [showPlayer, setShowPlayer] = useState(true);
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

  const playing = st.status !== 'idle';
  const onPlayer = playing && showPlayer && view === 'home';

  // Dim the screen after a while when playing. Any tap brings it back.
  const wake = () => {
    setDim(false);
    if (dimTimer.current) clearTimeout(dimTimer.current);
    if (st.status === 'playing' && onPlayer) dimTimer.current = setTimeout(() => setDim(true), DIM_AFTER_MS);
  };
  useEffect(() => {
    wake();
    return () => {
      if (dimTimer.current) clearTimeout(dimTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.status, onPlayer]);

  // A fresh start from the front page lands on the player. Starting inside the builder stays in the builder.
  const prevStatus = useRef(st.status);
  useEffect(() => {
    if (prevStatus.current === 'idle' && st.status !== 'idle') setShowPlayer(true);
    prevStatus.current = st.status;
  }, [st.status]);

  const soundName = (id: SoundId) => SOUNDS.find((x) => x.id === id)?.name ?? '';
  const names = st.picks.map((p) => soundName(p.id)).filter(Boolean);
  const title = mixName(st.picks) ?? names.join(' + ');
  const left = timeLeft(st);
  const fading = st.fade && st.endsAt ? fadeFactor(st) < 1 : false;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/me' as any));
  const timerLabel = st.timerMinutes ? TIMERS.find((t) => t.minutes === st.timerMinutes)?.label : 'until morning';
  const saved = isSaved(st.picks);

  const timerChips = (
    <View style={s.seg}>
      {TIMERS.map((t) => {
        const on = st.timerMinutes === t.minutes;
        return (
          <Pressable key={t.label} onPress={() => setTimer(t.minutes)} style={[s.segItem, on && s.segOn]} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={t.label}>
            {t.minutes === null ? (
              <Ionicons name="infinite" size={17} color={on ? '#1B1340' : muted} />
            ) : (
              <Text style={[s.segText, on && { color: '#1B1340' }]}>{t.minutes === 60 ? '1 hr' : String(t.minutes)}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );

  // ---------------------------------------------------------------------------------------------
  // The player: her brain asleep, the time left, and a slider for each sound you can move while it plays.
  if (onPlayer) {
    return (
      <Sky dark={dim}>
        <SafeAreaView style={s.safe}>
          {dim ? (
            <Pressable style={{ flex: 1 }} onPress={wake}>
              <View style={s.dimWrap}>
                <Text style={s.dimTime}>{left ?? '∞'}</Text>
                <Text style={s.dimSub}>{fading ? 'fading out' : 'tap to see controls'}</Text>
              </View>
            </Pressable>
          ) : (
            <ScrollView contentContainerStyle={s.inner} onTouchStart={wake} onScrollBeginDrag={wake}>
              <View style={s.top}>
                <Pressable onPress={() => setShowPlayer(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back to sounds">
                  <Text style={s.back}>{'‹'} Sounds</Text>
                </Pressable>
                <Text style={s.clock}>{clock}</Text>
              </View>
              <View style={s.brainWrap}>
                <View style={s.brainGlow} />
                <BrainGlobe size={230} counts={{}} links={[]} selected={null} onSelect={() => {}} speed={st.status === 'paused' ? 0.15 : 0.4} />
              </View>
              <Text style={s.bigTime}>{left ?? '∞'}</Text>
              <Text style={s.npSub}>{st.status === 'paused' ? 'Paused' : left ? (fading ? 'Fading out now' : st.fade ? 'left, then a slow fade' : 'left') : 'Until you stop it'}</Text>
              <Text style={s.np}>{title}</Text>

              <View style={s.mixBox}>
                <Text style={s.mixTitle}>Your mix</Text>
                {st.picks.map((p) => (
                  <View key={p.id} style={{ marginTop: 4 }}>
                    <View style={s.capRow}>
                      <Text style={s.mixText}>{soundName(p.id)}</Text>
                      {st.picks.length > 1 ? (
                        <Pressable onPress={() => void toggleLive(p.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Take ${soundName(p.id)} out`}>
                          <Text style={s.takeOut}>Take out</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    <Bar value={p.level} onChange={(v) => setLevel(p.id as SoundId, v)} />
                  </View>
                ))}
                <View style={s.mixActions}>
                  <Pressable style={s.pill} onPress={() => { setView('build'); }} accessibilityRole="button">
                    <Ionicons name="add" size={15} color={ink} />
                    <Text style={s.pillText}>{st.picks.length < MAX_PICKS ? 'Add a sound' : 'Swap a sound'}</Text>
                  </Pressable>
                  <Pressable style={[s.pill, saved && s.pillOn]} onPress={saveMix} accessibilityRole="button" accessibilityState={{ selected: saved }}>
                    <Ionicons name={saved ? 'heart' : 'heart-outline'} size={14} color={saved ? '#1B1340' : ink} />
                    <Text style={[s.pillText, saved && { color: '#1B1340' }]}>{saved ? 'Saved' : 'Save this mix'}</Text>
                  </Pressable>
                </View>
              </View>

              <Text style={s.label}>Volume</Text>
              <Bar value={st.volume} onChange={setVolume} />
              <Text style={s.label}>How long</Text>
              {timerChips}

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
            </ScrollView>
          )}
        </SafeAreaView>
      </Sky>
    );
  }

  // ---------------------------------------------------------------------------------------------
  // The builder: tap a sound and it joins the mix and plays. Tap it again and it leaves. No Start button.
  if (view === 'build') {
    return (
      <Sky>
        <SafeAreaView style={s.safe}>
          <ScrollView contentContainerStyle={s.inner}>
            <View style={s.top}>
              <Pressable onPress={() => { setView('home'); setShowPlayer(true); }} hitSlop={12} accessibilityRole="button">
                <Text style={s.back}>{'‹'} {playing ? 'Back to the player' : 'Sleep'}</Text>
              </Pressable>
              <Text style={s.clock}>{clock}</Text>
            </View>
            <Text style={[s.h1c, { marginTop: 14 }]}>Make your own</Text>
            <Text style={s.subc}>Tap a sound to hear it. Pick up to {MAX_PICKS}.</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow} style={{ marginHorizontal: -20, flexGrow: 0, marginTop: 8 }}>
              {CATEGORIES.map((c) => {
                const on = c.id === cat;
                const count = st.picks.filter((p) => SOUNDS.find((x) => x.id === p.id)?.category === c.id).length;
                return (
                  <Pressable key={c.id} onPress={() => setCat(c.id)} style={s.catBtn} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={c.name}>
                    <View style={[s.catCircle, on && s.catCircleOn]}>
                      <Ionicons name={CAT_ICON[c.id]} size={19} color={on ? '#1B1340' : ink} />
                      {count ? (
                        <View style={s.badge}>
                          <Text style={s.badgeText}>{count}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[s.catName, on && { color: ink }]}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={s.list}>
              {soundsIn(cat).map((snd, i) => {
                const on = st.picks.some((p) => p.id === snd.id);
                return (
                  <Pressable key={snd.id} onPress={() => void toggleLive(snd.id)} style={[s.item, i > 0 && s.itemLine]} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemName} numberOfLines={1}>{snd.name}</Text>
                      <Text style={s.itemSub} numberOfLines={1}>{on ? 'Playing now. Tap to take it out.' : snd.sub}</Text>
                    </View>
                    {on ? (
                      <LinearGradient colors={[accent, accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.radio}>
                        <Ionicons name="volume-medium" size={14} color="#1B1340" />
                      </LinearGradient>
                    ) : (
                      <View style={[s.radio, s.radioOff]} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            {st.picks.length && playing ? (
              <View style={s.mixBox}>
                <Text style={s.mixTitle}>Playing now</Text>
                {st.picks.map((p) => (
                  <View key={p.id}>
                    <View style={s.capRow}>
                      <Text style={s.mixText}>{soundName(p.id)}</Text>
                      <Text style={s.cap}>{Math.round(p.level * 100)}%</Text>
                    </View>
                    <Bar value={p.level} onChange={(v) => setLevel(p.id as SoundId, v)} />
                  </View>
                ))}
              </View>
            ) : null}

            <Pressable style={[s.cta, !playing && { opacity: 0.5 }]} disabled={!playing} onPress={() => { setView('home'); setShowPlayer(true); }} accessibilityRole="button">
              <LinearGradient colors={[accent, accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { borderRadius: 18 }]} />
              <Text style={s.ctaText}>{playing ? 'That sounds right' : 'Tap a sound to begin'}</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Sky>
    );
  }

  // ---------------------------------------------------------------------------------------------
  // The front page: one tap plays last night's mix, a scene, or one of your own.
  return (
    <Sky>
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.inner}>
          <View style={s.top}>
            <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button">
              <Text style={s.back}>{'‹'} Me</Text>
            </Pressable>
            <Text style={s.clock}>{clock}</Text>
          </View>

          <View style={s.hero} pointerEvents="none">
            <View style={[s.heroGlow, { width: 172, height: 172, borderRadius: 86 }]} />
            <View style={s.heroRing} />
            <LinearGradient colors={['#FFE7AE', '#E8B977']} start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }} style={s.heroDisc} />
            <Ionicons name="moon" size={22} color="#FFE9B8" style={{ position: 'absolute', top: 6, left: '50%', marginLeft: -84 }} />
            <Text style={[s.zz, { top: 8, left: '50%', marginLeft: 58, fontSize: 18 }]}>Z</Text>
            <Text style={[s.zz, { top: 28, left: '50%', marginLeft: 72, fontSize: 13 }]}>z</Text>
            <Image source={require('@/assets/tali/tali_blink.png')} style={s.heroTali} resizeMode="contain" />
          </View>
          <Text style={s.h1c}>Sleep</Text>
          <Text style={s.subc}>One tap and Tali plays you to sleep.</Text>

          {playing ? (
            <Pressable style={s.nowRow} onPress={() => setShowPlayer(true)} accessibilityRole="button">
              <View style={{ flex: 1 }}>
                <Text style={s.nowTitle}>{st.status === 'paused' ? 'Paused' : 'Now playing'}: {title}</Text>
                <Text style={s.nowSub}>{left ? `${left} left` : 'Until you stop it'}. Tap to go back to the player.</Text>
              </View>
              <Text style={s.nowArrow}>{'›'}</Text>
            </Pressable>
          ) : (
            <Pressable style={s.last} onPress={() => void start()} disabled={!st.picks.length} accessibilityRole="button" accessibilityLabel={`Play last night's mix: ${title}`}>
              <LinearGradient colors={[accent, accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.lastPlay}>
                <Ionicons name="play" size={22} color="#141033" style={{ marginLeft: 3 }} />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={s.lastKicker}>Last night's mix</Text>
                <Text style={s.lastTitle} numberOfLines={1}>{title}</Text>
                <Text style={s.lastSub} numberOfLines={1}>{st.timerMinutes ? `${timerLabel}, then a slow fade` : 'Plays until morning'}</Text>
              </View>
            </Pressable>
          )}

          <Text style={s.label}>Tap a scene</Text>
          <View style={s.sceneGrid}>
            {SCENES.map((sc) => (
              <Pressable key={sc.id} style={s.scene} onPress={() => void playMix(sc.picks)} accessibilityRole="button" accessibilityLabel={`Play ${sc.name}`}>
                <View style={s.sceneIcon}>
                  <Ionicons name={sc.icon as ComponentProps<typeof Ionicons>['name']} size={19} color={ink} />
                </View>
                <Text style={s.sceneName} numberOfLines={2}>{sc.name}</Text>
                <Text style={s.sceneSub} numberOfLines={1}>{sc.picks.length > 1 ? sc.picks.map((p) => soundName(p.id)).join(' + ') : SOUNDS.find((x) => x.id === sc.picks[0].id)?.sub}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={s.label}>Your mixes</Text>
          {st.saved.length ? (
            <View style={s.list}>
              {st.saved.map((m, i) => (
                <Pressable key={m.id} onPress={() => void playMix(m.picks)} style={[s.item, i > 0 && s.itemLine, { paddingVertical: 11 }]} accessibilityRole="button" accessibilityLabel={`Play ${m.name}`}>
                  <Ionicons name="heart" size={15} color={accent} />
                  <Text style={[s.itemName, { flex: 1 }]} numberOfLines={1}>{m.name}</Text>
                  <Pressable onPress={() => removeMix(m.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${m.name}`}>
                    <Ionicons name="close" size={17} color={faint} />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={s.empty}>Tap Save this mix on the player and it lands here.</Text>
          )}
          <Pressable style={s.makeOwn} onPress={() => setView('build')} accessibilityRole="button">
            <Ionicons name="options-outline" size={17} color={ink} />
            <Text style={s.makeOwnText}>Make your own</Text>
          </Pressable>

          <Text style={s.label}>How long</Text>
          {timerChips}
          <View style={s.fadeRow}>
            <Text style={s.ghostL}>{st.timerMinutes ? 'Gets quieter for the last 5 minutes' : 'Plays until you stop it'}</Text>
            {st.timerMinutes ? <Switch value={st.fade} onValueChange={setFade} trackColor={{ true: accent, false: 'rgba(255,255,255,0.2)' }} thumbColor="#fff" style={{ transform: [{ scale: 0.8 }] }} /> : null}
          </View>
          <Text style={s.ghost}>{Platform.OS === 'web' ? 'Plays while this tab is open. No credits.' : 'Keeps playing with the screen off. No credits.'}</Text>
        </ScrollView>
      </SafeAreaView>
    </Sky>
  );
}

const CAT_ICON: Record<CategoryId, ComponentProps<typeof Ionicons>['name']> = {
  noise: 'pulse-outline',
  rain: 'rainy-outline',
  wind: 'cloudy-outline',
  water: 'water-outline',
  fire: 'flame-outline',
  night: 'moon-outline',
  hum: 'radio-outline',
};

const s = StyleSheet.create({
  safe: { flex: 1 },
  inner: { padding: 20, paddingBottom: 40, flexGrow: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { fontSize: 15, color: accent, fontWeight: '700' },
  clock: { fontSize: 13, color: faint, fontVariant: ['tabular-nums'] },
  h1: { fontSize: 26, fontWeight: '800', color: ink },
  sub: { color: muted, fontSize: 13, lineHeight: 18 },
  label: { fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: faint, fontWeight: '800', marginTop: 14, marginBottom: 8 },
  nowRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, backgroundColor: 'rgba(185,166,255,0.18)', borderWidth: 1, borderColor: 'rgba(185,166,255,0.5)', borderRadius: 16, padding: 14 },
  nowTitle: { color: ink, fontSize: 14, fontWeight: '800' },
  nowSub: { color: muted, fontSize: 12, marginTop: 2 },
  nowArrow: { color: accent, fontSize: 24, fontWeight: '800' },
  cats: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 10, paddingTop: 14 },
  badge: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' },
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
  cta: { marginTop: 14, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shadowColor: accent2, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 18, elevation: 6 },
  ctaText: { color: '#141033', fontWeight: '800', fontSize: 16 },
  ghost: { textAlign: 'center', color: faint, fontSize: 11, marginTop: 2 },
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
  zz: { position: 'absolute', color: 'rgba(238,233,255,0.6)', fontWeight: '800' },
  hero: { height: 160, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  heroGlow: { position: 'absolute', backgroundColor: 'rgba(255,233,184,0.16)', shadowColor: '#FFE9B8', shadowOpacity: 0.9, shadowRadius: 46, shadowOffset: { width: 0, height: 0 } },
  heroRing: { position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 1, borderColor: 'rgba(255,233,184,0.45)' },
  heroDisc: { position: 'absolute', width: 132, height: 132, borderRadius: 66 },
  heroTali: { width: 88, height: 132, marginTop: 4 },
  h1c: { fontSize: 26, fontWeight: '800', color: ink, textAlign: 'center', marginTop: 2 },
  subc: { color: muted, fontSize: 13, textAlign: 'center', marginTop: 2 },
  catRow: { flexDirection: 'row', gap: 5, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  catBtn: { alignItems: 'center', width: 46 },
  catCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: glass, borderWidth: 1, borderColor: line, alignItems: 'center', justifyContent: 'center' },
  catCircleOn: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF', shadowColor: accent, shadowOpacity: 0.6, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  catName: { color: muted, fontSize: 11, fontWeight: '700', marginTop: 5 },
  list: { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: line, borderRadius: 18, paddingHorizontal: 14, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  itemLine: { borderTopWidth: 1, borderTopColor: line },
  itemName: { color: ink, fontSize: 14, fontWeight: '800' },
  itemSub: { color: muted, fontSize: 12, marginTop: 1 },
  radio: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  radioOff: { borderWidth: 1.5, borderColor: 'rgba(238,233,255,0.35)' },
  seg: { flexDirection: 'row', backgroundColor: glass, borderWidth: 1, borderColor: line, borderRadius: 999, padding: 4 },
  segItem: { flex: 1, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: '#FFFFFF' },
  segText: { color: muted, fontSize: 13, fontWeight: '800' },
  fadeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 6, minHeight: 30 },
  ghostL: { color: muted, fontSize: 12 },
  dimTime: { color: 'rgba(238,233,255,0.35)', fontSize: 40, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dimSub: { color: 'rgba(238,233,255,0.22)', fontSize: 12, marginTop: 6 },
  // 11 Nov 2026 overhaul
  last: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14, backgroundColor: 'rgba(185,166,255,0.16)', borderWidth: 1, borderColor: 'rgba(185,166,255,0.5)', borderRadius: 22, padding: 14, shadowColor: accent, shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  lastPlay: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  lastKicker: { color: accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  lastTitle: { color: ink, fontSize: 17, fontWeight: '800', marginTop: 2 },
  lastSub: { color: muted, fontSize: 12.5, marginTop: 2 },
  sceneGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  scene: { width: '47%', flexGrow: 1, backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: line, borderRadius: 18, padding: 13, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  sceneIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(185,166,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  sceneName: { color: ink, fontSize: 14.5, fontWeight: '800', marginTop: 9 },
  sceneSub: { color: muted, fontSize: 11.5, marginTop: 2 },
  empty: { color: muted, fontSize: 12.5 },
  makeOwn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, height: 46, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(238,233,255,0.4)' },
  makeOwnText: { color: ink, fontSize: 14.5, fontWeight: '800' },
  brainWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 4, height: 236 },
  brainGlow: { position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(127,209,255,0.08)', shadowColor: accent2, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 50 },
  bigTime: { color: ink, fontSize: 46, fontWeight: '800', letterSpacing: -1, textAlign: 'center', fontVariant: ['tabular-nums'], marginTop: -4 },
  takeOut: { color: faint, fontSize: 12, fontWeight: '700' },
  mixActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: line, backgroundColor: glass },
  pillOn: { backgroundColor: accent, borderColor: accent },
  pillText: { color: ink, fontSize: 13, fontWeight: '700' },
});
