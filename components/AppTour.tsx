// First-run tour, ported from the Totality apps' DashboardTour.
// A dark overlay with one card per step, Tali on each card, and a pulsing
// purple ring over the bottom tab the step is about. Skip ends it straight
// away. The last step opens a celebration card, then onDone().
// 3 Nov 2026: a step can also point at a named spot on the screen (`target`,
// see lib/tourTargets.ts). Today scrolls it into view, it gets a rounded
// highlight instead of a ring, and the card sits just under or over it.
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, Modal, Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { measureTabNow, type TabPos } from '@/lib/tourTabPositions';
import { bringTargetIntoView, scrollTourToTop, type Rect } from '@/lib/tourTargets';
import { tali } from '@/components/ui';
import { colours, elevation, radius, space } from '@/constants/theme';

export type TourStep = {
  title: string;
  body: string;
  pose: keyof typeof tali;
  tab?: number; // index into the bottom tabs, see lib/tourTabPositions.ts
  target?: string; // a spot registered with registerTarget, see lib/tourTargets.ts
};

const RING = 56;
const NIGHT = '#17123A'; // her sky, a shade lighter so the card lifts off it
const PAD = 8; // breathing room around a highlighted target
const CARD_H = 250; // rough card height, for choosing above or below a target
const { height: SCREEN_H } = Dimensions.get('window');

export function AppTour({ steps, onDone, firstName }: { steps: TourStep[]; onDone: () => void; firstName?: string | null }) {
  const [i, setI] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const [tabPos, setTabPos] = useState<TabPos | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const overlayRef = useRef<View>(null);
  const pulse = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const step = steps[i];
  const last = i === steps.length - 1;

  // Measure the tab icon fresh for each step so the ring lines up.
  useEffect(() => {
    let cancelled = false;
    setTabPos(null);
    if (step?.tab === undefined) return;
    const t = setTimeout(() => {
      measureTabNow(step.tab as number).then((p) => {
        if (!cancelled && p) setTabPos(p);
      });
    }, 50);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [i, step?.tab]);

  // For a target step, scroll it near the top and measure it. A target that is
  // not on screen (say, nothing waiting on your yes yet) just shows the card.
  useEffect(() => {
    let cancelled = false;
    setRect(null);
    if (!step?.target) {
      scrollTourToTop();
      return;
    }
    const t = setTimeout(() => {
      bringTargetIntoView(step.target as string, insets.top + 72).then((r) => {
        if (!cancelled && r) setRect(r);
      });
    }, 50);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [i, step?.target, insets.top]);

  useEffect(() => {
    pulse.setValue(0);
    if (!tabPos) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 0, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [tabPos, pulse]);

  // The translucent Android modal starts at the top of the screen while the
  // tab icon is measured below the status bar, so nudge the ring down there.
  const androidOffset = Platform.OS === 'android' && Math.abs(origin.y) < 1 ? StatusBar.currentHeight ?? 0 : 0;

  if (celebrate) {
    return (
      <Modal visible transparent animationType="fade">
        <View style={styles.centreOverlay}>
          <View style={styles.celebrateCard}>
            <Image source={tali.celebrate} style={{ width: 120, height: 120, marginBottom: space.sm }} resizeMode="contain" accessibilityLabel="Tali celebrating" />
            <Text style={styles.celebrateTitle}>{firstName ? `You're all set, ${firstName}!` : "You're all set!"}</Text>
            <Text style={styles.celebrateSub}>Here's a good way to start.</Text>
            <View style={styles.firstCard}>
              {[
                { c: '#B9A6FF', t: 'Say hi in Talk and tell me three things about you' },
                { c: '#F6A02C', t: 'Watch a new dot light up in my brain' },
                { c: '#5CF2C0', t: 'Check Today tomorrow morning for your first brief' },
              ].map((b) => (
                <View key={b.t} style={styles.bullet}>
                  <View style={[styles.dot, { backgroundColor: b.c }]} />
                  <Text style={styles.bulletText}>{b.t}</Text>
                </View>
              ))}
            </View>
            <Pressable accessibilityRole="button" onPress={onDone} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Let's go</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  if (!step) return null;

  // Where the card goes: under a highlighted target when there is room, over it
  // when there isn't, above the tab bar for tab steps, and mid-screen otherwise.
  const box = rect ? { left: rect.x - origin.x - PAD, top: rect.y - origin.y + androidOffset - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 } : null;
  // Under the target if it fits, over it if that fits, otherwise pinned above
  // the tab bar (a tall target like a grid then peeks out above the card).
  const cardPos = box
    ? box.top + box.height + 16 + CARD_H < SCREEN_H - 24
      ? { top: box.top + box.height + 16 }
      : box.top - 16 - CARD_H > insets.top + 40
        ? { bottom: SCREEN_H - box.top + 16 }
        : { bottom: 110 }
    : step.tab !== undefined
      ? { bottom: 110 }
      : { top: SCREEN_H * 0.22 };
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] });

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View
        ref={overlayRef}
        onLayout={() => overlayRef.current?.measureInWindow((x, y) => setOrigin({ x, y }))}
        style={styles.overlay}>
        {box ? <View pointerEvents="none" style={[styles.box, box]} /> : null}
        {tabPos ? (
          <>
            <View
              pointerEvents="none"
              style={[styles.ringSolid, { left: tabPos.x - origin.x + tabPos.width / 2 - RING / 2, top: tabPos.y - origin.y + androidOffset + tabPos.height / 2 - RING / 2 }]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.ring,
                {
                  left: tabPos.x - origin.x + tabPos.width / 2 - RING / 2,
                  top: tabPos.y - origin.y + androidOffset + tabPos.height / 2 - RING / 2,
                  transform: [{ scale }],
                  opacity,
                },
              ]}
            />
          </>
        ) : null}

        <SafeAreaView style={{ flex: 1, zIndex: 300 }}>
          <Pressable accessibilityRole="button" onPress={onDone} style={styles.skip} hitSlop={10}>
            <Text style={styles.skipText}>Skip tour</Text>
          </Pressable>

          <View style={[styles.card, cardPos]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(185,166,255,0.18)', borderWidth: 1, borderColor: 'rgba(214,200,255,0.6)' }}>
                <Image source={tali.head} style={{ width: 42, height: 42 }} resizeMode="contain" accessibilityLabel="Tali" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.counter}>{i + 1} of {steps.length}</Text>
                <Text style={styles.cardTitle}>{step.title}</Text>
              </View>
            </View>
            <Text style={styles.cardBody}>{step.body}</Text>
            <View style={{ flexDirection: 'row', gap: 5, marginBottom: space.md }}>
              {steps.map((_, n) => (
                <View key={n} style={{ height: 4, flex: n === i ? 2 : 1, borderRadius: 2, backgroundColor: n <= i ? '#B9A6FF' : 'rgba(255,255,255,0.18)' }} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {i > 0 ? (
                <Pressable accessibilityRole="button" onPress={() => setI(i - 1)} style={styles.backBtn}>
                  <Text style={styles.backBtnText}>Back</Text>
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" onPress={() => (last ? setCelebrate(true) : setI(i + 1))} style={[styles.primaryBtn, { flex: 1 }]}>
                <Text style={styles.primaryBtnText}>{last ? 'Done' : 'Next'}</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(8,6,28,0.72)' },
  centreOverlay: { flex: 1, backgroundColor: 'rgba(20,12,24,0.6)', justifyContent: 'center', alignItems: 'center', padding: space.xl },
  ring: { position: 'absolute', width: RING, height: RING, borderRadius: RING / 2, borderWidth: 3, borderColor: '#C9A2DC', zIndex: 200 },
  ringSolid: { position: 'absolute', width: RING, height: RING, borderRadius: RING / 2, borderWidth: 3, borderColor: colours.purple, backgroundColor: 'rgba(255,255,255,0.12)', zIndex: 199 },
  box: { position: 'absolute', borderRadius: 26, borderWidth: 2, borderColor: '#B9A6FF', backgroundColor: 'rgba(185,166,255,0.10)', shadowColor: '#B9A6FF', shadowOpacity: 0.9, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, zIndex: 199 },
  skip: { position: 'absolute', top: 16, right: 20, zIndex: 10, padding: 6 },
  skipText: { color: '#E9DDEF', fontSize: 14, fontWeight: '700' },
  card: {
    position: 'absolute',
    zIndex: 300, // above the target box when they overlap
    alignSelf: 'center',
    width: '88%',
    maxWidth: 360,
    backgroundColor: NIGHT,
    borderRadius: 22,
    padding: space.lg,
    borderWidth: 1,
    borderColor: 'rgba(214,200,255,0.55)',
    shadowColor: '#7A4DFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 8,
  },
  counter: { fontSize: 11, color: '#B9A6FF', fontWeight: '800', letterSpacing: 1.6, marginBottom: 2 },
  cardTitle: { fontSize: 26, lineHeight: 29, color: '#FFFFFF', fontFamily: 'InstrumentSerif_400Regular' },
  cardBody: { fontSize: 15, color: 'rgba(255,255,255,0.82)', lineHeight: 22, marginBottom: space.lg },
  primaryBtn: { backgroundColor: '#B9A6FF', borderRadius: 999, paddingVertical: 13, paddingHorizontal: space.xl, alignItems: 'center', shadowColor: '#B9A6FF', shadowOpacity: 0.7, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
  primaryBtnText: { color: '#0C0A24', fontSize: 15, fontWeight: '800' },
  backBtn: { borderRadius: 999, paddingVertical: 13, paddingHorizontal: space.lg, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(214,200,255,0.45)' },
  backBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  celebrateCard: { backgroundColor: NIGHT, borderRadius: 22, padding: space.xl, alignItems: 'center', width: '100%', maxWidth: 340, borderWidth: 1, borderColor: 'rgba(214,200,255,0.55)', shadowColor: '#7A4DFF', shadowOpacity: 0.8, shadowRadius: 24, shadowOffset: { width: 0, height: 0 } },
  celebrateTitle: { fontSize: 30, lineHeight: 33, color: '#FFFFFF', fontFamily: 'InstrumentSerif_400Regular', textAlign: 'center', marginBottom: 4 },
  celebrateSub: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: space.lg },
  firstCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: space.md, width: '100%', marginBottom: space.lg, borderWidth: 1, borderColor: 'rgba(214,200,255,0.25)' },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  bulletText: { flex: 1, fontSize: 14, color: '#FFFFFF', lineHeight: 20 },
});
