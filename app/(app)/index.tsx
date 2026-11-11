import { NightIdeaCard } from '@/components/NightIdeaCard';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { anyCalendarToday, followUpsDue, inboundEmails, lifeSummary, logWorkout, myCredits, myHealth, openReminders, pendingApprovals, recentBriefs, markBriefRead, type Approval, type InboundEmail, type Brief, type CalendarToday, type Client, type Credits, type Health, type LifeSummary, type Reminder } from '@/lib/data';
import { YourDayCard } from '@/components/YourDayCard';
import { isPaid, isPro } from '@/lib/plan';
import { HealthCard } from '@/components/HealthCard';
import { addDays, today } from '@/lib/dates';
import { DueList } from '@/components/DueList';
import { AddReminder } from '@/components/AddReminder';
import { Body, Card, Label } from '@/components/ui';
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
import { Aurora } from '@/components/Aurora';
// 12 Nov 2026 (Taj): Business and Life modes.
import { ModeSwitch, TagPill } from '@/components/ModeSwitch';
import { BusinessBoard, BusinessTools, LifeBoard } from '@/components/ModeToday';
import { sideOf, useClockMode, useMode } from '@/lib/mode';
import { habitTicks, lifeItems, myWorld, setHabitDay, type LifeItem, type WorldNow } from '@/lib/world';
import { loadPersonalMoney, type PersonalMoney } from '@/lib/personalMoney';

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

// Which At a glance tiles belong to which lens. The 'health' tile is business health, so it sits with work.
const LENS_TILES: Record<string, string[]> = { money: ['money'], work: ['health', 'money'], growth: ['week', 'goals'], health: [], people: [] };

export default function Today() {
  const { profile, session, refreshProfile } = useAuth();
  // First-run tour, shown once until finished or skipped (and again from Me).
  const [tourClosed, setTourClosed] = useState(false);
  const showTour = !!profile && !profile.tour_done_at && !tourClosed;
  // Spots the tour points at, and a scroller so it can bring each one into view.
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const heroRef = useRef<View>(null);
  const yesRef = useRef<View>(null);
  const dueRef = useRef<View>(null);
  const glanceRef = useRef<View>(null);
  useEffect(() => {
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
  const mode = useMode();
  useClockMode();
  const [world, setWorld] = useState<WorldNow | null>(null);
  const [pm, setPm] = useState<PersonalMoney | null>(null);
  const [habits, setHabits] = useState<LifeItem[]>([]);
  const [ticks, setTicks] = useState<Record<string, string[]>>({});
  const week = useWeekCard(credits);
  const { goals } = useGoalsCard(credits);

  const load = useCallback(async () => {
    setLoadError('');
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
      // Health checks are part of Tali HQ and Pro (and the trial).
      setHealth(isPaid(c) ? await myHealth().catch(() => null) : null);
      setLife(await lifeSummary().catch(() => null));
      setPatterns(isPro(c) ? await patternsThisMonth().catch(() => null) : null);
      setMoney(isPaid(c) ? await loadMoneyPicture().catch(() => null) : null);
      setNewMail(isPaid(c) ? (await inboundEmails().catch(() => [])).filter((e) => e.status === 'new' && (e.source === 'tali_inbox' || e.category === 'needs_you')) : []);
      setLastDecision((await loadDecisions(1).catch(() => []))[0] ?? null);
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
  const night = !!shutdown;
  useEffect(() => { setDayShut(night); }, [night]);
  // With no business there is no business health to show (10 Nov 2026).
  const biz = useHasBusiness();
  const allTiles = glanceTiles({ credits, money, health, week, goals }).filter((t) => biz || t.key !== 'health');
  // Business mode shows money as its own row of numbers, so the tile is not repeated.
  const bizMode = biz && mode === 'business';
  // Someone with no business has no modes: they see everything on one Today, as before.
  const workSide = !biz || bizMode;
  const tiles = !biz ? allTiles : bizMode ? allTiles.filter((t) => t.key !== 'money') : [];
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colours.bg }} edges={NO_BOTTOM}>
      <PageSky />
      <Aurora />
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
        {/* Day closed (Taj, 10 Nov 2026): only her brain and the two bedtime buttons. The day's lists come back in the morning. */}
        {night ? <View style={{ marginTop: space.lg }}><ShutdownCard hideLine /></View> : (<>
        {/* 9 Nov 2026 "life with a growing brain": work and life together, the way a day really is. */}
        {bizMode ? null : <View style={hide()}><SheNoticed /></View>}

        {morning && briefOpen && !night ? (
          <BriefCard brief={morning} open onToggle={() => setBriefOpen(false)} onRead={() => { setBriefOpen(false); markBriefRead(morning.id).then(load); }} />
        ) : null}

        {bizMode ? <BusinessBoard money={money} world={world} followUps={followUps.length} paid={isPaid(credits)} /> : null}

        {/* Health lens: food and training come up to the top, so the lens has something to show. */}
        {lens === 'health' && life ? (
          <>
            <Label>Your day</Label>
            <YourDayCard life={life} onTick={() => (life?.today_session ? logWorkout(today(), life.today_session).then(load) : undefined)} />
          </>
        ) : null}

        {workSide ? <View style={hide('work', 'people')}><MeetingNudge credits={credits} calendar={calendar} compact /></View> : null}

        <View style={hide('growth')}><NightIdeaCard /></View>

        <View style={workSide ? hide('work', 'people') : { display: 'none' }}>
        {newMail.length || approvals.length ? <Label>Needs you</Label> : null}
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
          <View ref={yesRef} collapsable={false}>
            <FoldList
              folds={approvals.map((a) => ({
                key: a.id,
                title: a.title,
                hint: a.draft?.to_name ? `To ${a.draft.to_name}` : a.draft?.body?.slice(0, 60),
                body: <DraftCard item={a} onDecided={(id) => setApprovals((list) => list.filter((x) => x.id !== id))} />,
              }))}
            />
            <View style={{ height: space.sm }} />
          </View>
        ) : null}
        </View>

        <View ref={dueRef} collapsable={false} style={hide('work', 'people')}>
        <Label>Due today</Label>
        {mine.length + (workSide ? followUps.length : 0) > 0 ? (
          <DueList reminders={mine} followUps={workSide ? followUps : []} onChange={load} />
        ) : loaded ? (
          <Card>
            <Body muted>Nothing due. Add a reminder and I'll nudge you when it's time.</Body>
          </Card>
        ) : (
          <Card>
            <ActivityIndicator color={colours.purple} />
          </Card>
        )}
        <AddReminder onAdded={load} side={biz ? mode : undefined} />
        {biz && theirs > 0 ? <Text style={{ color: colours.faint, fontSize: 12.5, marginTop: 6 }}>{theirs} more due on the {bizMode ? 'Life' : 'Business'} side.</Text> : null}
        </View>

        {bizMode ? <><BusinessTools /><View style={{ height: space.lg }} /><SheNoticed /></> : !biz ? null : (
          <LifeBoard world={world} pm={pm} habits={habits} ticks={ticks} today={today()}
            onHabit={(id, on) => { setTicks((t) => ({ ...t, [id]: on ? [...(t[id] ?? []), today()] : (t[id] ?? []).filter((d) => d !== today()) })); setHabitDay(id, today(), on).catch(() => {}); }} />
        )}


        {tiles.length ? (
          <>
            <View style={{ height: space.md }} />
            <View ref={glanceRef} collapsable={false}>
              <Label>At a glance</Label>
              <GlanceGrid tiles={lens ? tiles.filter((t) => (LENS_TILES[lens] ?? []).includes(t.key)) : tiles} />
            </View>
          </>
        ) : (
          <View ref={glanceRef} collapsable={false} />
        )}

        {(() => {
          const folds = moreFolds({
            calendar,
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

        {bizMode ? null : <LifeRoom life={life} onTick={() => (life?.today_session ? logWorkout(today(), life.today_session).then(load) : undefined)} tiles={[]} />}
        {loadError ? (
          <Card>
            <Body muted>{loadError} Pull down to try again.</Body>
          </Card>
        ) : null}
        <View style={{ height: space.xl }} />
        </>)}
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
            {tag === 'life' || tag === 'business' ? <TagPill tag={tag} /> : null}
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

// 9 Nov 2026 look refresh: the Life room on Today. Same cards as before, gathered in one place.
function LifeRoom({ life, onTick, tiles }: { life: LifeSummary | null; onTick: () => void; tiles: Tile[] }) {
  const link = (title: string, sub: string, to: string) => (
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
  return (
    <>
      {life ? (
        <>
          <Label>Your day</Label>
          <YourDayCard life={life} onTick={onTick} />
        </>
      ) : null}
      {tiles.length ? (
        <>
          <Label>This week</Label>
          <GlanceGrid tiles={tiles} />
        </>
      ) : null}
      {/* ShutdownCard has its own heading (Tonight, or Day closed). It showed twice. */}
      <ShutdownCard />
      {link('Write in your journal', 'Two lines is plenty. She learns from it.', '/journal')}
      {link('Sleep sounds', 'Rain, waves or her night sky, with a timer', '/sleep')}
    </>
  );
}
