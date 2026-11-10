// Last night (10 Nov 2026, brain overhaul part 2, asked for by Taj). Each night Tali goes back over
// what she learnt: what she took from the day, and every note she tidied, each with an Undo.
// Nothing is deleted, so Undo always puts things back exactly as they were.
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { night } from '@/components/NightSky';
import { radius, space } from '@/constants/theme';
import { mySleeps, undoSleepChange, type SleepChange, type SleepNight } from '@/lib/sleeps';

const LABEL: Record<SleepChange['type'], { tag: string; colour: string }> = {
  replaced: { tag: 'Updated', colour: '#8EF0C8' },
  combined: { tag: 'Put together', colour: '#9FB7FF' },
  merged: { tag: 'Said twice', colour: '#FFE38A' },
  faded: { tag: 'Let go', colour: '#D2CCEE' },
};

const niceDate = (d: string) => {
  const t = new Date(d + 'T12:00:00');
  return Number.isNaN(t.getTime()) ? '' : t.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' });
};

export function LastNightCard({ onChanged }: { onChanged?: () => void }) {
  const [nightRow, setNightRow] = useState<SleepNight | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const load = () => mySleeps(1).then((n) => setNightRow(n[0] ?? null)).catch(() => setNightRow(null));
  useEffect(() => {
    void load();
  }, []);
  if (!nightRow || (!nightRow.learned && !nightRow.changes.length)) return null;

  const live = nightRow.changes.filter((c) => !c.undone);
  const undo = async (c: SleepChange) => {
    setBusy(c.index);
    const ok = await undoSleepChange(nightRow.id, c.index);
    setBusy(null);
    if (ok) {
      await load();
      onChanged?.();
    }
  };

  return (
    <View style={{ borderRadius: radius.card, overflow: 'hidden', marginBottom: space.lg }}>
      <LinearGradient colors={['#2A1F4F', '#1B2450']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: space.lg }}>
        <Text style={{ color: night.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>WHILE YOU SLEPT</Text>
        <Text style={{ color: night.faint, fontSize: 12, marginTop: 2 }}>{niceDate(nightRow.night)}. I went back over what you told me.</Text>
        {nightRow.learned ? <Text style={{ color: '#fff', fontSize: 17, lineHeight: 24, marginTop: space.sm, fontFamily: 'InstrumentSerif_400Regular' }}>{nightRow.learned}</Text> : null}

        {nightRow.changes.length ? (
          <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.md, paddingVertical: 6 }}>
            <Text style={{ flex: 1, color: night.ink, fontSize: 14, fontWeight: '800' }}>
              {live.length === 0 ? 'You put everything back' : `I tidied ${live.length} ${live.length === 1 ? 'note' : 'notes'}`}
            </Text>
            <Text style={{ color: night.accent, fontSize: 13, fontWeight: '700' }}>{open ? 'Hide' : 'Show me'}</Text>
          </Pressable>
        ) : null}

        {open ? (
          <View style={{ gap: 8, marginTop: 4 }}>
            {nightRow.changes.map((c) => {
              const l = LABEL[c.type] ?? LABEL.merged;
              return (
                <View key={c.index} style={{ backgroundColor: night.glass, borderWidth: 1, borderColor: night.line, borderLeftWidth: 3, borderLeftColor: l.colour, borderRadius: 14, padding: 12, opacity: c.undone ? 0.55 : 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ flex: 1, color: l.colour, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>{l.tag}</Text>
                    {c.undone ? (
                      <Text style={{ color: night.faint, fontSize: 12, fontWeight: '700' }}>Put back</Text>
                    ) : (
                      <Pressable onPress={() => undo(c)} disabled={busy !== null} hitSlop={10} accessibilityRole="button" accessibilityLabel="Undo this change">
                        <Text style={{ color: night.accent, fontSize: 13, fontWeight: '800' }}>{busy === c.index ? 'Putting back' : 'Undo'}</Text>
                      </Pressable>
                    )}
                  </View>
                  <Text style={{ color: night.ink, fontSize: 14, lineHeight: 20, marginTop: 4 }}>{c.text}</Text>
                  {c.was.map((w, i) => (
                    <Text key={i} style={{ color: night.muted, fontSize: 13, lineHeight: 18, marginTop: 3 }}>
                      {c.type === 'combined' ? 'From: ' : 'Was: '}
                      {w}
                    </Text>
                  ))}
                </View>
              );
            })}
            <Text style={{ color: night.faint, fontSize: 12, lineHeight: 17, marginTop: 2 }}>Nothing is ever deleted. Undo puts a note back exactly as it was.</Text>
          </View>
        ) : null}
      </LinearGradient>
    </View>
  );
}
