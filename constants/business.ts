export const BUSINESS_TYPES = ['Personal trainer', 'Gym or studio', 'Coach or consultant', 'Trades', 'Health and beauty', 'Online business', 'Something else'];

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
export const INBOUND_DOMAIN = process.env.EXPO_PUBLIC_INBOUND_DOMAIN ?? '';
