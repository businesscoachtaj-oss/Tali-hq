// The brain games' store, inside Learnéd (28 Nov 2026). Brought across from the brain games app
// (brain-games/lib/store.ts, a separate app) with the demo family, kids and Gentle taken out: in the main app it is
// only ever you. Results live in the ponder_results table (migration 098) and are kept on this device
// too, so a game you finish offline still counts. Sync is in games/lib/cloud.ts.
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDate } from './daily';

export type Kind = 'everyone' | 'kids' | 'gentle';
export type Level = 'easy' | 'medium' | 'hard';
export const LEVELS: Level[] = ['easy', 'medium', 'hard'];
export type Player = {
  id: string; name: string; kind: Kind; emoji: string; colour: string;
  age?: number; textSize?: 'large' | 'xl';
  levels?: Record<string, Level>; // the level they last picked for each game
};
export type Result = { won?: boolean; score?: number; detail?: string; share?: string; stars?: number; level?: Level; data?: Record<string, unknown>; at: string };
type State = {
  players: Player[]; current: string;
  results: Record<string, Record<string, Record<string, Result>>>; // player, date, game
  howTo: Record<string, string[]>; // player, games they have seen how to play
  settings: { sound: boolean };
  ready: boolean; // true once this device's copy (or the cloud) has loaded
};

const KEY = 'ponder.games.v1';
const day = (n: number) => localDate(new Date(Date.now() - n * 86400000));
const ME: Player = { id: 'me', name: 'You', kind: 'everyone', emoji: '🦉', colour: '#1F7A6D' };
let state: State = { players: [ME], current: 'me', results: {}, howTo: {}, settings: { sound: true }, ready: false };

const subs = new Set<() => void>();
function set(next: Partial<State>, save = true) {
  state = { ...state, ...next };
  if (save) AsyncStorage.setItem(KEY, JSON.stringify({ players: state.players, current: state.current, results: state.results, howTo: state.howTo, settings: state.settings })).catch(() => {});
  subs.forEach((f) => f());
}
AsyncStorage.getItem(KEY).then((raw) => {
  try { const s = raw ? JSON.parse(raw) : null; set({ ...(s ?? {}), ready: true }, false); } catch { set({ ready: true }, false); }
}).catch(() => set({ ready: true }, false));

// Cloud sync registers here once signed in (games/lib/cloud.ts).
type Sync = { result: (who: string, day: string, game: string, r: Result) => void; player: (p: Player) => void };
let sync: Partial<Sync> = {};
export const registerSync = (s: Sync) => { sync = s; };
/** The cloud copy wins for anything it has; results saved only on this device are kept and sent up. */
export function replaceFromCloud(me: Player, results: Record<string, Record<string, Result>>) {
  const local = state.results[state.current] ?? {};
  const merged: Record<string, Record<string, Result>> = { ...results };
  for (const [d, games] of Object.entries(local)) for (const [g, r] of Object.entries(games)) {
    if (!merged[d]?.[g]) { (merged[d] ??= {})[g] = r; sync.result?.(me.id, d, g, r); }
  }
  set({ players: [me], current: me.id, results: { [me.id]: merged }, howTo: { [me.id]: state.howTo[state.current] ?? state.howTo[me.id] ?? [] } });
}

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useStore = () => useSyncExternalStore(subscribe, () => state, () => state);
export const getState = () => state;
export function usePlayer(): Player {
  const s = useStore();
  return s.players.find((p) => p.id === s.current) ?? s.players[0];
}

export function saveResult(game: string, r: Omit<Result, 'at'>, who = state.current) {
  const d = localDate();
  const mine = { ...(state.results[who] ?? {}) };
  mine[d] = { ...(mine[d] ?? {}), [game]: { ...r, at: new Date().toISOString() } };
  set({ results: { ...state.results, [who]: mine } });
  sync.result?.(who, d, game, mine[d][game]);
}
/** Each level of a game is its own result. Results saved before levels (plain game id) count as the default level. */
export const levelKey = (game: string, level: Level) => `${game}@${level}`;
export function defaultLevel(p: Player, game: string): Level {
  return p.levels?.[game] ?? 'medium';
}
export function resultToday(s: State, who: string, game: string, level?: Level) {
  const d = s.results[who]?.[localDate()]; if (!d) return undefined;
  if (level) return d[levelKey(game, level)] ?? (level === 'medium' ? d[game] : undefined);
  return d[game] ?? d[levelKey(game, 'medium')] ?? d[levelKey(game, 'easy')] ?? d[levelKey(game, 'hard')];
}
export function setLevel(game: string, level: Level, who = state.current) {
  const p = state.players.find((x) => x.id === who); if (!p) return;
  const next = { ...p, levels: { ...(p.levels ?? {}), [game]: level } };
  set({ players: state.players.map((x) => (x.id === who ? next : x)) });
  sync.player?.(next);
}
export function sawHowTo(game: string, who = state.current) {
  const list = state.howTo[who] ?? [];
  if (!list.includes(game)) set({ howTo: { ...state.howTo, [who]: [...list, game] } });
}
/** Kids only in the brain games app. Nothing to count here. */
export function addMinutes(_mins: number) {}
export const setSettings = (x: Partial<State['settings']>) => set({ settings: { ...state.settings, ...x } });

/** Days in a row with at least one game, counting back from today (today counts once played). */
export function streak(s: State, who: string) {
  let n = 0; const r = s.results[who] ?? {};
  for (let i = r[localDate()] ? 0 : 1; i < 400; i++) { if (r[day(i)] && Object.keys(r[day(i)]).length) n++; else break; }
  return n;
}
export const lastDays = (n: number) => Array.from({ length: n }, (_, i) => day(n - 1 - i));
