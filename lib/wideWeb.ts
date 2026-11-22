// lib/wideWeb.ts (22 Nov 2026, Taj: the web app on a PC, same as Totality, Training and Nutrition)
// On a wide browser window the tabs move from the bottom of the screen to a side menu with their
// names, with Tali HQ's name at the top and Tali at the bottom. Screens already sit in a centred
// column over her sky, so the sky still fills the window. Web only, and only from WIDE_MIN wide:
// phones, the phone apps and tablets held upright are untouched.
import type { ComponentProps } from 'react';
import type { Tabs } from 'expo-router';
import { Platform, useWindowDimensions } from 'react-native';
import { colours } from '@/constants/theme';

export const WIDE_MIN = 1000; // a PC, or a tablet on its side
export const SIDEBAR = 240; // width of the side menu
export const SIDE_TOP = 92; // room above the tabs for the name
export const SIDE_BOTTOM = 150; // room under the tabs for Tali

type TabOptions = Exclude<ComponentProps<typeof Tabs>['screenOptions'], undefined | ((...args: any[]) => any)>;

/** True on a wide web window. False on phones and in the phone apps. */
export function useWide(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WIDE_MIN;
}

/** Tab options for a wide web window: side menu with labels. Returns opts unchanged otherwise. */
export function withWideTabs(wide: boolean, opts: TabOptions): TabOptions {
  if (!wide) return opts;
  return {
    ...opts,
    tabBarPosition: 'left',
    tabBarVariant: 'uikit',
    tabBarShowLabel: true,
    tabBarLabelPosition: 'beside-icon',
    tabBarLabelStyle: { fontSize: 15, fontWeight: '600', marginLeft: 14 },
    tabBarItemStyle: { borderRadius: 10, marginVertical: 2, paddingVertical: 4, marginHorizontal: 12 },
    tabBarActiveBackgroundColor: 'rgba(185,166,255,0.16)',
    tabBarStyle: {
      backgroundColor: '#0D0B22',
      borderRightWidth: 1,
      borderRightColor: colours.border,
      borderTopWidth: 0,
      paddingTop: SIDE_TOP,
      paddingBottom: SIDE_BOTTOM,
      width: SIDEBAR,
      minWidth: SIDEBAR, // the router's own default is 360
      maxWidth: SIDEBAR,
    },
  };
}
