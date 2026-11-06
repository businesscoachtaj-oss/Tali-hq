// An image Tali made in Talk (6 Nov 2026). Three states: drawing (a soft purple tile with a pulsing
// line while tali-image works, about half a minute), failed (the reason and, when it can work again,
// Try again) and done (the picture, tap to open it full size).
import { useEffect, useRef } from 'react';
import { Animated, Image, Linking, Platform, Pressable, Text, View } from 'react-native';
import type { Attachment } from '@/lib/data';
import { colours, radius } from '@/constants/theme';

const W = 248;
const heightFor = (shape?: string) => (shape === 'portrait' ? Math.round(W * 1.5) : shape === 'landscape' ? Math.round(W / 1.5) : W);

// A placeholder older than this with no picture never finished (the app was closed mid-draw, say).
const STALE_MS = 3 * 60 * 1000;
export function isStaleImage(a: Attachment, createdAt: string) {
  return a.kind === 'image' && !a.path && !!a.making && Date.now() - new Date(createdAt).getTime() > STALE_MS;
}

export function TaliImage({ a, drawing, stale, onRetry }: { a: Attachment; drawing: boolean; stale: boolean; onRetry: () => void }) {
  const h = heightFor(a.shape);
  const pulse = useRef(new Animated.Value(0)).current;
  const busy = !a.path && (drawing || (!!a.making && !stale)) && !a.failed;

  useEffect(() => {
    if (!busy) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [busy, pulse]);

  if (a.path) {
    return (
      <Pressable onPress={() => a.url && Linking.openURL(a.url)} accessibilityRole="imagebutton" accessibilityLabel="Open the image Tali made">
        <Image source={{ uri: a.url }} style={{ width: W, height: h, maxWidth: '100%', borderRadius: 14, backgroundColor: colours.sunk }} resizeMode="cover" />
        <Text style={{ color: colours.faint, fontSize: 11, marginTop: 4 }}>Tap to open full size</Text>
      </Pressable>
    );
  }

  if (busy) {
    return (
      <View accessibilityLabel="Tali is making your image" style={{ width: W, height: h, maxWidth: '100%', borderRadius: 14, backgroundColor: colours.purpleSoft, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 10 }}>
        <Animated.View style={{ width: 120, height: 6, borderRadius: radius.pill, backgroundColor: colours.purple, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.9] }) }} />
        <Text style={{ color: colours.purpleInk, fontWeight: '700', fontSize: 14 }}>Making your image</Text>
        <Text style={{ color: colours.purpleInk, opacity: 0.75, fontSize: 12, textAlign: 'center' }}>About half a minute. You can keep chatting.</Text>
      </View>
    );
  }

  const reason = a.failed || "That image didn't finish. It wasn't counted.";
  const canRetry = !/part of Tali HQ|top up|trial|not switched on|knocked back/i.test(reason);
  return (
    <View style={{ width: W, maxWidth: '100%', borderRadius: 14, backgroundColor: colours.sunk, padding: 14, gap: 8 }}>
      <Text style={{ color: colours.text, fontSize: 13, lineHeight: 19 }}>{reason}</Text>
      {canRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Try making the image again" hitSlop={8}>
          <Text style={{ color: colours.purple, fontWeight: '800', fontSize: 13 }}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
