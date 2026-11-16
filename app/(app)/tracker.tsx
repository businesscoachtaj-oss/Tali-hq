// app/(app)/tracker.tsx
// ADDED (17 Nov 2026, Taj): a tracker's own page. Where you are at, a chart that fits what it counts,
// streaks and records, the pace toward a goal, every entry (fix or remove any), and on Pro and up a
// short read from Tali on why it changed. Everything but her read is plain maths (lib/trackerMath.ts),
// so it never costs credits. Free sees the last 7 days and the Week chart.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Share, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BackLink, Button, Card, ErrorText, Label, Screen, useConfirm } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { Bar as ProgressBar, DotRing, LogSheet } from '@/components/Widgets';
import { colours, radius, space } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { PERIOD_WORD, SOURCE_LABEL, archiveTracker, deleteTracker, fmt, goalLine, isProPlan, logTracker, progress, reloadHq, unitOf, useHq, type Tracker } from '@/lib/widgets';
import { chart, dateOf, pace, records, shift, streaks, todayKey, valueOn, type Bar, type Days } from '@/lib/trackerMath';

type Entry = { id: string; amount: number; day: string; note: string | null; source: string; created_at: string };
type Read = { id: string; kind: string; for_date: string; body: string; thumbs: number | null };
type Span = 'week' | 'month' | 'year' | 'all';
const SPANS: { key: Span; label: string }[] = [{ key: 'week', label: 'Week' }, { key: 'month', label: 'Month' }, { key: 'year', label: 'Year' }, { key: 'all', label: 'All' }];
const nice = (k: string) => dateOf(k).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
const longDate = (k: string) => dateOf(k).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
const input = { backgroundColor: colours.sunk, borderWidth: 1, borderColor: colours.border, borderRadius: radius.input, color: colours.text, fontSize: 16, paddingHorizontal: 14, paddingVertical: 11 } as const;

export default function TrackerPage() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const hq = useHq();
  const tr = hq.trackers.find((t) => t.id === id);
  const free = hq.plan === 'free';
  const pro = isProPlan(hq.plan);
  const [full, setFull] = useState<{ days: Days; before: number; teamDays?: Days; teamBefore?: number; people: { name: string; amount: number }[] } | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [reads, setReads] = useState<Read[]>([]);
  const [span, setSpan] = useState<Span>('week');
  const [log, setLog] = useState(false);
  const [edit, setEdit] = useState<Entry | null>(null);
  const [err, setErr] = useState('');
  const [asking, setAsking] = useState(false);
  const [more, setMore] = useState(false);
  const { armed, confirm } = useConfirm();
  const today = todayKey();

  const load = useCallback(async () => {
    if (!id) return;
    const [f, e, r] = await Promise.all([
      supabase.rpc('my_tracker', { p_tracker: id, p_today: todayKey() }),
      supabase.from('tracker_entries').select('id, amount, day, note, source, created_at').eq('tracker_id', id).order('day', { ascending: false }).order('created_at', { ascending: false }).limit(300),
      supabase.from('tracker_reads').select('id, kind, for_date, body, thumbs').eq('tracker_id', id).order('created_at', { ascending: false }).limit(3),
    ]);
    const d = f.data as any;
    const nums = (o: any): Days => Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [k, Number(v)]));
    if (d) setFull({ days: nums(d.mine?.days), before: Number(d.mine?.before ?? 0), teamDays: d.everyone ? nums(d.everyone.days) : undefined, teamBefore: d.everyone ? Number(d.everyone.before ?? 0) : undefined, people: ((d.people ?? []) as any[]).map((p) => ({ name: String(p.name), amount: Number(p.amount) })) });
    setEntries((((e.data as any[]) ?? []) as Entry[]).map((x) => ({ ...x, amount: Number(x.amount) })));
    setReads(((r.data as any[]) ?? []) as Read[]);
  }, [id]);
  useFocusLoad(load, 1500);
  useEffect(() => { setFull(null); setEntries([]); setReads([]); setSpan('week'); setErr(''); }, [id]);

  if (!tr) {
    return (
      <Screen>
        <BackLink onPress={() => router.navigate('/')} label="Today" />
        {hq.loaded ? <Card><Text style={{ color: colours.muted }}>That tracker is not here any more.</Text></Card> : <ActivityIndicator color={colours.purple} style={{ marginTop: 40 }} />}
      </Screen>
    );
  }

  // The numbers this page draws: the team's for a team tracker, otherwise mine.
  const team = tr.team;
  const days = team ? full?.teamDays ?? tr.teamDays ?? {} : full?.days ?? tr.days;
  const before = team ? full?.teamBefore ?? tr.teamBefore ?? 0 : full?.before ?? tr.before;
  const value = valueOn(tr, days, before, today);
  const pct = progress(tr, value);
  const unit = unitOf(tr);
  const st = streaks(tr, days, today);
  const rec = records(tr, days, today);
  const pc = pace(tr, days, before, today);
  const bars = chart(tr, days, before, today, free ? 'week' : span);
  const doneToday = tr.type === 'yesno' && !!tr.days[today];
  const mineOnly = tr.sharedIn;   // a teammate on someone else's team tracker: can log, cannot change it

  const quick = () => {
    setErr('');
    const after = () => load();
    if (tr.type === 'yesno') logTracker(tr.id, doneToday ? 0 : 1).then(after, (e) => setErr(e.message));
    else if (tr.type === 'scale' || tr.step == null) setLog(true);
    else logTracker(tr.id, tr.step).then(after, (e) => setErr(e.message));
  };

  async function askWhy() {
    setAsking(true); setErr('');
    try {
      const { data, error } = await supabase.functions.invoke('tali-tracker-why', { body: { tracker_id: tr!.id, today } });
      if (error || (data as any)?.error) throw new Error((data as any)?.message || 'Tali could not write that just now. No credit was used.');
      await load();
    } catch (e: any) { setErr(e?.message ?? 'Tali could not write that just now.'); }
    setAsking(false);
  }
  async function thumb(r: Read, v: 1 | -1) {
    setReads((rs) => rs.map((x) => (x.id === r.id ? { ...x, thumbs: x.thumbs === v ? null : v } : x)));
    await supabase.from('tracker_reads').update({ thumbs: r.thumbs === v ? null : v }).eq('id', r.id);
  }
  async function exportCsv() {
    const rows = [['Day', 'Amount', 'Note', 'How it got here'], ...entries.slice().reverse().map((e) => [e.day, String(e.amount), (e.note ?? '').replace(/"/g, '""'), e.source === 'tali' ? 'Tali' : e.source === 'auto' ? 'Automatic' : 'Tap'])];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    if (Platform.OS === 'web') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = `${tr!.name.replace(/[^\w]+/g, '-').toLowerCase()}.csv`;
      a.click();
    } else await Share.share({ title: `${tr!.name}.csv`, message: csv }).catch(() => {});
  }

  const read = reads[0];
  const max = Math.max(...bars.map((b) => b.value), tr.period === 'total' && !tr.countDown && tr.target && tr.target <= Math.max(...bars.map((b) => b.value), 0) * 1.25 ? tr.target : 0, tr.period === 'day' && (free || span !== 'year') && span !== 'all' ? tr.target ?? 0 : 0, 0) || 1;
  const min = tr.period === 'total' ? Math.min(...bars.filter((b) => b.value).map((b) => b.value), max) * 0.9 : 0;
  // A goal in total only gets its line once the chart is within reach of it, so the points are not squashed flat.
  const rawMax = Math.max(...bars.map((b) => b.value), 0);
  const targetLine = tr.target && ((tr.period === 'day' && (span === 'week' || span === 'month' || free)) || (tr.period === 'total' && !tr.countDown && tr.target <= rawMax * 1.25)) ? tr.target : null;
  const H = 150;

  return (
    <Screen onRefresh={async () => { await reloadHq(); await load(); }}>
      <BackLink onPress={() => router.navigate('/')} label="Today" />

      {/* 1. Where you are at */}
      <View style={{ backgroundColor: colours.surface, borderRadius: 24, borderWidth: 1, borderColor: tr.colour + '88', padding: 18, marginBottom: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tr.colour }} />
          <Text numberOfLines={1} style={{ flex: 1, color: colours.muted, fontSize: 14, fontWeight: '700' }}>{tr.name}{team ? `  ·  ${tr.sharedIn ? tr.ownerName ?? 'Team' : 'Team tracker'}` : ''}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 }}>
          {tr.type !== 'scale' && (tr.target || tr.countDown) ? (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <DotRing pct={pct} colour={tr.colour} size={84} n={32} />
              <Text style={{ position: 'absolute', color: colours.text, fontWeight: '800', fontSize: 16 }}>{Math.round(Math.max(0, pct) * 100)}%</Text>
            </View>
          ) : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: colours.text, fontSize: fmt(tr, value).length > 9 ? 26 : fmt(tr, value).length > 6 ? 32 : 40, fontWeight: '800', letterSpacing: -1 }}>
              {fmt(tr, value)}{unit ? <Text style={{ fontSize: 16, color: colours.muted, fontWeight: '700' }}> {unit}</Text> : null}
            </Text>
            <Text style={{ color: colours.faint, fontSize: 13 }}>
              {tr.countDown ? `left of ${fmt(tr, tr.startValue)}` : tr.target ? `of ${tr.type === 'money' ? fmt(tr, tr.target) : `${tr.target.toLocaleString('en-AU')} ${unit}`.trim()} ${PERIOD_WORD[tr.period]}` : PERIOD_WORD[tr.period]}
              {team ? `  ·  you ${fmt(tr, tr.value)}` : ''}
            </Text>
          </View>
          <Pressable onPress={quick} onLongPress={() => setLog(true)} delayLongPress={350} accessibilityRole="button" accessibilityLabel={tr.type === 'yesno' ? (doneToday ? 'Untick today' : 'Tick today') : 'Log. Hold for an amount'}
            style={{ width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: doneToday ? colours.good : tr.colour }}>
            <Ionicons name={tr.type === 'yesno' ? 'checkmark' : 'add'} size={30} color="#141033" />
          </Pressable>
        </View>
        {tr.target || tr.countDown ? <View style={{ marginTop: 12 }}><ProgressBar pct={pct} colour={tr.colour} /></View> : null}
        <Text style={{ color: colours.faint, fontSize: 12, marginTop: 8 }}>
          {tr.type === 'yesno' ? 'Tap to tick today.' : tr.step != null && tr.type !== 'scale' ? `Tap + to add ${fmt(tr, tr.step)}${unit ? ` ${unit}` : ''}. Hold + for another amount or another day.` : 'Tap + to log.'}
          {tr.source !== 'manual' ? `  Fills itself in from ${SOURCE_LABEL[tr.source].toLowerCase()}.` : ''}
        </Text>
        <Pressable onPress={() => setLog(true)} hitSlop={6} style={{ marginTop: 6, alignSelf: 'flex-start' }}><Text style={{ color: colours.purple, fontWeight: '700', fontSize: 13 }}>Log an amount or a past day ›</Text></Pressable>
      </View>
      <ErrorText>{err}</ErrorText>

      {/* 2. Why it changed (Pro and up), and Ask why on any paid plan */}
      {!free ? (
        <View style={{ backgroundColor: colours.sunk, borderRadius: radius.card, borderWidth: 1, borderColor: colours.purple, padding: 14, marginBottom: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Ionicons name="sparkles" size={15} color={colours.purple} />
            <Text style={{ flex: 1, color: colours.purpleInk, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 }}>WHY IT CHANGED</Text>
            {read ? <Text style={{ color: colours.faint, fontSize: 11.5 }}>{nice(read.for_date)}</Text> : null}
          </View>
          {read ? (
            <>
              <Text style={{ color: colours.text, fontSize: 15, lineHeight: 22 }}>{read.body}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 }}>
                <Pressable onPress={() => thumb(read, 1)} hitSlop={8} accessibilityLabel="This was useful"><Ionicons name={read.thumbs === 1 ? 'thumbs-up' : 'thumbs-up-outline'} size={18} color={read.thumbs === 1 ? colours.good : colours.faint} /></Pressable>
                <Pressable onPress={() => thumb(read, -1)} hitSlop={8} accessibilityLabel="This was not useful"><Ionicons name={read.thumbs === -1 ? 'thumbs-down' : 'thumbs-down-outline'} size={18} color={read.thumbs === -1 ? colours.danger : colours.faint} /></Pressable>
                <View style={{ flex: 1 }} />
              </View>
            </>
          ) : (
            <Text style={{ color: colours.muted, fontSize: 14, lineHeight: 20 }}>{pro ? (hq.plan === 'pro' ? 'Tali writes a read on this each Monday with your brief, once it has a couple of weeks to go on.' : 'Tali writes a read on this each morning with your brief, once it has a few days to go on.') : 'A weekly read from Tali comes with Pro. On your plan you can ask for one any time.'}</Text>
          )}
          <Pressable onPress={asking ? undefined : askWhy} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start', paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colours.purpleSoft, borderWidth: 1, borderColor: colours.border, opacity: asking ? 0.6 : 1 }}>
            {asking ? <ActivityIndicator size="small" color={colours.purple} /> : <Ionicons name="help-circle-outline" size={15} color={colours.purpleInk} />}
            <Text style={{ color: colours.purpleInk, fontWeight: '800', fontSize: 13 }}>Ask why now</Text>
            <Text style={{ color: colours.faint, fontSize: 12 }}>Uses 1 credit</Text>
          </Pressable>
        </View>
      ) : null}

      {/* 3. Range, 4. the chart */}
      <View style={{ flexDirection: 'row', backgroundColor: 'rgba(12,10,36,0.78)', borderRadius: radius.pill, padding: 4, borderWidth: 1, borderColor: colours.border, marginBottom: space.md }}>
        {SPANS.map((s) => {
          const on = (free ? 'week' : span) === s.key, lock = free && s.key !== 'week';
          return (
            <Pressable key={s.key} onPress={() => (lock ? router.navigate('/plans') : setSpan(s.key))} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, flexDirection: 'row', gap: 4, paddingVertical: 8, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colours.purple : 'transparent' }}>
              {lock ? <Ionicons name="lock-closed" size={11} color={colours.orange} /> : null}
              <Text style={{ fontWeight: '800', fontSize: 13, color: on ? colours.onPurple : colours.muted }}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, padding: 14, marginBottom: space.md }}>
        {tr.type === 'yesno' ? <YesNoChart tr={tr} days={days} span={free ? 'week' : span} today={today} /> : (
          <View>
            <View style={{ height: H, flexDirection: 'row', alignItems: 'flex-end', gap: bars.length > 20 ? 2 : 6 }}>
              {targetLine ? (
                <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: Math.min(H - 1, ((targetLine - min) / (max - min || 1)) * H), borderTopWidth: 1, borderStyle: 'dashed', borderColor: colours.faint }}>
                  <Text style={{ position: 'absolute', right: 0, top: -15, color: colours.faint, fontSize: 10 }}>target {fmt(tr, targetLine)}</Text>
                </View>
              ) : null}
              {bars.map((b) => <ChartBar key={b.key} b={b} tr={tr} h={b.value ? Math.max(4, ((b.value - min) / (max - min || 1)) * H) : 0} line={tr.period === 'total' || tr.type === 'scale'} />)}
            </View>
            <View style={{ flexDirection: 'row', gap: bars.length > 20 ? 2 : 6, marginTop: 6 }}>
              {bars.map((b) => <Text key={b.key} numberOfLines={1} style={{ flex: 1, textAlign: 'center', color: b.now ? colours.text : colours.faint, fontSize: 10, fontWeight: b.now ? '800' : '400' }}>{b.label}</Text>)}
            </View>
          </View>
        )}
        <Text style={{ color: colours.faint, fontSize: 12, marginTop: 10 }}>
          {(free ? 'week' : span) === 'week' ? 'This week, by day' : span === 'month' ? 'The last 30 days' : span === 'year' ? 'The last 12 months' : 'By month, since you started'}
          {tr.period === 'total' ? ', where it stood' : tr.type === 'scale' ? ', your average' : ''}.{free ? ' Free shows the last 7 days.' : ''}
        </Text>
      </View>

      {/* 5. Streaks and records */}
      <Label>Streaks and records</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space.md }}>
        <Stat label={tr.period === 'total' || tr.period === 'month' ? 'Logged in a row' : 'Current streak'} value={`${st.now}`} sub={st.unit === 'week' ? (st.now === 1 ? 'week' : 'weeks') : st.now === 1 ? 'day' : 'days'} colour={tr.colour} />
        {free ? (
          <Pressable onPress={() => router.navigate('/plans')} style={{ flexGrow: 1, flexBasis: '60%', backgroundColor: colours.sunk, borderRadius: 14, borderWidth: 1, borderColor: colours.border, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="lock-closed" size={14} color={colours.orange} />
            <Text style={{ flex: 1, color: colours.muted, fontSize: 12.5, lineHeight: 17 }}>Best streak, records, your pace and all of your history come with a paid plan.</Text>
          </Pressable>
        ) : (
          <>
            <Stat label={tr.period === 'total' || tr.period === 'month' ? 'Longest run' : 'Best streak'} value={`${st.best}`} sub={st.unit === 'week' ? (st.best === 1 ? 'week' : 'weeks') : st.best === 1 ? 'day' : 'days'} />
            {rec.hit ? <Stat label="Target hit" value={`${rec.hit.met} of ${rec.hit.of}`} sub={tr.period === 'week' ? 'weeks' : 'days'} /> : null}
            {rec.bestDay ? <Stat label="Best day" value={fmt(tr, rec.bestDay.value)} sub={nice(rec.bestDay.day)} /> : null}
            {rec.bestWeek ? <Stat label="Best week" value={tr.type === 'yesno' ? `${rec.bestWeek.value}` : fmt(tr, rec.bestWeek.value)} sub={`from ${nice(rec.bestWeek.week)}`} /> : null}
            {rec.average != null ? <Stat label={tr.type === 'scale' ? 'Average' : 'Average day'} value={fmt(tr, Number(rec.average.toFixed(1)))} sub="when you log" /> : null}
          </>
        )}
      </View>

      {/* 6. Pace toward a goal in total */}
      {!free && tr.period === 'total' && tr.target != null ? (
        <Card>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Ionicons name="trending-up" size={18} color={tr.colour} style={{ marginTop: 2 }} />
            <Text style={{ flex: 1, color: colours.text, fontSize: 15, lineHeight: 22 }}>
              {pct >= 1 ? 'You are there. Nice work.' : pc ? `At this pace you'll ${tr.countDown ? 'be down to' : 'hit'} ${fmt(tr, tr.target)}${unit ? ` ${unit}` : ''} on ${longDate(pc.lands)}. That is about ${fmt(tr, Number(pc.perWeek.toFixed(1)))}${unit ? ` ${unit}` : ''} a week over the last 8 weeks.` : 'Log a few times and your pace and landing date show here.'}
            </Text>
          </View>
        </Card>
      ) : null}

      {/* Team tracker: each person's share (the owner only) */}
      {team && !tr.sharedIn && full?.people.length ? (
        <>
          <Label>Who logged what, {PERIOD_WORD[tr.period]}</Label>
          <Card>
            {full.people.map((p, i) => (
              <View key={`${p.name}${i}`} style={{ paddingVertical: 7, borderTopWidth: i ? 1 : 0, borderTopColor: colours.border }}>
                <View style={{ flexDirection: 'row', marginBottom: 5 }}>
                  <Text style={{ flex: 1, color: colours.text, fontWeight: '700' }}>{p.name}</Text>
                  <Text style={{ color: colours.muted, fontWeight: '700' }}>{fmt(tr, p.amount)} {unit}</Text>
                </View>
                <ProgressBar pct={value ? p.amount / value : 0} colour={tr.colour} />
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {/* 7. Entries */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}><Label>{team ? 'Your entries' : 'Entries'}</Label></View>
        {entries.length ? (
          <Pressable onPress={() => (free ? router.navigate('/plans') : exportCsv())} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {free ? <Ionicons name="lock-closed" size={11} color={colours.orange} /> : <Ionicons name="download-outline" size={14} color={colours.purple} />}
            <Text style={{ color: free ? colours.faint : colours.purple, fontWeight: '700', fontSize: 13 }}>Export CSV</Text>
          </Pressable>
        ) : null}
      </View>
      {entries.length ? (
        <Card style={{ paddingVertical: 4 }}>
          {entries.slice(0, more ? 60 : 8).map((e, i) => (
            <Pressable key={e.id} onPress={() => setEdit(e)} accessibilityRole="button" accessibilityLabel={`Entry on ${nice(e.day)}. Edit`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colours.border }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colours.text, fontSize: 15, fontWeight: '700' }}>{tr.type === 'yesno' ? (e.amount ? 'Done' : 'Not done') : tr.type === 'scale' ? `${e.amount} out of 5` : `${tr.countDown ? '-' : ''}${fmt(tr, e.amount)}${unit ? ` ${unit}` : ''}`}</Text>
                <Text numberOfLines={1} style={{ color: colours.faint, fontSize: 12 }}>{e.day === today ? 'Today' : e.day === shift(today, -1) ? 'Yesterday' : nice(e.day)}, {new Date(e.created_at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}  ·  {e.source === 'tali' ? 'told Tali' : e.source === 'auto' ? 'automatic' : 'tap'}{e.note ? `  ·  ${e.note}` : ''}</Text>
              </View>
              <Ionicons name="create-outline" size={16} color={colours.faint} />
            </Pressable>
          ))}
          {entries.length > 8 ? (
            <Pressable onPress={() => setMore(!more)} hitSlop={6} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: colours.border }}>
              <Text style={{ color: colours.purple, fontWeight: '700', fontSize: 13 }}>{more ? 'Show fewer' : `Show more (${entries.length} in all)`}</Text>
            </Pressable>
          ) : null}
          {more && entries.length > 60 ? <Text style={{ color: colours.faint, fontSize: 12, paddingBottom: 8 }}>Showing the latest 60. Export has all of them.</Text> : null}
        </Card>
      ) : (
        <Card><Text style={{ color: colours.muted }}>{tr.source !== 'manual' ? 'Nothing logged by hand. The numbers above come in by themselves.' : 'Nothing logged yet. Tap + to start.'}</Text></Card>
      )}

      {/* 8. Settings */}
      {!mineOnly ? (
        <>
          <Label>This tracker</Label>
          <Card style={{ paddingVertical: 2 }}>
            <Row icon="create-outline" title="Edit tracker" sub={`${goalLine(tr)}. Name, target, look, rest day, which home.`} onPress={() => router.navigate(`/widget-new?edit=${tr.id}&back=tracker` as any)} first />
            <Row icon="archive-outline" title={armed === 'archive' ? 'Tap again to archive' : 'Archive'} sub="Takes it off your home. The history is kept." onPress={() => confirm('archive', () => archiveTracker(tr.id).then(() => router.navigate('/'), (e) => setErr(e.message)))} />
            <Row icon="trash-outline" title={armed === 'delete' ? 'Tap again to delete for good' : 'Delete'} sub="Removes the tracker and every entry. This cannot be undone." danger onPress={() => confirm('delete', () => deleteTracker(tr.id).then(() => router.navigate('/'), (e) => setErr(e.message)))} />
          </Card>
        </>
      ) : null}
      <View style={{ height: space.xl }} />

      <LogSheet tr={tr} visible={log} onClose={() => setLog(false)} onDone={load} />
      <EntrySheet tr={tr} entry={edit} onClose={() => setEdit(null)} onDone={async () => { setEdit(null); await reloadHq(); await load(); }} />
    </Screen>
  );
}

function Stat({ label, value, sub, colour }: { label: string; value: string; sub?: string; colour?: string }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: '30%', backgroundColor: colours.surface, borderRadius: 14, borderWidth: 1, borderColor: colour ? colour + '88' : colours.border, padding: 12 }}>
      <Text numberOfLines={1} style={{ color: colours.muted, fontSize: 11.5, fontWeight: '700' }}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colours.text, fontSize: 22, fontWeight: '800', marginTop: 2 }}>{value}</Text>
      {sub ? <Text numberOfLines={1} style={{ color: colours.faint, fontSize: 11.5 }}>{sub}</Text> : null}
    </View>
  );
}

function Row({ icon, title, sub, onPress, first, danger }: { icon: any; title: string; sub: string; onPress: () => void; first?: boolean; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderTopColor: colours.border }}>
      <Ionicons name={icon} size={19} color={danger ? colours.danger : colours.purple} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? colours.danger : colours.text, fontSize: 15, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: colours.muted, fontSize: 12.5, marginTop: 1, lineHeight: 17 }}>{sub}</Text>
      </View>
    </Pressable>
  );
}

/** One column of the chart. A total or a 1 to 5 draws as a line of points, the rest as bars. */
function ChartBar({ b, tr, h, line }: { b: Bar; tr: Tracker; h: number; line: boolean }) {
  if (line) {
    return (
      <View style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
        {h ? (
          <View style={{ width: '100%', height: h, alignItems: 'center' }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: tr.colour, marginTop: -4, borderWidth: b.now ? 2 : 0, borderColor: '#fff' }} />
            <View style={{ flex: 1, width: '100%', backgroundColor: tr.colour + '26', borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
          </View>
        ) : null}
      </View>
    );
  }
  const met = tr.period === 'day' && tr.target ? b.value >= tr.target : false;
  return (
    <View style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}>
      <View style={{ height: h, borderRadius: 4, backgroundColor: b.now || met ? tr.colour : tr.colour + '77' }} />
    </View>
  );
}

/** Yes or no: seven dots for a week, a calendar of filled days for a month, a grid of weeks for a year. */
function YesNoChart({ tr, days, span, today }: { tr: Tracker; days: Days; span: Span; today: string }) {
  const D = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const dow = (k: string) => (dateOf(k).getDay() + 6) % 7;
  if (span === 'week') {
    const start = shift(today, -dow(today));
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {D.map((d, i) => {
          const k = shift(start, i);
          return (
            <View key={i} style={{ alignItems: 'center', gap: 6 }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: days[k] ? tr.colour : 'rgba(255,255,255,0.10)', borderWidth: k === today ? 2 : 0, borderColor: colours.text }}>
                {days[k] ? <Ionicons name="checkmark" size={18} color="#141033" /> : null}
              </View>
              <Text style={{ color: k === today ? colours.text : colours.faint, fontSize: 11, fontWeight: k === today ? '800' : '400' }}>{d}</Text>
            </View>
          );
        })}
      </View>
    );
  }
  const weeks = span === 'month' ? 5 : span === 'year' ? 52 : 26;
  const start = shift(shift(today, -dow(today)), -7 * (weeks - 1));
  if (span === 'month') {
    return (
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row' }}>{D.map((d, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', color: colours.faint, fontSize: 11 }}>{d}</Text>)}</View>
        {Array.from({ length: weeks }, (_, w) => (
          <View key={w} style={{ flexDirection: 'row' }}>
            {D.map((_, i) => {
              const k = shift(start, w * 7 + i);
              return (
                <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                  <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: k > today ? 'transparent' : days[k] ? tr.colour : 'rgba(255,255,255,0.08)', borderWidth: k === today ? 2 : 0, borderColor: colours.text }}>
                    <Text style={{ color: days[k] ? '#141033' : colours.faint, fontSize: 11, fontWeight: '700' }}>{k > today ? '' : dateOf(k).getDate()}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {Array.from({ length: weeks }, (_, w) => (
        <View key={w} style={{ flex: 1, gap: 2 }}>
          {D.map((_, i) => {
            const k = shift(start, w * 7 + i);
            return <View key={i} style={{ aspectRatio: 1, borderRadius: 2, backgroundColor: k > today ? 'transparent' : days[k] ? tr.colour : 'rgba(255,255,255,0.08)' }} />;
          })}
        </View>
      ))}
    </View>
  );
}

/** Fix or remove one entry. */
function EntrySheet({ tr, entry, onClose, onDone }: { tr: Tracker; entry: Entry | null; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(''); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const { armed, confirm } = useConfirm();
  useEffect(() => { setAmount(entry ? String(entry.amount) : ''); setNote(entry?.note ?? ''); setErr(''); }, [entry]);
  if (!entry) return null;
  async function save() {
    const n = Number(amount.replace(/,/g, ''));
    if (!Number.isFinite(n)) return setErr('Type an amount.');
    setBusy(true);
    const { error } = await supabase.from('tracker_entries').update({ amount: tr.type === 'yesno' ? (n > 0 ? 1 : 0) : tr.type === 'scale' ? Math.max(1, Math.min(5, Math.round(n))) : n, note: note.trim() || null }).eq('id', entry!.id);
    setBusy(false);
    if (error) return setErr('Could not save that entry.');
    onDone();
  }
  async function remove() {
    setBusy(true);
    const { error } = await supabase.from('tracker_entries').delete().eq('id', entry!.id);
    setBusy(false);
    if (error) return setErr('Could not remove that entry.');
    onDone();
  }
  return (
    <Sheet visible title="Edit entry" sub={`${tr.name}, ${nice(entry.day)}`} onClose={onClose}>
      {tr.type === 'yesno' ? (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: space.md }}>
          {[['1', 'Done'], ['0', 'Not done']].map(([v, l]) => (
            <Pressable key={v} onPress={() => setAmount(v)} style={{ flex: 1, paddingVertical: 12, borderRadius: radius.input, alignItems: 'center', borderWidth: 1, borderColor: Number(amount) === Number(v) ? colours.purple : colours.border, backgroundColor: Number(amount) === Number(v) ? colours.purpleSoft : 'transparent' }}>
              <Text style={{ color: colours.text, fontWeight: '700' }}>{l}</Text>
            </Pressable>
          ))}
        </View>
      ) : <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={[input, { marginBottom: space.sm }]} accessibilityLabel="Amount" />}
      <TextInput value={note} onChangeText={setNote} placeholder="Add a note (optional)" placeholderTextColor={colours.faint} maxLength={300} style={[input, { marginBottom: space.md, fontSize: 15 }]} />
      <ErrorText>{err}</ErrorText>
      <Button title="Save" onPress={save} busy={busy} />
      <Button kind="danger" title={armed === 'del' ? 'Tap again to remove it' : 'Remove this entry'} onPress={() => confirm('del', remove)} disabled={busy} />
    </Sheet>
  );
}
