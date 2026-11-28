// The five parts of a life that Learnéd's reminders sort into (28 Nov 2026, Taj: "everyday requires
// intense effort and reminders in all aspects").
export type Area = 'mind' | 'body' | 'people' | 'money' | 'home';
export const AREA_ORDER: Area[] = ['mind', 'body', 'people', 'money', 'home'];
export const AREAS: Record<Area, { name: string; colour: string; line: string; icon: string }> = {
  mind: { name: 'Mind', colour: '#3B3F9E', line: 'Learning, reading, thinking', icon: 'school-outline' },
  body: { name: 'Body', colour: '#B8487A', line: 'Training, food, sleep', icon: 'barbell-outline' },
  people: { name: 'People', colour: '#2E7D4F', line: 'Family, friends, the ones you love', icon: 'people-outline' },
  money: { name: 'Money', colour: '#A8841C', line: 'Saving, spending, what is coming', icon: 'wallet-outline' },
  home: { name: 'Home', colour: '#2C7FA8', line: 'The house and life admin', icon: 'home-outline' },
};
export type Repeat = 'daily' | 'weekdays' | 'weekly' | 'fortnightly' | 'monthly' | 'yearly';
export const REPEATS: { id: Repeat | null; label: string }[] = [
  { id: null, label: 'Once' },
  { id: 'daily', label: 'Every day' },
  { id: 'weekdays', label: 'Weekdays' },
  { id: 'weekly', label: 'Every week' },
  { id: 'fortnightly', label: 'Every fortnight' },
  { id: 'monthly', label: 'Every month' },
  { id: 'yearly', label: 'Every year' },
];
export const repeatLabel = (r: string | null | undefined) => REPEATS.find((x) => x.id === (r ?? null))?.label ?? 'Once';
