// Page banners (6 Nov 2026, Taj): every page off Me gets a gradient banner in its own colour, with
// the back link, an icon, a small label line, the title and a line under it. The page behind gets a
// light tint of the same colour. Mockup stage: Taj picks which ones ship.
import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, useContext, type ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View } from 'react-native';

export type SkinId = 'gym' | 'finish' | 'planner' | 'dusk' | 'crossroads' | 'cork' | 'receipt' | 'banknote' | 'airmail' | 'control' | 'nightschool' | 'shoebox' | 'topup' | 'founder' | 'affiliate' | 'settings' | 'plans' | 'brain' | 'journal';

type Skin = { colors: [string, string]; bg: string; icon: React.ComponentProps<typeof Ionicons>['name']; kicker: string };

export const SKINS: Record<SkinId, Skin> = {
  nightschool: { colors: ['#1B1340', '#46307E'], bg: '#ECE8F6', icon: 'school-outline', kicker: 'TALI STUDIES WHILE YOU SLEEP' },
  gym: { colors: ['#0F6B45', '#3DBB7E'], bg: '#EAF4EE', icon: 'barbell-outline', kicker: 'FOOD, WEIGHT AND TRAINING' },
  finish: { colors: ['#B23A0B', '#ED8008'], bg: '#FBEFE2', icon: 'flag-outline', kicker: 'WHAT YOU ARE CHASING' },
  planner: { colors: ['#1E3A6E', '#3462B0'], bg: '#EAF0FA', icon: 'calendar-outline', kicker: 'YOUR WEEK, LOOKED AT' },
  dusk: { colors: ['#D9673A', '#5B3C9E'], bg: '#F1EAF4', icon: 'moon-outline', kicker: 'TIME TO SWITCH OFF' },
  crossroads: { colors: ['#7A2E0E', '#D0661C'], bg: '#F8EEE6', icon: 'git-branch-outline', kicker: 'WHAT YOU DECIDED AND WHY' },
  cork: { colors: ['#0B6566', '#2BAFAE'], bg: '#E6F4F4', icon: 'people-outline', kicker: 'YOUR PEOPLE' },
  receipt: { colors: ['#1F2733', '#4B5568'], bg: '#EEEFF2', icon: 'receipt-outline', kicker: 'BILLS OUT, CASH IN' },
  banknote: { colors: ['#0A5A45', '#2E9D78'], bg: '#E8F3EE', icon: 'wallet-outline', kicker: 'YOUR MONTH AT A GLANCE' },
  topup: { colors: ['#4A2160', '#8A4A9E'], bg: '#F3EEF6', icon: 'battery-charging-outline', kicker: 'MORE TIME WITH TALI' },
  shoebox: { colors: ['#6E4A0C', '#C98A1E'], bg: '#F7F0E2', icon: 'file-tray-full-outline', kicker: 'READY FOR TAX TIME' },
  airmail: { colors: ['#1D3A7A', '#3F7BD6'], bg: '#EAF0FA', icon: 'mail-outline', kicker: 'SORTED FOR YOU' },
  control: { colors: ['#2A238F', '#5B54E8'], bg: '#ECECFB', icon: 'flash-outline', kicker: 'TALI ON AUTOPILOT' },
  // ADDED (9 Nov 2026): the pages that had no banner yet, so every page off Me matches.
  founder: { colors: ['#272626', '#5A524B'], bg: '#EFEDEA', icon: 'stats-chart-outline', kicker: 'ONLY YOU SEE THIS' },
  affiliate: { colors: ['#6C3483', '#ED8008'], bg: '#F6EEEA', icon: 'pricetags-outline', kicker: 'PEOPLE SHARING YOUR APPS' },
  settings: { colors: ['#3B3F46', '#6B7280'], bg: '#EEEFF1', icon: 'settings-outline', kicker: 'YOU AND YOUR BUSINESS' },
  plans: { colors: ['#4A2160', '#6C3483'], bg: '#F3EEF6', icon: 'sparkles-outline', kicker: 'YOUR PLAN' },
  journal: { colors: ['#5B1F4A', '#B24D8C'], bg: '#F6ECF2', icon: 'book-outline', kicker: 'YOUR THOUGHTS, YOUR WEEK' },
  brain: { colors: ['#17133A', '#46307E'], bg: '#ECE8F6', icon: 'bulb-outline', kicker: 'EVERYTHING TALI KNOWS' },
};

const SkinCtx = createContext<Skin | null>(null);
export const useSkin = () => useContext(SkinCtx);
export function SkinProvider({ id, children }: { id?: SkinId; children: ReactNode }) {
  return <SkinCtx.Provider value={id ? SKINS[id] : null}>{children}</SkinCtx.Provider>;
}

export function SkinHeader({ id, title, sub, onBack, backLabel = 'Back' }: { id: SkinId; title: string; sub?: string; onBack?: () => void; backLabel?: string }) {
  const t = SKINS[id];
  return (
    <View style={{ marginHorizontal: -16, marginTop: -16, marginBottom: 16 }}>
      <LinearGradient colors={t.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 26, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', right: -30, top: -20, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)' }} />
        <View style={{ position: 'absolute', right: 40, bottom: -50, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)' }} />
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button">
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '700' }}>{'\u2039'} {backLabel}</Text>
          </Pressable>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: onBack ? 18 : 4 }}>
          <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={t.icon} size={28} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{t.kicker}</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginTop: 2 }}>{title}</Text>
          </View>
        </View>
        {sub ? <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 14, lineHeight: 20, marginTop: 12 }}>{sub}</Text> : null}
      </LinearGradient>
    </View>
  );
}
