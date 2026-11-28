// Little sounds (25 Nov 2026): a soft click, a chime when you finish, a buzz when it's wrong, and the
// notes in Keys. Made on the fly with the Web Audio API, so there are no sound files to ship. On the
// phone apps this needs expo-audio (still to do). Off when Sounds is off in Settings.
import { Platform } from 'react-native';
import { getState } from './store';

let ctx: AudioContext | null = null;
function ac() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !getState().settings.sound) return null;
  try { ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)(); return ctx; } catch { return null; }
}
export const NOTE: Record<string, number> = {};
['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach((n, i) => { for (let o = 2; o <= 6; o++) NOTE[`${n}${o}`] = 440 * Math.pow(2, (i - 9) / 12 + (o - 4)); });
export function tone(freq: number, ms = 220, type: OscillatorType = 'triangle', vol = 0.18) {
  const a = ac(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, a.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + ms / 1000);
  o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + ms / 1000 + 0.02);
}
export const sound = {
  tap: () => tone(660, 60, 'sine', 0.06),
  good: () => { tone(NOTE.E5, 140); setTimeout(() => tone(NOTE.A5, 200), 90); },
  bad: () => tone(150, 220, 'square', 0.05),
  done: () => [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => setTimeout(() => tone(f, 380), i * 110)),
};
