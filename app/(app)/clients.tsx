import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { clients as loadClients, deleteClient, saveClient, type Client } from '@/lib/data';
import { addDays, friendlyDate, FOLLOW_UP_PICKS, isoDate, today } from '@/lib/dates';
import { ChipPicker } from '@/components/ChipPicker';
import { BackLink, Body, Button, Card, ErrorText, Field, Label, Screen, TaliSays, Title } from '@/components/ui';
import { SkinHeader } from '@/components/PageSkin';
import { colours, radius, space } from '@/constants/theme';

// 4 Nov 2026: which quick pick matches a saved follow-up date, so the chip row shows the right one.
// "None" for no date, the matching label when one lines up with today's picks, otherwise null.
function followUpPickFor(iso: string | null | undefined): string | null {
  if (!iso) return 'None';
  const now = new Date();
  const hit = FOLLOW_UP_PICKS.find((p) => p.days !== null && isoDate(addDays(now, p.days)) === iso);
  return hit ? hit.label : null;
}

const CLIENT_STATUSES = ['active', 'quiet', 'paused', 'past'] as const;
const LEAD_STATUSES = ['new', 'talking', 'won', 'lost'] as const;
const STATUS_LABEL: Record<string, string> = {
  active: 'Active', quiet: 'Gone quiet', paused: 'Paused', past: 'Past client',
  new: 'New', talking: 'Talking', won: 'Won', lost: 'Lost',
};

type Draft = { id?: string; name: string; kind: 'client' | 'lead'; status: string; email: string; phone: string; notes: string; next_follow_up: string | null; last_contact_at: string | null };
const blank = (kind: 'client' | 'lead'): Draft => ({ name: '', kind, status: kind === 'lead' ? 'new' : 'active', email: '', phone: '', notes: '', next_follow_up: null, last_contact_at: null });

export default function Clients() {
  const [list, setList] = useState<Client[]>([]);
  const [tab, setTab] = useState<'client' | 'lead'>('client');
  // 10 Nov 2026 mock: with no business this is simply your people, with no clients and leads split.
  const { profile } = useAuth();
  const hasBusiness = !!(profile as any)?.business_type || !!(profile as any)?.business_name;
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  // ADDED (3 Nov 2026): the person screen's Edit button opens /clients?edit=<id>&from=person.
  // 4 Nov 2026: remember that it came from Person, so Back and Save return there rather than the list.
  const params = useLocalSearchParams<{ edit?: string; from?: string }>();
  const editId = Array.isArray(params.edit) ? params.edit[0] : params.edit;
  const fromParam = Array.isArray(params.from) ? params.from[0] : params.from;
  const [fromPerson, setFromPerson] = useState(false);

  const toDraft = (c: Client): Draft => ({ id: c.id, name: c.name, kind: c.kind, status: c.status, email: c.email ?? '', phone: c.phone ?? '', notes: c.notes, next_follow_up: c.next_follow_up, last_contact_at: c.last_contact_at });

  const load = useCallback(async () => {
    try {
      setList(await loadClients());
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your list.');
    }
  }, []);

  useEffect(() => {
    if (!editId) return;
    const c = list.find((x) => x.id === editId);
    if (!c) return;
    setDraft(toDraft(c));
    setFromPerson(fromParam === 'person');
    router.setParams({ edit: undefined, from: undefined } as any);
  }, [editId, fromParam, list]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list
      .filter((c) => !hasBusiness || c.kind === tab)
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.notes.toLowerCase().includes(q))
      .sort((a, b) => {
        const fa = a.next_follow_up ?? '9999', fb = b.next_follow_up ?? '9999';
        return fa === fb ? a.name.localeCompare(b.name) : fa.localeCompare(fb);
      });
  }, [list, tab, search]);

  const counts = { client: list.filter((c) => c.kind === 'client').length, lead: list.filter((c) => c.kind === 'lead').length };

  // Leave the editor. If Edit was opened from Person, go back to that person.
  function closeEditor(personId?: string) {
    const back = fromPerson && personId;
    setDraft(null);
    setConfirmDelete(false);
    setError('');
    setFromPerson(false);
    if (back) router.navigate({ pathname: '/person', params: { id: personId } } as any);
  }

  async function save() {
    if (!draft) return;
    setError('');
    if (!draft.name.trim()) return setError('Give them a name.');
    setBusy(true);
    try {
      await saveClient(draft);
      closeEditor(draft.id);
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save.');
    }
    setBusy(false);
  }

  async function remove() {
    if (!draft?.id) return;
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    try {
      await deleteClient(draft.id);
      // The person is gone, so the list is the only place to land.
      setFromPerson(false);
      closeEditor();
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Could not delete.');
    }
    setBusy(false);
  }

  if (draft) {
    const statuses = draft.kind === 'lead' ? LEAD_STATUSES : CLIENT_STATUSES;
    const pickFollow = (days: number | null) => setDraft({ ...draft, next_follow_up: days === null ? null : isoDate(addDays(new Date(), days)) });
    return (
      <Screen skin="cork">
        <BackLink onPress={() => closeEditor(draft.id)} label={fromPerson ? draft.name || 'Back' : 'Back'} />
        <Title>{draft.id ? draft.name || 'Edit' : draft.kind === 'lead' ? 'New lead' : 'New client'}</Title>
        <ChipPicker options={['client', 'lead'] as const} value={draft.kind} label={(k) => (k === 'lead' ? 'Lead' : 'Client')}
          onChange={(k) => setDraft({ ...draft, kind: k, status: k === 'lead' ? 'new' : 'active' })} />
        <Field label="Name" value={draft.name} onChangeText={(t) => setDraft({ ...draft, name: t })} maxLength={120} />
        <Label>Status</Label>
        <ChipPicker options={statuses} value={draft.status as any} label={(s) => STATUS_LABEL[s]} onChange={(s) => setDraft({ ...draft, status: s })} />
        <Label>Follow up</Label>
        <ChipPicker
          options={FOLLOW_UP_PICKS.map((p) => p.label)}
          value={followUpPickFor(draft.next_follow_up)}
          onChange={(l) => pickFollow(FOLLOW_UP_PICKS.find((p) => p.label === l)!.days)}
        />
        <Text style={{ color: colours.muted, fontSize: 13, marginTop: -6, marginBottom: space.md }}>
          {draft.next_follow_up ? `Next follow-up: ${friendlyDate(draft.next_follow_up)}` : 'No follow-up set.'}
        </Text>
        <Field label="Email (optional)" value={draft.email} onChangeText={(t) => setDraft({ ...draft, email: t })} autoCapitalize="none" keyboardType="email-address" inputMode="email" />
        <Field label="Phone (optional)" value={draft.phone} onChangeText={(t) => setDraft({ ...draft, phone: t })} keyboardType="phone-pad" inputMode="tel" />
        <Field label="Notes" value={draft.notes} onChangeText={(t) => setDraft({ ...draft, notes: t })} multiline maxLength={4000}
          placeholder="Goals, what they like, anything worth remembering." style={{ minHeight: 110, textAlignVertical: 'top' }} />
        <Button title="Contacted today" kind="ghost" onPress={() => setDraft({ ...draft, last_contact_at: today() })} />
        {draft.last_contact_at ? <Text style={{ color: colours.muted, fontSize: 13, marginTop: 6 }}>Last contact: {friendlyDate(draft.last_contact_at)}</Text> : null}
        <ErrorText>{error}</ErrorText>
        <Button title="Save" onPress={save} busy={busy} />
        {draft.id ? <Button title={confirmDelete ? 'Tap again to delete' : 'Delete'} kind="danger" onPress={remove} disabled={busy} /> : null}
      </Screen>
    );
  }

  return (
    <Screen skin="cork" onRefresh={load}>
      <SkinHeader id="cork" title="Your people" sub={hasBusiness ? "Clients, leads and the people who matter. Tell her about anyone: add Mia as a new lead, or Mum's birthday is 14 December." : "Family, friends and the people who matter. Tell her about anyone: Mum's birthday is 14 December, or Dan is moving to Perth."} onBack={() => router.navigate('/world')} />
      <View style={{ flexDirection: 'row', backgroundColor: colours.sunk, borderRadius: radius.pill, padding: 4, marginBottom: space.md, display: hasBusiness ? 'flex' : 'none' }}>
        {(['client', 'lead'] as const).map((k) => (
          <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}
            style={{ flex: 1, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: tab === k ? colours.surface : 'transparent', alignItems: 'center' }}>
            <Text style={{ fontWeight: '700', color: tab === k ? colours.text : colours.muted }}>
              {k === 'client' ? 'Clients' : 'Leads'} {counts[k] ? `(${counts[k]})` : ''}
            </Text>
          </Pressable>
        ))}
      </View>
      {list.length > 6 ? (
        <TextInput value={search} onChangeText={setSearch} placeholder="Search" placeholderTextColor={colours.faint}
          style={{ backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.borderStrong, borderRadius: radius.input, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, marginBottom: space.md, color: colours.text }} />
      ) : null}
      <Button title={!hasBusiness ? 'Add a person' : tab === 'lead' ? 'Add a lead' : 'Add a client'} onPress={() => setDraft(blank(hasBusiness ? tab : 'client'))} />
      {hasBusiness ? <Button title="Invoices" kind="ghost" onPress={() => router.navigate('/invoices')} /> : null}
      <ErrorText>{error}</ErrorText>
      <View style={{ height: space.md }} />
      {shown.length === 0 ? (
        list.length === 0 ? (
          <TaliSays pose="idle">Add the people you work with and I'll keep track of who needs a follow-up.</TaliSays>
        ) : (
          <Card><Body muted>{search ? 'No one matches that.' : !hasBusiness ? 'No one yet. Tell Tali about someone in Talk and they land here.' : tab === 'lead' ? 'No leads yet.' : 'No clients yet.'}</Body></Card>
        )
      ) : (
        shown.map((c) => {
          const due = c.next_follow_up && c.next_follow_up <= today();
          return (
            <Pressable key={c.id} onPress={() => router.navigate({ pathname: '/person', params: { id: c.id } } as any)} accessibilityRole="button">
              <Card style={due ? { borderLeftWidth: 5, borderLeftColor: colours.orange } : undefined}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text, flex: 1 }} numberOfLines={1}>{c.name}</Text>
                  {hasBusiness ? <Text style={{ fontSize: 12, fontWeight: '700', color: colours.purpleInk }}>{STATUS_LABEL[c.status] ?? c.status}</Text> : null}
                </View>
                {c.next_follow_up ? (
                  <Text style={{ fontSize: 13, color: due ? colours.orange : colours.muted, marginTop: 3, fontWeight: due ? '700' : '400' }}>
                    Follow up: {friendlyDate(c.next_follow_up)}
                  </Text>
                ) : null}
                {c.notes ? <Text numberOfLines={2} style={{ fontSize: 14, color: colours.muted, marginTop: 4, lineHeight: 20 }}>{c.notes}</Text> : null}
              </Card>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}
