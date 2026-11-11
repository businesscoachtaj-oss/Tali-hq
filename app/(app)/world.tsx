// 9 Nov 2026 "life with a growing brain": Your world. Everything in your life Tali helps with, grouped
// the way a life is, instead of a list of app features.
// 11 Nov 2026 (Taj: "it's all so bare and empty... People is just clients and leads, it's not friends,
// family... Growth is just goals"): filled in. Six parts now (Home and money is new). Each part opens
// with what is happening in it right now, from your own data, then everything inside it.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { lifeSummary, myCredits, type Credits, type LifeSummary } from '@/lib/data';
import { isPaid, isPro } from '@/lib/plan';
import { friendlyDate, isoDate } from '@/lib/dates';
import { dollars, loadPersonalMoney, type PersonalMoney } from '@/lib/personalMoney';
import { inDays, myWorld, type WorldNow } from '@/lib/world';
import { Screen } from '@/components/ui';
import { SkinHeader } from '@/components/PageSkin';
import { WorldMap } from '@/components/WorldMap';
import { colours, radius, space } from '@/constants/theme';
import { useHasBusiness } from '@/lib/business';
// 12 Nov 2026 (Taj): Business and Life modes.
import { ModeSwitch } from '@/components/ModeSwitch';
import { MODE, useMode } from '@/lib/mode';

type Row = { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; sub: string; to: string; params?: Record<string, string>; live?: string | null; locked?: boolean; pro?: boolean };
type Area = { title: string; line: string; colour: string; now: (string | null | false | undefined)[]; rows: Row[] };

const n = (count: number | undefined, one: string, many = one + 's') => (count ? `${count} ${count === 1 ? one : many}` : null);
const dueLine = (x: { title: string; days: number } | null | undefined) =>
  !x || x.days > 30 ? null : x.days < 0 ? `${x.title} is overdue` : `${x.title} is due ${inDays(x.days)}`;

export default function World() {
  const [credits, setCredits] = useState<Credits | null>(null);
  const [w, setW] = useState<WorldNow | null>(null);
  const [life, setLife] = useState<LifeSummary | null>(null);
  const [pm, setPm] = useState<PersonalMoney | null>(null);
  useFocusEffect(useCallback(() => {
    // Each piece loads on its own, so one that fails never empties the page.
    myCredits().then((c) => {
      setCredits(c);
      if (isPaid(c)) loadPersonalMoney().then(setPm).catch(() => {});
    }).catch(() => {});
    myWorld().then(setW).catch(() => {});
    lifeSummary().then(setLife).catch(() => {});
  }, []));
  const paid = isPaid(credits);
  const pro = isPro(credits);
  // 10 Nov 2026: someone who said "No, just me" at sign-up does not get the business tools.
  // Work is their job and their inbox. They can switch the rest on in Settings by adding a business.
  const hasBusiness = useHasBusiness();

  const p = w?.people, k = w?.work, h = w?.health, hm = w?.home, g = w?.growth, wd = w?.words;
  const stale = p?.stale ? (p.stale.days >= 14 ? `${Math.floor(p.stale.days / 7)} weeks` : `${p.stale.days} days`) : '';
  const left = pm && pm.weeklyAmount != null ? pm.weeklyAmount - pm.weekSpent : null;

  const areas: Area[] = [
    { title: 'People', line: hasBusiness ? 'Family, friends, clients and everyone who matters' : 'Family, friends and everyone who matters', colour: '#8EF0C8',
      now: [
        p?.next_birthday && p.next_birthday.days <= 30 ? `${p.next_birthday.name}'s birthday is ${inDays(p.next_birthday.days)}` : null,
        p?.stale ? `You have not caught up with ${p.stale.name} in ${stale}` : null,
        hasBusiness && p?.new_leads ? `${n(p.new_leads, 'new lead')} waiting on you` : null,
      ],
      rows: [
        { icon: 'heart-outline', title: 'Family', sub: 'Partner, kids, parents', to: '/clients', params: { tab: 'family' }, live: n(p?.family, 'person', 'people') },
        { icon: 'happy-outline', title: 'Friends', sub: 'The ones you want to keep close', to: '/clients', params: { tab: 'friend' }, live: n(p?.friend, 'person', 'people') },
        ...(hasBusiness ? [
          { icon: 'people-outline' as const, title: 'Clients', sub: 'Who you look after', to: '/clients', params: { tab: 'client' }, live: n(p?.client, 'person', 'people') },
          { icon: 'person-add-outline' as const, title: 'Leads', sub: 'Who might come on board', to: '/clients', params: { tab: 'lead' }, live: n(p?.lead, 'person', 'people') },
        ] : [
          { icon: 'people-outline' as const, title: 'Everyone else', sub: 'Neighbours, workmates, the people you mention', to: '/clients', params: { tab: 'client' }, live: n((p?.client ?? 0) + (p?.lead ?? 0), 'person', 'people') },
        ]),
        { icon: 'gift-outline', title: 'Dates that matter', sub: 'Birthdays and everything with a date on it', to: '/dates', live: p?.birthdays_30 ? `${n(p.birthdays_30, 'birthday')} in the next 30 days` : null },
      ] },
    hasBusiness ? { title: 'Work', line: 'The business, handled', colour: '#9FB7FF',
      now: [
        paid && k?.emails_need ? `${n(k.emails_need, 'email')} ${k.emails_need === 1 ? 'needs' : 'need'} you` : null,
        k?.drafts_pending ? `${n(k.drafts_pending, 'draft')} waiting on your yes` : null,
        paid && k?.owed ? `${dollars(k.owed)} owed across ${n(k.owed_count, 'invoice')}` : null,
        k?.todo_today ? `${n(k.todo_today, 'thing')} to do ${k.todo_today === 1 ? 'is' : 'are'} due today` : null,
      ],
      rows: [
        { icon: 'hammer-outline', title: 'Jobs and quotes', sub: 'A quote becomes a job, a job becomes an invoice', to: '/jobs' },
        { icon: 'funnel-outline', title: 'Pipeline', sub: 'Everyone who might become a job', to: '/pipeline' },
        { icon: 'calendar-outline', title: 'Bookings', sub: 'Your week and your booking link', to: '/bookings' },
        { icon: 'albums-outline', title: 'Projects', sub: 'The bigger pieces of work', to: '/projects' },
        { icon: 'mail-outline', title: 'Email', sub: 'Sorted, replies drafted', to: '/inbox', locked: !paid },
        { icon: 'document-text-outline', title: 'Invoices', sub: 'Make, share, track', to: '/invoices', locked: !paid },
        { icon: 'wallet-outline', title: 'Money', sub: 'In, owed and runway', to: '/money', locked: !paid },
        { icon: 'file-tray-full-outline', title: 'Receipts', sub: 'Ready for tax time', to: '/receipts', locked: !paid },
        { icon: 'checkbox-outline', title: 'To do', sub: 'What is on your plate', to: '/list', params: { kind: 'todo' }, live: n(k?.todo_open, 'open thing', 'open things') },
        { icon: 'flash-outline', title: 'Rules', sub: 'What she does on her own', to: '/rules', locked: !pro, pro: true },
      ] } : { title: 'Work', line: 'Your job, your inbox, your list', colour: '#9FB7FF',
      now: [
        paid && k?.emails_need ? `${n(k.emails_need, 'email')} ${k.emails_need === 1 ? 'needs' : 'need'} you` : null,
        k?.todo_today ? `${n(k.todo_today, 'thing')} to do ${k.todo_today === 1 ? 'is' : 'are'} due today` : null,
      ],
      rows: [
        { icon: 'mail-outline', title: 'Email', sub: 'Sorted, replies drafted', to: '/inbox', locked: !paid },
        { icon: 'checkbox-outline', title: 'To do', sub: 'What is on your plate', to: '/list', params: { kind: 'todo' }, live: n(k?.todo_open, 'open thing', 'open things') },
        { icon: 'briefcase-outline', title: 'Run a business?', sub: 'Add it in Settings for invoices, clients and receipts', to: '/settings' },
      ] },
    { title: 'Health', line: 'Body, food, sleep and headspace', colour: '#FF9EC4',
      now: [
        life?.sessions_planned ? `Trained ${life.sessions_done_this_week} of ${life.sessions_planned} sessions this week` : null,
        dueLine(h?.checkup_next),
      ],
      rows: [
        { icon: 'barbell-outline', title: 'Food and training', sub: 'Logged by chatting', to: '/life', live: life?.food_today?.items ? `About ${Math.round(life.food_today.calories).toLocaleString('en-AU')} cal logged today` : null },
        { icon: 'body-outline', title: 'Body', sub: 'Your weight and how it is trending', to: '/body', live: life?.weight ? `${life.weight.kg} kg, ${friendlyDate(life.weight.date).toLowerCase()}` : null },
        { icon: 'bed-outline', title: 'Sleep', sub: 'Sounds with a timer', to: '/sleep' },
        { icon: 'partly-sunny-outline', title: 'Headspace', sub: 'Your mood across the fortnight, from your journal', to: '/headspace', live: h?.moods_7 ? `${n(h.moods_7, 'mood')} logged this week` : null },
        { icon: 'medkit-outline', title: 'Check ups', sub: 'Doctor, dentist, scripts and when they are due', to: '/list', params: { kind: 'checkup' }, live: n(h?.checkups, 'check up') },
      ] },
    { title: 'Home and money', line: 'Your own money and the life admin', colour: '#9FE8FF',
      now: [
        left !== null ? (left < 0 ? `${dollars(-left)} over for the week` : `${dollars(left)} left to spend this week`) : null,
        dueLine(hm?.admin_next),
      ],
      rows: [
        { icon: 'cash-outline', title: 'Personal money', sub: 'Spending, budget and bills', to: '/money', params: { side: 'personal' }, locked: !paid },
        { icon: 'folder-open-outline', title: 'Life admin', sub: 'Rego, insurance, renewals, warranties', to: '/list', params: { kind: 'admin' }, live: n(hm?.admin_open, 'thing') ? `${n(hm?.admin_open, 'thing')} tracked` : null },
        { icon: 'home-outline', title: 'Home', sub: 'Jobs around the house and who to call', to: '/list', params: { kind: 'home' }, live: n(hm?.home_open, 'job') ? `${n(hm?.home_open, 'job')} to do` : null },
      ] },
    { title: 'Growth', line: 'Where you are heading, and who you are becoming', colour: '#FFE38A',
      now: [
        g?.habits ? `${g.habits_today} of ${n(g.habits, 'habit')} done today` : null,
        g?.wins_month ? `${n(g.wins_month, 'win')} this month` : null,
      ],
      rows: [
        { icon: 'flag-outline', title: 'Goals', sub: hasBusiness ? 'Business and personal' : 'Work and personal', to: '/goals', locked: !paid,
          live: paid && g && g.goals_business + g.goals_personal ? [g.goals_business ? `${g.goals_business} ${hasBusiness ? 'business' : 'work'}` : null, g.goals_personal ? `${g.goals_personal} personal` : null].filter(Boolean).join(', ') : null },
        { icon: 'repeat-outline', title: 'Habits', sub: 'Small things you are building', to: '/list', params: { kind: 'habit' }, live: n(g?.habits, 'habit') },
        { icon: 'library-outline', title: 'Learning', sub: 'What you are reading, watching or studying', to: '/list', params: { kind: 'learning' }, live: n(g?.learning, 'thing') ? `${n(g?.learning, 'thing')} on the go` : null },
        { icon: 'trophy-outline', title: 'Wins', sub: 'The good stuff, kept so you can look back', to: '/list', params: { kind: 'win' }, live: g?.wins_month ? `${g.wins_month} this month` : null },
        { icon: 'airplane-outline', title: 'Someday', sub: 'Trips, dreams and things you want to do one day', to: '/list', params: { kind: 'someday' }, live: n(g?.someday, 'dream') },
        { icon: 'calendar-outline', title: 'Weekly review', sub: "What moved and what's next", to: '/review', locked: !paid },
        { icon: 'git-branch-outline', title: 'Decisions', sub: 'What you decided and why', to: '/decisions' },
        { icon: 'moon-outline', title: 'Shut down', sub: 'Two minutes, then off', to: '/shutdown' },
      ] },
    { title: 'Your words', line: 'What you write, she learns from', colour: '#D7B5FF',
      now: [wd?.last_journal ? `Last journal entry was ${friendlyDate(isoDate(new Date(wd.last_journal))).toLowerCase()}` : null],
      rows: [
        { icon: 'book-outline', title: 'Journal', sub: 'Your time and your place', to: '/journal', live: n(wd?.journal, 'entry', 'entries') },
        { icon: 'document-text-outline', title: 'Notes', sub: 'Things to find again', to: '/notes', live: n(wd?.notes, 'note') },
        { icon: 'bulb-outline', title: 'Ideas', sub: 'Half thoughts she keeps warm for you', to: '/list', params: { kind: 'idea' }, live: n(wd?.ideas, 'idea') },
        { icon: 'school-outline', title: 'Night school', sub: 'What she studies for you tonight', to: '/night-school', locked: !pro, pro: true },
      ] },
  ];
  // Each mode keeps its own parts. People is in both. Growth is split: the business side is goals,
  // the weekly review and decisions; the life side is habits, learning, wins and someday.
  const mode = useMode();
  const split = hasBusiness;
  const PARTS = { business: ['People', 'Work', 'Growth'], life: ['People', 'Health', 'Home and money', 'Growth', 'Your words'] };
  const GROWTH = { business: ['Goals', 'Weekly review', 'Decisions'], life: ['Goals', 'Habits', 'Learning', 'Wins', 'Someday', 'Shut down'] };
  const shown = !split ? areas : areas.filter((a) => PARTS[mode].includes(a.title)).map((a) => {
    if (a.title === 'Growth') return { ...a, line: mode === 'business' ? 'Where the business is heading' : 'Who you are becoming', rows: a.rows.filter((r) => GROWTH[mode].includes(r.title)), now: mode === 'business' ? [] : a.now };
    if (a.title === 'People') return { ...a, now: a.now.filter((l) => (mode === 'business' ? !/birthday|caught up/.test(String(l)) : !/lead/.test(String(l)))) };
    return a;
  });
  return (
    <Screen>
      {split ? <View style={{ marginBottom: 14 }}><ModeSwitch /></View> : null}
      <SkinHeader id="brain" title={split ? (mode === 'business' ? 'Your business' : 'Your life') : 'Your world'} sub={split ? (mode === 'business' ? 'The business side of your world. Your people are on both sides. Tap a part to step into it.' : 'The life side of your world. Your people are on both sides. Tap a part to step into it.') : 'Everything she looks after, as she sees it. Each star is something she knows. Tap a part of your life to step into it.'} />
      <View style={{ marginHorizontal: -space.lg }}>
        <WorldMap homeCount={(hm?.admin_open ?? 0) + (hm?.home_open ?? 0) + (pm?.repeats.length ?? 0)} workTo={hasBusiness ? undefined : '/list?kind=todo'} show={split ? PARTS[mode] : undefined} lines={split ? (mode === 'business' ? { People: 'Clients, leads, family, friends', Growth: 'Goals, weekly review, decisions' } : { Growth: 'Habits, learning, wins, someday' }) : undefined} />
      </View>
      <Text style={{ color: colours.muted, fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: space.md }}>EVERYTHING, AS A LIST</Text>
      {shown.map((a) => {
        const now = a.now.filter(Boolean) as string[];
        return (
          <View key={a.title} style={{ marginBottom: space.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: a.colour, shadowColor: a.colour, shadowOpacity: 1, shadowRadius: 8 }} />
              <Text style={{ color: colours.text, fontSize: 28, fontFamily: 'InstrumentSerif_400Regular' }}>{a.title}</Text>
            </View>
            <Text style={{ color: colours.muted, fontSize: 13.5, marginBottom: 10 }}>{a.line}</Text>
            {/* What is happening in this part right now. Only real lines: with nothing to say, nothing shows. */}
            {now.length ? (
              <View style={{ gap: 6, marginBottom: 10 }}>
                {now.map((line) => (
                  <View key={line} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: a.colour }} />
                    <Text style={{ color: colours.text, fontSize: 13.5, flex: 1 }}>{line}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={{ backgroundColor: a.colour + '22', borderRadius: radius.card, borderWidth: 1, borderColor: a.colour + '80', overflow: 'hidden', shadowColor: a.colour, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } }}>
              {a.rows.map((r, i) => (
                <Pressable key={r.title} onPress={() => router.navigate((r.params ? { pathname: r.to, params: r.params } : r.to) as any)} accessibilityRole="button"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14, paddingHorizontal: space.lg, borderTopWidth: i ? 1 : 0, borderTopColor: a.colour + '40' }}>
                  <Ionicons name={r.icon} size={21} color={a.colour} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colours.text, fontSize: 16, fontWeight: '600' }}>{r.title}</Text>
                    <Text style={{ color: colours.muted, fontSize: 13, marginTop: 1 }}>{r.sub}</Text>
                    {r.live && !r.locked ? <Text style={{ color: a.colour, fontSize: 12.5, fontWeight: '600', marginTop: 3 }}>{r.live}</Text> : null}
                  </View>
                  {r.locked ? <Text style={{ fontSize: 11, fontWeight: '700', color: colours.purpleInk }}>{r.pro ? 'Pro' : 'HQ'}</Text> : null}
                  <Ionicons name="chevron-forward" size={18} color={colours.faint} />
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}
    </Screen>
  );
}
