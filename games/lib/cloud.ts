// The brain games in the cloud, inside Learnéd (28 Nov 2026). Your own player row and your results live
// in the ponder_* tables from migration 098 (RLS: only you). Uses the app's own Supabase client and sign in.
import { supabase } from '@/lib/supabase';
import { localDate } from './daily';
import { registerSync, replaceFromCloud, type Player, type Result } from './store';

let started: string | null = null;
const fromRow = (r: any): Player => ({ id: r.id, name: r.name, kind: 'everyone', emoji: r.emoji, colour: r.colour, levels: r.levels ?? {} });

/** Load your player and the last 400 days of results, then keep the store in sync. Safe to call often. */
export async function syncGames(userId: string, firstName?: string | null) {
  if (started === userId) return;
  started = userId;
  try {
    let { data: me } = await supabase.from('ponder_players').select('*').eq('owner', userId).eq('is_self', true).maybeSingle();
    if (!me) {
      const row = { owner: userId, is_self: true, name: (firstName || 'You').slice(0, 30), kind: 'everyone', emoji: '🦉', colour: '#1F7A6D' };
      const ins = await supabase.from('ponder_players').insert(row).select('*').single();
      if (ins.error) throw ins.error;
      me = ins.data;
    }
    const since = localDate(new Date(Date.now() - 400 * 86400000));
    const { data: rows } = await supabase.from('ponder_results').select('day, game, won, score, stars, level, detail, share, created_at').eq('player_id', me.id).gte('day', since);
    const results: Record<string, Record<string, Result>> = {};
    for (const r of (rows ?? []) as any[]) (results[r.day] ??= {})[r.game] = { won: r.won ?? undefined, score: r.score ?? undefined, stars: r.stars ?? undefined, level: r.level ?? undefined, detail: r.detail ?? undefined, share: r.share ?? undefined, at: r.created_at };
    registerSync({
      result: (who, day, game, r) => {
        supabase.from('ponder_results').upsert({ player_id: who, day, game, won: r.won ?? null, score: r.score ?? null, stars: r.stars ?? null, level: r.level ?? null, detail: r.detail?.slice(0, 200) ?? null, share: r.share?.slice(0, 400) ?? null, data: r.data ?? null }).then(() => {}, () => {});
      },
      player: (p) => { supabase.from('ponder_players').update({ levels: p.levels ?? {} }).eq('id', p.id).then(() => {}, () => {}); },
    });
    replaceFromCloud(fromRow(me), results);
  } catch {
    started = null; // try again next time; games still save on this device
  }
}
