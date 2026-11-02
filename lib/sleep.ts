// Sleep sounds (2 Nov 2026). Everything runs on the phone: the eight loops are bundled with
// the app (made with code, tools/make_sounds.py, so nothing is licensed), play through
// expo-audio, and keep going with the screen locked on iOS and Android. No credits, no server.
// The engine lives at module level so it survives leaving the screen; the screen just renders it.
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export type SoundId = 'brown_noise' | 'pink_noise' | 'white_noise' | 'rain_tin_roof' | 'mountain_wind' | 'ocean' | 'campfire' | 'night_bush';

export const SOUNDS: { id: SoundId; name: string; sub: string; emoji: string; source: number }[] = [
  { id: 'brown_noise', name: 'Brown noise', sub: 'Deep and steady', emoji: '🟤', source: require('@/assets/sounds/brown_noise.m4a') },
  { id: 'pink_noise', name: 'Pink noise', sub: 'Soft, like distant surf', emoji: '🩷', source: require('@/assets/sounds/pink_noise.m4a') },
  { id: 'rain_tin_roof', name: 'Rain on a tin roof', sub: 'Gentle, no thunder', emoji: '🌧️', source: require('@/assets/sounds/rain_tin_roof.m4a') },
  { id: 'mountain_wind', name: 'Mountain wind', sub: 'High country at night', emoji: '🏔️', source: require('@/assets/sounds/mountain_wind.m4a') },
  { id: 'ocean', name: 'Ocean', sub: 'Slow waves on sand', emoji: '🌊', source: require('@/assets/sounds/ocean.m4a') },
  { id: 'campfire', name: 'Campfire', sub: 'Crackle, no voices', emoji: '🔥', source: require('@/assets/sounds/campfire.m4a') },
  { id: 'night_bush', name: 'Night bush', sub: 'Crickets and a creek', emoji: '🦗', source: require('@/assets/sounds/night_bush.m4a') },
  { id: 'white_noise', name: 'White noise', sub: 'Flat and even', emoji: '⚪', source: require('@/assets/sounds/white_noise.m4a') },
];

export const TIMERS: { label: string; minutes: number | null }[] = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 hour', minutes: 60 },
  { label: '90 min', minutes: 90 },
  { label: 'Until morning', minutes: null },
];

export const MAX_PICKS = 2;
const FADE_SECONDS = 5 * 60;
const PREFS_KEY = 'thq.sleep.prefs';

export type Pick = { id: SoundId; level: number };
export type SleepState = {
  picks: Pick[];
  timerMinutes: number | null;
  fade: boolean;
  volume: number;
  status: 'idle' | 'playing' | 'paused';
  endsAt: number | null;
  now: number;
};

let state: SleepState = { picks: [{ id: 'brown_noise', level: 0.6 }, { id: 'rain_tin_roof', level: 0.4 }], timerMinutes: 45, fade: true, volume: 0.6, status: 'idle', endsAt: null, now: Date.now() };
const players = new Map<SoundId, AudioPlayer>();
const listeners = new Set<() => void>();
let tick: ReturnType<typeof setInterval> | null = null;
let loaded = false;

function emit() {
  for (const l of listeners) l();
}

function set(patch: Partial<SleepState>) {
  state = { ...state, ...patch };
  emit();
}

async function savePrefs() {
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ picks: state.picks, timerMinutes: state.timerMinutes, fade: state.fade, volume: state.volume }));
  } catch {}
}

export async function loadPrefs() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    const picks = Array.isArray(p.picks) ? p.picks.filter((x: Pick) => SOUNDS.some((s) => s.id === x.id)).slice(0, MAX_PICKS) : state.picks;
    set({ picks: picks.length ? picks : state.picks, timerMinutes: 'timerMinutes' in p ? p.timerMinutes : state.timerMinutes, fade: p.fade ?? state.fade, volume: typeof p.volume === 'number' ? p.volume : state.volume });
  } catch {}
}

/** Fade factor for right now: 1 until the last five minutes, then down to 0. */
export function fadeFactor(s: SleepState = state) {
  if (!s.endsAt || !s.fade) return 1;
  const left = (s.endsAt - s.now) / 1000;
  return Math.max(0, Math.min(1, left / FADE_SECONDS));
}

function applyVolumes() {
  const f = fadeFactor();
  for (const p of state.picks) {
    const pl = players.get(p.id);
    if (pl) pl.volume = Math.max(0, Math.min(1, p.level * state.volume * f));
  }
}

function onTick() {
  state = { ...state, now: Date.now() };
  if (state.endsAt && state.now >= state.endsAt) {
    stop();
    return;
  }
  applyVolumes();
  emit();
}

export function togglePick(id: SoundId) {
  const has = state.picks.some((p) => p.id === id);
  let picks: Pick[];
  if (has) {
    picks = state.picks.filter((p) => p.id !== id);
    const pl = players.get(id);
    if (pl) {
      pl.remove();
      players.delete(id);
    }
  } else {
    picks = [...state.picks, { id, level: 0.5 }].slice(-MAX_PICKS);
  }
  // Two picks share the mix evenly unless the user has moved a level.
  if (picks.length === 2 && picks.every((p) => p.level === 0.5)) picks = [{ ...picks[0], level: 0.6 }, { ...picks[1], level: 0.4 }];
  if (picks.length === 1) picks = [{ ...picks[0], level: 1 }];
  set({ picks });
  if (state.status === 'playing') ensurePlayers();
  savePrefs();
}

export function setLevel(id: SoundId, level: number) {
  set({ picks: state.picks.map((p) => (p.id === id ? { ...p, level } : p)) });
  applyVolumes();
  savePrefs();
}

export function setVolume(volume: number) {
  set({ volume });
  applyVolumes();
  savePrefs();
}

export function setTimer(timerMinutes: number | null) {
  set({ timerMinutes, endsAt: state.status === 'idle' ? null : timerMinutes ? Date.now() + timerMinutes * 60_000 : null });
  savePrefs();
}

export function setFade(fade: boolean) {
  set({ fade });
  applyVolumes();
  savePrefs();
}

export function extend(minutes = 15) {
  const base = state.endsAt && state.endsAt > Date.now() ? state.endsAt : Date.now();
  set({ endsAt: base + minutes * 60_000 });
  applyVolumes();
}

function ensurePlayers() {
  for (const p of state.picks) {
    if (players.has(p.id)) continue;
    const sound = SOUNDS.find((s) => s.id === p.id)!;
    const pl = createAudioPlayer(sound.source);
    pl.loop = true;
    pl.volume = 0;
    players.set(p.id, pl);
    if (state.status === 'playing') pl.play();
  }
  applyVolumes();
}

export async function start() {
  if (!state.picks.length) return;
  if (Platform.OS !== 'web') {
    try {
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' });
    } catch {}
  }
  set({ status: 'playing', endsAt: state.timerMinutes ? Date.now() + state.timerMinutes * 60_000 : null, now: Date.now() });
  ensurePlayers();
  let first = true;
  for (const [id, pl] of players) {
    pl.play();
    if (first && Platform.OS !== 'web') {
      try {
        const names = state.picks.map((p) => SOUNDS.find((s) => s.id === p.id)?.name).filter(Boolean).join(' + ');
        pl.setActiveForLockScreen(true, { title: names || 'Sleep sounds', artist: 'Tali HQ', albumTitle: 'Sleep' });
      } catch {}
      first = false;
    }
    void id;
  }
  if (tick) clearInterval(tick);
  tick = setInterval(onTick, 1000);
}

export function pause() {
  for (const pl of players.values()) pl.pause();
  set({ status: 'paused' });
}

export function resume() {
  for (const pl of players.values()) pl.play();
  set({ status: 'playing' });
}

export function stop() {
  if (tick) clearInterval(tick);
  tick = null;
  for (const pl of players.values()) {
    try {
      pl.pause();
      if (Platform.OS !== 'web') pl.setActiveForLockScreen(false);
      pl.remove();
    } catch {}
  }
  players.clear();
  set({ status: 'idle', endsAt: null });
}

export function useSleep() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

export function timeLeft(s: SleepState) {
  if (!s.endsAt) return null;
  const secs = Math.max(0, Math.round((s.endsAt - s.now) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const sec = secs % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
