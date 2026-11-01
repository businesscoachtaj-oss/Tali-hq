// The first-run tour's steps and the two calls that save its state.
// Tab indices match (app)/_layout.tsx: 0 Today, 1 Talk, 2 Clients, 3 Journal, 4 Me.
import type { TourStep } from '@/components/AppTour';
import { supabase } from './supabase';

export const TOUR_STEPS: TourStep[] = [
  {
    title: "G'day, I'm Tali 👋",
    body: "I'm your AI teammate, and I remember your business so you don't have to explain it twice. Quick look around? Takes about 30 seconds.",
    pose: 'wave',
  },
  {
    title: 'Today',
    body: "Your morning brief lands here, plus anything waiting on your yes, reminders and follow-ups that are due. Pull down any time to refresh.",
    pose: 'idle',
    tab: 0,
  },
  {
    title: 'Talk',
    body: "Chat to me like you'd message someone on your team. Ask me to add a client, draft a message or log what you ate. I never send, spend or change anything without your yes.",
    pose: 'head',
    tab: 1,
  },
  {
    title: 'Clients',
    body: "Your clients and leads, with follow-up dates. I read this before chats and briefs, so the more you add, the sharper I get.",
    pose: 'think',
    tab: 2,
  },
  {
    title: 'Journal',
    body: "Your journal entries and notes. I learn from them unless you mark one private. On Tali HQ and Pro I write up my own week here every Sunday too.",
    pose: 'idle',
    tab: 3,
  },
  {
    title: 'Me',
    body: "Your plan and credits, and everything I know about you. You can read every memory and make me forget any of them. Invoices, rules and the rest live here too.",
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
