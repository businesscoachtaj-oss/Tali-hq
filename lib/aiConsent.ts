// lib/aiConsent.ts (22 Nov 2026, App Review guidelines 5.1.1(i) and 5.1.2(i))
//
// Tali uses AI companies to think. Before anything about a person goes to one, they see the
// "Tali and your data" screen (components/AiConsent.tsx) and say yes. The yes is
// profiles.ai_consent_at, and the server checks it too (supabase/functions/_shared/consent.ts).
// "Not now" lets them into the app without Tali; it is remembered on this device so the screen
// does not come back on every open. Any of Tali's functions answering 'ai_consent' brings the
// screen back (lib/supabase.ts).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// What is sent and to whom. Company names only, never which part of Tali uses which (Taj, 22 Nov).
export const AI_COMPANIES = ['Anthropic', 'OpenAI', 'Google', 'Voyage AI'];
export const AI_SENT = [
  'What you type or say to Tali, and photos or files you send her',
  'Your notes, journal, goals, to do list and what she remembers about you',
  'Emails you forward to Tali, or that come in from an inbox you connect',
  'Your first name, business details and the people and money you track in the app',
];

const skipKey = (userId: string) => `aiConsentNotNow:${userId}`;

export async function skippedOnThisDevice(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(skipKey(userId))) === '1';
  } catch {
    return false;
  }
}

export async function notNow(userId: string) {
  try {
    await AsyncStorage.setItem(skipKey(userId), '1');
  } catch {}
  markSkipped(userId);
}

export async function setAiConsent(userId: string, yes: boolean) {
  const { error } = await supabase.from('profiles').update({ ai_consent_at: yes ? new Date().toISOString() : null }).eq('id', userId);
  if (error) throw error;
  // Turning it off from Me counts as "Not now" too, so the sign in screen does not come straight back.
  if (!yes) return notNow(userId);
  try {
    await AsyncStorage.removeItem(skipKey(userId));
  } catch {}
}

// "Not now" on this device, shared with the root layout so the gate lifts straight away.
let skipped: { userId: string; value: boolean } | null = null;
const listeners = new Set<() => void>();
export function skipState(userId: string | undefined): boolean | null {
  if (!userId) return null;
  return skipped && skipped.userId === userId ? skipped.value : null;
}
export async function loadSkip(userId: string) {
  skipped = { userId, value: await skippedOnThisDevice(userId) };
  listeners.forEach((l) => l());
}
export function markSkipped(userId: string) {
  skipped = { userId, value: true };
  listeners.forEach((l) => l());
}
export function onSkipChange(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
