// Tali's brain (6 Nov 2026, asked for by Taj). A 3D brain you can spin, pinch and tap, with every
// part of Tali's memory filed into the part of a human brain that does the same job.
// Everyone sees their own brain. The founder also gets the main brain: every user's memories light
// it up, but only his own and the shared brain can be read.
import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { BrainGlobe } from '@/components/BrainGlobe';
import { NightBackground, night } from '@/components/NightSky';
import { BackLink, Card, ErrorText, Label, Screen, Title, goBack, useConfirm } from '@/components/ui';
import { FOUNDER_USER_ID } from '@/constants/business';
import { colours, radius, space } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { REGIONS, REGION_ORDER, SHAREABLE_KINDS, lessonState, myBrain, setMemoryPrivate, settleConflict, type Brain, type BrainItem, type RegionId } from '@/lib/brain';
import { forgetMemory } from '@/lib/data';

const MEMORY_KINDS = ['fact', 'event', 'person', 'lesson', 'mistake', 'rule', 'preference', 'idea', 'plan', 'seen'];

export default function BrainScreen() {
  const { session } = useAuth();
  const founder = session?.user.id === FOUNDER_USER_ID;
  const [scope, setScope] = useState<'main' | 'mine'>(founder ? 'main' : 'mine');
  const [brain, setBrain] = useState<Brain | null>(null);
  const [selected, setSelected] = useState<RegionId | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const { armed, confirm } = useConfirm();
  const { width } = useWindowDimensions();
  const size = Math.min(width - space.lg * 2 - space.md * 2, 420);

  const load = useCallback(async () => {
    setError('');
    try {
      setBrain(await myBrain(scope));
    } catch (e: any) {
      setError(e?.message ?? 'Could not load the brain.');
    }
  }, [scope]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const counts = useMemo(() => Object.fromEntries((brain?.regions ?? []).map((r) => [r.id, r.count])) as Partial<Record<RegionId, number>>, [brain]);
  // The panel always shows a part: the one you tapped, or the first part with something in it.
  const shown: RegionId | null = selected ?? (brain ? (REGION_ORDER.find((id) => (counts[id] ?? 0) > 0) ?? REGION_ORDER[0]) : null);
  const region = brain?.regions.find((r) => r.id === shown) ?? null;

  function forget(item: BrainItem) {
    const id = item.id;
    if (!id) return;
    confirm(id, async () => {
      setBusy(id);
      try {
        await forgetMemory(id);
        await load();
      } catch {
        setError('Could not forget that one. Try again.');
      }
      setBusy(null);
    });
  }

  // 6 Nov 2026: lessons, mistakes and rules can go to the shared brain (rewritten with no personal
  // details). Private keeps one out.
  async function togglePrivate(item: BrainItem) {
    if (!item.id) return;
    setBusy(item.id + 'p');
    try {
      await setMemoryPrivate(item.id, !item.private);
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Could not change that.');
    }
    setBusy(null);
  }

  async function settle(item: BrainItem, keep: 'new' | 'old' | 'both') {
    if (!item.id) return;
    setBusy(item.id + keep);
    try {
      await settleConflict(item.id, keep);
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save that.');
    }
    setBusy(null);
  }

  return (
    <Screen onRefresh={load}>
      <BackLink onPress={() => goBack('/me')} />
      <Title sub={brain ? `${brain.total.toLocaleString('en-AU')} memories${brain.scope === 'main' ? ' across everyone' : ''}` : ' '}>Tali's brain</Title>

      {founder ? (
        <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
          {(['main', 'mine'] as const).map((s) => (
            <Pressable
              key={s}
              onPress={() => setScope(s)}
              accessibilityRole="button"
              style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: scope === s ? colours.purple : colours.surface, borderWidth: 1, borderColor: scope === s ? colours.purple : colours.border }}
            >
              <Text style={{ color: scope === s ? colours.onPurple : colours.text, fontWeight: '700', fontSize: 13 }}>{s === 'main' ? 'Main brain' : 'My brain'}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* 6 Nov 2026 (Taj): laid out like the website demo. One night card holds the brain, the part you
          picked (what it does in a person, in Tali, and what she keeps there), then every part as a chip. */}
      <View style={{ borderRadius: radius.card, overflow: 'hidden', padding: space.md, paddingBottom: space.lg }}>
        <NightBackground style={{ borderRadius: radius.card }} />
        <View style={{ alignItems: 'center' }}>
          <BrainGlobe size={size} counts={counts} links={brain?.links ?? []} selected={shown} onSelect={setSelected} />
          <Text style={{ color: night.faint, fontSize: 12, marginTop: space.xs }}>Drag to spin, pinch to zoom, tap a part</Text>
        </View>

        {region ? (
          <View style={{ marginTop: space.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
              <Text style={{ color: REGIONS[region.id].colour, fontSize: 11, fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase', flex: 1 }}>{REGIONS[region.id].human} in you</Text>
              <Text style={{ color: night.muted, fontSize: 12, fontWeight: '700' }}>{region.count.toLocaleString('en-AU')} {region.count === 1 ? 'memory' : 'memories'}</Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 4 }}>{REGIONS[region.id].name}</Text>
            <Text style={{ color: night.muted, fontSize: 15, lineHeight: 22, marginTop: space.sm }}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>In Tali: </Text>
              {REGIONS[region.id].tali}.
            </Text>
            {/* 6 Nov 2026 (Taj): Tali's education, a part of the brain each night. */}
            <Text style={{ color: night.faint, fontSize: 13, lineHeight: 18, marginTop: 4 }}>Studies at night: {REGIONS[region.id].studies}</Text>

            <Text style={{ color: night.faint, fontSize: 11, fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase', marginTop: space.lg, marginBottom: space.sm }}>What she keeps here</Text>
            {region.items.length === 0 ? (
              <Text style={{ color: night.muted }}>Nothing here yet.</Text>
            ) : (
              <View style={{ gap: 8 }}>
                {region.items.map((it, i) => {
                  const lesson = lessonState(it);
                  const canForget = !!it.id && it.mine && MEMORY_KINDS.includes(it.kind);
                  return (
                    <View key={(it.id ?? '') + i} style={{ backgroundColor: night.glass, borderWidth: 1, borderColor: night.line, borderLeftWidth: 3, borderLeftColor: it.kind === 'conflict' ? '#FF7A6E' : REGIONS[region.id].colour, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 }}>
                      {it.kind === 'conflict' ? (
                        <>
                          <Text style={{ fontSize: 11, color: '#FF9A90', fontWeight: '800', textTransform: 'uppercase' }}>These two disagree</Text>
                          <Text style={{ fontSize: 14, color: night.ink, lineHeight: 20, marginTop: 4 }}>New: {it.text}</Text>
                          <Text style={{ fontSize: 14, color: night.muted, lineHeight: 20, marginTop: 2 }}>Old: {it.old}</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
                            {([['new', 'Keep new'], ['old', 'Keep old'], ['both', 'Both true']] as const).map(([k, label]) => (
                              <Pressable key={k} disabled={!!busy} onPress={() => settle(it, k)} accessibilityRole="button" style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: night.accent, opacity: busy ? 0.5 : 1 }}>
                                <Text style={{ color: night.accent, fontWeight: '700', fontSize: 13 }}>{label}</Text>
                              </Pressable>
                            ))}
                          </View>
                        </>
                      ) : (
                        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <Text style={{ fontSize: 10, color: night.faint, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>{it.kind === 'knowledge' && it.about?.[0] ? it.about[0] : it.kind}</Text>
                              {it.urgent ? <Badge text="Urgent" colour="#FF9A90" /> : null}
                              {lesson === 'proven' ? <Badge text={it.kind === 'mistake' ? 'Learned' : 'Proven'} colour="#8EF0C8" /> : null}
                              {lesson === 'shaky' ? <Badge text="Not holding up" colour="#FFC37A" /> : null}
                              {it.mine === false && it.id ? <Badge text="Shared" colour={night.muted} /> : null}
                              {it.mine && it.private ? <Badge text="Private" colour={night.accent} /> : null}
                            </View>
                            <Text style={{ fontSize: 14, color: night.ink, lineHeight: 20, marginTop: 2 }}>{it.text}</Text>
                          </View>
                          {canForget ? (
                            <View style={{ alignItems: 'flex-end', gap: space.sm }}>
                              <Pressable onPress={() => forget(it)} disabled={busy === it.id} accessibilityRole="button" hitSlop={8}>
                                <Text style={{ color: armed === it.id ? '#FF9A90' : night.muted, fontWeight: '700', fontSize: 13 }}>{armed === it.id ? 'Sure?' : 'Forget'}</Text>
                              </Pressable>
                              {SHAREABLE_KINDS.includes(it.kind) ? (
                                <Pressable onPress={() => togglePrivate(it)} disabled={!!busy} accessibilityRole="button" hitSlop={8}>
                                  <Text style={{ color: night.muted, fontWeight: '700', fontSize: 13 }}>{it.private ? 'Unlock' : 'Private'}</Text>
                                </Pressable>
                              ) : null}
                            </View>
                          ) : null}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space.lg }}>
          {REGION_ORDER.map((id) => {
            const on = shown === id;
            const n = counts[id] ?? 0;
            return (
              <Pressable
                key={id}
                onPress={() => setSelected(id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 7, paddingHorizontal: 12, minHeight: 36, borderRadius: radius.pill, backgroundColor: on ? '#FFFFFF' : night.glass, borderWidth: 1, borderColor: on ? '#FFFFFF' : night.line }}
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: REGIONS[id].colour, shadowColor: REGIONS[id].colour, shadowOpacity: 0.9, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } }} />
                <Text style={{ color: on ? '#17133A' : night.ink, fontWeight: '700', fontSize: 13 }}>{REGIONS[id].name}</Text>
                <Text style={{ color: on ? '#5B547F' : night.faint, fontSize: 12, fontWeight: '700' }}>{n.toLocaleString('en-AU')}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {brain?.scope === 'main' ? (
        <Text style={{ color: colours.muted, fontSize: 12, marginTop: space.sm, lineHeight: 17 }}>
          Every user's memories light up the main brain. You can read your own and the shared brain; other people's stay private.
        </Text>
      ) : null}

      {error ? <ErrorText>{error}</ErrorText> : null}

      {brain && brain.links.length ? (
        <>
          <View style={{ height: space.lg }} />
          <Label>Connections</Label>
          <Card>
            <Text style={{ color: colours.muted, fontSize: 13, lineHeight: 18 }}>People and things that turn up in more than one part. They're the lines across the brain.</Text>
            {brain.links.slice(0, 10).map((l) => (
              <View key={l.name} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: colours.border, marginTop: space.sm }}>
                <Text style={{ color: colours.text, fontWeight: '700', textTransform: 'capitalize', flexShrink: 1 }}>{l.name}</Text>
                <Text style={{ color: colours.muted, fontSize: 13, flexShrink: 1, textAlign: 'right' }}>{l.regions.map((r) => REGIONS[r]?.name ?? r).join(', ')}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <View style={{ height: space.xl }} />
      <Pressable onPress={() => router.navigate('/me')} accessibilityRole="button">
        <Text style={{ color: colours.purple, fontWeight: '700', textAlign: 'center' }}>See every memory as a list</Text>
      </Pressable>
      <View style={{ height: space.xl }} />
    </Screen>
  );
}

function Badge({ text, colour }: { text: string; colour: string }) {
  return (
    <View style={{ paddingVertical: 1, paddingHorizontal: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colour }}>
      <Text style={{ color: colour, fontSize: 10, fontWeight: '800' }}>{text}</Text>
    </View>
  );
}
