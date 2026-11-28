// The brain games' paper and ink (25 Nov 2026, from the brain games app), on the main app's fonts and
// colours since the games moved in (28 Nov 2026). One colour per game stays, so each game feels like itself.
import { colours } from '@/constants/theme';

export const C = {
  paper: colours.bg, card: colours.surface, ink: colours.ink, soft: colours.muted, faint: colours.faint, line: 'rgba(28,26,23,0.16)', key: '#E9E1CF', cream: '#FFF8EA',
  teal: '#1F7A6D', amber: '#C98018', clay: '#C4573A', plum: '#5B4A86', moss: '#5E7D3A', slate: '#8C8577', sky: '#2C6F96', rose: '#A8456F',
  tealSoft: '#DCEFEA', amberSoft: '#F8E7CC', claySoft: '#F5DDD5', plumSoft: '#E5E0F0', mossSoft: '#E3EBD6', skySoft: '#D9E9F2', roseSoft: '#F3DDE6',
  good: '#1F7A6D', bad: '#B3392F', night: '#1C1A2E',
};
// Headings in the app's serif. Body text is the phone's own font, bold is the app's sans.
export const F = { display: 'EBGaramond_500Medium', displayItalic: 'EBGaramond_400Regular_Italic', body: undefined, med: undefined, bold: 'PlusJakartaSans_700Bold' } as const;
export const R = { card: 6, tile: 6, pill: 4 };
