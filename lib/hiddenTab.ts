// lib/hiddenTab.ts
// ADDED (22 Nov 2026, Expo SDK 58 upgrade).
// Most screens in each portal sit inside the tab layout without a button on the tab bar, so the
// bar stays on screen while you are on them. Up to SDK 54 that was written `href: null`. From
// SDK 58 `href: null` means "this screen cannot be opened" and the router sends you to the first
// tab instead. These two options are exactly what `href: null` used to do: the screen opens as
// normal and its tab bar button is not drawn.
export const HIDDEN_TAB = {
  tabBarItemStyle: { display: 'none' as const },
  tabBarButton: () => null,
}
