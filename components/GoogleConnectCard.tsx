// Settings card: connect Google (Gmail and Google Calendar) with one sign-in, like Claude's connectors.
// Tali sends the replies she drafts from their Gmail, reads the calendar and drafts invites.
// CHANGED (10 Nov 2026, Taj): she no longer reads Gmail. Mail reaches her by forwarding (Email screen).
// Nothing is sent or booked until the user taps the button on Today.
import { LearnRecent } from '@/components/LearnRecent';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { disconnectGoogle, googleConnection, myCredits, startGoogleConnect, type GoogleConnection } from '@/lib/data';
import { isPaid } from '@/lib/plan';
import { Button, Card } from '@/components/ui';
import { colours, space } from '@/constants/theme';

const RESULT: Record<string, { text: string; good: boolean }> = {
  connected: { text: "Connected. Replies I draft go out from your own Gmail, and I keep an eye on your calendar. Nothing goes out without your tap.", good: true },
  cancelled: { text: 'No worries, nothing was connected.', good: false },
  expired: { text: 'That link timed out. Give it another go.', good: false },
  error: { text: "Google didn't finish connecting. Give it another go, and tick every box Google asks about.", good: false },
};

// 4 Nov 2026: on the phone apps the sign-in hop needs a browser we come back from, so say so up front
// instead of after a tap, and open the web app's Settings.
const NATIVE = Platform.OS !== 'web';
function WebOnly() {
  return (
    <>
      <Text style={{ color: colours.muted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>Connect this from the web app. It takes a minute, and it shows up here straight after.</Text>
      <Button title="Open the web app" kind="ghost" onPress={() => Linking.openURL('https://talihq.com.au/settings')} />
    </>
  );
}

export function GoogleConnectCard() {
  const params = useLocalSearchParams<{ google?: string }>();
  const [conn, setConn] = useState<GoogleConnection | null>(null);
  const [paid, setPaid] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);

  const load = useCallback(async () => {
    const [credits, c] = await Promise.all([myCredits().catch(() => null), googleConnection().catch(() => null)]);
    setConn(c);
    setPaid(isPaid(credits));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (params.google && RESULT[params.google]) {
      setNote(RESULT[params.google]);
      router.setParams({ google: undefined });
      load();
    }
  }, [params.google, load]);

  async function connect(what: 'both' | 'calendar') {
    setNote(null);
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setNote({ text: 'Connect Google from the web app for now, at talihq.com.au.', good: false });
      return;
    }
    setBusy(true);
    const res = await startGoogleConnect(`${window.location.origin}/settings`, what);
    if (!res.ok || !res.url) {
      setBusy(false);
      setNote({ text: res.message ?? 'Could not start connecting.', good: false });
      return;
    }
    window.location.assign(res.url);
  }

  async function disconnect() {
    setBusy(true);
    const res = await disconnectGoogle();
    setBusy(false);
    setConfirmOff(false);
    if (!res.ok) return setNote({ text: res.message ?? 'Could not disconnect.', good: false });
    setConn(null);
    setNote({ text: "Disconnected. Your emails and calendar are untouched.", good: true });
  }

  if (paid === null) return null;

  const hasGmail = !!conn?.scopes.includes('gmail');
  const hasCal = !!conn?.scopes.includes('calendar');

  return (
    <Card>
      <Text style={{ fontWeight: '800', color: colours.text, fontSize: 16 }}>Google</Text>
      {conn ? (
        <>
          <Text style={{ color: conn.last_error ? colours.danger : colours.good, fontWeight: '700', marginTop: 4 }}>
            {conn.last_error === 'revoked' ? `Google signed us out of ${conn.google_email}. Reconnect below.` : `Connected to ${conn.google_email}`}
          </Text>
          <Text style={{ color: colours.muted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
            {hasGmail && hasCal
              ? 'Gmail sending and Google Calendar. Replies I draft go out from your own Gmail when you tap Send. Your calendar is in your brief, and I can draft invites. To have me sort your inbox, send your Gmail to me on the Email page.'
              : hasCal
                ? 'Google Calendar only. Your calendar is in your brief and I can draft invites. Add Gmail sending if you want replies to go out from your own address.'
                : 'Gmail sending only.'}
          </Text>
          {NATIVE && (conn.last_error === 'revoked' || (hasCal && !hasGmail)) ? (
            <WebOnly />
          ) : (
            <>
              {conn.last_error === 'revoked' ? <Button title="Reconnect Google" onPress={() => connect(hasGmail ? 'both' : 'calendar')} busy={busy} /> : null}
              {hasCal && !hasGmail && !conn.last_error ? <Button title="Add Gmail sending" kind="ghost" onPress={() => connect('both')} busy={busy} /> : null}
            </>
          )}
          {confirmOff ? (
            <View style={{ marginTop: space.sm }}>
              <Button title="Yes, disconnect Google" kind="danger" onPress={disconnect} busy={busy} />
              <Button title="Keep it connected" kind="ghost" onPress={() => setConfirmOff(false)} />
            </View>
          ) : (
            <>
              {conn.last_error ? null : <LearnRecent provider="google" mail={conn.gmail_read === true} />}
              <Button title="Disconnect" kind="ghost" onPress={() => setConfirmOff(true)} />
            </>
          )}
        </>
      ) : paid ? (
        <>
          <Text style={{ color: colours.muted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
            One sign-in for Gmail and Google Calendar. Replies I draft go out from your own Gmail, your day goes in the brief and I can draft bookings. I can send from your Gmail but I cannot read it. To have me sort your inbox, send your Gmail to me on the Email page. Nothing is sent or booked until you tap it.
          </Text>
          {NATIVE ? (
            <WebOnly />
          ) : (
            <>
              <Button title="Connect Google" onPress={() => connect('both')} busy={busy} />
              <Button title="Just the calendar" kind="ghost" onPress={() => connect('calendar')} busy={busy} />
              <Text style={{ color: colours.faint, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
                While Tali HQ is in beta, Google may show a "Google hasn't verified this app" page. Tap Advanced, then Continue.
              </Text>
            </>
          )}
        </>
      ) : (
        <>
          <Text style={{ color: colours.muted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>Connecting Gmail and Google Calendar is part of Tali HQ and Pro.</Text>
          <Button title="See plans" kind="ghost" onPress={() => router.navigate('/plans')} />
        </>
      )}
      {note ? <Text style={{ color: note.good ? colours.good : colours.muted, fontSize: 13, marginTop: space.sm, lineHeight: 19 }}>{note.text}</Text> : null}
    </Card>
  );
}
