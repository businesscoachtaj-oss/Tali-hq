import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { addReminder } from '@/lib/data';
import { addDays } from '@/lib/dates';
import { ChipPicker } from '@/components/ChipPicker';
import { Button } from '@/components/ui';
import { colours, elevation, radius, space } from '@/constants/theme';

const WHEN = ['In an hour', 'This arvo', 'Tomorrow 9am', 'Monday 9am', 'Next week'] as const;
type When = (typeof WHEN)[number];

function dueFor(w: When) {
  const now = new Date();
  const at = (d: Date, h: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 0, 0);
  switch (w) {
    case 'In an hour': return new Date(now.getTime() + 3600000);
    case 'This arvo': return now.getHours() < 15 ? at(now, 15) : new Date(now.getTime() + 3600000);
    case 'Tomorrow 9am': return at(addDays(now, 1), 9);
    case 'Monday 9am': { const d = addDays(now, ((8 - now.getDay()) % 7) || 7); return at(d, 9); }
    case 'Next week': return at(addDays(now, 7), 9);
  }
}

// Add a reminder yourself, no credits needed. Tali can also set them from Talk.
export function AddReminder({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [when, setWhen] = useState<When>('Tomorrow 9am');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!text.trim()) return setError('What should I remind you about?');
    setBusy(true);
    setError('');
    try {
      await addReminder(text, dueFor(when));
      setText('');
      setOpen(false);
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
  return (
    <View style={{ backgroundColor: colours.surface, borderWidth: 1, borderColor: 'rgba(39,38,38,0.04)', borderRadius: 18, padding: space.lg, marginBottom: space.md, ...elevation.card }}>
      <TextInput value={text} onChangeText={setText} placeholder="Chase Jordan about his invoice" placeholderTextColor={colours.faint} maxLength={300} autoFocus
        style={{ borderWidth: 1, borderColor: colours.borderStrong, borderRadius: radius.input, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16, color: colours.text, marginBottom: space.md }} />
      <ChipPicker options={WHEN} value={when} onChange={setWhen} />
      {error ? <Text style={{ color: colours.danger, fontSize: 13 }}>{error}</Text> : null}
      <Button title="Remind me" onPress={save} busy={busy} />
      <Button title="Cancel" kind="ghost" onPress={() => { setOpen(false); setError(''); }} />
    </View>
  );
}
