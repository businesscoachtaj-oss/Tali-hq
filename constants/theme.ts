// Tali HQ colours, matching the Tali HQ dashboard and the waitlist page.
// 9 Nov 2026 concept "Inside her mind" (A + B): the app lives in her night sky. Glass cards over
// the stars, light ink, an editorial serif for headings, and her notes on warm paper.
export const colours = {
  bg: '#0C0A24',
  surface: 'rgba(58,44,140,0.55)',
  sunk: 'rgba(255,255,255,0.10)',
  border: 'rgba(196,178,255,0.30)',
  borderStrong: 'rgba(255,255,255,0.20)',
  text: '#F4F1FF',
  muted: '#B9B2D9',
  faint: '#8A83AE',
  purple: '#B9A6FF',
  purpleSoft: 'rgba(185,166,255,0.16)',
  purpleInk: '#D7CCFF',
  orange: '#FFB561',
  orangeSoft: 'rgba(255,181,97,0.16)',
  danger: '#FF8A7E',
  good: '#7FE0B0',
  onPurple: '#141033',
  paper: '#F3ECDD',
  ink: '#2A2340',
};

export const radius = { card: 18, pill: 999, input: 12 };

// Depth for cards, tiles and buttons so they lift off the page (Nov 3 2026, Taj's "soft lift").
const ink = '#272626';
export const elevation = {
  // white cards sitting on the page grey
  card: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 1 },
  // grey tiles inside a card (stat boxes, counters, strips)
  tile: { shadowColor: ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  // 6 Nov 2026 (depth pass): white buttons, chips and inputs get a small lift so nothing sits flat
  lift: { shadowColor: ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
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

// 9 Nov 2026 look refresh: one heading face for titles and section names, so Tali HQ has a look of
// its own. Body text stays the phone's own font.
export const heading = { fontFamily: 'InstrumentSerif_400Regular', fontWeight: '400' } as const;
export const headingSemi = { fontFamily: 'InstrumentSerif_400Regular', fontWeight: '400' } as const;
