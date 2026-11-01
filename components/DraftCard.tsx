import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { bookEventApproval, decideApproval, sendEmailApproval, sendInvoiceWithStripe, type Approval } from '@/lib/data';
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
  const body = item.draft?.body ?? '';
  // Tali's invoice drafts when the business has Stripe connected: Send emails it through their Stripe.
  const stripeSend = item.kind === 'invoice' && item.draft?.action === 'stripe_send' && item.draft?.invoice_id;
  // Google connected: emails send from their Gmail, bookings go into their Google Calendar, on their tap.
  const gmailSend = item.draft?.action === 'gmail_send';
  const calendarBook = item.draft?.action === 'calendar_create';
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
        {stripeSend ? 'Invoice' : gmailSend ? 'Email from your Gmail' : calendarBook ? 'Calendar invite' : KIND_LABEL[item.kind] ?? 'Draft'}
        {item.draft?.to ? ` · to ${item.draft.to_name ?? item.draft.to}` : ''}
      </Text>
      <Text style={{ fontSize: 15, fontWeight: '700', color: colours.text, marginTop: 2 }}>{item.title}</Text>
      {gmailSend && item.draft?.summary ? <Text style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>They said: {item.draft.summary}</Text> : null}
      {gmailSend && item.draft?.subject ? <Text style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>Subject: {item.draft.subject}</Text> : null}
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
