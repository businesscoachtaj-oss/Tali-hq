// components/Widgets.tsx
// ADDED (16 Nov 2026, Taj): the blocks on a customisable Today. Trackers draw in five looks:
// a ring of dots (her brain is dots, so the rings are too), a bar, a big number, a 7 day streak
// and a 7 day chart. BUILT FOR REAL (17 Nov 2026): tap + to log, hold + for an amount, tap a yes
// or no to tick it, tap the tile to open its history. Countdown, Checklist and Note are here too.
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colours, radius, space } from '@/constants/theme';
import { Sheet } from '@/components/Sheet';
import { Button, ErrorText } from '@/components/ui';
import { BUILTINS, PERIOD_WORD, fmt, goalLine, logTracker, progress, unitOf, type Extra, type Tracker, type TrackerSpec, type Widget } from '@/lib/widgets';
import { daysBetween, shift, todayKey } from '@/lib/trackerMath';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
type Drawn = TrackerSpec & { value?: number; week?: number[]; streak?: number; teamValue?: number; team?: boolean; sharedIn?: boolean; ownerName?: string | null };

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
            backgroundColor: lit ? colour : 'rgba(28,26,23,0.16)', shadowColor: colour, shadowOpacity: lit ? 0.9 : 0, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }} />
        );
      })}
    </View>
  );
}

export function Bar({ pct, colour }: { pct: number; colour: string }) {
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(28,26,23,0.12)', overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(3, Math.min(100, pct * 100))}%`, height: 8, borderRadius: 4, backgroundColor: colour }} />
    </View>
  );
}

function Head({ tr, pin }: { tr: Drawn; pin?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 30 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tr.colour }} />
      <Text numberOfLines={1} style={{ flexShrink: 1, color: colours.muted, fontSize: 12.5, fontWeight: '700' }}>{tr.name}</Text>
      {tr.team ? <Ionicons name="people" size={12} color={colours.faint} /> : null}
      {pin ? <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(127,168,255,0.6)', backgroundColor: 'rgba(127,168,255,0.14)' }}><Text style={{ color: '#3B3F9E', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 }}>PINNED</Text></View> : null}
    </View>
  );
}

export function TrackerBody({ tr, wide }: { tr: Drawn; wide?: boolean }) {
  const value = (tr.team ? tr.teamValue : tr.value) ?? 0;
  const week = tr.week ?? [0, 0, 0, 0, 0, 0, 0];
  const pct = progress(tr, value);
  const unit = unitOf(tr);
  const of = tr.countDown ? `of ${fmt(tr, tr.startValue ?? 0)} left` : tr.target ? `of ${tr.type === 'money' ? fmt(tr, tr.target) : `${tr.target.toLocaleString('en-AU')} ${unit}`.trim()}` : '';
  const when = tr.countDown ? '' : PERIOD_WORD[tr.period];
  const mine = tr.team ? `  ·  you ${fmt(tr, tr.value ?? 0)}` : '';
  const big = (s: string, extra?: string) => (
    <Text numberOfLines={1} style={{ color: colours.text, fontSize: wide ? 30 : s.length + (extra ? extra.length + 1 : 0) > 11 ? 19 : s.length > 7 ? 22 : 26, fontWeight: '800', letterSpacing: -0.5 }}>
      {s}{extra ? <Text style={{ fontSize: 14, fontWeight: '700', color: colours.muted }}> {extra}</Text> : null}
    </Text>
  );
  if (tr.style === 'ring') {
    // Small tiles: the unit moves into the line under the number so nothing wraps.
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: wide ? 14 : 10, marginTop: 8 }}>
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <DotRing pct={pct} colour={tr.colour} size={wide ? 74 : 58} n={wide ? 28 : 22} />
          <Text style={{ position: 'absolute', color: colours.text, fontWeight: '800', fontSize: wide ? 15 : 12.5 }}>{Math.round(Math.max(0, pct) * 100)}%</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {big(fmt(tr, value))}
          <Text numberOfLines={2} style={{ color: colours.faint, fontSize: 11.5, lineHeight: 15 }}>{of} {when}{mine}</Text>
        </View>
      </View>
    );
  }
  if (tr.style === 'streak') {
    const s = tr.streak ?? 0;
    const weekly = tr.period === 'week';
    return (
      <View style={{ marginTop: 8 }}>
        {big(`${s}`, weekly ? (s === 1 ? 'week in a row' : 'weeks in a row') : s === 1 ? 'day in a row' : 'days in a row')}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
          {week.map((v, i) => (
            <View key={i} style={{ alignItems: 'center', gap: 4 }}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: v ? tr.colour : 'rgba(28,26,23,0.12)', borderWidth: i === 6 ? 1.5 : 0, borderColor: colours.text }} />
              <Text style={{ color: colours.faint, fontSize: 10 }}>{DAYS[(new Date().getDay() + 6 - (6 - i) + 7) % 7]}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }
  if (tr.style === 'chart') {
    const max = Math.max(...week, tr.period === 'day' ? tr.target ?? 0 : 0) || 1;
    const min = tr.period === 'total' ? Math.min(...week) * 0.98 : 0;
    return (
      <View style={{ marginTop: 6 }}>
        {big(fmt(tr, value), unit)}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 40, marginTop: 6 }}>
          {week.map((v, i) => (
            <View key={i} style={{ flex: 1, height: Math.max(3, ((v - min) / (max - min || 1)) * 40), borderRadius: 3, backgroundColor: i === 6 ? tr.colour : tr.colour + '66' }} />
          ))}
        </View>
      </View>
    );
  }
  if (tr.style === 'bar') {
    return (
      <View style={{ marginTop: 8, gap: 8 }}>
        {big(fmt(tr, value), unit)}
        <Bar pct={pct} colour={tr.colour} />
        <Text numberOfLines={1} style={{ color: colours.faint, fontSize: 12 }}>{of} {when}{(tr.target || tr.countDown) && pct < 1 && pct > 0 ? `  ·  ${Math.round(pct * 100)}%` : ''}{mine}</Text>
      </View>
    );
  }
  return (
    <View style={{ marginTop: 8 }}>
      {big(fmt(tr, value), unit)}
      <Text numberOfLines={1} style={{ color: colours.faint, fontSize: 12, marginTop: 2 }}>{of ? `${of} ` : ''}{when}{mine}</Text>
    </View>
  );
}

export const tile = { backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, padding: 14 } as const;
const lift = { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } } as const;
const input = { backgroundColor: colours.sunk, borderWidth: 1, borderColor: colours.border, borderRadius: radius.input, color: colours.text, fontSize: 18, paddingHorizontal: 14, paddingVertical: 12 } as const;

/** Log an amount, for today or a day that has passed, with a note. Also the 1 to 5 picker. */
export function LogSheet({ tr, visible, onClose, onDone }: { tr: Tracker; visible: boolean; onClose: () => void; onDone?: () => void }) {
  const [amount, setAmount] = useState('');
  const [back, setBack] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const day = shift(todayKey(), -back);
  async function save(v: number) {
    if (!Number.isFinite(v) || (v === 0 && tr.type !== 'yesno')) return setErr('Type an amount first.');
    setBusy(true); setErr('');
    try {
      await logTracker(tr.id, tr.countDown ? v : v, day, note.trim() || undefined);
      setAmount(''); setNote(''); setBack(0);
      onClose(); onDone?.();
    } catch (e: any) { setErr(e?.message ?? 'Could not log that.'); }
    setBusy(false);
  }
  const quick = tr.type === 'money' ? [10, 20, 50, 100] : tr.type === 'time' ? [0.5, 1, 2] : tr.unit === 'steps' ? [1000, 5000, 10000] : tr.step ? [tr.step, tr.step * 2, tr.step * 4] : [1, 5, 10];
  return (
    <Sheet visible={visible} title={tr.type === 'scale' ? tr.name : `Log ${tr.name.toLowerCase()}`} sub={tr.countDown ? 'How much came off it?' : tr.type === 'scale' ? 'How was it, 1 to 5?' : goalLine(tr)} onClose={onClose}>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: space.md }}>
        {[0, 1, 2].map((n) => (
          <Pressable key={n} onPress={() => setBack(n)} accessibilityRole="radio" accessibilityState={{ selected: back === n }}
            style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: back === n ? colours.purple : colours.border, backgroundColor: back === n ? colours.purpleSoft : 'transparent' }}>
            <Text style={{ color: back === n ? colours.purpleInk : colours.muted, fontWeight: '700' }}>{n === 0 ? 'Today' : n === 1 ? 'Yesterday' : '2 days ago'}</Text>
          </Pressable>
        ))}
      </View>
      {tr.type === 'scale' ? (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: space.md }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => save(n)} accessibilityLabel={`${n} out of 5`} style={{ flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: tr.colour + '33', borderWidth: 1, borderColor: tr.colour }}>
              <Text style={{ color: colours.text, fontSize: 20, fontWeight: '800' }}>{n}</Text>
            </Pressable>
          ))}
        </View>
      ) : tr.type === 'yesno' ? (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: space.md }}>
          <View style={{ flex: 1 }}><Button title="Done" onPress={() => save(1)} busy={busy} /></View>
          <View style={{ flex: 1 }}><Button kind="ghost" title="Not done" onPress={() => save(0)} /></View>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" autoFocus placeholder={tr.type === 'money' ? 'A$' : tr.unit || 'How many'} placeholderTextColor={colours.faint} style={[input, { flex: 1 }]} accessibilityLabel="Amount" onSubmitEditing={() => save(Number(amount.replace(/,/g, '')))} />
            {unitOf(tr) ? <Text style={{ color: colours.muted, fontWeight: '700' }}>{unitOf(tr)}</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: space.sm, marginBottom: space.md }}>
            {quick.map((q) => (
              <Pressable key={q} onPress={() => setAmount(String(Number(amount || 0) + q))} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.border }}>
                <Text style={{ color: colours.text, fontWeight: '700' }}>+{tr.type === 'money' ? `$${q}` : q}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput value={note} onChangeText={setNote} placeholder="Add a note (optional)" placeholderTextColor={colours.faint} maxLength={300} style={[input, { fontSize: 15, marginBottom: space.md }]} />
          <Button title="Log it" onPress={() => save(Number(amount.replace(/,/g, '')))} busy={busy} />
        </>
      )}
      <ErrorText>{err}</ErrorText>
    </Sheet>
  );
}

/** A tracker on the home. Tap the tile for its history, tap + to log one, hold + for an amount. */
export function TrackerTile({ w, preview }: { w: Widget; preview?: boolean }) {
  const tr = w.tracker as Tracker & Drawn;
  const [sheet, setSheet] = useState(false);
  const [err, setErr] = useState('');
  const live = !preview && !!tr.id;
  const doneToday = tr.type === 'yesno' && !!tr.days?.[todayKey()];
  const quickLog = () => {
    if (!live) return;
    setErr('');
    if (tr.type === 'yesno') logTracker(tr.id, doneToday ? 0 : 1).catch((e) => setErr(e.message));
    else if (tr.type === 'scale' || tr.step == null) setSheet(true);
    else logTracker(tr.id, tr.step).catch((e) => setErr(e.message));
  };
  return (
    <Pressable onPress={live ? () => router.navigate(`/tracker?id=${tr.id}` as any) : undefined} accessibilityRole={live ? 'button' : undefined} accessibilityLabel={`${tr.name}. Open history`}
      style={[tile, lift, { width: w.size === 'wide' ? '100%' : '48.6%', minHeight: 128 }]}>
      <Head tr={tr} pin={w.pin === 'pinned'} />
      <TrackerBody tr={tr} wide={w.size === 'wide'} />
      {err ? <Text style={{ color: colours.danger, fontSize: 11, marginTop: 4 }}>{err}</Text> : null}
      <Pressable onPress={quickLog} onLongPress={live ? () => setSheet(true) : undefined} delayLongPress={350} hitSlop={10} accessibilityRole="button"
        accessibilityLabel={tr.type === 'yesno' ? (doneToday ? `Untick ${tr.name}` : `Tick ${tr.name}`) : `Log ${tr.name}. Hold for an amount`}
        style={{ position: 'absolute', right: 8, top: 8, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: doneToday ? tr.colour : 'rgba(28,26,23,0.10)' }}>
        <Ionicons name={tr.type === 'yesno' ? 'checkmark' : 'add'} size={17} color={doneToday ? '#F5F0E6' : colours.text} />
      </Pressable>
      {live ? <LogSheet tr={tr} visible={sheet} onClose={() => setSheet(false)} /> : null}
    </Pressable>
  );
}

/** Countdown, Checklist and Note. `onChange` saves the block back into the layout. */
export function ExtraTile({ w, onChange }: { w: Widget; onChange?: (extra: Extra) => void }) {
  const x = w.extra!;
  const [text, setText] = useState('');
  if (x.type === 'countdown') {
    const n = daysBetween(todayKey(), x.date);
    return (
      <View style={[tile, lift, { width: w.size === 'wide' ? '100%' : '48.6%', minHeight: 128 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="hourglass-outline" size={13} color={colours.orange} />
          <Text numberOfLines={1} style={{ flex: 1, color: colours.muted, fontSize: 12.5, fontWeight: '700' }}>{x.title || 'Countdown'}</Text>
        </View>
        <Text style={{ color: colours.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.5, marginTop: 8 }}>{Math.abs(n)}</Text>
        <Text style={{ color: colours.faint, fontSize: 12 }}>{n === 0 ? 'Today is the day' : n > 0 ? `${n === 1 ? 'day' : 'days'} to go` : `${n === -1 ? 'day' : 'days'} ago`}  ·  {new Date(`${x.date}T12:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
      </View>
    );
  }
  if (x.type === 'note') {
    return (
      <View style={[tile, lift, { width: w.size === 'wide' ? '100%' : '48.6%', backgroundColor: colours.paper, borderColor: 'rgba(42,35,64,0.15)' }]}>
        <Text style={{ color: colours.ink, fontSize: 16, lineHeight: 23, fontFamily: 'EBGaramond_500Medium' }}>{x.text || 'Tap Edit home to write your note.'}</Text>
      </View>
    );
  }
  const done = x.items.filter((i) => i.done).length;
  const toggle = (i: number) => onChange?.({ ...x, items: x.items.map((it, n) => (n === i ? { ...it, done: !it.done } : it)) });
  const add = () => { const t = text.trim(); if (!t) return; onChange?.({ ...x, items: [...x.items, { t: t.slice(0, 120), done: false }] }); setText(''); };
  return (
    <View style={[tile, lift, { width: '100%' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Ionicons name="checkbox-outline" size={14} color={colours.purple} />
        <Text numberOfLines={1} style={{ flex: 1, color: colours.muted, fontSize: 12.5, fontWeight: '700' }}>{x.title || 'Checklist'}</Text>
        <Text style={{ color: colours.faint, fontSize: 12 }}>{done} of {x.items.length}</Text>
        {done && onChange ? <Pressable onPress={() => onChange({ ...x, items: x.items.filter((i) => !i.done) })} hitSlop={8}><Text style={{ color: colours.purple, fontSize: 12, fontWeight: '700' }}>Clear done</Text></Pressable> : null}
      </View>
      {x.items.map((it, i) => (
        <Pressable key={`${i}${it.t}`} onPress={() => toggle(i)} accessibilityRole="checkbox" accessibilityState={{ checked: it.done }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 }}>
          <View style={{ width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: it.done ? colours.purple : 'transparent', borderWidth: 2, borderColor: it.done ? colours.purple : colours.purpleInk }}>
            {it.done ? <Ionicons name="checkmark" size={14} color="#F5F0E6" /> : null}
          </View>
          <Text style={{ flex: 1, color: it.done ? colours.faint : colours.text, fontSize: 15, textDecorationLine: it.done ? 'line-through' : 'none' }}>{it.t}</Text>
        </Pressable>
      ))}
      {onChange ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          <TextInput value={text} onChangeText={setText} onSubmitEditing={add} placeholder="Add an item" placeholderTextColor={colours.faint} maxLength={120} style={[input, { flex: 1, fontSize: 15, paddingVertical: 9 }]} />
          <Pressable onPress={add} accessibilityLabel="Add item" style={{ width: 42, borderRadius: radius.input, alignItems: 'center', justifyContent: 'center', backgroundColor: colours.purpleSoft, borderWidth: 1, borderColor: colours.border }}>
            <Ionicons name="add" size={20} color={colours.purpleInk} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** The "Your HQ" heading with the Edit home button. */
export function HomeHeader({ mode, editRef }: { mode: string; editRef?: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.md, marginBottom: space.sm }}>
      <Text style={{ flex: 1, color: colours.faint, fontSize: 12, fontWeight: '800', letterSpacing: 1.6 }}>YOUR HQ</Text>
      <View ref={editRef} collapsable={false}>
        <Pressable onPress={() => router.navigate(`/home-edit?mode=${mode}` as any)} accessibilityRole="button" hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colours.purpleSoft, borderWidth: 1, borderColor: colours.border }}>
          <Ionicons name="grid-outline" size={13} color={colours.purpleInk} />
          <Text style={{ color: colours.purpleInk, fontSize: 13, fontWeight: '700' }}>Edit home</Text>
        </Pressable>
      </View>
    </View>
  );
}

// A small preview of any block, used in edit mode, the gallery, onboarding and sharing.
export function BlockPreview({ w, compact, blank }: { w: Widget; compact?: boolean; blank?: boolean }) {
  const tr = (w.tracker ?? w.spec) as Drawn | undefined;
  if (w.kind === 'tracker' && tr && (blank || tr.value === undefined)) {
    return (
      <View style={[tile, { padding: 10 }]}>
        <Head tr={{ ...tr, team: false }} />
        <Text numberOfLines={1} style={{ color: colours.text, fontWeight: '800', fontSize: 15, marginTop: 4 }}>{goalLine(tr)}</Text>
      </View>
    );
  }
  if (w.kind === 'tracker' && tr) {
    return (
      <View style={[tile, { padding: compact ? 10 : 14 }]}>
        <Head tr={tr} pin={w.pin === 'pinned'} />
        {compact ? <Text numberOfLines={1} style={{ color: colours.text, fontWeight: '800', fontSize: 18, marginTop: 4 }}>{fmt(tr, (tr.team ? tr.teamValue : tr.value) ?? 0)} <Text style={{ fontSize: 12, color: colours.muted }}>{unitOf(tr)}</Text></Text> : <TrackerBody tr={tr} />}
      </View>
    );
  }
  if (w.kind === 'extra') {
    const x = w.extra!;
    const icon = x.type === 'countdown' ? 'hourglass-outline' : x.type === 'checklist' ? 'checkbox-outline' : 'document-text-outline';
    const title = x.type === 'countdown' ? x.title || 'Countdown' : x.type === 'checklist' ? x.title || 'Checklist' : 'Note';
    const sub = x.type === 'countdown' ? new Date(`${x.date}T12:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : x.type === 'checklist' ? `${x.items.length} ${x.items.length === 1 ? 'item' : 'items'}` : x.text || 'A line you want to see each day';
    return (
      <View style={[tile, { padding: compact ? 10 : 14, backgroundColor: colours.sunk, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
        <Ionicons name={icon as any} size={16} color={colours.orange} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: colours.text, fontWeight: '800', fontSize: compact ? 13.5 : 15 }}>{title}</Text>
          <Text style={{ color: colours.faint, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{sub}</Text>
        </View>
      </View>
    );
  }
  const meta = BUILTINS[w.builtin!];
  return (
    <View style={[tile, { padding: compact ? 10 : 14, backgroundColor: colours.sunk }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text numberOfLines={1} style={{ flexShrink: 1, color: colours.text, fontWeight: '800', fontSize: compact ? 13.5 : 15 }}>{meta?.title ?? 'Block'}</Text>
        {w.pin === 'pinned' ? <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(127,168,255,0.6)', backgroundColor: 'rgba(127,168,255,0.14)' }}><Text style={{ color: '#3B3F9E', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 }}>PINNED</Text></View> : null}
      </View>
      <Text style={{ color: colours.faint, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{meta?.sub}</Text>
    </View>
  );
}

// A whole layout drawn small, for onboarding's "here's your HQ", templates and shared layout cards.
export function MiniLayout({ widgets, blank }: { widgets: Widget[]; blank?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 }}>
      {widgets.filter((w) => !w.hidden && !w.parked).map((w) => (
        <View key={w.id} style={{ width: w.kind === 'tracker' && w.size !== 'wide' ? '48.5%' : '100%' }}>
          <BlockPreview w={w} compact blank={blank} />
        </View>
      ))}
    </View>
  );
}
