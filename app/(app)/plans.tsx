import { useCallback, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { myCredits, mySubscription, openBillingPortal, plans as loadPlans, startCheckout, type Credits, type Plan } from '@/lib/data';
import { BackLink, Body, Button, Card, ErrorText, Screen, Title } from '@/components/ui';
import { colours, radius, space } from '@/constants/theme';

const FOUNDING_OFF = 0.425; // founding members: 42.5% off for life

const money = (n: number) => `A$${n.toFixed(2)}`;

export default function Plans() {
  const [list, setList] = useState<Plan[]>([]);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [sub, setSub] = useState<Awaited<ReturnType<typeof mySubscription>>>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
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

  async function go(plan: 'hq' | 'pro') {
    setError('');
    setBusy(plan);
    const res = await startCheckout(plan, window.location.href);
    setBusy(null);
    if (res.ok && res.url) window.location.assign(res.url);
    else setError(res.message ?? 'Could not start checkout.');
  }

  async function manage() {
    setError('');
    setBusy('portal');
    const res = await openBillingPortal(window.location.href);
    setBusy(null);
    if (res.ok && res.url) window.location.assign(res.url);
    else setError(res.message ?? 'Could not open billing.');
  }

  return (
    <Screen>
      <BackLink onPress={() => router.navigate('/me')} />
      <Title sub={founding ? 'You are a founding member: 42.5% off Tali HQ and Pro for as long as you stay.' : 'Start free. Upgrade when Tali is pulling her weight.'}>
        Plans
      </Title>

      {list.map((p) => {
        const current = credits?.plan === p.id && (p.id !== 'hq' || credits?.status !== 'trialing');
        const trialHere = p.id === 'hq' && credits?.status === 'trialing';
        const price = founding && p.monthly_price_aud > 0 ? p.monthly_price_aud * (1 - FOUNDING_OFF) : p.monthly_price_aud;
        return (
          <Card key={p.id} style={p.id === 'hq' ? { borderColor: colours.purple, borderWidth: 2 } : undefined}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 19, fontWeight: '800', color: colours.text }}>{p.name}</Text>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colours.text }}>
                {p.monthly_price_aud === 0 ? 'Free' : `${money(price)} a month`}
              </Text>
            </View>
            {founding && p.monthly_price_aud > 0 ? (
              <Text style={{ color: colours.muted, fontSize: 13, textDecorationLine: 'line-through' }}>{money(p.monthly_price_aud)} a month</Text>
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
            {web && p.id !== 'free' && !paying ? (
              <Button title={trialHere ? `Keep ${p.name} after my trial` : `Choose ${p.name}`} onPress={() => go(p.id as 'hq' | 'pro')} busy={busy === p.id} disabled={!!busy} kind={p.id === 'hq' ? 'primary' : 'ghost'} />
            ) : null}
          </Card>
        );
      })}

      <ErrorText>{error}</ErrorText>
      {web && paying ? <Button title="Manage billing" onPress={manage} busy={busy === 'portal'} /> : null}
      {!web ? (
        <Body muted>Upgrading inside the app is coming soon. Your trial and everything Tali learns carry over.</Body>
      ) : (
        <Text style={{ color: colours.faint, fontSize: 12, marginTop: space.md, lineHeight: 18 }}>
          Prices in Australian dollars. Cancel any time from Manage billing. Credits reset each month.
        </Text>
      )}
    </Screen>
  );
}
