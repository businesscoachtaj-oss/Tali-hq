// Tali HQ colours, matching the Tali HQ dashboard and the waitlist page.
export const colours = {
  bg: '#F5F3F0',
  surface: '#FFFFFF',
  sunk: '#F1EDE8',
  border: '#E7E2DC',
  borderStrong: '#D3CCC4',
  text: '#272626',
  muted: '#66615B',
  faint: '#8E877F',
  purple: '#6C3483',
  purpleSoft: '#F3EBF7',
  purpleInk: '#5A2A6E',
  orange: '#ED8008',
  orangeSoft: '#FFF1E0',
  danger: '#C0392B',
  good: '#1E8E4E',
  onPurple: '#FFFFFF',
};

export const radius = { card: 18, pill: 999, input: 12 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

// Safe area edges for tab screens: the tab bar already covers the phone's gesture bar.
// Written as an object because on web the library pads any edge missing from a list,
// which opened a gap above the tabs on Android phones.
export const NO_BOTTOM = { top: 'additive', left: 'additive', right: 'additive', bottom: 'off' } as const;
