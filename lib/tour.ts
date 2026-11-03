// The first-run tour's steps and the two calls that save its state.
// Tab indices match (app)/_layout.tsx: 0 Today, 1 Talk, 2 Clients, 3 Journal, 4 Me.
// Targets are spots Today registers with lib/tourTargets.ts: hero, level, yes, due, glance.
// Rewritten 3 Nov 2026 for the owner's rhythm screens (brief, level, drafts, shutdown, glance).
import type { TourStep } from '@/components/AppTour';
import { supabase } from './supabase';

export const TOUR_STEPS: TourStep[] = [
  {
    title: "G'day, I'm Tali 👋",
    body: "I'm your AI teammate, and I remember your business so you never explain it twice. Quick look around? Under a minute.",
    pose: 'wave',
  },
  {
    title: 'Your day, read for you',
    body: "Every morning I read your day and sum it up here: what's due, what's waiting on your yes and how the business is going. Tap Read your brief for the full thing.",
    pose: 'idle',
    target: 'hero',
  },
  {
    title: 'We level up together',
    body: "My level climbs as I learn your business and as you put things in: chats, journal entries, jobs I finish, nights of study. New starter today, chief of staff one day.",
    pose: 'celebrate',
    target: 'level',
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
    body: "Money, business health, your week and the goals I hold you to. Tap a tile to open it. On Sundays I write up your week and we pick three promises for the next.",
    pose: 'idle',
    target: 'glance',
  },
  {
    title: 'Talk',
    body: "Chat to me like you'd message someone on your team. Add a client, draft a message, log what you ate, send me a photo or a PDF. I never send, spend or change anything without your yes.",
    pose: 'head',
    tab: 1,
  },
  {
    title: 'Clients',
    body: "Your clients and leads, with follow-up dates and invoices. I spot who's gone quiet, and before a meeting I tell you what I know about them.",
    pose: 'think',
    tab: 2,
  },
  {
    title: 'Journal',
    body: "Your journal and notes. I learn from them unless you mark one private, and then I never read it. On Tali HQ and Pro I write my own week up here every Sunday too.",
    pose: 'idle',
    tab: 3,
  },
  {
    title: 'Me',
    body: "Your plan, Sleep sounds, Night school, Money, Decisions and Email. And everything I know about you: read any memory, and make me forget it if you like.",
    pose: 'think',
    tab: 4,
  },
  {
    title: "That's the lot",
    body: "Best first step: tell me about your business in Talk. What you do, who your clients are, what's keeping you busy. Every bit helps.",
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
