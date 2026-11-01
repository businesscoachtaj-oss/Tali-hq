import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router';
import { claimInbox, inboundEmails, myCredits, myInbox, setEmailStatus, type InboundEmail } from '@/lib/data';
import { friendlyTime } from '@/lib/dates';
import { isPro } from '@/lib/plan';
import { INBOUND_DOMAIN } from '@/constants/business';
import { BackLink, Body, Button, Card, ErrorText, Label, Screen, TaliSays, Title } from '@/components/ui';
import { colours, radius, space } from '@/constants/theme';

export default function Inbox() {
  const [pro, setPro] = useState<boolean | null>(null);
  const [alias, setAlias] = useState<string | null>(null);
  const [emails, setEmails] = useState<InboundEmail[]>([]);
  const [open, setOpen] = useState<InboundEmail | null>(null);
  const [showSpam, setShowSpam] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const c = await myCredits();
      setPro(isPro(c));
      if (!isPro(c)) return;
      const [a, list] = await Promise.all([myInbox(), inboundEmails()]);
      setAlias(a);
      setEmails(list);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your email.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const address = alias && INBOUND_DOMAIN ? `${alias}@${INBOUND_DOMAIN}` : null;

  async function claim() {
    setBusy(true);
    setError('');
    try {
      setAlias(await claimInbox());
    } catch (e: any) {
      setError(e?.message ?? 'Could not set up your address.');
    }
    setBusy(false);
  }

  async function copy() {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function mark(e: InboundEmail, status: InboundEmail['status']) {
    try {
      await setEmailStatus(e.id, status);
      setOpen(null);
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Could not update.');
    }
  }

  if (pro === false) {
    return (
      <Screen>
        <BackLink onPress={() => router.navigate('/me')} />
        <Title>Tali's email</Title>
        <TaliSays pose="wave">With Tali HQ Pro I get my own email address for your business. Put it on your website or forward enquiries to it, and I'll sum each one up and draft a reply for your yes.</TaliSays>
        <Button title="See plans" onPress={() => router.navigate('/plans')} />
      </Screen>
    );
  }

  if (open) {
    return (
      <Screen>
        <BackLink onPress={() => setOpen(null)} label="Tali's email" />
        <Text style={{ fontSize: 12, color: colours.muted }}>{friendlyTime(open.received_at)}</Text>
        <Title sub={open.from_name ? `${open.from_name} <${open.from_email}>` : open.from_email ?? undefined}>{open.subject || '(no subject)'}</Title>
        {open.summary ? <TaliSays pose="idle">{open.summary}</TaliSays> : null}
        {open.approval_id ? (
          <Card style={{ backgroundColor: colours.purpleSoft, borderColor: colours.purpleSoft }}>
            <Body>I drafted a reply. It's waiting on Today for you to check, copy and send.</Body>
            <Button title="Go to Today" kind="ghost" onPress={() => router.navigate('/')} />
          </Card>
        ) : null}
        <Label>The email</Label>
        <Card><Text style={{ fontSize: 15, lineHeight: 22, color: colours.text }}>{open.body_text || 'No text in this one.'}</Text></Card>
        {open.status !== 'handled' ? <Button title="Done with this one" onPress={() => mark(open, 'handled')} /> : null}
        {open.status !== 'spam' ? <Button title="It's spam" kind="ghost" onPress={() => mark(open, 'spam')} /> : <Button title="Not spam" kind="ghost" onPress={() => mark(open, 'new')} />}
      </Screen>
    );
  }

  const shown = emails.filter((e) => (showSpam ? e.status === 'spam' : e.status !== 'spam'));
  const spamCount = emails.filter((e) => e.status === 'spam').length;

  return (
    <Screen>
      <BackLink onPress={() => router.navigate('/me')} />
      <Title sub="Enquiries sent to this address come to Tali. She sums each one up and drafts a reply for your yes. She never replies on her own.">Tali's email</Title>
      <ErrorText>{error}</ErrorText>

      {!alias ? (
        <>
          <TaliSays pose="wave">Want your own Tali address? I'll make one from your business name.</TaliSays>
          <Button title="Get my address" onPress={claim} busy={busy} />
        </>
      ) : address ? (
        <Card>
          <Label>Your address</Label>
          <Text selectable style={{ fontSize: 18, fontWeight: '800', color: colours.purpleInk }}>{address}</Text>
          <Button title={copied ? 'Copied' : 'Copy address'} kind="ghost" onPress={copy} />
          <Text style={{ fontSize: 13, color: colours.muted, marginTop: space.sm, lineHeight: 19 }}>
            Put it on your website or contact form, or forward enquiries to it from your own email.
          </Text>
        </Card>
      ) : (
        <Card>
          <Label>Your address</Label>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colours.purpleInk }}>{alias}@</Text>
          <Text style={{ fontSize: 14, color: colours.muted, marginTop: space.sm, lineHeight: 20 }}>
            Your name's saved. Tali's email switches on very soon, and your full address will show here the moment it does.
          </Text>
        </Card>
      )}

      {alias ? (
        <>
          <View style={{ height: space.md }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>{showSpam ? 'Spam' : 'Emails'}</Label>
            {spamCount ? (
              <Pressable onPress={() => setShowSpam(!showSpam)} hitSlop={8}>
                <Text style={{ color: colours.purple, fontWeight: '700', fontSize: 13 }}>{showSpam ? 'Back to emails' : `Spam (${spamCount})`}</Text>
              </Pressable>
            ) : null}
          </View>
          {shown.length === 0 ? (
            <TaliSays pose="idle">{showSpam ? 'No spam. Lovely.' : 'Nothing yet. Emails sent to your Tali address show up here.'}</TaliSays>
          ) : (
            shown.map((e) => (
              <Pressable key={e.id} onPress={() => setOpen(e)}>
                <Card style={e.status === 'new' ? { borderLeftWidth: 5, borderLeftColor: colours.purple } : undefined}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colours.text, flex: 1 }} numberOfLines={1}>{e.from_name || e.from_email}</Text>
                    <Text style={{ fontSize: 12, color: colours.muted }}>{friendlyTime(e.received_at)}</Text>
                  </View>
                  <Text style={{ fontSize: 14, color: colours.text, marginTop: 2 }} numberOfLines={1}>{e.subject || '(no subject)'}</Text>
                  {e.summary ? <Text style={{ fontSize: 14, color: colours.muted, marginTop: 4, lineHeight: 20 }} numberOfLines={2}>{e.summary}</Text> : null}
                  {e.approval_id && e.status === 'new' ? (
                    <View style={{ alignSelf: 'flex-start', marginTop: 6, backgroundColor: colours.orangeSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colours.orange }}>Reply drafted</Text>
                    </View>
                  ) : null}
                </Card>
              </Pressable>
            ))
          )}
        </>
      ) : null}
    </Screen>
  );
}
