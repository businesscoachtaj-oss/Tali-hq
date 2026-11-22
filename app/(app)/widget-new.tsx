// app/(app)/widget-new.tsx
// ADDED (16 Nov 2026, Taj): make your own tracker. Name it, pick what kind of thing it counts, set a
// target and how often, pick how it looks, and it goes on your home. The preview at the top
// changes as you go. On Free: number and bar looks, daily or weekly targets, no Tali check-ins.
// BUILT FOR REAL (17 Nov 2026): saves the tracker, puts it on the home, and edits one that exists.
import { useEffect, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BackLink, Button, ErrorText, Label, Screen, Title } from '@/components/ui';
import { TrackerTile } from '@/components/Widgets';
import { colours, radius, space } from '@/constants/theme';
import { COLOURS, LIMITS, SOURCE_LABEL, TRACKER_PRESETS, createTracker, homeKeyFor, isProPlan, newId, presetSpec, reloadHq, saveLayout, updateTracker, useHome, useHq, type Period, type TrackerSource, type TrackerSpec, type TrackerStyle, type TrackerType } from '@/lib/widgets';
import { MODE, type Mode } from '@/lib/mode';
import { useHasBusiness } from '@/lib/business';
import { useBusinesses } from '@/lib/businesses';

const TYPE_LABEL: Record<TrackerType, string> = { count: 'Count', yesno: 'Yes or no', money: 'Money', time: 'Time', scale: '1 to 5' };
const PERIOD_LABEL: Record<Period, string> = { day: 'A day', week: 'A week', month: 'A month', total: 'In total' };
const STYLE_LABEL: Record<TrackerStyle, string> = { ring: 'Ring', bar: 'Bar', number: 'Number', streak: 'Streak', chart: 'Chart' };

function Chips<T extends string>({ items, value, onPick, locked = [] }: { items: Record<T, string>; value: T; onPick: (v: T) => void; locked?: T[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space.md }}>
      {(Object.keys(items) as T[]).map((k) => {
        const on = k === value, lock = locked.includes(k);
        return (
          <Pressable key={k} onPress={() => (lock ? router.navigate('/plans') : onPick(k))} accessibilityRole="radio" accessibilityState={{ selected: on, disabled: lock }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? colours.purple : colours.border, backgroundColor: on ? colours.purple : 'rgba(28,26,23,0.05)', opacity: lock ? 0.55 : 1 }}>
            {lock ? <Ionicons name="lock-closed" size={12} color={colours.orange} /> : null}
            <Text style={{ color: on ? colours.onPurple : colours.text, fontWeight: '700' }}>{items[k]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const input = { backgroundColor: colours.sunk, borderWidth: 1, borderColor: colours.border, borderRadius: radius.input, color: colours.text, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12 } as const;
const blank = (type: TrackerType, free: boolean): TrackerSpec => ({ name: '', type, unit: type === 'money' ? 'A$' : type === 'time' ? 'h' : type === 'scale' ? '/5' : '', target: null, period: 'day', style: type === 'yesno' ? (free ? 'number' : 'streak') : type === 'scale' ? (free ? 'number' : 'chart') : free ? 'bar' : 'ring', colour: COLOURS[0], step: type === 'count' ? 1 : type === 'time' ? 0.5 : null });

export default function WidgetNew() {
  const q = useLocalSearchParams<{ preset?: string; type?: string; mode?: string; edit?: string; back?: string }>();
  const hq = useHq();
  const hasBiz = useHasBusiness();
  const bz = useBusinesses();
  const free = hq.plan === 'free';
  const mode: Mode = !hasBiz ? 'life' : q.mode === 'business' ? 'business' : 'life';
  const homeKey = homeKeyFor(mode, hasBiz, bz.current);
  const home = useHome(homeKey, hasBiz);
  const existing = q.edit ? hq.trackers.find((t) => t.id === q.edit) : undefined;
  const [tr, setTr] = useState<TrackerSpec>(() => (q.preset && TRACKER_PRESETS[q.preset] ? presetSpec(q.preset) : blank((q.type as TrackerType) || 'count', free)));
  const [wide, setWide] = useState(false);
  const [side, setSide] = useState<'life' | 'business' | 'both'>(mode);
  const [targetText, setTargetText] = useState('');
  const [stepText, setStepText] = useState('');
  const [startText, setStartText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (p: Partial<TrackerSpec>) => setTr((t) => ({ ...t, ...p }));

  // Opening a different tracker, preset or type starts the form again (this screen stays mounted between visits).
  useEffect(() => {
    setErr('');
    if (existing) {
      setTr({ name: existing.name, type: existing.type, unit: existing.unit, target: existing.target, period: existing.period, style: existing.style, colour: existing.colour, step: existing.step, startValue: existing.startValue, countDown: existing.countDown, checkIn: existing.checkIn, restDay: existing.restDay, source: existing.source, preset: existing.preset, team: existing.team });
      setTargetText(existing.target != null ? String(existing.target) : ''); setStepText(existing.step != null ? String(existing.step) : ''); setStartText(existing.startValue ? String(existing.startValue) : '');
      setSide(existing.home);
      setWide(home.widgets.find((w) => w.tracker_id === existing.id)?.size === 'wide');
    } else if (!q.edit) {
      const t = q.preset && TRACKER_PRESETS[q.preset] ? presetSpec(q.preset) : blank((q.type as TrackerType) || 'count', free);
      setTr(t); setTargetText(t.target != null ? String(t.target) : ''); setStepText(t.step != null ? String(t.step) : ''); setStartText(''); setSide(mode); setWide(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.edit, q.preset, q.type, existing?.id, free]);

  const lockedStyles = free ? (Object.keys(STYLE_LABEL) as TrackerStyle[]).filter((s) => !LIMITS.free.styles.includes(s)) : [];
  const lockedPeriods = free ? (['month', 'total'] as Period[]) : [];
  const num = (s: string) => { const n = Number(s.replace(/,/g, '')); return Number.isFinite(n) && s.trim() !== '' ? n : null; };
  const spec: TrackerSpec = { ...tr, target: num(targetText), step: tr.type === 'yesno' || tr.type === 'scale' ? null : num(stepText), startValue: tr.countDown ? num(startText) ?? 0 : 0 };
  const canAuto = isProPlan(hq.plan);
  const sources: TrackerSource[] = tr.type === 'money' ? ['manual', 'invoices_paid', 'spend'] : tr.type === 'count' ? ['manual', 'quotes_sent', 'jobs_done', 'bookings'] : ['manual'];
  const back = () => router.navigate((q.back === 'tracker' && existing ? `/tracker?id=${existing.id}` : `/home-edit?mode=${mode}`) as any);

  async function save() {
    setErr('');
    if (!spec.name.trim()) return setErr('Give it a name first.');
    if (spec.countDown && !(spec.startValue! > (spec.target ?? 0))) return setErr('Put in where it starts, higher than where you want to get to.');
    setBusy(true);
    try {
      const where = hasBiz ? side : 'life';
      if (existing) {
        await updateTracker(existing.id, spec, where);
        const on = home.blocks.find((b) => b.tracker_id === existing.id);
        if (on && (on.size === 'wide') !== wide) await saveLayout(homeKey, home.blocks.map((b) => (b.tracker_id === existing.id ? { ...b, size: wide ? 'wide' : 'small' } : b)));
      } else {
        const id = await createTracker(spec, where);
        await reloadHq();
        await saveLayout(homeKey, [{ id: newId(), kind: 'tracker', tracker_id: id, size: wide ? 'wide' : 'small' }, ...home.blocks]);
      }
      if (existing) back(); else router.navigate('/');
    } catch (e: any) { setErr(e?.message ?? 'Could not save that tracker.'); }
    setBusy(false);
  }

  return (
    <Screen>
      <BackLink onPress={back} label={q.back === 'tracker' ? 'Back' : 'Edit home'} />
      <Title sub={existing ? 'Change anything. Its history stays.' : 'Anything you want to keep count of. It goes straight on your home.'}>{existing ? 'Edit tracker' : 'Make a tracker'}</Title>

      <Label>Preview</Label>
      <View style={{ flexDirection: 'row', marginBottom: space.lg }}>
        <TrackerTile preview w={{ id: 'p', kind: 'tracker', size: wide ? 'wide' : 'small', tracker: { ...spec, name: spec.name || 'Your tracker', value: existing?.value ?? 0, week: existing?.week ?? [0, 0, 0, 0, 0, 0, 0], streak: existing?.streak ?? 0, startValue: spec.startValue ?? 0 } as any }} />
      </View>

      <Label>What are you tracking?</Label>
      <TextInput value={tr.name} onChangeText={(name) => set({ name })} maxLength={60} placeholder="Cold calls, water, savings..." placeholderTextColor={colours.faint} style={[input, { marginBottom: space.md }]} accessibilityLabel="Tracker name" />

      <Label>What kind of thing is it?</Label>
      <Chips items={TYPE_LABEL} value={tr.type} onPick={(type) => { const b = blank(type, free); set({ type, unit: type === 'money' ? 'A$' : type === 'time' ? 'h' : type === 'scale' ? '/5' : tr.type === 'count' ? tr.unit : '', style: b.style, source: 'manual', countDown: false }); setStepText(b.step != null ? String(b.step) : ''); }} />

      {tr.type !== 'scale' && !(tr.type === 'yesno' && tr.period === 'day') ? (<>
        <Label>{tr.type === 'yesno' ? 'How many days' : tr.countDown ? 'Get it down to' : 'Target'}</Label>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: space.sm }}>
          <TextInput value={targetText} onChangeText={setTargetText} keyboardType="decimal-pad" placeholder={tr.type === 'yesno' ? '3' : '20'} placeholderTextColor={colours.faint} style={[input, { flex: 1, minWidth: 0 }]} accessibilityLabel="Target" />
          {tr.type === 'count' ? <TextInput value={tr.unit} onChangeText={(unit) => set({ unit })} maxLength={16} placeholder="unit, like calls" placeholderTextColor={colours.faint} style={[input, { flex: 1, minWidth: 0 }]} accessibilityLabel="Unit" /> : null}
        </View>
      </>) : null}
      <Chips items={PERIOD_LABEL} value={tr.period} onPick={(period) => set({ period, countDown: period === 'total' ? tr.countDown : false })} locked={lockedPeriods} />

      {tr.period === 'total' && (tr.type === 'money' || tr.type === 'count') ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.border, marginBottom: space.md }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colours.text, fontWeight: '800' }}>Count down</Text>
            <Text style={{ color: colours.muted, fontSize: 12.5 }}>For a debt or anything you are getting down to a number. Each log takes off what you paid.</Text>
            {tr.countDown ? <TextInput value={startText} onChangeText={setStartText} keyboardType="decimal-pad" placeholder="Where it starts, like 5000" placeholderTextColor={colours.faint} style={[input, { marginTop: 8, fontSize: 15, paddingVertical: 9 }]} accessibilityLabel="Starting amount" /> : null}
          </View>
          <Switch value={!!tr.countDown} onValueChange={(countDown) => set({ countDown })} accessibilityLabel="Count down" />
        </View>
      ) : null}

      {tr.type === 'count' || tr.type === 'time' || tr.type === 'money' ? (<>
        <Label>One tap of + adds</Label>
        <TextInput value={stepText} onChangeText={setStepText} keyboardType="decimal-pad" placeholder="Leave empty to type an amount each time" placeholderTextColor={colours.faint} style={[input, { marginBottom: space.md }]} accessibilityLabel="Amount for one tap" />
      </>) : null}

      <Label>How it looks</Label>
      <Chips items={STYLE_LABEL} value={tr.style} onPick={(style) => set({ style })} locked={lockedStyles} />
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: space.md, alignItems: 'center' }}>
        {COLOURS.map((c) => (
          <Pressable key={c} onPress={() => set({ colour: c })} accessibilityLabel={`Colour ${c}`}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c, borderWidth: tr.colour === c ? 3 : 0, borderColor: '#fff' }} />
        ))}
      </View>
      <Chips items={{ small: 'Small', wide: 'Wide' }} value={wide ? 'wide' : 'small'} onPick={(v) => setWide(v === 'wide')} />

      {hasBiz ? (<>
        <Label>Which home?</Label>
        <Chips items={{ life: MODE.life.label, business: MODE.business.label, both: 'Both' }} value={side} onPick={setSide} />
      </>) : null}

      {sources.length > 1 ? (<>
        <Label>Where it logs from</Label>
        <Chips items={Object.fromEntries(sources.map((s) => [s, SOURCE_LABEL[s]])) as Record<TrackerSource, string>} value={tr.source ?? 'manual'} onPick={(source) => set({ source })} locked={canAuto ? [] : sources.filter((s) => s !== 'manual')} />
        <Text style={{ color: colours.faint, fontSize: 12.5, marginTop: -6, marginBottom: space.md, lineHeight: 18 }}>
          {canAuto ? 'Pick one and it fills itself in. You can still add to it by hand.' : 'Trackers that log themselves come with Pro.'} Apple Health and Health Connect are coming in the next app update.
        </Text>
      </>) : null}

      {tr.period === 'day' && tr.type !== 'scale' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.border, marginBottom: space.sm }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colours.text, fontWeight: '800' }}>One rest day a week</Text>
            <Text style={{ color: colours.muted, fontSize: 12.5 }}>A planned day off does not break your streak.</Text>
          </View>
          <Switch value={!!tr.restDay} onValueChange={(restDay) => set({ restDay })} accessibilityLabel="One rest day a week" />
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.border, marginBottom: space.lg, opacity: free ? 0.6 : 1 }}>
        <Ionicons name="sparkles" size={18} color={colours.purple} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colours.text, fontWeight: '800' }}>Tali keeps me on track</Text>
          <Text style={{ color: colours.muted, fontSize: 12.5 }}>{free ? 'On paid plans a nudge shows on your home when you fall behind.' : isProPlan(hq.plan) ? 'When you fall behind, a check-in in her own words lands on your home with your morning brief.' : 'A nudge shows on your home when you fall behind. Pro adds check-ins in her own words.'}</Text>
        </View>
        {free ? <Ionicons name="lock-closed" size={16} color={colours.orange} /> : <Switch value={!!tr.checkIn} onValueChange={(checkIn) => set({ checkIn })} accessibilityLabel="Tali keeps me on track" />}
      </View>

      {hq.plan === 'biz' && (hasBiz ? side !== 'life' : false) ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: 'rgba(127,168,255,0.12)', borderWidth: 1, borderColor: 'rgba(127,168,255,0.5)', marginBottom: space.lg }}>
          <Ionicons name="people" size={18} color="#3B3F9E" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colours.text, fontWeight: '800' }}>Team tracker</Text>
            <Text style={{ color: colours.muted, fontSize: 12.5 }}>Everyone on your team logs to it. You see the total and each person's share. Add it to your Team layout to put it on their homes.</Text>
          </View>
          <Switch value={!!tr.team} onValueChange={(team) => set({ team })} accessibilityLabel="Team tracker" />
        </View>
      ) : null}

      <ErrorText>{err}</ErrorText>
      <Button title={existing ? 'Save changes' : 'Add to my home'} onPress={save} busy={busy} />
      <View style={{ height: space.xl }} />
    </Screen>
  );
}
