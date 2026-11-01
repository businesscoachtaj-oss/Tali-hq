import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router';
import { claimInbox, googleConnection, inboundEmails, myCredits, myInbox, setEmailStatus, type GoogleConnection, type InboundEmail } from '@/lib/data';
import { friendlyTime } from '@/lib/dates';
import { isPaid, isPro } from '@/lib/plan';
import { INBOUND_DOMAIN } from '@/constants/business';
import { BackLink, Body, Button, Card, ErrorText, Label, Screen, TaliSays, Title } from '@/components/ui';
import { colours, radius, space } from '@/constants/theme';

// Email: two sources in one place.
//  - Gmail, when they have connected Google (Tali HQ and Pro): sorted into Needs you, FYI and Junk,
//    replies drafted on Today with a "Send from Gmail" button.
//  - Tali's own address (Pro): enquiries sent to it, summed up with a drafted reply to copy.
type Tab = 'needs_you' | 'fyi' | 'spam';

export default function Inbox() {
  const [paid, setPaid] = useState<boolean | null>(null);
  const [pro, setPro] = useState(false);
  const [google, setGoogle] = useState<GoogleConnection | null>(null);
  const [alias, setAlias] = useState<string | null>(null);
  const [emails, setEmails] = useState<InboundEmail[]>([]);
  const [open, setOpen] = useState<InboundEmail | null>(null);
  const [tab, setTab] = useState<Tab>('needs_you');
  const [showSpam, setShowSpam] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const c = await myCredits();
      setPaid(isPaid(c));
      setPro(isPro(c));
      if (!isPaid(c)) return;
      const [g, a, list] = await Promise.all([googleConnection().catch(() => null), isPro(c) ? myInbox() : Promise.resolve(null), inboundEmails()]);
      setGoogle(g);
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

  const gmailOn = !!google?.scopes.includes('gmail');
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

  if (paid === false) {
    return (
      <Screen>
        <BackLink onPress={() => router.navigate('/me')} />
        <Title>Email</Title>
        <TaliSays pose="wave">On Tali HQ you can connect your Gmail and I'll sort it for you: what needs you, what's just FYI, what's junk. I draft the replies and you tap send. On Pro I get my own address for your enquiries too.</TaliSays>
        <Button title="See plans" onPress={() => router.navigate('/plans')} />
      </Screen>
    );
  }

  if (open) {
    const isGmail = open.source === 'gmail';
    return (
      <Screen>
        <BackLink onPress={() => setOpen(null)} label="Email" />
        <Text style={{ fontSize: 12, color: colours.muted }}>
          {friendlyTime(open.received_at)}
          {isGmail ? ' · Gmail' : " · Tali's address"}
        </Text>
        <Title sub={open.from_name ? `${open.from_name} <${open.from_email}>` : open.from_email ?? undefined}>{open.subject || '(no subject)'}</Title>
        {open.summary ? <TaliSays pose="idle">{open.summary}</TaliSays> : null}
        {open.approval_id && open.status !== 'handled' ? (
          <Card style={{ backgroundColor: colours.purpleSoft, borderColor: colours.purpleSoft }}>
            <Body>{isGmail ? 'I drafted a reply. It\'s waiting on Today with a "Send from Gmail" button.' : "I drafted a reply. It's waiting on Today for you to check, copy and send."}</Body>
            <Button title="Go to Today" kind="ghost" onPress={() => router.navigate('/')} />
          </Card>
        ) : null}
        {open.status === 'handled' ? <Text style={{ color: colours.good, fontWeight: '700', marginBottom: space.sm }}>Handled</Text> : null}
        <Label>The email</Label>
        <Card><Text style={{ fontSize: 15, lineHeight: 22, color: colours.text }}>{open.body_text || open.snippet || 'No text in this one.'}</Text></Card>
        {open.status !== 'handled' ? <Button title="Done with this one" onPress={() => mark(open, 'handled')} /> : null}
        {open.status !== 'spam' ? <Button title="It's junk" kind="ghost" onPress={() => mark(open, 'spam')} /> : <Button title="Not junk" kind="ghost" onPress={() => mark(open, 'new')} />}
        {isGmail ? <Text style={{ fontSize: 12, color: colours.faint, marginTop: space.sm, lineHeight: 17 }}>This only changes how it shows here. Your Gmail is never moved or deleted.</Text> : null}
      </Screen>
    );
  }

  // Gmail list, sorted by Tali.
  const gmail = emails.filter((e) => e.source === 'gmail');
  const bucket = (e: InboundEmail): Tab => (e.status === 'spam' || e.category === 'spam' ? 'spam' : e.category === 'needs_you' ? 'needs_you' : 'fyi');
  const counts = { needs_you: 0, fyi: 0, spam: 0 } as Record<Tab, number>;
  for (const e of gmail) counts[bucket(e)]++;
  const gmailShown = gmail.filter((e) => bucket(e) === tab);

  // Tali's own address list.
  const own = emails.filter((e) => e.source !== 'gmail');
  const ownShown = own.filter((e) => (showSpam ? e.status === 'spam' : e.status !== 'spam'));
  const ownSpam = own.filter((e) => e.status === 'spam').length;

  const Row = ({ e }: { e: InboundEmail }) => (
    <Pressable key={e.id} onPress={() => setOpen(e)}>
      <Card style={e.status === 'new' && bucket(e) === 'needs_you' ? { borderLeftWidth: 5, borderLeftColor: colours.purple } : e.status === 'handled' ? { opacity: 0.6 } : undefined}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colours.text, flex: 1 }} numberOfLines={1}>{e.from_name || e.from_email}</Text>
          <Text style={{ fontSize: 12, color: colours.muted }}>{friendlyTime(e.received_at)}</Text>
        </View>
        <Text style={{ fontSize: 14, color: colours.text, marginTop: 2 }} numberOfLines={1}>{e.subject || '(no subject)'}</Text>
        {e.summary || e.snippet ? <Text style={{ fontSize: 14, color: colours.muted, marginTop: 4, lineHeight: 20 }} numberOfLines={2}>{e.summary || e.snippet}</Text> : null}
        {e.approval_id && e.status === 'new' ? (
          <View style={{ alignSelf: 'flex-start', marginTop: 6, backgroundColor: colours.orangeSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colours.orange }}>Reply drafted</Text>
          </View>
        ) : null}
      </Card>
    </Pressable>
  );

  return (
    <Screen>
      <BackLink onPress={() => router.navigate('/me')} />
      <Title sub={gmailOn ? `${google?.google_email}. I sort what comes in and draft replies. Nothing is sent until you tap it on Today.` : 'Connect your Gmail and I\'ll sort it for you. On Pro I get my own address for enquiries too.'}>Email</Title>
      <ErrorText>{error}</ErrorText>

      {gmailOn ? (
        <>
          <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
            {(['needs_you', 'fyi', 'spam'] as Tab[]).map((t) => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === t }}
                style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: tab === t ? colours.text : colours.surface, borderWidth: 1, borderColor: tab === t ? colours.text : colours.border }}>
                <Text style={{ fontWeight: '800', fontSize: 14, color: tab === t ? colours.bg : colours.muted }}>
                  {t === 'needs_you' ? 'Needs you' : t === 'fyi' ? 'FYI' : 'Junk'} {counts[t] || ''}
                </Text>
              </Pressable>
            ))}
          </View>
          {gmailShown.length === 0 ? (
            <TaliSays pose="idle">
              {tab === 'needs_you'
                ? gmail.length
                  ? 'Nothing needs you right now. Nice.'
                  : google?.last_mail_sync_at
                    ? 'Nothing new since you connected. I check every 10 minutes.'
                    : 'Just connected. I\'ll have your first lot sorted within 10 minutes, and I only read mail from now on.'
                : tab === 'fyi'
                  ? 'Nothing filed under FYI yet.'
                  : 'No junk. Lovely.'}
            </TaliSays>
          ) : (
            gmailShown.map((e) => <Row key={e.id} e={e} />)
          )}
        </>
      ) : (
        <Card>
          <Text style={{ fontWeight: '800', color: colours.text, fontSize: 16 }}>Connect your Gmail</Text>
          <Text style={{ color: colours.muted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
            One sign-in with Google. I only read new mail from the moment you connect, never delete or move anything, and every reply waits for your tap.
          </Text>
          <Button title="Connect in Settings" onPress={() => router.navigate('/settings')} />
        </Card>
      )}

      {pro ? (
        <>
          <View style={{ height: space.xl }} />
          <Label>Tali's own address</Label>
          {!alias ? (
            <>
              <TaliSays pose="wave">Want your own Tali address for enquiries? I'll make one from your business name. Put it on your website and I'll sum up each enquiry and draft a reply.</TaliSays>
              <Button title="Get my address" onPress={claim} busy={busy} />
            </>
          ) : address ? (
            <Card>
              <Text selectable style={{ fontSize: 18, fontWeight: '800', color: colours.purpleInk }}>{address}</Text>
              <Button title={copied ? 'Copied' : 'Copy address'} kind="ghost" onPress={copy} />
              <Text style={{ fontSize: 13, color: colours.muted, marginTop: space.sm, lineHeight: 19 }}>Put it on your website or contact form, or forward enquiries to it.</Text>
            </Card>
          ) : (
            <Card>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colours.purpleInk }}>{alias}@</Text>
              <Text style={{ fontSize: 14, color: colours.muted, marginTop: space.sm, lineHeight: 20 }}>Your name's saved. Tali's address switches on very soon, and the full address will show here the moment it does.</Text>
            </Card>
          )}
          {alias && own.length ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md }}>
                <Label>{showSpam ? 'Spam' : 'Sent to your address'}</Label>
                {ownSpam ? (
                  <Pressable onPress={() => setShowSpam(!showSpam)} hitSlop={8}>
                    <Text style={{ color: colours.purple, fontWeight: '700', fontSize: 13 }}>{showSpam ? 'Back' : `Spam (${ownSpam})`}</Text>
                  </Pressable>
                ) : null}
              </View>
              {ownShown.map((e) => <Row key={e.id} e={e} />)}
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
