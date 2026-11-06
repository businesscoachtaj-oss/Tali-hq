import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { forgetMemory, myCredits, myMemories, type Credits, type Memory } from '@/lib/data';
import { isPaid, isPro } from '@/lib/plan';
import { resetTour } from '@/lib/tour';
import { Body, Button, Card, Label, Screen, useConfirm } from '@/components/ui';
import { PatternsRow } from '@/components/PatternsCard';
import { colours, elevation, radius, space } from '@/constants/theme';
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

  const left = credits ? Math.max(credits.creditsMonth - credits.used, 0) : 0;
  const onFree = !!credits && (credits.plan === 'free' || (!trialing && credits.status !== 'active'));
  const initial = (profile?.first_name || session?.user.email || '?').trim().charAt(0).toUpperCase();
  const founder = session?.user.id === FOUNDER_USER_ID;
  const paid = isPaid(credits);
  const pro = isPro(credits);

  return (
    <Screen onRefresh={load}>
      {/* 6 Nov 2026 (Taj): Me redesign. Header with Settings gear, plan card with stat tiles, Tali's brain
          hero, jobs as grouped tiles, account rows. Same screens and data as before. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colours.purple, alignItems: 'center', justifyContent: 'center', ...elevation.button(colours.purple) }}>
          <Text style={{ color: colours.onPurple, fontSize: 24, fontWeight: '800' }}>{initial}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: colours.text }} numberOfLines={1}>{profile?.first_name || 'You'}</Text>
          <Text style={{ fontSize: 13, color: colours.muted }} numberOfLines={1}>{session?.user.email}</Text>
        </View>
        <Pressable onPress={() => router.navigate('/settings')} accessibilityRole="button" accessibilityLabel="Settings" hitSlop={8}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colours.surface, alignItems: 'center', justifyContent: 'center', ...elevation.card }}>
          <Ionicons name="settings-outline" size={22} color={colours.text} />
        </Pressable>
      </View>
      {error ? <Card><Body muted>{error}</Body></Card> : null}

      {/* Plan */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colours.text, flex: 1 }}>{planName || 'Your plan'}</Text>
          {trialing ? <Chip text={credits?.trialEndsAt ? `Trial to ${new Date(credits.trialEndsAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : 'Free trial'} /> : null}
          <Pressable onPress={() => router.navigate('/plans')} accessibilityRole="button" hitSlop={8}>
            <Text style={{ color: colours.purple, fontWeight: '800', fontSize: 14 }}>Plans {'›'}</Text>
          </Pressable>
        </View>
        {credits && !onFree ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: space.md }}>
              <Text style={{ fontSize: 28, fontWeight: '800', color: colours.text }}>{left.toLocaleString('en-AU')}</Text>
              <Text style={{ fontSize: 14, color: colours.muted }}>of {credits.creditsMonth.toLocaleString('en-AU')} credits left</Text>
            </View>
            <View style={{ height: 8, backgroundColor: colours.sunk, borderRadius: 8, marginTop: space.sm, overflow: 'hidden' }}>
              <View style={{ height: 8, width: `${Math.min(100, (left / Math.max(credits.creditsMonth, 1)) * 100)}%`, backgroundColor: colours.purple, borderRadius: 8 }} />
            </View>
          </>
        ) : credits ? (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: space.md }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: colours.text }}>{credits.messagesMonth ?? 50}</Text>
            <Text style={{ fontSize: 14, color: colours.muted }}>messages a month with Tali</Text>
          </View>
        ) : null}
        {credits ? (
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
            {credits.images?.allowance ? <Stat icon="image-outline" value={`${credits.images.remaining}`} label="images left" /> : null}
            {credits.searches?.allowance ? <Stat icon="globe-outline" value={`${credits.searches.remaining}`} label="web searches" /> : null}
            {credits.deep?.allowance ? <Stat icon="bulb-outline" value={credits.deep.remaining ? '1' : '0'} label="Deep think" /> : null}
            <Stat icon="refresh-outline" value={new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} label={onFree ? 'messages reset' : 'credits top up'} />
          </View>
        ) : null}
      </Card>

      {/* Tali's brain */}
      <Pressable onPress={() => router.navigate('/brain')} accessibilityRole="button" accessibilityLabel="See Tali's brain"
        style={{ marginTop: space.md, borderRadius: radius.card, overflow: 'hidden', backgroundColor: '#1F1D4A', padding: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md, ...elevation.card }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#CFC6FF', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>WHAT TALI KNOWS</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 4 }}>Tali's brain</Text>
          <Text style={{ color: '#E6E1FF', fontSize: 13, lineHeight: 19, marginTop: 4 }}>{memories.length ? `${memories.length} memories in 13 parts. Private to you.` : 'Everything she learns, filed in 13 parts. Private to you.'}</Text>
          <View style={{ flexDirection: 'row', alignSelf: 'flex-start', marginTop: space.md, backgroundColor: '#FFFFFF', borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14 }}>
            <Text style={{ color: '#1F1D4A', fontWeight: '800', fontSize: 13 }}>Open her brain {'›'}</Text>
          </View>
        </View>
        <BrainDots />
      </Pressable>

      <JobGroup title="Your day">
        <Tile icon="flag-outline" tint="purple" title="Goals" sub="What you're chasing" locked={!paid} onPress={() => router.navigate('/goals')} />
        <Tile icon="calendar-outline" tint="purple" title="Weekly review" sub="What moved and what's next" locked={!paid} onPress={() => router.navigate('/review')} />
        <Tile icon="moon-outline" tint="purple" title="Shut down" sub="Two minutes, then off" onPress={() => router.navigate('/shutdown')} />
        <Tile icon="git-branch-outline" tint="purple" title="Decisions" sub="What you decided and why" onPress={() => router.navigate('/decisions')} />
      </JobGroup>

      <JobGroup title="Your business">
        <Tile icon="people-outline" tint="orange" title="Clients" sub="Your people" onPress={() => router.navigate('/clients')} />
        <Tile icon="document-text-outline" tint="orange" title="Invoices" sub="Make, share, track" locked={!paid} onPress={() => router.navigate('/invoices')} />
        <Tile icon="wallet-outline" tint="orange" title="Money" sub="In, owed and runway" locked={!paid} onPress={() => router.navigate('/money')} />
        <Tile icon="mail-outline" tint="orange" title="Email" sub="Sorted, replies drafted" locked={!paid} onPress={() => router.navigate('/inbox')} />
        <Tile icon="flash-outline" tint="orange" title="Rules" sub="What she does on her own" locked={!pro} pro onPress={() => router.navigate('/rules')} />
        <Tile icon="link-outline" tint="orange" title="Connections" sub="Google, Microsoft, Stripe" locked={!paid} onPress={() => router.navigate({ pathname: '/settings', params: { section: 'connections' } })} />
      </JobGroup>

      <JobGroup title="You">
        <Tile icon="barbell-outline" tint="green" title="Food and training" sub="Logged by chatting" onPress={() => router.navigate('/life')} />
        <Tile icon="bed-outline" tint="green" title="Sleep" sub="Sounds with a timer" onPress={() => router.navigate('/sleep')} />
        <Tile icon="school-outline" tint="green" title="Night school" sub="What she studies tonight" locked={!pro} pro onPress={() => router.navigate('/night-school')} />
        {founder ? <Tile icon="stats-chart-outline" tint="green" title="Founder" sub="Only you see this" onPress={() => router.navigate('/founder')} /> : null}
      </JobGroup>

      <View style={{ marginTop: space.lg }}>
        <PatternsRow credits={credits} />
      </View>

      {/* Memories as a list, for people who want to read or forget one by one. */}
      <Card style={{ marginTop: space.md }}>
        <Pressable onPress={() => { setShowMemories(!showMemories); setShowAll(false); }} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text }}>Every memory as a list</Text>
            <Text style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>Read them one by one and forget anything</Text>
          </View>
          <Ionicons name={showMemories ? 'chevron-up' : 'chevron-down'} size={20} color={colours.faint} />
        </Pressable>
        {showMemories ? (memories.length === 0 ? (
          <Text style={{ color: colours.muted, marginTop: space.md }}>Nothing yet. Have a chat and she'll start learning.</Text>
        ) : (
          shown.map((m) => (
            <View key={m.id} style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start', paddingVertical: space.md, borderTopWidth: 1, borderTopColor: colours.border, marginTop: space.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: colours.purpleInk, fontWeight: '700', textTransform: 'uppercase' }}>{m.kind}</Text>
                <Text style={{ fontSize: 14, color: colours.text, lineHeight: 20, marginTop: 2 }}>{m.content}</Text>
              </View>
              <Pressable onPress={() => forget(m.id)} accessibilityRole="button" hitSlop={8}>
                <Text style={{ color: confirmId === m.id ? colours.danger : colours.muted, fontWeight: '700', fontSize: 13 }}>{confirmId === m.id ? 'Sure?' : 'Forget'}</Text>
              </Pressable>
            </View>
          ))
        )) : null}
        {showMemories && memories.length > 15 ? <Button title={showAll ? 'Show fewer' : `Show all ${memories.length}`} kind="ghost" onPress={() => setShowAll(!showAll)} /> : null}
      </Card>

      <Card style={{ marginTop: space.md, paddingVertical: 4 }}>
        <MenuRow title="Settings" sub="Your details, rhythm, notifications" onPress={() => router.navigate('/settings')} />
        <MenuRow title="Show me around again" sub="The quick tour of Tali HQ" onPress={async () => {
          if (!session) return;
          try { await resetTour(session.user.id); await refreshProfile(); router.navigate('/'); } catch (e: any) { setError(e?.message ?? 'Could not restart the tour.'); }
        }} />
        <Pressable onPress={() => confirm('signout', signOut)} accessibilityRole="button" style={{ paddingVertical: space.md }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colours.danger }}>{armed === 'signout' ? 'Sure? Tap again to sign out' : 'Sign out'}</Text>
        </Pressable>
      </Card>
      <Text style={{ color: colours.faint, fontSize: 12, textAlign: 'center', marginTop: space.lg }}>Tali HQ by Totality 360. Made in Australia.</Text>
    </Screen>
  );
}

const TINTS = {
  purple: { bg: colours.purpleSoft, fg: colours.purple },
  orange: { bg: colours.orangeSoft, fg: '#B85F00' },
  green: { bg: '#E7F5EC', fg: colours.good },
};

function Chip({ text }: { text: string }) {
  return <Text style={{ fontSize: 11, fontWeight: '800', color: colours.purpleInk, backgroundColor: colours.purpleSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' }}>{text}</Text>;
}

function Stat({ icon, value, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; value: string; label: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colours.sunk, borderRadius: 12, padding: space.sm, gap: 2, ...elevation.tile }}>
      <Ionicons name={icon} size={16} color={colours.purple} />
      <Text style={{ fontSize: 18, fontWeight: '800', color: colours.text }}>{value}</Text>
      <Text style={{ fontSize: 11, color: colours.muted }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function JobGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: space.lg }}>
      <Label>{title}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{children}</View>
    </View>
  );
}

function Tile({ icon, tint, title, sub, locked, pro, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; tint: keyof typeof TINTS; title: string; sub: string; locked?: boolean; pro?: boolean; onPress: () => void }) {
  const t = TINTS[tint];
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title}
      style={{ flexBasis: '48%', flexGrow: 1, backgroundColor: colours.surface, borderRadius: 16, padding: space.md, minHeight: 104, ...elevation.card }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={19} color={t.fg} />
        </View>
        {locked ? <Text style={{ fontSize: 10, fontWeight: '800', color: colours.purpleInk, backgroundColor: colours.purpleSoft, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' }}>{pro ? 'PRO' : 'TALI HQ'}</Text> : null}
      </View>
      <Text style={{ fontSize: 15, fontWeight: '800', color: colours.text, marginTop: space.sm }} numberOfLines={1}>{title}</Text>
      <Text style={{ fontSize: 12, color: colours.muted, marginTop: 2 }} numberOfLines={2}>{sub}</Text>
    </Pressable>
  );
}

// A little static constellation for the brain card (no 3D, so the Me tab stays light).
function BrainDots() {
  const dots = [[30, 14, '#8EF0C8'], [44, 10, '#8EF0C8'], [58, 12, '#9FB7FF'], [70, 18, '#B9A6FF'], [22, 26, '#8EF0C8'], [36, 26, '#7FD1FF'], [52, 24, '#D7B5FF'], [66, 30, '#B9A6FF'], [78, 30, '#D7B5FF'], [28, 40, '#FFE38A'], [42, 40, '#9FB7FF'], [56, 38, '#FFC37A'], [70, 44, '#9FB7FF'], [24, 54, '#FF9EC4'], [36, 58, '#FF9EC4'], [50, 54, '#FF7A6E'], [62, 58, '#FF9EC4'], [46, 70, '#A6B0C8']] as const;
  return (
    <View style={{ width: 96, height: 84 }}>
      {dots.map(([x, y, c], i) => (
        <View key={i} style={{ position: 'absolute', left: x, top: y, width: i % 3 ? 9 : 12, height: i % 3 ? 9 : 12, borderRadius: 6, backgroundColor: c, opacity: 0.9 }} />
      ))}
    </View>
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
