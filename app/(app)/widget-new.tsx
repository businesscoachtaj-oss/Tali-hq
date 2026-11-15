// app/(app)/widget-new.tsx
// ADDED (16 Nov 2026, Taj): make your own tracker. Name it, pick what kind of thing it counts, set a
// target and how often, pick how it looks, and it goes on your home. The preview at the top
// changes as you go. On Free: number and bar styles, daily or weekly targets, no Tali check-ins.
import { useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BackLink, Button, Label, Screen, Title } from '@/components/ui';
import { TrackerTile } from '@/components/Widgets';
import { colours, radius, space } from '@/constants/theme';
import { COLOURS, LIMITS, TRACKER_PRESETS, type Period, type Tracker, type TrackerStyle, type TrackerType } from '@/lib/widgets';
import { MODE, type Mode } from '@/lib/mode';

const TYPE_LABEL: Record<TrackerType, string> = { count: 'Count', yesno: 'Yes or no', money: 'Money', time: 'Time', scale: '1 to 5' };
const PERIOD_LABEL: Record<Period, string> = { day: 'A day', week: 'A week', month: 'A month', total: 'In total' };
const STYLE_LABEL: Record<TrackerStyle, string> = { ring: 'Ring', bar: 'Bar', number: 'Number', streak: 'Streak', chart: 'Chart' };

function Chips<T extends string>({ items, value, onPick, locked = [] }: { items: Record<T, string>; value: T; onPick: (v: T) => void; locked?: T[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space.md }}>
      {(Object.keys(items) as T[]).map((k) => {
        const on = k === value, lock = locked.includes(k);
        return (
          <Pressable key={k} onPress={() => !lock && onPick(k)} accessibilityRole="radio" accessibilityState={{ selected: on, disabled: lock }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? colours.purple : colours.border, backgroundColor: on ? colours.purple : 'rgba(255,255,255,0.05)', opacity: lock ? 0.55 : 1 }}>
            {lock ? <Ionicons name="lock-closed" size={12} color={colours.orange} /> : null}
            <Text style={{ color: on ? colours.onPurple : colours.text, fontWeight: '700' }}>{items[k]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const input = { backgroundColor: colours.sunk, borderWidth: 1, borderColor: colours.border, borderRadius: radius.input, color: colours.text, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12 } as const;

export default function WidgetNew() {
  const q = useLocalSearchParams<{ preset?: string; type?: string; mode?: string; plan?: string }>();
  const free = q.plan === 'free';
  const mode: Mode = q.mode === 'business' ? 'business' : 'life';
  const base = q.preset && TRACKER_PRESETS[q.preset] ? TRACKER_PRESETS[q.preset] : null;
  const [tr, setTr] = useState<Tracker>(() => base
    ? (({ group, for: _f, ...t }) => t)(base)
    : { name: '', type: (q.type as TrackerType) || 'count', unit: '', target: null, period: 'day', value: 0, week: [0, 0, 0, 0, 0, 0, 0], style: free ? 'bar' : 'ring', colour: COLOURS[0] });
  const [wide, setWide] = useState(false);
  const [side, setSide] = useState<'life' | 'business' | 'both'>(mode);
  const set = (p: Partial<Tracker>) => setTr((t) => ({ ...t, ...p }));
  const lockedStyles = free ? (Object.keys(STYLE_LABEL) as TrackerStyle[]).filter((s) => !LIMITS.free.styles.includes(s)) : [];
  const lockedPeriods = free ? (['month', 'total'] as Period[]) : [];

  return (
    <Screen>
      <BackLink onPress={() => router.navigate(`/home-edit?mode=${mode}` as any)} label="Edit home" />
      <Title sub="Anything you want to keep count of. It goes straight on your home.">Make a tracker</Title>

      <Label>Preview</Label>
      <View style={{ flexDirection: 'row', marginBottom: space.lg }}>
        <TrackerTile w={{ id: 'p', kind: 'tracker', size: wide ? 'wide' : 'small', tracker: { ...tr, name: tr.name || 'Your tracker' } }} />
      </View>

      <Label>What are you tracking?</Label>
      <TextInput value={tr.name} onChangeText={(name) => set({ name })} placeholder="Cold calls, water, savings..." placeholderTextColor={colours.faint} style={[input, { marginBottom: space.md }]} />

      <Label>What kind of thing is it?</Label>
      <Chips items={TYPE_LABEL} value={tr.type} onPick={(type) => set({ type, unit: type === 'money' ? 'A$' : type === 'time' ? 'h' : tr.unit })} />

      {tr.type !== 'yesno' ? (<>
        <Label>Target</Label>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: space.sm }}>
          <TextInput value={tr.target ? String(tr.target) : ''} onChangeText={(v) => set({ target: Number(v) || null })} keyboardType="numeric" placeholder="20" placeholderTextColor={colours.faint} style={[input, { flex: 1, minWidth: 0 }]} />
          <TextInput value={tr.unit} onChangeText={(unit) => set({ unit })} placeholder="unit, like calls" placeholderTextColor={colours.faint} style={[input, { flex: 1, minWidth: 0 }]} />
        </View>
      </>) : null}
      <Chips items={PERIOD_LABEL} value={tr.period} onPick={(period) => set({ period })} locked={lockedPeriods} />

      <Label>How it looks</Label>
      <Chips items={STYLE_LABEL} value={tr.style} onPick={(style) => set({ style })} locked={lockedStyles} />
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: space.md, alignItems: 'center' }}>
        {COLOURS.map((c) => (
          <Pressable key={c} onPress={() => set({ colour: c })} accessibilityLabel={`Colour ${c}`}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c, borderWidth: tr.colour === c ? 3 : 0, borderColor: '#fff' }} />
        ))}
      </View>
      <Chips items={{ small: 'Small', wide: 'Wide' }} value={wide ? 'wide' : 'small'} onPick={(v) => setWide(v === 'wide')} />

      <Label>Which home?</Label>
      <Chips items={{ life: MODE.life.label, business: MODE.business.label, both: 'Both' }} value={side} onPick={setSide} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.border, marginBottom: space.lg, opacity: free ? 0.6 : 1 }}>
        <Ionicons name="sparkles" size={18} color={colours.purple} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colours.text, fontWeight: '800' }}>Tali keeps me on track</Text>
          <Text style={{ color: colours.muted, fontSize: 12.5 }}>{free ? 'On paid plans she nudges you when you fall behind and logs it when you tell her in Talk.' : 'She nudges you when you fall behind, and logs it when you tell her in Talk.'}</Text>
        </View>
        {free ? <Ionicons name="lock-closed" size={16} color={colours.orange} /> : <Switch value={!!tr.checkIn} onValueChange={(checkIn) => set({ checkIn })} />}
      </View>

      <Button title="Add to my home" onPress={() => router.navigate('/')} />
      <View style={{ height: space.xl }} />
    </Screen>
  );
}
