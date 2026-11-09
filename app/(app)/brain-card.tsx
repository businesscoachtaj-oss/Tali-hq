// Share her brain (10 Nov 2026, asked for by Taj): a card that shows how much Tali knows about you,
// made to be screenshotted or shared. Numbers and the brain only. Nothing she remembers is written on
// it, so there is nothing private to leak.
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Share, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { NightBackground } from '@/components/NightSky';
import { Aurora } from '@/components/Aurora';
import { BrainGlobe } from '@/components/BrainGlobe';
import { myBrain, REGIONS, type Brain, type RegionId } from '@/lib/brain';
import { taliLevel, type Level } from '@/lib/level';
import * as Clipboard from 'expo-clipboard';
import { NO_BOTTOM } from '@/constants/theme';

// The five things people recognise, and the part of her brain each lives in.
const GROUPS: { label: string; region: RegionId }[] = [
  { label: 'people', region: 'temporal' },
  { label: 'facts', region: 'hippocampus' },
  { label: 'plans', region: 'prefrontal' },
  { label: 'habits', region: 'frontal' },
  { label: 'lessons', region: 'cerebellum' },
];

export default function BrainCard() {
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const W = Math.min(width, 480) - 32;
  const [brain, setBrain] = useState<Brain | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [copied, setCopied] = useState(false);
  useFocusEffect(useCallback(() => {
    myBrain('mine').then(setBrain).catch(() => {});
    taliLevel().then(setLevel).catch(() => {});
  }, []));

  const counts: Partial<Record<RegionId, number>> = {};
  brain?.regions.forEach((r) => (counts[r.id] = r.count));
  const total = brain?.total ?? 0;
  const since = profile?.onboarded_at ? new Date(profile.onboarded_at) : null;
  const days = since ? Math.max(1, Math.round((Date.now() - since.getTime()) / 86400000)) : null;
  const name = profile?.first_name?.trim();
  const groups = GROUPS.map((g) => ({ ...g, n: counts[g.region] ?? 0 })).filter((g) => g.n > 0);
  const words = total
    ? `My Tali has learned ${total} ${total === 1 ? 'thing' : 'things'} about me${days ? ` in ${days} ${days === 1 ? 'day' : 'days'}` : ''}. She remembers, so she gets more useful the longer we go. talihq.com.au`
    : 'I just met Tali. She remembers what I tell her, so she gets more useful the longer we go. talihq.com.au';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#07061A' }} edges={NO_BOTTOM}>
      <NightBackground />
      <Aurora />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, alignItems: 'center' }}>
        <Pressable onPress={() => router.navigate('/me')} accessibilityRole="button" style={{ alignSelf: 'flex-start', marginBottom: 12 }}>
          <Text style={{ color: '#B9A6FF', fontSize: 15, fontWeight: '700' }}>{'‹'} Me</Text>
        </Pressable>

        {/* The card. Kept to one clean block so a screenshot crops neatly. */}
        <View style={{ width: W, borderRadius: 28, overflow: 'hidden', backgroundColor: '#0C0A24', borderWidth: 1, borderColor: 'rgba(214,200,255,0.5)', shadowColor: '#7A4DFF', shadowOpacity: 0.8, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } }}>
          <NightBackground />
          <View style={{ padding: 22, paddingBottom: 0 }}>
            <Text style={{ color: '#B9A6FF', fontSize: 11, fontWeight: '800', letterSpacing: 2.5 }}>TALI HQ</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 36, lineHeight: 40, marginTop: 8, fontFamily: 'InstrumentSerif_400Regular', textShadowColor: 'rgba(185,166,255,0.8)', textShadowRadius: 18 }}>
              {name ? `${name}'s Tali` : 'My Tali'}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15, marginTop: 4 }}>
              {days ? `Day ${days}. ` : ''}{total ? `${total} ${total === 1 ? 'memory' : 'memories'} and growing.` : 'Her brain is just getting started.'}
            </Text>
          </View>
          <View style={{ alignItems: 'center', marginTop: 4 }} pointerEvents="none">
            <BrainGlobe size={Math.min(W - 20, 320)} counts={counts as any} links={brain?.links ?? []} selected={null} onSelect={() => {}} />
          </View>
          {groups.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, paddingHorizontal: 16 }}>
              {groups.map((g) => (
                <View key={g.label} style={{ alignItems: 'center', minWidth: 58 }}>
                  <Text style={{ color: REGIONS[g.region].colour, fontSize: 24, fontWeight: '800', textShadowColor: REGIONS[g.region].colour, textShadowRadius: 10 }}>{g.n}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700' }}>{g.label}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 22, paddingTop: 20 }}>
            {level ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#F6A02C', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#141033', fontSize: 16, fontWeight: '800' }}>{level.level}</Text>
                </View>
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>{level.name}</Text>
              </View>
            ) : <View />}
            <Text style={{ color: '#B9A6FF', fontSize: 13, fontWeight: '800' }}>talihq.com.au</Text>
          </View>
        </View>

        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center', marginTop: 18, lineHeight: 19, maxWidth: 340 }}>
          Only numbers are on the card. Nothing she remembers about you is shown. Screenshot it to post it, or share the words.
        </Text>
        <Pressable onPress={() => {
          // Where there is no share sheet (a desktop browser), copy the words instead.
          Share.share({ message: words }).catch(async () => { await Clipboard.setStringAsync(words).catch(() => {}); setCopied(true); });
        }} accessibilityRole="button"
          style={{ marginTop: 14, backgroundColor: '#B9A6FF', borderRadius: 999, paddingVertical: 14, paddingHorizontal: 28, shadowColor: '#B9A6FF', shadowOpacity: 0.8, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } }}>
          <Text style={{ color: '#141033', fontWeight: '800', fontSize: 16 }}>{copied ? 'Copied the words' : 'Share'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
