// Today's end of day card (3 Nov 2026). Self loading, so Today mounts it with one line:
//   <ShutdownCard />
// From two hours before the shutdown time until the day is closed it says "Shut the day down".
// Once the shutdown is done it shows "Day closed" with the mood and tomorrow's three. Earlier in
// the day it renders nothing.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MOODS, rhythmSettings, todaysShutdown, type Shutdown } from '@/lib/rhythm';
import { Card, Label } from '@/components/ui';
import { TaliAvatar } from '@/components/TaliAvatar';
import { colours, elevation, radius, space } from '@/constants/theme';

export type ShutdownCardState = { show: boolean; done: Shutdown | null; shutdownTime: string };

// Loads what the card needs each time the screen focuses. `now` is for tests and screenshots.
const realNow = () => new Date();

export function useShutdownCard(now: () => Date = realNow): ShutdownCardState & { reload: () => void } {
  const [state, setState] = useState<ShutdownCardState>({ show: false, done: null, shutdownTime: '21:00' });

  const reload = useCallback(async () => {
    try {
      const [settings, done] = await Promise.all([rhythmSettings(), todaysShutdown()]);
      const t = settings.shutdown_time.slice(0, 5);
      const [h, m] = t.split(':').map(Number);
      const d = now();
      const mins = d.getHours() * 60 + d.getMinutes();
      const closed = !!done?.tali_line;
      setState({ show: closed || mins >= h * 60 + m - 120, done: closed ? done : null, shutdownTime: t });
    } catch {
      setState((s) => ({ ...s, show: false }));
    }
  }, [now]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { ...state, reload };
}

export function ShutdownCard({ now }: { now?: () => Date }) {
  const { show, done } = useShutdownCard(now);
  if (!show) return null;
  return (
    <>
      <View style={{ height: space.sm }} />
      <Label>{done ? 'Day closed' : 'Tonight'}</Label>
      <ShutdownCardView done={done} />
    </>
  );
}

// The card itself, with no loading, for Today and for tests.
export function ShutdownCardView({ done }: { done: Shutdown | null }) {
  if (done) {
    const m = MOODS.find((x) => x.value === done.mood);
    const lines = done.tomorrow.map((t) => t.text).filter(Boolean);
    return (
      <Pressable onPress={() => router.navigate('/shutdown')} accessibilityRole="button">
        <Card style={{ borderLeftWidth: 5, borderLeftColor: colours.purple }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Text style={{ fontSize: 28 }}>{m?.emoji ?? '🌙'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text }}>Day closed{m ? `, ${m.label.toLowerCase()}` : ''}</Text>
              {done.tali_line ? <Text style={{ fontSize: 13, color: colours.muted, marginTop: 2, lineHeight: 18 }}>{done.tali_line}</Text> : null}
            </View>
          </View>
          {lines.length ? (
            <View style={{ marginTop: space.md, borderTopWidth: 1, borderTopColor: colours.border, paddingTop: space.sm }}>
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: colours.muted, marginBottom: 4 }}>Tomorrow's three</Text>
              {lines.map((l, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: space.sm, paddingVertical: 3 }}>
                  <Text style={{ color: colours.purple, fontWeight: '800', width: 16, fontSize: 14 }}>{i + 1}</Text>
                  <Text style={{ fontSize: 14, lineHeight: 20, color: colours.text, flex: 1 }}>{l}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      </Pressable>
    );
  }
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <TaliAvatar pose="idle" size={48} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text }}>Shut the day down</Text>
          <Text style={{ fontSize: 13, color: colours.muted, marginTop: 2, lineHeight: 18 }}>How did today go, and what are tomorrow's three? Two minutes with Tali.</Text>
        </View>
        <Pressable
          onPress={() => router.navigate('/shutdown')}
          accessibilityRole="button"
          hitSlop={8}
          style={{ backgroundColor: colours.purple, borderRadius: radius.pill, paddingVertical: 9, paddingHorizontal: 14, ...elevation.button(colours.purple) }}>
          <Text style={{ color: colours.onPurple, fontWeight: '700' }}>Start</Text>
        </Pressable>
      </View>
    </Card>
  );
}
