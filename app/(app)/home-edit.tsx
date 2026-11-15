// app/(app)/home-edit.tsx
// ADDED (16 Nov 2026, Taj): "Edit home". Every block on Today in one list: move it, make it small
// or wide, hide it or take it off. Add a widget from the gallery, make your own tracker, ask Tali to
// build one, or share the layout. Each mode (Business and Life) has its own layout.
// Free gets 6 blocks and 3 of its own trackers; paid plans have no limit.
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BackLink, Button, Screen, Title } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { BlockPreview, DotRing } from '@/components/Widgets';
import { colours, radius, space } from '@/constants/theme';
import { BUILTINS, LIMITS, TRACKER_PRESETS, useHomeLayout, type BuiltIn, type Widget } from '@/lib/widgets';
import { MODE, setMode, useMode, type Mode } from '@/lib/mode';

function Pill({ label, on, onPress, icon }: { label: string; on?: boolean; onPress?: () => void; icon?: any }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={6}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? colours.purple : colours.border, backgroundColor: on ? colours.purpleSoft : 'transparent' }}>
      {icon ? <Ionicons name={icon} size={13} color={on ? colours.purpleInk : colours.muted} /> : null}
      <Text style={{ color: on ? colours.purpleInk : colours.muted, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

export default function HomeEdit() {
  const q = useLocalSearchParams<{ mode?: string; plan?: string; gallery?: string }>();
  const current = useMode();
  const mode: Mode = (q.mode === 'business' || q.mode === 'life') ? q.mode : current;
  const free = q.plan === 'free';
  const [layout, save] = useHomeLayout(mode, free);
  const [gallery, setGallery] = useState(q.gallery === '1');
  const shown = layout.filter((w) => !w.hidden).length;
  const own = layout.filter((w) => w.kind === 'tracker').length;
  const full = free && shown >= LIMITS.free.blocks;

  const update = (id: string, patch: Partial<Widget>) => save(layout.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  const remove = (id: string) => save(layout.filter((w) => w.id !== id));

  return (
    <Screen>
      <BackLink onPress={() => router.navigate('/')} label="Today" />
      <Title sub="Move, resize, hide or take off anything. This is your HQ.">Edit home</Title>

      <View style={{ flexDirection: 'row', backgroundColor: 'rgba(12,10,36,0.78)', borderRadius: radius.pill, padding: 4, borderWidth: 1, borderColor: colours.border, marginBottom: space.md }}>
        {(['business', 'life'] as const).map((m) => {
          const on = mode === m;
          return (
            <Pressable key={m} onPress={() => { setMode(m); router.setParams({ mode: m }); }} style={{ flex: 1, paddingVertical: 9, borderRadius: radius.pill, alignItems: 'center', backgroundColor: on ? MODE[m].colour : 'transparent' }}>
              <Text style={{ fontWeight: '800', color: on ? '#141033' : colours.muted }}>{MODE[m].label} home</Text>
            </Pressable>
          );
        })}
      </View>

      {free ? (
        <View style={{ backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: full ? colours.orange : colours.border, padding: 14, marginBottom: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <DotRing pct={shown / LIMITS.free.blocks} colour={full ? colours.orange : colours.purple} size={44} n={18} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colours.text, fontWeight: '800', fontSize: 15 }}>{shown} of {LIMITS.free.blocks} blocks on Free</Text>
              <Text style={{ color: colours.muted, fontSize: 12.5, marginTop: 2 }}>{own} of {LIMITS.free.trackers} of your own trackers. Paid plans have no limit, plus rings, streaks, charts and Tali check-ins.</Text>
            </View>
          </View>
          <Pressable onPress={() => router.navigate('/plans')} style={{ marginTop: 10, alignSelf: 'flex-start' }}><Text style={{ color: colours.orange, fontWeight: '800' }}>See plans ›</Text></Pressable>
        </View>
      ) : null}

      <Text style={{ color: colours.faint, fontSize: 12, fontWeight: '800', letterSpacing: 1.6, marginBottom: space.sm }}>ON YOUR {MODE[mode].label.toUpperCase()} HOME  ·  DRAG TO MOVE</Text>
      <View style={{ gap: 10 }}>
        {layout.map((w) => (
          <View key={w.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: w.hidden ? 0.45 : 1 }}>
            <Ionicons name="reorder-three" size={22} color={colours.faint} />
            <View style={{ flex: 1 }}>
              <BlockPreview w={w} compact />
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                {w.kind === 'tracker' ? (<>
                  <Pill label="Small" on={w.size === 'small'} onPress={() => update(w.id, { size: 'small' })} />
                  <Pill label="Wide" on={w.size === 'wide'} onPress={() => update(w.id, { size: 'wide' })} />
                  <Pill label="Edit" icon="create-outline" onPress={() => router.navigate(`/widget-new?edit=${w.id}&mode=${mode}` as any)} />
                </>) : null}
                <Pill label={w.hidden ? 'Hidden' : 'Showing'} icon={w.hidden ? 'eye-off-outline' : 'eye-outline'} on={!w.hidden} onPress={() => update(w.id, { hidden: !w.hidden })} />
              </View>
            </View>
            <Pressable onPress={() => remove(w.id)} accessibilityLabel={`Take off ${w.tracker?.name ?? BUILTINS[w.builtin!].title}`} hitSlop={8}>
              <Ionicons name="remove-circle" size={24} color={colours.danger} />
            </Pressable>
          </View>
        ))}
      </View>

      <View style={{ height: space.lg }} />
      <Button title="+ Add a widget" onPress={() => setGallery(true)} />
      <View style={{ height: space.sm }} />
      <Pressable onPress={() => router.navigate('/talk?build=1' as any)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, backgroundColor: colours.sunk }}>
        <Ionicons name="sparkles" size={18} color={colours.purple} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colours.text, fontWeight: '800' }}>Ask Tali to build it</Text>
          <Text style={{ color: colours.muted, fontSize: 12.5 }}>"Track my cold calls, 20 a week" and she puts it on your home.</Text>
        </View>
        <Text style={{ color: colours.faint, fontSize: 20 }}>›</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: space.md }}>
        <View style={{ flex: 1 }}><Button kind="ghost" title="Share my layout" onPress={() => router.navigate(`/home-share?mode=${mode}` as any)} /></View>
        <View style={{ flex: 1 }}><Button kind="ghost" title="Start from a template" onPress={() => setGallery(true)} /></View>
      </View>
      <View style={{ height: space.xl }} />

      <Sheet visible={gallery} title="Add a widget" sub={full ? `Your Free home is full (${LIMITS.free.blocks} blocks). Take one off, or go paid for no limit.` : `Adding to your ${MODE[mode].label} home`} onClose={() => setGallery(false)}>
        <Gallery free={free} mode={mode} onAdd={(w) => { save([w, ...layout]); setGallery(false); }} />
      </Sheet>
    </Screen>
  );
}

const TYPES: { type: string; label: string; icon: any; eg: string }[] = [
  { type: 'count', label: 'Count', icon: 'add-circle-outline', eg: 'Water, calls, pages' },
  { type: 'yesno', label: 'Yes or no', icon: 'checkmark-circle-outline', eg: 'Read, meditate' },
  { type: 'money', label: 'Money', icon: 'cash-outline', eg: 'Savings, revenue' },
  { type: 'time', label: 'Time', icon: 'time-outline', eg: 'Sleep, deep work' },
  { type: 'scale', label: '1 to 5', icon: 'happy-outline', eg: 'Mood, energy' },
];
const TEMPLATES = [
  { name: 'Get fit', desc: 'Gym sessions, water, sleep, food and training' },
  { name: 'Save money', desc: 'Savings goal, weekly spend, money' },
  { name: 'Grow the business', desc: 'Revenue, calls, quotes, pipeline, reviews' },
  { name: 'Calm mind', desc: 'Meditate, mood, journal, sleep sounds' },
];

function Gallery({ free, mode, onAdd }: { free: boolean; mode: Mode; onAdd: (w: Widget) => void }) {
  const groups = mode === 'business' ? ['Business', 'Work', 'Money'] : ['Health', 'Mind', 'Money', 'People'];
  const head = (t: string) => <Text style={{ color: colours.faint, fontSize: 12, fontWeight: '800', letterSpacing: 1.6, marginTop: space.lg, marginBottom: space.sm }}>{t}</Text>;
  return (
    <View>
      {head('MAKE YOUR OWN TRACKER')}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {TYPES.map((t) => (
          <Pressable key={t.type} onPress={() => router.navigate(`/widget-new?type=${t.type}&mode=${mode}` as any)}
            style={{ width: '31.5%', padding: 10, borderRadius: 14, backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.border }}>
            <Ionicons name={t.icon} size={20} color={colours.purple} />
            <Text style={{ color: colours.text, fontWeight: '800', marginTop: 6 }}>{t.label}</Text>
            <Text style={{ color: colours.faint, fontSize: 11, marginTop: 2 }}>{t.eg}</Text>
          </Pressable>
        ))}
      </View>

      {groups.map((g) => {
        const items = Object.entries(TRACKER_PRESETS).filter(([, p]) => p.group === g);
        if (!items.length) return null;
        return (
          <View key={g}>
            {head(g.toUpperCase())}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 }}>
              {items.map(([k, p]) => {
                const { group, for: _f, ...tr } = p;
                const locked = free && !LIMITS.free.styles.includes(tr.style);
                return (
                  <Pressable key={k} onPress={() => onAdd({ id: `n${Date.now()}`, kind: 'tracker', tracker: locked ? { ...tr, style: 'bar' } : tr, size: 'small' })} style={{ width: '48.5%' }}>
                    <BlockPreview w={{ id: k, kind: 'tracker', tracker: tr, size: 'small' }} />
                    {locked ? (
                      <View style={{ position: 'absolute', right: 8, top: 8, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, backgroundColor: colours.orangeSoft }}>
                        <Ionicons name="lock-closed" size={10} color={colours.orange} />
                        <Text style={{ color: colours.orange, fontSize: 10, fontWeight: '800' }}>{tr.style.toUpperCase()}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}

      {head('FROM YOUR HQ')}
      <View style={{ gap: 8 }}>
        {(Object.keys(BUILTINS) as BuiltIn[]).filter((k) => BUILTINS[k].modes.includes(mode)).slice(0, 8).map((k) => (
          <Pressable key={k} onPress={() => onAdd({ id: `n${Date.now()}`, kind: 'builtin', builtin: k, size: 'wide' })}>
            <BlockPreview w={{ id: k, kind: 'builtin', builtin: k, size: 'wide' }} compact />
          </Pressable>
        ))}
      </View>

      {head('START FROM A TEMPLATE')}
      <View style={{ gap: 8 }}>
        {TEMPLATES.map((t) => (
          <View key={t.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.border }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colours.text, fontWeight: '800' }}>{t.name}</Text>
              <Text style={{ color: colours.faint, fontSize: 12 }}>{t.desc}</Text>
            </View>
            <Text style={{ color: colours.purple, fontWeight: '800' }}>Use</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
