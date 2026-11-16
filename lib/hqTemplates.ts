// lib/hqTemplates.ts
// ADDED (17 Nov 2026, Taj): the ready-made homes. Twelve templates, the home a business gets on day
// one for its type, and the rules that turn onboarding answers into a starting layout, so nobody
// starts on a blank page. Nothing in here uses AI or credits.
import type { Mode } from './mode';
import { BIZ_SWAP, BUILTINS, COLOURS, LIMITS, TRACKER_PRESETS, blockAllowed, builtinBlock, draftTracker, extraBlock, presetSpec, type Block, type BuiltIn, type Extra, type Plan, type Size, type TrackerSpec } from './widgets';

type Item = { t: string; over?: Partial<TrackerSpec>; size?: Size } | { b: BuiltIn; size?: Size } | { x: Extra; size?: Size };
export type Template = { key: string; name: string; desc: string; home: Mode | 'either'; forWho: string; items: Item[]; free: number[] };

const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const countdown = (title: string, days = 90): Extra => ({ type: 'countdown', title, date: inDays(days) });
const note = (text: string): Extra => ({ type: 'note', text });
const checklist = (title: string, items: string[] = []): Extra => ({ type: 'checklist', title, items: items.map((t) => ({ t, done: false })) });

// `free` lists which items the Free version keeps (6 blocks, 3 trackers).
export const TEMPLATES: Template[] = [
  { key: 'get_fit', name: 'Get fit', desc: 'Gym sessions, steps, water, sleep, food and training', home: 'life', forWho: 'Health and habits',
    items: [{ t: 'gym' }, { t: 'steps' }, { t: 'water' }, { t: 'sleep' }, { b: 'your_day' }, { b: 'habits' }, { x: countdown('My event') }, { b: 'due' }],
    free: [0, 1, 2, 4, 7, 6] },
  { key: 'save_money', name: 'Save money', desc: 'A savings goal, weekly spend, no-spend days, bills', home: 'life', forWho: 'Money',
    items: [{ t: 'savings', over: { name: 'Savings goal' }, size: 'wide' }, { t: 'spend' }, { t: 'no_spend' }, { b: 'money' }, { b: 'bills' }, { b: 'goals' }, { b: 'due' }, { x: note('What I am saving for') }],
    free: [0, 1, 2, 3, 6, 7] },
  { key: 'grow_business', name: 'Grow the business', desc: 'Revenue, calls, quotes, reviews, pipeline, invoices', home: 'business', forWho: 'My business',
    items: [{ t: 'revenue', size: 'wide' }, { t: 'calls' }, { t: 'quotes' }, { t: 'reviews' }, { b: 'pipeline' }, { b: 'invoices' }, { b: 'leads' }, { b: 'needs_you' }, { b: 'due' }],
    free: [0, 1, 2, 4, 7, 8] },
  { key: 'calm_mind', name: 'Calm mind', desc: 'Meditate, mood, reading, sleep, journal, sleep sounds', home: 'life', forWho: 'Health and habits',
    items: [{ t: 'meditate' }, { t: 'mood' }, { t: 'read' }, { t: 'sleep' }, { b: 'journal' }, { b: 'sleep' }, { x: note('A line I want to see each day') }],
    free: [0, 1, 2, 4, 5, 6] },
  { key: 'sleep_better', name: 'Sleep better', desc: 'Sleep, in bed on time, screens off, sleep sounds', home: 'life', forWho: 'Health and habits',
    items: [{ t: 'sleep', size: 'wide' }, { t: 'in_bed' }, { t: 'screens_off' }, { b: 'sleep' }, { b: 'journal' }],
    free: [0, 1, 2, 3, 4] },
  { key: 'pay_debt', name: 'Pay off a debt', desc: 'Debt left counting down, extra paid, bills, a debt-free date', home: 'life', forWho: 'Money',
    items: [{ t: 'debt', size: 'wide' }, { t: 'extra_paid' }, { b: 'bills' }, { b: 'money' }, { x: countdown('Debt free', 365) }],
    free: [0, 1, 3, 4] },
  { key: 'get_organised', name: 'Get organised', desc: 'Deep work, inbox zero, this week, a checklist, calendar', home: 'either', forWho: 'My week and to-dos',
    items: [{ t: 'deepwork', size: 'wide' }, { t: 'inbox_zero' }, { b: 'week' }, { b: 'due' }, { x: checklist('Today', ['The one big thing', 'Clear the inbox', 'Plan tomorrow']) }, { b: 'calendar' }],
    free: [0, 1, 2, 3, 5] },
  { key: 'run_jobs', name: 'Run the jobs', desc: 'Quotes sent, jobs finished, jobs on, win rate, invoices', home: 'business', forWho: 'Trades',
    items: [{ t: 'quotes' }, { t: 'jobs_done' }, { b: 'jobs', size: 'wide' }, { b: 'quote_rate' }, { b: 'invoices' }, { x: checklist('Before I leave site', ['Photos taken', 'Customer walked through', 'Invoice raised']) }],
    free: [0, 1, 2, 4] },
  { key: 'fill_diary', name: 'Fill the diary', desc: 'Bookings, rebooked customers, posts, bookings today', home: 'business', forWho: 'Health and beauty, coaches, trainers',
    items: [{ t: 'bookings' }, { t: 'rebooked' }, { t: 'posts' }, { b: 'bookings', size: 'wide' }, { b: 'happiness' }, { b: 'calendar' }],
    free: [0, 1, 2, 5] },
  { key: 'launch', name: 'Launch something', desc: 'A launch countdown, tasks done, posts, a checklist, goals', home: 'either', forWho: 'A big goal with a date',
    items: [{ x: countdown('Launch day', 60), size: 'wide' }, { t: 'launch_tasks', size: 'wide' }, { t: 'posts' }, { x: checklist('Launch list') }, { b: 'goals' }],
    free: [0, 1, 2, 4] },
  { key: 'family_home', name: 'Family and home', desc: 'Called Mum, date night, family dinners, birthdays, bills', home: 'life', forWho: 'The people in my life',
    items: [{ t: 'family' }, { t: 'date_night' }, { t: 'family_dinner' }, { b: 'people', size: 'wide' }, { b: 'calendar' }, { b: 'bills' }],
    free: [0, 1, 2, 3, 4] },
  { key: 'side_hustle', name: 'Side hustle', desc: 'Hours on it, revenue, first customers, pipeline, a countdown', home: 'business', forWho: 'A job and a business on the side',
    items: [{ t: 'hours_on_it' }, { t: 'revenue', over: { target: 1000 }, size: 'wide' }, { t: 'first_customers' }, { b: 'pipeline' }, { x: countdown('Quit-my-job day', 365) }, { b: 'goals' }],
    free: [0, 1, 2, 3, 5] },
];

/** Free can only have number and bar looks, day or week targets. Swap what does not fit so the preview is honest. */
export function forPlan(spec: TrackerSpec, plan: Plan): TrackerSpec {
  if (plan !== 'free') return spec;
  return {
    ...spec,
    style: LIMITS.free.styles.includes(spec.style) ? spec.style : spec.type === 'yesno' ? 'number' : 'bar',
    period: LIMITS.free.periods.includes(spec.period) ? spec.period : 'week',
    checkIn: false, source: 'manual',
  };
}

/** A template as blocks for this plan and home. Business blocks swap to the nearest built-in on a lower plan. */
export function templateBlocks(t: Template, plan: Plan, side: Mode, hasBusiness: boolean): { blocks: Block[]; more: number } {
  const full = t.items.length;
  const picks = plan === 'free' ? t.free.map((i) => t.items[i]) : t.items;
  const out: Block[] = [];
  const seen = new Set<string>();
  for (const it of picks) {
    if ('t' in it) out.push(draftTracker(forPlan(presetSpec(it.t, it.over), plan), it.size ?? (presetSpec(it.t).type === 'money' && presetSpec(it.t).period !== 'week' ? 'wide' : 'small')));
    else if ('x' in it) { if (blockAllowed(plan, { kind: 'extra', extra: it.x })) out.push(extraBlock(it.x, it.size ?? 'wide')); }
    else {
      let b: BuiltIn | null | undefined = it.b;
      if (!blockAllowed(plan, { kind: 'builtin', builtin: b })) b = BUILTINS[b].plan === 'biz' ? BIZ_SWAP[b] : null;
      if (b && hasBusiness && !BUILTINS[b].modes.includes(side)) b = null;
      if (b && !seen.has(b)) { seen.add(b); out.push(builtinBlock(b, it.size)); }
    }
  }
  return { blocks: out, more: plan === 'free' ? full - out.length : 0 };
}

/** Add a template to a home: keeps what is there, adds what is missing, no doubles. */
export function mergeBlocks(current: Block[], add: Block[], names: (b: Block) => string | null): Block[] {
  const have = new Set(current.map((b) => (b.kind === 'builtin' ? `b:${b.builtin}` : b.kind === 'tracker' ? `t:${(names(b) ?? '').toLowerCase()}` : `x:${b.extra?.type}:${b.extra && 'title' in b.extra ? b.extra.title : ''}`)));
  const fresh = add.filter((b) => !have.has(b.kind === 'builtin' ? `b:${b.builtin}` : b.kind === 'tracker' ? `t:${(b.spec?.name ?? '').toLowerCase()}` : `x:${b.extra?.type}:${b.extra && 'title' in b.extra ? b.extra.title : ''}`));
  return [...current, ...fresh];
}

// ── Onboarding ──────────────────────────────────────────────────────────────────────────
export const PLATE = ['My week and to-dos', 'My business', 'Money', 'Health and habits', 'The people in my life', 'Big goals'] as const;
export const DIFFERENCE = ['More customers', 'Getting paid on time', 'Keeping on top of jobs', 'Filling my diary', 'Running my team', 'Growing online'] as const;
export const TEAM_SIZE = ['Just me', '2 to 5', '6 or more'] as const;

// Trackers offered at "Anything you want to keep count of?", from what they picked.
const OFFER: Record<string, string[]> = {
  'My week and to-dos': ['deepwork'],
  'My business': ['revenue', 'quotes', 'calls'],
  Money: ['spend', 'savings'],
  'Health and habits': ['water', 'steps', 'sleep', 'gym', 'meditate'],
  'The people in my life': ['family'],
  'Big goals': ['read', 'savings'],
  'More customers': ['calls', 'posts', 'reviews'],
  'Getting paid on time': ['revenue'],
  'Keeping on top of jobs': ['quotes'],
  'Filling my diary': ['posts'],
  'Growing online': ['posts', 'reviews'],
};
export function offeredTrackers(plate: string[], difference: string[], hasBusiness: boolean): string[] {
  const out: string[] = [];
  for (const a of [...plate, ...difference]) for (const k of OFFER[a] ?? []) {
    if (!out.includes(k) && (hasBusiness || TRACKER_PRESETS[k]?.home === 'life' || k === 'deepwork')) out.push(k);
  }
  return out.length ? out : ['water', 'sleep', 'read', 'savings'];
}

// What each business type starts with (after Needs you, Due today and Money).
const BY_TYPE: Record<string, { blocks: [BuiltIn, Size?][]; trackers: string[] }> = {
  Trades: { blocks: [['jobs', 'wide'], ['quote_rate'], ['invoices']], trackers: ['quotes', 'revenue', 'reviews'] },
  'Coach or consultant': { blocks: [['bookings', 'wide'], ['leads'], ['calendar']], trackers: ['revenue', 'deepwork', 'posts'] },
  'Health and beauty': { blocks: [['bookings', 'wide'], ['happiness']], trackers: ['revenue', 'reviews', 'rebooked'] },
  'Online business': { blocks: [['visits'], ['cashflow'], ['leads']], trackers: ['revenue', 'posts'] },
  'Personal trainer': { blocks: [['bookings', 'wide'], ['leads']], trackers: ['revenue', 'reviews'] },
  'Gym or studio': { blocks: [['team', 'wide'], ['leads'], ['cashflow']], trackers: ['revenue', 'reviews'] },
  'Something else': { blocks: [['pipeline'], ['invoices']], trackers: ['revenue', 'quotes'] },
};
const BY_DIFFERENCE: Record<string, [BuiltIn | 'checklist', Size?][]> = {
  'More customers': [['leads'], ['pipeline']],
  'Getting paid on time': [['invoices', 'wide']],
  'Keeping on top of jobs': [['jobs', 'wide'], ['checklist']],
  'Filling my diary': [['bookings', 'wide'], ['calendar']],
  'Running my team': [['team', 'wide']],
  'Growing online': [['visits']],
};
const BY_PLATE_LIFE: Record<string, (BuiltIn | 'countdown')[]> = {
  'My week and to-dos': ['week', 'calendar'],
  Money: ['money', 'bills'],
  'Health and habits': ['your_day', 'habits'],
  'The people in my life': ['people'],
  'Big goals': ['goals', 'countdown'],
};
const BY_PLATE_BIZ: Record<string, BuiltIn[]> = {
  'My week and to-dos': ['calendar'],
  'My business': ['pipeline', 'invoices'],
  Money: ['cashflow'],
  'Big goals': ['goals'],
};

export type Answers = {
  plate: string[]; hasBusiness: boolean; businessType: string; difference: string[]; teamSize: string;
  trackers: string[];                      // preset keys they ticked
  targets: Record<string, number | null>;  // their own numbers from "How much is a good day?"
  names: Record<string, string>;           // renamed ready-mades ("Called Mum" to "Called Dad")
  custom: TrackerSpec[];                   // "Something else"
};

/**
 * The starting homes from the onboarding answers. Order: Needs you and Due today first, then
 * trackers (money and savings wide, the rest small), then the bigger built-in blocks. No doubles.
 * A Business block the plan does not have swaps to the nearest built-in.
 */
export function startingLayout(a: Answers, plan: Plan): { life: Block[]; business: Block[]; from: { life: string[]; business: string[] } } {
  const single = !a.hasBusiness; // no business: one home that takes everything
  const mk = (side: Mode) => {
    const blocks: Block[] = [];
    const seen = new Set<string>();
    const add = (b: BuiltIn | 'checklist' | 'countdown', size?: Size) => {
      if (b === 'checklist') { if (plan !== 'free' && !seen.has('x:checklist')) { seen.add('x:checklist'); blocks.push(extraBlock({ type: 'checklist', title: 'Job checklist', items: [] })); } return; }
      if (b === 'countdown') { if (!seen.has('x:countdown')) { seen.add('x:countdown'); blocks.push(extraBlock({ type: 'countdown', title: 'My big goal', date: inDays(90) }, 'small')); } return; }
      let k: BuiltIn | null | undefined = b;
      if (!blockAllowed(plan, { kind: 'builtin', builtin: k })) k = BUILTINS[k].plan === 'biz' ? BIZ_SWAP[k] : null;
      if (!k || seen.has(k)) return;
      if (!single && !BUILTINS[k].modes.includes(side)) return;
      seen.add(k);
      blocks.push(builtinBlock(k, size ?? (BUILTINS[k].wide ? 'wide' : 'wide')));
    };
    const tracker = (key: string) => {
      const p = TRACKER_PRESETS[key];
      if (!p) return null;
      const over: Partial<TrackerSpec> = {};
      if (a.targets[key] !== undefined) over.target = a.targets[key];
      if (a.names[key]?.trim()) over.name = a.names[key].trim();
      const spec = forPlan(presetSpec(key, over), plan);
      return draftTracker(spec, spec.type === 'money' && key !== 'spend' && key !== 'extra_paid' ? 'wide' : 'small');
    };
    const isBizTracker = (key: string) => TRACKER_PRESETS[key]?.home === 'business';
    return { blocks, add, tracker, isBizTracker };
  };

  // Life
  const L = mk('life');
  L.add('due'); L.add('needs_you');
  const lifeTrackers = a.trackers.filter((k) => single || !L.isBizTracker(k)).map(L.tracker).filter(Boolean) as Block[];
  const lifeCustom = single ? a.custom : a.custom.filter((c) => !(c as any).business);
  L.blocks.push(...lifeTrackers, ...lifeCustom.map((c) => draftTracker(forPlan(c, plan), c.type === 'money' ? 'wide' : 'small')));
  for (const p of a.plate) for (const b of BY_PLATE_LIFE[p] ?? []) L.add(b);
  if (single) { L.add('night_idea'); }
  L.add('journal');

  // Business
  const B = mk('business');
  if (a.hasBusiness) {
    B.add('needs_you'); B.add('due');
    const type = BY_TYPE[a.businessType] ?? BY_TYPE['Something else'];
    const keys = [...a.trackers.filter(B.isBizTracker), ...type.trackers.filter((k) => !a.trackers.includes(k))];
    const uniq = keys.filter((k, i) => keys.indexOf(k) === i);
    B.blocks.push(...(uniq.map(B.tracker).filter(Boolean) as Block[]), ...a.custom.filter((c) => (c as any).business).map((c) => draftTracker(forPlan(c, plan), c.type === 'money' ? 'wide' : 'small')));
    B.add('money');
    // Their "biggest difference" answers go ahead of the blocks for their type.
    for (const d of a.difference) for (const [b, size] of BY_DIFFERENCE[d] ?? []) B.add(b, size);
    for (const [b, size] of type.blocks) B.add(b, size);
    for (const p of a.plate) for (const b of BY_PLATE_BIZ[p] ?? []) B.add(b);
    if (a.teamSize && a.teamSize !== 'Just me') B.add('team', 'wide');
  }
  const from = { life: a.plate.filter((p) => p !== 'My business'), business: [a.businessType, ...a.difference].filter(Boolean) };
  return { life: L.blocks, business: B.blocks, from };
}

/**
 * "Something else": they type a name and the type, unit and target are guessed from the words.
 * Set rules, not AI, so it never costs credits or counts as a message.
 */
export function guessTracker(name: string, i = 0): TrackerSpec {
  const n = name.trim();
  const s = n.toLowerCase();
  const colour = COLOURS[i % COLOURS.length];
  const base = { name: n.slice(0, 60), colour, style: 'bar' as const, step: 1 as number | null };
  const num = Number((s.match(/(\d[\d,.]*)/)?.[1] ?? '').replace(/,/g, '')) || null;
  if (/\$|sav|deposit|fund|revenue|sales|income|earn|debt|loan|spend|spent|money/.test(s))
    return { ...base, type: 'money', unit: 'A$', target: num ?? (/(sav|deposit|fund|debt|loan)/.test(s) ? 5000 : 1000), period: /(sav|deposit|fund|debt|loan)/.test(s) ? 'total' : 'month', step: null };
  if (/hour|hrs|time|sleep|study|practice|practise|deep work/.test(s))
    return { ...base, type: 'time', unit: 'h', target: num ?? (/sleep/.test(s) ? 8 : 5), period: /sleep/.test(s) ? 'day' : 'week', step: 0.5 };
  if (/mood|energy|stress|pain|focus|how i feel/.test(s)) return { ...base, type: 'scale', unit: '/5', target: null, period: 'day', style: 'chart', step: null };
  if (/^(no |did |called |call |took |made |went )|daily|every day|floss|stretch|meditat|journal|vitamin|pray|walked the dog|bed by/.test(s))
    return { ...base, type: 'yesno', unit: '', target: null, period: 'day', style: 'streak', step: null };
  const unit = /page/.test(s) ? 'pages' : /call/.test(s) ? 'calls' : /km|kilomet|run|ride/.test(s) ? 'km' : /word/.test(s) ? 'words' : /step/.test(s) ? 'steps' : /post/.test(s) ? 'posts' : /email/.test(s) ? 'emails' : /water|litre/.test(s) ? 'L' : /session|workout|gym|class/.test(s) ? 'sessions' : /book/.test(s) ? 'books' : '';
  const daily = /page|word|step|water|litre/.test(s);
  return { ...base, type: 'count', unit, target: num ?? (unit === 'pages' ? 20 : unit === 'steps' ? 10000 : unit === 'L' ? 3 : unit === 'words' ? 500 : unit === 'km' ? 20 : 5), period: daily ? 'day' : 'week', step: unit === 'steps' || unit === 'words' ? null : unit === 'L' ? 0.25 : 1 };
}
