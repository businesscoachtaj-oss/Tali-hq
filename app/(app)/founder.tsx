// Founder screen (Taj only, 2 Nov 2026): how Tali HQ is going. Reached from Me when the signed-in
// user is FOUNDER_USER_ID; founder_stats() refuses anyone else.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { founderMail, founderStats, founderTopups, type FounderMail, type FounderStats, type FounderTopups } from '@/lib/data';
import { BackLink, Body, Card, ErrorText, Label, Screen, TaliSays, Title } from '@/components/ui';
import { FounderOps } from '@/components/FounderOps';
import { SkinHeader } from '@/components/PageSkin';
import { colours, elevation, radius, space } from '@/constants/theme';

// Claude Haiku list price, US$ per million tokens. Only used for the estimate on this screen.
const USD_IN_PER_M = 1;
const USD_OUT_PER_M = 5;
const AUD_PER_USD = 1.5;

const PLAN_NAMES: Record<string, string> = { free: 'Free', hq: 'HQ', pro: 'Pro' };
const FEATURE_NAMES: Record<string, string> = {
  chat: 'Chats',
  brief: 'Morning briefs',
  weekly_checkin: 'Friday check-ins',
  tali_journal: "Tali's journal",
  gmail_sort: 'Emails sorted',
  tali_email: 'Tali address emails',
  web_search: 'Web searches',
  web_search_free: 'Free web searches',
  deep_think: 'Deep think',
  deep_think_free: 'Free Deep think',
  night_school: 'Night school',
  voice: 'Voice clips',
};

const n = (v: number) => (v ?? 0).toLocaleString('en-AU');
const aud = (v: number) => `A$${v.toFixed(v < 10 ? 2 : 0)}`;

function costAud(tokensIn: number, tokensOut: number) {
  return ((tokensIn / 1e6) * USD_IN_PER_M + (tokensOut / 1e6) * USD_OUT_PER_M) * AUD_PER_USD;
}

export default function Founder() {
  const [s, setS] = useState<FounderStats | null>(null);
  const [error, setError] = useState('');
  const [topups, setTopups] = useState<FounderTopups | null>(null);
  const [mail, setMail] = useState<FounderMail | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [st, tu] = await Promise.all([founderStats(), founderTopups()]);
      setS(st);
      setTopups(tu);
      founderMail().then(setMail).catch(() => setMail(null));
    } catch (e: any) {
      setError(e?.message ?? 'Could not load.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const m = s?.month;
  const monthCost = m ? costAud(m.tokens_in, m.tokens_out) : 0;
  const perActive = m && m.active_users ? monthCost / m.active_users : 0;
  const conversion = s && s.accounts ? Math.round((s.paid_active / Math.max(1, s.accounts)) * 100) : 0;
  const mrr = s ? s.paid_hq * 19.99 + s.paid_pro * 49.99 : 0;
  // 6 Nov 2026 (Taj): top ups count in revenue too.
  const topMonth = Number(topups?.month_aud ?? 0);

  return (
    <Screen skin="founder">
      <SkinHeader id="founder" title="Founder" sub="How Tali HQ and the apps are going." onBack={() => router.back()} />
      <ErrorText>{error}</ErrorText>
      {/* 9 Nov 2026 (Tuesday list): what needs Taj across all three apps, first. */}
      <FounderOps />

      {!s ? (
        <TaliSays pose="think">Pulling the numbers together.</TaliSays>
      ) : (
        <>
          <Label>People</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Tile label="Accounts" value={n(s.accounts)} sub={`${n(s.onboarded)} finished onboarding`} />
            <Tile label="Signed up this week" value={n(s.signups_7d)} sub={`${n(s.signups_30d)} in 30 days`} />
            <Tile label="On trial" value={n(s.trialing)} sub={s.trials_ending_7d ? `${n(s.trials_ending_7d)} end within 7 days` : 'none ending this week'} />
            <Tile label="Paying" value={n(s.paid_active)} sub={`${n(s.paid_hq)} HQ, ${n(s.paid_pro)} Pro`} accent />
            <Tile label="Trial to paid" value={`${conversion}%`} sub={s.trial_expired_unpaid ? `${n(s.trial_expired_unpaid)} trials lapsed unpaid` : 'no lapsed trials'} />
            <Tile label="Revenue this month" value={aud(mrr + topMonth)} sub={`${aud(mrr)} plans + ${aud(topMonth)} top ups`} accent />
            <Tile label="Top ups this month" value={aud(topMonth)} sub={`${n(topups?.month_count ?? 0)} packs, ${aud(Number(topups?.total_aud ?? 0))} all time`} />
          </View>
          <Pressable onPress={() => router.navigate('/founder-users')} accessibilityRole="button" style={{ marginTop: space.sm, backgroundColor: colours.surface, borderRadius: radius.card, paddingVertical: 14, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', ...elevation.card }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colours.text }}>See every account</Text>
              <Text style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>Who signed up, their plan, trial and how much they use Tali</Text>
            </View>
            <Text style={{ fontSize: 22, color: colours.faint, fontWeight: '600' }}>{'›'}</Text>
          </Pressable>

          {mail ? (
            <>
              <View style={{ height: space.lg }} />
              <Label>Email coming in</Label>
              <Card>
                <Row k="Received today (limit 100 a day)" v={n(mail.today)} />
                <Row k="Received this month (limit 3,000)" v={n(mail.month)} />
                <Row k="People forwarding their Gmail" v={n(mail.forwarding_on)} />
                <Row k="Still on the old Gmail read (ends 24 Nov)" v={n(mail.old_read_left)} last />
              </Card>
              <Text style={{ color: colours.faint, fontSize: 12, marginTop: 6, lineHeight: 17 }}>The limits are Resend's free plan and are shared with every email the three apps send.</Text>
            </>
          ) : null}

          <View style={{ height: space.lg }} />
          <Label>Connected</Label>
          <Card>
            <Row k="Google (sending and Calendar)" v={n(s.google_connected)} />
            <Row k="Stripe (their own account)" v={n(s.stripe_connected)} />
            <Row k="Tali email addresses (Pro)" v={n(s.tali_addresses)} />
            <Row k="Devices getting notifications" v={`${n(s.push_devices)} (${n(s.push_web)} web)`} />
            <Row k="Waitlist emails with founding price" v={n(s.waitlist_founding_emails)} last />
          </Card>

          <View style={{ height: space.lg }} />
          <Label>This month</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Tile label="Active users" value={n(m!.active_users)} sub={`${n(m!.chats_today)} chats today`} />
            <Tile label="Credits used" value={n(m!.credits)} sub={`${n(m!.approvals_done)} things approved, ${n(m!.approvals_pending)} waiting`} />
            <Tile label="Claude cost (est.)" value={aud(monthCost)} sub={`${aud(perActive)} per active user`} accent />
            <Tile label="Tokens" value={`${(m!.tokens_in / 1000).toFixed(0)}k in`} sub={`${(m!.tokens_out / 1000).toFixed(1)}k out`} />
          </View>
          <Body muted>
            Cost assumes Claude Haiku at US${USD_IN_PER_M} in and US${USD_OUT_PER_M} out per million tokens, at {AUD_PER_USD} AUD to the dollar. Revenue is list price times paying accounts; founding members pay 42.5% less.
          </Body>

          <View style={{ height: space.md }} />
          <Card>
            {Object.entries(m!.by_feature)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v], i, arr) => (
                <Row key={k} k={FEATURE_NAMES[k] ?? k} v={n(v)} last={i === arr.length - 1} />
              ))}
            {!Object.keys(m!.by_feature).length ? <Body muted>Nothing used yet this month.</Body> : null}
          </Card>

          <View style={{ height: space.lg }} />
          <Label>Heaviest users this month</Label>
          <Card>
            {s.top_users.length === 0 ? <Body muted>Nobody yet.</Body> : null}
            {s.top_users.map((u, i) => (
              <View key={i} style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colours.border, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: colours.text }}>
                    {u.first_name ?? 'Someone'}
                    {u.business_name ? <Text style={{ fontWeight: '400', color: colours.muted }}>{`  ${u.business_name}`}</Text> : null}
                  </Text>
                  <Text style={{ color: colours.muted, fontSize: 13, marginTop: 2 }}>
                    {PLAN_NAMES[u.plan_id ?? ''] ?? u.plan_id ?? 'no plan'}
                    {u.status === 'trialing' ? ' trial' : ''}, {n(u.credits)} credits
                  </Text>
                </View>
                <Text style={{ fontWeight: '700', color: colours.text }}>{aud(costAud(u.tokens_in, u.tokens_out))}</Text>
              </View>
            ))}
          </Card>

          <Body muted>Updated {new Date(s.generated_at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}. Pull down or come back to refresh.</Body>
        </>
      )}
    </Screen>
  );
}

function Tile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <View style={{ flexBasis: '48%', flexGrow: 1, backgroundColor: accent ? colours.purpleSoft : colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: accent ? colours.purpleSoft : 'rgba(39,38,38,0.04)', padding: space.lg, ...(accent ? elevation.tile : elevation.card) }}>
      <Text style={{ color: colours.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</Text>
      <Text style={{ color: accent ? colours.purpleInk : colours.text, fontSize: 28, fontWeight: '800', marginTop: 4 }}>{value}</Text>
      {sub ? <Text style={{ color: colours.muted, fontSize: 13, marginTop: 2 }}>{sub}</Text> : null}
    </View>
  );
}

function Row({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: colours.border }}>
      <Text style={{ color: colours.muted, flex: 1 }}>{k}</Text>
      <Text style={{ color: colours.text, fontWeight: '700' }}>{v}</Text>
    </View>
  );
}
