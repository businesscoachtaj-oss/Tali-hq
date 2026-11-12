// 12 Nov 2026 (Taj: "Build it all"): Work given to you. What a teammate sees.
//
// The jobs and tasks the owner has given this person, and whatever else the owner has switched
// on for them (customers, prices, invoices, pipeline and bookings). Everything here comes from
// team_my_work, which only hands back what this person is allowed to see. Their own Tali HQ
// (journal, notes, Life side) is untouched and stays theirs.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { addCustomerNote, leaveTeam, myWork, tickMyTask, type Work } from '@/lib/team';
import { JOB_STATUS, type JobStatus } from '@/lib/jobs';
import { Button, ErrorText, Field, Label, Loading, Screen, useConfirm } from '@/components/ui';
import { Amount, aud, BLUE, Box, Chips, H, Head, Line, Pill, Sub } from '@/components/Biz';
import { Group, Note, ORANGE, Who } from '@/components/TeamUi';
import { colours, space } from '@/constants/theme';

const day = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
};
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });

export default function WorkScreen() {
  const [teams, setTeams] = useState<Work[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [which, setWhich] = useState(0);
  const [openCustomer, setOpenCustomer] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { armed, confirm } = useConfirm();

  const load = useCallback(async () => {
    setError('');
    try { setTeams(await myWork()); } catch (e: any) { setError(e?.message ?? 'Could not load your work.'); }
    setLoaded(true);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!loaded) return <Screen><Loading /></Screen>;
  if (!teams.length) {
    return (
      <Screen onRefresh={load}>
        <Head over="Team" title="Work given to you" sub="When a business adds you to its team, the jobs and tasks they give you show up here." />
        <ErrorText>{error}</ErrorText>
        <Box><Sub>Nothing here yet. If someone has invited you, make sure you signed in with the email they used.</Sub></Box>
      </Screen>
    );
  }

  const w = teams[Math.min(which, teams.length - 1)];
  const openTasks = w.tasks.filter((t) => !t.done_at);
  const jobsOn = w.jobs.filter((j) => j.status === 'accepted' || j.status === 'on');
  const run = async (work: () => Promise<void>, failed: string) => {
    setBusy(true); setError('');
    try { await work(); await load(); } catch (e: any) { setError(e?.message ?? failed); }
    setBusy(false);
  };
  const hidden = [!w.can_prices ? 'prices' : '', !w.can_money ? 'invoices' : '', !w.can_customers ? 'other customers' : ''].filter(Boolean);

  return (
    <Screen onRefresh={load}>
      <Head over={w.business} title="Work given to you" sub={`${jobsOn.length} ${jobsOn.length === 1 ? 'job' : 'jobs'} on and ${openTasks.length} ${openTasks.length === 1 ? 'task' : 'tasks'} to do. This is everything ${w.owner_name} has given you.`} />
      {teams.length > 1 ? <Chips options={teams.map((t) => t.business)} value={w.business} onChange={(v) => { setWhich(Math.max(0, teams.findIndex((t) => t.business === v))); setOpenCustomer(null); }} /> : null}
      <ErrorText>{error}</ErrorText>

      <Label>Your jobs</Label>
      {!w.jobs.length ? <Box><Sub>No jobs yet. When {w.owner_name} puts you on one it appears here.</Sub></Box> : null}
      {w.jobs.map((j) => {
        const st = JOB_STATUS[j.status as JobStatus] ?? { label: j.status, colour: BLUE };
        return (
          <Box key={j.id}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <H>{j.title}</H>
                <Sub>{[j.client_name, j.address].filter(Boolean).join(' · ') || 'No address yet'}</Sub>
              </View>
              {j.total !== null && j.total !== undefined ? <Amount>{aud(Number(j.total))}</Amount> : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
              <Pill text={st.label} colour={st.colour} />
              {j.with.length ? <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>{j.with.map((n) => <Who key={n} name={n} colour={BLUE} />)}</View> : null}
            </View>
          </Box>
        );
      })}

      <Label>Your tasks</Label>
      <Group>
        {!w.tasks.length ? <Text style={{ color: colours.muted, fontSize: 13.5, paddingVertical: 14 }}>No tasks yet.</Text> : null}
        {w.tasks.map((t, i) => (
          <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: colours.border }}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!t.done_at }} accessibilityLabel={t.title} hitSlop={8} disabled={busy} onPress={() => run(() => tickMyTask(t.id), 'Could not tick that.')}
              style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: t.done_at ? colours.purple : 'transparent', borderWidth: 2, borderColor: t.done_at ? colours.purple : colours.purpleInk }}>
              {t.done_at ? <Ionicons name="checkmark" size={16} color={colours.onPurple} /> : null}
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.done_at ? colours.muted : colours.text, fontSize: 15, fontWeight: '600', textDecorationLine: t.done_at ? 'line-through' : 'none' }}>{t.title}</Text>
              <Text style={{ color: colours.muted, fontSize: 12.5, marginTop: 1 }}>{[t.project, t.due_date ? `due ${day(t.due_date)}` : ''].filter(Boolean).join(' · ')}</Text>
            </View>
          </View>
        ))}
      </Group>

      {w.bookings ? (
        <>
          <Label>Booked in</Label>
          <Group>
            {!w.bookings.length ? <Text style={{ color: colours.muted, fontSize: 13.5, paddingVertical: 14 }}>Nothing booked in the next three weeks.</Text> : null}
            {w.bookings.map((b, i) => <Line key={b.id} first={i === 0} icon="calendar-outline" title={b.title || b.client_name || 'Booking'} sub={[`${day(b.starts_at)}, ${time(b.starts_at)}`, b.client_name, b.place].filter(Boolean).join(' · ')} />)}
          </Group>
        </>
      ) : null}

      {w.leads ? (
        <>
          <Label>Pipeline</Label>
          <Group>
            {!w.leads.length ? <Text style={{ color: colours.muted, fontSize: 13.5, paddingVertical: 14 }}>No open enquiries.</Text> : null}
            {w.leads.slice(0, 20).map((l, i) => <Line key={l.id} first={i === 0} icon="funnel-outline" colour={ORANGE} title={l.name} sub={[l.status, l.next_follow_up ? `follow up ${day(l.next_follow_up)}` : ''].filter(Boolean).join(' · ')} />)}
          </Group>
        </>
      ) : null}

      {w.customers ? (
        <>
          <Label>Customers</Label>
          <Group>
            {!w.customers.length ? <Text style={{ color: colours.muted, fontSize: 13.5, paddingVertical: 14 }}>No customers yet.</Text> : null}
            {w.customers.map((c, i) => (
              <View key={c.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: colours.border }}>
                <Pressable onPress={() => { setOpenCustomer(openCustomer === c.id ? null : c.id); setNote(''); }} accessibilityRole="button">
                  <Line first icon="person-outline" title={c.name} sub={[c.phone, c.email].filter(Boolean).join(' · ') || 'No contact details'} right={<Ionicons name={openCustomer === c.id ? 'chevron-up' : 'chevron-down'} size={16} color={colours.faint} />} />
                </Pressable>
                {openCustomer === c.id ? (
                  <View style={{ paddingBottom: 12 }}>
                    {c.notes ? <Text style={{ color: colours.text, fontSize: 13.5, lineHeight: 20, marginBottom: 10 }}>{c.notes}</Text> : <Text style={{ color: colours.muted, fontSize: 13, marginBottom: 10 }}>No notes yet.</Text>}
                    <Field label="Add a note" value={note} onChangeText={setNote} placeholder="Side gate code is 4471" maxLength={500} />
                    <Button title="Save the note" kind="ghost" disabled={busy || !note.trim()} onPress={() => run(async () => { await addCustomerNote(w.team_id, c.id, note); setNote(''); }, 'Could not add that note.')} />
                  </View>
                ) : null}
              </View>
            ))}
          </Group>
        </>
      ) : null}

      {w.invoices ? (
        <>
          <Label>Invoices</Label>
          <Group>
            {!w.invoices.length ? <Text style={{ color: colours.muted, fontSize: 13.5, paddingVertical: 14 }}>No invoices yet.</Text> : null}
            {w.invoices.slice(0, 20).map((v, i) => <Line key={v.id} first={i === 0} icon="receipt-outline" title={`${v.client_name} · ${aud(Number(v.total))}`} sub={[v.number, v.status, v.status === 'paid' ? '' : `due ${day(v.due_date)}`].filter(Boolean).join(' · ')} />)}
          </Group>
        </>
      ) : null}

      {hidden.length ? <Note icon="lock-closed-outline">{hidden.join(', ').replace(/^./, (ch) => ch.toUpperCase())} are hidden. Ask {w.owner_name} if you need to see more.</Note> : null}
      <Button title={armed === 'leave' ? `Tap again to leave ${w.business}` : `Leave ${w.business}`} kind="danger" disabled={busy} onPress={() => confirm('leave', () => run(() => leaveTeam(w.team_id), 'Could not leave. Try again.'))} />
      <Note icon="eye-off-outline">{w.owner_name} sees the work they give you. They cannot see your journal, your notes or what you say to Tali.</Note>
    </Screen>
  );
}
