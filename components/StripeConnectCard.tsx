// Settings card: connect the business's own Stripe so Tali can send invoices through it.
// Stripe Connect (Standard): they sign in to the Stripe account they already have and approve.
import { useCallback, useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { disconnectStripe, myCredits, startStripeConnect, stripeConnection, type StripeConnection } from '@/lib/data';
import { isPaid } from '@/lib/plan';
import { Button, Card } from '@/components/ui';
import { colours, space } from '@/constants/theme';

const RESULT: Record<string, { text: string; good: boolean }> = {
  connected: { text: "Connected. I can send your invoices through Stripe now, whenever you tap Send.", good: true },
  cancelled: { text: 'No worries, nothing was connected.', good: false },
  expired: { text: 'That link timed out. Give it another go.', good: false },
  error: { text: "Stripe didn't finish connecting. Give it another go.", good: false },
};

export function StripeConnectCard() {
  const params = useLocalSearchParams<{ stripe?: string }>();
  const [conn, setConn] = useState<StripeConnection | null>(null);
  const [paid, setPaid] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);

  const load = useCallback(async () => {
    // Checked separately, so a hiccup reading the connection never hides the Connect button.
    const [credits, c] = await Promise.all([myCredits().catch(() => null), stripeConnection().catch(() => null)]);
    setConn(c);
    setPaid(isPaid(credits));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (params.stripe && RESULT[params.stripe]) {
      setNote(RESULT[params.stripe]);
      router.setParams({ stripe: undefined });
      load();
    }
  }, [params.stripe, load]);

  async function connect() {
    setNote(null);
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setNote({ text: 'Connect Stripe from the web app for now, at tali-hq.vercel.app.', good: false });
      return;
    }
    setBusy(true);
    const res = await startStripeConnect(`${window.location.origin}/settings`);
    if (!res.ok || !res.url) {
      setBusy(false);
      setNote({ text: res.message ?? 'Could not start connecting.', good: false });
      return;
    }
    window.location.assign(res.url);
  }

  async function disconnect() {
    setBusy(true);
    const res = await disconnectStripe();
    setBusy(false);
    setConfirmOff(false);
    if (!res.ok) return setNote({ text: res.message ?? 'Could not disconnect.', good: false });
    setConn(null);
    setNote({ text: "Disconnected. Your Stripe account and the invoices already in it aren't touched.", good: true });
  }

  if (paid === null) return null;

  return (
    <Card>
      <Text style={{ fontWeight: '800', color: colours.text, fontSize: 16 }}>Stripe</Text>
      {conn ? (
        <>
          <Text style={{ color: colours.good, fontWeight: '700', marginTop: 4 }}>
            Connected{conn.business_name ? ` to ${conn.business_name}` : ''}{conn.livemode ? '' : ' (test mode)'}
          </Text>
          <Text style={{ color: colours.muted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
            Invoices Tali drafts get a Send button. Stripe emails them with a pay by card link, and they mark themselves paid here.
          </Text>
          {confirmOff ? (
            <View style={{ marginTop: space.sm }}>
              <Button title="Yes, disconnect Stripe" kind="danger" onPress={disconnect} busy={busy} />
              <Button title="Keep it connected" kind="ghost" onPress={() => setConfirmOff(false)} />
            </View>
          ) : (
            <Button title="Disconnect" kind="ghost" onPress={() => setConfirmOff(true)} />
          )}
        </>
      ) : paid ? (
        <>
          <Text style={{ color: colours.muted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
            Connect the Stripe account you already use and I'll send your invoices through it, with a pay by card link. Nothing goes out until you tap Send. Payments go straight to you.
          </Text>
          <Button title="Connect Stripe" onPress={connect} busy={busy} />
        </>
      ) : (
        <>
          <Text style={{ color: colours.muted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
            Sending invoices through your own Stripe is part of Tali HQ and Pro.
          </Text>
          <Button title="See plans" kind="ghost" onPress={() => router.navigate('/plans')} />
        </>
      )}
      {note ? <Text style={{ color: note.good ? colours.good : colours.muted, fontSize: 13, marginTop: space.sm, lineHeight: 19 }}>{note.text}</Text> : null}
    </Card>
  );
}
