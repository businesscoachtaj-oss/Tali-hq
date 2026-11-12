// 12 Nov 2026 (Taj: "Build it all"): Which business? Part of the Business plans.
// One screen: pick the business you are working in (or see them all together), add another,
// and open one to change its details or remove it.
//
// Each business keeps its own jobs, invoices, bookings, projects and receipts. Customers are one
// list with one set of notes, and a customer can belong to more than one business.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { supabase } from '@/lib/supabase';
import { clients as loadClients, invoices as loadInvoices, myCredits, type Client, type Credits, type Invoice } from '@/lib/data';
import { jobs as loadJobs, type Job } from '@/lib/jobs';
import { hasBusinessTools } from '@/lib/plan';
import { addBusiness, removeBusiness } from '@/lib/team';
import { BUSINESS_COLOURS, pickBusiness, useBusinesses, type AnyBusiness, type Business } from '@/lib/businesses';
import { Button, ErrorText, Field, Label, Loading, Screen, useConfirm } from '@/components/ui';
import { aud, Head, type Icon } from '@/components/Biz';
import { BizLock } from '@/components/BizLock';
import { Group, Note } from '@/components/TeamUi';
import { colours, space } from '@/constants/theme';

const EXTRA_PRICE = 99.99;

export default function Businesses() {
  const { session } = useAuth();
  const b = useBusinesses();
  const [credits, setCredits] = useState<Credits | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [invs, setInvs] = useState<Invoice[]>([]);
  const [people, setPeople] = useState<Client[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', about: '', abn: '', payment_details: '', colour: BUSINESS_COLOURS[0] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { armed, confirm } = useConfirm();

  const load = useCallback(async () => {
    setError('');
    try {
      const c = await myCredits();
      setCredits(c);
      if (hasBusinessTools(c, session?.user.id)) {
        const [j, i, p] = await Promise.all([loadJobs().catch(() => []), loadInvoices().catch(() => []), loadClients().catch(() => [])]);
        setJobs(j); setInvs(i); setPeople(p.filter((x) => x.kind === 'client'));
        await b.reload();
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your businesses.');
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);
  useFocusLoad(load); // Speed pass (13 Nov 2026): see lib/useFocusLoad.ts

  if (!loaded) return <Screen><Loading /></Screen>;
  if (!hasBusinessTools(credits, session?.user.id)) {
    return <BizLock title="More than one business" sub="Run a second business from the same login. Each one keeps its own jobs and invoices, and you switch at the top of the screen."
      points={[{ icon: 'business-outline', title: 'A business each', sub: 'Its own jobs, invoices, bookings and projects' }, { icon: 'people-outline', title: 'One customer list', sub: 'A customer can be in both, with one set of notes' }, { icon: 'albums-outline', title: 'See them together', sub: 'What is owed and what is on, across all of them' }]} />;
  }

  const line = (x: AnyBusiness) => {
    const mine = (id?: string | null) => (id && b.extras.some((e) => e.id === id) ? id : null) === x.id;
    const customers = people.filter((c) => b.clientIn(c).some((y) => y.id === x.id)).length;
    const on = jobs.filter((j) => mine(j.business_id) && (j.status === 'accepted' || j.status === 'on')).length;
    const owed = invs.filter((i) => mine(i.business_id) && i.status === 'sent').reduce((a, i) => a + i.total, 0);
    return `${customers} ${customers === 1 ? 'customer' : 'customers'} · ${on} ${on === 1 ? 'job' : 'jobs'} on now · ${aud(owed)} owed to you`;
  };
  const go = async (id: string | null | 'all') => {
    setError(''); setBusy(true);
    try { await pickBusiness(id); router.navigate('/'); } catch (e: any) { setError(e?.message ?? 'Could not switch business.'); }
    setBusy(false);
  };

  const Row = ({ icon, colour, title, sub, on, first, onPress, onEdit }: { icon: Icon; colour: string; title: string; sub: string; on?: boolean; first?: boolean; onPress: () => void; onEdit?: () => void }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, borderTopWidth: first ? 0 : 1, borderTopColor: colours.border }}>
      <Pressable onPress={busy ? undefined : onPress} accessibilityRole="button" accessibilityState={{ selected: !!on }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colour + '26', borderWidth: 1, borderColor: colour + '80', alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={20} color={colour} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colours.text, fontSize: 16, fontWeight: '800' }}>{title}</Text>
          <Text style={{ color: colours.muted, fontSize: 12.5, marginTop: 2, lineHeight: 17 }}>{sub}</Text>
        </View>
        {on ? <Ionicons name="checkmark-circle" size={22} color={colour} /> : null}
      </Pressable>
      {onEdit ? (
        <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Change ${title}`} hitSlop={10} style={{ padding: 4 }}>
          <Ionicons name="create-outline" size={19} color={colours.faint} />
        </Pressable>
      ) : null}
    </View>
  );

  const Colours = () => (
    <View style={{ flexDirection: 'row', gap: 12, marginBottom: space.md, flexWrap: 'wrap' }}>
      {BUSINESS_COLOURS.map((c) => (
        <Pressable key={c} onPress={() => setForm({ ...form, colour: c })} accessibilityRole="button" accessibilityLabel="Colour" accessibilityState={{ selected: form.colour === c }}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c, borderWidth: 3, borderColor: form.colour === c ? '#FFFFFF' : 'transparent' }} />
      ))}
    </View>
  );

  if (adding) {
    const add = async () => {
      setError('');
      if (!form.name.trim()) { setError('What is the business called?'); return; }
      setBusy(true);
      const res = await addBusiness({ name: form.name.trim(), about: form.about.trim(), abn: form.abn.trim(), colour: form.colour });
      if (!res.ok) { setBusy(false); setError(res.message ?? 'Could not add that business.'); return; }
      await b.reload();
      try { if (res.id) await pickBusiness(res.id); } catch {}
      setBusy(false); setAdding(false);
      setForm({ name: '', about: '', abn: '', payment_details: '', colour: BUSINESS_COLOURS[0] });
    };
    return (
      <Screen>
        <Head back="Which business?" to="/businesses" over="New business" title="Add a business" sub="It gets its own jobs, invoices, bookings and projects. You switch between them at the top of the screen." />
        <Field label="What is it called" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Coastline Pools" maxLength={80} autoFocus />
        <Field label="What does it do (optional)" value={form.about} onChangeText={(v) => setForm({ ...form, about: v })} placeholder="Pool fencing and pool surrounds" maxLength={200} />
        <Field label="ABN (optional)" value={form.abn} onChangeText={(v) => setForm({ ...form, abn: v })} placeholder="For its invoices. Empty uses your main one" maxLength={20} keyboardType="number-pad" />
        <Label>Its colour</Label>
        <Colours />
        <Note icon="people-outline">Your customers stay one list with one set of notes. A customer shows in this business as soon as you make them a job or an invoice here.</Note>
        <Note icon="people-circle-outline">Your team stays the same across your businesses, with the access you gave each person.</Note>
        <Note icon="card-outline">An extra business is A${EXTRA_PRICE.toFixed(2)} a month, added to your plan. The rest of this month is charged now.</Note>
        <ErrorText>{error}</ErrorText>
        <Button title={form.name.trim() ? `Add ${form.name.trim()}` : 'Add the business'} onPress={add} busy={busy} />
        <Button title="Not now" kind="ghost" onPress={() => { setAdding(false); setError(''); }} disabled={busy} />
      </Screen>
    );
  }

  const open = b.extras.find((x) => x.id === openId) ?? null;
  if (open) {
    const save = async () => {
      setError('');
      if (!form.name.trim()) { setError('What is the business called?'); return; }
      setBusy(true);
      const patch: Partial<Business> = { name: form.name.trim().slice(0, 80), about: form.about.trim().slice(0, 200), abn: form.abn.trim().slice(0, 20) || null, payment_details: form.payment_details.trim().slice(0, 600) || null, colour: form.colour };
      const { error: e } = await supabase.from('businesses').update(patch).eq('id', open.id);
      if (e) { setBusy(false); setError('Could not save that. Try again.'); return; }
      await b.reload();
      setBusy(false); setOpenId(null);
    };
    const remove = async () => {
      setError(''); setBusy(true);
      const res = await removeBusiness(open.id);
      if (!res.ok) { setBusy(false); setError(res.message ?? 'Could not remove that business.'); return; }
      await b.reload();
      setBusy(false); setOpenId(null);
    };
    return (
      <Screen>
        <Head back="Which business?" to="/businesses" over="Business" title={open.name} sub="Its name, colour and the details that go on its invoices." />
        <Field label="What is it called" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} maxLength={80} />
        <Field label="What does it do (optional)" value={form.about} onChangeText={(v) => setForm({ ...form, about: v })} maxLength={200} />
        <Field label="ABN (optional)" value={form.abn} onChangeText={(v) => setForm({ ...form, abn: v })} placeholder="Empty uses your main one" maxLength={20} keyboardType="number-pad" />
        <Field label="How to pay (optional)" value={form.payment_details} onChangeText={(v) => setForm({ ...form, payment_details: v })} placeholder="BSB and account for this business. Empty uses your main one" multiline maxLength={600} style={{ minHeight: 70, textAlignVertical: 'top' }} />
        <Label>Its colour</Label>
        <Colours />
        <Note icon="receipt-outline">This business counts its own invoice numbers. Invoices sent by card through Stripe carry your main business details, so send invoices for this business as a PDF if its ABN is different.</Note>
        <ErrorText>{error}</ErrorText>
        <Button title="Save" onPress={save} busy={busy} />
        <Button title={armed === 'remove' ? 'Tap again to remove it' : 'Remove this business'} kind="danger" disabled={busy} onPress={() => confirm('remove', remove)} />
        <Note icon="information-circle-outline">Removing it moves its jobs, invoices and the rest into {b.main.name}. Nothing is deleted, and it comes off your next bill.</Note>
      </Screen>
    );
  }

  return (
    <Screen onRefresh={load}>
      <Head over="Business" title="Which business?" sub={b.many ? 'Each one keeps its own jobs and invoices. Pick one, or see them together.' : 'Run a second business from the same login. Each one keeps its own jobs and invoices.'} />
      <ErrorText>{error}</ErrorText>
      <Group>
        <Row first on={!b.all && b.current === null} icon="business-outline" colour={b.main.colour} title={b.main.name} sub={line(b.main)} onPress={() => go(null)} />
        {b.extras.map((x) => (
          <Row key={x.id} on={!b.all && b.current === x.id} icon="business-outline" colour={x.colour} title={x.name} sub={line(x)} onPress={() => go(x.id)}
            onEdit={() => { setError(''); setForm({ name: x.name, about: x.about ?? '', abn: x.abn ?? '', payment_details: x.payment_details ?? '', colour: x.colour }); setOpenId(x.id); }} />
        ))}
        {b.many ? <Row on={b.all} icon="albums-outline" colour={colours.purple} title="All businesses" sub="Everything together, each item tagged with its business" onPress={() => go('all')} /> : null}
      </Group>
      <Button title="Add a business" kind={b.many ? 'ghost' : 'primary'} onPress={() => { setError(''); setForm({ name: '', about: '', abn: '', payment_details: '', colour: BUSINESS_COLOURS[b.extras.length % BUSINESS_COLOURS.length] }); setAdding(true); }} />
      <View style={{ height: 12 }} />
      {b.many && b.all ? <Note icon="add-circle-outline">While you look at all of them together, anything new you make goes into {b.here.name}.</Note> : null}
      {b.many ? <Note icon="sparkles-outline">Quotes and invoices Tali makes for you in chat go into {b.main.name} for now.</Note> : <Note icon="card-outline">An extra business is A${EXTRA_PRICE.toFixed(2)} a month on top of your plan.</Note>}
    </Screen>
  );
}
