// components/Widgets.tsx
// ADDED (16 Nov 2026, Taj): the blocks on a customisable Today. Trackers draw in five styles:
// a ring of dots (her brain is dots, so the rings are too), a bar, a big number, a 7 day streak
// and a 7 day chart. Built-in blocks show as a titled tile in edit mode and in the gallery.
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colours, radius, space } from '@/constants/theme';
import { BUILTINS, fmt, PERIOD_WORD, streakOf, type Tracker, type Widget } from '@/lib/widgets';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function DotRing({ pct, colour, size = 74, n = 28 }: { pct: number; colour: string; size?: number; n?: number }) {
  const r = size / 2 - 5;
  const on = Math.round(Math.max(0, Math.min(1, pct)) * n);
  return (
    <View style={{ width: size, height: size }}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const lit = i < on;
        const d = lit ? 6 : 4.5;
        return (
          <View key={i} style={{ position: 'absolute', left: size / 2 + r * Math.cos(a) - d / 2, top: size / 2 + r * Math.sin(a) - d / 2, width: d, height: d, borderRadius: d,
            backgroundColor: lit ? colour : 'rgba(255,255,255,0.16)', shadowColor: colour, shadowOpacity: lit ? 0.9 : 0, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }} />
        );
      })}
    </View>
  );
}

function Bar({ pct, colour }: { pct: number; colour: string }) {
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(3, Math.min(100, pct * 100))}%`, height: 8, borderRadius: 4, backgroundColor: colour }} />
    </View>
  );
}

function Head({ tr }: { tr: Tracker }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tr.colour }} />
      <Text numberOfLines={1} style={{ flex: 1, color: colours.muted, fontSize: 12.5, fontWeight: '700' }}>{tr.name}</Text>
    </View>
  );
}

export function TrackerBody({ tr, wide }: { tr: Tracker; wide?: boolean }) {
  const pct = tr.target ? tr.value / tr.target : 0;
  const unit = tr.type === 'money' ? '' : tr.unit;
  const of = tr.target ? `of ${tr.type === 'money' ? fmt(tr, tr.target) : `${tr.target.toLocaleString('en-AU')} ${unit}`}` : '';
  const big = (s: string, extra?: string) => (
    <Text style={{ color: colours.text, fontSize: wide ? 30 : 26, fontWeight: '800', letterSpacing: -0.5 }}>
      {s}{extra ? <Text style={{ fontSize: 14, fontWeight: '700', color: colours.muted }}> {extra}</Text> : null}
    </Text>
  );
  if (tr.style === 'ring') {
    // Small tiles: the unit moves into the line under the number so nothing wraps.
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: wide ? 14 : 10, marginTop: 8 }}>
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <DotRing pct={pct} colour={tr.colour} size={wide ? 74 : 58} n={wide ? 28 : 22} />
          <Text style={{ position: 'absolute', color: colours.text, fontWeight: '800', fontSize: wide ? 15 : 12.5 }}>{Math.round(pct * 100)}%</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {big(fmt(tr))}
          <Text numberOfLines={2} style={{ color: colours.faint, fontSize: 11.5, lineHeight: 15 }}>{of} {PERIOD_WORD[tr.period]}</Text>
        </View>
      </View>
    );
  }
  if (tr.style === 'streak') {
    const s = streakOf(tr.week);
    return (
      <View style={{ marginTop: 8 }}>
        {big(`${s}`, s === 1 ? 'day in a row' : 'days in a row')}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
          {tr.week.map((v, i) => (
            <View key={i} style={{ alignItems: 'center', gap: 4 }}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: v ? tr.colour : 'rgba(255,255,255,0.12)', borderWidth: i === 6 ? 1.5 : 0, borderColor: colours.text }} />
              <Text style={{ color: colours.faint, fontSize: 10 }}>{DAYS[i]}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }
  if (tr.style === 'chart') {
    const max = Math.max(...tr.week, tr.target ?? 0) || 1;
    return (
      <View style={{ marginTop: 6 }}>
        {big(fmt(tr), unit)}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 40, marginTop: 6 }}>
          {tr.week.map((v, i) => (
            <View key={i} style={{ flex: 1, height: Math.max(3, (v / max) * 40), borderRadius: 3, backgroundColor: i === 6 ? tr.colour : tr.colour + '66' }} />
          ))}
        </View>
      </View>
    );
  }
  if (tr.style === 'bar') {
    return (
      <View style={{ marginTop: 8, gap: 8 }}>
        {big(fmt(tr), unit)}
        <Bar pct={pct} colour={tr.colour} />
        <Text style={{ color: colours.faint, fontSize: 12 }}>{of} {PERIOD_WORD[tr.period]}{tr.target && pct < 1 ? `  ·  ${Math.round(pct * 100)}%` : ''}</Text>
      </View>
    );
  }
  return (
    <View style={{ marginTop: 8 }}>
      {big(fmt(tr), unit)}
      <Text style={{ color: colours.faint, fontSize: 12, marginTop: 2 }}>{of ? `${of} ` : ''}{PERIOD_WORD[tr.period]}</Text>
    </View>
  );
}

const tile = { backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, padding: 14 } as const;

export function TrackerTile({ w, onPress }: { w: Widget; onPress?: () => void }) {
  const tr = w.tracker!;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={tr.name}
      style={[tile, { width: w.size === 'wide' ? '100%' : '48.6%', minHeight: 128, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }]}>
      <Head tr={tr} />
      <TrackerBody tr={tr} wide={w.size === 'wide'} />
      {tr.type !== 'yesno' && tr.style !== 'streak' ? (
        <View style={{ position: 'absolute', right: 10, top: 10, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' }}>
          <Ionicons name="add" size={16} color={colours.text} />
        </View>
      ) : null}
    </Pressable>
  );
}

// The tracker grid that sits under her brain on Today.
export function WidgetGrid({ widgets, mode }: { widgets: Widget[]; mode: string }) {
  const shown = widgets.filter((w) => w.kind === 'tracker' && !w.hidden);
  return (
    <View style={{ marginTop: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm }}>
        <Text style={{ flex: 1, color: colours.faint, fontSize: 12, fontWeight: '800', letterSpacing: 1.6 }}>YOUR HQ</Text>
        <Pressable onPress={() => router.navigate(`/home-edit?mode=${mode}` as any)} accessibilityRole="button" hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colours.purpleSoft, borderWidth: 1, borderColor: colours.border }}>
          <Ionicons name="grid-outline" size={13} color={colours.purpleInk} />
          <Text style={{ color: colours.purpleInk, fontSize: 13, fontWeight: '700' }}>Edit home</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
        {shown.map((w) => <TrackerTile key={w.id} w={w} />)}
      </View>
    </View>
  );
}

// A small preview of any block, used in edit mode, the gallery, onboarding and sharing.
export function goalLine(tr: Tracker): string {
  if (tr.type === 'yesno') return `Every ${tr.period === 'week' ? 'week' : 'day'}`;
  if (!tr.target) return tr.type === 'scale' ? 'Rate it daily' : 'Keep count';
  const n = tr.type === 'money' ? fmt(tr, tr.target) : `${tr.target.toLocaleString('en-AU')} ${tr.unit}`;
  return `${n} ${tr.period === 'total' ? 'goal' : `a ${tr.period}`}`;
}

export function BlockPreview({ w, compact, blank }: { w: Widget; compact?: boolean; blank?: boolean }) {
  if (w.kind === 'tracker' && blank) {
    return (
      <View style={[tile, { padding: 10 }]}>
        <Head tr={w.tracker!} />
        <Text style={{ color: colours.text, fontWeight: '800', fontSize: 15, marginTop: 4 }}>{goalLine(w.tracker!)}</Text>
      </View>
    );
  }
  if (w.kind === 'tracker') {
    return (
      <View style={[tile, { padding: compact ? 10 : 14 }]}>
        <Head tr={w.tracker!} />
        {compact ? <Text style={{ color: colours.text, fontWeight: '800', fontSize: 18, marginTop: 4 }}>{fmt(w.tracker!)} <Text style={{ fontSize: 12, color: colours.muted }}>{w.tracker!.type === 'money' ? '' : w.tracker!.unit}</Text></Text> : <TrackerBody tr={w.tracker!} />}
      </View>
    );
  }
  const meta = BUILTINS[w.builtin!];
  return (
    <View style={[tile, { padding: compact ? 10 : 14, backgroundColor: colours.sunk }]}>
      <Text style={{ color: colours.text, fontWeight: '800', fontSize: compact ? 13.5 : 15 }}>{meta.title}</Text>
      <Text style={{ color: colours.faint, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{meta.sub}</Text>
    </View>
  );
}

// A whole layout drawn small, for onboarding's "here's your HQ" and shared layout cards.
export function MiniLayout({ widgets, scale = 1, blank }: { widgets: Widget[]; scale?: number; blank?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 * scale }}>
      {widgets.filter((w) => !w.hidden).map((w) => (
        <View key={w.id} style={{ width: w.size === 'wide' || w.kind === 'builtin' ? '100%' : '48.5%' }}>
          <BlockPreview w={w} compact blank={blank} />
        </View>
      ))}
    </View>
  );
}
