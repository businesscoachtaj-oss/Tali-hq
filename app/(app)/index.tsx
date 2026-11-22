import { NightIdeaCard } from '@/components/NightIdeaCard';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/lib/auth';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { runAutopilot } from '@/lib/site';
import { anyCalendarToday, followUpsDue, inboundEmails, lifeSummary, logWorkout, myCredits, myHealth, openReminders, pendingApprovals, recentBriefs, markBriefRead, sortSides, type Approval, type InboundEmail, type Brief, type CalendarToday, type Client, type Credits, type Health, type LifeSummary, type Reminder } from '@/lib/data';
import { YourDayCard } from '@/components/YourDayCard';
import { hasBusinessTools, isPaid, isPro } from '@/lib/plan';
import { HealthCard } from '@/components/HealthCard';
import { addDays, today } from '@/lib/dates';
import { DueList } from '@/components/DueList';
import { AddReminder } from '@/components/AddReminder';
import { Body, Card, Label, NightProvider } from '@/components/ui';
import { DraftCard } from '@/components/DraftCard';
import { AppTour } from '@/components/AppTour';
import { TOUR_STEPS, finishTour } from '@/lib/tour';
import { registerTarget, setTourScroller } from '@/lib/tourTargets';
import { colours, NO_BOTTOM, space } from '@/constants/theme';
// The owner's rhythm (3 Nov 2026): shutdown, week, goals, money, meetings, decisions, patterns.
import { ShutdownCard } from '@/components/ShutdownCard';
import { todaysShutdown, type Shutdown } from '@/lib/rhythm';
import { useWeekCard, WeekCardView } from '@/components/WeekCard';
import { useGoalsCard, GoalsCardView } from '@/components/GoalsCard';
import { MoneyCard } from '@/components/MoneyCard';
import { GlanceGrid, FoldList, ChipPicker, type Tile, type Fold } from '@/components/Glance';
import { loadMoneyPicture, money0, runwayLabel, type MoneyPicture } from '@/lib/money';
import { decisions as loadDecisions, type Decision } from '@/lib/decisions';
import { MeetingNudge } from '@/components/MeetingNudge';
import { DecisionsCard } from '@/components/DecisionsCard';
import { PatternsCard } from '@/components/PatternsCard';
import { TodayHero } from '@/components/TodayHero';
import { BrainSky, type Lens, type SideStar } from '@/components/BrainSky';
import { useHasBusiness } from '@/lib/business';
import { type Room } from '@/components/RoomSwitch';
import { SheNoticed } from '@/components/SheNoticed';
import { patternsThisMonth, type PatternsBrief } from '@/lib/patterns';
import { PageSky, skyScroll } from '@/components/NightSky';
import { setDayShut } from '@/lib/sky';
// 12 Nov 2026 (Taj): Business and Life modes.
import { ModeSwitch, TagPill } from '@/components/ModeSwitch';
import { BusinessTools, ComingUpList, HabitsList, MoneyStats, MoneyWeekCard, PipelineRow, YoursCard, comingUp } from '@/components/ModeToday';
import { TeamWorkCard } from '@/components/TeamUi';
import { sideOf, useClockMode, useMode } from '@/lib/mode';
import { habitTicks, lifeItems, myWorld, setHabitDay, type LifeItem, type WorldNow } from '@/lib/world';
import { loadPersonalMoney, type PersonalMoney } from '@/lib/personalMoney';
// 16 Nov 2026 (Taj): Build your HQ. The user's own blocks sit under her brain.
// 17 Nov 2026: built for real. The whole of Today follows the saved layout, her brain fixed on top.
import { ExtraTile, HomeHeader, TrackerTile } from '@/components/Widgets';
import { BUILTINS, TRACKER_PRESETS, homeKeyFor, reloadHq, saveLayout, useHome, useHq, type BuiltIn, type Extra, type Tracker, type Widget } from '@/lib/widgets';
import { BillsBlock, BlockLabel, BookingsBlock, CashflowBlock, HappinessBlock, InvoicesBlock, JobsBlock, LeadsBlock, NoteStrip, QuoteRateBlock, StartHint, TaliPickBlock, TeamBlock, VisitsBlock } from '@/components/HqBlocks';
import { TeamHomeSection } from '@/components/TeamHome';
import { useBoard } from '@/lib/hqBoard';
import { useBusinesses } from '@/lib/businesses';
import { behind } from '@/lib/trackerMath';
import type { ScrollViewInstance, ViewInstance } from 'react-native';

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
    // Only worth saying in the last month (founding and comped trials can run for a year or more).
    if (days > 30) return null;
    return `${days} day${days === 1 ? '' : 's'} left of your ${c.plan === 'max' ? 'Tali HQ Max' : c.plan === 'pro' ? 'Tali HQ Pro' : 'Tali HQ'} trial`;
  }
  return null;
}

// Which blocks belong to which lens (pick a part of your life under her brain and the page follows).
// A block not listed here shows under every lens.
const LENS_BLOCKS: Partial<Record<BuiltIn, Lens[]>> = {
  needs_you: ['work', 'people'], due: ['work', 'people'], night_idea: ['growth'], money: ['money', 'work'], invoices: ['money', 'work'], bills: ['money'],
  pipeline: ['work', 'people'], jobs: ['work'], calendar: ['work', 'people'], goals: ['growth'], week: ['growth'], your_day: ['health'], habits: ['health', 'growth'],
  people: ['people'], journal: ['growth'], sleep: ['health'], team: ['work', 'people'], leads: ['work', 'people'], cashflow: ['money', 'work'], bookings: ['work'],
  visits: ['work'], quote_rate: ['work', 'money'], happiness: ['people', 'work'],
};
const LENS_GROUP: Record<string, Lens[]> = { Health: ['health'], Mind: ['health', 'growth'], Money: ['money'], People: ['people'], Business: ['work'], Work: ['work'] };

export default function Today() {
  const { profile, session, refreshProfile } = useAuth();
  // First-run tour, shown once until finished or skipped (and again from Me).
  const [tourClosed, setTourClosed] = useState(false);
  const showTour = !!profile && !profile.tour_done_at && !tourClosed;
  // Spots the tour points at, and a scroller so it can bring each one into view.
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollY = useRef(0);
  const heroRef = useRef<ViewInstance>(null);
  const yesRef = useRef<ViewInstance>(null);
  const dueRef = useRef<ViewInstance>(null);
  const glanceRef = useRef<ViewInstance>(null);
  const editRef = useRef<ViewInstance>(null);
  useEffect(() => {
    registerTarget('edit', editRef);
    registerTarget('hero', heroRef);
    registerTarget('yes', yesRef);
    registerTarget('due', dueRef);
    registerTarget('glance', glanceRef);
    setTourScroller(
      (targetY, wantedY) => scrollRef.current?.scrollTo({ y: Math.max(0, scrollY.current + targetY - wantedY), animated: true }),
      () => scrollRef.current?.scrollTo({ y: 0, animated: true }),
    );
    return () => setTourScroller(null);
  }, []);

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
  // 4 Nov 2026 (Taj): new emails (Tali's address, or Gmail/Outlook "needs you") get a nudge on Today.
  const [newMail, setNewMail] = useState<InboundEmail[]>([]);
  const [briefOpen, setBriefOpen] = useState(false);
  // The lens (10 Nov 2026): pick a part of your life under her brain and the whole page follows.
  const [lens, setLens] = useState<Lens | null>(null);
  const hide = (...areas: Lens[]) => (lens && !areas.includes(lens) ? ({ display: 'none' } as const) : null);
  // 4 Nov 2026: an earlier note opens in full the same way the morning brief does.
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  // 4 Nov 2026: once today's shutdown is done, Today goes into night mode (see TodayHero).
  const [shutdown, setShutdown] = useState<Shutdown | null>(null);
  // True once the first load has come back, so empty states don't flash before the data does.
  const [loaded, setLoaded] = useState(false);
  // 9 Nov 2026 look refresh: one brain, two rooms.
  const [room, setRoom] = useState<Room>('business');
  const hasBiz = useHasBusiness();
  const mode = useMode();
  const hq = useHq();
  const bz = useBusinesses();
  const homeKey = homeKeyFor(mode, hasBiz, bz.current);
  const home = useHome(homeKey, hasBiz);
  // Bumps on every reload so blocks that load their own numbers (Jobs on, the Business blocks) refresh too.
  const [tick, setTick] = useState(0);
  // A shared layout link opened before signing in or signing up: offer it once they are in.
  const [pendingLayout, setPendingLayout] = useState<string | null>(null);
  useEffect(() => { AsyncStorage.getItem('tali.pending_layout').then((v) => setPendingLayout(v && /^[a-z0-9-]{4,40}$/.test(v) ? v : null), () => {}); }, [tick]);
  const wantsBoard = home.plan === 'biz' && home.shown.some((w) => w.kind === 'builtin' && BUILTINS[w.builtin!]?.plan === 'biz');
  const { board } = useBoard(wantsBoard, null, bz.all ? 'all' : bz.current ?? 'main', tick);
  useClockMode();
  const [world, setWorld] = useState<WorldNow | null>(null);
  const [pm, setPm] = useState<PersonalMoney | null>(null);
  const [habits, setHabits] = useState<LifeItem[]>([]);
  const [ticks, setTicks] = useState<Record<string, string[]>>({});
  const week = useWeekCard(credits);
  const { goals } = useGoalsCard(credits);

  const load = useCallback(async () => {
    setLoadError('');
    reloadHq().catch(() => {});
    setTick((t) => t + 1);
    try {
      const endOfToday = addDays(new Date(new Date().setHours(0, 0, 0, 0)), 1).toISOString();
      const [b, a, c, r, f, sd] = await Promise.all([recentBriefs(5), pendingApprovals(), myCredits(), openReminders(endOfToday), followUpsDue(today()), todaysShutdown().catch(() => null)]);
      setBriefs(b);
      setApprovals(a);
      setCredits(c);
      setReminders(r);
      setFollowUps(f);
      setShutdown(sd?.tali_line ? sd : null);
      setLoaded(true);
      // Speed pass (13 Nov 2026): these six used to load one after another (six round trips and
      // six re-renders of Today). Now they load together and land in one update.
      // Health checks are part of Tali HQ and Pro (and the trial).
      const [hl, lf, pt, mn, mail, dec] = await Promise.all([
        isPaid(c) ? myHealth().catch(() => null) : Promise.resolve(null),
        lifeSummary().catch(() => null),
        isPro(c) ? patternsThisMonth().catch(() => null) : Promise.resolve(null),
        isPaid(c) ? loadMoneyPicture().catch(() => null) : Promise.resolve(null),
        isPaid(c) ? inboundEmails().catch(() => [] as InboundEmail[]) : Promise.resolve([] as InboundEmail[]),
        loadDecisions(1).catch(() => [] as Decision[]),
      ]);
      setHealth(hl);
      setLife(lf);
      setPatterns(pt);
      setMoney(mn);
      setNewMail(mail.filter((e) => e.status === 'new' && (e.source === 'tali_inbox' || e.category === 'needs_you')));
      setLastDecision(dec[0] ?? null);
      myWorld().then(setWorld).catch(() => {});
      if (isPaid(c)) loadPersonalMoney().then(setPm).catch(() => {});
      lifeItems('habit').then((h) => setHabits(h.filter((x) => !x.done_at))).catch(() => {});
      habitTicks().then(setTicks).catch(() => {});
      // Google Calendar, when connected: today's events and free gaps.
      if (isPaid(c)) anyCalendarToday().then((cal) => setCalendar(cal?.connected ? cal : null)).catch(() => setCalendar(null));
    } catch (e: any) {
      setLoadError(e?.message ?? 'Could not load today.');
      setLoaded(true);
    }
  }, []);

  useFocusLoad(load); // Speed pass (13 Nov 2026): see lib/useFocusLoad.ts

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const morning = briefs.find((b) => b.kind === 'morning');
  // A brief written before its lines were sorted: ask once, then show the tags.
  const sortedFor = useRef<string | null>(null);
  const briefNeedsSides = !!morning && !Array.isArray((morning.content as any).sides);
  const morningId = morning?.id ?? null;
  useEffect(() => {
    if (!hasBiz || !morningId || !briefNeedsSides || sortedFor.current === morningId) return;
    sortedFor.current = morningId;
    sortSides().then((ok) => { if (ok) recentBriefs(5).then(setBriefs).catch(() => {}); });
  }, [hasBiz, morningId, briefNeedsSides]);
  // 12 Nov 2026: On autopilot. Run the owner's rules once per visit, then show any new nudges.
  const autoRan = useRef(false);
  const autoOk = hasBusinessTools(credits, session?.user.id);
  useEffect(() => {
    if (!autoOk || autoRan.current) return;
    autoRan.current = true;
    runAutopilot().then((n) => { if (n) load(); });
  }, [autoOk]);
  const others = briefs.filter((b) => b !== morning && b.kind !== 'journal' && (b.kind as string) !== 'patterns');
  const trial = trialLine(credits);
  const night = !!shutdown;
  useEffect(() => { setDayShut(night); }, [night]);
  // With no business there is no business health to show (10 Nov 2026).
  const biz = useHasBusiness();
  // Money, This week and Goals are blocks now. Business health stays as the one glance tile.
  const healthTile = biz ? glanceTiles({ credits, money: null, health, week, goals: [] }).filter((t) => t.key === 'health') : [];
  const bizMode = biz && mode === 'business';
  // Someone with no business has no modes: they see everything on one Today, as before.
  const workSide = !biz || bizMode;
  const mine = !biz ? reminders : reminders.filter((r) => sideOf(r, 'business') === (bizMode ? 'business' : 'life'));
  const theirs = reminders.length - mine.length;
  // Things that need you on each side. The side you are not on shows the count, so nothing gets missed.
  const waiting = {
    business: approvals.length + newMail.length + reminders.filter((r) => sideOf(r, 'business') === 'business').length + followUps.length,
    life: reminders.filter((r) => sideOf(r, 'business') === 'life').length + (world?.health.checkup_next && world.health.checkup_next.days <= 0 ? 1 : 0) + (world?.home.admin_next && world.home.admin_next.days <= 0 ? 1 : 0),
  };
  const lifeStars: SideStar[] = [];
  if (world?.people.next_birthday && world.people.next_birthday.days <= 14) lifeStars.push({ key: 'bday', title: `${world.people.next_birthday.name}'s birthday`, sub: `In ${world.people.next_birthday.days} days`, area: 'people', to: '/dates' });
  if (habits.length) { const d = habits.filter((x) => (ticks[x.id] ?? []).includes(today())).length; lifeStars.push({ key: 'habits', title: `${d} of ${habits.length} habits done`, sub: d === habits.length ? 'All done today' : `${habits.find((x) => !(ticks[x.id] ?? []).includes(today()))?.title} is left`, area: 'growth', to: '/list?kind=habit' }); }
  if (world?.health.checkup_next && world.health.checkup_next.days <= 14) lifeStars.push({ key: 'checkup', title: world.health.checkup_next.title, sub: `In ${world.health.checkup_next.days} days`, area: 'health', to: '/list?kind=checkup' });
  const bizLine = (() => {
    const bits: string[] = [];
    if (approvals.length) bits.push(`${approvals.length} ${approvals.length === 1 ? 'draft is' : 'drafts are'} waiting on your yes`);
    if (money?.overdue) bits.push(`${money0(money.overdue)} is late`);
    if (followUps.length) bits.push(`${followUps.length} ${followUps.length === 1 ? 'follow-up is' : 'follow-ups are'} due`);
    return bits.length ? `${bits.join(', ')}.`.replace(/^./, (ch) => ch.toUpperCase()) : 'All quiet. Nothing is waiting on you.';
  })();

  // ── Build your HQ: one function per kind of block ──
  const pick = hq.notes.find((n) => n.kind === 'pick' && (!biz || !n.side || n.side === mode));
  // Set-wording nudges (paid plans, no AI): a tracker with "Tali keeps me on track" on that has fallen behind a steady pace.
  const nudges = home.plan === 'free' ? [] : home.shown
    .filter((w) => w.kind === 'tracker' && (w.tracker as Tracker).checkIn)
    .map((w) => w.tracker as Tracker)
    // A check-in she wrote this morning for the same tracker stands in for the set wording.
    .filter((t) => !hq.notes.some((n) => n.kind === 'nudge' && n.tracker_id === t.id))
    .filter((t) => behind(t, t.team ? t.teamValue ?? 0 : t.value, today(), new Date().getHours()))
    .slice(0, 2)
    .map((t) => {
      const v = t.team ? t.teamValue ?? 0 : t.value;
      const left = (t.target ?? 0) - v;
      const n = t.type === 'money' ? `A$${Math.round(left).toLocaleString('en-AU')}` : `${Number(left.toFixed(1))}${t.unit ? ` ${t.unit}` : ''}`;
      return { id: t.id, colour: t.colour, line: `${t.name} is behind: ${n} to go ${t.period === 'day' ? 'today' : t.period === 'week' ? 'this week' : 'this month'}.` };
    });
  const glanceOn = home.shown.find((w) => w.builtin === 'money' || w.builtin === 'week' || w.builtin === 'goals')?.id ?? null;
  const saveExtra = (id: string, extra: Extra) => { saveLayout(homeKey, home.blocks.map((b) => (b.id === id ? { ...b, extra } : b))).catch(() => {}); };
  const linkCard = (title: string, sub: string, to: string) => (
    <Pressable onPress={() => router.navigate(to as any)} accessibilityRole="button">
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text }}>{title}</Text>
            <Text style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>{sub}</Text>
          </View>
          <Text style={{ fontSize: 20, color: colours.faint }}>{'›'}</Text>
        </View>
      </Card>
    </Pressable>
  );
  const paid = isPaid(credits);
  function builtinBody(k: BuiltIn): React.ReactNode {
    const title = BUILTINS[k].title;
    switch (k) {
      case 'needs_you':
        return (
          <>
            <BlockLabel>{title}</BlockLabel>
            {newMail.length ? (
              <Pressable onPress={() => router.navigate('/inbox')} accessibilityRole="button">
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: colours.text }}>
                        {newMail.length === 1 ? `Email from ${newMail[0].from_name || newMail[0].from_email || 'someone'}` : `${newMail.length} emails need a look`}
                      </Text>
                      <Text style={{ fontSize: 13, color: colours.muted, marginTop: 2, lineHeight: 19 }} numberOfLines={2}>
                        {newMail.length === 1 ? newMail[0].summary || newMail[0].subject || 'Tap to read it.' : newMail.map((e) => e.from_name || e.from_email).filter(Boolean).slice(0, 3).join(', ')}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 20, color: colours.faint }}>{'›'}</Text>
                  </View>
                </Card>
              </Pressable>
            ) : null}
            {approvals.length ? (
              <FoldList
                folds={approvals.map((a) => ({
                  key: a.id,
                  title: a.title,
                  hint: a.draft?.to_name ? `To ${a.draft.to_name}` : a.draft?.body?.slice(0, 60),
                  body: <DraftCard item={a} onDecided={(id) => setApprovals((list) => list.filter((x) => x.id !== id))} />,
                }))}
              />
            ) : null}
            {!newMail.length && !approvals.length ? <StartHint builtin="needs_you" /> : null}
          </>
        );
      case 'due':
        return (
          <>
            <BlockLabel>{title}</BlockLabel>
            {mine.length + (workSide ? followUps.length : 0) > 0 ? (
              <DueList reminders={mine} followUps={workSide ? followUps : []} onChange={load} />
            ) : loaded ? (
              <Card><Body muted>Nothing due. Add a reminder and I'll nudge you when it's time.</Body></Card>
            ) : (
              <Card><ActivityIndicator color={colours.purple} /></Card>
            )}
            <AddReminder onAdded={load} side={biz ? mode : undefined} />
            {biz && theirs > 0 ? <Text style={{ color: colours.faint, fontSize: 12.5, marginTop: 6 }}>{theirs} more due on the {bizMode ? 'Life' : 'Business'} side.</Text> : null}
          </>
        );
      case 'brief':
        return (
          <>
            <BlockLabel>{title}</BlockLabel>
            {morning ? <BriefCard brief={morning} open={briefOpen} onToggle={() => setBriefOpen((o) => !o)} onRead={() => { setBriefOpen(false); markBriefRead(morning.id).then(load); }} /> : <StartHint builtin="brief" />}
          </>
        );
      case 'night_idea':
        return <NightIdeaCard />;
      case 'tali_pick':
        return (<><BlockLabel>{title}</BlockLabel><TaliPickBlock note={pick} /></>);
      case 'money':
        if (workSide) return (
          <>
            <BlockLabel>{title}</BlockLabel>
            {!paid ? <StartHint builtin="money" to="/plans" cta="See plans" /> : money ? (biz ? <MoneyStats money={money} world={world} /> : <MoneyCard credits={credits} />) : <StartHint builtin="money" to="/money" />}
          </>
        );
        return (
          <>
            <BlockLabel>Your money this week</BlockLabel>
            {pm && pm.weeklyAmount != null ? <MoneyWeekCard pm={pm} /> : <StartHint builtin="money" to={paid ? '/money?side=personal' : '/plans'} cta={paid ? 'Open' : 'See plans'} />}
          </>
        );
      case 'invoices':
        return (<><BlockLabel>{title}</BlockLabel><InvoicesBlock money={money} /></>);
      case 'bills':
        return (<><BlockLabel>{title}</BlockLabel><BillsBlock pm={pm} /></>);
      case 'pipeline':
        return (<><BlockLabel>{title}</BlockLabel><PipelineRow world={world} followUps={followUps.length} /></>);
      case 'jobs':
        return (<><BlockLabel>{title}</BlockLabel><JobsBlock tick={tick} /></>);
      case 'calendar':
        return (<><BlockLabel>{title}</BlockLabel>{calendar ? <CalendarCard cal={calendar} /> : <StartHint builtin="calendar" to="/settings" cta="Settings" />}</>);
      case 'goals':
        return (<><BlockLabel>{title}</BlockLabel>{goals.length ? <GoalsCardView goals={goals} /> : <StartHint builtin="goals" to="/goals" />}</>);
      case 'week':
        return (
          <>
            <BlockLabel>{title}</BlockLabel>
            {week.loaded && week.paid && (week.commitments.length || week.reviewDue)
              ? <WeekCardView paid={week.paid} commitments={week.commitments} reviewDue={week.reviewDue} onTick={week.tick} />
              : <StartHint builtin="week" to={paid ? '/review' : '/plans'} cta={paid ? 'Review' : 'See plans'} />}
          </>
        );
      case 'your_day':
        return (<><BlockLabel>Your day</BlockLabel>{life ? <YourDayCard life={life} onTick={() => (life?.today_session ? logWorkout(today(), life.today_session).then(load) : undefined)} /> : <StartHint builtin="your_day" to="/settings" cta="Settings" />}</>);
      case 'habits': {
        const d = habits.filter((x) => (ticks[x.id] ?? []).includes(today())).length;
        return (
          <>
            <BlockLabel>{habits.length ? `Habits today, ${d} of ${habits.length}` : title}</BlockLabel>
            {habits.length ? (
              <HabitsList habits={habits} ticks={ticks} today={today()}
                onHabit={(id, on) => { setTicks((t) => ({ ...t, [id]: on ? [...(t[id] ?? []), today()] : (t[id] ?? []).filter((x) => x !== today()) })); setHabitDay(id, today(), on).catch(() => {}); }} />
            ) : <StartHint builtin="habits" to="/list?kind=habit" cta="Add one" />}
          </>
        );
      }
      case 'people':
        return (<><BlockLabel>Coming up</BlockLabel>{comingUp(world).length ? <ComingUpList world={world} /> : <StartHint builtin="people" to="/dates" />}</>);
      case 'journal':
        return linkCard('Write in your journal', 'Two lines is plenty. She learns from it.', '/journal');
      case 'sleep':
        return linkCard('Sleep sounds', 'Rain, waves or her night sky, with a timer', '/sleep');
      default: {
        // The Business blocks. They come with the Business plans and share one load.
        if (home.plan !== 'biz') return null;
        const body = !board ? <Card><ActivityIndicator color={colours.purple} /></Card>
          : board.locked ? null
          : k === 'team' ? <TeamBlock board={board} />
          : k === 'leads' ? <LeadsBlock board={board} />
          : k === 'cashflow' ? <CashflowBlock board={board} />
          : k === 'bookings' ? <BookingsBlock board={board} />
          : k === 'visits' ? <VisitsBlock board={board} />
          : k === 'quote_rate' ? <QuoteRateBlock board={board} />
          : k === 'happiness' ? <HappinessBlock board={board} onChanged={() => setTick((t) => t + 1)} />
          : null;
        return body ? (<><BlockLabel>{title}</BlockLabel>{body}</>) : null;
      }
    }
  }
  const renderWidget = (w: Widget) => {
    if (w.kind === 'tracker') {
      const groups = LENS_GROUP[TRACKER_PRESETS[(w.tracker as Tracker).preset ?? '']?.group ?? ''];
      if (lens && groups && !groups.includes(lens)) return null;
      return <TrackerTile key={w.id} w={w} />;
    }
    if (w.kind === 'extra') return lens ? null : <ExtraTile key={w.id} w={w} onChange={(x) => saveExtra(w.id, x)} />;
    const k = w.builtin!;
    if (lens && LENS_BLOCKS[k] && !LENS_BLOCKS[k]!.includes(lens)) return null;
    const body = builtinBody(k);
    if (!body) return null;
    const ref = k === 'needs_you' ? yesRef : k === 'due' ? dueRef : w.id === glanceOn ? glanceRef : undefined;
    return <View key={w.id} ref={ref} collapsable={false} style={{ width: '100%' }}>{body}</View>;
  };


  return (
    <NightProvider value={night}>
    <SafeAreaView style={{ flex: 1, backgroundColor: night ? '#0C0A24' : colours.bg }} edges={NO_BOTTOM}>
      {/* 23 Nov 2026 (paper and ink): Today is paper through the day and goes back into her night sky once the day is shut down. */}
      {night ? <PageSky /> : null}
      <ScrollView
        ref={scrollRef}
        onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; if (Platform.OS !== 'web') skyScroll.setValue(scrollY.current); }}
        scrollEventThrottle={16}
        contentContainerStyle={{ padding: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colours.purple} />}>
        <View ref={heroRef} collapsable={false}>
        {biz ? <View style={{ zIndex: 2 }}><ModeSwitch waiting={waiting} /></View> : null}
        {(
          <View style={{ marginHorizontal: -space.lg, marginTop: biz ? 0 : -space.lg }}>
            <BrainSky greeting={`${greeting()}, ${profile?.first_name || 'mate'}`} sub={trial} nightLine={night ? shutdown?.tali_line ?? null : undefined} lens={lens} onLens={setLens} side={biz ? mode : undefined} sideStars={lifeStars} />
            {morning && !night ? (
              <Pressable onPress={() => setBriefOpen((o) => !o)} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: 14, marginBottom: 6 }}>
                <Text style={{ color: colours.purple, fontSize: 14, fontWeight: '700' }}>{briefOpen ? 'Hide your brief' : 'Read your morning brief'} {'›'}</Text>
              </Pressable>
            ) : null}
          </View>
        )}
        </View>
        {/* 12 Nov 2026: anyone added to a team sees the work they have been given, straight under her brain. Nothing for everyone else. */}
        <View style={{ marginTop: space.md }}><TeamWorkCard /></View>
        {/* Day closed (Taj, 10 Nov 2026): only her brain and the two bedtime buttons. The day's lists come back in the morning. */}
        {night ? <View style={{ marginTop: space.lg }}><ShutdownCard hideLine /></View> : (<>
        {hq.notes.filter((n) => n.kind !== 'pick' && (!biz || !n.side || n.side === mode)).slice(0, 3).map((n) => <NoteStrip key={n.id} note={n} />)}
        {pendingLayout ? (
          <Pressable onPress={() => router.navigate(`/hq/${pendingLayout}` as any)} accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colours.purpleSoft, borderRadius: 14, borderWidth: 1, borderColor: colours.purple, paddingVertical: 10, paddingHorizontal: 12, marginTop: space.sm }}>
            <Text style={{ flex: 1, color: colours.text, fontSize: 13.5, lineHeight: 19 }}>You opened a shared HQ layout before you signed in. Want to add it to your home?</Text>
            <Text style={{ color: colours.purple, fontWeight: '800' }}>Open it ›</Text>
          </Pressable>
        ) : null}
        {/* 9 Nov 2026 "life with a growing brain": work and life together, the way a day really is. */}
        {bizMode ? null : <View style={hide()}><SheNoticed /></View>}

        {morning && briefOpen && !home.shown.some((w) => w.builtin === 'brief') ? (
          <BriefCard brief={morning} open onToggle={() => setBriefOpen(false)} onRead={() => { setBriefOpen(false); markBriefRead(morning.id).then(load); }} />
        ) : null}

        {/* Health lens: food and training come up to the top, so the lens has something to show. */}
        {lens === 'health' && life && !home.shown.some((w) => w.builtin === 'your_day') ? (
          <>
            <Label>Your day</Label>
            <YourDayCard life={life} onTick={() => (life?.today_session ? logWorkout(today(), life.today_session).then(load) : undefined)} />
          </>
        ) : null}

        {/* 17 Nov 2026: a teammate's team home, set by the owner, sits above their own blocks. */}
        {workSide ? hq.teamHomes.map((t) => <TeamHomeSection key={t.owner_id} team={t} tick={tick} />) : null}

        {/* 17 Nov 2026 (Build your HQ): everything from here follows the person's own layout. */}
        <HomeHeader mode={mode} editRef={editRef} />
        {nudges.map((n) => (
          <Pressable key={n.id} onPress={() => router.navigate(`/tracker?id=${n.id}` as any)} accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colours.orangeSoft, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,181,97,0.5)', paddingVertical: 9, paddingHorizontal: 12, marginBottom: space.sm }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: n.colour }} />
            <Text style={{ flex: 1, color: colours.text, fontSize: 13.5, lineHeight: 19 }}>{n.line}</Text>
          </Pressable>
        ))}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
          {home.shown.map(renderWidget)}
        </View>
        {home.loaded && !home.shown.length ? (
          <Card><Body muted>Your home is empty. Tap Edit home to add your first block.</Body></Card>
        ) : null}

        {workSide ? <View style={hide('work', 'people')}><MeetingNudge credits={credits} calendar={calendar} compact /></View> : null}

        {bizMode ? <><BusinessTools /><View style={{ height: space.lg }} /><SheNoticed /></> : biz ? <YoursCard /> : null}

        {healthTile.length ? (
          <>
            <View style={{ height: space.md }} />
            <View ref={glanceOn ? undefined : glanceRef} collapsable={false}>
              <Label>Business health</Label>
              <GlanceGrid tiles={healthTile} />
            </View>
          </>
        ) : glanceOn ? null : (
          <View ref={glanceRef} collapsable={false} />
        )}

        {(() => {
          const folds = moreFolds({
            calendar: home.shown.some((w) => w.builtin === 'calendar') ? null : calendar,
            life,
            patterns,
            lastDecision,
            others,
            noteOpen,
            onNote: setNoteOpen,
            onNoteRead: (id) => { setNoteOpen(null); markBriefRead(id).then(load); },
            onTick: () => (life?.today_session ? logWorkout(today(), life.today_session).then(load) : undefined),
            onPatternsRead: load,
          });
          return folds.length ? (
            <>
              <View style={{ height: space.lg }} />
              <Label>More from Tali</Label>
              <ChipPicker items={folds} />
            </>
          ) : null;
        })()}

        {/* ShutdownCard has its own heading (Tonight, or Day closed). */}
        {bizMode ? null : <ShutdownCard />}
        {loadError || hq.error ? (
          <Card>
            <Body muted>{loadError || hq.error} Pull down to try again.</Body>
          </Card>
        ) : null}
        <View style={{ height: space.xl }} />
        </>)}
      </ScrollView>
      {showTour ? <AppTour steps={TOUR_STEPS} onDone={closeTour} firstName={profile?.first_name} /> : null}
    </SafeAreaView>
    </NightProvider>
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
  if (health && health.status !== 'green' && health.items.length) {
    const n = health.items.length;
    bits.push(`${n === 1 ? 'one thing' : `${n} things`} worth a look in your business health`);
  }
  if (bits.length) return `You've got ${bits.join(', ')}.`;
  if (morning) return "Quiet one today. Nothing due, nothing waiting.";
  return "Nothing on yet. Tell me about your business in Talk and I'll have a brief for you tomorrow.";
}


// The morning brief, short by default: headline and the first three lines, the rest on tap.
function BriefCard({ brief, open, onToggle, onRead }: { brief: Brief; open: boolean; onToggle: () => void; onRead: () => void }) {
  const biz = useHasBusiness();
  const lines = brief.content.lines ?? [];
  const shown = open ? lines : lines.slice(0, 3);
  return (
    <Card>
      <Text style={{ fontSize: 17, fontWeight: '700', color: colours.text, marginBottom: 6 }}>{brief.content.headline || brief.title || 'Your brief'}</Text>
      {/* 12 Nov 2026 (Taj): one brief for both sides, each line tagged. */}
      {shown.map((l, i) => {
        const tag = ((brief.content as any).sides as string[] | undefined)?.[i];
        return (
          <View key={i} style={{ marginTop: 10 }}>
            {biz && (tag === 'life' || tag === 'business') ? <TagPill tag={tag} /> : null}
            <Text style={{ fontSize: 15, lineHeight: 22, color: colours.text, marginTop: 4 }}>{l}</Text>
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md }}>
        {open || lines.length > 3 ? (
          <Pressable onPress={onToggle} accessibilityRole="button">
            <Text style={{ fontSize: 14, fontWeight: '700', color: colours.purple }}>{open ? 'Close' : `Show all ${lines.length}`}</Text>
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
  if (money && (money.cashIn > 0 || money.owed > 0 || money.overdue > 0 || money.runwayWeeks !== null)) {
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
function moreFolds({ calendar, life, patterns, lastDecision, others, noteOpen, onNote, onNoteRead, onTick, onPatternsRead }: {
  calendar: CalendarToday | null;
  life: LifeSummary | null;
  patterns: PatternsBrief | null;
  lastDecision: Decision | null;
  others: Brief[];
  noteOpen: string | null;
  onNote: (id: string | null) => void;
  onNoteRead: (id: string) => void;
  onTick: () => void;
  onPatternsRead: () => void;
}): Fold[] {
  const folds: Fold[] = [];
  if (calendar?.connected) {
    const todayWord = new Date().toLocaleDateString('en-AU', { weekday: 'short' });
    const n = (calendar.events ?? []).filter((e) => e.when.startsWith(todayWord) || e.when === 'all day').length;
    folds.push({ key: 'cal', title: 'Calendar', hint: n ? `${n} thing${n === 1 ? '' : 's'} on today` : 'Nothing booked today', body: <CalendarCard cal={calendar} /> });
  }
  // 9 Nov 2026 look refresh: Your day lives in the Life room now.
  if (patterns) folds.push({ key: 'patterns', title: 'Tali noticed', hint: patterns.content?.patterns?.[0]?.pattern ?? 'This month\'s patterns', body: <PatternsCard brief={patterns} onRead={onPatternsRead} /> });
  if (lastDecision) folds.push({ key: 'decisions', title: 'Decisions', hint: lastDecision.decision, body: <DecisionsCard /> });
  if (others.length)
    folds.push({
      key: 'earlier',
      title: 'Earlier notes',
      hint: `${others.length} older note${others.length === 1 ? '' : 's'}`,
      body: (
        <>
          {others.map((b) =>
            noteOpen === b.id ? (
              <BriefCard key={b.id} brief={b} open onToggle={() => onNote(null)} onRead={() => onNoteRead(b.id)} />
            ) : (
              <Pressable key={b.id} onPress={() => onNote(b.id)} accessibilityRole="button" accessibilityLabel={`Open note from ${b.for_date}`}>
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: colours.muted }}>{b.for_date}</Text>
                      <Body>{b.content.headline || b.title || b.kind}</Body>
                    </View>
                    <Text style={{ fontSize: 20, color: colours.faint }}>{'›'}</Text>
                  </View>
                </Card>
              </Pressable>
            ),
          )}
        </>
      ),
    });
  return folds;
}
