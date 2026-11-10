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

// 11 Nov 2026 (Taj: Sleep was "a bit finicky"). Ready made scenes: tap one and it plays straight away.
// Each is two sounds already balanced, so nobody has to build a mix at bedtime.
export type Scene = { id: string; name: string; icon: string; picks: Pick[] };
export const SCENES: Scene[] = [
  { id: 'tin_roof', name: 'Rain on a tin roof', icon: 'rainy-outline', picks: [{ id: 'rain_tin_roof', level: 0.7 }, { id: 'noise_brown', level: 0.3 }] },
  { id: 'campfire_sea', name: 'Campfire by the sea', icon: 'flame-outline', picks: [{ id: 'fire_campfire', level: 0.55 }, { id: 'water_beach', level: 0.45 }] },
  { id: 'brown', name: 'Brown noise', icon: 'pulse-outline', picks: [{ id: 'noise_brown', level: 1 }] },
  { id: 'storm', name: 'Storm outside', icon: 'thunderstorm-outline', picks: [{ id: 'rain_storm', level: 0.6 }, { id: 'rain_window', level: 0.4 }] },
  { id: 'bush_night', name: 'Night in the bush', icon: 'moon-outline', picks: [{ id: 'night_crickets', level: 0.5 }, { id: 'wind_trees', level: 0.5 }] },
  { id: 'fan', name: 'Fan on', icon: 'radio-outline', picks: [{ id: 'hum_ceiling_fan', level: 1 }] },
];
/** A mix you saved from the player. Kept with your other sleep settings, per account. */
export type SavedMix = { id: string; name: string; picks: Pick[] };
export const MAX_SAVED = 8;

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
  /** The sound a five second preview is playing for, if any (4 Nov 2026). */
  previewId: SoundId | null;
  /** Mixes you saved (11 Nov 2026). */
  saved: SavedMix[];
};

let state: SleepState = { picks: [{ id: 'noise_brown', level: 0.6 }, { id: 'rain_tin_roof', level: 0.4 }], timerMinutes: 45, fade: true, volume: 0.6, status: 'idle', endsAt: null, now: Date.now(), previewId: null, saved: [] };
// Seamless looping (3 Nov 2026). Every loop restarts with a tiny gap (AAC padding plus the player's
// own loop seek) and a few have a hard jump where the end meets the start. So each sound plays as
// two copies half a loop apart. A copy is faded right down around its own restart point while the
// other copy, which is mid-loop there, carries the sound, so a restart is never heard.
type Voice = { a: AudioPlayer; b: AudioPlayer; offset: boolean; lastSeek: number };
const players = new Map<SoundId, Voice>();
const SEAM_GUARD = 0.35; // seconds either side of a restart that stay fully muted
const SEAM_FADE = 5; // seconds to fade a copy in or out around its restart (a quarter of the loop at most)
const MIX_TICK_MS = 50; // fine volume steps, so the fades themselves never click
let lastSecond = 0;
// iPhone and iPad Safari ignore volume on web audio, so two copies would just play doubled. There
// the web app keeps one plain loop, as before. The native iOS app controls volume and is not affected.
const WEB_NO_VOLUME =
  Platform.OS === 'web' &&
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1));

/** 0 at a copy's restart point, 1 once it is SEAM_GUARD + SEAM_FADE seconds away from it. */
function seamGain(t: number, d: number) {
  if (!(d > 0) || !Number.isFinite(d)) return 1;
  const pos = ((t % d) + d) % d;
  const dist = Math.min(pos, d - pos);
  const fade = Math.min(SEAM_FADE, d / 4);
  const x = Math.max(0, Math.min(1, (dist - SEAM_GUARD) / fade));
  return Math.sin((x * Math.PI) / 2);
}

const finite = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) ? n : 0);
const usable = (d: number) => d > 4 * SEAM_GUARD;

/** How far apart the two copies are, as a share of the loop (0 = together, 0.5 = ideal). */
function spread(v: Voice, d: number) {
  const gap = Math.abs(finite(v.a.currentTime) - finite(v.b.currentTime)) % d;
  return Math.min(gap, d - gap) / d;
}

function voiceGains(v: Voice) {
  if (WEB_NO_VOLUME) return [1, 0];
  const d = finite(v.a.duration);
  // Until copy B is confirmed half a loop away, play copy A alone (a plain loop, as before).
  if (!v.offset || !usable(d) || spread(v, d) < 0.25) return [1, 0];
  const fa = seamGain(finite(v.a.currentTime), d);
  const fb = seamGain(finite(v.b.currentTime), d);
  const n = Math.sqrt(fa * fa + fb * fb) || 1; // equal power: the two copies never add up louder
  return [fa / n, fb / n];
}

/** Park copy B half a loop away from copy A, and keep checking it stayed there. */
function alignVoice(v: Voice) {
  if (WEB_NO_VOLUME) return;
  const d = finite(v.a.duration);
  if (!usable(d)) return;
  if (spread(v, d) >= 0.25) {
    v.offset = true;
    return;
  }
  v.offset = false;
  const now = Date.now();
  if (now - v.lastSeek < 1000) return; // give a seek a moment to land before trying again
  v.lastSeek = now;
  try {
    void v.b.seekTo((finite(v.a.currentTime) + d / 2) % d);
  } catch {}
}

const listeners = new Set<() => void>();
let tick: ReturnType<typeof setInterval> | null = null;
// 5 Nov 2026: picks were saved once per phone, so a second account on the same phone opened
// with the first account's sounds. Prefs are now kept per signed in user.
let loadedFor: string | null = null;
const DEFAULT_PREFS = { picks: [{ id: 'noise_brown', level: 0.6 }, { id: 'rain_tin_roof', level: 0.4 }] as Pick[], timerMinutes: 45 as SleepState['timerMinutes'], fade: true, volume: 0.6 };
const prefsKey = () => (loadedFor ? `${PREFS_KEY}.${loadedFor}` : null);

function emit() {
  for (const l of listeners) l();
}

function set(patch: Partial<SleepState>) {
  state = { ...state, ...patch };
  emit();
}

async function savePrefs() {
  try {
    const key = prefsKey();
    if (!key) return;
    await AsyncStorage.setItem(key, JSON.stringify({ picks: state.picks, timerMinutes: state.timerMinutes, fade: state.fade, volume: state.volume, saved: state.saved }));
  } catch {}
}

export async function loadPrefs(userId: string | null | undefined) {
  if (!userId || loadedFor === userId) return;
  const switching = loadedFor !== null;
  loadedFor = userId;
  // A different account on this phone starts from the defaults, not the last account's mix.
  if (switching && state.status === 'idle') set({ ...DEFAULT_PREFS, saved: [] });
  try {
    let raw = await AsyncStorage.getItem(`${PREFS_KEY}.${userId}`);
    if (!raw) {
      // One-time move of the old per-phone prefs to whoever opens Sleep first after the update.
      raw = await AsyncStorage.getItem(PREFS_KEY);
      if (raw) {
        await AsyncStorage.setItem(`${PREFS_KEY}.${userId}`, raw);
        await AsyncStorage.removeItem(PREFS_KEY);
      }
    }
    if (!raw) return;
    const p = JSON.parse(raw);
    const picks = Array.isArray(p.picks) ? p.picks.filter((x: Pick) => SOUNDS.some((s) => s.id === x.id)).slice(0, MAX_PICKS) : state.picks;
    set({ picks: picks.length ? picks : state.picks, timerMinutes: 'timerMinutes' in p ? p.timerMinutes : state.timerMinutes, fade: p.fade ?? state.fade, volume: typeof p.volume === 'number' ? p.volume : state.volume,
      saved: Array.isArray(p.saved) ? p.saved.filter((m: SavedMix) => m && typeof m.name === 'string' && Array.isArray(m.picks) && m.picks.every((x) => SOUNDS.some((s) => s.id === x.id))).slice(0, MAX_SAVED) : state.saved });
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
    const v = players.get(p.id);
    if (!v) continue;
    alignVoice(v);
    const base = Math.max(0, Math.min(1, p.level * state.volume * f));
    const [ga, gb] = voiceGains(v);
    v.a.volume = finite(base * ga);
    v.b.volume = finite(base * gb);
  }
}

function onTick() {
  state = { ...state, now: Date.now() };
  if (state.endsAt && state.now >= state.endsAt) {
    stop();
    return;
  }
  applyVolumes();
  // The mix runs twenty times a second; the screen only needs a new number once a second.
  const sec = Math.floor(state.now / 1000);
  if (sec !== lastSecond) {
    lastSecond = sec;
    emit();
  }
}

function removeVoice(v: Voice) {
  if (Platform.OS !== 'web') {
    try {
      v.a.setActiveForLockScreen(false);
    } catch {}
  }
  for (const pl of [v.a, v.b]) {
    try {
      pl.pause();
      pl.remove();
    } catch {}
  }
}

// 4 Nov 2026 (bug from Taj: eight sounds going at once). The `players` map is the one registry of live
// audio. Anything in it that is no longer picked gets stopped and unloaded here, so a sound dropped by
// the two pick limit, or toggled off, can never keep playing underneath the new ones.
function dropUnpicked() {
  for (const [id, v] of players) {
    if (state.picks.some((p) => p.id === id)) continue;
    removeVoice(v);
    players.delete(id);
  }
}

// Stop and unload every player, whatever state says. Used before a fresh Start and by stop().
function clearPlayers() {
  stopPreview();
  for (const v of players.values()) removeVoice(v);
  players.clear();
}

// Preview (4 Nov 2026, Taj): hear one sound for a few seconds without starting a session. One slot
// only, so previews never stack, and it sits in the same teardown as the session players.
const PREVIEW_MS = 5000;
let previewPlayer: AudioPlayer | null = null;
let previewTimer: ReturnType<typeof setTimeout> | null = null;

export function stopPreview() {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = null;
  if (previewPlayer) {
    try {
      previewPlayer.pause();
      previewPlayer.remove();
    } catch {}
    previewPlayer = null;
  }
  if (state.previewId) set({ previewId: null });
}

/** Play a five second taste of one sound. Tapping the same sound again, or another one, stops it. */
export async function preview(id: SoundId) {
  const same = state.previewId === id;
  stopPreview();
  if (same) return;
  const sound = SOUNDS.find((x) => x.id === id);
  if (!sound) return;
  if (Platform.OS !== 'web' && state.status === 'idle') {
    try {
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'doNotMix' });
    } catch {}
    // Something else may have started while we waited.
    if (previewPlayer || state.previewId) return;
  }
  const pl = createAudioPlayer(sound.source);
  pl.loop = true;
  pl.volume = Math.max(0.2, Math.min(1, state.volume));
  previewPlayer = pl;
  set({ previewId: id });
  pl.play();
  previewTimer = setTimeout(() => {
    if (previewPlayer === pl) stopPreview();
  }, PREVIEW_MS);
}

export function togglePick(id: SoundId) {
  const has = state.picks.some((p) => p.id === id);
  let picks: Pick[];
  if (has) {
    picks = state.picks.filter((p) => p.id !== id);
  } else {
    picks = [...state.picks, { id, level: 0.5 }].slice(-MAX_PICKS);
  }
  // Two picks share the mix evenly unless the user has moved a level.
  if (picks.length === 2 && picks.every((p) => p.level === 0.5)) picks = [{ ...picks[0], level: 0.6 }, { ...picks[1], level: 0.4 }];
  if (picks.length === 1) picks = [{ ...picks[0], level: 1 }];
  set({ picks });
  // Whether or not anything is playing: unload what was dropped, then load what is new.
  dropUnpicked();
  if (state.status !== 'idle') ensurePlayers();
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

// Loads a player pair for each pick that does not have one yet. The `players.has` check is what
// stops a sound ever being loaded twice; dropUnpicked() is the other half of keeping the map honest.
function ensurePlayers() {
  dropUnpicked();
  for (const p of state.picks) {
    if (players.has(p.id)) continue;
    const sound = SOUNDS.find((s) => s.id === p.id)!;
    const v: Voice = { a: createAudioPlayer(sound.source), b: createAudioPlayer(sound.source), offset: false, lastSeek: 0 };
    for (const pl of [v.a, v.b]) {
      pl.loop = true;
      pl.volume = 0;
    }
    players.set(p.id, v);
    if (state.status === 'playing') {
      v.a.play();
      if (!WEB_NO_VOLUME) v.b.play();
    }
  }
  applyVolumes();
}

let starting = false;

export async function start() {
  if (!state.picks.length || starting) return;
  starting = true;
  try {
    // A fresh start always begins from silence: nothing from the last run can carry over.
    clearPlayers();
    if (Platform.OS !== 'web') {
      try {
        await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' });
      } catch {}
    }
    clearPlayers();
    set({ status: 'playing', endsAt: state.timerMinutes ? Date.now() + state.timerMinutes * 60_000 : null, now: Date.now() });
    ensurePlayers();
  } finally {
    starting = false;
  }
  let first = true;
  for (const v of players.values()) {
    v.a.play();
    if (!WEB_NO_VOLUME) v.b.play();
    if (first && Platform.OS !== 'web') {
      try {
        const names = state.picks.map((p) => SOUNDS.find((s) => s.id === p.id)?.name).filter(Boolean).join(' + ');
        v.a.setActiveForLockScreen(true, { title: names || 'Sleep sounds', artist: 'Tali HQ', albumTitle: 'Sleep' });
      } catch {}
      first = false;
    }
  }
  if (tick) clearInterval(tick);
  tick = setInterval(onTick, MIX_TICK_MS);
}

/** Play a ready made scene or a saved mix straight away. */
export async function playMix(picks: Pick[]) {
  const clean = picks.filter((p) => SOUNDS.some((s) => s.id === p.id)).slice(0, MAX_PICKS);
  if (!clean.length) return;
  set({ picks: clean.map((p) => ({ ...p })) });
  savePrefs();
  await start();
}

const sameMix = (a: Pick[], b: Pick[]) => a.length === b.length && a.every((p) => b.some((q) => q.id === p.id));

/** The name of the scene or saved mix that is playing, if the picks match one. */
export function mixName(picks: Pick[] = state.picks) {
  return state.saved.find((m) => sameMix(m.picks, picks))?.name ?? SCENES.find((m) => sameMix(m.picks, picks))?.name ?? null;
}

/** Keep what is playing as one of your mixes. Saving the same sounds again updates the levels. */
export function saveMix() {
  if (!state.picks.length) return;
  const name = SCENES.find((m) => sameMix(m.picks, state.picks))?.name ?? state.picks.map((p) => SOUNDS.find((s) => s.id === p.id)?.name).filter(Boolean).join(' + ');
  const rest = state.saved.filter((m) => !sameMix(m.picks, state.picks));
  set({ saved: [{ id: `m${Date.now()}`, name, picks: state.picks.map((p) => ({ ...p })) }, ...rest].slice(0, MAX_SAVED) });
  savePrefs();
}

export function removeMix(id: string) {
  set({ saved: state.saved.filter((m) => m.id !== id) });
  savePrefs();
}

export function isSaved(picks: Pick[] = state.picks) {
  return state.saved.some((m) => sameMix(m.picks, picks));
}

/** Tap a sound while building a mix: it joins or leaves the mix and you hear it straight away. */
export async function toggleLive(id: SoundId) {
  stopPreview();
  togglePick(id);
  if (!state.picks.length) stop();
  else if (state.status === 'idle') await start();
}

export function pause() {
  for (const v of players.values()) {
    v.a.pause();
    v.b.pause();
  }
  set({ status: 'paused' });
}

export function resume() {
  for (const v of players.values()) {
    v.a.play();
    if (!WEB_NO_VOLUME) v.b.play();
  }
  set({ status: 'playing' });
}

export function stop() {
  if (tick) clearInterval(tick);
  tick = null;
  clearPlayers();
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
