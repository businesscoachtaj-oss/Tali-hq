import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { completeReminder, saveClient, type Client, type Reminder } from '@/lib/data';
import { friendlyDate, friendlyTime, today } from '@/lib/dates';
import { Card } from '@/components/ui';
import { colours, space } from '@/constants/theme';

// Reminders and client follow-ups due today or overdue, each with a tick.
export function DueList({ reminders, followUps, onChange }: { reminders: Reminder[]; followUps: Client[]; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function tickReminder(id: string) {
    setBusy(id);
    try {
      await completeReminder(id);
    } finally {
      setBusy(null);
      onChange();
    }
  }

  // Following up clears the date and stamps today as last contact.
  async function tickFollowUp(c: Client) {
    setBusy(c.id);
    try {
      await saveClient({ ...c, next_follow_up: null, last_contact_at: today() });
    } finally {
      setBusy(null);
      onChange();
    }
  }

  return (
    <Card>
      {reminders.map((r, i) => (
        <Row key={r.id} first={i === 0} busy={busy === r.id} onTick={() => tickReminder(r.id)} title={r.text} meta={friendlyTime(r.due_at)} late={new Date(r.due_at) < new Date()} />
      ))}
      {followUps.map((c, i) => (
        <Row key={c.id} first={reminders.length === 0 && i === 0} busy={busy === c.id} onTick={() => tickFollowUp(c)} onOpen={() => router.navigate('/clients')}
          title={`Follow up ${c.name}`} meta={c.next_follow_up ? friendlyDate(c.next_follow_up) : ''} late={!!c.next_follow_up && c.next_follow_up < today()} />
      ))}
    </Card>
  );
}

function Row({ title, meta, late, busy, first, onTick, onOpen }: { title: string; meta: string; late: boolean; busy: boolean; first: boolean; onTick: () => void; onOpen?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderTopWidth: first ? 0 : 1, borderTopColor: colours.border }}>
      <Pressable accessibilityRole="checkbox" accessibilityLabel={`Done: ${title}`} onPress={busy ? undefined : onTick} hitSlop={8}
        style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colours.purple, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.4 : 1 }}>
        {busy ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colours.purple }} /> : null}
      </Pressable>
      <Pressable style={{ flex: 1 }} onPress={onOpen} disabled={!onOpen}>
        <Text style={{ fontSize: 15, color: colours.text, lineHeight: 21 }}>{title}</Text>
        {meta ? <Text style={{ fontSize: 12, color: late ? colours.orange : colours.muted, fontWeight: late ? '700' : '400', marginTop: 1 }}>{meta}</Text> : null}
      </Pressable>
    </View>
  );
}
