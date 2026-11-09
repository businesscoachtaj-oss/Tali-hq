import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { forgetMemory, freeMessagesLeft, myCredits, myMemories, type Credits, type Memory } from '@/lib/data';
import { isPaid, isPro } from '@/lib/plan';
import { resetTour } from '@/lib/tour';
import { Body, Button, Card, Label, Screen, useConfirm } from '@/components/ui';
import { PatternsRow } from '@/components/PatternsCard';
import { colours, elevation, radius, space } from '@/constants/theme';
import { FOUNDER_USER_ID } from '@/constants/business';
import { RoomSwitch, type Room } from '@/components/RoomSwitch';

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
  const [room, setRoom] = useState<Room>('business');

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
  const freeLeft = onFree ? freeMessagesLeft(credits) : null;
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
              <Text style={{ fontSize: 14, color: colours.muted }}>of {credits.creditsMonth.toLocaleString('en-AU')} credits left{credits.extra ? `, plus ${credits.extra.toLocaleString('en-AU')} extra` : ''}</Text>
            </View>
            <View style={{ height: 8, backgroundColor: colours.sunk, borderRadius: 8, marginTop: space.sm, overflow: 'hidden' }}>
              <View style={{ height: 8, width: `${Math.min(100, (left / Math.max(credits.creditsMonth, 1)) * 100)}%`, backgroundColor: colours.purple, borderRadius: 8 }} />
            </View>
            {/* 6 Nov 2026 (Taj): buy extra credits, images or a bundle. */}
            <Pressable onPress={() => router.navigate('/top-up' as any)} accessibilityRole="button" style={{ marginTop: space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: radius.pill, backgroundColor: colours.purpleSoft }}>
              <Ionicons name="add-circle-outline" size={18} color={colours.purple} />
              <Text style={{ color: colours.purple, fontWeight: '800', fontSize: 14 }}>Top up</Text>
            </Pressable>
          </>
        ) : credits && freeLeft ? (
          <>
            {/* 7 Nov 2026 (Taj): Free shows what's left this month, like credits on the paid plans. */}
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: space.md }}>
              <Text style={{ fontSize: 28, fontWeight: '800', color: colours.text }}>{freeLeft.left.toLocaleString('en-AU')}</Text>
              <Text style={{ fontSize: 14, color: colours.muted }}>of {freeLeft.limit.toLocaleString('en-AU')} messages left this month</Text>
            </View>
            <View style={{ height: 8, backgroundColor: colours.sunk, borderRadius: 8, marginTop: space.sm, overflow: 'hidden' }}>
              <View style={{ height: 8, width: `${Math.min(100, (freeLeft.left / Math.max(freeLeft.limit, 1)) * 100)}%`, backgroundColor: colours.purple, borderRadius: 8 }} />
            </View>
          </>
        ) : null}
        {credits ? (
          <Text style={{ fontSize: 13, color: colours.muted, marginTop: space.md }}>
            {[credits.images?.allowance ? `${credits.images.remaining + (credits.images.extra ?? 0)} images left` : null,
              `Resets ${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`].filter(Boolean).join('  ·  ')}
          </Text>
        ) : null}
      </Card>

      {/* 9 Nov 2026 look refresh: Tali's brain has its own tab now, so the big card here is gone. */}

      {/* 9 Nov 2026 "life with a growing brain": everything she helps with lives in Your world now. */}
      {founder ? (
        <JobGroup title="Only you">
          <Tile icon="stats-chart-outline" title="Founder" sub="Only you see this" onPress={() => router.navigate('/founder')} />
        </JobGroup>
      ) : null}

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

// 9 Nov 2026 look refresh: each group is one card of plain rows (was a grid of coloured tiles).
function JobGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const rows = (Array.isArray(children) ? children : [children]).filter(Boolean);
  return (
    <View style={{ marginTop: space.lg }}>
      <Label>{title}</Label>
      <View style={{ backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, overflow: 'hidden' }}>
        {rows.map((r, i) => (
          <View key={i} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: colours.border }}>{r}</View>
        ))}
      </View>
    </View>
  );
}

function Tile({ icon, title, sub, locked, pro, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; tint?: string; title: string; sub: string; locked?: boolean; pro?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 13, paddingHorizontal: space.lg }}>
      <Ionicons name={icon} size={21} color={colours.purple} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: colours.text }} numberOfLines={1}>{title}</Text>
        <Text style={{ fontSize: 13, color: colours.muted, marginTop: 1 }} numberOfLines={1}>{sub}</Text>
      </View>
      {locked ? <Text style={{ fontSize: 11, fontWeight: '700', color: colours.purpleInk }}>{pro ? 'Pro' : 'HQ'}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={colours.faint} />
    </Pressable>
  );
}

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
