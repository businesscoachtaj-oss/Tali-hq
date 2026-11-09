// Order only (10 Nov 2026): Tali HQ is for any small business, so no one trade leads the list. The values
// are unchanged, so everyone's saved answer still matches.
export const BUSINESS_TYPES = ['Trades', 'Coach or consultant', 'Health and beauty', 'Online business', 'Personal trainer', 'Gym or studio', 'Something else'];

// Times offered for the morning brief (local time, stored as HH:MM:SS).
export const BRIEF_TIMES = ['05:30', '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00'];

export function prettyTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, '0')}${suffix}`;
}

// Domain for Tali's email addresses (Pro). Empty until the inbound domain is set up in Resend,
// so the app never shows an address that can't receive mail yet.
export const INBOUND_DOMAIN = process.env.EXPO_PUBLIC_INBOUND_DOMAIN || 'tali.totality360.com.au';

// Where the Sleep sound loops live. They ship with the web app (public/sounds, served by Vercel)
// rather than inside the native binary, so phone builds stream them from the web deploy and the
// web app itself uses the relative path.
export const SOUNDS_BASE = 'https://talihq.com.au/sounds';

// Taj's account. The Founder screen (Me) only shows for this user, and founder_stats() only answers it.
export const FOUNDER_USER_ID = 'e89ca9de-a86e-4dd6-8094-bc518566352e';
