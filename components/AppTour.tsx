// First-run tour, ported from the Totality apps' DashboardTour.
// A dark overlay with one card per step, Tali on each card, and a pulsing
// purple ring over the bottom tab the step is about. Skip ends it straight
// away. The last step opens a celebration card, then onDone().
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, Modal, Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { measureTabNow, type TabPos } from '@/lib/tourTabPositions';
import { tali } from '@/components/ui';
import { colours, elevation, radius, space } from '@/constants/theme';

export type TourStep = {
  title: string;
  body: string;
  pose: keyof typeof tali;
  tab?: number; // index into the bottom tabs, see lib/tourTabPositions.ts
};

const RING = 56;
const { height: SCREEN_H } = Dimensions.get('window');

export function AppTour({ steps, onDone, firstName }: { steps: TourStep[]; onDone: () => void; firstName?: string | null }) {
  const [i, setI] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const [tabPos, setTabPos] = useState<TabPos | null>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const overlayRef = useRef<View>(null);
  const pulse = useRef(new Animated.Value(0)).current;

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
                { c: colours.purple, t: "Say hi in Talk and tell me about your business" },
                { c: colours.orange, t: 'Add your first client or lead in Clients' },
                { c: colours.good, t: 'Check Today tomorrow morning for your first brief' },
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

  const cardPos = step.tab !== undefined ? { bottom: 110 } : { top: SCREEN_H * 0.22 };
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] });

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View
        ref={overlayRef}
        onLayout={() => overlayRef.current?.measureInWindow((x, y) => setOrigin({ x, y }))}
        style={styles.overlay}>
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

        <SafeAreaView style={{ flex: 1 }}>
          <Pressable accessibilityRole="button" onPress={onDone} style={styles.skip} hitSlop={10}>
            <Text style={styles.skipText}>Skip tour</Text>
          </Pressable>

          <View style={[styles.card, cardPos]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm }}>
              <Image source={tali[step.pose]} style={{ width: 56, height: 56 }} resizeMode="contain" accessibilityLabel="Tali" />
              <View style={{ flex: 1 }}>
                <Text style={styles.counter}>{i + 1} of {steps.length}</Text>
                <Text style={styles.cardTitle}>{step.title}</Text>
              </View>
            </View>
            <Text style={styles.cardBody}>{step.body}</Text>
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
  overlay: { flex: 1, backgroundColor: 'rgba(20,12,24,0.66)' },
  centreOverlay: { flex: 1, backgroundColor: 'rgba(20,12,24,0.6)', justifyContent: 'center', alignItems: 'center', padding: space.xl },
  ring: { position: 'absolute', width: RING, height: RING, borderRadius: RING / 2, borderWidth: 3, borderColor: '#C9A2DC', zIndex: 200 },
  ringSolid: { position: 'absolute', width: RING, height: RING, borderRadius: RING / 2, borderWidth: 3, borderColor: colours.purple, backgroundColor: 'rgba(255,255,255,0.12)', zIndex: 199 },
  skip: { position: 'absolute', top: 16, right: 20, zIndex: 10, padding: 6 },
  skipText: { color: '#E9DDEF', fontSize: 14, fontWeight: '700' },
  card: {
    position: 'absolute',
    alignSelf: 'center',
    width: '88%',
    maxWidth: 360,
    backgroundColor: colours.surface,
    borderRadius: radius.card,
    padding: space.lg,
    borderLeftWidth: 5,
    borderLeftColor: colours.purple,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  counter: { fontSize: 12, color: colours.purple, fontWeight: '800', letterSpacing: 0.5, marginBottom: 2 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colours.text },
  cardBody: { fontSize: 15, color: colours.muted, lineHeight: 22, marginBottom: space.lg },
  primaryBtn: { backgroundColor: colours.purple, borderRadius: radius.input, paddingVertical: 12, paddingHorizontal: space.xl, alignItems: 'center', ...elevation.button(colours.purple) },
  primaryBtnText: { color: colours.onPurple, fontSize: 15, fontWeight: '800' },
  backBtn: { borderRadius: radius.input, paddingVertical: 12, paddingHorizontal: space.lg, alignItems: 'center', borderWidth: 1, borderColor: colours.borderStrong },
  backBtnText: { color: colours.text, fontSize: 15, fontWeight: '700' },
  celebrateCard: { backgroundColor: colours.surface, borderRadius: 22, padding: space.xl, alignItems: 'center', width: '100%', maxWidth: 340, ...elevation.card },
  celebrateTitle: { fontSize: 22, fontWeight: '800', color: colours.text, textAlign: 'center', marginBottom: 4 },
  celebrateSub: { fontSize: 14, color: colours.muted, textAlign: 'center', marginBottom: space.lg },
  firstCard: { backgroundColor: colours.purpleSoft, borderRadius: radius.input, padding: space.md, width: '100%', marginBottom: space.lg, ...elevation.tile },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  bulletText: { flex: 1, fontSize: 14, color: colours.text, lineHeight: 20 },
});
