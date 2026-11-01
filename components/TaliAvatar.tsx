// Tali as a living sprite, like in Totality and Totality Nutrition. Her head
// (Talk) bobs gently and blinks. Full-body Tali stands still (Taj: the fades
// look nicer that way), blinks now and then, and slips into a different
// pose every 7 seconds or so (peek, wink, giggle...) for a couple of seconds
// and smoothly fades back. The extra poses come from Tali's 100 pose set,
// lined up to the same frame as the app sprites so the fade has no jump.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

export type TaliPose = 'idle' | 'wave' | 'think' | 'celebrate' | 'head' | 'head_think';

const SRC: Record<string, ImageSourcePropType> = {
  idle: require('@/assets/tali/tali_idle.png'),
  blink: require('@/assets/tali/tali_blink.png'),
  wave: require('@/assets/tali/tali_wave.png'),
  think: require('@/assets/tali/tali_think.png'),
  celebrate: require('@/assets/tali/tali_celebrate.png'),
  head: require('@/assets/tali/tali_head_idle.png'),
  head_blink: require('@/assets/tali/tali_head_blink.png'),
  head_think: require('@/assets/tali/tali_head_think.png'),
  peek: require('@/assets/tali/tali_peek.png'),
  wink: require('@/assets/tali/tali_wink.png'),
  look_right: require('@/assets/tali/tali_look_right.png'),
  curious: require('@/assets/tali/tali_curious.png'),
  cheeky: require('@/assets/tali/tali_cheeky.png'),
  shy: require('@/assets/tali/tali_shy.png'),
  giggle: require('@/assets/tali/tali_giggle.png'),
};

const EXTRAS = ['peek', 'wink', 'look_right', 'curious', 'cheeky', 'shy', 'giggle'];

// Full-body sprites are 300 x 430, head crops are 168 x 162.
const BODY = 430 / 300;
const HEAD = 162 / 168;
const native = Platform.OS !== 'web';

export function TaliAvatar({
  pose = 'idle',
  size = 72,
  animate = true,
  extras = true,
  style,
}: {
  pose?: TaliPose;
  size?: number; // width in points
  animate?: boolean;
  extras?: boolean; // full-body only: drift into other poses now and then
  style?: StyleProp<ViewStyle>;
}) {
  const isHead = pose === 'head' || pose === 'head_think';
  const bob = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [blink, setBlink] = useState(false);
  const [extra, setExtra] = useState<string | null>(null);
  const canBlink = pose === 'idle' || pose === 'head';
  const useExtras = animate && extras && !isHead && pose !== 'celebrate';

  // Gentle bob and sway, head only.
  const bobs = animate && isHead;
  useEffect(() => {
    if (!bobs) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(bob, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bobs, bob]);

  // Blink every few seconds.
  useEffect(() => {
    if (!animate || !canBlink) return;
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      t = setTimeout(() => {
        if (!alive) return;
        setBlink(true);
        setTimeout(() => alive && setBlink(false), 140);
        next();
      }, 2600 + Math.random() * 1800);
    };
    next();
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [animate, canBlink]);

  // Every 6 to 8 seconds, fade into another pose for 2 to 3 seconds, then back.
  useEffect(() => {
    if (!useExtras) return;
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    let last = '';
    const next = () => {
      t = setTimeout(() => {
        if (!alive) return;
        const options = EXTRAS.filter((e) => e !== last);
        const pick = options[Math.floor(Math.random() * options.length)];
        last = pick;
        setExtra(pick);
        Animated.timing(fade, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: native }).start(() => {
          t = setTimeout(() => {
            if (!alive) return;
            Animated.timing(fade, { toValue: 0, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: native }).start(() => {
              if (alive) next();
            });
          }, 2000 + Math.random() * 1000);
        });
      }, 6000 + Math.random() * 2000);
    };
    next();
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [useExtras, fade]);

  const base = blink ? (isHead ? 'head_blink' : 'blink') : pose;
  const height = size * (isHead ? HEAD : BODY);
  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -Math.max(2, size * 0.04)] });
  const rotate = bob.interpolate({ inputRange: [0, 1], outputRange: ['-1.5deg', '1.5deg'] });
  const img = { width: size, height, position: 'absolute' as const, top: 0, left: 0 };

  return (
    <Animated.View style={[{ width: size, height, transform: bobs ? [{ translateY }, { rotate }] : [] }, style]} accessibilityLabel="Tali">
      <Animated.Image source={SRC[base]} style={[img, useExtras ? { opacity: fade.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) } : null]} resizeMode="contain" />
      {useExtras && extra ? <Animated.Image source={SRC[extra]} style={[img, { opacity: fade }]} resizeMode="contain" /> : null}
    </Animated.View>
  );
}

// Load every pose up front on web so the first fade never flashes empty.
if (Platform.OS === 'web') {
  for (const s of Object.values(SRC)) {
    const uri = typeof s === 'number' ? Image.resolveAssetSource?.(s)?.uri : (s as any)?.uri;
    if (uri) Image.prefetch(uri).catch(() => {});
  }
}
