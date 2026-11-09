// The first-run tour's steps and the two calls that save its state.
// Tab indices match (app)/_layout.tsx: 0 Today, 1 Talk, 2 Her brain, 3 Your world, 4 Me.
// Targets are spots Today registers with lib/tourTargets.ts: brain, level, tell, yes, due, glance.
// Rewritten 10 Nov 2026 for the brain Today and the new tabs (the old steps still pointed at Clients and Journal).
// Rewritten 3 Nov 2026 for the owner's rhythm screens (brief, level, drafts, shutdown, glance).
import type { TourStep } from '@/components/AppTour';
import { supabase } from './supabase';

export const TOUR_STEPS: TourStep[] = [
  {
    title: "G'day, I'm Tali 👋",
    body: "I'm an AI with a brain that grows with you. Life, work, all of it. Tell me once and I remember. Quick look around? Under a minute.",
    pose: 'wave',
  },
  {
    title: 'This is my brain',
    body: "Every dot is something I know. The bright stars around it are your day: what's due, what needs your yes, who to get back to. Tap a star to open it. Tap my brain to step inside.",
    pose: 'head',
    target: 'brain',
  },
  {
    title: 'We level up together',
    body: "My level climbs as I learn about you and as you put things in: chats, journal entries, jobs I finish, nights of study. My brain grows every time you talk.",
    pose: 'celebrate',
    target: 'level',
  },
  {
    title: 'Tell me anything',
    body: "A birthday, a worry, a job that needs doing. Type it, say it, or send a photo, a PDF or a video. When I keep something you'll see New memory under my reply.",
    pose: 'head',
    target: 'tell',
  },
  {
    title: 'Needs your yes',
    body: "I draft the follow-ups, replies and posts, and they wait here. Nothing goes out until you tap yes. Ask me to make one shorter, warmer or more formal and I'll redo it.",
    pose: 'head',
    target: 'yes',
  },
  {
    title: 'Due today',
    body: "Reminders and follow-ups that are due, and I nudge you when it's time. In the evening a Shut the day down card lands here: one minute, then tomorrow's three are set.",
    pose: 'think',
    target: 'due',
  },
  {
    title: 'At a glance',
    body: "Money, your week and the goals I hold you to. Tap a tile to open it. On Sundays I write up your week and we pick three promises for the next.",
    pose: 'idle',
    target: 'glance',
  },
  {
    title: 'Talk',
    body: "Chat to me like you'd message a mate who never forgets. Ask for a second opinion on a big call, or have me think harder. I never send, spend or change anything without your yes.",
    pose: 'head',
    tab: 1,
  },
  {
    title: 'Her brain',
    body: "Everything I know, sorted by the part of the brain it lives in. Read any memory, fix it if I've got it wrong, or make me forget it. Night school is here too: I study while you sleep.",
    pose: 'think',
    tab: 2,
  },
  {
    title: 'Your world',
    body: "Your life on one map: people, work, money, health and growth. It fills in as we talk, so the more you tell me, the more of your world I can see.",
    pose: 'idle',
    tab: 3,
  },
  {
    title: 'Me',
    body: "Your plan, your journal, Sleep sounds and your settings. You can download my brain or share a card of it from here any time. It's yours.",
    pose: 'think',
    tab: 4,
  },
  // ADDED (6 Nov 2026, Taj): sharing is on by default, so the tour says what it means and how to stop it.
  {
    title: 'Every Tali learns together',
    body: "When I learn a lesson that would help anyone, I share it with every Tali, rewritten with no names, people or numbers. Your facts, people and journal are never shared. To switch it off: Me, Settings, Help every Tali learn. Or mark one memory Private in my brain.",
    pose: 'think',
    tab: 4,
  },
  {
    title: "That's the lot",
    body: "Best first step: tell me three things about you in Talk. Who matters to you, what's on your plate this week, and one thing you keep forgetting.",
    pose: 'wave',
  },
];

export async function finishTour(userId: string) {
  await supabase.from('profiles').update({ tour_done_at: new Date().toISOString() }).eq('id', userId);
}

export async function resetTour(userId: string) {
  const { error } = await supabase.from('profiles').update({ tour_done_at: null }).eq('id', userId);
  if (error) throw error;
}
