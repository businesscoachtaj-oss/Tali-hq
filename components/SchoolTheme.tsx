// Night school's school theme (6 Nov 2026, Taj): a chalkboard page, chalk writing, topics as sticky
// notes and Tali's lessons on lined notebook paper.
import type { PropsWithChildren, ReactNode } from 'react';
import { useMemo } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';

export const school = {
  board: '#22382F',
  boardDeep: '#1A2C25',
  chalk: '#F4F1E8',
  chalkSoft: 'rgba(244,241,232,0.72)',
  chalkFaint: 'rgba(244,241,232,0.45)',
  wood: '#8A5A33',
  paper: '#FFFDF6',
  ruled: 'rgba(86,132,201,0.22)',
  margin: 'rgba(214,74,74,0.55)',
  ink: '#22304A',
  sticky: ['#FFE58A', '#FFD6E2', '#CDEFD9'],
  bus: '#F5C542',
};

const chalkText = { textShadowColor: 'rgba(244,241,232,0.35)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 3 };

// Chalk dust on the board, fixed behind the page.
export function ChalkDust() {
  const specks = useMemo(() => Array.from({ length: 70 }, (_, i) => ({ x: (i * 97) % 100, y: (i * 53) % 100, s: 1 + (i % 3), o: 0.05 + ((i * 7) % 10) / 100 })), []);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
      {specks.map((p, i) => (
        <View key={i} style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, borderRadius: p.s, backgroundColor: school.chalk, opacity: p.o }} />
      ))}
      <View style={{ position: 'absolute', left: '8%', top: '30%', width: 120, height: 30, borderRadius: 30, backgroundColor: 'rgba(244,241,232,0.03)', transform: [{ rotate: '-8deg' }] }} />
      <View style={{ position: 'absolute', right: '6%', top: '62%', width: 160, height: 40, borderRadius: 40, backgroundColor: 'rgba(244,241,232,0.03)', transform: [{ rotate: '6deg' }] }} />
    </View>
  );
}

export function ChalkHeader({ title, sub, onBack, backLabel = 'Back' }: { title: string; sub?: string; onBack: () => void; backLabel?: string }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button">
        <Text style={{ color: school.chalkSoft, fontSize: 15, fontWeight: '700' }}>{'‹'} {backLabel}</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14 }}>
        <View>
          <Text style={[{ color: school.chalk, fontSize: 34, fontWeight: '800', fontStyle: 'italic', letterSpacing: 0.3 }, chalkText]}>{title}</Text>
          <View style={{ height: 3, width: 170, backgroundColor: school.chalkSoft, borderRadius: 2, marginTop: 4, transform: [{ rotate: '-1.2deg' }] }} />
        </View>
        <Text style={{ fontSize: 30 }}>{'\u{1F4DA}'}{'✏️'}{'\u{1F34E}'}</Text>
      </View>
      {sub ? <Text style={[{ color: school.chalkSoft, fontSize: 14, lineHeight: 21, marginTop: 12 }, chalkText]}>{sub}</Text> : null}
    </View>
  );
}

export function ChalkLabel({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 8 }}>
      <Text style={[{ color: school.chalkSoft, fontSize: 12, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' }, chalkText]}>{children}</Text>
      {right}
    </View>
  );
}

// Lined notebook paper with a red margin.
export function Paper({ children, style, lines = 4 }: PropsWithChildren<{ style?: ViewStyle; lines?: number }>) {
  return (
    <View style={[{ backgroundColor: school.paper, borderRadius: 6, paddingVertical: 14, paddingLeft: 34, paddingRight: 14, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 4 }, style]}>
      {Array.from({ length: lines }, (_, i) => (
        <View key={i} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 34 + i * 24, height: 1, backgroundColor: school.ruled }} />
      ))}
      <View pointerEvents="none" style={{ position: 'absolute', left: 22, top: 0, bottom: 0, width: 1.5, backgroundColor: school.margin }} />
      {children}
    </View>
  );
}

export function Sticky({ children, i = 0 }: PropsWithChildren<{ i?: number }>) {
  return (
    <View style={{ backgroundColor: school.sticky[i % 3], padding: 14, paddingTop: 18, marginBottom: 10, borderRadius: 2, transform: [{ rotate: `${i % 2 ? 0.8 : -0.8}deg` }], shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}>
      <View style={{ position: 'absolute', top: -6, alignSelf: 'center', width: 54, height: 14, backgroundColor: 'rgba(255,255,255,0.55)', transform: [{ rotate: '-2deg' }] }} />
      {children}
    </View>
  );
}

export function ChalkChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }}
      style={{ paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderStyle: on ? 'solid' : 'dashed', borderColor: school.chalkSoft, backgroundColor: on ? school.chalk : 'transparent' }}>
      <Text style={{ color: on ? school.boardDeep : school.chalk, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

export function BusButton({ title, onPress, disabled, outline }: { title: string; onPress: () => void; disabled?: boolean; outline?: boolean }) {
  return (
    <Pressable onPress={disabled ? undefined : onPress} accessibilityRole="button"
      style={{ marginTop: 8, paddingVertical: 14, borderRadius: 14, alignItems: 'center', opacity: disabled ? 0.5 : 1, backgroundColor: outline ? 'transparent' : school.bus, borderWidth: outline ? 1.5 : 0, borderStyle: 'dashed', borderColor: school.chalkSoft, shadowColor: '#000', shadowOffset: { width: 0, height: outline ? 0 : 5 }, shadowOpacity: outline ? 0 : 0.3, shadowRadius: 10, elevation: outline ? 0 : 4 }}>
      <Text style={{ color: outline ? school.chalk : '#2B2207', fontWeight: '800', fontSize: 16 }}>{title}</Text>
    </Pressable>
  );
}

// 6 Nov 2026 (Taj): everything on the board is written in chalk, no paper.
export function ChalkBox({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return (
    <View style={[{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(244,241,232,0.38)', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 10, backgroundColor: 'rgba(244,241,232,0.04)' }, style]}>
      {children}
    </View>
  );
}
export const chalkStyle = { color: school.chalk, textShadowColor: 'rgba(244,241,232,0.35)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 3 } as const;
