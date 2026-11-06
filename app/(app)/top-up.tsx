// Top up credits (6 Nov 2026, asked for by Taj). Buy a pack of extra credits when the month runs
// short. Extra credits never expire and are used after the monthly ones. Paid by card through Stripe.
// MOCKUP: packs and prices are suggestions; checkout is wired up once Taj approves.
import { useCallback, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Label, Screen, goBack } from '@/components/ui';
import { SkinHeader } from '@/components/PageSkin';
import { colours, elevation, radius, space } from '@/constants/theme';
import { myCredits, type Credits } from '@/lib/data';
import { isPro } from '@/lib/plan';

type Pack = { id: string; credits: number; images: number; price: number; title: string; note: string; best?: boolean; save?: string };
const PACKS: Record<'credits' | 'images' | 'bundles', Pack[]> = {
  credits: [
    { id: 'c500', credits: 500, images: 0, price: 9.99, title: '500 credits', note: 'About 500 chats · 2.0c each' },
    { id: 'c1500', credits: 1500, images: 0, price: 24.99, title: '1,500 credits', note: 'About 1,500 chats · 1.7c each', best: true },
    { id: 'c5000', credits: 5000, images: 0, price: 69.99, title: '5,000 credits', note: 'For a big month · 1.4c each' },
  ],
  images: [
    { id: 'i20', credits: 0, images: 20, price: 4.99, title: '20 images', note: 'About 25c each' },
    { id: 'i50', credits: 0, images: 50, price: 9.99, title: '50 images', note: 'About 20c each', best: true },
  ],
  bundles: [
    { id: 'b-busy', credits: 1500, images: 30, price: 29.99, title: 'Busy month', note: '1,500 credits and 30 images', best: true, save: 'Save $5' },
    { id: 'b-big', credits: 5000, images: 100, price: 79.99, title: 'Big month', note: '5,000 credits and 100 images', save: 'Save $10' },
  ],
};
const TABS = [
  { id: 'credits', label: 'Credits' },
  { id: 'images', label: 'Images' },
  { id: 'bundles', label: 'Bundles' },
] as const;

export default function TopUp() {
  const [credits, setCredits] = useState<Credits | null>(null);
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'credits' | 'images' | 'bundles'>(params.tab === 'images' || params.tab === 'bundles' ? params.tab : 'credits');
  const [picks, setPicks] = useState<Record<string, string>>({ credits: 'c1500', images: 'i50', bundles: 'b-busy' });
  useFocusEffect(useCallback(() => { myCredits().then(setCredits).catch(() => null); }, []));
  const left = credits ? Math.max(0, credits.creditsMonth - credits.used) : 0;
  const extra = (credits as any)?.extra ?? 0;
  const imagesLeft = credits?.images?.remaining ?? 0;
  const extraImages = (credits as any)?.images?.extra ?? 0;
  const list = PACKS[tab];
  const pick = picks[tab];
  const chosen = list.find((p) => p.id === pick) ?? list[0];
  const pro = isPro(credits);

  return (
    <Screen skin="topup">
      <SkinHeader id="topup" title="Top up" sub="Ran short this month? Add a pack. Anything extra never expires." onBack={() => goBack('/me')} backLabel="Back" />

      <Card>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colours.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 }}>CREDITS</Text>
            <Text style={{ color: colours.text, fontSize: 26, fontWeight: '800', marginTop: 2 }}>{left.toLocaleString('en-AU')}</Text>
            <Text style={{ color: colours.muted, fontSize: 12.5 }}>left this month{extra ? `, plus ${extra.toLocaleString('en-AU')} extra` : ''}</Text>
          </View>
          <View style={{ width: 1, backgroundColor: colours.border }} />
          <View style={{ flex: 1, paddingLeft: space.sm }}>
            <Text style={{ color: colours.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 }}>IMAGES</Text>
            <Text style={{ color: colours.text, fontSize: 26, fontWeight: '800', marginTop: 2 }}>{imagesLeft.toLocaleString('en-AU')}</Text>
            <Text style={{ color: colours.muted, fontSize: 12.5 }}>left this month{extraImages ? `, plus ${extraImages} extra` : ''}</Text>
          </View>
        </View>
        <Text style={{ color: colours.faint, fontSize: 12, marginTop: space.md, lineHeight: 17 }}>Tali uses this month's first, then the extras. A normal message is 1 credit. Extras never expire and work any month you're on Tali HQ or Pro.</Text>
      </Card>

      <View style={{ height: space.md }} />
      <View style={{ flexDirection: 'row', backgroundColor: colours.sunk, borderRadius: radius.pill, padding: 4, marginBottom: space.md }}>
        {TABS.map((t) => {
          const on = t.id === tab;
          return (
            <Pressable key={t.id} onPress={() => setTab(t.id)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colours.surface : 'transparent', ...(on ? elevation.lift : {}) }}>
              <Text style={{ color: on ? colours.text : colours.muted, fontWeight: '800', fontSize: 14 }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ gap: space.sm }}>
        {list.map((p) => {
          const on = p.id === chosen.id;
          return (
            <Pressable key={p.id} onPress={() => setPicks((x) => ({ ...x, [tab]: p.id }))} accessibilityRole="radio" accessibilityState={{ selected: on }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.card, backgroundColor: colours.surface, borderWidth: 2, borderColor: on ? colours.purple : colours.border, ...(on ? elevation.card : elevation.lift) }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: on ? colours.purple : colours.border, alignItems: 'center', justifyContent: 'center' }}>
                {on ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colours.purple }} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: colours.text, fontSize: 18, fontWeight: '800' }}>{p.title}</Text>
                  {p.best ? (
                    <View style={{ backgroundColor: colours.orange, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '800' }}>{tab === 'bundles' ? 'POPULAR' : 'BEST VALUE'}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ color: colours.muted, fontSize: 13, marginTop: 1 }}>{p.note}</Text>
                {p.save ? <Text style={{ color: colours.good, fontSize: 13, fontWeight: '800', marginTop: 1 }}>{p.save}</Text> : null}
              </View>
              <Text style={{ color: colours.text, fontSize: 18, fontWeight: '800' }}>${p.price.toFixed(2)}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable accessibilityRole="button" style={{ marginTop: space.lg, height: 54, borderRadius: radius.pill, backgroundColor: colours.purple, alignItems: 'center', justifyContent: 'center', ...elevation.button(colours.purple) }}>
        <Text style={{ color: colours.onPurple, fontWeight: '800', fontSize: 16 }}>Buy {chosen.title} for ${chosen.price.toFixed(2)}</Text>
      </Pressable>
      <Text style={{ color: colours.faint, fontSize: 12, textAlign: 'center', marginTop: 8 }}>Paid by card through Stripe. One payment, not a subscription.</Text>

      {!pro ? (
        <Pressable onPress={() => router.navigate('/plans')} accessibilityRole="button">
          <Card style={{ marginTop: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colours.purpleSoft }}>
            <Ionicons name="trending-up-outline" size={22} color={colours.purple} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colours.text, fontWeight: '800', fontSize: 15 }}>Running short most months?</Text>
              <Text style={{ color: colours.muted, fontSize: 13, marginTop: 2, lineHeight: 18 }}>Pro gives you 3,000 credits and 100 images every month for $39.99.</Text>
            </View>
            <Text style={{ color: colours.purple, fontSize: 20 }}>{'›'}</Text>
          </Card>
        </Pressable>
      ) : null}
      <View style={{ height: space.xl }} />
    </Screen>
  );
}
