import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth';
import {
  clients as loadClients,
  deleteInvoice,
  invoices as loadInvoices,
  invoiceSettings,
  myCredits,
  saveInvoice,
  saveInvoiceSettings,
  sendInvoiceWithStripe,
  setInvoiceStatus,
  stripeConnection,
  type Client,
  type Credits,
  type Invoice,
  type InvoiceItem,
  type InvoiceSettings,
} from '@/lib/data';
import { addDays, friendlyDate, isoDate, today } from '@/lib/dates';
import { isPaid } from '@/lib/plan';
import { money, shareInvoice } from '@/lib/invoicePdf';
import { ChipPicker } from '@/components/ChipPicker';
import { BackLink, Button, Card, ErrorText, Field, Label, Screen, TaliSays, Title, goBack, useConfirm } from '@/components/ui';
import { colours, radius, space } from '@/constants/theme';

type Tab = 'open' | 'paid' | 'all';
const STATUS: Record<Invoice['status'], { label: string; colour: string }> = {
  draft: { label: 'Draft', colour: colours.muted },
  sent: { label: 'Sent', colour: colours.purpleInk },
  paid: { label: 'Paid', colour: colours.good },
  void: { label: 'Void', colour: colours.faint },
};
const DUE_PICKS = [
  { label: 'On receipt', days: 0 },
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
] as const;

type Draft = {
  id?: string;
  status: Invoice['status'];
  number?: string;
  client_id: string | null;
  client_name: string;
  client_email: string;
  issue_date: string;
  due_date: string;
  items: { description: string; qty: string; unit_price: string }[];
  gst: boolean;
  notes: string;
  created_by?: 'user' | 'tali';
  stripe_url?: string | null;
  stripe_invoice_id?: string | null;
};

const blankItem = () => ({ description: '', qty: '1', unit_price: '' });
const toItems = (d: Draft): InvoiceItem[] =>
  d.items.map((i) => ({ description: i.description, qty: Number(i.qty) || 0, unit_price: Number(i.unit_price.replace(/[^0-9.]/g, '')) || 0 }));
const isOverdue = (i: Invoice) => i.status === 'sent' && i.due_date < today();

export default function Invoices() {
  const { profile } = useAuth();
  const [credits, setCredits] = useState<Credits | null | undefined>(undefined);
  const [list, setList] = useState<Invoice[]>([]);
  const [people, setPeople] = useState<Client[]>([]);
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [tab, setTab] = useState<Tab>('open');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingSettings, setEditingSettings] = useState<InvoiceSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [stripeOn, setStripeOn] = useState(false);
  // One line on the list after something happened in the editor (sent, marked paid). Goes after 6 s or on focus.
  const [note, setNote] = useState('');
  // So "No invoices yet" and the Stripe promo don't flash before the list arrives (4 Nov 2026).
  const [loaded, setLoaded] = useState(false);
  const { armed, confirm } = useConfirm();
  // Money's overdue rows open an invoice straight away: /invoices?open=<id>.
  const { open: openParam } = useLocalSearchParams<{ open?: string }>();
  const openedParam = useRef<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const c = await myCredits();
      setCredits(c);
      if (!isPaid(c)) return;
      const [inv, ppl, s, conn] = await Promise.all([loadInvoices(), loadClients(), invoiceSettings(), stripeConnection().catch(() => null)]);
      setStripeOn(!!conn);
      setList(inv);
      setPeople(ppl.filter((p) => p.kind === 'client'));
      setSettings(s);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your invoices.');
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setNote('');
      load();
    }, [load]),
  );

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(''), 6000);
    return () => clearTimeout(t);
  }, [note]);

  useEffect(() => {
    if (!openParam || openedParam.current === openParam) return;
    const i = list.find((x) => x.id === openParam);
    if (!i) return;
    openedParam.current = openParam;
    open(i);
    router.setParams({ open: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openParam, list]);

  const shown = useMemo(() => {
    if (tab === 'open') return list.filter((i) => i.status === 'draft' || i.status === 'sent').sort((a, b) => a.due_date.localeCompare(b.due_date));
    if (tab === 'paid') return list.filter((i) => i.status === 'paid');
    return list;
  }, [list, tab]);

  const owed = list.filter((i) => i.status === 'sent').reduce((t, i) => t + i.total, 0);
  const overdue = list.filter(isOverdue).reduce((t, i) => t + i.total, 0);
  const drafts = list.filter((i) => i.status === 'draft').length;

  function newInvoice() {
    const due = settings?.default_due_days ?? 7;
    setDraft({
      status: 'draft',
      client_id: null,
      client_name: '',
      client_email: '',
      issue_date: today(),
      due_date: isoDate(addDays(new Date(), due)),
      items: [blankItem()],
      gst: settings?.gst_registered ?? false,
      notes: '',
    });
  }

  function open(i: Invoice) {
    setConfirmDelete(false);
    setDraft({
      id: i.id,
      status: i.status,
      number: i.number,
      client_id: i.client_id,
      client_name: i.client_name,
      client_email: i.client_email ?? '',
      issue_date: i.issue_date,
      due_date: i.due_date,
      items: i.items.length ? i.items.map((x) => ({ description: x.description, qty: String(x.qty), unit_price: String(x.unit_price) })) : [blankItem()],
      gst: i.gst,
      notes: i.notes,
      created_by: i.created_by,
      stripe_url: i.stripe_url,
      stripe_invoice_id: i.stripe_invoice_id,
    });
  }

  async function save(status?: Invoice['status']) {
    if (!draft) return null;
    setError('');
    if (!draft.client_name.trim()) return setError('Who is this invoice for?'), null;
    const items = toItems(draft).filter((i) => i.description.trim());
    if (!items.length) return setError('Add at least one line.'), null;
    setBusy(true);
    try {
      const saved = await saveInvoice({
        id: draft.id,
        client_id: draft.client_id,
        client_name: draft.client_name,
        client_email: draft.client_email,
        issue_date: draft.issue_date,
        due_date: draft.due_date,
        items,
        gst: draft.gst,
        notes: draft.notes,
        status,
      });
      await load();
      setBusy(false);
      return saved;
    } catch (e: any) {
      setError(e?.message ?? 'Could not save.');
      setBusy(false);
      return null;
    }
  }

  async function saveAndClose(status?: Invoice['status']) {
    const s = await save(status);
    if (s) setDraft(null);
  }

  async function share() {
    const s = await save();
    if (!s) return;
    setDraft((d) => (d ? { ...d, id: s.id, number: s.number } : d));
    try {
      await shareInvoice(s, settings, profile?.business_name || profile?.first_name || '');
    } catch (e: any) {
      setError(e?.message ?? 'Could not make the PDF.');
    }
  }

  async function mark(status: Invoice['status']) {
    if (!draft?.id) return saveAndClose(status);
    setBusy(true);
    try {
      await setInvoiceStatus(draft.id, status);
      await load();
      setDraft(null);
      const num = draft.number ?? 'it';
      setNote(status === 'void' ? `Voided ${num}.` : `Marked ${num} as ${status}.`);
    } catch (e: any) {
      setError(e?.message ?? 'Could not update.');
    }
    setBusy(false);
  }

  // Sends through their own Stripe: saves first, then Stripe emails it with a pay link.
  async function sendStripe() {
    if (!draft) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.client_email.trim())) return setError(`Add ${draft.client_name.trim() || 'their'}'s email first so Stripe knows where to send it.`);
    const s = await save();
    if (!s) return;
    setBusy(true);
    const res = await sendInvoiceWithStripe(s.id);
    setBusy(false);
    if (!res.ok) {
      setDraft((d) => (d ? { ...d, id: s.id, number: s.number } : d));
      return setError(res.message ?? 'Could not send.');
    }
    await load();
    setDraft(null);
    setNote(`Sent ${s.number} to ${s.client_email}. It'll mark itself paid when they pay. 🙌`);
  }

  async function remove() {
    if (!draft?.id) return setDraft(null);
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    try {
      await deleteInvoice(draft.id);
      await load();
      setDraft(null);
    } catch (e: any) {
      setError(e?.message ?? 'Could not delete.');
    }
    setBusy(false);
  }

  async function saveSettings() {
    if (!editingSettings) return;
    setBusy(true);
    setError('');
    try {
      await saveInvoiceSettings(editingSettings);
      await load();
      setEditingSettings(null);
    } catch (e: any) {
      setError(e?.message ?? 'Could not save your details.');
    }
    setBusy(false);
  }

  // ---------- Locked on Free ----------
  if (credits !== undefined && !isPaid(credits)) {
    return (
      <Screen>
        <BackLink onPress={() => goBack('/me')} />
        <Title>Invoices</Title>
        <TaliSays pose="wave">Invoices are part of Tali HQ. I'll draft them for you, keep track of who's paid and nudge you when one's overdue.</TaliSays>
        <Button title="See plans" onPress={() => router.navigate('/plans')} />
      </Screen>
    );
  }

  // ---------- Your invoice details ----------
  if (editingSettings) {
    const s = editingSettings;
    const set = (patch: Partial<InvoiceSettings>) => setEditingSettings({ ...s, ...patch });
    return (
      <Screen>
        <BackLink onPress={() => { setEditingSettings(null); setError(''); }} />
        <Title sub="These go on every invoice.">Your invoice details</Title>
        <Field label="Business name" value={s.business_name ?? ''} onChangeText={(t) => set({ business_name: t })} maxLength={120} />
        <Field label="ABN" value={s.abn ?? ''} onChangeText={(t) => set({ abn: t })} keyboardType="number-pad" maxLength={20} />
        <Field label="Address" value={s.address ?? ''} onChangeText={(t) => set({ address: t })} multiline maxLength={300} style={{ minHeight: 70, textAlignVertical: 'top' }} />
        <Field label="Email" value={s.email ?? ''} onChangeText={(t) => set({ email: t })} autoCapitalize="none" keyboardType="email-address" inputMode="email" />
        <Field label="Phone" value={s.phone ?? ''} onChangeText={(t) => set({ phone: t })} keyboardType="phone-pad" inputMode="tel" />
        <Field label="How to pay" value={s.payment_details ?? ''} onChangeText={(t) => set({ payment_details: t })} multiline maxLength={600}
          placeholder={'Bank transfer\nBSB 000-000  Account 00000000\nReference: invoice number'} style={{ minHeight: 100, textAlignVertical: 'top' }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
          <View style={{ flex: 1, paddingRight: space.md }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text }}>Registered for GST</Text>
            <Text style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>Adds 10% GST and calls it a tax invoice.</Text>
          </View>
          <Switch value={s.gst_registered} onValueChange={(v) => set({ gst_registered: v })} trackColor={{ true: colours.purple, false: colours.borderStrong }} thumbColor="#FFFFFF" {...({ activeThumbColor: "#FFFFFF" } as object)} />
        </View>
        <Label>Usually due</Label>
        <ChipPicker options={DUE_PICKS.map((p) => p.label)} value={DUE_PICKS.find((p) => p.days === s.default_due_days)?.label ?? null}
          onChange={(l) => set({ default_due_days: DUE_PICKS.find((p) => p.label === l)!.days })} />
        <Field label="Footer (optional)" value={s.footer ?? ''} onChangeText={(t) => set({ footer: t })} multiline maxLength={300} placeholder="Thanks for your business!" style={{ minHeight: 60, textAlignVertical: 'top' }} />
        <ErrorText>{error}</ErrorText>
        <Button title="Save" onPress={saveSettings} busy={busy} />
      </Screen>
    );
  }

  // ---------- Editor ----------
  if (draft) {
    const items = toItems(draft);
    const subtotal = items.reduce((t, i) => t + Math.round(i.qty * i.unit_price * 100) / 100, 0);
    const gstAmt = draft.gst ? Math.round(subtotal * 10) / 100 : 0;
    const locked = draft.status === 'paid' || draft.status === 'void';
    const setItem = (n: number, patch: Partial<Draft['items'][number]>) =>
      setDraft({ ...draft, items: draft.items.map((it, i) => (i === n ? { ...it, ...patch } : it)) });
    const dueLabel = DUE_PICKS.find((p) => isoDate(addDays(new Date(`${draft.issue_date}T12:00:00`), p.days)) === draft.due_date)?.label ?? null;
    const match = draft.client_name.trim()
      ? people.filter((p) => p.name.toLowerCase().includes(draft.client_name.trim().toLowerCase()) && p.name !== draft.client_name).slice(0, 4)
      : people.slice(0, 6);

    return (
      <Screen>
        <BackLink onPress={() => { setDraft(null); setError(''); setConfirmDelete(false); }} />
        <Title sub={draft.created_by === 'tali' && draft.status === 'draft' ? 'Tali drafted this one. Check it over before you send it.' : undefined}>
          {draft.number ?? 'New invoice'}
        </Title>
        {draft.id ? (
          <Text style={{ fontWeight: '700', color: STATUS[draft.status].colour, marginTop: -space.sm, marginBottom: space.md }}>{STATUS[draft.status].label}</Text>
        ) : null}

        <Field label="Bill to" value={draft.client_name} editable={!locked} onChangeText={(t) => setDraft({ ...draft, client_name: t, client_id: null })} maxLength={120} placeholder="Client or business name" />
        {!locked && match.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: -6, marginBottom: space.md }}>
            {match.map((p) => (
              <Pressable key={p.id} onPress={() => setDraft({ ...draft, client_name: p.name, client_id: p.id, client_email: draft.client_email || p.email || '' })}
                style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colours.purpleSoft }}>
                <Text style={{ color: colours.purpleInk, fontWeight: '600' }}>{p.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Field label="Their email (optional)" value={draft.client_email} editable={!locked} onChangeText={(t) => setDraft({ ...draft, client_email: t })} autoCapitalize="none" keyboardType="email-address" inputMode="email" />

        <Label>Due</Label>
        <ChipPicker options={DUE_PICKS.map((p) => p.label)} value={dueLabel}
          onChange={(l) => !locked && setDraft({ ...draft, due_date: isoDate(addDays(new Date(`${draft.issue_date}T12:00:00`), DUE_PICKS.find((p) => p.label === l)!.days)) })} />
        <Text style={{ color: colours.muted, fontSize: 13, marginTop: -6, marginBottom: space.md }}>
          Issued {friendlyDate(draft.issue_date)}, due {friendlyDate(draft.due_date)}
        </Text>

        <Label>What it's for</Label>
        {draft.items.map((it, n) => (
          <Card key={n} style={{ padding: space.md }}>
            <TextInput value={it.description} editable={!locked} onChangeText={(t) => setItem(n, { description: t })} placeholder="Description" placeholderTextColor={colours.faint} maxLength={200}
              style={{ fontSize: 16, color: colours.text, paddingVertical: 4 }} />
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm, alignItems: 'center' }}>
              <Text style={{ color: colours.muted }}>Qty</Text>
              <TextInput value={it.qty} editable={!locked} onChangeText={(t) => setItem(n, { qty: t.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" inputMode="decimal"
                style={{ width: 56, borderWidth: 1, borderColor: colours.borderStrong, borderRadius: radius.input, paddingHorizontal: 8, paddingVertical: 6, fontSize: 15, color: colours.text }} />
              <Text style={{ color: colours.muted }}>A$</Text>
              <TextInput value={it.unit_price} editable={!locked} onChangeText={(t) => setItem(n, { unit_price: t.replace(/[^0-9.]/g, '') })} placeholder="0.00" placeholderTextColor={colours.faint}
                keyboardType="decimal-pad" inputMode="decimal"
                style={{ width: 90, borderWidth: 1, borderColor: colours.borderStrong, borderRadius: radius.input, paddingHorizontal: 8, paddingVertical: 6, fontSize: 15, color: colours.text }} />
              <Text style={{ flex: 1, fontWeight: '700', color: colours.text, textAlign: 'right' }} numberOfLines={1}>{money(items[n].qty * items[n].unit_price)}</Text>
            </View>
            {!locked && draft.items.length > 1 ? (
              <Pressable onPress={() => setDraft({ ...draft, items: draft.items.filter((_, i) => i !== n) })} hitSlop={8} style={{ alignSelf: 'flex-end', marginTop: 6 }}>
                <Text style={{ color: colours.danger, fontSize: 13, fontWeight: '600' }}>Remove</Text>
              </Pressable>
            ) : null}
          </Card>
        ))}
        {!locked ? (
          <Pressable onPress={() => setDraft({ ...draft, items: [...draft.items, blankItem()] })} style={{ paddingVertical: 6, marginBottom: space.md }}>
            <Text style={{ color: colours.purple, fontWeight: '700', fontSize: 15 }}>+ Add a line</Text>
          </Pressable>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
          <Text style={{ fontSize: 15, color: colours.text }}>Add GST (10%)</Text>
          <Switch value={draft.gst} disabled={locked} onValueChange={(v) => setDraft({ ...draft, gst: v })} trackColor={{ true: colours.purple, false: colours.borderStrong }} thumbColor="#FFFFFF" {...({ activeThumbColor: "#FFFFFF" } as object)} />
        </View>

        <Card style={{ backgroundColor: colours.sunk }}>
          <Row label="Subtotal" value={money(subtotal)} />
          {draft.gst ? <Row label="GST" value={money(gstAmt)} /> : null}
          <Row label={draft.gst ? 'Total incl. GST' : 'Total'} value={money(subtotal + gstAmt)} big />
        </Card>

        <Field label="Note on the invoice (optional)" value={draft.notes} editable={!locked} onChangeText={(t) => setDraft({ ...draft, notes: t })} multiline maxLength={1000}
          placeholder="Thanks for training with me this month!" style={{ minHeight: 70, textAlignVertical: 'top' }} />

        <ErrorText>{error}</ErrorText>
        {!locked ? <Button title={draft.status === 'draft' ? 'Save draft' : 'Save changes'} onPress={() => saveAndClose()} busy={busy} /> : null}
        {stripeOn && draft.status === 'draft' ? (
          <>
            <Button title="Send with Stripe" onPress={sendStripe} busy={busy} />
            <Text style={{ color: colours.muted, fontSize: 12, marginTop: 2, marginBottom: space.md, textAlign: 'center', lineHeight: 17 }}>
              {draft.client_email.trim() ? `To ${draft.client_email.trim()}. ` : 'Add their email above first. '}Stripe emails it with a pay by card link, paid straight to you.
            </Text>
          </>
        ) : null}
        {draft.stripe_url ? <Button title="View it in Stripe" kind="ghost" onPress={() => Linking.openURL(draft.stripe_url as string)} /> : null}
        <Button title="Share PDF" kind="ghost" onPress={share} disabled={busy} />
        {draft.status === 'draft' ? <Button title={stripeOn ? 'Mark as sent (I sent it myself)' : 'Mark as sent'} kind="ghost" onPress={() => mark('sent')} disabled={busy} /> : null}
        {draft.status === 'sent' ? <Button title="Mark as paid" kind="ghost" onPress={() => mark('paid')} disabled={busy} /> : null}
        {draft.status === 'paid' ? <Button title="Not paid after all" kind="ghost" onPress={() => mark('sent')} disabled={busy} /> : null}
        {draft.status === 'sent' ? <Button title={armed === 'void' ? 'Sure?' : 'Void this invoice'} kind="danger" onPress={() => confirm('void', () => mark('void'))} disabled={busy} /> : null}
        {draft.status === 'draft' || draft.status === 'void' ? (
          <Button title={confirmDelete ? 'Tap again to delete' : 'Delete'} kind="danger" onPress={remove} disabled={busy} />
        ) : null}
        <Text style={{ color: colours.muted, fontSize: 13, marginTop: space.md, lineHeight: 19 }}>
          {stripeOn
            ? 'Nothing goes out until you tap Send. Or share the PDF yourself if you prefer.'
            : 'Share the PDF by email or message yourself, or connect your Stripe in Settings and I can send it for you when you tap Send.'}
        </Text>
      </Screen>
    );
  }

  // ---------- List ----------
  return (
    <Screen onRefresh={load}>
      <BackLink onPress={() => goBack('/me')} />
      <Title sub="Or just tell Tali: invoice Jordan for 4 PT sessions at $80.">Invoices</Title>
      {note ? <Text style={{ color: colours.good, fontWeight: '700', marginBottom: space.md, lineHeight: 20 }}>{note}</Text> : null}
      {loaded && !stripeOn ? (
        <Pressable onPress={() => router.navigate({ pathname: '/settings', params: { section: 'connections' } })} accessibilityRole="button">
          <Card style={{ backgroundColor: colours.purpleSoft, borderColor: colours.purpleSoft }}>
            <Text style={{ color: colours.purpleInk, fontWeight: '700' }}>Connect your Stripe and I'll send these for you</Text>
            <Text style={{ color: colours.purpleInk, fontSize: 13, marginTop: 2 }}>With a pay by card link, and they mark themselves paid. Settings, Connections.</Text>
          </Card>
        </Pressable>
      ) : null}

      {list.length ? (
        <Card>
          <Row label="Owed to you" value={money(owed)} big />
          {overdue > 0 ? <Text style={{ color: colours.danger, fontWeight: '700', marginTop: 4 }}>{money(overdue)} overdue</Text> : null}
          {drafts ? <Text style={{ color: colours.muted, marginTop: 4 }}>{drafts} draft{drafts === 1 ? '' : 's'} not sent yet</Text> : null}
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', backgroundColor: colours.sunk, borderRadius: radius.pill, padding: 4, marginBottom: space.md }}>
        {(['open', 'paid', 'all'] as const).map((k) => (
          <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}
            style={{ flex: 1, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: tab === k ? colours.surface : 'transparent', alignItems: 'center' }}>
            <Text style={{ fontWeight: '700', color: tab === k ? colours.text : colours.muted }}>{k === 'open' ? 'Unpaid' : k === 'paid' ? 'Paid' : 'All'}</Text>
          </Pressable>
        ))}
      </View>

      <Button title="New invoice" onPress={newInvoice} />
      <Button title="Your invoice details" kind="ghost" onPress={() => setEditingSettings(settings ?? {
        business_name: profile?.business_name ?? '', abn: '', address: '', email: '', phone: '', payment_details: '',
        gst_registered: false, default_due_days: 7, next_number: 1, footer: '',
      })} />
      <ErrorText>{error}</ErrorText>
      <View style={{ height: space.md }} />

      {!loaded ? null : shown.length === 0 ? (
        list.length === 0 ? (
          <TaliSays pose="idle">No invoices yet. Make one here, or tell me in Talk who to bill and what for, and I'll draft it.</TaliSays>
        ) : (
          <TaliSays pose="idle">{tab === 'paid' ? 'Nothing paid yet.' : 'All paid up. Nice.'}</TaliSays>
        )
      ) : (
        shown.map((i) => {
          const late = isOverdue(i);
          return (
            <Pressable key={i.id} onPress={() => open(i)}>
              <Card style={late ? { borderLeftWidth: 5, borderLeftColor: colours.danger } : i.status === 'draft' ? { borderLeftWidth: 5, borderLeftColor: colours.orange } : undefined}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text, flex: 1 }} numberOfLines={1}>{i.client_name}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text }}>{money(i.total)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={{ fontSize: 13, color: colours.muted }}>{i.number}{i.created_by === 'tali' && i.status === 'draft' ? ' · drafted by Tali' : ''}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: late ? colours.danger : STATUS[i.status].colour }}>
                    {late ? `Overdue since ${friendlyDate(i.due_date)}` : i.status === 'sent' ? `Due ${friendlyDate(i.due_date)}` : STATUS[i.status].label}
                  </Text>
                </View>
              </Card>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}

function Row({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
      <Text style={{ fontSize: big ? 17 : 15, fontWeight: big ? '800' : '400', color: colours.text }}>{label}</Text>
      <Text style={{ fontSize: big ? 17 : 15, fontWeight: big ? '800' : '600', color: colours.text }}>{value}</Text>
    </View>
  );
}
