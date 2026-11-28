// The brain games content (25 Nov 2026, from the brain games app): the daily puzzles, kids words, feelings, brain facts and lessons.
// All our own. Quotes are from public domain translations and are named.

// Four by Four and Trail puzzles are built each day from the banks in lib/banks.ts.

// Kids: four letter words with a picture clue (Word Hop).
export const KIDS_WORDS = [
  { word: 'FROG', clue: '🐸' }, { word: 'MOON', clue: '🌙' }, { word: 'FISH', clue: '🐟' }, { word: 'CAKE', clue: '🍰' },
  { word: 'BEAR', clue: '🐻' }, { word: 'TREE', clue: '🌳' }, { word: 'BOAT', clue: '⛵' }, { word: 'STAR', clue: '⭐' },
  { word: 'DUCK', clue: '🦆' }, { word: 'KITE', clue: '🪁' }, { word: 'SHOE', clue: '👟' }, { word: 'BELL', clue: '🔔' },
  { word: 'LION', clue: '🦁' }, { word: 'BIKE', clue: '🚲' }, { word: 'CORN', clue: '🌽' }, { word: 'SNOW', clue: '❄️' },
  { word: 'DRUM', clue: '🥁' }, { word: 'LEAF', clue: '🍃' }, { word: 'BALL', clue: '⚽' }, { word: 'MILK', clue: '🥛' },
  { word: 'WAVE', clue: '🌊' }, { word: 'GIFT', clue: '🎁' }, { word: 'SOCK', clue: '🧦' }, { word: 'PEAR', clue: '🍐' },
];

export const KIDS_WORDS3 = [
  { word: 'CAT', clue: '🐱' }, { word: 'DOG', clue: '🐶' }, { word: 'SUN', clue: '☀️' }, { word: 'BEE', clue: '🐝' }, { word: 'PIG', clue: '🐷' }, { word: 'HAT', clue: '🎩' },
  { word: 'BUS', clue: '🚌' }, { word: 'COW', clue: '🐮' }, { word: 'EGG', clue: '🥚' }, { word: 'FOX', clue: '🦊' }, { word: 'OWL', clue: '🦉' }, { word: 'BED', clue: '🛏️' },
  { word: 'CAR', clue: '🚗' }, { word: 'ANT', clue: '🐜' }, { word: 'KEY', clue: '🔑' }, { word: 'CUP', clue: '☕' }, { word: 'BOX', clue: '📦' }, { word: 'MAP', clue: '🗺️' },
  { word: 'PIE', clue: '🥧' }, { word: 'BAG', clue: '👜' }, { word: 'JAR', clue: '🫙' }, { word: 'NUT', clue: '🥜' }, { word: 'BAT', clue: '🦇' }, { word: 'WEB', clue: '🕸️' },
];
export const KIDS_WORDS5 = [
  { word: 'APPLE', clue: '🍎' }, { word: 'HORSE', clue: '🐴' }, { word: 'TRAIN', clue: '🚆' }, { word: 'HOUSE', clue: '🏠' }, { word: 'SNAKE', clue: '🐍' }, { word: 'PIZZA', clue: '🍕' },
  { word: 'ROBOT', clue: '🤖' }, { word: 'CLOCK', clue: '🕰️' }, { word: 'SHEEP', clue: '🐑' }, { word: 'WHALE', clue: '🐋' }, { word: 'TIGER', clue: '🐯' }, { word: 'LEMON', clue: '🍋' },
  { word: 'CLOUD', clue: '☁️' }, { word: 'PLANT', clue: '🪴' }, { word: 'CHAIR', clue: '🪑' }, { word: 'TRUCK', clue: '🚚' }, { word: 'BEACH', clue: '🏖️' }, { word: 'HEART', clue: '❤️' },
  { word: 'MOUSE', clue: '🐭' }, { word: 'PANDA', clue: '🐼' }, { word: 'SHARK', clue: '🦈' }, { word: 'BREAD', clue: '🍞' }, { word: 'GRAPE', clue: '🍇' }, { word: 'MANGO', clue: '🥭' },
];

// Feelings (kids): a face, pick the feeling. Read the Room (everyone): a moment, pick what they most likely feel.
export const KID_FEELINGS = [
  { face: '😊', right: 'Happy', other: ['Cross', 'Scared'] }, { face: '😢', right: 'Sad', other: ['Silly', 'Proud'] },
  { face: '😠', right: 'Cross', other: ['Happy', 'Sleepy'] }, { face: '😨', right: 'Scared', other: ['Excited', 'Bored'] },
  { face: '😴', right: 'Sleepy', other: ['Cross', 'Happy'] }, { face: '🤩', right: 'Excited', other: ['Sad', 'Scared'] },
  { face: '😳', right: 'Shy', other: ['Cross', 'Sleepy'] }, { face: '🥰', right: 'Loved', other: ['Bored', 'Scared'] },
  { face: '😕', right: 'Confused', other: ['Proud', 'Happy'] }, { face: '😌', right: 'Calm', other: ['Cross', 'Scared'] },
  { face: '😤', right: 'Frustrated', other: ['Calm', 'Loved'] }, { face: '🥳', right: 'Proud', other: ['Sad', 'Sleepy'] },
];
export const ROOM_MOMENTS = [
  { moment: 'Jess spent all week on a cake for her mum. Her mum says, "It\'s a bit dry."', right: 'Hurt', other: ['Relieved', 'Proud', 'Bored'], why: 'She put in effort and hoped it would be noticed. A small comment can land hard.' },
  { moment: 'Tom has rewritten the same email five times and still hasn\'t sent it.', right: 'Anxious', other: ['Excited', 'Content', 'Grateful'], why: 'Going over and over something is often worry about how it will be taken.' },
  { moment: 'After months of saving, Priya books the trip she has wanted for years.', right: 'Thrilled', other: ['Guilty', 'Lonely', 'Annoyed'], why: 'A long wait that finally pays off usually brings a rush of joy.' },
  { moment: 'Grandad goes quiet when the family talks about the house he is selling.', right: 'Sad', other: ['Bored', 'Jealous', 'Amused'], why: 'Letting go of a home can mean letting go of years of memories.' },
  { moment: 'Mia\'s friend cancels dinner for the third time this month.', right: 'Let down', other: ['Proud', 'Curious', 'Calm'], why: 'One cancel is life. A pattern can feel like you don\'t matter.' },
  { moment: 'Sam gets the job, but it means moving away from his mates.', right: 'Torn', other: ['Furious', 'Bored', 'Ashamed'], why: 'Good news can arrive with a loss attached. Two feelings at once is normal.' },
  { moment: 'Ana\'s boss praises her in front of everyone for work a teammate did.', right: 'Awkward', other: ['Proud', 'Sleepy', 'Calm'], why: 'Credit you didn\'t earn can feel worse than none at all.' },
  { moment: 'Luke finishes his first 5 km run without stopping.', right: 'Proud', other: ['Embarrassed', 'Nervous', 'Lonely'], why: 'Doing something you weren\'t sure you could do builds real pride.' },
  { moment: 'The plane drops suddenly and the seatbelt sign comes on.', right: 'Scared', other: ['Bored', 'Grateful', 'Jealous'], why: 'A sudden drop sets off the body\'s alarm before you can think it through.' },
  { moment: 'Ruth\'s neighbour mows her lawn while she\'s in hospital.', right: 'Grateful', other: ['Annoyed', 'Bored', 'Guilty'], why: 'Kindness you didn\'t ask for, at a hard time, tends to stay with you.' },
  { moment: 'Ben\'s little sister wins the race he lost last year.', right: 'Mixed', other: ['Furious', 'Ashamed', 'Calm'], why: 'Happy for her and a bit stung for himself. Both can be true.' },
  { moment: 'Kim walks into a party where she knows no one.', right: 'Nervous', other: ['Bored', 'Proud', 'Guilty'], why: 'New rooms full of strangers make most people a little uneasy.' },
];

// One fact a day for kids, and for Today. Plain, and true.
export const BRAIN_FACTS = [
  'Your brain uses about a fifth of all the energy your body uses, even when you are resting.',
  'Sleep is when your brain sorts the day and stores what you learnt.',
  'Learning something new, like a song or a language, builds new links between brain cells.',
  'Your left brain moves the right side of your body, and your right brain moves the left.',
  'Moving your body, even a walk, is good for your brain as well as your heart.',
  'Your brain is about three quarters water. A drink of water helps you think.',
  'The part of your brain that makes memories is shaped a bit like a seahorse. Its name, hippocampus, means seahorse.',
  'Talking with people you like is one of the best things you can do for your brain.',
  'Your brain keeps changing your whole life. That is why practice works at any age.',
  'Taking a slow breath out tells your body it is safe to calm down.',
];

export type Lesson = { id: string; path: string; n: number; title: string; mins: number; quote?: { text: string; by: string }; body: string[]; tryThis: string };
export const PATHS = [
  { id: 'stoics', name: 'The Stoics', what: 'What is up to you, and what is not', colour: '#5B4A86' },
  { id: 'brain', name: 'How your brain works', what: 'Thirteen parts, one at a time', colour: '#1F7A6D' },
  { id: 'clear', name: 'Thinking clearly', what: 'The shortcuts your mind takes, and when to slow down', colour: '#C4573A' },
  { id: 'habits', name: 'Habits for a healthy brain', what: 'Sleep, moving, people and learning', colour: '#5E7D3A' },
];
export const LESSONS: Lesson[] = [
  { id: 'stoics-1', path: 'stoics', n: 1, title: 'Who were the Stoics?', mins: 3, quote: { text: 'Waste no more time arguing about what a good man should be. Be one.', by: 'Marcus Aurelius, Meditations 10.16 (George Long\'s translation)' },
    body: ['The Stoics were a school of thinkers in ancient Greece and Rome. A former slave, Epictetus, a statesman, Seneca, and an emperor, Marcus Aurelius, are the best known.', 'They cared less about clever arguments and more about how to live: calmly, fairly and well, whatever the day brings.'], tryThis: 'Tonight, write one line: what did I do well today, and what would I do differently?' },
  { id: 'stoics-2', path: 'stoics', n: 2, title: 'What is up to you', mins: 3, quote: { text: 'Of things some are in our power, and others are not.', by: 'Epictetus, Enchiridion 1 (George Long\'s translation)' },
    body: ['Epictetus split life into two piles. Your choices, effort and how you respond are yours. Other people, the weather and how things turn out are not.', 'Most worry comes from mixing the two up. Put your energy into the first pile and hold the second one lightly.'], tryThis: 'Write down one thing on your mind. Mark it "mine" or "not mine". Put your effort into the mine pile.' },
  { id: 'stoics-3', path: 'stoics', n: 3, title: 'Worry and the imagination', mins: 3, quote: { text: 'We suffer more often in imagination than in reality.', by: 'Seneca, Letters to Lucilius 13 (Richard Gummere\'s translation)' },
    body: ['Seneca noticed that most of what we dread never happens, and what does happen is rarely as bad as the picture in our heads.', 'Naming the worry plainly, and asking "what would I actually do?", shrinks it to its real size.'], tryThis: 'Pick one worry. Write the worst case, then the most likely case, then your first step if it happened.' },
  { id: 'stoics-4', path: 'stoics', n: 4, title: 'The view from above', mins: 3, body: ['Marcus Aurelius would picture the world from high above: cities, rivers, crowds, and his own small problem among them.', 'It is not about feeling small. It is about seeing what matters, and letting go of what does not.'], tryThis: 'Next time something annoys you, picture it from the sky. Does it still need your energy?' },
  { id: 'stoics-5', path: 'stoics', n: 5, title: 'The evening review', mins: 2, body: ['Seneca ended each day by going over it: where did I do well, where did I fall short, what will I try tomorrow?', 'Kind but honest. The point is to learn, not to beat yourself up.'], tryThis: 'Tonight, ask yourself those three questions before bed.' },
  { id: 'clear-1', path: 'clear', n: 1, title: 'Fast and slow thinking', mins: 3, body: ['Much of the time your mind takes shortcuts. It sees a pattern and jumps to an answer. That is usually helpful and sometimes wrong.', 'The trick is knowing when to slow down: big decisions, strong feelings, or when someone wants a quick yes.'], tryThis: 'Before your next big decision, wait one night before you answer.' },
  { id: 'clear-2', path: 'clear', n: 2, title: 'Seeing what you expect', mins: 3, body: ['Once we believe something, we notice the facts that fit and skim past the ones that don\'t. It is called confirmation bias.', 'Asking "what would change my mind?" is a simple way to check yourself.'], tryThis: 'Pick a view you hold strongly. Find the best argument against it.' },
  { id: 'habits-1', path: 'habits', n: 1, title: 'What the research says', mins: 4, body: ['A large review in The Lancet in 2024 found that about 45% of dementia cases worldwide are linked to 14 things we can change, such as inactivity, smoking, hearing loss, high blood pressure and being socially isolated.', 'Puzzles and games are fun and make you better at the games themselves. The bigger wins for your brain are sleep, moving, seeing people, and learning new things.'], tryThis: 'Pick one brain habit from Today and do it every day this week.' },
  { id: 'habits-2', path: 'habits', n: 2, title: 'Sleep is brain maintenance', mins: 3, body: ['While you sleep your brain sorts the day, stores what you learnt and clears out waste.', 'A regular bedtime, a dark cool room and less screen time before bed all help.'], tryThis: 'Go to bed at the same time three nights in a row.' },
];

export const THOUGHTS = [
  { text: 'We suffer more often in imagination than in reality.', by: 'Seneca, Letters to Lucilius 13', lesson: 'stoics-3' },
  { text: 'Of things some are in our power, and others are not.', by: 'Epictetus, Enchiridion 1', lesson: 'stoics-2' },
  { text: 'Waste no more time arguing about what a good man should be. Be one.', by: 'Marcus Aurelius, Meditations 10.16', lesson: 'stoics-1' },
];
