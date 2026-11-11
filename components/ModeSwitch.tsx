// 12 Nov 2026 (Taj): the Business / Life switch, and the small tag that says which side a thing belongs to.
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MODE, setMode, useMode, type Mode } from '@/lib/mode';
import { colours, radius } from '@/constants/theme';

/** `waiting` is how many things need you on each side. The side you are not on shows a dot with its count. */
export function ModeSwitch({ waiting }: { waiting?: Partial<Record<Mode, number>> }) {
  const mode = useMode();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: 'rgba(12,10,36,0.78)', borderRadius: radius.pill, padding: 4, borderWidth: 1, borderColor: colours.border }}>
      {(['business', 'life'] as const).map((m) => {
        const on = mode === m, cfg = MODE[m], n = !on ? waiting?.[m] ?? 0 : 0;
        return (
          <Pressable key={m} onPress={() => setMode(m)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`${cfg.label} mode`}
            style={{ flex: 1, flexDirection: 'row', gap: 7, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? cfg.colour : 'transparent' }}>
            <Ionicons name={cfg.icon} size={16} color={on ? '#141033' : colours.muted} />
            <Text style={{ fontSize: 15, fontWeight: '800', color: on ? '#141033' : colours.muted }}>{cfg.label}</Text>
            {n ? (
              <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colours.orange, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#141033' }}>{n}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function TagPill({ tag, onPress }: { tag: Mode; onPress?: () => void }) {
  const cfg = MODE[tag];
  const pill = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 8, backgroundColor: cfg.colour + '26', borderWidth: 1, borderColor: cfg.colour + '80' }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cfg.colour }} />
      <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6, color: cfg.colour }}>{cfg.label.toUpperCase()}</Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Tagged ${cfg.label}. Tap to change`}>{pill}</Pressable> : pill;
}

/** Lists open on the mode you are in, with one tap to see everything. */
export function ScopeChips({ value, onChange, counts }: { value: 'mode' | 'all'; onChange: (v: 'mode' | 'all') => void; counts: { mode: number; all: number } }) {
  const mode = useMode();
  const opts = [{ k: 'mode' as const, label: `${MODE[mode].label} (${counts.mode})` }, { k: 'all' as const, label: `Everything (${counts.all})` }];
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
      {opts.map((o) => {
        const on = value === o.k;
        return (
          <Pressable key={o.k} onPress={() => onChange(o.k)} accessibilityRole="button" accessibilityState={{ selected: on }}
            style={{ borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: on ? colours.purple : colours.sunk, borderWidth: 1, borderColor: on ? colours.purple : colours.border }}>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: on ? colours.onPurple : colours.muted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
