// 9 Nov 2026 concept: colour light drifting through her sky, so the space has depth and feels alive.
// Big soft blobs of violet, teal and pink behind everything. On phones the blur comes from expo-blur
// when this is built for real; the web mockup uses a CSS blur.
import { Platform, StyleSheet, View } from 'react-native';

const BLOBS = [
  { left: -120, top: -80, size: 380, colour: '#7A4DFF', opacity: 0.55 },
  { left: 180, top: 260, size: 340, colour: '#19C3B2', opacity: 0.32 },
  { left: -100, top: 760, size: 360, colour: '#FF4FA3', opacity: 0.28 },
  { left: 200, top: 1200, size: 380, colour: '#5B7CFF', opacity: 0.4 },
  { left: -60, top: 1700, size: 340, colour: '#B04DFF', opacity: 0.35 },
];

export function Aurora() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {BLOBS.map((b, i) => (
        <View key={i} style={[{ position: 'absolute', left: b.left, top: b.top, width: b.size, height: b.size, borderRadius: b.size / 2, backgroundColor: b.colour, opacity: b.opacity }, Platform.OS === 'web' ? ({ filter: 'blur(90px)' } as any) : null]} />
      ))}
    </View>
  );
}
