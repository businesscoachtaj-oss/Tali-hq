import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { forgetMemory, myCredits, myMemories, type Credits, type Memory } from '@/lib/data';
import { isPaid, isPro } from '@/lib/plan';
import { resetTour } from '@/lib/tour';
import { Body, Button, Card, Label, Screen, Title, useConfirm } from '@/components/ui';
import { PatternsRow } from '@/components/PatternsCard';
import { colours, space } from '@/constants/theme';
import { FOUNDER_USER_ID } from '@/constants/business';

const PLAN_NAMES: Record<string, string> = { free: 'Free', hq: 'Tali HQ', pro: 'Tali HQ Pro' };

export default function Me() {
  const { profile, session, signOut, refreshProfile } = useAuth();
  const [credits, setCredits] = useState<Credits | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [showMemories, setShowMemories] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const { armed, confirm } = useConfirm();

  const load = useCallback(async () => {
    setError('');
    try {
      const [c, m] = await Promise.all([myCredits(), myMemories()]);
      setCredits(c);
      setMemories(m);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your account.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function forget(id: string) {
    if (confirmId !== id) return setConfirmId(id);
    setConfirmId(null);
    try {
      if (await forgetMemory(id)) setMemories((m) => m.filter((x) => x.id !== id));
    } catch (e: any) {
      setError(e?.message ?? 'Could not forget that.');
    }
  }

  const planName = credits ? PLAN_NAMES[credits.plan] ?? credits.plan : '';
  const trialing = credits?.status === 'trialing';
  const shown = showAll ? memories : memories.slice(0, 15);

  return (
    <Screen onRefresh={load}>
      <Title sub={session?.user.email}>{profile?.first_name || 'You'}</Title>
      {error ? <Card><Body muted>{error}</Body></Card> : null}

      <Label>Your plan</Label>
      <Card>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colours.text }}>
          {planName}
          {trialing ? ' (free trial)' : ''}
        </Text>
        {credits ? (
          credits.plan === 'free' || (!trialing && credits.status !== 'active') ? (
            <Body muted>{credits.messagesMonth ?? 50} messages a month with Tali.</Body>
          ) : (
            <>
              <Body muted>
                {Math.max(credits.creditsMonth - credits.used, 0).toLocaleString('en-AU')} of {credits.creditsMonth.toLocaleString('en-AU')} credits left this month.
              </Body>
              <View style={{ height: 8, backgroundColor: colours.sunk, borderRadius: 8, marginTop: space.sm, overflow: 'hidden' }}>
                <View style={{ height: 8, width: `${Math.min(100, (credits.used / Math.max(credits.creditsMonth, 1)) * 100)}%`, backgroundColor: colours.purple }} />
              </View>
              {trialing && credits.trialEndsAt ? (
                <Body muted>Trial ends {new Date(credits.trialEndsAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })}.</Body>
              ) : null}
            </>
          )
        ) : null}
        <Button title="See plans" kind="ghost" onPress={() => router.navigate('/plans')} />
      </Card>

      {/* 4 Nov 2026 (Taj): Settings up top, not under the memories list. */}
      <Button title="Settings" onPress={() => router.navigate('/settings')} />

      <View style={{ height: space.md }} />
      <Label>Tali's jobs</Label>
      <Card>
        <MenuRow title="Food and training" sub="Logged by chatting with Tali" onPress={() => router.navigate('/life')} />
        <MenuRow title="Sleep" sub="Rain, noise, ocean and more with a timer that fades out" onPress={() => router.navigate('/sleep')} />
        <MenuRow title="Night school" sub="Pick what Tali studies each night" locked={!isPro(credits)} pro onPress={() => router.navigate('/night-school')} />
        <MenuRow title="Invoices" sub="Make, share and track invoices" locked={!isPaid(credits)} onPress={() => router.navigate('/invoices')} />
        <MenuRow title="Money" sub="Cash in, owed, overdue, going out and runway" locked={!isPaid(credits)} onPress={() => router.navigate('/money')} />
        <MenuRow title="Decisions" sub="What you decided and why. Ask Tali if it still holds" onPress={() => router.navigate('/decisions')} />
        {/* 4 Nov 2026: Goals, Weekly review and Shut the day down were only reachable from Today. */}
        <MenuRow title="Goals" sub="The numbers you're chasing, and Tali holding you to them" locked={!isPaid(credits)} onPress={() => router.navigate('/goals')} />
        <MenuRow title="Weekly review" sub="Ten minutes a week on what moved, what slipped and what's next" locked={!isPaid(credits)} onPress={() => router.navigate('/review')} />
        <MenuRow title="Shut the day down" sub="Two minutes with Tali, then switch off" onPress={() => router.navigate('/shutdown')} />
        {/* Clients is the free tab, so no lock here. */}
        <MenuRow title="Clients" sub="Your people, and what Tali remembers about each" locked={false} onPress={() => router.navigate('/clients')} />
        <MenuRow title="Rules" sub="Things Tali handles automatically" locked={!isPro(credits)} pro onPress={() => router.navigate('/rules')} />
        <MenuRow title="Email" sub="Your Gmail or Outlook sorted, replies drafted. Her own address on Pro" locked={!isPaid(credits)} onPress={() => router.navigate('/inbox')} />
        <MenuRow title="Connections" sub="Google, Microsoft and Stripe" locked={!isPaid(credits)} last={session?.user.id !== FOUNDER_USER_ID} onPress={() => router.navigate({ pathname: '/settings', params: { section: 'connections' } })} />
        {session?.user.id === FOUNDER_USER_ID ? <MenuRow title="Founder" sub="Sign-ups, conversions, credits and cost. Only you see this" last onPress={() => router.navigate('/founder')} /> : null}
      </Card>

      <View style={{ height: space.md }} />
      {/* Patterns (Pro, 3 Nov 2026): last run and Run now; Free and HQ see the one line with Plans. */}
      <PatternsRow credits={credits} />

      <View style={{ height: space.md }} />
      <Label>What Tali knows about you</Label>
      <Card>
        <Body muted>
          Everything Tali remembers from your chats and journal. It's private to you. Tap Forget on anything you'd rather she didn't keep.
        </Body>
        {/* 4 Nov 2026 (Taj): collapsed by default so the page isn't 200 rows long. */}
        {!showMemories ? (
          <Button title={memories.length ? `Show ${memories.length} memories` : 'Show memories'} kind="ghost" onPress={() => setShowMemories(true)} />
        ) : memories.length === 0 ? (
          <Text style={{ color: colours.muted, marginTop: space.md }}>Nothing yet. Have a chat and she'll start learning.</Text>
        ) : (
          shown.map((m) => (
            <View key={m.id} style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start', paddingVertical: space.md, borderTopWidth: 1, borderTopColor: colours.border, marginTop: space.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: colours.purpleInk, fontWeight: '700', textTransform: 'uppercase' }}>{m.kind}</Text>
                <Text style={{ fontSize: 14, color: colours.text, lineHeight: 20, marginTop: 2 }}>{m.content}</Text>
              </View>
              <Pressable onPress={() => forget(m.id)} accessibilityRole="button" hitSlop={8}>
                <Text style={{ color: confirmId === m.id ? colours.danger : colours.muted, fontWeight: '700', fontSize: 13 }}>
                  {confirmId === m.id ? 'Sure?' : 'Forget'}
                </Text>
              </Pressable>
            </View>
          ))
        )}
        {showMemories && memories.length > 15 ? (
          <Button title={showAll ? 'Show fewer' : `Show all ${memories.length}`} kind="ghost" onPress={() => setShowAll(!showAll)} />
        ) : null}
        {showMemories ? <Button title="Hide memories" kind="ghost" onPress={() => { setShowMemories(false); setShowAll(false); }} /> : null}
      </Card>

      <Button
        title="Show me around again"
        kind="ghost"
        onPress={async () => {
          if (!session) return;
          try {
            await resetTour(session.user.id);
            await refreshProfile();
            router.navigate('/');
          } catch (e: any) {
            setError(e?.message ?? 'Could not restart the tour.');
          }
        }}
      />
      <Button title={armed === 'signout' ? 'Sure?' : 'Sign out'} kind="ghost" onPress={() => confirm('signout', signOut)} />
      <Text style={{ color: colours.faint, fontSize: 12, textAlign: 'center', marginTop: space.lg }}>Tali HQ by Totality 360. Made in Australia.</Text>
    </Screen>
  );
}

function MenuRow({ title, sub, locked, pro, last, onPress }: { title: string; sub: string; locked?: boolean; pro?: boolean; last?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: last ? 0 : 1, borderBottomColor: colours.border }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text }}>{title}</Text>
        <Text style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>{sub}</Text>
      </View>
      {locked ? (
        <Text style={{ fontSize: 11, fontWeight: '800', color: colours.purpleInk, backgroundColor: colours.purpleSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' }}>
          {pro ? 'PRO' : 'TALI HQ'}
        </Text>
      ) : (
        <Text style={{ fontSize: 20, color: colours.faint }}>{'\u203A'}</Text>
      )}
    </Pressable>
  );
}
