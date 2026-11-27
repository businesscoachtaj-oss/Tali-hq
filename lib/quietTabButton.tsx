// lib/quietTabButton.tsx
// ADDED (27 Nov 2026, Taj: "Why do the nav buttons have this massive black circle around them on the
// apps when clicked"). On Android the router draws a dark ripple with no edge behind a tapped tab, so a
// big grey circle spills over the tab bar and the screen. Every tab bar uses this button instead, with
// no ripple. iPhone and the web never showed one, so nothing changes there.
import type { ComponentProps } from 'react';
import { PlatformPressable } from 'expo-router/react-navigation';

export default function QuietTabButton(props: ComponentProps<typeof PlatformPressable>) {
  return <PlatformPressable {...props} android_ripple={{ color: 'transparent' }} />;
}
