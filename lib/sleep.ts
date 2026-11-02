// Sleep sounds (2 Nov 2026). Everything runs on the phone: 35 seamless loops (Pixabay Content
// Licence, re-encoded as AAC) are hosted with the web app under public/sounds and streamed from
// there (relative path on web, SOUNDS_BASE on native), play through expo-audio, and keep going
// with the screen locked on iOS and Android. No credits, no server.
// The engine lives at module level so it survives leaving the screen; the screen just renders it.
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { SOUNDS_BASE } from '@/constants/business';

export type CategoryId = 'noise' | 'rain' | 'wind' | 'water' | 'fire' | 'night' | 'hum';

export const CATEGORIES: { id: CategoryId; name: string; emoji: string }[] = [
  { id: 'noise', name: 'Noise', emoji: '🟤' },
  { id: 'rain', name: 'Rain', emoji: '🌧️' },
  { id: 'wind', name: 'Wind', emoji: '🌬️' },
  { id: 'water', name: 'Water', emoji: '🌊' },
  { id: 'fire', name: 'Fire', emoji: '🔥' },
  { id: 'night', name: 'Night', emoji: '🦗' },
  { id: 'hum', name: 'Hum', emoji: '🌀' },
];

export type SoundId =
  | 'noise_brown' | 'noise_soft_brown' | 'noise_deep' | 'noise_pink' | 'noise_white'
  | 'rain_tin_roof' | 'rain_storm' | 'rain_light' | 'rain_heavy' | 'rain_window'
  | 'wind_mountain' | 'wind_trees' | 'wind_gusty' | 'wind_cold' | 'wind_breeze'
  | 'water_ocean' | 'water_beach' | 'water_creek' | 'water_river' | 'water_lake'
  | 'fire_campfire' | 'fire_fireplace' | 'fire_crackling' | 'fire_bonfire' | 'fire_by_the_sea'
  | 'night_crickets' | 'night_frogs_crickets' | 'night_frogs' | 'night_forest' | 'night_curlew'
  | 'hum_ceiling_fan' | 'hum_box_fan' | 'hum_aircon' | 'hum_train' | 'hum_plane';

export type Sound = { id: SoundId; category: CategoryId; name: string; sub: string; emoji: string; source: { uri: string } };

/** Web uses the relative path (same deploy); phones stream from the web deploy. */
export function soundUri(id: SoundId) {
  return Platform.OS === 'web' ? `/sounds/${id}.m4a` : `${SOUNDS_BASE}/${id}.m4a`;
}

function snd(id: SoundId, category: CategoryId, name: string, sub: string, emoji: string): Sound {
  return { id, category, name, sub, emoji, source: { uri: soundUri(id) } };
}

export const SOUNDS: Sound[] = [
  snd('noise_brown', 'noise', 'Brown noise', 'Deep and steady', '🟤'),
  snd('noise_soft_brown', 'noise', 'Soft brown', 'Rounder, quieter top end', '🤎'),
  snd('noise_deep', 'noise', 'Deep hum', 'Low and far away', '🟣'),
  snd('noise_pink', 'noise', 'Pink noise', 'Soft, like distant surf', '🩷'),
  snd('noise_white', 'noise', 'White noise', 'Flat and even', '⚪'),
  snd('rain_tin_roof', 'rain', 'Tin roof', 'Steady rain on iron', '🏠'),
  snd('rain_storm', 'rain', 'Thunderstorm', 'Rain with distant thunder', '⛈️'),
  snd('rain_light', 'rain', 'Light rain', 'A soft drizzle', '🌦️'),
  snd('rain_heavy', 'rain', 'Heavy rain', 'A proper downpour', '🌧️'),
  snd('rain_window', 'rain', 'On the window', 'Drops on glass, inside and warm', '🪟'),
  snd('wind_mountain', 'wind', 'Mountain wind', 'High country at night', '🏔️'),
  snd('wind_trees', 'wind', 'Through the trees', 'Leaves and branches', '🌳'),
  snd('wind_gusty', 'wind', 'Gusty', 'Comes and goes', '💨'),
  snd('wind_cold', 'wind', 'Cold night', 'Thin and whistling', '🧊'),
  snd('wind_breeze', 'wind', 'Gentle breeze', 'Barely there', '🍃'),
  snd('water_ocean', 'water', 'Ocean', 'Slow waves rolling in', '🌊'),
  snd('water_beach', 'water', 'Beach', 'Waves washing up on sand', '🏖️'),
  snd('water_creek', 'water', 'Creek', 'Small water over stones', '🪨'),
  snd('water_river', 'water', 'River', 'Wide and moving', '🏞️'),
  snd('water_lake', 'water', 'Lake', 'Still water lapping', '🛶'),
  snd('fire_campfire', 'fire', 'Campfire', 'Crackle, no voices', '🔥'),
  snd('fire_fireplace', 'fire', 'Fireplace', 'Indoors, low and warm', '🧱'),
  snd('fire_crackling', 'fire', 'Crackling', 'Snaps and pops', '✨'),
  snd('fire_bonfire', 'fire', 'Bonfire', 'Big and roaring', '🎇'),
  snd('fire_by_the_sea', 'fire', 'By the sea', 'Fire with waves behind it', '🌅'),
  snd('night_crickets', 'night', 'Crickets', 'A warm night outside', '🦗'),
  snd('night_frogs_crickets', 'night', 'Frogs and crickets', 'Near the water after dark', '🐸'),
  snd('night_frogs', 'night', 'Frogs', 'A chorus by the pond', '🐸'),
  snd('night_forest', 'night', 'Night forest', 'Bush sounds after dark', '🌲'),
  snd('night_curlew', 'night', 'Curlew', 'The bush curlew calling', '🦉'),
  snd('hum_ceiling_fan', 'hum', 'Ceiling fan', 'Slow and even', '🌀'),
  snd('hum_box_fan', 'hum', 'Box fan', 'Steady whirr', '🪭'),
  snd('hum_aircon', 'hum', 'Air con', 'Cool room hum', '❄️'),
  snd('hum_train', 'hum', 'Train', 'Rolling along the rails', '🚆'),
  snd('hum_plane', 'hum', 'Plane cabin', 'Cruising altitude', '✈️'),
];

/** Sounds in one category, in catalogue order. */
export function soundsIn(category: CategoryId) {
  return SOUNDS.filter((s) => s.category === category);
}

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

let state: SleepState = { picks: [{ id: 'noise_brown', level: 0.6 }, { id: 'rain_tin_roof', level: 0.4 }], timerMinutes: 45, fade: true, volume: 0.6, status: 'idle', endsAt: null, now: Date.now() };
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
