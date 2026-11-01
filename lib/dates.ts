// Local-date helpers (the phone's own timezone).
export function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export const today = () => isoDate(new Date());

// "Today", "Tomorrow", "Yesterday", "3 days ago", or "Mon 16 Nov".
export function friendlyDate(iso: string) {
  const t = today();
  if (iso === t) return 'Today';
  if (iso === isoDate(addDays(new Date(), 1))) return 'Tomorrow';
  if (iso === isoDate(addDays(new Date(), -1))) return 'Yesterday';
  const d = new Date(`${iso}T12:00:00`);
  const diff = Math.round((d.getTime() - new Date(`${t}T12:00:00`).getTime()) / 86400000);
  if (diff < 0 && diff > -7) return `${-diff} days ago`;
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function friendlyTime(isoTs: string) {
  const d = new Date(isoTs);
  const date = friendlyDate(isoDate(d));
  const time = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase();
  return `${date}, ${time}`;
}

// Quick picks for follow-up dates.
export const FOLLOW_UP_PICKS: { label: string; days: number | null }[] = [
  { label: 'None', days: null },
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'Next week', days: 7 },
  { label: 'In 2 weeks', days: 14 },
  { label: 'In a month', days: 30 },
];
