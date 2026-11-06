// An idea from night school (6 Nov 2026, asked for by Taj). One useful idea from what Tali studied,
// on Today, so night school turns into something you do. "Let's try it" opens Talk with the idea
// ready to plan; "Not for me" hides it and she learns what you don't want.
import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { night } from '@/components/NightSky';
import { radius, space } from '@/constants/theme';
import { answerNightIdea, nightIdea, type NightIdea } from '@/lib/grow';

export function NightIdeaCard() {
  const [idea, setIdea] = useState<NightIdea | null>(null);
  useEffect(() => {
    nightIdea().then(setIdea).catch(() => setIdea(null));
  }, []);
  if (!idea) return null;

  const tryIt = async () => {
    await answerNightIdea(idea.id, 'try');
    setIdea(null);
    router.navigate({ pathname: '/talk', params: { ask: `Let's try this idea from night school: ${idea.idea} Help me get started.` } });
  };
  const skip = async () => {
    await answerNightIdea(idea.id, 'skip');
    setIdea(null);
  };

  return (
    <View style={{ borderRadius: radius.card, overflow: 'hidden', marginBottom: space.md }}>
      <LinearGradient colors={['#2A1F4F', '#1B2450']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: space.md }}>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: night.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>AN IDEA FROM NIGHT SCHOOL</Text>
            <Text style={{ color: night.faint, fontSize: 12, marginTop: 2 }}>Last night I studied: {idea.topic}</Text>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800', lineHeight: 23, marginTop: space.sm }}>{idea.idea}</Text>
            <Text style={{ color: night.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }}>{idea.why}</Text>
          </View>
          <Image source={require('@/assets/tali/tali_think.png')} style={{ width: 54, height: 80 }} resizeMode="contain" />
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md, alignItems: 'center' }}>
          <Pressable onPress={tryIt} accessibilityRole="button" style={{ flex: 1, height: 44, borderRadius: radius.pill, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            <LinearGradient colors={[night.accent, night.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
            <Text style={{ color: '#141033', fontWeight: '800', fontSize: 15 }}>Let's try it</Text>
          </Pressable>
          <Pressable onPress={skip} accessibilityRole="button" style={{ paddingHorizontal: 14, height: 44, justifyContent: 'center' }}>
            <Text style={{ color: night.muted, fontWeight: '700' }}>Not for me</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}
