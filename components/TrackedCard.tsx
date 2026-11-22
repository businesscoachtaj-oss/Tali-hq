// components/TrackedCard.tsx
// ADDED (17 Nov 2026, Taj): what shows under Tali's reply when she made a tracker or logged to one.
// A new tracker goes on the home here, when the reply lands, with Edit and Undo so nothing lands on
// your home without a way back. A log shows as a pill that opens the tracker.
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colours, radius } from '@/constants/theme';
import { TrackerTile } from '@/components/Widgets';
import { useHasBusiness } from '@/lib/business';
import { useBusinesses } from '@/lib/businesses';
import { defaultLayout, deleteTracker, fmt, homeKeyFor, hqState, newId, reloadHq, saveLayout, unitOf, useHq } from '@/lib/widgets';

type Tracked = { made: { id: string; name: string; home: string }[]; logged: { id: string; name: string; amount: number; type: string; unit: string }[] };

export function TrackedCard({ tracked, fresh }: { tracked: Tracked; fresh: boolean }) {
  const hq = useHq();
  const hasBiz = useHasBusiness();
  const bz = useBusinesses();
  const [undone, setUndone] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const ids = [...tracked.made.map((m) => m.id), ...tracked.logged.map((l) => l.id)].join();

  // When her reply has just landed: load the new numbers, and put a new tracker at the top of its home.
  useEffect(() => {
    if (!fresh) return;
    let live = true;
    (async () => {
      await reloadHq();
      for (const m of tracked.made) {
        const s = hqState();
        const key = homeKeyFor(m.home === 'business' ? 'business' : 'life', hasBiz, m.home === 'business' ? bz.current : null);
        const blocks = s.layouts[key] ?? defaultLayout(key, hasBiz, s.plan);
        if (!live || blocks.some((b) => b.tracker_id === m.id) || !s.trackers.some((t) => t.id === m.id)) continue;
        await saveLayout(key, [{ id: newId(), kind: 'tracker', tracker_id: m.id, size: 'small' }, ...blocks]).catch((e) => setNote(e?.message ?? ''));
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, fresh]);

  return (
    <View style={{ gap: 8, marginTop: 8 }}>
      {tracked.made.filter((m) => !undone.includes(m.id)).map((m) => {
        const t = hq.trackers.find((x) => x.id === m.id);
        if (!t) return null;
        return (
          <View key={m.id} style={{ gap: 8, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: colours.border, backgroundColor: 'rgba(30,24,88,0.55)' }}>
            <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, color: colours.good }}>ADDED TO YOUR {hasBiz ? `${m.home.toUpperCase()} ` : ''}HOME</Text>
            <View style={{ flexDirection: 'row' }}><TrackerTile w={{ id: m.id, kind: 'tracker', tracker: t, size: 'wide' }} /></View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => router.navigate(`/widget-new?edit=${m.id}&mode=${m.home}` as any)} accessibilityRole="button" style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colours.border, backgroundColor: colours.surface }}>
                <Text style={{ color: colours.purpleInk, fontSize: 13, fontWeight: '700' }}>Edit</Text>
              </Pressable>
              <Pressable onPress={() => { setUndone((u) => [...u, m.id]); deleteTracker(m.id).catch(() => {}); }} accessibilityRole="button" style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colours.border, backgroundColor: colours.surface }}>
                <Text style={{ color: colours.purpleInk, fontSize: 13, fontWeight: '700' }}>Undo</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      {tracked.made.some((m) => undone.includes(m.id)) ? <Text style={{ color: colours.faint, fontSize: 12.5 }}>Taken off and deleted.</Text> : null}
      {tracked.logged.map((l, i) => (
        <Pressable key={`${l.id}${i}`} onPress={() => router.navigate(`/tracker?id=${l.id}` as any)} accessibilityRole="link" accessibilityLabel={`Logged to ${l.name}. Open it`}
          style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: 'rgba(127,224,176,0.14)', borderWidth: 1, borderColor: 'rgba(127,224,176,0.5)' }}>
          <Text style={{ color: colours.good, fontSize: 13 }}>{'✦'}</Text>
          <Text style={{ color: '#1C1A17', fontSize: 12.5, flexShrink: 1 }}>
            <Text style={{ fontWeight: '800' }}>Logged</Text> {l.type === 'yesno' ? (l.amount ? 'done' : 'not done') : `${fmt({ type: l.type as any, unit: l.unit, period: 'day', target: null }, l.amount)}${unitOf({ type: l.type as any, unit: l.unit, period: 'day', target: null }) ? ` ${l.unit}` : ''}`} to {l.name} <Text style={{ color: colours.good, fontWeight: '700' }}>{'→'}</Text>
          </Text>
        </Pressable>
      ))}
      {note ? <Text style={{ color: colours.orange, fontSize: 12.5 }}>{note}</Text> : null}
    </View>
  );
}
