// Every brain game (from the brain games app, 25 Nov 2026), which portal has it, and which part of Tali's brain it works most (25 Nov 2026).
// Names, looks and puzzles are our own.
import type { RegionId } from './brain';
import type { Kind } from './store';

export type Game = {
  id: string; name: string; what: string; region: RegionId; colour: string; soft: string; mins: number;
  portals: Kind[]; daily: boolean; emoji: string; how: string[]; kidsName?: string; kidsWhat?: string;
};
const T = { teal: ['#1F7A6D', '#DCEFEA'], amber: ['#B86F0E', '#F8E7CC'], clay: ['#C4573A', '#F5DDD5'], plum: ['#5B4A86', '#E5E0F0'], moss: ['#4F6E2C', '#E3EBD6'], sky: ['#2C6F96', '#D9E9F2'], rose: ['#A8456F', '#F3DDE6'], slate: ['#5D6577', '#E3E5EA'] } as const;
const g = (id: string, name: string, what: string, region: RegionId, c: keyof typeof T, mins: number, portals: Kind[], emoji: string, how: string[], extra: Partial<Game> = {}): Game =>
  ({ id, name, what, region, colour: T[c][0], soft: T[c][1], mins, portals, daily: true, emoji, how, ...extra });

export const GAMES: Game[] = [
  g('six', 'Six Tries', 'Find the five letter word', 'temporal', 'teal', 3, ['everyone', 'gentle'], '🔤',
    ['Guess the five letter word in six tries.', 'Teal means the letter is in the right spot.', 'Amber means it is in the word, in another spot.', 'Grey means it is not in the word.']),
  g('four', 'Four by Four', 'Sort 16 words into 4 groups', 'prefrontal', 'plum', 5, ['everyone', 'gentle'], '🧩',
    ['Find four groups of four words that have something in common.', 'Tap four words and tap Check.', 'You can slip four times.', 'Groups go from easy to tricky.']),
  g('trail', 'Trail', 'Find the words on today\'s theme', 'temporal', 'moss', 6, ['everyone'], '🌿',
    ['Every letter belongs to one word on today\'s theme.', 'Tap letters that touch, in any direction, to trace a word.', 'Tap the last letter again, or Enter, to check it.', 'Stuck? Hint shows where the next word starts.']),
  g('keys', 'Keys', 'Tap the tiles in time', 'cerebellum', 'clay', 2, ['everyone'], '🎹',
    ['Tiles fall down four lanes.', 'Tap each tile before it crosses the line.', 'Miss three and the round ends.', 'It gets faster as you go.']),
  g('recall', 'Recall', 'Remember the pattern, then repeat it', 'hippocampus', 'sky', 3, ['everyone', 'gentle'], '🧠',
    ['Squares light up one after another.', 'Tap them back in the same order.', 'Each round adds one more.', 'Three lives.']),
  g('sums', 'Sums', 'Make the target from the tiles', 'parietal', 'amber', 4, ['everyone', 'gentle'], '➕',
    ['Each round has a target number.', 'Tap tiles that add up to it exactly.', 'Five rounds, each a bit harder.', 'No timer. Take your time.']),
  g('stop', 'Stop Go', 'Tap for go, hold back for stop', 'frontal', 'rose', 2, ['everyone'], '🚦',
    ['Tap when you see a green circle.', 'Don\'t tap when you see a red square.', 'Be quick, but not too quick.', '40 turns.']),
  g('spot', 'Spot', 'Find the odd one out', 'occipital', 'teal', 2, ['everyone', 'gentle'], '👁️',
    ['One shape is different from the rest.', 'Tap it as fast as you can.', 'Ten rounds, each a bit harder.']),
  g('focus', 'Focus', 'Which way does the middle arrow point?', 'thalamus', 'amber', 2, ['everyone'], '🎯',
    ['A row of arrows shows up.', 'Tap the way the middle one points.', 'Ignore the others. They try to trick you.', '30 turns.']),
  g('room', 'Read the Room', 'What are they most likely feeling?', 'amygdala', 'clay', 3, ['everyone', 'gentle'], '💬',
    ['Read a short moment.', 'Pick what the person most likely feels.', 'Then see why. Five a day.']),
  g('mirror', 'Mirror', 'Copy the pattern in the mirror', 'corpus_callosum', 'plum', 3, ['everyone'], '🪞',
    ['A pattern shows on the left.', 'Copy it on the right, flipped like a mirror.', 'Six rounds, each a bit bigger.']),
  g('breathe', 'Breathe', 'Two minutes of slow breathing', 'brainstem', 'slate', 2, ['everyone', 'gentle', 'kids'], '🌬️',
    ['Breathe in as the circle grows.', 'Hold when it holds.', 'Breathe out slowly as it shrinks.', 'Slow breaths out help your body settle.'], { daily: false, kidsName: 'Balloon', kidsWhat: 'Blow up the balloon slowly' }),
  g('winddown', 'Wind Down', 'Get ready for a good sleep', 'hypothalamus', 'sky', 3, ['everyone', 'gentle'], '🌙',
    ['Tick off a short routine before bed.', 'Log how you slept this morning.', 'A steady bedtime helps your body clock.'], { daily: false }),
  g('habits', 'Habits', 'The small things that add up', 'basal_ganglia', 'moss', 1, ['everyone', 'gentle'], '🌱',
    ['Tick a habit when you do it.', 'Keep it going day after day.', 'Habits get easier the more you repeat them.'], { daily: false }),
  // Kids
  g('word-hop', 'Word Hop', 'Guess the 4 letter word', 'temporal', 'teal', 3, ['kids'], '🐸',
    ['Look at the picture.', 'Guess the four letter word.', 'Green means right spot. Yellow means it\'s in the word.']),
  g('pairs', 'Pairs', 'Find the matching cards', 'hippocampus', 'plum', 3, ['kids', 'gentle'], '🃏',
    ['Turn over two cards.', 'If they match, they stay up.', 'Find all the pairs in as few turns as you can.']),
  g('count-up', 'Count Up', 'Add up to the target', 'parietal', 'amber', 3, ['kids'], '🔢',
    ['Look at the target number.', 'Tap numbers that add up to it.', 'Five rounds.']),
  g('feelings', 'Feelings', 'How is this person feeling?', 'amygdala', 'clay', 2, ['kids'], '😊',
    ['Look at the face.', 'Pick the feeling.', 'Six faces.']),
  g('frog', 'Frog Stop', 'Hop on green, stop on red', 'frontal', 'rose', 2, ['kids'], '🚦',
    ['Tap when the frog is on a green lily pad.', 'Don\'t tap on a red one!', '20 hops.']),
];
// 28 Nov 2026: inside Learnéd (the main app) it is grown-ups only, and Learnéd already has its own sleep and
// habits, so Wind Down, Habits and the kids' games stay in the games app.
const IN_APP = new Set(['six', 'four', 'trail', 'keys', 'recall', 'sums', 'stop', 'spot', 'focus', 'room', 'mirror', 'breathe']);
export const APP_GAMES = GAMES.filter(x => IN_APP.has(x.id));
export const gameById = (id: string) => APP_GAMES.find(x => x.id === id);
export const gamesFor = (k: Kind) => APP_GAMES.filter(x => x.portals.includes(k));
export const gamesForRegion = (r: RegionId, k: Kind = 'everyone') => APP_GAMES.filter(x => x.region === r && x.portals.includes(k));
/** Today's set on each portal's home. */
export const TODAY: Record<Kind, string[]> = {
  everyone: ['six', 'four', 'trail', 'keys'],
  kids: ['word-hop', 'pairs', 'count-up', 'feelings'],
  gentle: ['six', 'pairs', 'four'],
};
/** What someone said they want to work on, and the part of the brain that goes with it. */
export const GOAL_REGION: Record<string, RegionId> = { Words: 'temporal', Memory: 'hippocampus', Focus: 'thalamus', Numbers: 'parietal', 'Feeling calmer': 'brainstem', Sleep: 'hypothalamus', 'Reading people': 'amygdala', 'Better habits': 'basal_ganglia' };
export const HABITS = [
  { id: 'sleep', label: 'Slept 7 hours or more', region: 'hypothalamus' as RegionId },
  { id: 'walk', label: 'Moved for 20 minutes', region: 'cerebellum' as RegionId },
  { id: 'people', label: 'Talked with someone I like', region: 'amygdala' as RegionId },
  { id: 'read', label: 'Read for 10 minutes', region: 'temporal' as RegionId },
  { id: 'new', label: 'Learnt something new', region: 'hippocampus' as RegionId },
];
