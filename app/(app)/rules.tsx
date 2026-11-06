import { useCallback, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { deleteRule, myCredits, rules as loadRules, saveRule, type Rule, type RuleType } from '@/lib/data';
import { friendlyTime } from '@/lib/dates';
import { isPro } from '@/lib/plan';
import { ChipPicker } from '@/components/ChipPicker';
import { BackLink, Button, Card, ErrorText, Label, Screen, TaliSays, Title, useConfirm } from '@/components/ui';
import { SkinHeader } from '@/components/PageSkin';
import { colours, radius, space } from '@/constants/theme';
import { answerRuleSuggestion, ruleSuggestions, type RuleSuggestion } from '@/lib/grow';

const TEMPLATES: { type: RuleType; title: string; what: (p: any) => string; defaults: Record<string, any> }[] = [
  {
    type: 'quiet_client',
    title: 'Spot quiet clients',
    what: (p) => `When an active client hasn't been in touch for ${p.days} days, mark them "Gone quiet" and put a follow-up on Today.`,
    defaults: { days: 14 },
  },
  {
    type: 'new_lead',
    title: 'Never miss a new lead',
    what: () => 'When a new lead has no follow-up date, set one for tomorrow.',
    defaults: {},
  },
  {
    type: 'overdue_invoice',
    title: 'Chase overdue invoices',
    what: (p) => `When an invoice is ${p.days} days overdue, draft a friendly reminder on Today for you to send.`,
    defaults: { days: 7 },
  },
  {
    type: 'weekly_reminder',
    title: 'Weekly reminder',
    what: (p) => `Every ${DAYS[(p.weekday ?? 1) - 1]} from ${hourLabel(p.hour ?? 9)}, remind me: ${p.text || '...'}`,
    defaults: { weekday: 1, hour: 9, text: '' },
  },
];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const hourLabel = (h: number) => (h === 12 ? '12pm' : h > 12 ? `${h - 12}pm` : `${h}am`);

export default function Rules() {
  const [pro, setPro] = useState<boolean | null>(null);
  const [list, setList] = useState<Rule[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  // 4 Nov 2026: cards used to mount before the saved rules arrived, so their useState locked in the
  // defaults and a saved "21 days" showed as "14 days". Now the cards wait for the first load, and
  // each card is keyed on the rule id so it remounts with the saved params when a rule appears.
  const [loaded, setLoaded] = useState(false);
  const [ideas, setIdeas] = useState<RuleSuggestion[]>([]);

  const load = useCallback(async () => {
    setError('');
    try {
      const c = await myCredits();
      setPro(isPro(c));
      if (isPro(c)) {
        const [r, sg] = await Promise.all([loadRules(), ruleSuggestions()]);
        setList(r);
        setIdeas(sg);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your rules.');
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function upsert(type: RuleType, params: Record<string, any>, enabled: boolean, id?: string) {
    if (type === 'weekly_reminder' && enabled && !String(params.text ?? '').trim()) return setError('Write what the weekly reminder should say.');
    setBusy(type);
    setError('');
    try {
      await saveRule({ id, type, params, enabled });
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save that rule.');
    }
    setBusy(null);
  }

  async function remove(id: string) {
    setBusy(id);
    try {
      await deleteRule(id);
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Could not remove that rule.');
    }
    setBusy(null);
  }

  if (pro === false) {
    return (
      <Screen skin="control">
        <SkinHeader id="control" title="Rules" onBack={() => router.navigate('/me')} backLabel="Back" />
        <TaliSays pose="think">Rules are part of Tali HQ Pro. You set the rule once and I handle it automatically, like flagging quiet clients or drafting reminders for overdue invoices.</TaliSays>
        <Button title="See plans" onPress={() => router.navigate('/plans')} />
      </Screen>
    );
  }

  return (
    <Screen skin="control">
      <SkinHeader id="control" title="Rules" sub="Set a rule once and Tali handles it automatically. Rules only change things inside Tali HQ. Anything that goes to another person still waits for your yes." onBack={() => router.navigate('/me')} backLabel="Back" />
      <ErrorText>{error}</ErrorText>
      {ideas.length ? (
        <>
          <Label>Tali suggests</Label>
          {ideas.map((sg) => (
            <SuggestionCard key={sg.id} sg={sg} onDone={(id) => { setIdeas((l) => l.filter((x) => x.id !== id)); load(); }} />
          ))}
          <View style={{ height: space.md }} />
          <Label>Your rules</Label>
        </>
      ) : null}
      {loaded ? TEMPLATES.map((t) => {
        const existing = list.find((r) => r.type === t.type);
        return <RuleCard key={existing?.id ?? t.type} template={t} rule={existing} busy={busy === t.type || busy === existing?.id} onSave={upsert} onRemove={remove} />;
      }) : null}
    </Screen>
  );
}

function RuleCard({
  template: t,
  rule,
  busy,
  onSave,
  onRemove,
}: {
  template: (typeof TEMPLATES)[number];
  rule?: Rule;
  busy: boolean;
  onSave: (type: RuleType, params: Record<string, any>, enabled: boolean, id?: string) => void;
  onRemove: (id: string) => void;
}) {
  const [params, setParams] = useState<Record<string, any>>(rule?.params ?? t.defaults);
  const { armed, confirm } = useConfirm();
  const on = !!rule?.enabled;
  const dirty = JSON.stringify(params) !== JSON.stringify(rule?.params ?? t.defaults);

  return (
    <Card style={on ? { borderLeftWidth: 5, borderLeftColor: colours.purple } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: colours.text }}>{t.title}</Text>
        <Switch value={on} disabled={busy} onValueChange={(v) => onSave(t.type, params, v, rule?.id)} trackColor={{ true: colours.purple, false: colours.borderStrong }} thumbColor="#FFFFFF" {...({ activeThumbColor: "#FFFFFF" } as object)} />
      </View>
      <Text style={{ fontSize: 14, color: colours.muted, marginTop: 6, lineHeight: 20 }}>{t.what(params)}</Text>

      {t.type === 'quiet_client' ? (
        <View style={{ marginTop: space.md }}>
          <Label>After</Label>
          <ChipPicker options={['7', '14', '21', '30'] as const} value={String(params.days) as any} label={(d) => `${d} days`} onChange={(d) => setParams({ ...params, days: Number(d) })} />
        </View>
      ) : null}
      {t.type === 'overdue_invoice' ? (
        <View style={{ marginTop: space.md }}>
          <Label>Overdue by</Label>
          <ChipPicker options={['3', '7', '14'] as const} value={String(params.days) as any} label={(d) => `${d} days`} onChange={(d) => setParams({ ...params, days: Number(d) })} />
        </View>
      ) : null}
      {t.type === 'weekly_reminder' ? (
        <View style={{ marginTop: space.md }}>
          <Label>Day</Label>
          <ChipPicker options={['1', '2', '3', '4', '5', '6', '7'] as const} value={String(params.weekday) as any} label={(d) => DAYS[Number(d) - 1].slice(0, 3)} onChange={(d) => setParams({ ...params, weekday: Number(d) })} />
          <Label>From</Label>
          <ChipPicker options={['7', '9', '12', '15', '18'] as const} value={String(params.hour) as any} label={(h) => hourLabel(Number(h))} onChange={(h) => setParams({ ...params, hour: Number(h) })} />
          <TextInput value={params.text} onChangeText={(text) => setParams({ ...params, text })} placeholder="Send invoices for the week" placeholderTextColor={colours.faint} maxLength={300}
            style={{ backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.borderStrong, borderRadius: radius.input, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16, color: colours.text }} />
        </View>
      ) : null}

      {dirty ? <Button title={on ? 'Save changes' : 'Turn on'} onPress={() => onSave(t.type, params, true, rule?.id)} busy={busy} /> : null}
      {rule?.runs ? (
        <Text style={{ fontSize: 12, color: colours.faint, marginTop: space.sm }}>
          Done {rule.runs} time{rule.runs === 1 ? '' : 's'}{rule.last_run_at ? `, last ${friendlyTime(rule.last_run_at)}` : ''}.
        </Text>
      ) : null}
      {rule && !on ? (
        <Pressable
          onPress={() => confirm('remove', () => onRemove(rule.id))}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={armed === 'remove' ? 'Tap again to remove this rule' : 'Remove this rule'}
          disabled={busy}
          style={{ alignSelf: 'flex-start', marginTop: space.sm, paddingVertical: 4 }}>
          <Text style={{ color: armed === 'remove' ? colours.danger : colours.muted, fontSize: 13, fontWeight: '600' }}>{armed === 'remove' ? 'Sure?' : 'Remove'}</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

// 6 Nov 2026 (Taj): rules Tali suggests from what she has seen. Nothing changes until you say yes.
const FROM = { weekly_review: 'From your weekly review', night_school: 'From night school', chats: 'From your chats' } as const;
function SuggestionCard({ sg, onDone }: { sg: RuleSuggestion; onDone: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function answer(yes: boolean) {
    setBusy(true);
    if (await answerRuleSuggestion(sg.id, yes)) onDone(sg.id);
    setBusy(false);
  }
  return (
    <Card style={{ backgroundColor: colours.purpleSoft, borderColor: colours.purple, borderWidth: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 11, color: colours.purpleInk, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', flex: 1 }}>{FROM[sg.from]}</Text>
        <View style={{ paddingVertical: 2, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: colours.surface }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: colours.purpleInk }}>{sg.kind === 'habit' ? 'How I work' : 'Automatic'}</Text>
        </View>
      </View>
      <Text style={{ fontSize: 16, fontWeight: '800', color: colours.text, marginTop: 6, lineHeight: 22 }}>{sg.text}</Text>
      <Text style={{ fontSize: 13, color: colours.muted, marginTop: 4, lineHeight: 19 }}>{sg.why}</Text>
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
        <View style={{ flex: 1 }}>
          <Button title="Yes, add it" onPress={() => answer(true)} disabled={busy} />
        </View>
        <Pressable onPress={() => answer(false)} disabled={busy} accessibilityRole="button" style={{ paddingHorizontal: 16, justifyContent: 'center' }}>
          <Text style={{ color: colours.muted, fontWeight: '700' }}>Not now</Text>
        </Pressable>
      </View>
    </Card>
  );
}
