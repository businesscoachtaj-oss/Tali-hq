// The mic in Talk's composer (voice notes, 3 Nov 2026). Tap to start, tap to stop.
// Idle: a mic glyph in the same round outline as the + button. Recording: a pulsing red dot and the
// clock. Busy (uploading and transcribing): a spinner. The recording logic lives in lib/voiceNotes.ts.
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, Text, View } from 'react-native';
import { colours } from '@/constants/theme';
import { fmtClock } from '@/lib/voiceNotes';

export function MicButton({ recording, busy, seconds, onPress, disabled }: { recording: boolean; busy: boolean; seconds: number; onPress: () => void; disabled?: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!recording) { pulse.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [recording, pulse]);

  const label = busy ? 'Tali is listening back' : recording ? `Stop recording, ${fmtClock(seconds)}` : 'Record a voice note';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled || busy, selected: recording }}
      onPress={onPress}
      disabled={disabled || busy}
      style={{
        height: 44,
        minWidth: 44,
        paddingHorizontal: recording ? 12 : 0,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: recording ? colours.danger : colours.borderStrong,
        backgroundColor: recording ? '#FDECEA' : colours.bg,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        opacity: disabled ? 0.5 : 1,
      }}>
      {busy ? (
        <ActivityIndicator color={colours.purple} />
      ) : recording ? (
        <>
          <Animated.View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colours.danger, opacity: pulse }} />
          <Text style={{ fontSize: 14, fontWeight: '800', color: colours.danger, fontVariant: ['tabular-nums'] }}>{fmtClock(seconds)}</Text>
        </>
      ) : (
        <MicGlyph />
      )}
    </Pressable>
  );
}

// A small mic drawn with views, so no icon font is needed.
function MicGlyph() {
  const c = colours.muted;
  return (
    <View style={{ width: 20, height: 22, alignItems: 'center' }}>
      <View style={{ width: 8, height: 13, borderRadius: 4, backgroundColor: c }} />
      <View style={{ position: 'absolute', top: 6, width: 14, height: 11, borderRadius: 7, borderTopLeftRadius: 2, borderTopRightRadius: 2, borderWidth: 2, borderTopWidth: 0, borderColor: c }} />
      <View style={{ width: 2, height: 3, backgroundColor: c }} />
      <View style={{ width: 10, height: 2, borderRadius: 1, backgroundColor: c }} />
    </View>
  );
}
