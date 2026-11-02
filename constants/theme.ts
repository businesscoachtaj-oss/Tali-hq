// Tali HQ colours, matching the Tali HQ dashboard and the waitlist page.
export const colours = {
  bg: '#F1EEEA',
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

// Depth for cards, tiles and buttons so they lift off the page (Nov 3 2026, Taj's "soft lift").
const ink = '#272626';
export const elevation = {
  // white cards sitting on the page grey
  card: { shadowColor: ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  // grey tiles inside a card (stat boxes, counters, strips)
  tile: { shadowColor: ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  // filled brand-colour buttons: pass the button colour so the glow is in its own colour
  button: (colour: string) => ({ shadowColor: colour, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.28, shadowRadius: 8, elevation: 4 }),
  // floating round buttons (help "?", add, etc.)
  fab: (colour: string) => ({ shadowColor: colour, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 }),
  // bottom tab bar casting upward over the content
  tabBar: { shadowColor: ink, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 10 },
} as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

// Safe area edges for tab screens: the tab bar already covers the phone's gesture bar.
// Written as an object because on web the library pads any edge missing from a list,
// which opened a gap above the tabs on Android phones.
export const NO_BOTTOM = { top: 'additive', left: 'additive', right: 'additive', bottom: 'off' } as const;
