import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { followUpsDue, lifeSummary, logWorkout, myCredits, myHealth, openReminders, pendingApprovals, recentBriefs, markBriefRead, type Approval, type Brief, type Client, type Credits, type Health, type LifeSummary, type Reminder } from '@/lib/data';
import { YourDayCard } from '@/components/YourDayCard';
import { isPaid } from '@/lib/plan';
import { HealthCard } from '@/components/HealthCard';
import { addDays, today } from '@/lib/dates';
import { DueList } from '@/components/DueList';
import { AddReminder } from '@/components/AddReminder';
import { Body, Button, Card, Label, TaliSays, Title } from '@/components/ui';
import { DraftCard } from '@/components/DraftCard';
import { colours, space } from '@/constants/theme';

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
  const { profile } = useAuth();
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [followUps, setFollowUps] = useState<Client[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [life, setLife] = useState<LifeSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

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
  const others = briefs.filter((b) => b !== morning && b.kind !== 'journal');
  const trial = trialLine(credits);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colours.bg }} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colours.purple} />}>
        <Title sub={trial ?? undefined}>{`${greeting()}, ${profile?.first_name || 'mate'}`}</Title>

        {loadError ? (
          <Card>
            <Body muted>{loadError} Pull down to try again.</Body>
          </Card>
        ) : null}

        {health ? (
          <>
            <Label>Business health</Label>
            <HealthCard health={health} />
          </>
        ) : null}

        {reminders.length + followUps.length > 0 ? (
          <>
            <Label>Due today</Label>
            <DueList reminders={reminders} followUps={followUps} onChange={load} />
          </>
        ) : null}
        <AddReminder onAdded={load} />
        {life ? (
          <>
            <View style={{ height: space.sm }} />
            <Label>Your day</Label>
            <YourDayCard life={life} onTick={() => life.today_session ? logWorkout(today(), life.today_session).then(load) : undefined} />
          </>
        ) : null}
        <View style={{ height: space.sm }} />

        <Label>Needs you</Label>
        {approvals.length === 0 ? (
          <Card>
            <Body muted>Nothing waiting for your yes. Ask me to write a message or follow-up in Talk and it lands here.</Body>
          </Card>
        ) : (
          approvals.map((a) => (
            <DraftCard key={a.id} item={a} onDecided={(id) => setApprovals((list) => list.filter((x) => x.id !== id))} />
          ))
        )}

        <View style={{ height: space.md }} />
        <Label>Your morning brief</Label>
        {morning ? (
          <Card>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colours.text, marginBottom: 6 }}>
              {morning.content.headline || morning.title || 'Your brief'}
            </Text>
            {(morning.content.lines ?? []).map((l, i) => (
              <Text key={i} style={{ fontSize: 15, lineHeight: 22, color: colours.text, marginTop: 4 }}>
                {'•'} {l}
              </Text>
            ))}
            {!morning.read_at ? (
              <Button title="Got it" kind="ghost" onPress={() => markBriefRead(morning.id).then(load)} />
            ) : null}
          </Card>
        ) : (
          <TaliSays pose="think">
            Your first morning brief lands tomorrow. Until then, tell me about your business in Talk or jot something in your journal and I'll start learning.
          </TaliSays>
        )}

        {others.length ? (
          <>
            <View style={{ height: space.md }} />
            <Label>Earlier</Label>
            {others.map((b) => (
              <Card key={b.id}>
                <Text style={{ fontSize: 12, color: colours.muted }}>{b.for_date}</Text>
                <Body>{b.content.headline || b.title || b.kind}</Body>
              </Card>
            ))}
          </>
        ) : null}

        <Button title="Talk to Tali" onPress={() => router.navigate('/talk')} />
      </ScrollView>
    </SafeAreaView>
  );
}
