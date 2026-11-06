// Page worlds (6 Nov 2026, Taj): each page off Me gets its own look the way Sleep has its night sky.
// A soft glowing colour world fixed behind the page, frosted glass cards, an icon and big title in
// the page's colour, and buttons in that colour. Mockup stage: Taj picks which ones ship.
import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, useContext, type ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

export type SkinId = 'gym' | 'finish' | 'planner' | 'dusk' | 'crossroads' | 'cork' | 'receipt' | 'banknote' | 'airmail' | 'control';

type Skin = {
  sky: [string, string, string]; glows: [string, string, string]; accent: string; deep: string;
  icon: React.ComponentProps<typeof Ionicons>['name']; kicker: string; bg: string; card: ViewStyle;
};
const glass = (tint: string): ViewStyle => ({ backgroundColor: 'rgba(255,255,255,0.72)', borderColor: 'rgba(255,255,255,0.95)', borderWidth: 1, borderRadius: 22, shadowColor: tint, shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } });

export const SKINS: Record<SkinId, Skin> = {
  gym: { sky: ['#DDF5E6', '#EAF8DD', '#F7FBEF'], glows: ['#7FE0A3', '#C8F26B', '#5CC8B8'], accent: '#1F9D57', deep: '#0F5A33', icon: 'barbell', kicker: 'FUEL AND TRAINING', bg: '#EAF8E9', card: glass('#1F9D57') },
  finish: { sky: ['#FFE3CC', '#FFEBDD', '#FFF7EF'], glows: ['#FFA45C', '#FF7A8A', '#FFD36B'], accent: '#E2620B', deep: '#8A3404', icon: 'flag', kicker: 'WHAT YOU ARE CHASING', bg: '#FFEFE2', card: glass('#E2620B') },
  planner: { sky: ['#DCE7FF', '#E9E4FF', '#F6F7FF'], glows: ['#7FA6FF', '#B49CFF', '#8FE0FF'], accent: '#3557C2', deep: '#1E2F6E', icon: 'calendar', kicker: 'YOUR WEEK, LOOKED AT', bg: '#ECEFFF', card: glass('#3557C2') },
  dusk: { sky: ['#FFD9C2', '#EBD3F2', '#D9D2FA'], glows: ['#FF9F6E', '#C38BFF', '#7F8CFF'], accent: '#6B46C1', deep: '#3B2470', icon: 'moon', kicker: 'TIME TO SWITCH OFF', bg: '#EEE3F6', card: glass('#6B46C1') },
  crossroads: { sky: ['#F7E6D2', '#F6E2E2', '#FBF4EC'], glows: ['#E9B07A', '#E8A0A8', '#F3D49B'], accent: '#A0522D', deep: '#5C2C14', icon: 'git-branch', kicker: 'WHAT YOU DECIDED AND WHY', bg: '#F8EDE3', card: glass('#A0522D') },
  cork: { sky: ['#D8F3F2', '#E1EBFF', '#F3FAFB'], glows: ['#5FD3CF', '#8FB2FF', '#9BE7C4'], accent: '#0E8A8A', deep: '#064D4D', icon: 'people', kicker: 'YOUR PEOPLE', bg: '#E6F5F6', card: glass('#0E8A8A') },
  receipt: { sky: ['#E3E8F0', '#EFEAE2', '#F8F7F4'], glows: ['#9FB0C8', '#E2C9A0', '#B9C6D9'], accent: '#334155', deep: '#1E2733', icon: 'receipt', kicker: 'BILLS OUT, CASH IN', bg: '#EEEFF2', card: glass('#334155') },
  banknote: { sky: ['#D6F2E4', '#E2F5EE', '#F3FBF7'], glows: ['#4FD1A0', '#9BE7C4', '#D7F07A'], accent: '#127A5A', deep: '#0A4433', icon: 'wallet', kicker: 'YOUR MONTH AT A GLANCE', bg: '#E5F5EE', card: glass('#127A5A') },
  airmail: { sky: ['#DCEBFA', '#ECE6FA', '#F7F8FC'], glows: ['#7CB8F2', '#B9A6FF', '#8FDDF0'], accent: '#2F5BA8', deep: '#18305E', icon: 'mail', kicker: 'SORTED FOR YOU', bg: '#EAF0FA', card: glass('#2F5BA8') },
  control: { sky: ['#DFE3FB', '#E3EEFF', '#F4F7FF'], glows: ['#8E8CFF', '#6FC3FF', '#B6A2FF'], accent: '#4F46E5', deep: '#26208A', icon: 'flash', kicker: 'TALI ON AUTOPILOT', bg: '#E9EDFF', card: glass('#4F46E5') },
};

const SkinCtx = createContext<Skin | null>(null);
export const useSkin = () => useContext(SkinCtx);
export function SkinProvider({ id, children }: { id?: SkinId; children: ReactNode }) {
  return <SkinCtx.Provider value={id ? SKINS[id] : null}>{children}</SkinCtx.Provider>;
}

// The fixed colour world behind the page: a soft gradient with three big glowing blobs.
export function SkinBackdrop({ id }: { id: SkinId }) {
  const s = SKINS[id];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={s.sky} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: -90, right: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: s.glows[0], opacity: 0.35 }} />
      <View style={{ position: 'absolute', top: 180, left: -120, width: 260, height: 260, borderRadius: 130, backgroundColor: s.glows[1], opacity: 0.22 }} />
      <View style={{ position: 'absolute', bottom: -60, right: -40, width: 280, height: 280, borderRadius: 140, backgroundColor: s.glows[2], opacity: 0.22 }} />
      <View style={{ position: 'absolute', top: 120, right: 40, width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF', opacity: 0.8 }} />
      <View style={{ position: 'absolute', top: 60, left: 70, width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF', opacity: 0.7 }} />
    </View>
  );
}

export function SkinHeader({ id, title, sub, onBack, backLabel = 'Back' }: { id: SkinId; title: string; sub?: string; onBack?: () => void; backLabel?: string }) {
  const s = SKINS[id];
  return (
    <View style={{ marginBottom: 18 }}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button">
          <Text style={{ color: s.accent, fontSize: 15, fontWeight: '700' }}>{'‹'} {backLabel}</Text>
        </Pressable>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16 }}>
        <LinearGradient colors={[s.accent, s.deep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', shadowColor: s.accent, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }}>
          <Ionicons name={s.icon} size={28} color="#FFFFFF" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={{ color: s.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>{s.kicker}</Text>
          <Text style={{ color: s.deep, fontSize: 30, fontWeight: '800', letterSpacing: -0.4 }}>{title}</Text>
        </View>
      </View>
      {sub ? <Text style={{ color: s.deep, opacity: 0.72, fontSize: 14, lineHeight: 20, marginTop: 12 }}>{sub}</Text> : null}
    </View>
  );
}

export function CardDecor(_: { skin: Skin }) {
  return null;
}
