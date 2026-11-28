// app/hq/[slug].tsx
// ADDED (16 Nov 2026, Taj): what someone sees when they open a shared HQ layout link. They can copy
// it into their own Tali HQ, or start free if they don't have Tali HQ yet.
// BUILT FOR REAL (17 Nov 2026): reads the real shared layout, and "Use this layout" adds it to the
// signed-in person's home (what they already have stays, nothing is doubled).
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ErrorText } from '@/components/ui';
import { MiniLayout } from '@/components/Widgets';
import { TaliAvatar } from '@/components/TaliAvatar';
import { colours, space } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { hasBusiness } from '@/lib/business';
import { blockAllowed, fitPlan, homeKeyFor, hqState, loadHq, materialise, newId, saveLayout, defaultLayout, type Block } from '@/lib/widgets';
import { forPlan, mergeBlocks } from '@/lib/hqTemplates';
import { fromSnapshot } from '../(app)/home-share';

export const PENDING_LAYOUT = 'tali.pending_layout';
type Shared = { slug: string; home: 'life' | 'business'; name: string; about: string; blocks: any[]; show_numbers: boolean; copies: number };

export default function SharedLayout() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const { session, profile } = useAuth();
  const [layout, setLayout] = useState<Shared | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!slug) return;
    supabase.rpc('shared_layout', { p_slug: String(slug) }).then(({ data }) => setLayout((data as Shared | null) ?? null), () => setLayout(null));
  }, [slug]);

  async function use() {
    if (!layout) return;
    if (!session) {
      await AsyncStorage.setItem(PENDING_LAYOUT, layout.slug).catch(() => {});
      return router.navigate('/sign-up' as any);
    }
    setBusy(true); setErr('');
    try {
      await loadHq(session.user.id, true);
      const s = hqState();
      const biz = hasBusiness(profile);
      const key = homeKeyFor(layout.home, biz, null);
      const current: Block[] = s.layouts[key] ?? defaultLayout(key, biz, s.plan);
      const nameOf = (b: Block) => s.trackers.find((t) => t.id === b.tracker_id)?.name ?? null;
      const incoming: Block[] = layout.blocks
        .map((b: any): Block => ({ id: newId(), kind: b.kind, size: b.size ?? 'wide', builtin: b.builtin, extra: b.extra, spec: b.spec ? forPlan(b.spec, s.plan) : undefined }))
        .filter((b) => blockAllowed(s.plan, b));
      const fresh = mergeBlocks(current, incoming, nameOf).slice(current.length);
      const made = await materialise(key, fresh);
      await saveLayout(key, fitPlan([...current, ...made], s.plan));
      supabase.rpc('shared_layout_used', { p_slug: layout.slug }).then(() => {}, () => {});
      await AsyncStorage.removeItem(PENDING_LAYOUT).catch(() => {});
      setDone(true);
    } catch (e: any) { setErr(e?.message ?? 'Could not add that layout. Try again.'); }
    setBusy(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colours.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TaliAvatar pose="head" size={40} />
          <Text style={{ color: colours.purple, fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>A TALI HQ LAYOUT</Text>
        </View>
        {layout === undefined ? <ActivityIndicator color={colours.purple} style={{ marginTop: 60 }} /> : layout === null ? (
          <>
            <Text style={{ color: '#fff', fontSize: 30, lineHeight: 34, marginTop: space.md, fontFamily: 'InstrumentSerif_400Regular' }}>This layout is not shared any more.</Text>
            <Text style={{ color: colours.muted, fontSize: 15, lineHeight: 21, marginTop: 6, marginBottom: space.lg }}>Its owner switched the link off, or the address is not quite right.</Text>
            <Button title={session ? 'Back to my HQ' : 'Start free'} onPress={() => router.navigate((session ? '/' : '/sign-up') as any)} />
          </>
        ) : (
          <>
            <Text style={{ color: '#fff', fontSize: 34, lineHeight: 38, marginTop: space.md, fontFamily: 'InstrumentSerif_400Regular' }}>{layout.name}</Text>
            <Text style={{ color: colours.muted, fontSize: 15, lineHeight: 21, marginTop: 6, marginBottom: space.lg }}>{layout.about || 'Copy it and make it yours. Change any target, move anything, take off what you do not need.'}</Text>
            <View style={{ borderRadius: 24, padding: 14, backgroundColor: 'rgba(30,24,88,0.6)', borderWidth: 1, borderColor: colours.border }}>
              <MiniLayout widgets={fromSnapshot(layout.blocks)} blank={!layout.show_numbers} />
            </View>
            <View style={{ height: space.lg }} />
            <ErrorText>{err}</ErrorText>
            {done ? (
              <>
                <Text style={{ color: colours.good, fontWeight: '800', fontSize: 16, marginBottom: space.md }}>Added to your {hasBusiness(profile) ? `${layout.home === 'business' ? 'Business' : 'Life'} ` : ''}home.</Text>
                <Button title="See my home" onPress={() => router.navigate('/')} />
              </>
            ) : (
              <>
                <Button title={session ? 'Use this layout' : 'Start free and use this layout'} onPress={use} busy={busy} />
                {session ? <Text style={{ color: colours.faint, fontSize: 12.5, textAlign: 'center' }}>Adds what you do not have yet. What is on your home stays.</Text> : (
                  <Button kind="ghost" title="I already have Learnéd" onPress={async () => { await AsyncStorage.setItem(PENDING_LAYOUT, layout.slug).catch(() => {}); router.navigate('/sign-in' as any); }} />
                )}
              </>
            )}
            <Text style={{ color: colours.faint, fontSize: 12.5, marginTop: space.md, textAlign: 'center' }}>{layout.show_numbers ? 'The numbers shown are where its owner was at when they shared it.' : 'Only the layout is shared. The numbers stay private.'}</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
