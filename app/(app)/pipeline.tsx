// 12 Nov 2026 (Taj): the sales pipeline. Everyone who might become a job, by stage, stacked down the
// page. Built from what is already there: leads (People) and quotes (Jobs). Part of the Business plans.
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { clients as loadClients, myCredits, type Client, type Credits } from '@/lib/data';
import { jobs as loadJobs, type Job } from '@/lib/jobs';
import { friendlyDate, today } from '@/lib/dates';
import { hasBusinessTools } from '@/lib/plan';
import { Button, ErrorText, Loading, Screen } from '@/components/ui';
import { Amount, aud, Box, H, Head, Next, Stats, Sub, TaliLine } from '@/components/Biz';
import { BusinessBar, useBusinesses } from '@/lib/businesses';
import { BizLock } from '@/components/BizLock';
import { colours } from '@/constants/theme';

type Card = { key: string; who: string; what: string; value: number | null; age: string; next: string | null; open: () => void };
const daysSince = (iso: string | null | undefined) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).getTime()) / 86400000)) : null);
const ago = (n: number | null) => (n == null ? '' : n === 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`);

function leadNext(c: Client): string | null {
  const t = today();
  if (c.next_follow_up && c.next_follow_up < t) return `Follow-up was due ${friendlyDate(c.next_follow_up).toLowerCase()}.`;
  if (c.next_follow_up === t) return 'Follow-up is due today.';
  if (c.next_follow_up) return `Follow-up set for ${friendlyDate(c.next_follow_up).toLowerCase()}.`;
  const quiet = daysSince(c.last_contact_at);
  if (quiet != null && quiet >= 7) return `Quiet for ${quiet} days and no follow-up set.`;
  return 'No follow-up set.';
}

export default function Pipeline() {
  const { session } = useAuth();
  const [credits, setCredits] = useState<Credits | null>(null);
  const [allLeads, setLeads] = useState<Client[]>([]);
  const [allJobs, setJobs] = useState<Job[]>([]);
  // 12 Nov 2026: more than one business. Only this business's (or all of them together).
  const biz = useBusinesses();
  const leads = allLeads.filter(biz.visibleClient);
  const jobs = allJobs.filter(biz.visible);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const c = await myCredits();
      setCredits(c);
      if (hasBusinessTools(c, session?.user.id)) {
        const [p, j] = await Promise.all([loadClients(), loadJobs()]);
        setLeads(p.filter((x) => x.kind === 'lead'));
        setJobs(j);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your pipeline.');
    }
    setLoaded(true);
  }, [session?.user.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!loaded) return <Screen><Loading /></Screen>;
  if (!hasBusinessTools(credits, session?.user.id)) {
    return <BizLock title="Pipeline" sub="Everyone who might become a job, from first hello to won, with who to chase next."
      points={[{ icon: 'funnel-outline', title: 'Every lead in a stage', sub: 'New, talking, quoted, won' }, { icon: 'cash-outline', title: 'What it all adds up to', sub: 'The value in play and what you won this month' }, { icon: 'sparkles-outline', title: 'Who to chase first', sub: 'The biggest thing sitting still' }]} />;
  }

  const person = (c: Client): Card => ({ key: c.id, who: c.name, what: (c.notes || '').split('\n')[0].slice(0, 80), value: c.est_value != null ? Number(c.est_value) : null, age: c.last_contact_at ? `Last contact ${ago(daysSince(c.last_contact_at))}` : 'No contact logged yet', next: leadNext(c), open: () => router.navigate({ pathname: '/person', params: { id: c.id } }) });
  const quote = (j: Job, won = false): Card => {
    const d = daysSince(won ? j.accepted_at : j.sent_at);
    return { key: j.id, who: j.client_name || j.title, what: j.title, value: j.total, age: won ? `Won ${ago(d)}` : `Quote out ${d === 0 ? 'since today' : `${d} ${d === 1 ? 'day' : 'days'}`}`, next: won ? null : d != null && d >= 5 ? 'No answer yet. Worth a nudge.' : null, open: () => router.navigate('/jobs') };
  };
  const monthStart = `${today().slice(0, 7)}-01`;
  const quotedIds = new Set(jobs.filter((j) => j.status === 'sent' && j.client_id).map((j) => j.client_id));
  const stages: { name: string; colour: string; cards: Card[] }[] = [
    { name: 'New', colour: '#FFB561', cards: leads.filter((c) => c.status === 'new' && !quotedIds.has(c.id)).map(person) },
    { name: 'Talking', colour: '#7FA8FF', cards: leads.filter((c) => c.status === 'talking' && !quotedIds.has(c.id)).map(person) },
    { name: 'Quoted', colour: '#D7B5FF', cards: jobs.filter((j) => j.status === 'sent').map((j) => quote(j)) },
    { name: 'Won this month', colour: '#7FE0B0', cards: jobs.filter((j) => ['accepted', 'on', 'done', 'invoiced'].includes(j.status) && (j.accepted_at ?? '').slice(0, 10) >= monthStart).map((j) => quote(j, true)) },
  ];
  const sum = (cards: Card[]) => cards.reduce((a, c) => a + (c.value ?? 0), 0);
  const inPlay = sum(stages[0].cards) + sum(stages[1].cards) + sum(stages[2].cards);
  const won = sum(stages[3].cards);
  // Of the quotes that got an answer, how many were a yes.
  const yes = jobs.filter((j) => ['accepted', 'on', 'done', 'invoiced'].includes(j.status)).length;
  const no = jobs.filter((j) => j.status === 'lost').length;
  const rate = yes + no >= 3 ? `${Math.round((yes / (yes + no)) * 100)}%` : 'Too early';
  const all = stages.slice(0, 3).flatMap((s) => s.cards);
  const stuck = [...stages[2].cards].filter((c) => c.next).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0] ?? null;
  const empty = !leads.length && !jobs.length;
  const total = stages.reduce((a, s) => a + Math.max(sum(s.cards), s.cards.length ? 1 : 0), 0);

  return (
    <Screen onRefresh={load}>
      <BusinessBar />
      <Head over="Business" title="Pipeline" sub="Everyone who might become a job, from first hello to won. Leads come from Your people and quotes from Jobs." />
      <Stats items={[{ label: 'in play', value: aud(inPlay) }, { label: 'won this month', value: aud(won), colour: colours.good }, { label: 'quotes that win', value: rate }]} />
      {total > 0 ? (
        <>
          <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
            {stages.map((s) => <View key={s.name} style={{ flex: Math.max(sum(s.cards), s.cards.length ? 1 : 0), backgroundColor: s.colour }} />)}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
            {stages.map((s) => (
              <View key={s.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.colour }} />
                <Text style={{ color: colours.muted, fontSize: 12, fontWeight: '600' }}>{s.name}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
      {stuck ? <TaliLine>Chase {stuck.who} first. That quote is the biggest one sitting still.</TaliLine> : null}
      <Button title="Add a lead" onPress={() => router.navigate({ pathname: '/clients', params: { tab: 'lead' } })} />
      <Button title="New quote" kind="ghost" onPress={() => router.navigate('/jobs')} />
      <ErrorText>{error}</ErrorText>
      {empty ? <Box><Sub>Nothing in your pipeline yet. Add a lead, or tell Tali about someone who got in touch.</Sub></Box> : null}
      {!empty && all.length > 0 && all.every((c) => c.value == null || c.value === 0) ? <Sub>Add what a lead could be worth on their page and the totals fill in.</Sub> : null}
      <View style={{ height: 10 }} />
      {stages.map((s) => (
        <View key={s.name} style={{ marginBottom: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, marginTop: 6 }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: s.colour }} />
            <Text style={{ color: colours.text, fontSize: 26, fontFamily: 'InstrumentSerif_400Regular', flex: 1 }}>{s.name}</Text>
            <Text style={{ color: s.colour, fontSize: 14, fontWeight: '800' }}>{s.cards.length}{sum(s.cards) ? ` · ${aud(sum(s.cards))}` : ''}</Text>
          </View>
          {!s.cards.length ? <Text style={{ color: colours.faint, fontSize: 13, marginBottom: 10 }}>No one here.</Text> : null}
          {s.cards.map((c) => (
            <Box key={c.key} edge={s.colour} onPress={c.open}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <View style={{ flex: 1 }}><H>{c.who}</H>{c.what ? <Sub>{c.what}</Sub> : null}</View>
                {c.value ? <Amount>{aud(c.value)}</Amount> : null}
              </View>
              <Text style={{ color: colours.faint, fontSize: 12, marginTop: 6 }}>{c.age}</Text>
              {c.next ? <Next>{c.next}</Next> : null}
            </Box>
          ))}
        </View>
      ))}
    </Screen>
  );
}
