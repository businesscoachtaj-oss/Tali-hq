// 9 Nov 2026 concept (Taj picked it): tap Tali and she becomes her brain. Her dots fly apart into the
// brain globe and take each part's colour, then the real, spinnable brain takes over. Back turns her
// into Tali again. Mockup route, opened from dot Tali on the Home sky.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { NightBackground } from '@/components/NightSky';
import { Aurora } from '@/components/Aurora';
import { BrainGlobe } from '@/components/BrainGlobe';
import { TaliDots } from '@/components/TaliDots';
import { myBrain, type Brain, type RegionId } from '@/lib/brain';
import { NO_BOTTOM } from '@/constants/theme';

export default function TaliBrain() {
  const { auto } = useLocalSearchParams<{ auto?: string }>();
  const { width } = useWindowDimensions();
  const W = Math.min(width, 640);
  const H = 520;
  const [brain, setBrain] = useState<Brain | null>(null);
  const [inside, setInside] = useState(false);
  const morph = useSharedValue(0);
  const globe = useSharedValue(0);

  useFocusEffect(useCallback(() => {
    myBrain('mine').then(setBrain).catch(() => {});
  }, []));

  const done = useCallback(() => {
    setInside(true);
    globe.value = withTiming(1, { duration: 450 });
  }, [globe]);
  const stepIn = useCallback(() => {
    morph.value = withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.cubic) }, (fin) => {
      if (fin) scheduleOnRN(done);
    });
  }, [morph, done]);
  const stepOut = useCallback(() => {
    setInside(false);
    globe.value = withTiming(0, { duration: 250 });
    morph.value = withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.cubic) });
  }, [morph, globe]);
  useEffect(() => {
    if (auto) {
      const t = setTimeout(stepIn, 900);
      return () => clearTimeout(t);
    }
  }, [auto, stepIn]);

  const counts: Partial<Record<RegionId, number>> = {};
  brain?.regions.forEach((r) => (counts[r.id] = r.count));
  const total = brain?.total ?? 0;
  const globeStyle = useAnimatedStyle(() => ({ opacity: globe.value }));
  const taliStyle = useAnimatedStyle(() => ({ opacity: 1 - globe.value }));
  const headStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, morph.value * 2.5) }));
  const brainHead = useAnimatedStyle(() => ({ opacity: Math.max(0, morph.value * 2.5 - 1.5) }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#07061A' }} edges={NO_BOTTOM}>
      <NightBackground />
      <Aurora />
      <View style={{ paddingHorizontal: 20, paddingTop: 12, height: 120 }}>
        <Pressable onPress={() => (inside ? stepOut() : router.navigate('/space'))} accessibilityRole="button">
          <Text style={{ color: '#B9A6FF', fontSize: 15, fontWeight: '700' }}>{'‹'} {inside ? 'Back to Tali' : 'Home'}</Text>
        </Pressable>
        <Animated.View style={[{ position: 'absolute', left: 20, right: 20, top: 44 }, headStyle]}>
          <Text style={{ color: '#FFFFFF', fontSize: 34, fontFamily: 'InstrumentSerif_400Regular', textShadowColor: 'rgba(185,166,255,0.8)', textShadowRadius: 18 }}>This is me.</Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, marginTop: 2 }}>Every dot is something I know about you.</Text>
        </Animated.View>
        <Animated.View style={[{ position: 'absolute', left: 20, right: 20, top: 44 }, brainHead]}>
          <Text style={{ color: '#FFFFFF', fontSize: 34, fontFamily: 'InstrumentSerif_400Regular', textShadowColor: 'rgba(185,166,255,0.8)', textShadowRadius: 18 }}>Her brain</Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, marginTop: 2 }}>{total ? `${total} memories and growing.` : 'Everything she knows about you.'}</Text>
        </Animated.View>
      </View>

      <View style={{ width: W, height: H, alignSelf: 'center' }}>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, taliStyle]} pointerEvents={inside ? 'none' : 'auto'}>
          <TaliDots width={W} height={H} morph={morph} brainSize={W} onPress={stepIn} />
        </Animated.View>
        <Animated.View style={[{ position: 'absolute', left: 0, top: (H - W) / 2 }, globeStyle]} pointerEvents={inside ? 'auto' : 'none'}>
          {inside ? <BrainGlobe size={W} counts={counts as any} links={brain?.links ?? []} selected={null} onSelect={() => router.navigate('/brain')} /> : null}
        </Animated.View>
      </View>

      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', marginTop: 8 }}>
        {inside ? 'Spin it, pinch it, tap a part to see what she keeps there.' : 'Tap her to step inside.'}
      </Text>
    </SafeAreaView>
  );
}
