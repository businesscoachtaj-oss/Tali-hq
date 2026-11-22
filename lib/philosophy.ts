// 23 Nov 2026 (Taj: "pick your school of philosophy, and it recommends the text, and the actions and
// lessons and further reading and how to live in line with that philosophy", plus "a quote of the day
// on the main page which you can save or dismiss"). Free for everyone.
//
// Quotes are word for word from public domain translations, each checked against a published copy
// on 23 Nov 2026, and say which translation. Lessons and actions are Tali's plain-English summaries,
// not quotes. Texts marked with a book id open in Tali's library (/library?book=...).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export type Quote = { id: string; text: string; who: string; from: string };
export type School = {
  id: string;
  name: string;
  line: string;
  idea: string;
  colour: string;
  lessons: { title: string; text: string }[];
  actions: string[];
  read: { title: string; author: string; book?: string }[];
  further: { title: string; author: string }[];
  quotes: Quote[];
};

export const SCHOOLS: School[] = [
  {
    id: 'stoicism', name: 'Stoicism', colour: '#3B3F9E',
    line: 'Know what is yours to control, and give your all to that.',
    idea: 'Started in Athens around 300 BC and lived by an emperor, a slave and a statesman. Your judgements and your actions are up to you. Almost everything else is not, so you stop spending yourself on it.',
    lessons: [
      { title: 'Split the world in two', text: 'What you think, choose and do is yours. Other people, the past and the outcome are not. Put your effort where it can land.' },
      { title: 'Watch the story you add', text: 'Most of what hurts is the opinion you put on top of what happened. Notice the opinion and you can change it.' },
      { title: 'Remember you will die', text: 'Time is the one thing you can never earn back. Keeping that in mind makes it easier to spend on purpose.' },
    ],
    actions: [
      'Each morning, name one thing today that is in your control and one that is not.',
      'When something annoys you, write down the event, then the story you told yourself about it.',
      'Each night, ask: what did I do well, what did I get wrong, what will I do differently?',
    ],
    read: [
      { title: 'Meditations', author: 'Marcus Aurelius', book: 'pg2680' },
      { title: 'The Enchiridion', author: 'Epictetus', book: 'pg45109' },
      { title: 'Selected Discourses', author: 'Epictetus', book: 'pg10661' },
      { title: 'On Benefits', author: 'Seneca', book: 'pg3794' },
    ],
    further: [
      { title: 'How to Think Like a Roman Emperor', author: 'Donald Robertson' },
      { title: 'A Guide to the Good Life', author: 'William B. Irvine' },
    ],
    quotes: [
      { id: 'st1', text: 'Do not act as if thou wert going to live ten thousand years. Death hangs over thee. While thou livest, while it is in thy power, be good.', who: 'Marcus Aurelius', from: 'Meditations 4.17, tr. George Long' },
      { id: 'st2', text: 'Nothing, Lucilius, is ours, except time.', who: 'Seneca', from: 'Letters to Lucilius 1, tr. Richard M. Gummere' },
      { id: 'st3', text: 'Of things some are in our power, and others are not.', who: 'Epictetus', from: 'Enchiridion 1, tr. George Long' },
      { id: 'st4', text: 'Men are disturbed not by the things which happen, but by the opinions about the things.', who: 'Epictetus', from: 'Enchiridion 5, tr. George Long' },
    ],
  },
  {
    id: 'epicureanism', name: 'Epicureanism', colour: '#2E8A63',
    line: 'A quiet, pleasant life with good friends is the whole point.',
    idea: "Epicurus taught in a garden outside Athens. Pleasure is the goal, but he meant the calm kind: no pain in the body, no trouble in the mind. Friends, simple food and freedom from fear get you most of the way.",
    lessons: [
      { title: 'Want less, enjoy more', text: 'Most wants are neither natural nor needed. Drop them and you have fewer ways to be unhappy.' },
      { title: 'Friendship is the big one', text: 'Of everything that makes a life happy, he put friends first. Eat with people you love.' },
      { title: "Don't fear the end", text: 'Where death is, you are not. Fear of it steals time from the life you do have.' },
    ],
    actions: [
      'Share a simple meal with a friend this week, and make the time unhurried.',
      'Before you buy something, ask whether you want it or just want to stop wanting it.',
      'List three plain pleasures you had today: a coffee, a walk, a good laugh.',
    ],
    read: [
      { title: 'Letter to Menoeceus', author: 'Epicurus' },
      { title: 'On the Nature of Things', author: 'Lucretius' },
    ],
    further: [
      { title: 'Travels with Epicurus', author: 'Daniel Klein' },
      { title: 'How to Be an Epicurean', author: 'Catherine Wilson' },
    ],
    quotes: [
      { id: 'ep1', text: 'Death, therefore, the most awful of evils, is nothing to us.', who: 'Epicurus', from: 'Letter to Menoeceus, tr. R. D. Hicks' },
    ],
  },
  {
    id: 'buddhism', name: 'Buddhism', colour: '#A8561A',
    line: 'Suffering comes from clinging. Loosen your grip.',
    idea: 'The teaching of the Buddha, about 2,500 years ago. Life brings pain, and a lot of our suffering comes from craving things to be other than they are. A clear, kind, attentive mind is the way through.',
    lessons: [
      { title: 'Everything changes', text: 'Good moments pass and so do bad ones. Holding on to either is where it hurts.' },
      { title: 'Your mind is trainable', text: 'Attention is a skill. A few minutes a day of noticing your breath changes how you meet the rest.' },
      { title: 'Kindness first', text: "Hatred doesn't end hatred. Start with how you speak to yourself." },
    ],
    actions: [
      'Sit for five minutes and count ten breaths. When you lose count, start again without fuss.',
      'Eat one meal today without your phone, and notice it.',
      'When you feel a strong craving, name it, and wait ten minutes before acting.',
    ],
    read: [
      { title: 'The Dhammapada', author: 'tr. F. Max Müller' },
    ],
    further: [
      { title: 'What the Buddha Taught', author: 'Walpola Rahula' },
      { title: 'Why Buddhism Is True', author: 'Robert Wright' },
    ],
    quotes: [
      { id: 'bu1', text: 'All that we are is the result of what we have thought: it is founded on our thoughts, it is made up of our thoughts.', who: 'The Dhammapada', from: 'Verse 1, tr. F. Max Müller' },
      { id: 'bu2', text: 'For hatred does not cease by hatred at any time: hatred ceases by love, this is an old rule.', who: 'The Dhammapada', from: 'Verse 5, tr. F. Max Müller' },
    ],
  },
  {
    id: 'taoism', name: 'Taoism', colour: '#2C7FA8',
    line: "Go with the grain of things. Don't force it.",
    idea: 'From the Tao Te Ching, said to be by Laozi. There is a natural way things unfold. The wise person works with it, keeps things simple, and gets a lot done without strain.',
    lessons: [
      { title: 'Effortless action', text: 'The best work often looks easy because it follows the shape of the problem. Look for the grain before you push.' },
      { title: 'Small steps', text: 'Big things are built from small ones. Start where you are, with what is in front of you.' },
      { title: 'Know yourself', text: 'Reading other people is clever. Knowing yourself is wiser.' },
    ],
    actions: [
      "Pick the task you're forcing and ask what the easiest next step is. Do only that.",
      'Spend ten minutes outside today doing nothing in particular.',
      'Clear one cluttered surface. Leave it empty for a day.',
    ],
    read: [
      { title: 'Tao Teh King', author: 'Laozi', book: 'pg216' },
    ],
    further: [
      { title: 'The Tao of Pooh', author: 'Benjamin Hoff' },
      { title: 'Lao Tzu: Tao Te Ching, a book about the Way', author: 'Ursula K. Le Guin' },
    ],
    quotes: [
      { id: 'ta1', text: 'The journey of a thousand lî commenced with a single step.', who: 'Laozi', from: 'Tao Te Ching 64, tr. James Legge' },
      { id: 'ta2', text: 'He who knows other men is discerning; he who knows himself is intelligent.', who: 'Laozi', from: 'Tao Te Ching 33, tr. James Legge' },
    ],
  },
  {
    id: 'confucianism', name: 'Confucianism', colour: '#B3392F',
    line: 'Become a good person through daily practice and your relationships.',
    idea: 'The teaching of Confucius in China, about 2,500 years ago. Character is built through habits, learning and how you treat the people around you: family, friends, the people you work with.',
    lessons: [
      { title: 'Keep learning', text: 'Study is a pleasure for life, and it never needs to finish.' },
      { title: 'Check yourself daily', text: 'Were you faithful to the people who rely on you? Honest with friends? Did you practise what you learned?' },
      { title: 'Rituals matter', text: 'Small ways of showing respect, like greeting people well, shape who you become.' },
    ],
    actions: [
      'Tonight, ask the three questions: faithful at work, sincere with friends, practised what I learned.',
      'Learn one new thing today and tell someone about it.',
      'Call an older relative this week, just to ask how they are.',
    ],
    read: [
      { title: 'The Analects', author: 'Confucius', book: 'pg3330' },
    ],
    further: [
      { title: 'The Path', author: 'Michael Puett and Christine Gross-Loh' },
      { title: 'Confucius: And the World He Created', author: 'Michael Schuman' },
    ],
    quotes: [
      { id: 'co1', text: 'Is it not pleasant to learn with a constant perseverance and application?', who: 'Confucius', from: 'Analects 1.1, tr. James Legge' },
    ],
  },
  {
    id: 'existentialism', name: 'Existentialism', colour: '#8A4FB8',
    line: 'Life comes without a set meaning. You make yours by how you live.',
    idea: 'A modern school (Kierkegaard, Nietzsche, Sartre, de Beauvoir, Camus). You are free, and so you are responsible. Meaning is made by choosing, acting and owning the results, especially when it is hard.',
    lessons: [
      { title: "You're always choosing", text: 'Not deciding is a decision too. Own your choices, including the small daily ones.' },
      { title: 'Live honestly', text: 'Watch for the lies you tell yourself to avoid a hard choice.' },
      { title: 'Make your meaning', text: "Nobody hands you a purpose. You build one out of what you commit to." },
    ],
    actions: [
      "Write down one thing you're doing only because you think you should. Decide to keep it or drop it.",
      'Make one decision today you have been putting off.',
      'Ask: if this were the life I had to live again and again, would I change this week?',
    ],
    read: [
      { title: 'Thus Spake Zarathustra', author: 'Friedrich Nietzsche', book: 'pg1998' },
      { title: 'Beyond Good and Evil', author: 'Friedrich Nietzsche', book: 'pg4363' },
    ],
    further: [
      { title: 'At the Existentialist Café', author: 'Sarah Bakewell' },
      { title: "Man's Search for Meaning", author: 'Viktor Frankl' },
      { title: 'The Myth of Sisyphus', author: 'Albert Camus' },
    ],
    quotes: [
      { id: 'ex1', text: 'I tell you: one must still have chaos in one, to give birth to a dancing star.', who: 'Friedrich Nietzsche', from: 'Thus Spake Zarathustra, tr. Thomas Common' },
    ],
  },
  {
    id: 'transcendentalism', name: 'Transcendentalism', colour: '#A8841C',
    line: 'Trust yourself, live simply and pay attention to nature.',
    idea: 'An American movement of the 1830s and 40s (Emerson, Thoreau). Truth is found in your own experience and in nature, not just in institutions. Live simply, think for yourself, and live on purpose.',
    lessons: [
      { title: 'Self-reliance', text: 'Your own considered judgement is worth more than going along with the crowd.' },
      { title: 'Live deliberately', text: 'Strip life back to what matters, so you are not surprised later by what you missed.' },
      { title: 'Nature restores', text: 'Time outside clears the head, and a lot of good thinking happens out there.' },
    ],
    actions: [
      'Take a walk today with no headphones and no destination.',
      'Write one page of your own thoughts on something before you read anyone else on it.',
      'Cancel or skip one thing this week that you do only out of habit.',
    ],
    read: [
      { title: 'Walden', author: 'Henry David Thoreau', book: 'pg205' },
      { title: 'Essays, First Series', author: 'Ralph Waldo Emerson', book: 'pg2944' },
      { title: 'The Conduct of Life', author: 'Ralph Waldo Emerson', book: 'pg39827' },
    ],
    further: [
      { title: 'American Transcendentalism', author: 'Philip F. Gura' },
    ],
    quotes: [
      { id: 'tr1', text: 'I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived.', who: 'Henry David Thoreau', from: 'Walden' },
      { id: 'tr2', text: 'Trust thyself: every heart vibrates to that iron string.', who: 'Ralph Waldo Emerson', from: 'Self-Reliance' },
    ],
  },
];

export const schoolById = (id: string) => SCHOOLS.find((s) => s.id === id);
export const allQuotes = () => SCHOOLS.flatMap((s) => s.quotes.map((q) => ({ ...q, school: s.id })));

/** The schools you follow (profiles.philosophies). Empty if none, or if the column is not there yet. */
export async function myPhilosophies(): Promise<string[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data, error } = await supabase.from('profiles').select('philosophies').eq('id', u.user.id).maybeSingle();
  if (error) return [];
  return ((data as { philosophies: string[] | null } | null)?.philosophies ?? []).filter((x) => !!schoolById(x));
}

export async function setPhilosophies(ids: string[]): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from('profiles').update({ philosophies: ids }).eq('id', u.user?.id ?? '');
  if (error) throw error;
}

/** Today's quote from the schools you follow: the same all day, a new one tomorrow. */
export function quoteForToday(ids: string[], day = new Date()): (Quote & { school: string }) | null {
  const pool = allQuotes().filter((q) => ids.includes(q.school));
  if (!pool.length) return null;
  const n = Math.floor(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) / 86400000);
  return pool[n % pool.length];
}

const DISMISS_KEY = 'tali.quote.dismissed';
const todayKey = () => new Date().toISOString().slice(0, 10);
export async function quoteDismissedToday(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(DISMISS_KEY)) === todayKey(); } catch { return false; }
}
export async function dismissQuoteToday(): Promise<void> {
  try { await AsyncStorage.setItem(DISMISS_KEY, todayKey()); } catch { /* fine */ }
}

/** Quotes you kept (saved_quotes). */
export async function savedQuoteIds(): Promise<string[]> {
  const { data, error } = await supabase.from('saved_quotes').select('quote_id').order('saved_at', { ascending: false });
  if (error) return [];
  return (data ?? []).map((r: { quote_id: string }) => r.quote_id);
}
export async function saveQuote(id: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from('saved_quotes').upsert({ user_id: u.user?.id, quote_id: id }, { onConflict: 'user_id,quote_id' });
  if (error) throw error;
}
export async function unsaveQuote(id: string): Promise<void> {
  const { error } = await supabase.from('saved_quotes').delete().eq('quote_id', id);
  if (error) throw error;
}
