import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { addReminder } from '@/lib/data';
import { addDays } from '@/lib/dates';
import { ChipPicker } from '@/components/ChipPicker';
import { Button } from '@/components/ui';
import { AREAS, AREA_ORDER, REPEATS, type Area, type Repeat } from '@/lib/areas';
import { colours, elevation, radius, space } from '@/constants/theme';

const WHEN = ['In an hour', 'This arvo', 'Tonight 8pm', 'Tomorrow 9am', 'Monday 9am', 'Next week'] as const;
type When = (typeof WHEN)[number];

function dueFor(w: When) {
  const now = new Date();
  const at = (d: Date, h: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 0, 0);
  switch (w) {
    case 'In an hour': return new Date(now.getTime() + 3600000);
    case 'This arvo': return now.getHours() < 15 ? at(now, 15) : new Date(now.getTime() + 3600000);
    case 'Tonight 8pm': return now.getHours() < 20 ? at(now, 20) : new Date(now.getTime() + 3600000);
    case 'Tomorrow 9am': return at(addDays(now, 1), 9);
    case 'Monday 9am': { const d = addDays(now, ((8 - now.getDay()) % 7) || 7); return at(d, 9); }
    case 'Next week': return at(addDays(now, 7), 9);
  }
}

// Add a reminder yourself, no credits needed. Tali can also set them from Talk.
// `side` is the mode you are in (12 Nov 2026), so a reminder added on the Life side stays on the Life side.
// 28 Nov 2026 (Learnéd): which part of life it is for (mind, body, people, money, home) and how often.
export function AddReminder({ onAdded, side, area: startArea, startOpen }: { onAdded: () => void; side?: 'life' | 'business'; area?: Area | null; startOpen?: boolean }) {
  const [open, setOpen] = useState(!!startOpen);
  const [text, setText] = useState('');
  const [when, setWhen] = useState<When>('Tomorrow 9am');
  const [area, setArea] = useState<Area | null>(startArea ?? null);
  const [repeat, setRepeat] = useState<Repeat | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!text.trim()) return setError('What should I remind you about?');
    setBusy(true);
    setError('');
    try {
      await addReminder(text, dueFor(when), side, { area, repeat });
      setText('');
      setRepeat(null);
      setOpen(!!startOpen);
      onAdded();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save that.');
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" style={{ paddingVertical: 8 }}>
        <Text style={{ color: colours.purple, fontWeight: '700', fontSize: 15 }}>+ Add a reminder</Text>
      </Pressable>
    );
  }
  const chip = (on: boolean) => ({ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingVertical: 7, paddingHorizontal: 11, borderRadius: radius.pill, borderWidth: 1, borderColor: colours.ink, backgroundColor: on ? colours.ink : 'transparent' });
  return (
    <View style={{ backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.border, borderRadius: radius.card, padding: space.lg, marginBottom: space.md, ...elevation.card }}>
      <TextInput value={text} onChangeText={setText} placeholder="Call Mum, gym, A$150 into savings..." placeholderTextColor={colours.faint} maxLength={300} autoFocus={!startOpen}
        accessibilityLabel="What to remind you about"
        style={{ borderWidth: 1, borderColor: colours.borderStrong, borderRadius: radius.input, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16, color: colours.text, marginBottom: space.md }} />
      <Text style={{ color: colours.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, marginBottom: 6 }}>WHEN</Text>
      <ChipPicker options={WHEN} value={when} onChange={setWhen} />
      <Text style={{ color: colours.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, marginBottom: 6 }}>PART OF YOUR LIFE</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: space.md }}>
        {AREA_ORDER.map((a) => {
          const on = area === a;
          return (
            <Pressable key={a} onPress={() => setArea(on ? null : a)} accessibilityRole="button" accessibilityState={{ selected: on }} style={chip(on)}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: AREAS[a].colour }} />
              <Text style={{ color: on ? colours.bg : colours.text, fontSize: 13, fontWeight: '700' }}>{AREAS[a].name}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ color: colours.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, marginBottom: 6 }}>HOW OFTEN</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: space.md }}>
        {REPEATS.map((r) => {
          const on = repeat === r.id;
          return (
            <Pressable key={r.label} onPress={() => setRepeat(r.id)} accessibilityRole="button" accessibilityState={{ selected: on }} style={chip(on)}>
              <Text style={{ color: on ? colours.bg : colours.text, fontSize: 13, fontWeight: '700' }}>{r.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={{ color: colours.danger, fontSize: 13 }}>{error}</Text> : null}
      <Button title="Remind me" onPress={save} busy={busy} />
      {startOpen ? null : <Button title="Cancel" kind="ghost" onPress={() => { setOpen(false); setError(''); }} />}
    </View>
  );
}
