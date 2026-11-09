// How Tali thinks (9 Nov 2026, Tali's Tuesday list item 8). Each part of her brain, the AI it uses
// today and the one planned for it in the 7 Nov plan (claude/Tali_Brain_AI_Map.md). Nothing here
// switches anything on: it shows the plan beside what is live, so Taj can approve it part by part.
// Founder only until the new AIs are connected and the router picks per job.
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { NightBackground, night } from '@/components/NightSky';
import { BackLink } from '@/components/ui';
import { REGIONS, type RegionId } from '@/lib/brain';
import { NO_BOTTOM, radius, space } from '@/constants/theme';

type Part = { id: RegionId; job: string; now: string; planned: string; where: string };

// What is live comes from the edge functions (tali-chat, tali-image, tali-voice, tali-brain-embed).
const PARTS: Part[] = [
  { id: 'thalamus', job: 'The router: picks the AI for each job', now: 'Fixed per screen', planned: 'Claude Haiku 5.5', where: 'Included' },
  { id: 'frontal', job: 'Judgement and rules', now: 'Claude Haiku 5.5', planned: 'Claude Haiku 5.5', where: 'Included' },
  { id: 'prefrontal', job: 'Planning, and a second opinion', now: 'Deep think (Sonnet), Big brain (Opus)', planned: 'Adds GPT-5.4 second opinion', where: 'Pro, or Deep think credits' },
  { id: 'occipital', job: 'Seeing photos, screenshots and video', now: 'Claude vision, images by gpt-image-2', planned: 'Gemini 3 Flash', where: 'HQ and Pro, monthly cap' },
  { id: 'temporal', job: 'Her voice, and hearing yours', now: 'Kokoro voice (Pro)', planned: 'ElevenLabs Flash and Scribe', where: 'Voice add-on' },
  { id: 'hippocampus', job: 'Finding memories by meaning', now: 'gte-small', planned: 'Voyage 4 with rerank', where: 'Included' },
  { id: 'brainstem', job: 'Keeping every memory searchable', now: 'gte-small', planned: 'Voyage 4', where: 'Included' },
  { id: 'cerebellum', job: 'Checking her own work', now: 'Claude Sonnet (weekly review)', planned: 'GPT-5.4 nano checker', where: 'Included' },
  { id: 'amygdala', job: 'Safety and urgency', now: 'Claude Haiku triage', planned: 'Adds OpenAI moderation', where: 'Included' },
  { id: 'corpus_callosum', job: 'Research and the shared brain', now: 'Anthropic web search, Opus brain share', planned: 'Perplexity Sonar, Mistral OCR', where: 'Included' },
  { id: 'hypothalamus', job: 'Her schedule', now: 'Scheduled jobs', planned: 'Anthropic batch API (half price)', where: 'Included' },
  { id: 'basal_ganglia', job: 'Skills and routines', now: 'Claude Sonnet', planned: 'Claude computer use', where: 'Pro add-on, later' },
  { id: 'parietal', job: 'Her senses: your connected apps', now: 'Gmail, Calendar, Outlook, Stripe', planned: 'Adds Metricool, Meta ad library, GA4, Sentry, Basiq', where: 'Read only first; bank feeds later' },
];

export default function BrainAi() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#17133A' }} edges={NO_BOTTOM}>
      <NightBackground />
      <ScrollView contentContainerStyle={{ padding: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
        <BackLink onPress={() => router.navigate('/brain')} />
        <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>How Tali thinks</Text>
        <Text style={{ color: night.muted, fontSize: 15, lineHeight: 22, marginTop: space.sm }}>
          Each part of her brain gets the AI that's best at its job. The thalamus will read each thing you ask and send it to the right part. Below is what each part uses now, and what's planned.
        </Text>
        <View style={{ gap: space.sm, marginTop: space.lg }}>
          {PARTS.map((p) => (
            <View key={p.id} style={{ backgroundColor: night.glass, borderWidth: 1, borderColor: night.line, borderLeftWidth: 3, borderLeftColor: REGIONS[p.id].colour, borderRadius: radius.card - 4, padding: space.md, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: REGIONS[p.id].colour }} />
                <Text style={{ flex: 1, color: '#fff', fontSize: 15, fontWeight: '800' }}>{REGIONS[p.id].name}</Text>
                <Text style={{ color: night.faint, fontSize: 11, fontWeight: '800' }}>{p.where}</Text>
              </View>
              <Text style={{ color: night.muted, fontSize: 13 }}>{p.job}</Text>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: night.faint, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 }}>NOW</Text>
                  <Text style={{ color: night.ink, fontSize: 13, lineHeight: 18 }}>{p.now}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: night.accent, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 }}>PLANNED</Text>
                  <Text style={{ color: '#fff', fontSize: 13, lineHeight: 18, fontWeight: '700' }}>{p.planned}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
        <View style={{ height: space.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}
