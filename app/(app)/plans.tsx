import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { myCredits, mySubscription, openBillingPortal, plans as loadPlans, startCheckout, type Credits, type Plan } from '@/lib/data';
import { BackLink, Button, Card, ErrorText, Screen, Title, goBack } from '@/components/ui';
import { SkinHeader } from '@/components/PageSkin';
import { colours, radius, space } from '@/constants/theme';
import { COST, VOICE_ADDON } from '@/lib/brainAiPlan';
import { useCapabilities, type Capabilities } from '@/lib/capabilities';

const APP_WEB_URL = 'https://talihq.com.au';

const FOUNDING_OFF = 0.425; // founding members: 42.5% off for life

const money = (n: number) => `A$${n.toFixed(2)}`;

// 12 Nov 2026 (Taj): the Business plans. Only what is built is listed. The price charged comes from Stripe.
const BIZ_BLUE = '#7FA8FF';
const BIZ_PRICE = 199.99;
const BIZ_FEATURES = [
  'Everything in Tali HQ Max, with the same 10,000 credits and 300 images a month',
  'Jobs and quotes: quote, job and invoice in one line',
  'Pipeline: who to chase next and what it could be worth',
  'Bookings: your week, and one link your customers book from',
  'Projects: the bigger pieces of work, with their tasks',
  'Website: a simple site hosted for you, written and changed by Tali if you like, with a contact form that lands as a lead',
  'Quote calculator: a hosted page where customers pick what they want and see a rough price',
  'On autopilot: rules that put a nudge on your To do so nothing slips',
  'Bookkeeping pack: a quarter on one page, ready for your accountant',
];
const BIZ_SOON = [
  { name: 'Tali HQ Business Pro', price: 389.99, what: 'For a small team. Seats for your staff, text messages to customers and Tali answering your phone.' },
  { name: 'Tali HQ Business Max', price: 649.99, what: 'For a bigger team or more than one business. More seats, more texts and more call minutes.' },
];

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
  const onBiz = !!credits?.businessTier;

  // Phones open Stripe in the browser, the same way Totality does (3 Nov 2026). Stripe sends them
  // back to the web app afterwards; the plan updates here next time this screen is opened.
  const returnUrl = web ? window.location.href : `${APP_WEB_URL}/plans`;
  const open = (url: string) => (web ? window.location.assign(url) : Linking.openURL(url));

  async function go(plan: 'hq' | 'pro' | 'max' | 'biz') {
    setError('');
    setBusy(plan);
    const res = await startCheckout(plan, returnUrl, plan !== 'biz' && yearly ? 'year' : 'month');
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
      <SkinHeader id="plans" title="Plans" sub={founding ? 'You are a founding member: 42.5% off every paid plan for as long as you stay.' : 'Start free. Upgrade when Tali is pulling her weight.'} onBack={() => goBack('/me')} />

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
        const current = credits?.plan === p.id && (p.id !== 'hq' || credits?.status !== 'trialing') && !(p.id === 'max' && onBiz);
        const trialHere = p.id === 'hq' && credits?.status === 'trialing';
        // Matches create-checkout: Stripe waits for the trial end only when 48 hours or more are left.
        const trialEnd = trialHere && credits?.trialEndsAt ? new Date(credits.trialEndsAt) : null;
        const deferred = !!trialEnd && trialEnd.getTime() - Date.now() >= 48 * 3600 * 1000 + 10 * 60 * 1000;
        const yearPrice = yearly && p.yearly_price_aud ? p.yearly_price_aud : null;
        const full = yearPrice ?? p.monthly_price_aud;
        const price = founding && full > 0 ? full * (1 - FOUNDING_OFF) : full;
        const per = yearPrice ? 'a year' : 'a month';
        return (
          <Card key={p.id} style={p.id === 'hq' ? { borderColor: colours.purple, borderWidth: 2 } : p.id === 'max' ? { borderColor: '#F6A02C', borderWidth: 2, shadowColor: '#F6A02C', shadowOpacity: 0.55, shadowRadius: 22, shadowOffset: { width: 0, height: 0 } } : undefined}>
            {p.id === 'max' ? <Text style={{ color: '#FFC56B', fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginBottom: 4 }}>HER WHOLE BRAIN</Text> : null}
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
              <Button title={trialHere ? `Keep ${p.name} after my trial` : `Choose ${p.name}`} onPress={() => go(p.id as 'hq' | 'pro' | 'max')} busy={busy === p.id} disabled={!!busy} kind={p.id === 'hq' ? 'primary' : 'ghost'} />
            ) : null}
            {/* Paying HQ members switch plans through Stripe's portal, so point them there rather than a second checkout (4 Nov 2026). */}
            {p.id === 'max' && paying && credits?.plan !== 'max' ? (
              <>
                <Text style={{ color: colours.muted, fontSize: 13, marginTop: space.sm, lineHeight: 19 }}>
                  You're on {credits?.plan === 'pro' ? 'Tali HQ Pro' : 'Tali HQ'}. Switching to Max happens in Manage billing, where your card already is.
                </Text>
                <Button title="Switch to Max in Manage billing" kind="ghost" onPress={manage} busy={busy === 'portal'} disabled={!!busy} />
              </>
            ) : null}
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

      {loaded ? (
        <>
          <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: colours.muted, marginTop: space.lg, marginBottom: space.sm }}>FOR YOUR BUSINESS</Text>
          <Card style={{ borderColor: BIZ_BLUE, borderWidth: 2 }}>
            <Text style={{ color: BIZ_BLUE, fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginBottom: 4 }}>THE BUSINESS TOOLS</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 19, fontWeight: '800', color: colours.text }}>Tali HQ Business</Text>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colours.text }}>{money(BIZ_PRICE)} a month</Text>
            </View>
            <Text style={{ color: colours.muted, fontSize: 13 }}>Billed monthly.</Text>
            {onBiz ? (
              <View style={{ alignSelf: 'flex-start', backgroundColor: colours.purpleSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, marginTop: 6 }}>
                <Text style={{ color: colours.purpleInk, fontWeight: '700', fontSize: 12 }}>Your plan</Text>
              </View>
            ) : null}
            <View style={{ marginTop: space.sm, gap: 4 }}>
              {BIZ_FEATURES.map((f) => <Text key={f} style={{ fontSize: 14, color: colours.text, lineHeight: 20 }}>{'✓'} {f}</Text>)}
            </View>
            {!paying ? <Button title="Choose Tali HQ Business" onPress={() => go('biz')} busy={busy === 'biz'} disabled={!!busy} kind="ghost" /> : null}
            {paying && !onBiz ? (
              <>
                <Text style={{ color: colours.muted, fontSize: 13, marginTop: space.sm, lineHeight: 19 }}>Switching to Business happens in Manage billing, where your card already is.</Text>
                <Button title="Switch to Business in Manage billing" kind="ghost" onPress={manage} busy={busy === 'portal'} disabled={!!busy} />
              </>
            ) : null}
          </Card>
          {BIZ_SOON.map((b) => (
            <Card key={b.name}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' }}>
                <Text style={{ fontSize: 19, fontWeight: '800', color: colours.text }}>{b.name}</Text>
                <Text style={{ fontSize: 17, fontWeight: '700', color: colours.text }}>{money(b.price)} a month</Text>
              </View>
              <Text style={{ color: colours.muted, fontSize: 13.5, lineHeight: 19, marginTop: 6 }}>{b.what}</Text>
              <View style={{ marginTop: space.md, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '800', color: colours.muted }}>Coming soon</Text>
              </View>
            </Card>
          ))}
        </>
      ) : null}

      <ExtrasCard />

      <ErrorText>{error}</ErrorText>
      {paying ? <Button title="Manage billing" onPress={manage} busy={busy === 'portal'} /> : null}
      <Text style={{ color: colours.faint, fontSize: 12, marginTop: space.md, lineHeight: 18 }}>
        Prices in Australian dollars. Cancel any time from Manage billing. Credits reset each month, on yearly plans too.
      </Text>
    </Screen>
  );
}

// The extra AIs each cost us per use, so they come out of credits on every paid plan instead of being
// included (10 Nov 2026). `needs` names the ability the server has to report as switched on; until it
// does, the row says Coming soon and nothing is charged.
const EXTRAS: { icon: string; name: string; what: string; cost: string; needs?: keyof Capabilities }[] = [
  { icon: '🎬', name: 'Watch a video', what: 'Screen recordings, ads, walkthroughs. Tali watches and tells you what she sees.', cost: `${COST.videoPerMinute} credits a minute`, needs: 'video' },
  { icon: '⚖️', name: 'Second opinion', what: 'A second AI checks her answer and says where it would change it.', cost: `${COST.secondOpinion} credits`, needs: 'second_opinion' },
  { icon: '🧠', name: 'Deep think', what: 'A smarter Tali with more of her memory.', cost: '20 credits' },
  { icon: '🚀', name: 'Big brain (Pro)', what: 'Her strongest thinking, for the big calls.', cost: '40 credits' },
  { icon: '🔎', name: 'Web search', what: 'Looks it up now, with sources you can tap. Up to 150 searches a month on Tali HQ, 400 on Pro and 1,000 on Max.', cost: `${COST.webSearch} credits a search` },
  { icon: '📄', name: 'Reads long documents', what: 'Contracts, statements and scans, read properly page by page.', cost: 'Coming soon', needs: 'documents' },
];

function ExtrasCard() {
  const caps = useCapabilities();
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
            {e.needs && !caps[e.needs] ? (
              <View accessibilityLabel="Coming soon" style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 9 }}><Text style={{ fontSize: 11.5, fontWeight: '800', color: colours.muted }}>Coming soon</Text></View>
            ) : (
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: colours.purpleInk, maxWidth: 92, textAlign: 'right' }}>{e.cost}</Text>
            )}
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
        {/* Not on sale until her voice is switched on and the minutes are counted server side. */}
        <View style={{ marginTop: space.md, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
          <Text style={{ fontSize: 12.5, fontWeight: '800', color: colours.muted }}>Coming soon</Text>
        </View>
      </Card>
    </>
  );
}
