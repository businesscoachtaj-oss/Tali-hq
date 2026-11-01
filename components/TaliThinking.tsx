// "Tali is thinking" row for Talk: her head sprite beside a chat bubble with
// three bouncing dots, the same look as the Tali HQ dashboard.
import { useEffect, useRef } from 'react';
import { Animated, Platform, Text, View } from 'react-native';
import { TaliAvatar } from '@/components/TaliAvatar';
import { colours } from '@/constants/theme';

export function TaliThinking() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const native = Platform.OS !== 'web';
    const loops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: native }),
          Animated.timing(d, { toValue: 0, duration: 300, useNativeDriver: native }),
          Animated.delay((2 - i) * 150 + 200),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 4 }} accessibilityLabel="Tali is thinking">
      <TaliAvatar pose="head_think" size={34} />
      <View style={{ backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.border, borderRadius: 18, borderBottomLeftRadius: 6, paddingVertical: 10, paddingHorizontal: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {dots.map((d, i) => (
            <Animated.View
              key={i}
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: colours.purple,
                opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
                transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
              }}
            />
          ))}
        </View>
      </View>
      <Text style={{ color: colours.faint, fontSize: 12, marginBottom: 10 }}>Tali is thinking</Text>
    </View>
  );
}
