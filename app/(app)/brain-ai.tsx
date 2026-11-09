// How Tali thinks (9 Nov 2026). Each part of her brain, the AI it runs on and what it costs you, then
// the router's recent picks: which part and which AI handled each thing you asked. Planned (the 9 Nov
// mockups, claude/Tali_Brain_AI_Map.md): behind BRAIN_AI_PREVIEW, the picks are sample data until the
// router logs them. Before the preview it was founder only and showed now beside planned.
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { FOUNDER_USER_ID } from '@/constants/business';
import { NightBackground, night } from '@/components/NightSky';
import { BackLink } from '@/components/ui';
import { REGIONS } from '@/lib/brain';
import { PART_AI, SAMPLE_PICKS } from '@/lib/brainAiPlan';
import { NO_BOTTOM, radius, space } from '@/constants/theme';

const label = { color: night.faint, fontSize: 11, fontWeight: '800' as const, letterSpacing: 0.9 };

export default function BrainAi() {
  // Founder only: this names the AIs behind her brain, which is company information.
  const { session } = useAuth();
  if (session?.user.id !== FOUNDER_USER_ID) return <Redirect href="/brain" />;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#17133A' }} edges={NO_BOTTOM}>
      <NightBackground />
      <ScrollView contentContainerStyle={{ padding: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
        <BackLink onPress={() => router.navigate('/brain')} />
        <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>How Tali thinks</Text>
        <Text style={{ color: night.muted, fontSize: 15, lineHeight: 22, marginTop: space.sm }}>
          Her thalamus reads everything you ask and sends it to the part of her brain that's best at it. Each part runs on the AI that's best at that job.
        </Text>

        <Text style={{ ...label, marginTop: space.lg, marginBottom: space.sm }}>TODAY, WHO HANDLED WHAT</Text>
        <View style={{ backgroundColor: night.glass, borderWidth: 1, borderColor: night.line, borderRadius: radius.card - 4 }}>
          {SAMPLE_PICKS.map((p, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, padding: space.md, borderTopWidth: i ? 1 : 0, borderTopColor: night.line }}>
              <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: REGIONS[p.part].colour, marginTop: 5 }} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 19 }}>{p.ask}</Text>
                <Text style={{ color: night.muted, fontSize: 12.5 }}>
                  <Text style={{ color: REGIONS[p.part].colour, fontWeight: '800' }}>{REGIONS[p.part].name}</Text> · {p.ai}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{p.credits ? `${p.credits} cr` : 'Add-on'}</Text>
                <Text style={{ color: night.faint, fontSize: 11 }}>{p.when}</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={{ color: night.faint, fontSize: 12, lineHeight: 17, marginTop: 6 }}>59 credits today. A normal chat is 1 credit; another AI joining in costs more, and Tali tells you before it does.</Text>

        <Text style={{ ...label, marginTop: space.lg, marginBottom: space.sm }}>EACH PART AND ITS AI</Text>
        <View style={{ gap: space.sm }}>
          {PART_AI.map((p) => {
            const changed = p.was !== p.ai && p.was !== 'Same';
            return (
              <View key={p.id} style={{ backgroundColor: night.glass, borderWidth: 1, borderColor: night.line, borderLeftWidth: 3, borderLeftColor: REGIONS[p.id].colour, borderRadius: radius.card - 4, padding: space.md, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ flex: 1, color: '#fff', fontSize: 15, fontWeight: '800' }}>{REGIONS[p.id].name}</Text>
                  {changed ? (
                    <View style={{ backgroundColor: 'rgba(185,166,255,0.18)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ color: night.accent, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 }}>NEW</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ color: night.muted, fontSize: 13 }}>{p.job}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginTop: 2 }}>
                  <Text style={{ flex: 1, color: '#fff', fontSize: 14, fontWeight: '700' }}>{p.ai}</Text>
                  <Text style={{ color: night.accent, fontSize: 12, fontWeight: '800', textAlign: 'right', maxWidth: 140 }}>{p.cost}</Text>
                </View>
                {changed ? <Text style={{ color: night.faint, fontSize: 11.5 }}>Was {p.was}</Text> : null}
              </View>
            );
          })}
        </View>
        <View style={{ height: space.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}
