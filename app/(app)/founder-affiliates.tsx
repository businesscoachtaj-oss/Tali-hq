// Affiliates (9 Nov 2026, Tali's Tuesday list items 4 and 9). Taj only. Everyone who applied on
// totality360.com.au/affiliates, their code, how far through the first 5 paying referrals they are,
// and commission owed from the 6th. The rates are the ones Taj set (Nov 2026).
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { founderAffiliates, founderApproveAffiliate, type Affiliate, type FounderAffiliates } from '@/lib/founderOps';
import { BackLink, Card, ErrorText, Label, Screen, TaliSays, Title } from '@/components/ui';
import { colours, elevation, radius, space } from '@/constants/theme';

const RATES: [string, string][] = [
  ['Totality Nutrition', '30%'],
  ['Totality trainer and Solo', '25%'],
  ['Totality gym plans', '20%'],
];
const money = (cents: number) => `A$${(cents / 100).toFixed(2)}`;

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: colours.surface, borderRadius: 16, padding: space.md, ...elevation.tile }}>
      <Text style={{ fontSize: 12, color: colours.muted }}>{label}</Text>
      <Text style={{ fontSize: 22, fontWeight: '800', color: colours.text, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function Progress({ paying }: { paying: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
      {[0, 1, 2, 3, 4].map((i) => <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < paying ? colours.purple : colours.border }} />)}
      {paying > 5 ? <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colours.orange }} /> : null}
    </View>
  );
}

function Status({ a }: { a: Affiliate }) {
  const [text, bg, fg] = a.status === 'new' ? ['Applied', colours.orangeSoft, '#8A4700'] : a.paying > 5 ? ['Earning', '#E2F4E8', '#1E5E36'] : [`${Math.min(a.paying, 5)} of 5`, colours.purpleSoft, colours.purpleInk];
  return <Text style={{ fontSize: 11, fontWeight: '800', color: fg, backgroundColor: bg, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8, overflow: 'hidden' }}>{text}</Text>;
}

export default function FounderAffiliatesScreen() {
  const [d, setD] = useState<FounderAffiliates | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    setError('');
    founderAffiliates().then(setD).catch((e) => setError(e?.message ?? 'Could not load.'));
  }, []);
  useFocusEffect(load);

  async function approve(id: string) {
    setBusy(id);
    await founderApproveAffiliate(id).catch((e) => setError(e?.message ?? 'Could not approve.'));
    setBusy('');
    load();
  }

  return (
    <Screen>
      <BackLink onPress={() => router.navigate('/founder')} />
      <Title sub="Applications, codes, referrals and what's owed. Only you can see this.">Affiliates</Title>
      <ErrorText>{error}</ErrorText>
      {!d ? (
        <TaliSays pose="think">Getting the affiliate numbers.</TaliSays>
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Tile label="New applications" value={String(d.applications)} />
            <Tile label="Paying referrals" value={String(d.paying)} />
            <Tile label="Owed this month" value={money(d.owed_cents)} />
            <Tile label="Paid to date" value={money(d.paid_cents)} />
          </View>

          <View style={{ height: space.lg }} />
          <Label>The tiers</Label>
          <Card>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colours.text }}>Paying referrals 1 to 5</Text>
            <Text style={{ fontSize: 13, color: colours.muted, lineHeight: 19, marginTop: 2 }}>Each one takes 20% off the affiliate's own plan. The 5th makes it free.</Text>
            <View style={{ height: 1, backgroundColor: colours.border, marginVertical: space.md }} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: colours.text }}>From the 6th: commission</Text>
            {RATES.map(([k, v]) => (
              <View key={k} style={{ flexDirection: 'row', marginTop: 6 }}>
                <Text style={{ flex: 1, fontSize: 14, color: colours.text }}>{k}</Text>
                <Text style={{ fontSize: 14, fontWeight: '800', color: colours.text }}>{v}</Text>
              </View>
            ))}
          </Card>

          <View style={{ height: space.lg }} />
          <Label>Affiliates</Label>
          <Card style={{ paddingVertical: 4 }}>
            {d.affiliates.length === 0 ? <Text style={{ fontSize: 14, color: colours.muted, paddingVertical: space.md }}>No applications yet.</Text> : null}
            {d.affiliates.map((a, i) => (
              <View key={a.id} style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colours.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: colours.text }}>{a.name}</Text>
                  <Status a={a} />
                </View>
                {a.status === 'new' ? (
                  <>
                    <Text style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>{[a.handle, a.audience ? `${a.audience} followers` : null, a.platforms?.join(', ')].filter(Boolean).join(' · ')}</Text>
                    <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
                      <Pressable onPress={() => approve(a.id)} disabled={busy === a.id} accessibilityRole="button" style={{ backgroundColor: colours.purple, borderRadius: radius.pill, paddingVertical: 9, paddingHorizontal: 14, ...elevation.button(colours.purple) }}>
                        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>{busy === a.id ? 'Approving...' : 'Approve and make a code'}</Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>{a.code} · {a.app} · {a.paying} paying</Text>
                    <Progress paying={a.paying} />
                    <Text style={{ fontSize: 13, color: colours.text, marginTop: 6 }}>
                      {a.paying >= 5 ? 'Plan free' : `${a.paying * 20}% off their own plan`}
                      {a.owed_cents ? ` · owed ${money(a.owed_cents)} this month` : ''}
                    </Text>
                  </>
                )}
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
