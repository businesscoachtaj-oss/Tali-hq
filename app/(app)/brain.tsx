// Tali's brain (6 Nov 2026, asked for by Taj). A 3D brain you can spin, pinch and tap, with every
// part of Tali's memory filed into the part of a human brain that does the same job.
// Everyone sees their own brain. The founder also gets the main brain: every user's memories light
// it up, but only his own and the shared brain can be read.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { BrainGlobe } from '@/components/BrainGlobe';
import { NightBackground, night } from '@/components/NightSky';
import { BackLink, Card, ErrorText, Label, Screen, Title, goBack, useConfirm } from '@/components/ui';
import { FOUNDER_USER_ID } from '@/constants/business';
import { SkinHeader } from '@/components/PageSkin';
import { colours, elevation, radius, space } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { REGIONS, REGION_ORDER, SHAREABLE_KINDS, lessonState, myBrain, setMemoryPrivate, settleConflict, type Brain, type BrainItem, type RegionId } from '@/lib/brain';
import { forgetMemory } from '@/lib/data';
import { LEVELS, taliLevel, type Level } from '@/lib/level';
import { KnowsAbout } from '@/components/KnowsAbout';
import { LastNightCard } from '@/components/LastNightCard';
import { LinkTotalityCard } from '@/components/LinkTotalityCard';
import { LibraryShelf } from '@/components/LibraryShelf';
import { BRAIN_AI_PREVIEW, partAi } from '@/lib/brainAiPlan';

const MEMORY_KINDS = ['fact', 'event', 'person', 'lesson', 'mistake', 'rule', 'preference', 'idea', 'plan', 'seen'];

export default function BrainScreen() {
  const { session } = useAuth();
  const founder = session?.user.id === FOUNDER_USER_ID;
  const [scope, setScope] = useState<'main' | 'mine'>(founder ? 'main' : 'mine');
  // 11 Nov 2026: the "New memory" pill in Talk lands here with the group to open (and a timestamp so
  // tapping a second pill for the same group opens it again). Always shows your own brain.
  const { open: openGroup, t: openStamp } = useLocalSearchParams<{ open?: string; t?: string }>();
  useEffect(() => { if (openGroup) setScope('mine'); }, [openGroup, openStamp]);
  const [brain, setBrain] = useState<Brain | null>(null);
  const [selected, setSelected] = useState<RegionId | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [q, setQ] = useState('');
  // 6 Nov 2026 (Taj): what she keeps in a part is a drop down, closed by default, 5 at a time.
  const [keepsOpen, setKeepsOpen] = useState(false);
  const [keepsShown, setKeepsShown] = useState(5);
  useEffect(() => {
    taliLevel().then(setLevel).catch(() => setLevel(null));
  }, []);
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

  useFocusLoad(load); // Speed pass (13 Nov 2026): see lib/useFocusLoad.ts

  const counts = useMemo(() => Object.fromEntries((brain?.regions ?? []).map((r) => [r.id, r.count])) as Partial<Record<RegionId, number>>, [brain]);
  // 6 Nov 2026 (Taj): nothing picked is the whole brain, every part lit up, like the website demo.
  // It opens there; tap a part (or its chip) to pick it, tap it again or tap empty space to go back.
  const shown: RegionId | null = selected;
  const pick = useCallback((id: RegionId | null) => setSelected((cur) => (id && id !== cur ? id : null)), []);
  const region = brain?.regions.find((r) => r.id === shown) ?? null;
  useEffect(() => {
    setKeepsOpen(false);
    setKeepsShown(5);
  }, [shown]);

  // 6 Nov 2026 (Taj): search everything she keeps, and what she learnt this week.
  const all = useMemo(() => (brain?.regions ?? []).flatMap((r) => r.items.filter((it) => it.kind !== 'conflict').map((it) => ({ ...it, region: r.id }))), [brain]);
  const query = q.trim().toLowerCase();
  const hits = useMemo(() => (query.length < 2 ? [] : all.filter((it) => it.text.toLowerCase().includes(query) || it.about?.some((a) => a.toLowerCase().includes(query)))), [all, query]);
  const weekAgo = Date.now() - 7 * 86400000;
  const fresh = useMemo(() => all.filter((it) => it.at && Date.parse(it.at) > weekAgo && it.mine !== false).sort((a, b) => Date.parse(b.at!) - Date.parse(a.at!)), [all, weekAgo]);

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
    <Screen skin="brain" onRefresh={load}>
      <SkinHeader id="brain" title="Her brain" sub={brain ? `Everything she knows about you. ${brain.total.toLocaleString('en-AU')} memories and growing.` : undefined} />
      {brain?.scope === 'mine' ? <LastNightCard onChanged={load} /> : null}
      {brain?.scope === 'mine' ? <KnowsAbout brain={brain} openGroup={openGroup} openStamp={openStamp} /> : null}
      {brain?.scope === 'mine' ? <LinkTotalityCard onChanged={load} /> : null}
      {brain?.scope === 'mine' ? <LibraryShelf /> : null}

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


      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.border, borderRadius: radius.pill, paddingHorizontal: 14, marginBottom: space.md }}>
        <Ionicons name="search" size={17} color={colours.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search her brain: a name, a client, a topic" placeholderTextColor={colours.faint} style={{ flex: 1, paddingVertical: 11, fontSize: 15, color: colours.text }} accessibilityLabel="Search Tali's brain" returnKeyType="search" />
        {q ? (
          <Pressable onPress={() => setQ('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={colours.faint} />
          </Pressable>
        ) : null}
      </View>
      {query.length >= 2 ? (
        <Card style={{ marginBottom: space.md }}>
          <Text style={{ color: colours.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>
            {hits.length ? `${hits.length} ${hits.length === 1 ? 'thing' : 'things'} she knows about "${q.trim()}"` : `Nothing yet about "${q.trim()}"`}
          </Text>
          {hits.slice(0, 12).map((it, i) => (
            <Pressable key={(it.id ?? '') + i} onPress={() => { setSelected(it.region); setQ(''); }} accessibilityRole="button" style={{ flexDirection: 'row', gap: space.sm, paddingVertical: space.sm, borderTopWidth: i ? 1 : 0, borderTopColor: colours.border, marginTop: i ? 0 : space.sm }}>
              <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: REGIONS[it.region].colour, marginTop: 6 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colours.text, fontSize: 14, lineHeight: 20 }}>{it.text}</Text>
                <Text style={{ color: colours.faint, fontSize: 12, marginTop: 1 }}>{REGIONS[it.region].name} · {it.kind}</Text>
              </View>
            </Pressable>
          ))}
        </Card>
      ) : null}

      {/* 9 Nov 2026 (Tuesday list item 8): which AI each part uses, now and planned. Founder only for now. */}
      {founder ? (
        <Pressable onPress={() => router.navigate('/brain-ai')} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colours.surface, borderRadius: radius.card, paddingVertical: 14, paddingHorizontal: space.lg, marginBottom: space.md, ...elevation.card }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colours.text }}>How Tali thinks</Text>
            <Text style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>{BRAIN_AI_PREVIEW ? 'Which AI each part runs on, and who handled what today' : 'The AI each part of her brain uses, now and planned'}</Text>
          </View>
          <Text style={{ fontSize: 22, color: colours.faint, fontWeight: '600' }}>{'›'}</Text>
        </Pressable>
      ) : null}

      {/* 6 Nov 2026 (Taj): laid out like the website demo. One night card holds the brain, the part you
          picked (what it does in a person, in Tali, and what she keeps there), then every part as a chip. */}
      <View style={{ borderRadius: radius.card, overflow: 'hidden', padding: space.md, paddingBottom: space.lg }}>
        <NightBackground style={{ borderRadius: radius.card }} />
        <View style={{ alignItems: 'center' }}>
          <BrainGlobe bigDots size={size} counts={counts} links={brain?.links ?? []} selected={shown} onSelect={pick} />
          <Text style={{ color: night.faint, fontSize: 12, marginTop: space.xs }}>Drag to spin, pinch to zoom, tap a part</Text>
        </View>

        {brain && !region ? (
          <View style={{ marginTop: space.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
              <Text style={{ color: night.accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase', flex: 1 }}>{REGION_ORDER.length} parts</Text>
              <Text style={{ color: night.muted, fontSize: 12, fontWeight: '700' }}>{brain.total.toLocaleString('en-AU')} {brain.total === 1 ? 'memory' : 'memories'}</Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 4 }}>The whole brain</Text>
            <Text style={{ color: night.muted, fontSize: 15, lineHeight: 22, marginTop: space.sm }}>
              Every part lit up at once. Each one holds a different kind of memory, and the more Tali keeps in a part, the brighter it glows.
            </Text>
            <Text style={{ color: night.faint, fontSize: 13, lineHeight: 18, marginTop: 4 }}>Tap a part, or a name below, to see what she keeps there.</Text>
          </View>
        ) : null}

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
            {BRAIN_AI_PREVIEW && founder && partAi(region.id) ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: space.sm, alignSelf: 'flex-start', backgroundColor: night.glass, borderWidth: 1, borderColor: night.line, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
                <Text style={{ color: night.faint, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }}>RUNS ON</Text>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{partAi(region.id)!.ai}</Text>
                <Text style={{ color: night.accent, fontSize: 12, fontWeight: '700' }}>{partAi(region.id)!.cost}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={() => { setKeepsOpen((o) => !o); setKeepsShown(5); }}
              disabled={region.items.length === 0}
              accessibilityRole="button"
              accessibilityState={{ expanded: keepsOpen }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: night.glass, borderWidth: 1, borderColor: night.line }}
            >
              <Text style={{ flex: 1, color: night.ink, fontSize: 14, fontWeight: '800' }}>
                {region.items.length === 0 ? 'Nothing here yet' : `What she keeps here (${region.items.length})`}
              </Text>
              {region.items.length ? <Ionicons name={keepsOpen ? 'chevron-up' : 'chevron-down'} size={18} color={night.muted} /> : null}
            </Pressable>
            {!keepsOpen || region.items.length === 0 ? null : (
              <View style={{ gap: 8, marginTop: space.sm }}>
                {region.items.slice(0, keepsShown).map((it, i) => {
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
                            {/* 9 Nov 2026 (Tuesday list): skills show uses, wins and last used; lessons and mistakes show whether they held. */}
                            {it.kind === 'skill' && it.uses != null ? <SkillStats it={it} colour={REGIONS[region.id].colour} /> : null}
                            {(it.kind === 'lesson' || it.kind === 'mistake') && ((it.held ?? 0) + (it.broken ?? 0)) > 0 ? (
                              <Text style={{ fontSize: 12, color: night.muted, marginTop: 4 }}>{heldLine(it)}</Text>
                            ) : null}
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
                {region.items.length > keepsShown ? (
                  <Pressable onPress={() => setKeepsShown((n) => n + 10)} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16 }}>
                    <Text style={{ color: night.accent, fontWeight: '800' }}>Show {Math.min(10, region.items.length - keepsShown)} more</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space.lg }}>
          <Pressable
            onPress={() => setSelected(null)}
            accessibilityRole="button"
            accessibilityState={{ selected: shown == null }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 7, paddingHorizontal: 12, minHeight: 36, borderRadius: radius.pill, backgroundColor: shown == null ? '#FFFFFF' : night.glass, borderWidth: 1, borderColor: shown == null ? '#FFFFFF' : night.line }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: shown == null ? '#17133A' : '#FFFFFF' }} />
            <Text style={{ color: shown == null ? '#17133A' : night.ink, fontWeight: '700', fontSize: 13 }}>Whole brain</Text>
            <Text style={{ color: shown == null ? '#5B547F' : night.faint, fontSize: 12, fontWeight: '700' }}>{(brain?.total ?? 0).toLocaleString('en-AU')}</Text>
          </Pressable>
          {REGION_ORDER.map((id) => {
            const on = shown === id;
            const n = counts[id] ?? 0;
            return (
              <Pressable
                key={id}
                onPress={() => pick(id)}
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

      {/* 9 Nov 2026 look refresh: her level sits under the brain now, so the brain is the first thing you see. */}
      {level ? <><View style={{ height: space.lg }} /><LevelCard level={level} /></> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}

      {brain?.scope === 'mine' && fresh.length ? (
        <>
          <View style={{ height: space.lg }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Label>New this week</Label>
            <Text style={{ color: colours.muted, fontSize: 13, fontWeight: '700' }}>{fresh.length} new</Text>
          </View>
          <Card>
            {fresh.slice(0, 6).map((it, i) => (
              <Pressable key={(it.id ?? '') + i} onPress={() => setSelected(it.region)} accessibilityRole="button" style={{ flexDirection: 'row', gap: space.sm, paddingVertical: space.sm, borderTopWidth: i ? 1 : 0, borderTopColor: colours.border }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: REGIONS[it.region].colour, marginTop: 6 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colours.text, fontSize: 14, lineHeight: 20 }}>{it.text}</Text>
                  <Text style={{ color: colours.faint, fontSize: 12, marginTop: 1 }}>{REGIONS[it.region].name} · {ago(it.at!)}</Text>
                </View>
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}

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

function ago(at: string) {
  const d = Math.floor((Date.now() - Date.parse(at)) / 86400000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
}

// 6 Nov 2026 (Taj): her level with the whole ladder, so you can see where she's headed.
function LevelCard({ level }: { level: Level }) {
  const pct = Math.max(4, Math.round(level.progress * 100));
  return (
    <View style={{ borderRadius: radius.card, overflow: 'hidden', marginBottom: space.md }}>
      <LinearGradient colors={['#4A2160', colours.purple, '#8A4A9E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#F6B04C', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#2A1235', fontSize: 20, fontWeight: '900' }}>{level.level}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#F6B04C', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>TALI'S LEVEL</Text>
            <Text style={{ color: '#fff', fontSize: 19, fontWeight: '800', marginTop: 1 }}>{level.name}</Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontWeight: '800', fontSize: 13 }}>{level.xp.toLocaleString('en-AU')} XP</Text>
        </View>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.25)', marginTop: space.md, overflow: 'hidden' }}>
          <LinearGradient colors={['#F6B04C', '#FFD9A0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${pct}%`, height: '100%', borderRadius: 4 }} />
        </View>
        {level.next ? <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 6 }}>{level.toNext.toLocaleString('en-AU')} XP to {level.next}</Text> : null}
        {/* 9 Nov 2026 look refresh: the row of every rank name is gone; the bar and next rank say enough. */}
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 17, marginTop: space.md }}>
          She earns XP for every memory, night school class, journal entry and job she does for you.
        </Text>
      </LinearGradient>
    </View>
  );
}

// 9 Nov 2026 (Tuesday list): how a skill is doing, and whether a lesson held.
function lastUsed(iso?: string | null) {
  return iso ? `last used ${ago(iso)}` : 'not used yet';
}
function SkillStats({ it, colour }: { it: BrainItem; colour: string }) {
  const uses = it.uses ?? 0;
  const wins = it.wins ?? 0;
  const pct = uses ? Math.round((wins / uses) * 100) : 0;
  return (
    <View style={{ marginTop: 6, gap: 5 }}>
      <Text style={{ fontSize: 12, color: night.muted }}>Used {uses} · worked {wins} · {lastUsed(it.last_used)}</Text>
      <View style={{ height: 5, borderRadius: 3, backgroundColor: night.line, overflow: 'hidden' }}>
        <View style={{ width: `${Math.max(pct, uses ? 4 : 0)}%`, height: 5, borderRadius: 3, backgroundColor: colour }} />
      </View>
    </View>
  );
}
function heldLine(it: BrainItem) {
  const held = it.held ?? 0;
  const broken = it.broken ?? 0;
  const total = held + broken;
  if (!broken) return `Checked ${total} time${total === 1 ? '' : 's'}, held every time`;
  if (!held) return `Checked ${total} time${total === 1 ? '' : 's'}, didn't hold`;
  return `Held ${held} of ${total} times`;
}
