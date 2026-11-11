// Top up credits (6 Nov 2026, asked for by Taj). Buy a pack of extra credits when the month runs
// short, or images, or a bundle of both. Extras never expire and are used after the month's own.
// Paid by card through Stripe Checkout (create-checkout with { topup }); stripe-webhook adds them.
// The prices charged come from supabase/functions/_shared/topups.ts; keep the two lists the same.
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, ErrorText, Screen, goBack } from '@/components/ui';
import { SkinHeader } from '@/components/PageSkin';
import { colours, elevation, radius, space } from '@/constants/theme';
import { myCredits, startTopup, type Credits } from '@/lib/data';
import { isPaid, isPro } from '@/lib/plan';
import { VOICE_ADDON } from '@/lib/brainAiPlan';

// Tali's voice is not on sale yet (10 Nov 2026): it shows on Plans as Coming soon. Flip this once the
// add-on can really be bought and the minutes are counted server side.
const VOICE_FOR_SALE = false;

const APP_WEB_URL = 'https://talihq.com.au';

type Pack = { id: string; credits: number; images: number; price: number; title: string; note: string; best?: boolean; save?: string; monthly?: boolean };
type TabId = 'credits' | 'images' | 'bundles' | 'voice';
const PACKS: Record<TabId, Pack[]> = {
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
    { id: 'b-busy', credits: 1500, images: 30, price: 29.99, title: 'Busy month', note: '1,500 credits and 30 images', best: true, save: 'Save A$5' },
    { id: 'b-big', credits: 5000, images: 100, price: 79.99, title: 'Big month', note: '5,000 credits and 100 images', save: 'Save A$10' },
  ],
  // Planned (9 Nov 2026 mockups). Not in _shared/topups.ts or Stripe yet.
  voice: [
    { id: 'v-addon', credits: 0, images: 0, price: VOICE_ADDON.price, title: "Tali's voice", note: `${VOICE_ADDON.speakMinutes} min of her voice and ${VOICE_ADDON.listenHours} hrs of listening, every month`, best: true, monthly: true },
    { id: 'v-pack', credits: 0, images: 0, price: VOICE_ADDON.packPrice, title: `${VOICE_ADDON.packMinutes} more minutes`, note: 'For a chatty month. Never expires.' },
  ],
};
const TABS = [
  { id: 'credits', label: 'Credits' },
  { id: 'images', label: 'Images' },
  { id: 'bundles', label: 'Bundles' },
  ...(VOICE_FOR_SALE ? [{ id: 'voice', label: 'Voice' }] as const : []),
] as const;

export default function TopUp() {
  const [credits, setCredits] = useState<Credits | null>(null);
  const params = useLocalSearchParams<{ tab?: string; done?: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const done = Array.isArray(params.done) ? params.done[0] : params.done;
  const [tab, setTab] = useState<TabId>(params.tab === 'images' || params.tab === 'bundles' || params.tab === 'voice' ? params.tab : 'credits');
  const [picks, setPicks] = useState<Record<string, string>>({ credits: 'c1500', images: 'i50', bundles: 'b-busy', voice: 'v-addon' });
  const load = useCallback(() => { myCredits().then(setCredits).catch(() => null); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const left = credits ? Math.max(0, credits.creditsMonth - credits.used) : 0;
  const extra = credits?.extra ?? 0;
  const imagesLeft = credits?.images?.remaining ?? 0;
  const extraImages = credits?.images?.extra ?? 0;
  const list = PACKS[tab];
  const pick = picks[tab];
  const chosen = list.find((p) => p.id === pick) ?? list[0];
  const pro = isPro(credits);
  const paid = isPaid(credits);

  async function buy() {
    setBusy(true);
    setError('');
    const web = Platform.OS === 'web';
    const res = await startTopup(chosen.id, web ? `${window.location.origin}/top-up` : `${APP_WEB_URL}/top-up`);
    setBusy(false);
    if (!res.ok || !res.url) return setError(res.message ?? 'Could not start checkout.');
    web ? window.location.assign(res.url) : Linking.openURL(res.url);
  }

  return (
    <Screen skin="topup" onRefresh={async () => load()}>
      <SkinHeader id="topup" title="Top up" sub="Ran short this month? Add a pack. Anything extra never expires." onBack={() => goBack('/me')} backLabel="Back" />

      {done ? (
        <Card style={{ backgroundColor: '#E3F3E9', marginBottom: space.md }}>
          <Text style={{ color: '#1E6B3E', fontWeight: '800', fontSize: 15 }}>Thanks, that's paid.</Text>
          <Text style={{ color: '#1E6B3E', fontSize: 13, marginTop: 2 }}>Your extras land in a few seconds. Pull down to refresh if they're not showing yet.</Text>
        </Card>
      ) : null}
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
          {VOICE_FOR_SALE ? (
            <>
              <View style={{ width: 1, backgroundColor: colours.border }} />
              <View style={{ flex: 1, paddingLeft: space.sm }}>
                <Text style={{ color: colours.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 }}>VOICE</Text>
                <Text style={{ color: colours.text, fontSize: 26, fontWeight: '800', marginTop: 2 }}>14</Text>
                <Text style={{ color: colours.muted, fontSize: 12.5 }}>minutes left this month</Text>
              </View>
            </>
          ) : null}
        </View>
        <Text style={{ color: colours.faint, fontSize: 12, marginTop: space.md, lineHeight: 17 }}>Tali uses this month's first, then the extras. A normal message is 1 credit. Extras never expire and work any month you're on a paid plan.</Text>
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
      {tab === 'voice' ? (
        <Text style={{ color: colours.muted, fontSize: 13, lineHeight: 19, marginBottom: space.sm }}>Tali reads her replies out loud in a natural voice, and you can talk to her instead of typing. Voice is the dearest AI she uses, so it's an add-on rather than part of the plan.</Text>
      ) : null}
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
                      <Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '800' }}>{tab === 'bundles' ? 'POPULAR' : tab === 'voice' ? 'ADD-ON' : 'BEST VALUE'}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ color: colours.muted, fontSize: 13, marginTop: 1 }}>{p.note}</Text>
                {p.save ? <Text style={{ color: colours.good, fontSize: 13, fontWeight: '800', marginTop: 1 }}>{p.save}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colours.text, fontSize: 18, fontWeight: '800' }}>A${p.price.toFixed(2)}</Text>
                {p.monthly ? <Text style={{ color: colours.muted, fontSize: 11.5 }}>a month</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <ErrorText>{error}</ErrorText>
      {credits && !paid ? <Text style={{ color: colours.muted, fontSize: 13, marginTop: space.md, textAlign: 'center' }}>Top ups are for the paid plans. Pick a plan first.</Text> : null}
      <Pressable onPress={buy} disabled={busy || !paid} accessibilityRole="button" style={{ opacity: busy || !paid ? 0.6 : 1, marginTop: space.lg, height: 54, borderRadius: radius.pill, backgroundColor: colours.purple, alignItems: 'center', justifyContent: 'center', ...elevation.button(colours.purple) }}>
        {busy ? <ActivityIndicator color={colours.onPurple} /> : <Text style={{ color: colours.onPurple, fontWeight: '800', fontSize: 16 }}>{chosen.monthly ? `Add ${chosen.title} for A$${chosen.price.toFixed(2)} a month` : `Buy ${chosen.title} for A$${chosen.price.toFixed(2)}`}</Text>}
      </Pressable>
      <Text style={{ color: colours.faint, fontSize: 12, textAlign: 'center', marginTop: 8 }}>Paid by card through Stripe. {chosen.monthly ? 'Added to your plan. Cancel any time in Manage billing.' : 'One payment, not a subscription.'}</Text>

      {!pro ? (
        <Pressable onPress={() => router.navigate('/plans')} accessibilityRole="button">
          <Card style={{ marginTop: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colours.purpleSoft }}>
            <Ionicons name="trending-up-outline" size={22} color={colours.purple} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colours.text, fontWeight: '800', fontSize: 15 }}>Running short most months?</Text>
              <Text style={{ color: colours.muted, fontSize: 13, marginTop: 2, lineHeight: 18 }}>Pro gives you 3,000 credits and 100 images every month for A$49.99.</Text>
            </View>
            <Text style={{ color: colours.purple, fontSize: 20 }}>{'›'}</Text>
          </Card>
        </Pressable>
      ) : null}
      <View style={{ height: space.xl }} />
    </Screen>
  );
}
