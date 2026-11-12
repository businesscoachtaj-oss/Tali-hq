// 12 Nov 2026 (Taj): Jobs and quotes. A quote becomes a job, and a job becomes an invoice.
// One screen: the list, and a job opened for editing. Part of the Business plans.
import { useCallback, useMemo, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { clients as loadClients, invoiceSettings, myCredits, type Client, type Credits, type InvoiceItem, type InvoiceSettings } from '@/lib/data';
import { JOB_STATUS, JOB_STEPS, deleteJob, invoiceJob, jobGroup, jobNext, jobs as loadJobs, saveJob, setJobStatus, shareQuote, type Job, type JobStatus } from '@/lib/jobs';
import { hasBusinessTools } from '@/lib/plan';
import { Button, ErrorText, Field, Label, Loading, Screen, useConfirm } from '@/components/ui';
import { Amount, aud, Bar, Box, Chips, H, Head, Next, Pill, Stats, Sub } from '@/components/Biz';
import { BizLock } from '@/components/BizLock';
import { BizTag, BusinessBar, settingsForBusiness, useBusinesses } from '@/lib/businesses';
import { jobPeople, myTeam, setOnJob, type JobPerson, type TeamMember } from '@/lib/team';
import { colourFor, Face, Note, Who } from '@/components/TeamUi';
import { colours, radius, space } from '@/constants/theme';

type Draft = { id?: string; title: string; client_id: string | null; client_name: string; client_email: string; address: string; items: { description: string; qty: string; unit_price: string }[]; gst: boolean; notes: string };
const blankItem = () => ({ description: '', qty: '1', unit_price: '' });
const toDraft = (j: Job): Draft => ({ id: j.id, title: j.title, client_id: j.client_id, client_name: j.client_name, client_email: j.client_email ?? '', address: j.address, items: j.items.length ? j.items.map((i) => ({ description: i.description, qty: String(i.qty), unit_price: String(i.unit_price) })) : [blankItem()], gst: j.gst, notes: j.notes });
const toItems = (d: Draft): InvoiceItem[] => d.items.filter((i) => i.description.trim()).map((i) => ({ description: i.description, qty: Number(i.qty.replace(',', '.')) || 1, unit_price: Number(i.unit_price.replace(/[^0-9.]/g, '')) || 0 }));

export default function Jobs() {
  const { session, profile } = useAuth();
  const [credits, setCredits] = useState<Credits | null>(null);
  const [list, setList] = useState<Job[]>([]);
  const [people, setPeople] = useState<Client[]>([]);
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState('All');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { armed, confirm } = useConfirm();
  // 12 Nov 2026: more than one business, and who on the team is on each job.
  const biz = useBusinesses();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [onJobs, setOnJobs] = useState<JobPerson[]>([]);

  const load = useCallback(async () => {
    setError('');
    try {
      const c = await myCredits();
      setCredits(c);
      if (hasBusinessTools(c, session?.user.id)) {
        const [j, p, s] = await Promise.all([loadJobs(), loadClients().catch(() => []), invoiceSettings().catch(() => null)]);
        setList(j); setPeople(p.filter((x) => x.kind === 'client' || x.kind === 'lead')); setSettings(s);
        // The team is extra: a failure here never stops the jobs showing.
        Promise.all([myTeam(), jobPeople()]).then(([t, jp]) => { setTeam(t.members); setOnJobs(jp); }).catch(() => {});
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your jobs.');
    }
    setLoaded(true);
  }, [session?.user.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = draft?.id ? list.find((j) => j.id === draft.id) ?? null : null;
  const total = useMemo(() => {
    if (!draft) return { sub: 0, gst: 0, total: 0 };
    const sub = toItems(draft).reduce((a, i) => a + Math.round(i.qty * i.unit_price * 100) / 100, 0);
    const gst = draft.gst ? Math.round(sub * 10) / 100 : 0;
    return { sub, gst, total: sub + gst };
  }, [draft]);

  if (!loaded) return <Screen><Loading /></Screen>;
  if (!hasBusinessTools(credits, session?.user.id)) {
    return <BizLock title="Jobs and quotes" sub="A quote becomes a job, and a job becomes an invoice. Tali keeps each one moving and tells you what is next."
      points={[{ icon: 'document-text-outline', title: 'Quotes in a minute', sub: 'Line items, GST and a clean PDF to send' }, { icon: 'hammer-outline', title: 'Every job in one place', sub: 'Quoted, accepted, on now, done' }, { icon: 'cash-outline', title: 'One tap to invoice', sub: 'The quote becomes the invoice, nothing typed twice' }]} />;
  }

  async function save(status?: JobStatus): Promise<Job | null> {
    if (!draft) return null;
    setError('');
    if (!draft.title.trim()) { setError('Give the job a name.'); return null; }
    setBusy(true);
    try {
      const saved = await saveJob({ id: draft.id, client_id: draft.client_id, client_name: draft.client_name, client_email: draft.client_email, title: draft.title, address: draft.address, items: toItems(draft), gst: draft.gst, notes: draft.notes, ...(status ? { status } : {}) });
      setList((l) => [saved, ...l.filter((x) => x.id !== saved.id)]);
      setDraft(toDraft(saved));
      setBusy(false);
      return saved;
    } catch (e: any) {
      setError(e?.message ?? 'Could not save that.');
      setBusy(false);
      return null;
    }
  }
  async function move(status: JobStatus) {
    const saved = await save(status);
    if (saved && status === 'lost') setDraft(null);
  }
  async function share() {
    const saved = await save();
    if (!saved) return;
    try { await shareQuote(saved, settingsForBusiness(settings, saved.business_id), profile?.business_name || profile?.first_name || ''); } catch (e: any) { setError(e?.message ?? 'Could not make the PDF.'); }
  }
  async function invoice() {
    const saved = await save();
    if (!saved) return;
    setBusy(true);
    try {
      await invoiceJob(saved, settings?.default_due_days ?? 7);
      setBusy(false);
      setDraft(null);
      router.navigate('/invoices');
    } catch (e: any) {
      setError(e?.message ?? 'Could not make the invoice.');
      setBusy(false);
    }
  }
  async function remove() {
    if (!draft?.id) return;
    setBusy(true);
    try { await deleteJob(draft.id); setList((l) => l.filter((x) => x.id !== draft.id)); setDraft(null); } catch (e: any) { setError(e?.message ?? 'Could not delete that.'); }
    setBusy(false);
  }

  if (draft) {
    const status: JobStatus = open?.status ?? 'quote';
    const step = JOB_STEPS.indexOf(status);
    const typed = draft.client_name.trim().toLowerCase();
    const matches = draft.client_id ? [] : people.filter((p) => !typed || p.name.toLowerCase().includes(typed)).slice(0, 5);
    const setItem = (n: number, patch: Partial<Draft['items'][number]>) => setDraft({ ...draft, items: draft.items.map((it, i) => (i === n ? { ...it, ...patch } : it)) });
    return (
      <Screen>
        <Head back="Jobs and quotes" to="/jobs" over={open ? `${open.number} · ${JOB_STATUS[status].label}` : 'New quote'} title={draft.title.trim() || 'New quote'} sub={open ? jobNext(open) ?? 'Everything about this job.' : 'What is the job, who is it for, and what is in it.'} />
        {open && status !== 'lost' ? (
          <>
            <View style={{ flexDirection: 'row', gap: 4, marginBottom: 6 }}>
              {JOB_STEPS.map((s, i) => <View key={s} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= step ? JOB_STATUS[status].colour : 'rgba(255,255,255,0.14)' }} />)}
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 14 }}>
              {['Quote', 'Sent', 'Accepted', 'On now', 'Done', 'Invoiced'].map((s, i) => <Text key={s} style={{ flex: 1, fontSize: 10, fontWeight: '700', color: i <= step ? JOB_STATUS[status].colour : colours.faint }}>{s}</Text>)}
            </View>
          </>
        ) : null}
        <Field label="The job" value={draft.title} onChangeText={(v) => setDraft({ ...draft, title: v })} placeholder="Front garden makeover" maxLength={160} autoFocus={!draft.id} />
        <Field label="Who it is for" value={draft.client_name} onChangeText={(v) => setDraft({ ...draft, client_name: v, client_id: null })} placeholder="Their name" maxLength={120} />
        {matches.length && (typed || !draft.client_name) ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -4, marginBottom: space.md }}>
            {matches.map((p) => (
              <Pressable key={p.id} onPress={() => setDraft({ ...draft, client_id: p.id, client_name: p.name, client_email: draft.client_email || p.email || '' })} accessibilityRole="button"
                style={{ borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: colours.sunk, borderWidth: 1, borderColor: colours.border }}>
                <Text style={{ color: colours.text, fontSize: 13, fontWeight: '600' }}>{p.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Field label="Their email (optional)" value={draft.client_email} onChangeText={(v) => setDraft({ ...draft, client_email: v })} placeholder="name@example.com" autoCapitalize="none" keyboardType="email-address" />
        <Field label="Where (optional)" value={draft.address} onChangeText={(v) => setDraft({ ...draft, address: v })} placeholder="12 Marine Parade, Torquay" maxLength={300} />

        <Label>What is in it</Label>
        {draft.items.map((it, n) => (
          <View key={n} style={{ backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, padding: 12, marginBottom: space.sm }}>
            <TextInput value={it.description} onChangeText={(v) => setItem(n, { description: v })} placeholder="What it is" placeholderTextColor={colours.faint} accessibilityLabel={`Line ${n + 1}, what it is`}
              style={{ color: colours.text, fontSize: 15, fontWeight: '600', paddingVertical: 6 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <Text style={{ color: colours.muted, fontSize: 13 }}>How many</Text>
              <TextInput value={it.qty} onChangeText={(v) => setItem(n, { qty: v })} keyboardType="decimal-pad" accessibilityLabel={`Line ${n + 1}, how many`}
                style={{ width: 56, color: colours.text, fontSize: 15, backgroundColor: colours.sunk, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, textAlign: 'center' }} />
              <Text style={{ color: colours.muted, fontSize: 13 }}>Price each A$</Text>
              <TextInput value={it.unit_price} onChangeText={(v) => setItem(n, { unit_price: v })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colours.faint} accessibilityLabel={`Line ${n + 1}, price each`}
                style={{ flex: 1, minWidth: 0, width: 0, color: colours.text, fontSize: 15, backgroundColor: colours.sunk, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8 }} />
              {draft.items.length > 1 ? (
                <Pressable onPress={() => setDraft({ ...draft, items: draft.items.filter((_, i) => i !== n) })} accessibilityRole="button" accessibilityLabel={`Remove line ${n + 1}`} hitSlop={8}>
                  <Ionicons name="close-circle-outline" size={22} color={colours.muted} />
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
        <Button title="Add a line" kind="ghost" onPress={() => setDraft({ ...draft, items: [...draft.items, blankItem()] })} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, padding: 14, marginVertical: space.sm }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: colours.text }}>Add GST</Text>
            <Text style={{ color: colours.muted, fontSize: 13, marginTop: 2 }}>10% on top of the lines above.</Text>
          </View>
          <Switch value={draft.gst} onValueChange={(v) => setDraft({ ...draft, gst: v })} trackColor={{ true: colours.purple, false: colours.borderStrong }} thumbColor="#FFFFFF" {...({ activeThumbColor: '#FFFFFF' } as object)} />
        </View>
        <Box>
          {draft.gst ? <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}><Text style={{ color: colours.muted }}>GST</Text><Text style={{ color: colours.muted, fontWeight: '700' }}>{aud(total.gst)}</Text></View> : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><H>Total</H><Text style={{ color: colours.good, fontSize: 22, fontWeight: '800' }}>{aud(total.total)}</Text></View>
        </Box>
        <Field label="Notes (optional)" value={draft.notes} onChangeText={(v) => setDraft({ ...draft, notes: v })} multiline maxLength={2000} placeholder="Anything they should know, or anything for you" style={{ minHeight: 80, textAlignVertical: 'top' }} />
        {open && team.length ? (
          <>
            <Label>Who is on it</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space.md }}>
              {team.map((m) => {
                const on = onJobs.some((x) => x.job_id === open.id && x.team_member_id === m.id);
                const c = colourFor(m.id);
                return (
                  <Pressable key={m.id} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${m.name}${on ? ', on this job' : ''}`}
                    onPress={async () => {
                      setError('');
                      setOnJobs((l) => (on ? l.filter((x) => !(x.job_id === open.id && x.team_member_id === m.id)) : [...l, { job_id: open.id, team_member_id: m.id }]));
                      try { await setOnJob(open.id, m.id, !on); } catch (e: any) { setError(e?.message ?? 'Could not change who is on it.'); jobPeople().then(setOnJobs).catch(() => {}); }
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.pill, paddingVertical: 6, paddingLeft: 6, paddingRight: 12, backgroundColor: on ? c + '26' : colours.sunk, borderWidth: 1, borderColor: on ? c + '99' : colours.border }}>
                    <Face name={m.name} colour={c} size={26} />
                    <Text style={{ color: on ? colours.text : colours.muted, fontSize: 13.5, fontWeight: '700' }}>{m.name.trim().split(/\s+/)[0]}</Text>
                    {on ? <Ionicons name="checkmark" size={14} color={c} /> : null}
                  </Pressable>
                );
              })}
            </View>
            <Note icon="eye-outline">Anyone on this job sees it, the address and their tasks. They only see the price if you switched prices on for them in Your team.</Note>
          </>
        ) : null}
        <ErrorText>{error}</ErrorText>

        {status === 'quote' ? <><Button title="Share the quote" onPress={share} busy={busy} /><Button title="Mark it as sent" kind="ghost" onPress={() => move('sent')} disabled={busy} /></> : null}
        {status === 'sent' ? <><Button title="They said yes" onPress={() => move('accepted')} busy={busy} /><Button title="Share the quote again" kind="ghost" onPress={share} disabled={busy} /><Button title={armed === 'lost' ? 'Tap again, not going ahead' : 'Not going ahead'} kind="ghost" onPress={() => confirm('lost', () => move('lost'))} disabled={busy} /></> : null}
        {status === 'accepted' ? <Button title="The work has started" onPress={() => move('on')} busy={busy} /> : null}
        {status === 'on' ? <Button title="The job is done" onPress={() => move('done')} busy={busy} /> : null}
        {status === 'done' ? <Button title="Make the invoice" onPress={invoice} busy={busy} /> : null}
        {status === 'invoiced' ? <Button title="Open invoices" onPress={() => router.navigate('/invoices')} /> : null}
        {status === 'lost' ? <Button title="Open it again as a quote" onPress={() => move('quote')} busy={busy} /> : null}
        <Button title={draft.id ? 'Save changes' : 'Save the quote'} kind={draft.id ? 'ghost' : 'primary'} onPress={() => save()} disabled={busy} />
        {draft.id ? <Button title={armed === 'delete' ? 'Tap again to delete' : 'Delete'} kind="danger" disabled={busy} onPress={() => confirm('delete', remove)} /> : null}
      </Screen>
    );
  }

  const mine = list.filter(biz.visible); // the business in use, or all of them
  const quotesOut = mine.filter((j) => j.status === 'sent');
  const onNow = mine.filter((j) => j.status === 'accepted' || j.status === 'on');
  const toInvoice = mine.filter((j) => j.status === 'done');
  const shown = mine.filter((j) => filter === 'All' || jobGroup(j.status) === filter);
  return (
    <Screen onRefresh={load}>
      <BusinessBar />
      <Head over="Business" title="Jobs and quotes" sub="A quote becomes a job, and a job becomes an invoice. Each one shows what is next." />
      <Stats items={[{ label: 'quotes out', value: aud(quotesOut.reduce((a, j) => a + j.total, 0)), colour: '#FFB561' }, { label: 'jobs on now', value: String(onNow.length) }, { label: 'ready to invoice', value: aud(toInvoice.reduce((a, j) => a + j.total, 0)), colour: colours.good }]} />
      <Button title="New quote" onPress={() => { setError(''); setDraft({ title: '', client_id: null, client_name: '', client_email: '', address: '', items: [blankItem()], gst: !!settings?.gst_registered, notes: '' }); }} />
      <Button title="Tell Tali about a job" kind="ghost" onPress={() => router.navigate({ pathname: '/talk', params: { ask: 'Help me price a quote for ' } })} />
      <ErrorText>{error}</ErrorText>
      <View style={{ height: 12 }} />
      {mine.length ? <Chips options={['All', 'Quotes', 'On now', 'Done']} value={filter} onChange={setFilter} /> : null}
      {!mine.length ? <Box><Sub>No quotes yet. Tap New quote, add what is in it, and share it as a PDF.</Sub></Box> : null}
      {mine.length && !shown.length ? <Box><Sub>Nothing here.</Sub></Box> : null}
      {shown.map((j) => {
        const next = jobNext(j);
        const step = JOB_STEPS.indexOf(j.status);
        return (
          <Box key={j.id} onPress={() => { setError(''); setDraft(toDraft(j)); }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ flex: 1 }}><H>{j.title}</H><Sub>{[j.client_name, j.number].filter(Boolean).join(' · ')}</Sub></View>
              <Amount>{aud(j.total)}</Amount>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <Pill text={JOB_STATUS[j.status].label} colour={JOB_STATUS[j.status].colour} />
              <BizTag id={j.business_id} />
              <View style={{ flex: 1 }} />
              {team.length ? (() => {
                const who = team.filter((m) => onJobs.some((x) => x.job_id === j.id && x.team_member_id === m.id));
                if (who.length) return <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>{who.map((m) => <Who key={m.id} name={m.name} colour={colourFor(m.id)} />)}</View>;
                return j.status === 'accepted' || j.status === 'on' ? <Text style={{ color: colours.danger, fontSize: 12.5, fontWeight: '700' }}>Nobody on it</Text> : null;
              })() : null}
            </View>
            {j.status === 'accepted' || j.status === 'on' ? <View style={{ marginTop: 10 }}><Bar pct={((step + 1) / JOB_STEPS.length) * 100} colour={JOB_STATUS[j.status].colour} /></View> : null}
            {next ? <Next>{next}</Next> : null}
          </Box>
        );
      })}
    </Screen>
  );
}
