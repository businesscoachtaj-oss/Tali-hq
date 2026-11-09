// Founder: every account (4 Nov 2026), like Super Admin users in Totality. Taj only: the button
// lives on the Founder screen and founder_users() refuses anyone else.
import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { founderUsers, type FounderUser } from '@/lib/data';
import { ChipPicker } from '@/components/ChipPicker';
import { Sheet } from '@/components/Sheet';
import { BackLink, Body, Card, ErrorText, Screen, TaliSays, Title } from '@/components/ui';
import { SkinHeader } from '@/components/PageSkin';
import { colours, radius, space } from '@/constants/theme';

const FILTERS = ['All', 'On trial', 'Paying', 'Free', 'Ending soon'] as const;
type Filter = (typeof FILTERS)[number];

const DAY = 86_400_000;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : 'never');
const ago = (iso: string | null) => {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} hr ago`;
  const d = Math.round(mins / 1440);
  return d === 1 ? 'yesterday' : `${d} days ago`;
};

function kindOf(u: FounderUser): 'trial' | 'paying' | 'free' {
  if (u.status === 'trialing' && u.trial_ends_at && new Date(u.trial_ends_at).getTime() > Date.now()) return 'trial';
  if (u.paying_stripe && ['active', 'past_due'].includes(u.status ?? '') && u.plan_id !== 'free') return 'paying';
  return 'free';
}

function planLine(u: FounderUser) {
  const plan = u.plan_id === 'max' ? 'Max' : u.plan_id === 'pro' ? 'Pro' : u.plan_id === 'hq' ? 'Tali HQ' : 'Free';
  const k = kindOf(u);
  if (k === 'trial') {
    const left = Math.ceil((new Date(u.trial_ends_at!).getTime() - Date.now()) / DAY);
    return { text: `${plan} trial, ${left} day${left === 1 ? '' : 's'} left`, tone: left <= 3 ? colours.orange : colours.purple };
  }
  if (k === 'paying') return { text: `${plan}, paying`, tone: colours.good };
  return { text: 'Free', tone: colours.muted };
}

export default function FounderUsers() {
  const [users, setUsers] = useState<FounderUser[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('All');
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      setUsers(await founderUsers());
    } catch (e: any) {
      setError(e?.message ?? 'Could not load.');
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (users ?? []).filter((u) => {
      const k = kindOf(u);
      if (filter === 'On trial' && k !== 'trial') return false;
      if (filter === 'Paying' && k !== 'paying') return false;
      if (filter === 'Free' && k !== 'free') return false;
      if (filter === 'Ending soon' && !(k === 'trial' && new Date(u.trial_ends_at!).getTime() - Date.now() < 7 * DAY)) return false;
      if (!term) return true;
      return [u.first_name, u.business_name, u.email].some((v) => (v ?? '').toLowerCase().includes(term));
    });
  }, [users, q, filter]);

  const cur = (users ?? []).find((u) => u.id === open) ?? null;

  return (
    <Screen skin="founder">
      <SkinHeader id="founder" title="Users" sub="Every Tali HQ account." onBack={() => router.back()} />
      <ErrorText>{error}</ErrorText>

      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search name, business or email"
        placeholderTextColor={colours.faint}
        style={{ borderWidth: 1, borderColor: colours.borderStrong, borderRadius: radius.input, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: colours.text, backgroundColor: colours.surface, marginBottom: space.md }}
      />
      <ChipPicker options={FILTERS} value={filter} onChange={setFilter} />

      {!users ? (
        <TaliSays pose="think">Getting everyone.</TaliSays>
      ) : (
        <>
          <Text style={{ fontSize: 13, color: colours.muted, marginBottom: space.sm, marginLeft: 2 }}>
            {shown.length} of {users.length} account{users.length === 1 ? '' : 's'}
          </Text>
          <Card style={{ paddingVertical: 4 }}>
            {shown.length === 0 ? <Body muted>No accounts match.</Body> : null}
            {shown.map((u, i) => {
              const p = planLine(u);
              const name = u.first_name || u.email || 'No name yet';
              return (
                <Pressable key={u.id} onPress={() => setOpen(u.id)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colours.border }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colours.purpleSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontWeight: '800', color: colours.purpleInk, fontSize: 16 }}>{name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colours.text }} numberOfLines={1}>
                      {name}
                      {u.business_name ? <Text style={{ fontWeight: '400', color: colours.muted }}>{`  ${u.business_name}`}</Text> : null}
                    </Text>
                    <Text style={{ fontSize: 13, color: colours.muted, marginTop: 1 }} numberOfLines={1}>{u.email}</Text>
                    <Text style={{ fontSize: 12, color: p.tone, fontWeight: '700', marginTop: 3 }}>
                      {p.text}
                      <Text style={{ color: colours.muted, fontWeight: '400' }}>{`  ·  joined ${day(u.created_at)}`}</Text>
                    </Text>
                  </View>
                  <Text style={{ fontSize: 22, color: colours.faint, fontWeight: '600' }}>{'›'}</Text>
                </Pressable>
              );
            })}
          </Card>
        </>
      )}

      <Sheet visible={!!cur} title={cur ? cur.first_name || cur.email || 'Account' : ''} sub={cur?.email} onClose={() => setOpen(null)}>
        {cur ? <Detail u={cur} /> : null}
      </Sheet>
    </Screen>
  );
}

function Detail({ u }: { u: FounderUser }) {
  const p = planLine(u);
  return (
    <>
      <Card>
        <Row k="Plan" v={p.text} tone={p.tone} />
        {kindOf(u) === 'trial' ? <Row k="Trial ends" v={day(u.trial_ends_at)} /> : null}
        {u.current_period_end && kindOf(u) === 'paying' ? <Row k="Renews" v={day(u.current_period_end)} /> : null}
        {u.founding_member ? <Row k="Founding member" v="Yes" /> : null}
        <Row k="Joined" v={day(u.created_at)} />
        <Row k="Last signed in" v={ago(u.last_sign_in_at)} />
        <Row k="Onboarding" v={u.onboarded_at ? 'Finished' : 'Not finished'} tone={u.onboarded_at ? undefined : colours.orange} last />
      </Card>
      <View style={{ height: space.sm }} />
      <Card>
        <Row k="Business" v={u.business_name || 'not given'} />
        <Row k="Type" v={u.business_type || 'not given'} last={!u.about_me} />
        {u.about_me ? <Text style={{ fontSize: 14, lineHeight: 20, color: colours.text, paddingTop: 10 }}>{u.about_me}</Text> : null}
      </Card>
      <View style={{ height: space.sm }} />
      <Card>
        <Row k="Messages to Tali" v={String(u.messages_total)} />
        <Row k="Last chat" v={ago(u.last_message_at)} />
        <Row k="Credits this month" v={String(u.credits_month)} />
        <Row k="Journal entries" v={String(u.journal_count)} />
        <Row k="Clients and leads" v={String(u.clients_count)} last />
      </Card>
      <View style={{ height: space.sm }} />
      <Card>
        <Row k="Google" v={u.google ? 'Connected' : 'No'} />
        <Row k="Stripe" v={u.stripe ? 'Connected' : 'No'} />
        <Row k="Notifications" v={u.devices ? `${u.devices} device${u.devices === 1 ? '' : 's'}` : 'Off'} last />
      </Card>
    </>
  );
}

function Row({ k, v, tone, last }: { k: string; v: string; tone?: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: colours.border }}>
      <Text style={{ fontSize: 14, color: colours.muted }}>{k}</Text>
      <Text style={{ fontSize: 14, fontWeight: '700', color: tone ?? colours.text, flexShrink: 1, textAlign: 'right' }}>{v}</Text>
    </View>
  );
}
