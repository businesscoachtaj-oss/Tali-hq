import { useCallback, useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { myCredits, mySubscription, openBillingPortal, plans as loadPlans, startCheckout, type Credits, type Plan } from '@/lib/data';
import { BackLink, Button, Card, ErrorText, Screen, Title } from '@/components/ui';
import { colours, radius, space } from '@/constants/theme';

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
  const web = Platform.OS === 'web';

  const load = useCallback(async () => {
    try {
      const [p, c, s] = await Promise.all([loadPlans(), myCredits(), mySubscription()]);
      setList(p);
      setCredits(c);
      setSub(s);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load plans.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const paying = !!sub?.stripe_customer_id && sub.status !== 'canceled' && sub.plan_id !== 'free';
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
    <Screen>
      <BackLink onPress={() => router.navigate('/me')} />
      <Title sub={founding ? 'You are a founding member: 42.5% off Tali HQ and Pro for as long as you stay.' : 'Start free. Upgrade when Tali is pulling her weight.'}>
        Plans
      </Title>

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

      {list.map((p) => {
        const current = credits?.plan === p.id && (p.id !== 'hq' || credits?.status !== 'trialing');
        const trialHere = p.id === 'hq' && credits?.status === 'trialing';
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
          </Card>
        );
      })}

      <ErrorText>{error}</ErrorText>
      {paying ? <Button title="Manage billing" onPress={manage} busy={busy === 'portal'} /> : null}
      <Text style={{ color: colours.faint, fontSize: 12, marginTop: space.md, lineHeight: 18 }}>
        Prices in Australian dollars. Cancel any time from Manage billing. Credits reset each month, on yearly plans too.
      </Text>
    </Screen>
  );
}
