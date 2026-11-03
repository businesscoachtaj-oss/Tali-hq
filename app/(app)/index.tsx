import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { anyCalendarToday, followUpsDue, lifeSummary, logWorkout, myCredits, myHealth, openReminders, pendingApprovals, recentBriefs, markBriefRead, type Approval, type Brief, type CalendarToday, type Client, type Credits, type Health, type LifeSummary, type Reminder } from '@/lib/data';
import { YourDayCard } from '@/components/YourDayCard';
import { isPaid, isPro } from '@/lib/plan';
import { HealthCard } from '@/components/HealthCard';
import { addDays, today } from '@/lib/dates';
import { DueList } from '@/components/DueList';
import { AddReminder } from '@/components/AddReminder';
import { Body, Button, Card, Label, TaliSays, Title } from '@/components/ui';
import { TaliAvatar } from '@/components/TaliAvatar';
import { DraftCard } from '@/components/DraftCard';
import { AppTour } from '@/components/AppTour';
import { TOUR_STEPS, finishTour } from '@/lib/tour';
import { colours, NO_BOTTOM, space } from '@/constants/theme';
// The owner's rhythm (3 Nov 2026): shutdown, week, goals, money, meetings, decisions, patterns.
import { ShutdownCard } from '@/components/ShutdownCard';
import { useWeekCard, WeekCardView } from '@/components/WeekCard';
import { useGoalsCard, GoalsCardView } from '@/components/GoalsCard';
import { MoneyCard } from '@/components/MoneyCard';
import { GlanceGrid, FoldList, type Tile, type Fold } from '@/components/Glance';
import { loadMoneyPicture, money0, runwayLabel, type MoneyPicture } from '@/lib/money';
import { decisions as loadDecisions, type Decision } from '@/lib/decisions';
import { Pressable } from 'react-native';
import { MeetingNudge } from '@/components/MeetingNudge';
import { DecisionsCard } from '@/components/DecisionsCard';
import { PatternsCard } from '@/components/PatternsCard';
import { TodayHero } from '@/components/TodayHero';
import { patternsThisMonth, type PatternsBrief } from '@/lib/patterns';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

function trialLine(c: Credits | null) {
  if (!c) return null;
  if (c.status === 'trialing' && c.trialEndsAt) {
    const days = Math.max(0, Math.ceil((new Date(c.trialEndsAt).getTime() - Date.now()) / 86400000));
    return `${days} day${days === 1 ? '' : 's'} left of your Tali HQ trial`;
  }
  return null;
}

export default function Today() {
  const { profile, session, refreshProfile } = useAuth();
  // First-run tour, shown once until finished or skipped (and again from Me).
  const [tourClosed, setTourClosed] = useState(false);
  const showTour = !!profile && !profile.tour_done_at && !tourClosed;

  async function closeTour() {
    setTourClosed(true);
    if (session) await finishTour(session.user.id).catch(() => {});
    await refreshProfile();
    setTourClosed(false);
  }
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [followUps, setFollowUps] = useState<Client[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [life, setLife] = useState<LifeSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [calendar, setCalendar] = useState<CalendarToday | null>(null);
  const [patterns, setPatterns] = useState<PatternsBrief | null>(null);
  const [money, setMoney] = useState<MoneyPicture | null>(null);
  const [lastDecision, setLastDecision] = useState<Decision | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const week = useWeekCard(credits);
  const { goals } = useGoalsCard(credits);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const endOfToday = addDays(new Date(new Date().setHours(0, 0, 0, 0)), 1).toISOString();
      const [b, a, c, r, f] = await Promise.all([recentBriefs(5), pendingApprovals(), myCredits(), openReminders(endOfToday), followUpsDue(today())]);
      setBriefs(b);
      setApprovals(a);
      setCredits(c);
      setReminders(r);
      setFollowUps(f);
      // Health checks are part of Tali HQ and Pro (and the trial).
      setHealth(isPaid(c) ? await myHealth().catch(() => null) : null);
      setLife(await lifeSummary().catch(() => null));
      setPatterns(isPro(c) ? await patternsThisMonth().catch(() => null) : null);
      setMoney(isPaid(c) ? await loadMoneyPicture().catch(() => null) : null);
      setLastDecision((await loadDecisions(1).catch(() => []))[0] ?? null);
      // Google Calendar, when connected: today's events and free gaps.
      if (isPaid(c)) anyCalendarToday().then((cal) => setCalendar(cal?.connected ? cal : null)).catch(() => setCalendar(null));
    } catch (e: any) {
      setLoadError(e?.message ?? 'Could not load today.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const morning = briefs.find((b) => b.kind === 'morning');
  const others = briefs.filter((b) => b !== morning && b.kind !== 'journal' && (b.kind as string) !== 'patterns');
  const trial = trialLine(credits);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colours.bg }} edges={NO_BOTTOM}>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colours.purple} />}>
        <TodayHero
          greeting={`${greeting()}, ${profile?.first_name || 'mate'}`}
          sub={trial}
          hello={helloLine({ morning, reminders: reminders.length + followUps.length, approvals: approvals.length, health })}
        />

        <MeetingNudge credits={credits} calendar={calendar} />

        {approvals.length ? (
          <>
            <Label>Needs your yes</Label>
            <FoldList
              folds={approvals.map((a) => ({
                key: a.id,
                title: a.title,
                hint: a.draft?.to_name ? `To ${a.draft.to_name}` : a.draft?.body?.slice(0, 60),
                body: <DraftCard item={a} onDecided={(id) => setApprovals((list) => list.filter((x) => x.id !== id))} />,
              }))}
            />
            <View style={{ height: space.sm }} />
          </>
        ) : null}

        <Label>Due today</Label>
        {reminders.length + followUps.length > 0 ? (
          <DueList reminders={reminders} followUps={followUps} onChange={load} />
        ) : (
          <Card>
            <Body muted>Nothing due. Add a reminder and I'll nudge you when it's time.</Body>
          </Card>
        )}
        <AddReminder onAdded={load} />

        <View style={{ height: space.md }} />
        <Label>Your morning brief</Label>
        {morning ? (
          <BriefCard brief={morning} open={briefOpen} onToggle={() => setBriefOpen((o) => !o)} onRead={() => markBriefRead(morning.id).then(load)} />
        ) : (
          <TaliSays pose="think">
            Your first morning brief lands tomorrow. Until then, tell me about your business in Talk and I'll start learning.
          </TaliSays>
        )}

        <ShutdownCard />

        <View style={{ height: space.md }} />
        <Label>At a glance</Label>
        <GlanceGrid tiles={glanceTiles({ credits, money, health, week, goals })} />

        {(() => {
          const folds = moreFolds({ calendar, life, patterns, lastDecision, others, onTick: () => (life?.today_session ? logWorkout(today(), life.today_session).then(load) : undefined), onPatternsRead: load });
          return folds.length ? (
            <>
              <View style={{ height: space.lg }} />
              <Label>More from Tali</Label>
              <FoldList folds={folds} />
            </>
          ) : null;
        })()}

        {loadError ? (
          <Card>
            <Body muted>{loadError} Pull down to try again.</Body>
          </Card>
        ) : null}
        <View style={{ height: space.xl }} />
      </ScrollView>
      {showTour ? <AppTour steps={TOUR_STEPS} onDone={closeTour} firstName={profile?.first_name} /> : null}
    </SafeAreaView>
  );
}

// Today's events from their Google Calendar (read only here; booking happens from Tali's drafts on Today).
function CalendarCard({ cal }: { cal: CalendarToday }) {
  const todayWord = new Date().toLocaleDateString('en-AU', { weekday: 'short' });
  const events = (cal.events ?? []).filter((e) => e.when.startsWith(todayWord) || e.when === 'all day');
  const later = (cal.events ?? []).length - events.length;
  return (
    <Card>
      {cal.error ? <Text style={{ color: colours.muted, fontSize: 14 }}>{cal.error}</Text> : null}
      {!cal.error && events.length === 0 ? <Text style={{ color: colours.muted, fontSize: 14 }}>Nothing in your calendar today.</Text> : null}
      {events.map((e, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: space.md, paddingVertical: 6, borderBottomWidth: i === events.length - 1 ? 0 : 1, borderBottomColor: colours.border }}>
          <Text numberOfLines={1} style={{ width: 150, fontSize: 13, color: colours.muted, fontWeight: '700' }}>{e.when.replace(/^\w{3} /, '')}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colours.text }}>{e.title}</Text>
            {e.location ? <Text style={{ fontSize: 12, color: colours.muted }}>{e.location}</Text> : null}
          </View>
        </View>
      ))}
      {cal.free_today?.length ? (
        <Text style={{ fontSize: 13, color: colours.purpleInk, marginTop: space.sm, lineHeight: 19 }}>Free: {cal.free_today.map((g) => g.replace(/\w{3} /g, '')).join(', ')}</Text>
      ) : null}
      {later > 0 ? <Text style={{ fontSize: 12, color: colours.faint, marginTop: 4 }}>{later} more tomorrow. Ask me in Talk to book something.</Text> : null}
    </Card>
  );
}

// One line from Tali that reads Today for you.
function helloLine({ morning, reminders, approvals, health }: { morning?: Brief; reminders: number; approvals: number; health: Health | null }) {
  const bits: string[] = [];
  if (reminders) bits.push(`${reminders} thing${reminders === 1 ? '' : 's'} due today`);
  if (approvals) bits.push(`${approvals} draft${approvals === 1 ? '' : 's'} waiting for your yes`);
  if (health && health.status !== 'green') bits.push('a couple of things worth a look in your business health');
  if (bits.length) return `You've got ${bits.join(', ')}. Your brief's below.`;
  if (morning) return "Quiet one today. Nothing due, nothing waiting. Your brief's below if you want the detail.";
  return "Nothing on yet. Tell me about your business in Talk and I'll have a brief for you tomorrow.";
}


// The morning brief, short by default: headline and the first three lines, the rest on tap.
function BriefCard({ brief, open, onToggle, onRead }: { brief: Brief; open: boolean; onToggle: () => void; onRead: () => void }) {
  const lines = brief.content.lines ?? [];
  const shown = open ? lines : lines.slice(0, 3);
  return (
    <Card>
      <Text style={{ fontSize: 17, fontWeight: '700', color: colours.text, marginBottom: 6 }}>{brief.content.headline || brief.title || 'Your brief'}</Text>
      {shown.map((l, i) => (
        <Text key={i} style={{ fontSize: 15, lineHeight: 22, color: colours.text, marginTop: 4 }}>
          {'•'} {l}
        </Text>
      ))}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md }}>
        {lines.length > 3 ? (
          <Pressable onPress={onToggle} accessibilityRole="button">
            <Text style={{ fontSize: 14, fontWeight: '700', color: colours.purple }}>{open ? 'Show less' : `Show all ${lines.length}`}</Text>
          </Pressable>
        ) : <View />}
        {!brief.read_at ? (
          <Pressable onPress={onRead} accessibilityRole="button">
            <Text style={{ fontSize: 14, fontWeight: '700', color: colours.muted }}>Got it</Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

// Four tiles. Each shows one number; tapping opens the full card underneath.
function glanceTiles({ credits, money, health, week, goals }: { credits: Credits | null; money: MoneyPicture | null; health: Health | null; week: ReturnType<typeof useWeekCard>; goals: import('@/lib/rhythm').Goal[] }): Tile[] {
  const tiles: Tile[] = [];
  if (money) {
    const runway = runwayLabel(money.runwayWeeks);
    tiles.push({
      key: 'money',
      label: 'Money',
      value: money.overdue > 0 ? `${money0(money.overdue)} late` : runway ?? money0(money.cashIn),
      hint: money.overdue > 0 ? `${money0(money.cashIn)} in this month` : runway ? 'runway' : 'in this month',
      tone: money.overdue > 0 ? 'bad' : 'good',
      body: <MoneyCard credits={credits} />,
    });
  }
  if (health) {
    const n = health.items.length;
    tiles.push({
      key: 'health',
      label: 'Health',
      value: health.status === 'green' ? 'All good' : `${n} to look at`,
      hint: health.status === 'green' ? 'business health' : health.items[0]?.text,
      tone: health.status === 'green' ? 'good' : health.status === 'amber' ? 'warn' : 'bad',
      body: <HealthCard health={health} />,
    });
  }
  if (week.loaded && week.paid && (week.commitments.length || week.reviewDue)) {
    const done = week.commitments.filter((c) => c.done_at).length;
    tiles.push({
      key: 'week',
      label: 'This week',
      value: week.commitments.length ? `${done} of ${week.commitments.length}` : 'Review',
      hint: week.reviewDue ? 'weekly review is due' : 'promises done',
      tone: week.reviewDue ? 'warn' : 'plain',
      body: <WeekCardView paid={week.paid} commitments={week.commitments} reviewDue={week.reviewDue} onTick={week.tick} />,
    });
  }
  if (goals.length) {
    const g = goals[0];
    const pct = g.target_number ? Math.round((g.current_number / g.target_number) * 100) : null;
    tiles.push({
      key: 'goals',
      label: 'Goals',
      value: pct !== null ? `${pct}%` : `${goals.length} on`,
      hint: g.title,
      tone: 'plain',
      body: <GoalsCardView goals={goals} />,
    });
  }
  return tiles;
}

// The quieter things, folded away until you want them.
function moreFolds({ calendar, life, patterns, lastDecision, others, onTick, onPatternsRead }: { calendar: CalendarToday | null; life: LifeSummary | null; patterns: PatternsBrief | null; lastDecision: Decision | null; others: Brief[]; onTick: () => void; onPatternsRead: () => void }): Fold[] {
  const folds: Fold[] = [];
  if (calendar?.connected) {
    const todayWord = new Date().toLocaleDateString('en-AU', { weekday: 'short' });
    const n = (calendar.events ?? []).filter((e) => e.when.startsWith(todayWord) || e.when === 'all day').length;
    folds.push({ key: 'cal', title: 'Your calendar', hint: n ? `${n} thing${n === 1 ? '' : 's'} on today` : 'Nothing booked today', body: <CalendarCard cal={calendar} /> });
  }
  if (life) folds.push({ key: 'day', title: 'Your day', hint: life.today_session ? `Training: ${life.today_session}` : 'Food, training and weight', body: <YourDayCard life={life} onTick={onTick} /> });
  if (patterns) folds.push({ key: 'patterns', title: 'Tali noticed', hint: patterns.content?.patterns?.[0]?.pattern ?? 'This month\'s patterns', body: <PatternsCard brief={patterns} onRead={onPatternsRead} /> });
  if (lastDecision) folds.push({ key: 'decisions', title: 'Decisions', hint: lastDecision.decision, body: <DecisionsCard /> });
  if (others.length)
    folds.push({
      key: 'earlier',
      title: 'Earlier from Tali',
      hint: `${others.length} older note${others.length === 1 ? '' : 's'}`,
      body: (
        <>
          {others.map((b) => (
            <Card key={b.id}>
              <Text style={{ fontSize: 12, color: colours.muted }}>{b.for_date}</Text>
              <Body>{b.content.headline || b.title || b.kind}</Body>
            </Card>
          ))}
        </>
      ),
    });
  return folds;
}

const q = StyleSheet.create({
  hello: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginTop: -space.sm, marginBottom: space.lg },
  bubble: { flex: 1, backgroundColor: colours.purpleSoft, borderRadius: 16, borderBottomLeftRadius: 4, padding: space.md },
  bubbleText: { color: colours.purpleInk, fontSize: 15, lineHeight: 21 },
});
