// Page themes (6 Nov 2026, Taj): each page off Me gets its own look, like Sleep's night sky. A gradient
// hero with the back link, an icon, the title and a line under it, and a tinted page behind the cards.
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View } from 'react-native';

export type ThemeId = 'nightschool' | 'life' | 'money' | 'goals' | 'decisions';

export const THEMES: Record<ThemeId, { colors: [string, string]; bg: string; icon: React.ComponentProps<typeof Ionicons>['name']; kicker: string }> = {
  nightschool: { colors: ['#1B1340', '#46307E'], bg: '#ECE8F6', icon: 'school-outline', kicker: 'TALI STUDIES WHILE YOU SLEEP' },
  life: { colors: ['#0F6B45', '#3DBB7E'], bg: '#EAF4EE', icon: 'barbell-outline', kicker: 'FOOD, WEIGHT AND TRAINING' },
  money: { colors: ['#0B5F5B', '#2FA898'], bg: '#E8F3F1', icon: 'wallet-outline', kicker: 'YOUR MONTH AT A GLANCE' },
  goals: { colors: ['#B23A0B', '#ED8008'], bg: '#FBEFE2', icon: 'flag-outline', kicker: 'WHAT YOU ARE CHASING' },
  decisions: { colors: ['#7A2E0E', '#D0661C'], bg: '#F8EEE6', icon: 'git-branch-outline', kicker: 'WHAT YOU DECIDED AND WHY' },
};

export function ThemeHero({ theme, title, sub, onBack, backLabel = 'Back' }: { theme: ThemeId; title: string; sub?: string; onBack: () => void; backLabel?: string }) {
  const t = THEMES[theme];
  return (
    <View style={{ marginHorizontal: -16, marginTop: -16, marginBottom: 16 }}>
      <LinearGradient colors={t.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 26, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', right: -30, top: -20, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)' }} />
        <View style={{ position: 'absolute', right: 40, bottom: -50, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)' }} />
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button">
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '700' }}>{'‹'} {backLabel}</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 }}>
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
