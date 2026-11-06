// Page skins (6 Nov 2026, Taj): every page off Me gets its own themed world, like Sleep's night sky and
// Night school's chalkboard. A themed header scene, a patterned page and cards dressed to match.
// Mockup stage: Taj picks which ones ship.
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View, type ViewStyle } from 'react-native';

export type SkinId = 'gym' | 'finish' | 'planner' | 'dusk' | 'crossroads' | 'cork' | 'receipt' | 'banknote' | 'airmail' | 'control';
type Pattern = 'hatch' | 'lanes' | 'grid' | 'stars' | 'speckle' | 'circles' | 'dots' | 'none';
type Decor = 'pin' | 'zigzag' | 'airmail' | 'tab' | 'stripe' | null;

type Skin = {
  head: [string, string]; headPattern: Pattern; emoji: string; kicker: string;
  bg: string; bgPattern: Pattern; ink: string; label: string;
  card: ViewStyle; decor: Decor; accent: string;
};

export const SKINS: Record<SkinId, Skin> = {
  gym: { head: ['#1C1F1A', '#2E352B'], headPattern: 'speckle', emoji: '\u{1F3CB}️ \u{1F957} \u{1F373}', kicker: 'GYM AND KITCHEN', bg: '#EDF1E8', bgPattern: 'hatch', ink: '#9BE15D', label: '#4A5A3C', card: { borderRadius: 14, borderTopWidth: 4, borderTopColor: '#9BE15D' }, decor: null, accent: '#5DA02A' },
  finish: { head: ['#C2410C', '#F08A1C'], headPattern: 'lanes', emoji: '\u{1F3C1} \u{1F3AF} \u{1F3C6}', kicker: 'EYES ON THE FINISH LINE', bg: '#FBF0E4', bgPattern: 'lanes', ink: '#FFFFFF', label: '#9A4A16', card: { borderRadius: 22, borderWidth: 2, borderColor: '#F3CDA6' }, decor: null, accent: '#E2620B' },
  planner: { head: ['#1E3A6E', '#3462B0'], headPattern: 'grid', emoji: '\u{1F5D3}️ \u{1F4C8} ✅', kicker: 'YOUR WEEK ON PAPER', bg: '#F3F6FB', bgPattern: 'grid', ink: '#FFFFFF', label: '#33507F', card: { borderRadius: 10 }, decor: 'tab', accent: '#2F5BA8' },
  dusk: { head: ['#F08A4B', '#5B3C9E'], headPattern: 'stars', emoji: '\u{1F319} \u{1F305} ✨', kicker: 'TIME TO SWITCH OFF', bg: '#F1ECF7', bgPattern: 'stars', ink: '#FFFFFF', label: '#5B3C9E', card: { borderRadius: 26 }, decor: null, accent: '#6B46C1' },
  crossroads: { head: ['#5B3A1E', '#9A6A3A'], headPattern: 'speckle', emoji: '\u{1F9ED} ⚖️ \u{1FAA7}', kicker: 'WHICH WAY AND WHY', bg: '#F5EDDC', bgPattern: 'speckle', ink: '#FFF4DE', label: '#7A5530', card: { borderRadius: 6, backgroundColor: '#FFF9EC', borderWidth: 1, borderColor: '#E4CFA6' }, decor: null, accent: '#8A5A2E' },
  cork: { head: ['#4A2E1A', '#7A4E2E'], headPattern: 'speckle', emoji: '\u{1F4C7} \u{1F4CC} \u{1F465}', kicker: 'YOUR PEOPLE BOARD', bg: '#DDBF93', bgPattern: 'speckle', ink: '#FFFFFF', label: '#5A3A1C', card: { borderRadius: 3, borderTopWidth: 3, borderTopColor: '#E25D5D' }, decor: 'pin', accent: '#B5462E' },
  receipt: { head: ['#22262E', '#3C4250'], headPattern: 'dots', emoji: '\u{1F9FE} \u{1F4B3} ✅', kicker: 'BILLS OUT, CASH IN', bg: '#EFEDE8', bgPattern: 'dots', ink: '#FFFFFF', label: '#4B4F59', card: { borderRadius: 2 }, decor: 'zigzag', accent: '#2C3240' },
  banknote: { head: ['#0B5A45', '#2E9D78'], headPattern: 'circles', emoji: '\u{1F4B5} \u{1F4CA} \u{1FA99}', kicker: 'YOUR MONTH AT A GLANCE', bg: '#E8F3EE', bgPattern: 'circles', ink: '#FFFFFF', label: '#1E6B52', card: { borderRadius: 14, borderWidth: 1.5, borderColor: '#B9DCCB' }, decor: null, accent: '#127A5A' },
  airmail: { head: ['#1D2B55', '#2F4B8C'], headPattern: 'dots', emoji: '✉️ \u{1F4EC} \u{1F4EE}', kicker: 'SORTED FOR YOU', bg: '#F5F2EC', bgPattern: 'none', ink: '#FFFFFF', label: '#2F3E66', card: { borderRadius: 8 }, decor: 'airmail', accent: '#C2353A' },
  control: { head: ['#0F1A2E', '#1F3358'], headPattern: 'grid', emoji: '⚡ \u{1F916} ⚙️', kicker: 'TALI ON AUTOPILOT', bg: '#ECF0F6', bgPattern: 'dots', ink: '#7FD1FF', label: '#2A3C5E', card: { borderRadius: 10, borderLeftWidth: 4, borderLeftColor: '#3B82F6' }, decor: null, accent: '#2563EB' },
};

const SkinCtx = createContext<Skin | null>(null);
export const useSkin = () => useContext(SkinCtx);
export function SkinProvider({ id, children }: { id?: SkinId; children: ReactNode }) {
  return <SkinCtx.Provider value={id ? SKINS[id] : null}>{children}</SkinCtx.Provider>;
}

function PatternLayer({ kind, colour, opacity }: { kind: Pattern; colour: string; opacity: number }) {
  const items = useMemo(() => {
    const out: ReactNode[] = [];
    if (kind === 'hatch') for (let i = 0; i < 30; i++) out.push(<View key={i} style={{ position: 'absolute', left: -200 + i * 40, top: -50, width: 2, height: 2200, backgroundColor: colour, opacity, transform: [{ rotate: '35deg' }] }} />);
    if (kind === 'lanes') for (let i = 0; i < 40; i++) out.push(<View key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * 56, height: 2, backgroundColor: colour, opacity }} />);
    if (kind === 'grid') for (let i = 0; i < 60; i++) { out.push(<View key={'h' + i} style={{ position: 'absolute', left: 0, right: 0, top: i * 22, height: 1, backgroundColor: colour, opacity }} />); out.push(<View key={'v' + i} style={{ position: 'absolute', top: 0, bottom: 0, left: i * 22, width: 1, backgroundColor: colour, opacity }} />); }
    if (kind === 'stars' || kind === 'speckle') for (let i = 0; i < 90; i++) { const s = kind === 'stars' ? 1 + (i % 3) : 2 + (i % 4); out.push(<View key={i} style={{ position: 'absolute', left: `${(i * 37) % 100}%`, top: `${(i * 61) % 100}%`, width: s, height: s, borderRadius: s, backgroundColor: colour, opacity: opacity * (0.5 + (i % 5) / 5) }} />); }
    if (kind === 'circles') for (let i = 0; i < 9; i++) out.push(<View key={i} style={{ position: 'absolute', right: -120 - i * 0, top: -120, width: 160 + i * 70, height: 160 + i * 70, borderRadius: 400, borderWidth: 1.5, borderColor: colour, opacity, marginRight: -i * 35, marginTop: -i * 35 }} />);
    if (kind === 'dots') for (let r = 0; r < 70; r++) for (let c = 0; c < 22; c++) if ((r + c) % 2 === 0) out.push(<View key={r + '-' + c} style={{ position: 'absolute', left: c * 20, top: r * 20, width: 2, height: 2, borderRadius: 1, backgroundColor: colour, opacity }} />);
    return out;
  }, [kind, colour, opacity]);
  return <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden' }}>{items}</View>;
}

// The patterned page behind the cards. Put it first inside <Screen>.
export function SkinBackdrop({ id }: { id: SkinId }) {
  const s = SKINS[id];
  return <View pointerEvents="none" style={{ position: 'absolute', left: -16, right: -16, top: -16, bottom: -16 }}><PatternLayer kind={s.bgPattern} colour={s.label} opacity={0.07} /></View>;
}

export function SkinHeader({ id, title, sub, onBack, backLabel = 'Back' }: { id: SkinId; title: string; sub?: string; onBack?: () => void; backLabel?: string }) {
  const s = SKINS[id];
  return (
    <View style={{ marginHorizontal: -16, marginTop: -16, marginBottom: 18 }}>
      <LinearGradient colors={s.head} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' }}>
        <PatternLayer kind={s.headPattern} colour="#FFFFFF" opacity={0.12} />
        {id === 'finish' ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 12, flexDirection: 'row' }}>{Array.from({ length: 40 }, (_, i) => <View key={i} style={{ width: 12, height: 6, backgroundColor: i % 2 ? '#111' : '#fff', marginTop: i % 2 ? 0 : 6 }} />)}</View> : null}
        {id === 'planner' ? <View style={{ position: 'absolute', top: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-evenly' }}>{Array.from({ length: 9 }, (_, i) => <View key={i} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.25)' }} />)}</View> : null}
        {id === 'dusk' ? <View style={{ position: 'absolute', right: 26, top: 22, width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFE9B8', opacity: 0.9 }} /> : null}
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button">
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '700', marginTop: id === 'planner' ? 8 : 0 }}>{'‹'} {backLabel}</Text>
          </Pressable>
        ) : null}
        <Text style={{ fontSize: 28, marginTop: 14 }}>{s.emoji}</Text>
        <Text style={{ color: s.ink === '#FFFFFF' ? 'rgba(255,255,255,0.78)' : s.ink, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 8 }}>{s.kicker}</Text>
        <Text style={{ color: '#FFFFFF', fontSize: 30, fontWeight: '800', marginTop: 2 }}>{title}</Text>
        {sub ? <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 14, lineHeight: 20, marginTop: 8 }}>{sub}</Text> : null}
      </LinearGradient>
    </View>
  );
}

// Little extras a skinned card wears (a pin, a torn receipt edge, an airmail border, a planner tab).
export function CardDecor({ skin }: { skin: Skin }) {
  if (skin.decor === 'pin') return <View pointerEvents="none" style={{ position: 'absolute', top: -7, alignSelf: 'center', width: 14, height: 14, borderRadius: 7, backgroundColor: '#E25D5D', borderWidth: 2, borderColor: '#B83D3D' }} />;
  if (skin.decor === 'zigzag') return <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: -6, height: 12, flexDirection: 'row', overflow: 'hidden' }}>{Array.from({ length: 40 }, (_, i) => <View key={i} style={{ width: 12, height: 12, backgroundColor: skin.bg, transform: [{ rotate: '45deg' }], marginLeft: i ? -2 : 0, marginTop: 6 }} />)}</View>;
  if (skin.decor === 'airmail') return <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 5, flexDirection: 'row', overflow: 'hidden', borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>{Array.from({ length: 40 }, (_, i) => <View key={i} style={{ width: 16, height: 5, backgroundColor: i % 2 ? '#2F4B8C' : '#C2353A', transform: [{ skewX: '-30deg' }] }} />)}</View>;
  if (skin.decor === 'tab') return <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 18, width: 34, height: 5, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: skin.accent }} />;
  return null;
}
