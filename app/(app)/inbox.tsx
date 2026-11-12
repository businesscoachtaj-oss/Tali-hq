import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { rememberForwarded, googleConnection, inboundEmails, microsoftConnection, myCredits, myInbox, setEmailStatus, type GoogleConnection, type InboundEmail, type MicrosoftConnection } from '@/lib/data';
import { friendlyTime } from '@/lib/dates';
import { isPaid, isPro } from '@/lib/plan';
import { INBOUND_DOMAIN } from '@/constants/business';
import { BackLink, Body, Button, Card, ErrorText, Label, Screen, TaliSays, Title, Hint, goBack } from '@/components/ui';
import { AliasPicker, useAliasClaim } from '@/components/TaliAddressCard';
import { SkinHeader } from '@/components/PageSkin';
import { ForwardGmailGuide } from '@/components/ForwardGmailGuide';
import { myForwarding, type Forwarding } from '@/lib/forwarding';
import { colours, radius, space } from '@/constants/theme';

// Email: two sources in one place.
//  - Gmail, once they forward it to Tali (every paid plan, 10 Nov 2026): sorted into Needs you, FYI and Junk,
//    replies drafted on Today with a "Send from Gmail" button.
//  - Tali's own address (Pro): enquiries sent to it, summed up with a drafted reply. The reply sends
//    from their Gmail or Outlook when connected, otherwise from the Tali address (4 Nov 2026).
type Tab = 'needs_you' | 'fyi' | 'spam';

export default function Inbox() {
  const [paid, setPaid] = useState<boolean | null>(null);
  const [pro, setPro] = useState(false);
  const [google, setGoogle] = useState<GoogleConnection | null>(null);
  const [microsoft, setMicrosoft] = useState<MicrosoftConnection | null>(null);
  const [forwarding, setForwarding] = useState<Forwarding | null>(null);
  const [alias, setAlias] = useState<string | null>(null);
  const [emails, setEmails] = useState<InboundEmail[]>([]);
  const [open, setOpen] = useState<InboundEmail | null>(null);
  // 10 Nov 2026: something you forwarded to her own address, waiting for you to say "remember this".
  const [keeping, setKeeping] = useState(false);
  const [keepNote, setKeepNote] = useState('');
  async function keep(e: InboundEmail) {
    setKeeping(true); setKeepNote('');
    const r = await rememberForwarded(e.id);
    setKeeping(false);
    setKeepNote(r.message || (r.ok ? `Done. I kept ${r.remembered ?? 0} ${r.remembered === 1 ? 'thing' : 'things'} from it.` : "I couldn't do that just now."));
    if (r.ok) setOpen({ ...e, forwarded: 'remembered' });
  }
  const [tab, setTab] = useState<Tab>('needs_you');
  const [showSpam, setShowSpam] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const c = await myCredits();
      setPaid(isPaid(c));
      setPro(isPro(c));
      if (!isPaid(c)) return;
      const [g, ms, a, list, fwd] = await Promise.all([googleConnection().catch(() => null), microsoftConnection().catch(() => null), isPro(c) ? myInbox() : Promise.resolve(null), inboundEmails(), myForwarding().catch(() => null)]);
      setForwarding(fwd);
      setGoogle(g);
      setMicrosoft(ms);
      setAlias(a);
      setEmails(list);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your email.');
    }
  }, []);

  useFocusLoad(load); // Speed pass (13 Nov 2026): see lib/useFocusLoad.ts

  // Outlook (2 Nov 2026) shows in the same sorted list as Gmail.
  const outlookOn = !!microsoft?.scopes.includes('mail');
  const gmailOn = !!google?.scopes.includes('gmail') || outlookOn;
  // 10 Nov 2026: Gmail arrives by forwarding now. fwdOn = their forwarded Gmail is coming in;
  // readOn = still on the old way of reading Gmail, which ends 24 Nov 2026; gmailOn = replies can go
  // out from their own mailbox. The sorted list shows for any of forwarding, the old read or Outlook.
  const fwdOn = forwarding?.state === 'working';
  const readOn = google?.gmail_read === true;
  const listOn = fwdOn || readOn || outlookOn;
  const canSendGmail = !!google?.scopes.includes('gmail') && !google?.last_error;
  const mailAccount = fwdOn ? forwarding?.gmail ?? google?.google_email : readOn ? google?.google_email : microsoft?.ms_email;
  const address = alias && INBOUND_DOMAIN ? `${alias}@${INBOUND_DOMAIN}` : null;
  // 4 Nov 2026: they pick the word before the @, pre-filled from their business name.
  const picker = useAliasClaim(pro && paid === true && !alias, setAlias);

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
      <Screen skin="airmail" onRefresh={load}>
        <SkinHeader id="airmail" title="Email" onBack={() => goBack('/me')} backLabel="Back" />
        <TaliSays pose="wave">On Tali HQ you can send your Gmail to me, or connect Outlook, and I'll sort it for you: what needs you, what's just FYI, what's junk. I draft the replies and you tap send. On Pro I get my own address for your enquiries too.</TaliSays>
        <Button title="See plans" onPress={() => router.navigate('/plans')} />
      </Screen>
    );
  }

  if (open) {
    const isGmail = open.source === 'gmail' || open.source === 'outlook';
    const providerName = open.source === 'outlook' ? 'Outlook' : 'Gmail';
    return (
      <Screen skin="airmail">
        <BackLink onPress={() => setOpen(null)} label="Email" />
        <Text style={{ fontSize: 12, color: colours.muted }}>
          {friendlyTime(open.received_at)}
          {isGmail ? ` · ${providerName}` : " · Tali's address"}
        </Text>
        <Title sub={open.from_name ? `${open.from_name} <${open.from_email}>` : open.from_email ?? undefined}>{open.subject || '(no subject)'}</Title>
        {open.summary ? <TaliSays pose="idle">{open.summary}</TaliSays> : null}
        {open.forwarded === 'waiting' || open.forwarded === 'unverified' ? (
          <Card style={{ borderColor: colours.purple, borderWidth: 1 }}>
            <Body>{open.forwarded === 'unverified' ? "This looks like something you forwarded to me, but I couldn't be sure it was really from you, so I haven't kept anything from it." : 'You forwarded this to me. I have not kept anything from it yet.'}</Body>
            <Button title={keeping ? 'Reading...' : 'Remember what matters in this'} onPress={() => keep(open)} busy={keeping} />
          </Card>
        ) : null}
        {open.forwarded === 'remembered' ? <Hint>You forwarded this. What mattered in it is in her brain.</Hint> : null}
        {keepNote ? <Hint>{keepNote}</Hint> : null}
        {open.approval_id && open.status !== 'handled' ? (
          <Card style={{ backgroundColor: colours.purpleSoft, borderColor: colours.purpleSoft }}>
            <Body>{isGmail ? `I drafted a reply. It's waiting on Today with a "Send from ${providerName}" button.` : gmailOn ? "I drafted a reply. It's waiting on Today with a Send button." : "I drafted a reply. It's waiting on Today for you to check, copy and send."}</Body>
            <Button title="Go to Today" kind="ghost" onPress={() => router.navigate('/')} />
          </Card>
        ) : null}
        {open.status === 'handled' ? <Text style={{ color: colours.good, fontWeight: '700', marginBottom: space.sm }}>Handled</Text> : null}
        <Label>The email</Label>
        <Card><Text style={{ fontSize: 15, lineHeight: 22, color: colours.text }}>{open.body_text || open.snippet || 'No text in this one.'}</Text></Card>
        {open.status !== 'handled' ? <Button title="Done with this one" onPress={() => mark(open, 'handled')} /> : null}
        {open.status !== 'spam' ? <Button title="It's junk" kind="ghost" onPress={() => mark(open, 'spam')} /> : <Button title="Not junk" kind="ghost" onPress={() => mark(open, 'new')} />}
        {isGmail ? <Text style={{ fontSize: 12, color: colours.faint, marginTop: space.sm, lineHeight: 17 }}>This only changes how it shows here. Your {providerName} is never moved or deleted.</Text> : null}
      </Screen>
    );
  }

  // Gmail list, sorted by Tali.
  const gmail = emails.filter((e) => e.source === 'gmail' || e.source === 'outlook');
  const bucket = (e: InboundEmail): Tab => (e.status === 'spam' || e.category === 'spam' ? 'spam' : e.category === 'needs_you' ? 'needs_you' : 'fyi');
  const counts = { needs_you: 0, fyi: 0, spam: 0 } as Record<Tab, number>;
  for (const e of gmail) counts[bucket(e)]++;
  const gmailShown = gmail.filter((e) => bucket(e) === tab);

  // Tali's own address list.
  const own = emails.filter((e) => e.source === 'tali_inbox');
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

  // Tali's own address: claim it, show it, and the enquiries sent to it.
  const taliSection = (
    <>
      <Label>Tali's own address</Label>
      {!alias ? (
        <Card>
          <Text style={{ color: colours.muted, fontSize: 13, lineHeight: 19 }}>Get Tali her own address for enquiries. Put it on your website and she sums up each one and drafts a reply.</Text>
          <AliasPicker value={picker.pick} onChange={picker.setPick} onSubmit={picker.claim} />
          <Button title="Get my address" onPress={picker.claim} busy={picker.busy} />
          <ErrorText>{picker.error}</ErrorText>
        </Card>
      ) : address ? (
        <Card>
          <Text selectable style={{ fontSize: 18, fontWeight: '800', color: colours.purpleInk }}>{address}</Text>
          <Button title={copied ? 'Copied' : 'Copy address'} kind="ghost" onPress={copy} />
          <Text style={{ fontSize: 13, color: colours.muted, marginTop: space.sm, lineHeight: 19 }}>
            Put it on your website or contact form, or forward enquiries to it.
            {gmailOn ? ' Replies go out from your connected email when you tap Send on Today.' : ' I draft each reply on Today for you to send, or copy and send yourself.'}
          </Text>
        </Card>
      ) : (
        <Card>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colours.purpleInk }}>{alias}@</Text>
          <Text style={{ fontSize: 14, color: colours.muted, marginTop: space.sm, lineHeight: 20 }}>Your name's saved. Tali's address switches on very soon, and the full address will show here the moment it does.</Text>
        </Card>
      )}
      {alias && !own.length ? <Hint>Nothing yet. Send it a test email and I'll show you what I do with it.</Hint> : null}
      {alias && own.length ? (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md }}>
            <Label>{showSpam ? 'Junk' : 'Sent to your address'}</Label>
            {ownSpam ? (
              <Pressable onPress={() => setShowSpam(!showSpam)} hitSlop={8}>
                <Text style={{ color: colours.purple, fontWeight: '700', fontSize: 13 }}>{showSpam ? 'Back' : `Junk (${ownSpam})`}</Text>
              </Pressable>
            ) : null}
          </View>
          {ownShown.map((e) => <Row key={e.id} e={e} />)}
        </>
      ) : null}
    </>
  );

  return (
    <Screen skin="airmail" onRefresh={load}>
      <SkinHeader id="airmail" title="Email" sub={listOn ? `${mailAccount}. I sort what comes in and draft replies. Nothing is sent until you tap it on Today.` : 'Send your Gmail to me, or connect Outlook, and I\'ll sort it for you. On Pro I get my own address for enquiries too.'} onBack={() => goBack('/me')} backLabel="Back" />
      <ErrorText>{error}</ErrorText>

      <ForwardGmailGuide />

      {/* 10 Nov 2026: still on the old way of reading Gmail. Say plainly when it stops. */}
      {readOn && !fwdOn ? (
        <Card style={{ marginBottom: space.md }}>
          <Text style={{ fontWeight: '800', color: colours.text, fontSize: 16 }}>One change to make by 24 November</Text>
          <Text style={{ color: colours.muted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
            I am still reading {google?.google_email} the old way, and that stops on 24 November. Follow the three steps above once and your email keeps coming to me with no gap.
          </Text>
        </Card>
      ) : null}

      {/* Forwarded Gmail is coming in, but replies have nowhere to go out from yet. */}
      {fwdOn && !canSendGmail ? (
        <Card style={{ marginBottom: space.md }}>
          <Text style={{ fontWeight: '800', color: colours.text, fontSize: 16 }}>Send replies from your Gmail</Text>
          <Text style={{ color: colours.muted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
            Connect Google once so the replies I draft go out from your own address when you tap Send. I can send from your Gmail but I cannot read it.
          </Text>
          <Button title="Connect in Settings" onPress={() => router.navigate('/settings')} />
        </Card>
      ) : null}

      {/* 4 Nov 2026: on Pro with nothing connected, Tali's address comes first and the connect card after. */}
      {pro && !listOn ? taliSection : null}

      {listOn ? (
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
                  : fwdOn
                    ? 'Nothing has come in yet. The next email you get will show up here.'
                    : google?.last_mail_sync_at || microsoft?.last_mail_sync_at
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
        <>
          {pro ? <View style={{ height: space.xl }} /> : null}
          <Card>
            <Text style={{ fontWeight: '800', color: colours.text, fontSize: 16 }}>On Outlook instead?</Text>
            <Text style={{ color: colours.muted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
              One sign-in with Microsoft. I only read new mail from the moment you connect, never delete or move anything, and every reply waits for your tap.
            </Text>
            <Button title="Connect in Settings" onPress={() => router.navigate('/settings')} />
          </Card>
        </>
      )}

      {pro && listOn ? (
        <>
          <View style={{ height: space.xl }} />
          {taliSection}
        </>
      ) : null}
    </Screen>
  );
}
