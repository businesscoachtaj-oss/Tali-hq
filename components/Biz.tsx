// 12 Nov 2026 (Taj: "I want the business stuff to be awesome"): shared pieces for the business tools
// (Jobs and quotes, Pipeline, Bookings, Projects).
import { type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { TaliAvatar } from '@/components/TaliAvatar';
import { colours, radius, space } from '@/constants/theme';

export const BLUE = '#7FA8FF';
export type Icon = React.ComponentProps<typeof Ionicons>['name'];
export const aud = (n: number) => `A$${Math.round(n).toLocaleString('en-AU')}`;

export function Head({ back = 'Today', to = '/', over, title, sub }: { back?: string; to?: string; over: string; title: string; sub: string }) {
  return (
    <View style={{ marginBottom: 18, marginTop: 6 }}>
      <Pressable onPress={() => router.navigate(to as any)} hitSlop={12} accessibilityRole="button" style={{ marginBottom: 16 }}>
        <Text style={{ color: '#B9A6FF', fontSize: 15, fontWeight: '600' }}>{'‹'} {back}</Text>
      </Pressable>
      <Text style={{ color: BLUE, fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>{over.toUpperCase()}</Text>
      <Text style={{ color: '#F4F1FF', fontSize: 42, lineHeight: 46, marginTop: 6, fontFamily: 'InstrumentSerif_400Regular' }}>{title}</Text>
      <Text style={{ color: '#B9B2D9', fontSize: 15, lineHeight: 22, marginTop: 8 }}>{sub}</Text>
    </View>
  );
}

export function Stats({ items }: { items: { label: string; value: string; colour?: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, marginBottom: space.md }}>
      {items.map((x, i) => (
        <View key={x.label} style={{ flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderLeftWidth: i ? 1 : 0, borderLeftColor: colours.border }}>
          <Text style={{ color: x.colour ?? colours.text, fontSize: 21, fontWeight: '800' }}>{x.value}</Text>
          <Text style={{ color: colours.muted, fontSize: 11.5, fontWeight: '600', marginTop: 2, textAlign: 'center' }}>{x.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function Pill({ text, colour }: { text: string; colour: string }) {
  return (
    <View style={{ alignSelf: 'flex-start', borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 9, backgroundColor: colour + '26', borderWidth: 1, borderColor: colour + '80' }}>
      <Text style={{ fontSize: 11, fontWeight: '800', color: colour }}>{text}</Text>
    </View>
  );
}

export function Bar({ pct, colour = BLUE }: { pct: number; colour?: string }) {
  return (
    <View style={{ height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: 7, borderRadius: 4, backgroundColor: colour }} />
    </View>
  );
}

/** What Tali would do next, on a card. Always a suggestion: nothing goes out without your yes. */
export function Next({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 10, backgroundColor: colours.purpleSoft, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10 }}>
      <Ionicons name="sparkles" size={14} color={colours.purple} style={{ marginTop: 2 }} />
      <Text style={{ flex: 1, color: colours.text, fontSize: 13, lineHeight: 19 }}>{children}</Text>
    </View>
  );
}

export function TaliLine({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: space.md }}>
      <TaliAvatar pose="head" size={44} />
      <View style={{ flex: 1, backgroundColor: colours.purpleSoft, borderRadius: radius.card, paddingVertical: 10, paddingHorizontal: 14 }}>
        <Text style={{ color: colours.text, fontSize: 14.5, lineHeight: 21 }}>{children}</Text>
      </View>
    </View>
  );
}

export function Chips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable key={o} onPress={() => onChange(o)} accessibilityRole="button" accessibilityState={{ selected: on }}
            style={{ borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: on ? colours.purple : colours.sunk, borderWidth: 1, borderColor: on ? colours.purple : colours.border }}>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: on ? colours.onPurple : colours.muted }}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Box({ children, onPress, edge }: { children: ReactNode; onPress?: () => void; edge?: string }) {
  const style = { backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, padding: 14, marginBottom: space.md, ...(edge ? { borderLeftWidth: 5, borderLeftColor: edge } : null) };
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" style={style}>{children}</Pressable> : <View style={style}>{children}</View>;
}

export function Line({ icon, title, sub, right, colour = BLUE, first }: { icon?: Icon; title: string; sub?: string; right?: ReactNode; colour?: string; first?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, borderTopWidth: first ? 0 : 1, borderTopColor: colours.border }}>
      {icon ? <Ionicons name={icon} size={19} color={colour} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: colours.text, fontSize: 15, fontWeight: '600' }}>{title}</Text>
        {sub ? <Text style={{ color: colours.muted, fontSize: 12.5, marginTop: 1 }}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export const H = ({ children }: { children: ReactNode }) => <Text style={{ color: colours.text, fontSize: 16, fontWeight: '800' }}>{children}</Text>;
export const Sub = ({ children }: { children: ReactNode }) => <Text style={{ color: colours.muted, fontSize: 13, marginTop: 2 }}>{children}</Text>;
export const Amount = ({ children, colour }: { children: ReactNode; colour?: string }) => <Text style={{ color: colour ?? colours.text, fontSize: 16, fontWeight: '800' }}>{children}</Text>;
