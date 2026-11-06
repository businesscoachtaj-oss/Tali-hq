// Top up credits (6 Nov 2026, asked for by Taj). Buy a pack of extra credits when the month runs
// short. Extra credits never expire and are used after the monthly ones. Paid by card through Stripe.
// MOCKUP: packs and prices are suggestions; checkout is wired up once Taj approves.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Label, Screen, goBack } from '@/components/ui';
import { SkinHeader } from '@/components/PageSkin';
import { colours, elevation, radius, space } from '@/constants/theme';
import { myCredits, type Credits } from '@/lib/data';
import { isPro } from '@/lib/plan';

const PACKS = [
  { id: 'p500', credits: 500, price: 9.99, note: 'About 500 chats' },
  { id: 'p1500', credits: 1500, price: 24.99, note: 'About 1,500 chats', best: true },
  { id: 'p5000', credits: 5000, price: 69.99, note: 'For a big month' },
];

export default function TopUp() {
  const [credits, setCredits] = useState<Credits | null>(null);
  const [pick, setPick] = useState('p1500');
  useFocusEffect(useCallback(() => { myCredits().then(setCredits).catch(() => null); }, []));
  const left = credits ? Math.max(0, credits.creditsMonth - credits.used) : 0;
  const extra = (credits as any)?.extra ?? 0;
  const chosen = PACKS.find((p) => p.id === pick)!;
  const pro = isPro(credits);

  return (
    <Screen skin="topup">
      <SkinHeader id="topup" title="Top up credits" sub="Ran short this month? Add a pack. Extra credits never expire." onBack={() => goBack('/me')} backLabel="Back" />

      <Card>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colours.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 }}>THIS MONTH</Text>
            <Text style={{ color: colours.text, fontSize: 26, fontWeight: '800', marginTop: 2 }}>{left.toLocaleString('en-AU')}</Text>
            <Text style={{ color: colours.muted, fontSize: 12.5 }}>of {credits?.creditsMonth.toLocaleString('en-AU') ?? '...'} left</Text>
          </View>
          <View style={{ width: 1, backgroundColor: colours.border }} />
          <View style={{ flex: 1, paddingLeft: space.sm }}>
            <Text style={{ color: colours.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 }}>EXTRA</Text>
            <Text style={{ color: colours.text, fontSize: 26, fontWeight: '800', marginTop: 2 }}>{extra.toLocaleString('en-AU')}</Text>
            <Text style={{ color: colours.muted, fontSize: 12.5 }}>never expire</Text>
          </View>
        </View>
        <Text style={{ color: colours.faint, fontSize: 12, marginTop: space.md, lineHeight: 17 }}>Tali uses your monthly credits first, then the extras. A normal message is 1 credit.</Text>
      </Card>

      <View style={{ height: space.md }} />
      <Label>Pick a pack</Label>
      <View style={{ gap: space.sm }}>
        {PACKS.map((p) => {
          const on = p.id === pick;
          return (
            <Pressable key={p.id} onPress={() => setPick(p.id)} accessibilityRole="radio" accessibilityState={{ selected: on }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.card, backgroundColor: colours.surface, borderWidth: 2, borderColor: on ? colours.purple : colours.border, ...(on ? elevation.card : elevation.lift) }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: on ? colours.purple : colours.border, alignItems: 'center', justifyContent: 'center' }}>
                {on ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colours.purple }} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: colours.text, fontSize: 18, fontWeight: '800' }}>{p.credits.toLocaleString('en-AU')} credits</Text>
                  {p.best ? (
                    <View style={{ backgroundColor: colours.orange, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '800' }}>BEST VALUE</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ color: colours.muted, fontSize: 13, marginTop: 1 }}>{p.note} · {((p.price / p.credits) * 100).toFixed(1)}c each</Text>
              </View>
              <Text style={{ color: colours.text, fontSize: 18, fontWeight: '800' }}>${p.price.toFixed(2)}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable accessibilityRole="button" style={{ marginTop: space.lg, height: 54, borderRadius: radius.pill, backgroundColor: colours.purple, alignItems: 'center', justifyContent: 'center', ...elevation.button(colours.purple) }}>
        <Text style={{ color: colours.onPurple, fontWeight: '800', fontSize: 16 }}>Buy {chosen.credits.toLocaleString('en-AU')} credits for ${chosen.price.toFixed(2)}</Text>
      </Pressable>
      <Text style={{ color: colours.faint, fontSize: 12, textAlign: 'center', marginTop: 8 }}>Paid by card through Stripe. One payment, not a subscription.</Text>

      {!pro ? (
        <Pressable onPress={() => router.navigate('/plans')} accessibilityRole="button">
          <Card style={{ marginTop: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colours.purpleSoft }}>
            <Ionicons name="trending-up-outline" size={22} color={colours.purple} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colours.text, fontWeight: '800', fontSize: 15 }}>Running short most months?</Text>
              <Text style={{ color: colours.muted, fontSize: 13, marginTop: 2, lineHeight: 18 }}>Pro gives you 3,000 credits every month for $39.99, about 1.3c each.</Text>
            </View>
            <Text style={{ color: colours.purple, fontSize: 20 }}>{'›'}</Text>
          </Card>
        </Pressable>
      ) : null}
      <View style={{ height: space.xl }} />
    </Screen>
  );
}
