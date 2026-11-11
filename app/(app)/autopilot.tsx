// 12 Nov 2026 (Taj): On autopilot. Rules that put a nudge on your To do so nothing slips. Part of the
// Business plans. Nothing here messages a customer. Texts and phone answering are marked coming soon.
import { useCallback, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { myCredits, type Credits } from '@/lib/data';
import { AUTO, autoCounts, autoRules, runAutopilot, setAutoRule, type AutoKind } from '@/lib/site';
import { hasBusinessTools } from '@/lib/plan';
import { ErrorText, Label, Loading, Screen } from '@/components/ui';
import { BLUE, Head, Line, Pill, Stats, TaliLine } from '@/components/Biz';
import { BizLock } from '@/components/BizLock';
import { colours, radius } from '@/constants/theme';

export default function Autopilot() {
  const { session } = useAuth();
  const [credits, setCredits] = useState<Credits | null>(null);
  const [rules, setRules] = useState<Record<string, boolean>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);
  const [added, setAdded] = useState(0);
  const [error, setError] = useState('');
  const ok = hasBusinessTools(credits, session?.user.id);

  const load = useCallback(async () => {
    setError('');
    try {
      const c = await myCredits();
      setCredits(c);
      if (hasBusinessTools(c, session?.user.id)) {
        setRules(await autoRules());
        setAdded(await runAutopilot());
        setCounts(await autoCounts());
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load this.'); }
    setLoaded(true);
  }, [session?.user.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function flip(kind: AutoKind, v: boolean) {
    if (!session) return;
    setRules((r) => ({ ...r, [kind]: v }));
    try {
      await setAutoRule(session.user.id, kind, v);
      if (v) { setAdded(await runAutopilot()); setCounts(await autoCounts()); }
    } catch (e) { setRules((r) => ({ ...r, [kind]: !v })); setError(e instanceof Error ? e.message : 'Could not save that.'); }
  }

  if (!loaded) return <Loading />;
  if (!ok) {
    return <BizLock title="On autopilot" sub="Rules that keep your business moving. Tali watches your quotes, invoices, leads and bookings and puts a nudge on your To do."
      points={[
        { icon: 'flash-outline', title: 'Nothing slips', sub: 'A quote with no answer, a late invoice, a lead left waiting' },
        { icon: 'checkbox-outline', title: 'It lands on your To do', sub: 'Tagged Business, so it shows up on the right side' },
        { icon: 'hand-left-outline', title: 'You stay in charge', sub: 'Nothing is sent to a customer without your yes' },
      ]} />;
  }

  const on = AUTO.filter((a) => rules[a.kind]).length;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const card = { backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, paddingHorizontal: 14 } as const;
  return (
    <Screen onRefresh={load}>
      <Head over="Business" title="On autopilot" sub="Switch on a rule and Tali puts a nudge on your To do when it happens. She does not message anyone for you here." />
      <Stats items={[{ label: 'Rules on', value: String(on) }, { label: 'Nudges, 30 days', value: String(total) }]} />
      {added ? <TaliLine>I just added {added} {added === 1 ? 'nudge' : 'nudges'} to your To do.</TaliLine> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Label>Rules</Label>
      <View style={card}>
        {AUTO.map((a, i) => (
          <Line key={a.kind} first={!i} icon="flash-outline" colour={rules[a.kind] ? BLUE : colours.muted} title={a.title}
            sub={`${a.sub}${counts[a.kind] ? `. ${counts[a.kind]} in the last 30 days` : ''}`}
            right={<Switch value={!!rules[a.kind]} onValueChange={(v) => flip(a.kind, v)} accessibilityLabel={a.title} trackColor={{ true: colours.purple, false: colours.borderStrong }} thumbColor="#FFFFFF" {...({ activeThumbColor: '#FFFFFF' } as object)} />} />
        ))}
      </View>
      <View style={{ height: 18 }} />
      <Label>Coming soon</Label>
      <View style={card}>
        <Line first icon="chatbubble-ellipses-outline" colour={colours.muted} title="Text messages" sub="Reminders and follow ups by text, sent on your yes" right={<Pill text="Coming soon" colour={colours.muted} />} />
        <Line icon="call-outline" colour={colours.muted} title="Tali answers your phone" sub="She takes the details when you miss a call" right={<Pill text="Coming soon" colour={colours.muted} />} />
      </View>
      <Text style={{ color: colours.faint, fontSize: 12.5, marginTop: 12, lineHeight: 18 }}>Rules are checked when you open Tali HQ.</Text>
    </Screen>
  );
}
