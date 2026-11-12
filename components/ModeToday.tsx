// 12 Nov 2026 (Taj): what Today shows in each mode. Business is a dashboard:
// numbers first, then the pipeline, then the tools. Life is your day: habits, what is coming up, your own money.
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Card, Label } from '@/components/ui';
import { money0, runwayLabel, type MoneyPicture } from '@/lib/money';
import { dollars, type PersonalMoney } from '@/lib/personalMoney';
import { inDays, type LifeItem, type WorldNow } from '@/lib/world';
import { MODE } from '@/lib/mode';
import { colours, radius, space } from '@/constants/theme';

type Icon = React.ComponentProps<typeof Ionicons>['name'];
const go = (to: string, params?: Record<string, string>) => () => router.navigate((params ? { pathname: to, params } : to) as any);

function Stat({ label, value, hint, colour, onPress }: { label: string; value: string; hint?: string | null; colour: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ flex: 1, backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, padding: 14 }}>
      <Text style={{ color: colours.muted, fontSize: 12, fontWeight: '700' }}>{label}</Text>
      <Text style={{ color: colour, fontSize: 26, fontWeight: '800', marginTop: 4 }}>{value}</Text>
      {hint ? <Text numberOfLines={1} style={{ color: colours.faint, fontSize: 12, marginTop: 2 }}>{hint}</Text> : null}
    </Pressable>
  );
}

export function BusinessBoard({ money, world, followUps, paid }: { money: MoneyPicture | null; world: WorldNow | null; followUps: number; paid: boolean }) {
  const p = world?.people, k = world?.work;
  const runway = money ? runwayLabel(money.runwayWeeks) : null;
  const pipe: { n: number; label: string; to: string; params?: Record<string, string>; hot?: boolean }[] = [
    { n: p?.lead ?? 0, label: 'leads', to: '/clients', params: { tab: 'lead' }, hot: !!p?.new_leads },
    { n: followUps, label: 'follow-ups due', to: '/clients', hot: followUps > 0 },
    { n: p?.client ?? 0, label: 'clients', to: '/clients', params: { tab: 'client' } },
  ];
  return (
    <>
      {paid && money ? (
        <>
          <Label>Money</Label>
          <View style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Stat label="In this month" value={money0(money.cashIn)} hint={money.goingOut ? `${money0(money.goingOut)} going out` : null} colour={colours.good} onPress={go('/money')} />
              <Stat label="Owed to you" value={money0(money.owed)} hint={k?.owed_count ? `${k.owed_count} ${k.owed_count === 1 ? 'invoice' : 'invoices'} out` : null} colour={colours.text} onPress={go('/invoices')} />
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Stat label="Late" value={money0(money.overdue)} hint={money.overdueInvoices[0] ? `${money.overdueInvoices[0].client_name ?? 'One invoice'} is the oldest` : 'Nobody is late'} colour={money.overdue > 0 ? colours.danger : colours.good} onPress={go('/invoices')} />
              <Stat label="Runway" value={runway ?? 'Not set'} hint={runway ? 'at what you spend now' : 'Add your costs in Money'} colour={colours.text} onPress={go('/money')} />
            </View>
          </View>
        </>
      ) : null}
      <Label>Pipeline</Label>
      <View style={{ flexDirection: 'row', backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border }}>
        {pipe.map((x, i) => (
          <Pressable key={x.label} onPress={go(x.to, x.params)} accessibilityRole="button" style={{ flex: 1, alignItems: 'center', paddingVertical: 14, borderLeftWidth: i ? 1 : 0, borderLeftColor: colours.border }}>
            <Text style={{ color: x.hot ? colours.orange : colours.text, fontSize: 26, fontWeight: '800' }}>{x.n}</Text>
            <Text style={{ color: colours.muted, fontSize: 12, fontWeight: '600', marginTop: 2 }}>{x.label}</Text>
          </Pressable>
        ))}
      </View>
      {p?.new_leads ? <Text style={{ color: colours.orange, fontSize: 13, fontWeight: '700', marginTop: 8 }}>{p.new_leads} new {p.new_leads === 1 ? 'lead is' : 'leads are'} waiting on you</Text> : null}
    </>
  );
}

const TOOLS: { icon: Icon; title: string; sub: string; to: string; params?: Record<string, string> }[] = [
  { icon: 'hammer-outline', title: 'Jobs and quotes', sub: 'Quote, job, invoice', to: '/jobs' },
  { icon: 'funnel-outline', title: 'Pipeline', sub: 'Who to chase next', to: '/pipeline' },
  { icon: 'calendar-outline', title: 'Bookings', sub: 'Your week and your link', to: '/bookings' },
  { icon: 'albums-outline', title: 'Projects', sub: 'The bigger jobs', to: '/projects' },
  { icon: 'globe-outline', title: 'Website', sub: 'Your site, hosted', to: '/website' },
  { icon: 'pricetag-outline', title: 'Quote calculator', sub: 'A rough price, hosted', to: '/quote-calc' },
  { icon: 'flash-outline', title: 'On autopilot', sub: 'Nothing slips', to: '/autopilot' },
  { icon: 'calculator-outline', title: 'Bookkeeping', sub: 'A quarter on a page', to: '/books' },
  { icon: 'document-text-outline', title: 'Invoices', sub: 'Sent on your yes', to: '/invoices' },
  { icon: 'mail-outline', title: 'Inbox', sub: 'Replies drafted', to: '/inbox' },
  { icon: 'camera-outline', title: 'Receipts', sub: 'Ready for tax time', to: '/receipts' },
  { icon: 'checkbox-outline', title: 'To do', sub: 'The business list', to: '/list', params: { kind: 'todo' } },
];

export function BusinessTools() {
  const rows = Array.from({ length: Math.ceil(TOOLS.length / 2) }, (_, i) => TOOLS.slice(i * 2, i * 2 + 2));
  return (
    <>
      <Label>Tools</Label>
      <View style={{ gap: space.sm }}>
        {rows.map((row, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: space.sm }}>
            {row.map((t) => (
              <Pressable key={t.title} onPress={go(t.to, t.params)} accessibilityRole="button"
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: MODE.business.colour + '1F', borderRadius: radius.card, borderWidth: 1, borderColor: MODE.business.colour + '66', paddingVertical: 12, paddingHorizontal: 12 }}>
                <Ionicons name={t.icon} size={22} color={MODE.business.colour} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colours.text, fontSize: 14.5, fontWeight: '700' }}>{t.title}</Text>
                  <Text numberOfLines={1} style={{ color: colours.muted, fontSize: 11.5, marginTop: 1 }}>{t.sub}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </>
  );
}

function Row({ icon, title, sub, colour, onPress }: { icon: Icon; title: string; sub: string; colour: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, paddingHorizontal: space.lg }}>
      <Ionicons name={icon} size={20} color={colour} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colours.text, fontSize: 15, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: colours.muted, fontSize: 13, marginTop: 1 }}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colours.faint} />
    </Pressable>
  );
}

const when = (x: { title: string; days: number }) => (x.days < 0 ? 'Overdue' : `Due ${inDays(x.days)}`);

export function LifeBoard({ world, pm, habits, ticks, today, onHabit }: { world: WorldNow | null; pm: PersonalMoney | null; habits: LifeItem[]; ticks: Record<string, string[]>; today: string; onHabit: (id: string, on: boolean) => void }) {
  const p = world?.people, h = world?.health, hm = world?.home;
  const left = pm && pm.weeklyAmount != null ? pm.weeklyAmount - pm.weekSpent : null;
  const coming: { icon: Icon; title: string; sub: string; colour: string; to: string; params?: Record<string, string> }[] = [];
  if (p?.next_birthday && p.next_birthday.days <= 30) coming.push({ icon: 'gift-outline', title: `${p.next_birthday.name}'s birthday`, sub: inDays(p.next_birthday.days).replace(/^./, (c) => c.toUpperCase()), colour: '#8EF0C8', to: '/dates' });
  if (h?.checkup_next && h.checkup_next.days <= 30) coming.push({ icon: 'medkit-outline', title: h.checkup_next.title, sub: when(h.checkup_next), colour: '#FF9EC4', to: '/list', params: { kind: 'checkup' } });
  if (hm?.admin_next && hm.admin_next.days <= 30) coming.push({ icon: 'folder-open-outline', title: hm.admin_next.title, sub: when(hm.admin_next), colour: '#9FE8FF', to: '/list', params: { kind: 'admin' } });
  if (p?.stale) coming.push({ icon: 'happy-outline', title: `Catch up with ${p.stale.name}`, sub: `It has been ${p.stale.days >= 14 ? `${Math.floor(p.stale.days / 7)} weeks` : `${p.stale.days} days`}`, colour: '#8EF0C8', to: '/clients', params: { tab: 'friend' } });
  const doneToday = habits.filter((x) => (ticks[x.id] ?? []).includes(today)).length;
  return (
    <>
      {habits.length ? (
        <>
          <Label>Habits today, {doneToday} of {habits.length}</Label>
          <Card>
            {habits.slice(0, 5).map((x, i) => {
              const on = (ticks[x.id] ?? []).includes(today);
              return (
                <Pressable key={x.id} onPress={() => onHabit(x.id, !on)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: colours.border }}>
                  <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? MODE.life.colour : 'transparent', borderWidth: 2, borderColor: on ? MODE.life.colour : colours.purpleInk }}>
                    {on ? <Ionicons name="checkmark" size={16} color="#141033" /> : null}
                  </View>
                  <Text style={{ flex: 1, color: on ? colours.muted : colours.text, fontSize: 15, fontWeight: '600', textDecorationLine: on ? 'line-through' : 'none' }}>{x.title}</Text>
                </Pressable>
              );
            })}
          </Card>
        </>
      ) : null}
      {coming.length ? (
        <>
          <Label>Coming up</Label>
          <View style={{ backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, marginBottom: space.md }}>
            {coming.map((c, i) => (
              <View key={c.title} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: colours.border }}>
                <Row icon={c.icon} title={c.title} sub={c.sub} colour={c.colour} onPress={go(c.to, c.params)} />
              </View>
            ))}
          </View>
        </>
      ) : null}
      {left !== null ? (
        <>
          <Label>Your money this week</Label>
          <Pressable onPress={go('/money', { side: 'personal' })} accessibilityRole="button">
            <Card>
              <Text style={{ color: left < 0 ? colours.danger : colours.good, fontSize: 30, fontWeight: '800' }}>{dollars(Math.abs(left))}</Text>
              <Text style={{ color: colours.muted, fontSize: 13.5, marginTop: 2 }}>{left < 0 ? 'over for the week' : 'left to spend this week'}, {dollars(pm!.weekSpent)} spent so far</Text>
            </Card>
          </Pressable>
        </>
      ) : null}
      <Label>Yours</Label>
      <Card style={{ paddingVertical: 0, paddingHorizontal: 0 }}>
        <Row icon="globe-outline" title="My website" sub="A simple site of your own, hosted for you" colour={MODE.life.colour} onPress={go('/website')} />
      </Card>
    </>
  );
}
