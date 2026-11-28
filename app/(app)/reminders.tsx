// Reminders (28 Nov 2026, Taj: "everyday requires intense effort and reminders in all aspects").
// One place for reminders across mind, body, people, money and home. Repeating ones carry a streak, and
// Tali checks in at 7pm on anything still open today (migration 103, learned_evening_checkins).
import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ErrorText, Screen, goBack } from '@/components/ui';
import { PHeader, serif } from '@/components/Learned';
import { AddReminder } from '@/components/AddReminder';
import { completeReminder, deleteReminder, overdueReminders, remindersAround, type Reminder } from '@/lib/data';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { addDays, friendlyTime } from '@/lib/dates';
import { AREAS, AREA_ORDER, repeatLabel, type Area } from '@/lib/areas';
import { colours, radius, space } from '@/constants/theme';

function weekStart() {
  const d = new Date();
  const back = (d.getDay() + 6) % 7; // Monday
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
}

function Row({ r, last, onTick, onDelete, busy }: { r: Reminder; last?: boolean; onTick: () => void; onDelete: () => void; busy: boolean }) {
  const done = !!r.done_at;
  const colour = r.area ? AREAS[r.area].colour : colours.faint;
  const late = !done && new Date(r.due_at).getTime() < Date.now();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: colours.border }}>
      <Pressable onPress={done ? undefined : onTick} disabled={busy || done} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: done, disabled: busy }} accessibilityLabel={`${done ? 'Done' : 'Tick off'}: ${r.text}`}
        style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, borderColor: done ? colour : colours.borderStrong, backgroundColor: done ? colour : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1, opacity: busy ? 0.5 : 1 }}>
        {done ? <Ionicons name="checkmark" size={15} color={colours.bg} /> : null}
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ color: done ? colours.faint : colours.text, fontSize: 16, fontWeight: '600', textDecorationLine: done ? 'line-through' : 'none' }}>{r.text}</Text>
        <Text style={{ color: late ? colours.danger : colours.muted, fontSize: 13, marginTop: 1 }}>
          {friendlyTime(r.due_at)}{r.repeat ? ` · ${repeatLabel(r.repeat)}` : ''}{late ? ' · still open' : ''}
        </Text>
      </View>
      {r.streak && r.streak > 1 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }} accessibilityLabel={`${r.streak} in a row`}>
          <Ionicons name="flame" size={12} color={colours.orange} />
          <Text style={{ color: colours.orange, fontSize: 12, fontWeight: '800' }}>{r.streak}</Text>
        </View>
      ) : null}
      {!done ? (
        <Pressable onPress={onDelete} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${r.text}`} style={{ marginTop: 2 }}>
          <Ionicons name="close" size={18} color={colours.faint} />
        </Pressable>
      ) : null}
    </View>
  );
}

export default function Reminders() {
  const [only, setOnly] = useState<Area | null>(null);
  const [list, setList] = useState<Reminder[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const from = weekStart();
      const [week, late] = await Promise.all([remindersAround(from.toISOString(), addDays(new Date(), 30).toISOString()), overdueReminders(from.toISOString())]);
      const seen = new Set<string>();
      setList([...late, ...week].filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true))));
      setError('');
    } catch {
      setError("Couldn't load your reminders. Pull down to try again.");
    }
  }, []);
  useFocusLoad(load);

  const thisWeek = useMemo(() => {
    const end = addDays(weekStart(), 7).getTime();
    return (list ?? []).filter((r) => new Date(r.due_at).getTime() < end && new Date(r.due_at).getTime() >= weekStart().getTime());
  }, [list]);
  const doneWeek = thisWeek.filter((r) => r.done_at).length;

  async function tick(r: Reminder) {
    setBusy(r.id);
    try {
      const { streak } = await completeReminder(r.id);
      setNote(streak && streak > 1 ? `${streak} in a row. Nice work.` : r.repeat ? 'Done. The next one is in.' : 'Done.');
      await load();
    } catch {
      setNote("Couldn't tick that off. Try again.");
    }
    setBusy(null);
  }
  async function remove(r: Reminder) {
    setBusy(r.id);
    try {
      await deleteReminder(r.id);
      await load();
    } catch {
      setNote("Couldn't remove that. Try again.");
    }
    setBusy(null);
  }

  const groups: (Area | 'other')[] = only ? [only] : [...AREA_ORDER, 'other'];
  return (
    <Screen onRefresh={load}>
      <PHeader kick="EVERY PART OF YOUR LIFE" title="Reminders" sub="The small things that add up, across your whole life. Tali holds you to them, and checks in at 7pm on anything still open." onBack={() => goBack('/')} backLabel="Today" />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {([null, ...AREA_ORDER] as (Area | null)[]).map((a) => {
          const on = only === a;
          return (
            <Pressable key={a ?? 'all'} onPress={() => setOnly(a)} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 11, borderRadius: radius.pill, borderWidth: 1, borderColor: colours.ink, backgroundColor: on ? colours.ink : 'transparent' }}>
              {a ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: AREAS[a].colour }} /> : null}
              <Text style={{ color: on ? colours.bg : colours.text, fontSize: 13, fontWeight: '700' }}>{a ? AREAS[a].name : 'All'}</Text>
            </Pressable>
          );
        })}
      </View>

      {thisWeek.length ? (
        <View style={{ marginTop: space.lg }}>
          <Text style={{ color: colours.muted, fontSize: 13 }}>This week, {doneWeek} of {thisWeek.length} done</Text>
          <View style={{ flexDirection: 'row', gap: 3, marginTop: 6 }}>
            {thisWeek.slice(0, 40).map((r) => {
              const c = r.area ? AREAS[r.area].colour : colours.faint;
              return <View key={r.id} style={{ flex: 1, height: 6, borderRadius: 2, backgroundColor: r.done_at ? c : c + '30' }} />;
            })}
          </View>
        </View>
      ) : null}
      {note ? <Text style={{ color: colours.purple, fontSize: 13.5, marginTop: 10 }} accessibilityLiveRegion="polite">{note}</Text> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}

      {list === null ? <Text style={{ color: colours.faint, marginTop: space.lg }}>Loading...</Text> : null}
      {groups.map((a) => {
        const items = (list ?? []).filter((r) => (a === 'other' ? !r.area : r.area === a));
        if (a === 'other' && !items.length) return null;
        const meta = a === 'other' ? { name: 'Everything else', line: 'Not sorted yet', colour: colours.faint } : AREAS[a];
        return (
          <View key={a} style={{ marginTop: space.xl }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colours.ink }}>
              <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: meta.colour }} />
              <Text style={{ flex: 1, color: colours.text, fontSize: 26, fontFamily: serif }}>{meta.name}</Text>
              <Text style={{ color: colours.faint, fontSize: 12.5 }}>{meta.line}</Text>
            </View>
            {items.length ? items.map((r, i) => <Row key={r.id} r={r} last={i === items.length - 1} busy={busy === r.id} onTick={() => tick(r)} onDelete={() => remove(r)} />) : (
              <Text style={{ color: colours.faint, fontSize: 13.5, paddingVertical: 12 }}>Nothing here yet.</Text>
            )}
          </View>
        );
      })}

      <View style={{ marginTop: space.xl, marginBottom: space.xl }}>
        <Text style={{ color: colours.text, fontSize: 22, fontFamily: serif, marginBottom: 8 }}>Add one</Text>
        <AddReminder key={only ?? 'all'} onAdded={load} area={only} startOpen />
        <Text style={{ color: colours.muted, fontSize: 12.5, lineHeight: 18 }}>Or just tell Tali in Talk, like "call Nan every second Sunday". She works out when, how often and which part of your life it belongs to.</Text>
      </View>
    </Screen>
  );
}
