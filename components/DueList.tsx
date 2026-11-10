import { useState, type ReactNode } from 'react';
import { useHasBusiness } from '@/lib/business';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { completeReminder, deleteReminder, rescheduleReminder, saveClient, type Client, type Reminder } from '@/lib/data';
import { addDays, friendlyDate, friendlyTime, today } from '@/lib/dates';
import { Card, ErrorText, useConfirm } from '@/components/ui';
import { colours, space } from '@/constants/theme';

// Reminders and client follow-ups due today or overdue, each with a tick.
// 4 Nov 2026: errors show under the list instead of vanishing, follow-ups open the person, and each
// reminder has two small actions: Tomorrow (9am) and Delete (two taps).
export function DueList({ reminders, followUps, onChange }: { reminders: Reminder[]; followUps: Client[]; onChange: () => void }) {
  const biz = useHasBusiness(); // with no business these are people to check in with, not follow-ups
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const { armed, confirm } = useConfirm();

  async function run(id: string, work: () => Promise<void>, fail: string) {
    setBusy(id);
    setError('');
    try {
      await work();
    } catch (e: any) {
      setError(e?.message ? `${fail} ${e.message}` : fail);
    } finally {
      setBusy(null);
      onChange();
    }
  }

  const tickReminder = (id: string) => run(id, () => completeReminder(id), "Couldn't tick that off.");
  // Following up clears the date and stamps today as last contact.
  const tickFollowUp = (c: Client) => run(c.id, () => saveClient({ ...c, next_follow_up: null, last_contact_at: today() }), "Couldn't mark that follow-up done.");
  const snooze = (id: string) => {
    const d = addDays(new Date(), 1);
    const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0, 0);
    return run(id, () => rescheduleReminder(id, at), "Couldn't move that to tomorrow.");
  };
  const remove = (id: string) => run(id, () => deleteReminder(id), "Couldn't delete that.");

  return (
    <Card>
      {reminders.map((r, i) => (
        <Row key={r.id} first={i === 0} busy={busy === r.id} onTick={() => tickReminder(r.id)} title={r.text} meta={friendlyTime(r.due_at)} late={new Date(r.due_at) < new Date()}>
          <View style={{ flexDirection: 'row', gap: space.md, marginTop: 4 }}>
            <Action label="Tomorrow" onPress={() => snooze(r.id)} disabled={busy === r.id} />
            <Action label={armed === r.id ? 'Sure?' : 'Delete'} danger={armed === r.id} onPress={() => confirm(r.id, () => remove(r.id))} disabled={busy === r.id} />
          </View>
        </Row>
      ))}
      {followUps.map((c, i) => (
        <Row key={c.id} first={reminders.length === 0 && i === 0} busy={busy === c.id} onTick={() => tickFollowUp(c)} onOpen={() => router.navigate({ pathname: '/person', params: { id: c.id } } as any)}
          title={biz ? `Follow up ${c.name}` : `Check in with ${c.name}`} meta={c.next_follow_up ? friendlyDate(c.next_follow_up) : ''} late={!!c.next_follow_up && c.next_follow_up < today()} />
      ))}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

function Row({ title, meta, late, busy, first, onTick, onOpen, children }: { title: string; meta: string; late: boolean; busy: boolean; first: boolean; onTick: () => void; onOpen?: () => void; children?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.sm, borderTopWidth: first ? 0 : 1, borderTopColor: colours.border }}>
      <Pressable accessibilityRole="checkbox" accessibilityLabel={`Done: ${title}`} onPress={busy ? undefined : onTick} hitSlop={8}
        style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colours.purple, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.4 : 1, marginTop: 1 }}>
        {busy ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colours.purple }} /> : null}
      </Pressable>
      <View style={{ flex: 1 }}>
        <Pressable onPress={onOpen} disabled={!onOpen} accessibilityRole={onOpen ? 'button' : undefined}>
          <Text style={{ fontSize: 15, color: colours.text, lineHeight: 21 }}>{title}</Text>
          {meta ? <Text style={{ fontSize: 12, color: late ? colours.orange : colours.muted, fontWeight: late ? '700' : '400', marginTop: 1 }}>{meta}</Text> : null}
        </Pressable>
        {children}
      </View>
      {onOpen ? <Text style={{ fontSize: 20, color: colours.faint, lineHeight: 26 }}>{'›'}</Text> : null}
    </View>
  );
}

function Action({ label, onPress, disabled, danger }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <Pressable onPress={disabled ? undefined : onPress} accessibilityRole="button" hitSlop={6} style={{ opacity: disabled ? 0.5 : 1 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: danger ? colours.danger : colours.purple }}>{label}</Text>
    </Pressable>
  );
}
