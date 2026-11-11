// Settings card: connect Microsoft 365 (Outlook mail and calendar), the twin of GoogleConnectCard. Added 2 Nov 2026.
// Tali reads new mail and sorts it, drafts replies, reads the calendar and drafts invites.
// Nothing is sent or booked until the user taps the button on Today.
import { LearnRecent } from '@/components/LearnRecent';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { disconnectMicrosoft, microsoftConnection, myCredits, startMicrosoftConnect, type MicrosoftConnection } from '@/lib/data';
import { isPaid } from '@/lib/plan';
import { Button, Card } from '@/components/ui';
import { colours, space } from '@/constants/theme';

const RESULT: Record<string, { text: string; good: boolean }> = {
  connected: { text: "Connected. I'll sort new mail as it lands and keep an eye on your calendar. Nothing goes out without your tap.", good: true },
  cancelled: { text: 'No worries, nothing was connected.', good: false },
  expired: { text: 'That link timed out. Give it another go.', good: false },
  error: { text: "Microsoft didn't finish connecting. Give it another go, and accept every permission it asks about.", good: false },
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

export function MicrosoftConnectCard() {
  const params = useLocalSearchParams<{ microsoft?: string }>();
  const [conn, setConn] = useState<MicrosoftConnection | null>(null);
  const [paid, setPaid] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);

  const load = useCallback(async () => {
    const [credits, c] = await Promise.all([myCredits().catch(() => null), microsoftConnection().catch(() => null)]);
    setConn(c);
    setPaid(isPaid(credits));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (params.microsoft && RESULT[params.microsoft]) {
      setNote(RESULT[params.microsoft]);
      router.setParams({ microsoft: undefined });
      load();
    }
  }, [params.microsoft, load]);

  async function connect(what: 'both' | 'calendar') {
    setNote(null);
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setNote({ text: 'Connect Outlook from the web app for now, at talihq.com.au.', good: false });
      return;
    }
    setBusy(true);
    const res = await startMicrosoftConnect(`${window.location.origin}/settings`, what);
    if (!res.ok || !res.url) {
      setBusy(false);
      setNote({ text: res.message ?? 'Could not start connecting.', good: false });
      return;
    }
    window.location.assign(res.url);
  }

  async function disconnect() {
    setBusy(true);
    const res = await disconnectMicrosoft();
    setBusy(false);
    setConfirmOff(false);
    if (!res.ok) return setNote({ text: res.message ?? 'Could not disconnect.', good: false });
    setConn(null);
    setNote({ text: "Disconnected. I've forgotten everything that came from your Outlook. Your emails and calendar are untouched.", good: true });
  }

  if (paid === null) return null;

  const hasGmail = !!conn?.scopes.includes('mail');
  const hasCal = !!conn?.scopes.includes('calendar');

  return (
    <Card>
      <Text style={{ fontWeight: '800', color: colours.text, fontSize: 16 }}>Microsoft 365 (Outlook)</Text>
      {conn ? (
        <>
          <Text style={{ color: conn.last_error ? colours.danger : colours.good, fontWeight: '700', marginTop: 4 }}>
            {conn.last_error === 'revoked' ? `Microsoft signed us out of ${conn.ms_email}. Reconnect below.` : `Connected to ${conn.ms_email}`}
          </Text>
          <Text style={{ color: colours.muted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
            {hasGmail && hasCal
              ? 'Outlook mail and calendar. I sort new mail into needs you, FYI and junk, and draft replies for your tap. Your calendar is in your brief, and I can draft invites.'
              : hasCal
                ? 'Outlook calendar only. Your calendar is in your brief and I can draft invites. Connect your mail too if you want me sorting your email.'
                : 'Outlook mail only.'}
          </Text>
          {NATIVE && (conn.last_error === 'revoked' || (hasCal && !hasGmail)) ? (
            <WebOnly />
          ) : (
            <>
              {conn.last_error === 'revoked' ? <Button title="Reconnect Microsoft" onPress={() => connect(hasGmail ? 'both' : 'calendar')} busy={busy} /> : null}
              {hasCal && !hasGmail && !conn.last_error ? <Button title="Add Outlook mail too" kind="ghost" onPress={() => connect('both')} busy={busy} /> : null}
            </>
          )}
          {confirmOff ? (
            <View style={{ marginTop: space.sm }}>
              <Button title="Yes, disconnect Microsoft" kind="danger" onPress={disconnect} busy={busy} />
              <Button title="Keep it connected" kind="ghost" onPress={() => setConfirmOff(false)} />
            </View>
          ) : (
            <>
              {conn.last_error ? null : <LearnRecent provider="microsoft" />}
              <Button title="Disconnect" kind="ghost" onPress={() => setConfirmOff(true)} />
            </>
          )}
        </>
      ) : paid ? (
        <>
          <Text style={{ color: colours.muted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
            One sign-in for Outlook mail and calendar (Microsoft 365, Hotmail or Outlook.com). I'll sort your new email, draft replies, put your day in the brief and draft bookings. I only read new mail from the moment you connect, I never delete or move anything, and nothing is sent or booked until you tap it.
          </Text>
          {NATIVE ? (
            <WebOnly />
          ) : (
            <>
              <Button title="Connect Outlook mail and calendar" onPress={() => connect('both')} busy={busy} />
              <Button title="Just the calendar" kind="ghost" onPress={() => connect('calendar')} busy={busy} />
              <Text style={{ color: colours.faint, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
                Work accounts: your IT admin may need to approve Tali HQ the first time.
              </Text>
            </>
          )}
        </>
      ) : (
        <>
          <Text style={{ color: colours.muted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>Connecting Outlook is part of the paid plans.</Text>
          <Button title="See plans" kind="ghost" onPress={() => router.navigate('/plans')} />
        </>
      )}
      {note ? <Text style={{ color: note.good ? colours.good : colours.muted, fontSize: 13, marginTop: space.sm, lineHeight: 19 }}>{note.text}</Text> : null}
    </Card>
  );
}
