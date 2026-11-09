import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { myCredits, mySubscription, openBillingPortal, plans as loadPlans, startCheckout, type Credits, type Plan } from '@/lib/data';
import { BackLink, Button, Card, ErrorText, Screen, Title, goBack } from '@/components/ui';
import { SkinHeader } from '@/components/PageSkin';
import { colours, radius, space } from '@/constants/theme';
import { BRAIN_AI_PREVIEW, COST, VOICE_ADDON } from '@/lib/brainAiPlan';

const APP_WEB_URL = 'https://talihq.com.au';

const FOUNDING_OFF = 0.425; // founding members: 42.5% off for life

const money = (n: number) => `A$${n.toFixed(2)}`;

export default function Plans() {
  const [list, setList] = useState<Plan[]>([]);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [sub, setSub] = useState<Awaited<ReturnType<typeof mySubscription>>>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [yearly, setYearly] = useState(false);
  // So the screen isn't blank cards and no buttons while plans load (4 Nov 2026).
  const [loaded, setLoaded] = useState(false);
  const web = Platform.OS === 'web';

  const load = useCallback(async () => {
    try {
      const [p, c, s] = await Promise.all([loadPlans(), myCredits(), mySubscription()]);
      setList(p);
      setCredits(c);
      setSub(s);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load plans.');
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Paying means a real Stripe subscription. A customer id alone is not enough: checkout creates the
  // customer before payment, so someone who backs out of checkout would lose the Choose buttons and
  // land on an empty Manage billing page (5 Nov 2026). Same rule as create-checkout.
  const paying = !!sub?.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(sub.status);
  const founding = !!sub?.founding_member;

  // Phones open Stripe in the browser, the same way Totality does (3 Nov 2026). Stripe sends them
  // back to the web app afterwards; the plan updates here next time this screen is opened.
  const returnUrl = web ? window.location.href : `${APP_WEB_URL}/plans`;
  const open = (url: string) => (web ? window.location.assign(url) : Linking.openURL(url));

  async function go(plan: 'hq' | 'pro') {
    setError('');
    setBusy(plan);
    const res = await startCheckout(plan, returnUrl, yearly ? 'year' : 'month');
    setBusy(null);
    if (res.ok && res.url) open(res.url);
    else setError(res.message ?? 'Could not start checkout.');
  }

  async function manage() {
    setError('');
    setBusy('portal');
    const res = await openBillingPortal(returnUrl);
    setBusy(null);
    if (res.ok && res.url) open(res.url);
    else setError(res.message ?? 'Could not open billing.');
  }

  return (
    <Screen skin="plans" onRefresh={load}>
      <SkinHeader id="plans" title="Plans" sub={founding ? 'You are a founding member: 42.5% off Tali HQ and Pro for as long as you stay.' : 'Start free. Upgrade when Tali is pulling her weight.'} onBack={() => goBack('/me')} />

      <View style={{ flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: colours.sunk, borderRadius: radius.pill, padding: 4, gap: 4, marginBottom: space.sm }}>
        {([false, true] as const).map((y) => (
          <Pressable
            key={String(y)}
            onPress={() => setYearly(y)}
            accessibilityRole="button"
            accessibilityState={{ selected: yearly === y }}
            style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: yearly === y ? colours.purple : 'transparent' }}
          >
            <Text style={{ fontWeight: '700', fontSize: 14, color: yearly === y ? '#FFFFFF' : colours.text }}>{y ? 'Yearly, save 15%' : 'Monthly'}</Text>
          </Pressable>
        ))}
      </View>

      {!loaded ? <ActivityIndicator color={colours.purple} style={{ marginVertical: space.xl }} /> : null}
      {list.map((p) => {
        const current = credits?.plan === p.id && (p.id !== 'hq' || credits?.status !== 'trialing');
        const trialHere = p.id === 'hq' && credits?.status === 'trialing';
        // Matches create-checkout: Stripe waits for the trial end only when 48 hours or more are left.
        const trialEnd = trialHere && credits?.trialEndsAt ? new Date(credits.trialEndsAt) : null;
        const deferred = !!trialEnd && trialEnd.getTime() - Date.now() >= 48 * 3600 * 1000 + 10 * 60 * 1000;
        const yearPrice = yearly && p.yearly_price_aud ? p.yearly_price_aud : null;
        const full = yearPrice ?? p.monthly_price_aud;
        const price = founding && full > 0 ? full * (1 - FOUNDING_OFF) : full;
        const per = yearPrice ? 'a year' : 'a month';
        return (
          <Card key={p.id} style={p.id === 'hq' ? { borderColor: colours.purple, borderWidth: 2 } : undefined}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 19, fontWeight: '800', color: colours.text }}>{p.name}</Text>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colours.text }}>
                {p.monthly_price_aud === 0 ? 'Free' : `${money(price)} ${per}`}
              </Text>
            </View>
            {founding && full > 0 ? (
              <Text style={{ color: colours.muted, fontSize: 13, textDecorationLine: 'line-through' }}>{money(full)} {per}</Text>
            ) : null}
            {yearPrice ? (
              <Text style={{ color: colours.muted, fontSize: 13 }}>
                Works out at {money(price / 12)} a month, billed yearly. 15% less than paying monthly.
              </Text>
            ) : null}
            {(current || trialHere) ? (
              <View style={{ alignSelf: 'flex-start', backgroundColor: colours.purpleSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, marginTop: 6 }}>
                <Text style={{ color: colours.purpleInk, fontWeight: '700', fontSize: 12 }}>{trialHere ? 'Your free trial' : 'Your plan'}</Text>
              </View>
            ) : null}
            <View style={{ marginTop: space.sm, gap: 4 }}>
              {p.features.map((f) => (
                <Text key={f} style={{ fontSize: 14, color: colours.text, lineHeight: 20 }}>
                  {'✓'} {f}
                </Text>
              ))}
            </View>
            {p.id !== 'free' && !paying ? (
              <Button title={trialHere ? `Keep ${p.name} after my trial` : `Choose ${p.name}`} onPress={() => go(p.id as 'hq' | 'pro')} busy={busy === p.id} disabled={!!busy} kind={p.id === 'hq' ? 'primary' : 'ghost'} />
            ) : null}
            {/* Paying HQ members switch plans through Stripe's portal, so point them there rather than a second checkout (4 Nov 2026). */}
            {p.id === 'pro' && paying && credits?.plan === 'hq' ? (
              <>
                <Text style={{ color: colours.muted, fontSize: 13, marginTop: space.sm, lineHeight: 19 }}>
                  You're on Tali HQ. Switching to Pro happens in Manage billing, where your card already is.
                </Text>
                <Button title="Switch to Pro in Manage billing" kind="ghost" onPress={manage} busy={busy === 'portal'} disabled={!!busy} />
              </>
            ) : null}
            {trialHere && !paying && trialEnd ? (
              <Text style={{ color: colours.muted, fontSize: 13, marginTop: 6 }}>
                {deferred
                  ? `You won't be charged until ${trialEnd.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}.`
                  : 'Your trial ends within 2 days, so billing starts today.'}
              </Text>
            ) : null}
          </Card>
        );
      })}

      {BRAIN_AI_PREVIEW ? <ExtrasCard /> : null}

      <ErrorText>{error}</ErrorText>
      {paying ? <Button title="Manage billing" onPress={manage} busy={busy === 'portal'} /> : null}
      <Text style={{ color: colours.faint, fontSize: 12, marginTop: space.md, lineHeight: 18 }}>
        Prices in Australian dollars. Cancel any time from Manage billing. Credits reset each month, on yearly plans too.
      </Text>
    </Screen>
  );
}

// Planned (9 Nov 2026 mockups): the new AIs each cost us per use, so they come out of credits on every
// plan rather than being included. Voice is its own add-on because it costs the most.
const EXTRAS: { icon: string; name: string; what: string; cost: string }[] = [
  { icon: '🎬', name: 'Watch a video', what: 'Screen recordings, ads, walkthroughs. Gemini watches, Tali explains.', cost: `${COST.videoPerMinute} credits a minute` },
  { icon: '⚖️', name: 'Second opinion', what: 'GPT-5.4 checks her answer and says where it would change it.', cost: `${COST.secondOpinion} credits` },
  { icon: '🔎', name: 'Live web answers', what: 'Looks it up now, with sources you can tap.', cost: `${COST.webSearch} credits a search` },
  { icon: '🧠', name: 'Deep think', what: 'A smarter Tali with more of her memory.', cost: '20 credits' },
  { icon: '🚀', name: 'Big brain (Pro)', what: 'Her strongest thinking, for the big calls.', cost: '40 credits' },
];

function ExtrasCard() {
  return (
    <>
      <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: colours.muted, marginTop: space.lg, marginBottom: space.sm }}>WHAT USES MORE CREDITS</Text>
      <Card>
        <Text style={{ color: colours.muted, fontSize: 13, lineHeight: 19, marginBottom: space.sm }}>A normal message is 1 credit. These bring in another AI, so they use more. Same on every paid plan.</Text>
        {EXTRAS.map((e, i) => (
          <View key={e.name} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colours.border }}>
            <Text style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{e.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '800', color: colours.text }}>{e.name}</Text>
              <Text style={{ fontSize: 12.5, color: colours.muted, lineHeight: 17 }}>{e.what}</Text>
            </View>
            <Text style={{ fontSize: 12.5, fontWeight: '800', color: colours.purpleInk, maxWidth: 92, textAlign: 'right' }}>{e.cost}</Text>
          </View>
        ))}
      </Card>
      <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: colours.muted, marginTop: space.lg, marginBottom: space.sm }}>ADD-ONS</Text>
      <Card style={{ borderColor: colours.purple, borderWidth: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colours.text }}>🎙️ Tali's voice</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text }}>{money(VOICE_ADDON.price)} a month</Text>
        </View>
        <View style={{ marginTop: space.sm, gap: 4 }}>
          {[`She reads her replies out loud: ${VOICE_ADDON.speakMinutes} minutes a month`, `Talk to her hands free: up to ${VOICE_ADDON.listenHours} hours of listening`, `Need more? ${VOICE_ADDON.packMinutes} more minutes for ${money(VOICE_ADDON.packPrice)}`, 'Works with Tali HQ and Pro'].map((f) => (
            <Text key={f} style={{ fontSize: 14, color: colours.text, lineHeight: 20 }}>{'✓'} {f}</Text>
          ))}
        </View>
        <Button title="Add Tali's voice" kind="ghost" onPress={() => {}} />
      </Card>
    </>
  );
}
