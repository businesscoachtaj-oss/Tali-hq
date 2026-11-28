import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from 'react-native';
import * as AppleIap from '@/lib/appleIap';
import { useAuth } from '@/lib/auth';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { myCredits, mySubscription, openBillingPortal, plans as loadPlans, startCheckout, type Credits, type Plan } from '@/lib/data';
import { BackLink, Button, Card, ErrorText, Screen, Title, goBack } from '@/components/ui';
import { SkinHeader } from '@/components/PageSkin';
import { colours, radius, space } from '@/constants/theme';
import { COST, VOICE_ADDON } from '@/lib/brainAiPlan';
import { useCapabilities, type Capabilities } from '@/lib/capabilities';

const APP_WEB_URL = 'https://talihq.com.au';

// 22 Nov 2026 (App Review 3.1.1): on iPhone the plans are sold through Apple In-App Purchase, with
// Apple's prices, Restore Purchases and the renewal terms Apple asks for. Business, top ups and the
// voice add-on are not sold on iPhone. Web and Android keep Stripe exactly as before.
const IS_IOS = Platform.OS === 'ios' && AppleIap.IAP_SUPPORTED;
const APPLE_EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const PRIVACY_URL = 'https://totality360.com.au/privacy.html';

const FOUNDING_OFF = 0.425; // founding members: 42.5% off for life

const money = (n: number) => `A$${n.toFixed(2)}`;

// 12 Nov 2026 (Taj): the Business plans. Only what is built is listed. The price charged comes from Stripe.
const SHOW_BUSINESS = false;
const BIZ_BLUE = '#3B3F9E';
const BIZ_PRICE = 199.99;
const BIZ_FEATURES = [
  'Everything in Learnéd Max, with the same 10,000 credits and 300 images a month',
  'Jobs and quotes: quote, job and invoice in one line',
  'Pipeline: who to chase next and what it could be worth',
  'Bookings: your week, and one link your customers book from',
  'Projects: the bigger pieces of work, with their tasks',
  'Website: a simple site hosted for you, written and changed by Tali if you like, with a contact form that lands as a lead',
  'Quote calculator: a hosted page where customers pick what they want and see a rough price',
  'On autopilot: rules that put a nudge on your To do so nothing slips',
  'Bookkeeping pack: a quarter on one page, ready for your accountant',
  // 17 Nov 2026 (Build your HQ).
  'Business blocks for your home: Team, Leads, Cash flow, Bookings today, Website visits, Quote win rate and Customer happiness',
  'A team layout you set and push to every seat, and team trackers everyone logs to',
];
const BIZ_SOON = [
  { name: 'Learnéd Business Pro', price: 389.99, what: 'For a small team. Seats for your staff, text messages to customers and Tali answering your phone.' },
  { name: 'Learnéd Business Max', price: 649.99, what: 'For a bigger team or more than one business. More seats, more texts and more call minutes.' },
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
  const { session } = useAuth();
  const [products, setProducts] = useState<Record<string, AppleIap.IapProduct>>({});
  const [productsLoaded, setProductsLoaded] = useState(!IS_IOS);
  const [note, setNote] = useState('');

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

  useFocusLoad(load); // Speed pass (13 Nov 2026): see lib/useFocusLoad.ts

  // iPhone: Apple's products and prices, and purchases StoreKit hands back (also ones left over from
  // last time, which StoreKit re-delivers until the server has confirmed them).
  useEffect(() => {
    if (!IS_IOS) return;
    AppleIap.loadProducts().then(setProducts).catch(() => {}).finally(() => setProductsLoaded(true));
    const stop = AppleIap.listenForPurchases(
      (purchase) => { void applePurchased(purchase); },
      (message) => { setBusy(null); if (message) setError(message); },
    );
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applePurchased(purchase: unknown) {
    const r = await AppleIap.completePurchase(purchase);
    setBusy(null);
    if (r.error) return setError(r.error);
    if (r.active) {
      setNote('Thank you. Your plan is on.');
      await load();
    }
  }

  async function appleBuy(plan: 'hq' | 'pro' | 'max') {
    const id = AppleIap.productIdFor(plan, yearly ? 'year' : 'month');
    if (!products[id] || !session) return setError('Plans are not available from the App Store right now. Try again shortly.');
    setError('');
    setNote('');
    setBusy(plan);
    try {
      const purchase = await AppleIap.buy(id, session.user.id);
      if (purchase) await applePurchased(purchase);
    } catch (e: any) {
      setBusy(null);
      if (e?.code !== 'user-cancelled') setError(e?.message || 'The purchase did not go through.');
    }
  }

  async function appleRestore() {
    setError('');
    setNote('');
    setBusy('restore');
    try {
      const r = await AppleIap.restore();
      if (!r) setNote('No Learnéd subscription was found for this Apple ID.');
      else if (r.error) setError(r.error);
      else { setNote(r.active ? 'Restored. Your plan is on.' : 'Your App Store subscription has ended.'); await load(); }
    } catch {
      setError('Could not reach the App Store. Try again.');
    } finally {
      setBusy(null);
    }
  }

  // Paying means a real Stripe subscription. A customer id alone is not enough: checkout creates the
  // customer before payment, so someone who backs out of checkout would lose the Choose buttons and
  // land on an empty Manage billing page (5 Nov 2026). Same rule as create-checkout.
  const paying = !!sub?.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(sub.status);
  // 22 Nov 2026: paying through the App Store. On iPhone, plan changes go through Apple; elsewhere the
  // App Store subscription is managed from the iPhone's settings.
  const appleBilled = sub?.billing_source === 'apple' && !!sub?.apple_expires_at && new Date(sub.apple_expires_at).getTime() > Date.now() && sub.plan_id !== 'free';
  const stripeOnIos = IS_IOS && paying && sub?.billing_source !== 'apple';
  const founding = !!sub?.founding_member && !IS_IOS;
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
      <SkinHeader id="plans" title="Plans" sub={founding ? 'You are a founding member: 42.5% off every paid plan for as long as you stay.' : 'Start free. The daily games, the lesson library and your reminders are free for everyone.'} onBack={() => goBack('/me')} />

      {/* 23 Nov 2026 (Taj): yearly stays an option, with no "save" or "months free" line on it. */}
      <View style={{ flexDirection: 'row', alignSelf: 'flex-start', borderWidth: 1, borderColor: colours.ink, borderRadius: radius.pill, overflow: 'hidden', marginBottom: space.md }}>
        {([false, true] as const).map((y) => (
          <Pressable
            key={String(y)}
            onPress={() => setYearly(y)}
            accessibilityRole="button"
            accessibilityState={{ selected: yearly === y }}
            style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: yearly === y ? colours.ink : colours.surface }}
          >
            <Text style={{ fontWeight: '800', fontSize: 12, letterSpacing: 1.2, color: yearly === y ? colours.bg : colours.text }}>{y ? 'YEARLY' : 'MONTHLY'}</Text>
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
        const appleProduct = IS_IOS && p.id !== 'free' ? products[AppleIap.productIdFor(p.id as 'hq' | 'pro' | 'max', yearly ? 'year' : 'month')] : undefined;
        const priceLabel = p.monthly_price_aud === 0 ? 'Free' : IS_IOS ? (appleProduct ? `${appleProduct.displayPrice} ${per}` : productsLoaded ? 'Unavailable' : '...') : `${money(price)} ${per}`;
        return (
          <Card key={p.id} style={p.id === 'hq' ? { borderColor: colours.ink, borderWidth: 2 } : undefined}>
            {p.id === 'hq' ? <Text style={{ color: colours.purple, fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginBottom: 4 }}>MOST PEOPLE PICK THIS</Text> : null}
            {p.id === 'max' ? <Text style={{ color: colours.orange, fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginBottom: 4 }}>HER WHOLE BRAIN</Text> : null}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 25, color: colours.text, fontFamily: 'EBGaramond_500Medium' }}>{p.name}</Text>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colours.text }}>
                {priceLabel}
              </Text>
            </View>
            {founding && full > 0 ? (
              <Text style={{ color: colours.muted, fontSize: 13, textDecorationLine: 'line-through' }}>{money(full)} {per}</Text>
            ) : null}
            {yearPrice && !IS_IOS ? (
              <Text style={{ color: colours.muted, fontSize: 13 }}>
                Works out at {money(price / 12)} a month, billed yearly.
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
            {p.id !== 'free' && !paying && !appleBilled && !IS_IOS ? (
              <Button title={trialHere ? `Keep ${p.name} after my trial` : `Choose ${p.name}`} onPress={() => go(p.id as 'hq' | 'pro' | 'max')} busy={busy === p.id} disabled={!!busy} kind={p.id === 'hq' ? 'primary' : 'ghost'} />
            ) : null}
            {/* iPhone: Apple In-App Purchase. Moving between HQ, Pro and Max also goes through Apple. */}
            {p.id !== 'free' && IS_IOS && !stripeOnIos && !current ? (
              <Button title={trialHere ? `Keep ${p.name} after my trial` : appleBilled ? `Switch to ${p.name}` : `Choose ${p.name}`} onPress={() => appleBuy(p.id as 'hq' | 'pro' | 'max')} busy={busy === p.id} disabled={!!busy || !appleProduct} kind={p.id === 'hq' ? 'primary' : 'ghost'} />
            ) : null}
            {/* Paying HQ members switch plans through Stripe's portal, so point them there rather than a second checkout (4 Nov 2026). */}
            {p.id === 'max' && paying && !IS_IOS && credits?.plan !== 'max' ? (
              <>
                <Text style={{ color: colours.muted, fontSize: 13, marginTop: space.sm, lineHeight: 19 }}>
                  You're on {credits?.plan === 'pro' ? 'Learnéd Pro' : 'Learnéd'}. Switching to Max happens in Manage billing, where your card already is.
                </Text>
                <Button title="Switch to Max in Manage billing" kind="ghost" onPress={manage} busy={busy === 'portal'} disabled={!!busy} />
              </>
            ) : null}
            {p.id === 'pro' && paying && !IS_IOS && credits?.plan === 'hq' ? (
              <>
                <Text style={{ color: colours.muted, fontSize: 13, marginTop: space.sm, lineHeight: 19 }}>
                  You're on Learnéd. Switching to Pro happens in Manage billing, where your card already is.
                </Text>
                <Button title="Switch to Pro in Manage billing" kind="ghost" onPress={manage} busy={busy === 'portal'} disabled={!!busy} />
              </>
            ) : null}
            {trialHere && !paying && trialEnd && !IS_IOS ? (
              <Text style={{ color: colours.muted, fontSize: 13, marginTop: 6 }}>
                {deferred
                  ? `You won't be charged until ${trialEnd.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}.`
                  : 'Your trial ends within 2 days, so billing starts today.'}
              </Text>
            ) : null}
          </Card>
        );
      })}

      {/* 28 Nov 2026 (Learnéd): no Business plans. Anyone already on one keeps it until they change it
          in Manage billing. */}
      {SHOW_BUSINESS && loaded && !IS_IOS ? (
        <>
          <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: colours.muted, marginTop: space.lg, marginBottom: space.sm }}>FOR YOUR BUSINESS</Text>
          <Card>
            <Text style={{ color: BIZ_BLUE, fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginBottom: 4 }}>THE BUSINESS TOOLS</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 25, color: colours.text, fontFamily: 'EBGaramond_500Medium' }}>Learnéd Business</Text>
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
            {!paying && !appleBilled ? <Button title="Choose Learnéd Business" onPress={() => go('biz')} busy={busy === 'biz'} disabled={!!busy} kind="ghost" /> : null}
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
                <Text style={{ fontSize: 25, color: colours.text, fontFamily: 'EBGaramond_500Medium' }}>{b.name}</Text>
                <Text style={{ fontSize: 17, fontWeight: '700', color: colours.text }}>{money(b.price)} a month</Text>
              </View>
              <Text style={{ color: colours.muted, fontSize: 13.5, lineHeight: 19, marginTop: 6 }}>{b.what}</Text>
              <View style={{ marginTop: space.md, alignSelf: 'flex-start', backgroundColor: 'rgba(28,26,23,0.1)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '800', color: colours.muted }}>Coming soon</Text>
              </View>
            </Card>
          ))}
        </>
      ) : null}

      <ExtrasCard />

      <ErrorText>{error}</ErrorText>
      {note ? <Text style={{ color: '#2E8A63', fontWeight: '700', marginBottom: space.sm }}>{note}</Text> : null}
      {IS_IOS ? (
        <>
          {stripeOnIos ? <Text style={{ color: colours.muted, fontSize: 13, lineHeight: 19, marginBottom: space.sm }}>Your plan is billed outside the App Store, so it can't be changed here.</Text> : null}
          {appleBilled ? <Button title="Manage subscription" kind="ghost" onPress={() => AppleIap.openManageSubscriptions()} /> : null}
          <Button title="Restore purchases" kind="ghost" onPress={appleRestore} busy={busy === 'restore'} disabled={!!busy && busy !== 'restore'} />
          <Text style={{ color: colours.faint, fontSize: 12, marginTop: space.md, lineHeight: 18 }}>
            Learnéd, Pro and Max are auto-renewing subscriptions, monthly or yearly, at the price shown. Payment is charged to your Apple ID account at confirmation of purchase. The subscription renews automatically unless it is cancelled at least 24 hours before the end of the current period, and your account is charged for renewal within 24 hours before the end of the current period. You can manage and cancel it in your App Store account settings. Credits reset each month, on yearly plans too.
          </Text>
          <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.sm }}>
            <Text style={{ color: colours.purpleInk, fontWeight: '700', fontSize: 13 }} onPress={() => Linking.openURL(APPLE_EULA_URL)}>Terms of Use</Text>
            <Text style={{ color: colours.purpleInk, fontWeight: '700', fontSize: 13 }} onPress={() => Linking.openURL(PRIVACY_URL)}>Privacy Policy</Text>
          </View>
        </>
      ) : (
        <>
          {paying ? <Button title="Manage billing" onPress={manage} busy={busy === 'portal'} /> : null}
          {appleBilled && !paying ? <Text style={{ color: colours.muted, fontSize: 13, lineHeight: 19, marginTop: space.sm }}>Your plan is paid through the App Store. Change or cancel it in your iPhone's App Store settings.</Text> : null}
          <Text style={{ color: colours.faint, fontSize: 12, marginTop: space.md, lineHeight: 18 }}>
            Prices in Australian dollars. Cancel any time from Manage billing. Credits reset each month, on yearly plans too.
          </Text>
        </>
      )}
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
  { icon: '🔎', name: 'Web search', what: 'Looks it up now, with sources you can tap. Up to 150 searches a month on Learnéd, 400 on Pro and 1,000 on Max.', cost: `${COST.webSearch} credits a search` },
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
              <View accessibilityLabel="Coming soon" style={{ backgroundColor: 'rgba(28,26,23,0.1)', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 9 }}><Text style={{ fontSize: 11.5, fontWeight: '800', color: colours.muted }}>Coming soon</Text></View>
            ) : (
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: colours.purpleInk, maxWidth: 92, textAlign: 'right' }}>{e.cost}</Text>
            )}
          </View>
        ))}
      </Card>
      {/* 22 Nov 2026: add-ons are not sold on iPhone (App Review 3.1.1). */}
      {IS_IOS ? null : (
        <>
      <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: colours.muted, marginTop: space.lg, marginBottom: space.sm }}>ADD-ONS</Text>
      <Card style={{ borderColor: colours.purple, borderWidth: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colours.text }}>🎙️ Tali's voice</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text }}>{money(VOICE_ADDON.price)} a month</Text>
        </View>
        <View style={{ marginTop: space.sm, gap: 4 }}>
          {[`She reads her replies out loud: ${VOICE_ADDON.speakMinutes} minutes a month`, `Talk to her hands free: up to ${VOICE_ADDON.listenHours} hours of listening`, `Need more? ${VOICE_ADDON.packMinutes} more minutes for ${money(VOICE_ADDON.packPrice)}`, 'Works with Learnéd and Pro'].map((f) => (
            <Text key={f} style={{ fontSize: 14, color: colours.text, lineHeight: 20 }}>{'✓'} {f}</Text>
          ))}
        </View>
        {/* Not on sale until her voice is switched on and the minutes are counted server side. */}
        <View style={{ marginTop: space.md, alignSelf: 'flex-start', backgroundColor: 'rgba(28,26,23,0.1)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
          <Text style={{ fontSize: 12.5, fontWeight: '800', color: colours.muted }}>Coming soon</Text>
        </View>
      </Card>
        </>
      )}
    </>
  );
}
