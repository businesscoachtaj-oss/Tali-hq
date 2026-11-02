import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { bookEventApproval, decideApproval, editDraft, sendEmailApproval, sendFromTaliAddress, sendInvoiceWithStripe, type Approval } from '@/lib/data';
import { INBOUND_DOMAIN } from '@/constants/business';
import { Card } from '@/components/ui';
import { colours, radius, space } from '@/constants/theme';

const KIND_LABEL: Record<string, string> = {
  message: 'Message',
  follow_up: 'Follow-up',
  invoice: 'Invoice reminder',
  booking: 'Booking',
  email: 'Email',
  rule: 'Rule',
  other: 'Draft',
};

// One of Tali's drafts waiting on Today. Tali never sends anything herself: the user copies it,
// sends it however they like, then taps Done. "Not needed" clears it.
export function DraftCard({ item, onDecided }: { item: Approval; onDecided: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Talk back to the draft: Tali rewrites it in place (1 credit).
  const [body, setBody] = useState<string>(item.draft?.body ?? '');
  const [subject, setSubject] = useState<string | null>(item.draft?.subject ?? null);
  const [tweak, setTweak] = useState(false);
  const [tweakText, setTweakText] = useState('');
  const [editing, setEditing] = useState('');
  const [editNote, setEditNote] = useState('');
  const editable = !!body && item.draft?.action !== 'calendar_create' && item.draft?.action !== 'stripe_send';

  async function rework(instruction: string) {
    const ins = instruction.trim();
    if (!ins || editing) return;
    setError('');
    setEditNote('');
    setEditing(ins);
    const res = await editDraft(item.id, ins);
    setEditing('');
    if (!res.ok) return setError(res.message);
    setBody(res.body);
    if (res.subject) setSubject(res.subject);
    setOpen(true);
    setTweak(false);
    setTweakText('');
    setEditNote('Reworked. Have a read before you send it.');
  }
  // Tali's invoice drafts when the business has Stripe connected: Send emails it through their Stripe.
  const stripeSend = item.kind === 'invoice' && item.draft?.action === 'stripe_send' && item.draft?.invoice_id;
  // Google connected: emails send from their Gmail, bookings go into their Google Calendar, on their tap.
  const gmailSend = item.draft?.action === 'gmail_send';
  const calendarBook = item.draft?.action === 'calendar_create';
  // A reply to email that came in to their own Tali address (Pro): Send goes out from that address.
  const taliSend = !item.draft?.action && typeof item.draft?.from === 'string' && item.draft.from.startsWith('email/') && !!item.draft?.to;
  const [sent, setSent] = useState(false);
  const [sentNote, setSentNote] = useState('');

  async function sendGmail() {
    setBusy(true);
    setError('');
    const res = await sendEmailApproval(item.id);
    if (!res.ok) {
      setError(res.message ?? 'Could not send.');
      setBusy(false);
      return;
    }
    setSentNote(`Sent from your Gmail to ${item.draft?.to} 🙌`);
    setSent(true);
    setTimeout(() => onDecided(item.id), 1600);
  }

  async function sendTali() {
    setBusy(true);
    setError('');
    const res = await sendFromTaliAddress(item.id);
    if (!res.ok) {
      setError(res.message ?? 'Could not send.');
      setBusy(false);
      return;
    }
    setSentNote(`Sent from ${res.from ?? `your @${INBOUND_DOMAIN} address`} to ${item.draft?.to} 🙌`);
    setSent(true);
    setTimeout(() => onDecided(item.id), 1600);
  }

  async function book() {
    setBusy(true);
    setError('');
    const res = await bookEventApproval(item.id);
    if (!res.ok) {
      setError(res.message ?? 'Could not book that.');
      setBusy(false);
      return;
    }
    setSentNote(item.draft?.attendee_email ? `Booked. Invite sent to ${item.draft.attendee_email} 🙌` : 'Booked in your calendar 🙌');
    setSent(true);
    setTimeout(() => onDecided(item.id), 1600);
  }

  async function sendStripe() {
    setBusy(true);
    setError('');
    const res = await sendInvoiceWithStripe(String(item.draft?.invoice_id));
    if (!res.ok) {
      setError(res.message ?? 'Could not send.');
      setBusy(false);
      return;
    }
    setSent(true);
    setTimeout(() => onDecided(item.id), 1600);
  }

  async function copy() {
    try {
      await Clipboard.setStringAsync(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setOpen(true);
      setError('Could not copy. Press and hold the text to copy it.');
    }
  }

  async function decide(status: 'done' | 'rejected') {
    setBusy(true);
    setError('');
    try {
      await decideApproval(item.id, status);
      onDecided(item.id);
    } catch (e: any) {
      setError(e?.message ?? 'Could not save that.');
      setBusy(false);
    }
  }

  return (
    <Card style={{ borderLeftWidth: 5, borderLeftColor: colours.orange }}>
      <Text style={{ fontSize: 12, color: colours.muted, fontWeight: '700', textTransform: 'uppercase' }}>
        {stripeSend ? 'Invoice' : gmailSend ? 'Email from your Gmail' : calendarBook ? 'Calendar invite' : taliSend ? 'Email to your Tali address' : KIND_LABEL[item.kind] ?? 'Draft'}
        {item.draft?.to ? ` · to ${item.draft.to_name ?? item.draft.to}` : ''}
      </Text>
      <Text style={{ fontSize: 15, fontWeight: '700', color: colours.text, marginTop: 2 }}>{item.title}</Text>
      {gmailSend && item.draft?.summary ? <Text style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>They said: {item.draft.summary}</Text> : null}
      {(gmailSend || taliSend) && subject ? <Text style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>Subject: {subject}</Text> : null}
      {body ? (
        <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityLabel={open ? 'Hide draft' : 'Show draft'}>
          <View style={{ marginTop: space.sm, backgroundColor: colours.sunk, borderRadius: 12, padding: space.md }}>
            <Text selectable numberOfLines={open ? undefined : 3} style={{ fontSize: 14, lineHeight: 21, color: colours.text }}>
              {body}
            </Text>
            {!open ? <Text style={{ fontSize: 12, color: colours.purpleInk, fontWeight: '700', marginTop: 4 }}>Show all</Text> : null}
          </View>
        </Pressable>
      ) : null}
      {editable && !sent ? (
        <View style={{ marginTop: space.sm }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: colours.muted, fontWeight: '700' }}>Tali, make it</Text>
            <Mini label="shorter" active={editing === 'shorter'} onPress={() => rework('shorter')} disabled={!!editing} />
            <Mini label="warmer" active={editing === 'warmer'} onPress={() => rework('warmer')} disabled={!!editing} />
            <Mini label="more formal" active={editing === 'formal'} onPress={() => rework('formal')} disabled={!!editing} />
            <Mini label={tweak ? 'cancel' : 'something else...'} onPress={() => setTweak(!tweak)} disabled={!!editing} />
          </View>
          {tweak ? (
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm, alignItems: 'center' }}>
              <TextInput
                value={tweakText}
                onChangeText={setTweakText}
                placeholder='For example "say Thursday 6am works"'
                placeholderTextColor={colours.faint}
                onSubmitEditing={() => rework(tweakText)}
                returnKeyType="send"
                style={{ flex: 1, borderWidth: 1, borderColor: colours.borderStrong, borderRadius: radius.input, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: colours.text, backgroundColor: colours.surface }}
              />
              <Chip label={editing && editing !== 'shorter' && editing !== 'warmer' && editing !== 'formal' ? 'Working...' : 'Go'} primary onPress={() => rework(tweakText)} disabled={!!editing || !tweakText.trim()} />
            </View>
          ) : null}
          {editing ? <Text style={{ fontSize: 12, color: colours.purpleInk, marginTop: 6 }}>Tali is reworking it...</Text> : null}
          {editNote && !editing ? <Text style={{ fontSize: 12, color: colours.good, marginTop: 6 }}>{editNote}</Text> : null}
        </View>
      ) : null}
      {error ? <Text style={{ color: colours.danger, fontSize: 13, marginTop: 6 }}>{error}</Text> : null}
      {sent ? <Text style={{ color: colours.good, fontWeight: '700', marginTop: space.sm }}>{sentNote || 'Sent through Stripe 🙌'}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md }}>
        {stripeSend ? (
          <>
            {item.draft?.email ? <Chip label={busy ? 'Sending...' : 'Send with Stripe'} primary onPress={sendStripe} disabled={busy || sent} /> : null}
            <Chip label={item.draft?.email ? 'Check it first' : 'Add their email'} onPress={() => router.navigate('/invoices')} disabled={busy} />
          </>
        ) : gmailSend ? (
          <>
            <Chip label={busy ? 'Sending...' : 'Send from Gmail'} primary onPress={sendGmail} disabled={busy || sent} />
            {body ? <Chip label={copied ? 'Copied' : 'Copy instead'} onPress={copy} disabled={busy} /> : null}
          </>
        ) : calendarBook ? (
          <Chip label={busy ? 'Booking...' : 'Book it'} primary onPress={book} disabled={busy || sent} />
        ) : taliSend ? (
          <>
            <Chip label={busy ? 'Sending...' : 'Send from my Tali address'} primary onPress={sendTali} disabled={busy || sent} />
            {body ? <Chip label={copied ? 'Copied' : 'Copy instead'} onPress={copy} disabled={busy} /> : null}
          </>
        ) : (
          <>
            {body ? <Chip label={copied ? 'Copied' : 'Copy'} primary onPress={copy} disabled={busy} /> : null}
            <Chip label="Done, I sent it" onPress={() => decide('done')} disabled={busy} />
          </>
        )}
        <Chip label="Not needed" ghost onPress={() => decide('rejected')} disabled={busy || sent} />
      </View>
    </Card>
  );
}

function Chip({ label, onPress, primary, ghost, disabled }: { label: string; onPress: () => void; primary?: boolean; ghost?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={disabled ? undefined : onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: primary ? colours.purple : ghost ? 'transparent' : colours.borderStrong,
        backgroundColor: primary ? colours.purple : 'transparent',
        opacity: disabled ? 0.5 : 1,
      }}>
      <Text style={{ fontWeight: '700', fontSize: 13, color: primary ? colours.onPurple : ghost ? colours.muted : colours.text }}>{label}</Text>
    </Pressable>
  );
}

function Mini({ label, onPress, active, disabled }: { label: string; onPress: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={disabled ? undefined : onPress}
      style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: active ? colours.purple : colours.purpleSoft, opacity: disabled && !active ? 0.5 : 1 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: active ? colours.onPurple : colours.purpleInk }}>{label}</Text>
    </Pressable>
  );
}
