-- Learnéd 104 (28 Nov 2026, Taj): the plan names and what each plan lists, now the app is Learnéd
-- (life and learning, no business). Only things that are live are listed. Prices and credits unchanged.
update public.plans set name = 'Free', features = jsonb_build_array(
  'Chat with Tali, 250 messages a month',
  'The lesson library: a short lesson a day in philosophy, money, history, science and more',
  'Five brain games, new every day',
  'Reminders for every part of your life, with a check-in at 7pm',
  'A private journal Tali reads and remembers',
  '10 web searches a month, with sources',
  'Build your home: 6 blocks and 3 trackers, with a countdown and a note'
) where id = 'free';

update public.plans set name = 'Learnéd', features = jsonb_build_array(
  'Paths of your own: tell Tali what you want to learn and she writes the lessons, up to 3 at a time',
  'Every brain game, every level and the archive',
  'A morning brief at the time you pick: your day, your lessons and what is coming up',
  'Your money: spending, bills and what you are saving for',
  'Goals and a weekly review that holds you to them',
  'Your inbox, sorted: send your Gmail to Tali or connect Outlook, and she drafts the reply',
  'Google Calendar: she knows your week and books into it when you approve',
  '1,000 Tali credits and 30 images a month',
  'Build your home: no limit on blocks or trackers, every look, your full history, templates and sharing by link'
) where id = 'hq';

update public.plans set name = 'Learnéd Pro', features = jsonb_build_array(
  'Everything in Learnéd, with 3,000 credits and 100 images a month',
  'Night school: pick what Tali studies each night and she turns up sharper every morning',
  'Your own Tali email address, with one-tap replies from that address',
  'Rules: tell Tali what she can do on her own, and she acts inside those lines',
  'Trackers that fill themselves in from your spending, and a weekly read on why a tracker changed',
  'First in line for new features',
  'Coming soon: Tali reads her replies out loud in her own voice'
) where id = 'pro';

update public.plans set name = 'Learnéd Max', features = jsonb_build_array(
  'Everything in Learnéd Pro, with 10,000 credits and 300 images a month',
  'Deep think, Big brain and second opinions at half the credits for your first 100 a month',
  'More of her brain in every answer: she brings up to twice as many memories to each reply',
  'Her voice included when it arrives, with no add-on to pay',
  'First to get every new part of her brain',
  'A daily read from Tali on why your trackers changed'
) where id = 'max';
