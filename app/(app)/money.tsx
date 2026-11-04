// Money picture (3 Nov 2026). The owner's view only: cash in, owed, overdue, going out, runway.
// Read only. Nothing here sends, charges or changes anything.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { myCredits, type Credits } from '@/lib/data';
import { isPaid } from '@/lib/plan';
import { loadMoneyPicture, money0, runwayLabel, saveMoneySettings, taliMoneyLine, type MoneyPicture } from '@/lib/money';
import { friendlyDate } from '@/lib/dates';
import { BackLink, Body, Button, Card, ErrorText, Field, Label, Screen, TaliSays, Title, goBack } from '@/components/ui';
import { colours, elevation, radius, space } from '@/constants/theme';

const num = (s: string) => {
  const n = Number(s.replace(/[^0-9.]/g, ''));
  return s.trim() === '' || Number.isNaN(n) ? null : n;
};

export default function Money() {
  const [credits, setCredits] = useState<Credits | null | undefined>(undefined);
  const [pic, setPic] = useState<MoneyPicture | null>(null);
  const [editing, setEditing] = useState(false);
  const [costs, setCosts] = useState('');
  const [cash, setCash] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // So "Tell me what goes out" doesn't flash before the picture arrives (4 Nov 2026).
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const c = await myCredits();
      setCredits(c);
      if (!isPaid(c)) return;
      const p = await loadMoneyPicture();
      setPic(p);
      setCosts(p.goingOut != null ? String(p.goingOut) : '');
      setCash(p.cashSource === 'entered' && p.cashOnHand != null ? String(p.cashOnHand) : '');
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your money picture.');
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function save() {
    setBusy(true);
    setError('');
    try {
      await saveMoneySettings(num(costs), num(cash));
      setEditing(false);
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save.');
    }
    setBusy(false);
  }

  if (credits !== undefined && !isPaid(credits)) {
    return (
      <Screen>
        <BackLink onPress={() => goBack('/')} />
        <Title>Money</Title>
        <TaliSays pose="wave">Cash in, owed, overdue, what goes out and your runway, in one glance each morning. I read it before your brief.</TaliSays>
        <Card>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text }}>Money picture is part of Tali HQ</Text>
          <Body muted>Five numbers, read by Tali, no spreadsheets.</Body>
          <Button title="See plans" onPress={() => router.navigate('/plans')} />
        </Card>
      </Screen>
    );
  }

  const runway = pic ? runwayLabel(pic.runwayWeeks) : null;

  return (
    <Screen onRefresh={load}>
      <BackLink onPress={() => goBack('/')} />
      <Title sub="Your view of the month. Tali reads it, nothing here moves money.">Money</Title>

      {pic ? <TaliSays pose={pic.overdueInvoices.length ? 'think' : 'idle'}>{taliMoneyLine(pic)}</TaliSays> : null}
      {error ? <Card><Body muted>{error}</Body></Card> : null}

      {pic ? (
        <>
          <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.sm }}>
            <Tile label="Cash in" value={money0(pic.cashIn)} sub={pic.cashInSource === 'stripe' ? 'Stripe, this month' : 'Paid invoices, this month'} colour={colours.good} />
            <Tile label="Owed" value={money0(pic.owed)} sub="Sent, not paid" />
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.sm }}>
            <Tile label="Overdue" value={money0(pic.overdue)} sub={pic.overdueInvoices.length ? `${pic.overdueInvoices.length} invoice${pic.overdueInvoices.length === 1 ? '' : 's'}` : 'None'} colour={pic.overdue > 0 ? colours.danger : undefined} />
            <Tile label="Going out" value={pic.goingOut != null ? money0(pic.goingOut) : 'Not set'} sub="A month" muted={pic.goingOut == null} />
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
            <Tile
              label="Runway"
              value={runway ?? (pic.goingOut == null ? 'Add costs' : 'Add cash')}
              sub={runway ? `${money0(pic.cashOnHand ?? 0)} on hand${pic.cashSource === 'stripe' ? ' (Stripe)' : ''}` : 'Cash on hand divided by a week of costs'}
              colour={pic.runwayWeeks != null && pic.runwayWeeks < 6 ? colours.orange : colours.purpleInk}
              muted={!runway}
            />
          </View>
        </>
      ) : null}

      {loaded ? <Label>Your numbers</Label> : null}
      {loaded ? <Card>
        {editing ? (
          <>
            <Field label="Going out each month (A$)" value={costs} onChangeText={setCosts} keyboardType="decimal-pad" inputMode="decimal" placeholder="Rent, software, insurance, you" />
            <Field label="Cash on hand (A$, optional)" value={cash} onChangeText={setCash} keyboardType="decimal-pad" inputMode="decimal" placeholder={pic?.cashSource === 'stripe' ? 'Leave blank to use your Stripe balance' : 'What is in the bank'} />
            <ErrorText>{error}</ErrorText>
            <Button title="Save" onPress={save} busy={busy} />
            <Button title="Cancel" kind="ghost" onPress={() => { setEditing(false); setError(''); }} />
          </>
        ) : (
          <>
            <Body muted>
              {pic?.goingOut != null
                ? `About ${money0(pic.goingOut)} goes out a month.${pic.cashSource === 'entered' ? ` ${money0(pic.cashOnHand ?? 0)} on hand.` : pic?.cashSource === 'stripe' ? ' Cash on hand from your Stripe balance.' : ''}`
                : 'Tell me what goes out each month and I can work out your runway.'}
            </Body>
            {pic?.updatedAt ? <Text style={{ fontSize: 12, color: colours.faint, marginTop: 4 }}>Updated {friendlyDate(pic.updatedAt.slice(0, 10))}</Text> : null}
            <Button title={pic?.goingOut != null ? 'Update numbers' : 'Add your numbers'} kind="ghost" onPress={() => setEditing(true)} />
          </>
        )}
      </Card> : null}

      {pic?.overdueInvoices.length ? (
        <>
          <Label>Overdue</Label>
          {pic.overdueInvoices.map((i) => (
            <Pressable key={i.id} onPress={() => router.navigate({ pathname: '/invoices', params: { open: i.id } })} accessibilityRole="button">
              <Card style={{ borderLeftWidth: 5, borderLeftColor: colours.danger }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text, flex: 1 }} numberOfLines={1}>{i.client_name}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text }}>{money0(i.total)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={{ fontSize: 13, color: colours.muted }}>{i.number}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colours.danger }}>Overdue since {friendlyDate(i.due_date)}</Text>
                </View>
              </Card>
            </Pressable>
          ))}
          <Button title="Open invoices" kind="ghost" onPress={() => router.navigate('/invoices')} />
        </>
      ) : pic ? (
        <Button title="Open invoices" kind="ghost" onPress={() => router.navigate('/invoices')} />
      ) : null}
    </Screen>
  );
}

function Tile({ label, value, sub, colour, muted }: { label: string; value: string; sub?: string; colour?: string; muted?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: colours.surface, borderRadius: radius.card, padding: space.md, borderWidth: 1, borderColor: 'rgba(39,38,38,0.04)', ...elevation.card }}>
      <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: colours.muted }}>{label}</Text>
      <Text style={{ fontSize: muted ? 18 : 24, fontWeight: '800', color: muted ? colours.faint : colour ?? colours.text, marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {sub ? <Text style={{ fontSize: 12, color: colours.muted, marginTop: 2 }} numberOfLines={2}>{sub}</Text> : null}
    </View>
  );
}
