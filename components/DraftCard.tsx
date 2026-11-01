import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { decideApproval, type Approval } from '@/lib/data';
import { Card } from '@/components/ui';
import { colours, radius, space } from '@/constants/theme';

const KIND_LABEL: Record<string, string> = {
  message: 'Message',
  follow_up: 'Follow-up',
  invoice: 'Invoice reminder',
  booking: 'Booking',
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
        {KIND_LABEL[item.kind] ?? 'Draft'}
        {item.draft?.to ? ` · to ${item.draft.to}` : ''}
      </Text>
      <Text style={{ fontSize: 15, fontWeight: '700', color: colours.text, marginTop: 2 }}>{item.title}</Text>
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
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md }}>
        {body ? <Chip label={copied ? 'Copied' : 'Copy'} primary onPress={copy} disabled={busy} /> : null}
        <Chip label="Done, I sent it" onPress={() => decide('done')} disabled={busy} />
        <Chip label="Not needed" ghost onPress={() => decide('rejected')} disabled={busy} />
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
