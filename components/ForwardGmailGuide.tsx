// Send your Gmail to Tali (10 Nov 2026, asked for by Taj). A three step guide on the Email screen
// for switching on Gmail's own auto-forward to the owner's Tali address. Gmail emails a code to the
// new address to confirm it, and that email lands with Tali, so the code shows up right here.
// Once the first forwarded email arrives the guide folds down to one line.
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button, Card } from '@/components/ui';
import { colours, radius, space } from '@/constants/theme';
import { myForwarding, type Forwarding } from '@/lib/forwarding';

const GMAIL_FORWARDING = 'https://mail.google.com/mail/u/0/#settings/fwdandpop';

const ago = (iso: string | null) => {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} minutes ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h} ${h === 1 ? 'hour' : 'hours'} ago` : `${Math.round(h / 24)} days ago`;
};

function Step({ n, title, done, active, children }: { n: number; title: string; done: boolean; active: boolean; children?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.md, opacity: done || active ? 1 : 0.55 }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? '#8EF0C8' : active ? colours.purple : 'transparent', borderWidth: done || active ? 0 : 1.5, borderColor: colours.border }}>
        <Text style={{ fontWeight: '800', fontSize: 14, color: done || active ? '#141033' : colours.muted }}>{done ? '✓' : n}</Text>
      </View>
      <View style={{ flex: 1, paddingBottom: space.md }}>
        <Text style={{ color: colours.text, fontSize: 16, fontWeight: '800', marginTop: 4 }}>{title}</Text>
        {active ? <View style={{ marginTop: space.sm }}>{children}</View> : null}
      </View>
    </View>
  );
}

export function ForwardGmailGuide() {
  const [f, setF] = useState<Forwarding | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const load = () => myForwarding().then(setF).catch(() => setF(null));
  useEffect(() => {
    void load();
    // while they are over in Gmail, keep looking for the code and the first email
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);
  if (!f || !f.address) return null;

  const copy = async (what: string, text: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 1800);
  };

  if (f.state === 'working' && !open) {
    return (
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: 'rgba(142,240,200,0.14)', borderWidth: 1, borderColor: 'rgba(142,240,200,0.55)', borderRadius: radius.card, padding: space.md, marginBottom: space.md }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#8EF0C8' }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colours.text, fontSize: 15, fontWeight: '800' }}>Your Gmail is coming to me</Text>
          <Text style={{ color: colours.muted, fontSize: 13, marginTop: 2 }}>Last email arrived {ago(f.last_at)}. Replies go out from your own Gmail.</Text>
        </View>
        <Text style={{ color: colours.purple, fontSize: 13, fontWeight: '700' }}>How</Text>
      </Pressable>
    );
  }

  const stage = f.state === 'working' ? 4 : f.state === 'code' ? 2 : 1;
  return (
    <Card style={{ marginBottom: space.md }}>
      <Text style={{ color: colours.text, fontSize: 22, fontFamily: 'InstrumentSerif_400Regular' }}>Send your Gmail to me</Text>
      <Text style={{ color: colours.muted, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: space.md }}>
        Three steps, about a minute, done once. Gmail keeps its own copy of everything. You need Gmail open on a computer for this, because the Gmail phone app does not have the setting.
      </Text>

      <Step n={1} title="Add my address in Gmail" done={stage > 1} active={stage === 1}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colours.purpleSoft, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 }}>
          <Text selectable style={{ flex: 1, color: colours.text, fontSize: 14, fontWeight: '700' }}>{f.address}</Text>
          <Pressable onPress={() => copy('address', f.address!)} hitSlop={8} accessibilityRole="button">
            <Text style={{ color: colours.purple, fontWeight: '800', fontSize: 13 }}>{copied === 'address' ? 'Copied' : 'Copy'}</Text>
          </Pressable>
        </View>
        <Text style={{ color: colours.muted, fontSize: 13, lineHeight: 19, marginTop: space.sm }}>
          In Gmail: Settings, See all settings, Forwarding and POP/IMAP, Add a forwarding address. Paste my address and press Next.
        </Text>
        <View style={{ marginTop: space.sm }}>
          <Button title="Open Gmail's forwarding settings" kind="ghost" onPress={() => Linking.openURL(GMAIL_FORWARDING)} />
        </View>
        <Text style={{ color: colours.faint, fontSize: 12, marginTop: space.sm }}>I am watching for Gmail's confirmation. This card moves on by itself.</Text>
      </Step>

      <Step n={2} title="Confirm it is you" done={stage > 2} active={stage === 2}>
        <Text style={{ color: colours.muted, fontSize: 13, lineHeight: 19 }}>
          Gmail sent me a code for {f.gmail ?? 'your Gmail'}. Tap confirm, or type the code into the box in Gmail's settings.
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colours.purpleSoft, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginTop: space.sm }}>
          <Text selectable style={{ flex: 1, color: colours.text, fontSize: 22, fontWeight: '800', letterSpacing: 2 }}>{f.code}</Text>
          <Pressable onPress={() => copy('code', f.code ?? '')} hitSlop={8} accessibilityRole="button">
            <Text style={{ color: colours.purple, fontWeight: '800', fontSize: 13 }}>{copied === 'code' ? 'Copied' : 'Copy'}</Text>
          </Pressable>
        </View>
        {f.confirm_url ? (
          <View style={{ marginTop: space.sm }}>
            <Button title="Confirm with Gmail" onPress={() => Linking.openURL(f.confirm_url!)} />
          </View>
        ) : null}
      </Step>

      <Step n={3} title="Switch forwarding on" done={stage > 3} active={stage === 2}>
        <Text style={{ color: colours.muted, fontSize: 13, lineHeight: 19 }}>
          Back in Forwarding and POP/IMAP, choose "Forward a copy of incoming mail to" my address, leave "keep Gmail's copy in the Inbox", and press Save Changes at the bottom. The next email you get will show up here.
        </Text>
      </Step>

      {f.state === 'working' ? (
        <Pressable onPress={() => setOpen(false)} accessibilityRole="button" style={{ alignSelf: 'center', paddingTop: 4 }}>
          <Text style={{ color: colours.muted, fontWeight: '700' }}>Close</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}
