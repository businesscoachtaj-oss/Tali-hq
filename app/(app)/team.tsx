// 12 Nov 2026 (Taj: "Build it all"): Your team. Part of the Business plans.
// One screen: the list, inviting someone, and one person opened.
//
// Each teammate has their own login, their own Tali and their own credits (a Standard or a
// Premium seat). They always see the jobs and tasks given to them. The owner switches on more
// per person. Nobody on a team sees the owner's journal, Life side or Tali's memories.
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { myCredits, type Credits } from '@/lib/data';
import { hasBusinessTools } from '@/lib/plan';
import { accessLine, inviteTeammate, myTeam, removeTeammate, seatsCost, setAccess, setSeat, SEATS, type Access, type Seat, type TeamMember } from '@/lib/team';
import { Button, ErrorText, Field, Label, Loading, Screen, useConfirm } from '@/components/ui';
import { BLUE, Box, H, Head, Pill, Stats, Sub, TaliLine } from '@/components/Biz';
import { BizLock } from '@/components/BizLock';
import { colourFor, Face, GREEN, Group, Note, ORANGE, SeatPick, Toggle, Usage } from '@/components/TeamUi';
import { colours } from '@/constants/theme';

type Draft = { name: string; email: string; role_title: string; seat: Seat } & Access;
const blank = (): Draft => ({ name: '', email: '', role_title: '', seat: 'standard', can_customers: false, can_prices: false, can_money: false, can_pipeline: false });
const money = (n: number) => `A$${n.toFixed(2)}`;

function AccessToggles({ who, value, onChange }: { who: string; value: Access; onChange: (a: Access) => void }) {
  return (
    <Group>
      <Toggle first locked on icon="hammer-outline" title={`Jobs and tasks you give ${who}`} sub="The job, where it is, what to do and when. Nothing else about the customer." />
      <Toggle on={value.can_customers} onChange={(v) => onChange({ ...value, can_customers: v })} icon="people-outline" title="Customers" sub="Names, phone numbers and notes for every customer. They can add a note." />
      <Toggle on={value.can_prices} onChange={(v) => onChange({ ...value, can_prices: v })} icon="pricetag-outline" title="Quotes and prices" sub="What each job is quoted at. Off means prices are hidden on their jobs." />
      <Toggle on={value.can_money} onChange={(v) => onChange({ ...value, can_money: v })} icon="cash-outline" title="Invoices and money" sub="Your invoices and what is owed." />
      <Toggle on={value.can_pipeline} onChange={(v) => onChange({ ...value, can_pipeline: v })} icon="funnel-outline" title="Pipeline and bookings" sub="New enquiries, and who is booked in." />
    </Group>
  );
}

export default function Team() {
  const { session } = useAuth();
  const [credits, setCredits] = useState<Credits | null>(null);
  const [list, setList] = useState<TeamMember[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [edit, setEdit] = useState<(Access & { name: string; role_title: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const { armed, confirm } = useConfirm();

  const load = useCallback(async () => {
    setError('');
    try {
      const c = await myCredits();
      setCredits(c);
      if (hasBusinessTools(c, session?.user.id)) setList((await myTeam()).members);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your team.');
    }
    setLoaded(true);
  }, [session?.user.id]);
  useFocusLoad(load); // Speed pass (13 Nov 2026): see lib/useFocusLoad.ts

  if (!loaded) return <Screen><Loading /></Screen>;
  if (!hasBusinessTools(credits, session?.user.id)) {
    return <BizLock title="Your team" sub="Give someone a job or a task and they see just that. You choose what else each person can see."
      points={[{ icon: 'people-outline', title: 'A seat for each person', sub: 'Their own login, their own Tali, their own credits' }, { icon: 'hammer-outline', title: 'Hand out jobs and tasks', sub: 'They see their work and tick it off' }, { icon: 'lock-closed-outline', title: 'You choose what they see', sub: 'Customers, prices, money and pipeline, switched on per person' }]} />;
  }

  const person = list.find((m) => m.id === openId) ?? null;

  async function invite() {
    if (!draft) return;
    setError('');
    if (!draft.name.trim()) { setError('What is their name?'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(draft.email.trim())) { setError("That email doesn't look right."); return; }
    setBusy(true);
    const res = await inviteTeammate({ ...draft, name: draft.name.trim(), email: draft.email.trim().toLowerCase(), role_title: draft.role_title.trim() });
    setBusy(false);
    if (!res.ok) { setError(res.message ?? 'Could not send that invite.'); return; }
    const first = draft.name.trim().split(/\s+/)[0];
    setNotice(res.joined ? `${first} already has Tali HQ, so they are on the team now.` : res.emailed ? `Invite sent. ${first} joins when they sign in with that email.` : `${first} is added. The email did not go out, so tell them to sign in to Tali HQ with that email.`);
    setDraft(null);
    load();
  }

  if (draft) {
    const first = draft.name.trim().split(/\s+/)[0] || 'them';
    return (
      <Screen>
        <Head back="Your team" to="/team" over="New teammate" title="Invite someone" sub="They get their own login. You can change what they see at any time." />
        <Field label="Their name" value={draft.name} onChangeText={(v) => setDraft({ ...draft, name: v })} placeholder="First and last name" maxLength={80} autoFocus />
        <Field label="Their email" value={draft.email} onChangeText={(v) => setDraft({ ...draft, email: v })} placeholder="name@example.com" autoCapitalize="none" keyboardType="email-address" />
        <Field label="What they do (optional)" value={draft.role_title} onChangeText={(v) => setDraft({ ...draft, role_title: v })} placeholder="Leading hand, bookkeeper" maxLength={60} />
        <Label>Their seat</Label>
        <SeatPick value={draft.seat} onChange={(seat) => setDraft({ ...draft, seat })} />
        <Label>What they can see</Label>
        <AccessToggles who={first} value={draft} onChange={(a) => setDraft({ ...draft, ...a })} />
        <Note icon="sparkles-outline">{first === 'them' ? 'They get' : `${first} gets`} their own Tali and their own credits. You can move them between Standard and Premium later.</Note>
        <Note icon="card-outline">{SEATS[draft.seat].label}: {money(SEATS[draft.seat].price)} a month, added to your plan. The rest of this month is charged now.</Note>
        <ErrorText>{error}</ErrorText>
        <Button title="Send the invite" onPress={invite} busy={busy} />
        <Button title="Not now" kind="ghost" onPress={() => { setDraft(null); setError(''); }} disabled={busy} />
      </Screen>
    );
  }

  if (person) {
    const colour = colourFor(person.id);
    const first = person.name.trim().split(/\s+/)[0];
    const e = edit ?? { name: person.name, role_title: person.role_title, can_customers: person.can_customers, can_prices: person.can_prices, can_money: person.can_money, can_pipeline: person.can_pipeline };
    const save = async (next: typeof e) => {
      setEdit(next); setError('');
      try { await setAccess({ id: person.id, ...next }); setList((l) => l.map((m) => (m.id === person.id ? { ...m, ...next } : m))); } catch (err: any) { setError(err?.message ?? 'Could not save that.'); }
    };
    const changeSeat = async (seat: Seat) => {
      setBusy(true); setError('');
      const res = await setSeat(person.id, seat);
      setBusy(false);
      if (!res.ok) { setError(res.message ?? 'Could not change the seat.'); return; }
      load();
    };
    const remove = async () => {
      setBusy(true); setError('');
      const res = await removeTeammate(person.id);
      setBusy(false);
      if (!res.ok) { setError(res.message ?? 'Could not remove them.'); return; }
      setOpenId(null); setEdit(null); load();
    };
    return (
      <Screen>
        <Head back="Your team" to="/team" over={[person.role_title, person.status === 'active' ? 'On the team' : 'Invite sent'].filter(Boolean).join(' · ')} title={person.name}
          sub={person.status === 'active' ? `${first} sees their own jobs and tasks, plus what you switch on below.` : `${first} joins when they sign in to Tali HQ with ${person.email}.`} />
        <Stats items={[{ label: 'jobs on now', value: String(person.jobs), colour: BLUE }, { label: 'tasks open', value: String(person.tasks_open), colour: ORANGE }, { label: 'done this month', value: String(person.tasks_done), colour: GREEN }]} />
        <Label>Their seat</Label>
        <SeatPick value={person.seat} onChange={changeSeat} disabled={busy} />
        {person.status === 'active' ? (
          <Box>
            <H>Tali use this month</H>
            <Usage used={person.used} of={person.allowance} colour={colour} />
            <Sub>Resets on the 1st. Their credits are theirs, they do not come out of yours.</Sub>
          </Box>
        ) : null}
        <Label>What {first} can see</Label>
        <AccessToggles who={first} value={e} onChange={(a) => save({ ...e, ...a })} />
        <Field label="What they do (optional)" value={e.role_title} onChangeText={(v) => setEdit({ ...e, role_title: v })} onBlur={() => save(e)} placeholder="Leading hand, bookkeeper" maxLength={60} />
        <ErrorText>{error}</ErrorText>
        <Button title={`Give ${first} a job`} onPress={() => router.navigate('/jobs')} />
        <Button title={armed === 'remove' ? 'Tap again to remove them' : 'Remove from the team'} kind="danger" disabled={busy} onPress={() => confirm('remove', remove)} />
        <Note icon="information-circle-outline">Removing {first} frees the seat from your next bill. Their own Tali HQ account stays theirs, on the Free plan.</Note>
      </Screen>
    );
  }

  const active = list.filter((m) => m.status === 'active');
  const nearly = active.find((m) => m.seat === 'standard' && m.used / m.allowance > 0.9);
  return (
    <Screen onRefresh={load}>
      <Head over="Business" title="Your team" sub="Give someone a job or a task and they see just that. You choose what else each person can see." />
      <Stats items={[{ label: 'seats in use', value: String(list.length) }, { label: 'jobs given out', value: String(list.reduce((a, m) => a + m.jobs, 0)), colour: BLUE }, { label: 'seats a month', value: money(seatsCost(list)), colour: ORANGE }]} />
      {notice ? <TaliLine>{notice}</TaliLine> : nearly ? <TaliLine>{nearly.name.split(' ')[0]} has nearly used their Tali credits for the month. A Premium seat would cover them, or they wait until the 1st.</TaliLine> : null}
      <ErrorText>{error}</ErrorText>
      {!list.length ? <Box><Sub>Nobody yet. Invite someone, give them a job, and it shows up on their phone.</Sub></Box> : null}
      {list.map((m) => {
        const colour = colourFor(m.id);
        return (
          <Box key={m.id} onPress={() => { setError(''); setNotice(''); setEdit(null); setOpenId(m.id); }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Face name={m.name} colour={colour} />
              <View style={{ flex: 1 }}>
                <H>{m.name}</H>
                <Sub>{[m.role_title, m.status === 'active' ? `${m.jobs} ${m.jobs === 1 ? 'job' : 'jobs'} · ${m.tasks_open} ${m.tasks_open === 1 ? 'task' : 'tasks'} open` : 'Invite sent'].filter(Boolean).join(' · ')}</Sub>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colours.faint} />
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <Pill text={accessLine(m)} colour={colour} />
              <Pill text={SEATS[m.seat].label} colour={m.seat === 'premium' ? ORANGE : colours.faint} />
            </View>
            {m.status === 'active' ? <Usage used={m.used} of={m.allowance} colour={colour} /> : null}
          </Box>
        );
      })}
      <Button title="Invite a teammate" onPress={() => { setError(''); setNotice(''); setDraft(blank()); }} />
      <View style={{ height: 12 }} />
      <Note icon="lock-closed-outline">Nobody on your team sees your journal, your Life side, or what Tali remembers about you. That stays yours.</Note>
    </Screen>
  );
}
