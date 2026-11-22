// components/HqBlocks.tsx
// ADDED (17 Nov 2026, Taj): the newer blocks on a Build your HQ home. Invoices, Jobs on, Bills
// coming up and Tali's pick, plus the seven Business blocks (Team, Leads, Cash flow, Bookings
// today, Website visits, Quote win rate, Customer happiness). Every block that has nothing to
// show yet says how to start in one line, so there is never an empty box.
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colours, headingSemi, radius, space } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { Sheet } from '@/components/Sheet';
import { Button, ErrorText } from '@/components/ui';
import { money0, type MoneyPicture } from '@/lib/money';
import { cents, type PersonalMoney } from '@/lib/personalMoney';
import { addReview, markReplied, type Board } from '@/lib/hqBoard';
import { BUILTINS, seenNote, type BuiltIn, type HomeNote } from '@/lib/widgets';
import { daysBetween, todayKey } from '@/lib/trackerMath';

const box = { backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, padding: 14, width: '100%' } as const;
const go = (to: string, params?: Record<string, string>) => () => router.navigate((params ? { pathname: to, params } : to) as any);

export function BlockLabel({ children, pin, right }: { children: ReactNode; pin?: boolean; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 10, width: '100%' }}>
      {/* Same heading as the rest of the app (Label in components/ui.tsx). */}
      <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 24, color: colours.text, ...headingSemi }}>{children}</Text>
      {pin ? <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(127,168,255,0.6)', backgroundColor: 'rgba(127,168,255,0.14)' }}><Text style={{ color: '#3B3F9E', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 }}>PINNED</Text></View> : null}
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

/** One line on how to get going, for a block with nothing in it yet. */
export function StartHint({ builtin, to, cta }: { builtin: BuiltIn; to?: string; cta?: string }) {
  return (
    <Pressable onPress={to ? go(to) : undefined} accessibilityRole={to ? 'button' : undefined} style={[box, { backgroundColor: colours.sunk, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
      <Text style={{ flex: 1, color: colours.muted, fontSize: 13.5, lineHeight: 19 }}>{BUILTINS[builtin].hint}</Text>
      {to ? <Text style={{ color: colours.purple, fontWeight: '800', fontSize: 13 }}>{cta ?? 'Open'} ›</Text> : null}
    </Pressable>
  );
}

function Num({ label, value, colour = colours.text, hint, onPress }: { label: string; value: string; colour?: string; hint?: string | null; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={{ color: colours.muted, fontSize: 12, fontWeight: '700' }}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colour, fontSize: 24, fontWeight: '800', marginTop: 2 }}>{value}</Text>
      {hint ? <Text numberOfLines={1} style={{ color: colours.faint, fontSize: 11.5, marginTop: 1 }}>{hint}</Text> : null}
    </Pressable>
  );
}
const Line = () => <View style={{ height: 1, backgroundColor: colours.border, marginVertical: 10 }} />;

export function InvoicesBlock({ money }: { money: MoneyPicture | null }) {
  if (!money || (!money.owed && !money.overdue)) return <StartHint builtin="invoices" to="/invoices" />;
  return (
    <Pressable onPress={go('/invoices')} accessibilityRole="button" style={box}>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Num label="Owed to you" value={money0(money.owed)} />
        <Num label="Late" value={money0(money.overdue)} colour={money.overdue > 0 ? colours.danger : colours.good} />
      </View>
      {money.overdueInvoices.slice(0, 3).map((i) => (
        <View key={i.id} style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Text numberOfLines={1} style={{ flex: 1, color: colours.text, fontSize: 14 }}>{i.client_name || 'Invoice'} <Text style={{ color: colours.faint }}>#{i.number}</Text></Text>
          <Text style={{ color: colours.danger, fontSize: 14, fontWeight: '700' }}>{money0(i.total)}</Text>
        </View>
      ))}
    </Pressable>
  );
}

type JobRow = { id: string; title: string; client_name: string | null; status: string };
export function JobsBlock({ tick }: { tick: number }) {
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  useEffect(() => {
    let live = true;
    supabase.from('jobs').select('id, title, client_name, status').in('status', ['accepted', 'on']).order('updated_at', { ascending: false }).limit(5)
      .then(({ data }) => { if (live) setJobs((data as JobRow[]) ?? []); }, () => { if (live) setJobs([]); });
    return () => { live = false; };
  }, [tick]);
  if (jobs && !jobs.length) return <StartHint builtin="jobs" to="/jobs" />;
  return (
    <Pressable onPress={go('/jobs')} accessibilityRole="button" style={box}>
      {(jobs ?? []).map((j, i) => (
        <View key={j.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderTopWidth: i ? 1 : 0, borderTopColor: colours.border }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: j.status === 'on' ? colours.good : colours.orange }} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: colours.text, fontSize: 15, fontWeight: '700' }}>{j.title}</Text>
            {j.client_name ? <Text numberOfLines={1} style={{ color: colours.faint, fontSize: 12 }}>{j.client_name}</Text> : null}
          </View>
          <Text style={{ color: colours.muted, fontSize: 12, fontWeight: '700' }}>{j.status === 'on' ? 'On now' : 'Booked in'}</Text>
        </View>
      ))}
      {!jobs ? <Text style={{ color: colours.faint }}>Loading your jobs</Text> : null}
    </Pressable>
  );
}

export function BillsBlock({ pm }: { pm: PersonalMoney | null }) {
  const today = todayKey();
  const soon = (pm?.repeats ?? []).map((r) => ({ ...r, days: daysBetween(today, r.next_date) })).filter((r) => r.days <= 30).sort((a, b) => a.days - b.days);
  if (!soon.length) return <StartHint builtin="bills" to="/money?side=personal" />;
  const total = soon.reduce((s, r) => s + r.amount, 0);
  return (
    <Pressable onPress={go('/money', { side: 'personal' })} accessibilityRole="button" style={box}>
      <Text style={{ color: colours.text, fontSize: 24, fontWeight: '800' }}>{cents(total)}</Text>
      <Text style={{ color: colours.faint, fontSize: 12, marginBottom: 6 }}>in the next 30 days, {soon.length} {soon.length === 1 ? 'bill' : 'bills'}</Text>
      {soon.slice(0, 4).map((r) => (
        <View key={r.id} style={{ flexDirection: 'row', gap: 8, paddingVertical: 5 }}>
          <Text numberOfLines={1} style={{ flex: 1, color: colours.text, fontSize: 14 }}>{r.description}</Text>
          <Text style={{ color: r.days <= 3 ? colours.orange : colours.muted, fontSize: 13 }}>{r.days < 0 ? 'overdue' : r.days === 0 ? 'today' : r.days === 1 ? 'tomorrow' : `in ${r.days} days`}</Text>
          <Text style={{ color: colours.text, fontSize: 14, fontWeight: '700', minWidth: 70, textAlign: 'right' }}>{cents(r.amount)}</Text>
        </View>
      ))}
    </Pressable>
  );
}

/** Her one pick for the day. Written with the morning brief, so it never costs credits here. */
export function TaliPickBlock({ note }: { note: HomeNote | undefined }) {
  if (!note) return <StartHint builtin="tali_pick" />;
  return (
    <View style={[box, { borderColor: colours.purple, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }]}>
      <Ionicons name="sparkles" size={18} color={colours.purple} style={{ marginTop: 2 }} />
      <Text style={{ flex: 1, color: colours.text, fontSize: 15.5, lineHeight: 22 }}>{note.body}</Text>
    </View>
  );
}

/** A nudge or a "your team home changed" note. Tap the cross and it is gone. */
export function NoteStrip({ note }: { note: HomeNote }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: note.kind === 'team' ? 'rgba(127,168,255,0.14)' : colours.orangeSoft, borderRadius: 14, borderWidth: 1, borderColor: note.kind === 'team' ? 'rgba(127,168,255,0.5)' : 'rgba(255,181,97,0.5)', paddingVertical: 10, paddingHorizontal: 12, marginTop: space.sm, width: '100%' }}>
      <Ionicons name={note.kind === 'team' ? 'people-outline' : 'notifications-outline'} size={16} color={note.kind === 'team' ? '#3B3F9E' : colours.orange} />
      <Text style={{ flex: 1, color: colours.text, fontSize: 13.5, lineHeight: 19 }}>{note.body}</Text>
      <Pressable onPress={() => seenNote(note.id)} hitSlop={10} accessibilityLabel="Dismiss"><Ionicons name="close" size={16} color={colours.faint} /></Pressable>
    </View>
  );
}

// ── The Business blocks ─────────────────────────────────────────────────────────────────
export function TeamBlock({ board }: { board: Board }) {
  const people = board.team?.people ?? [];
  if (!people.length) return <StartHint builtin="team" to="/team" cta="Your team" />;
  const stuck = people.reduce((s, p) => s + p.overdue, 0);
  return (
    <Pressable onPress={go('/team')} accessibilityRole="button" style={box}>
      {people.slice(0, 6).map((p, i) => (
        <View key={`${p.name}${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderTopWidth: i ? 1 : 0, borderTopColor: colours.border }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colours.purpleSoft, borderWidth: 1, borderColor: colours.border }}>
            <Text style={{ color: colours.purpleInk, fontWeight: '800', fontSize: 12 }}>{p.name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: colours.text, fontSize: 15, fontWeight: '700' }}>{p.name}{p.me ? ' (you)' : ''}</Text>
            <Text numberOfLines={1} style={{ color: colours.faint, fontSize: 12 }}>{p.status === 'invited' ? 'Invited, not joined yet' : p.jobs.length ? p.jobs.slice(0, 2).join(', ') : p.tasks_open ? `${p.tasks_open} ${p.tasks_open === 1 ? 'task' : 'tasks'} open` : 'Nothing on right now'}</Text>
          </View>
          {p.overdue ? <Text style={{ color: colours.orange, fontSize: 12, fontWeight: '800' }}>{p.overdue} overdue</Text> : p.jobs.length ? <Text style={{ color: colours.good, fontSize: 12, fontWeight: '800' }}>{p.jobs.length} on</Text> : null}
        </View>
      ))}
      {stuck ? <Text style={{ color: colours.orange, fontSize: 12.5, fontWeight: '700', marginTop: 8 }}>{stuck} {stuck === 1 ? 'task is' : 'tasks are'} past due</Text> : null}
    </Pressable>
  );
}

export function LeadsBlock({ board }: { board: Board }) {
  const l = board.leads;
  if (!l || (!l.new && !l.talking && !l.new_week && !l.won_month)) return <StartHint builtin="leads" to="/pipeline" />;
  return (
    <Pressable onPress={go('/pipeline')} accessibilityRole="button" style={box}>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Num label="New this week" value={String(l.new_week)} />
        <Num label="Need a reply" value={String(l.need_reply)} colour={l.need_reply ? colours.orange : colours.good} />
        <Num label="Won this month" value={String(l.won_month)} colour={colours.good} />
      </View>
      <Line />
      <Text style={{ color: colours.muted, fontSize: 13 }}>{l.new} new  ·  {l.talking} talking{l.names.length ? `  ·  ${l.names.join(', ')}` : ''}</Text>
    </Pressable>
  );
}

export function CashflowBlock({ board }: { board: Board }) {
  const c = board.cashflow;
  if (!c || (!c.in_month && !c.out_month && !c.owed)) return <StartHint builtin="cashflow" to="/money" />;
  const net = c.in_month - c.out_month;
  const next = c.due_30 - (c.costs_month ?? 0);
  return (
    <Pressable onPress={go('/money')} accessibilityRole="button" style={box}>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Num label="In this month" value={money0(c.in_month)} colour={colours.good} />
        <Num label="Out this month" value={money0(c.out_month)} hint="from your receipts" />
      </View>
      <Line />
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Num label="Owed to you" value={money0(c.owed)} hint={c.late ? `${money0(c.late)} is late` : 'Nobody is late'} colour={c.late ? colours.orange : colours.text} />
        <Num label="Next 30 days" value={`${next < 0 ? '-' : ''}${money0(Math.abs(next))}`} hint={c.costs_month ? 'invoices due, less your costs' : 'invoices due in'} colour={next < 0 ? colours.danger : colours.text} />
      </View>
      <Text style={{ color: colours.faint, fontSize: 12, marginTop: 8 }}>{net >= 0 ? `${money0(net)} ahead this month so far.` : `${money0(-net)} behind this month so far.`}</Text>
    </Pressable>
  );
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).replace(/\s/g, ' ').toLowerCase();
export function BookingsBlock({ board }: { board: Board }) {
  const b = board.bookings;
  if (!b || (!b.today.length && !b.requested && !b.week)) return <StartHint builtin="bookings" to="/bookings" />;
  // The gaps between today's bookings: anything of 45 minutes or more is worth knowing about.
  const rows: ({ gap: number; from: string } | (typeof b.today)[number])[] = [];
  b.today.forEach((x, i) => {
    if (i) {
      const prev = b.today[i - 1];
      const end = new Date(prev.starts_at).getTime() + prev.minutes * 60000;
      const gap = Math.round((new Date(x.starts_at).getTime() - end) / 60000);
      if (gap >= 45) rows.push({ gap, from: new Date(end).toISOString() });
    }
    rows.push(x);
  });
  return (
    <Pressable onPress={go('/bookings')} accessibilityRole="button" style={box}>
      {b.today.length ? rows.map((x, i) => 'gap' in x ? (
        <Text key={`g${i}`} style={{ color: colours.faint, fontSize: 12, paddingVertical: 4, paddingLeft: 78 }}>{x.gap >= 60 ? `${Math.floor(x.gap / 60)} h${x.gap % 60 ? ` ${x.gap % 60} min` : ''}` : `${x.gap} min`} free from {hhmm(x.from)}</Text>
      ) : (
        <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
          <Text style={{ width: 68, color: colours.muted, fontSize: 13, fontWeight: '700' }}>{hhmm(x.starts_at)}</Text>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: colours.text, fontSize: 15, fontWeight: '700' }}>{x.client_name || x.title}</Text>
            <Text numberOfLines={1} style={{ color: colours.faint, fontSize: 12 }}>{x.title}  ·  {x.minutes} min</Text>
          </View>
          {x.status === 'requested' ? <Text style={{ color: colours.orange, fontSize: 12, fontWeight: '800' }}>Asked</Text> : x.status === 'done' ? <Ionicons name="checkmark-circle" size={18} color={colours.good} /> : null}
        </View>
      )) : <Text style={{ color: colours.muted, fontSize: 14 }}>Nothing booked today.</Text>}
      <Line />
      <Text style={{ color: colours.muted, fontSize: 13 }}>{b.week} booked this week{b.requested ? `  ·  ${b.requested} waiting on your yes` : ''}{b.cancelled ? `  ·  ${b.cancelled} cancelled today` : ''}</Text>
    </Pressable>
  );
}

export function VisitsBlock({ board }: { board: Board }) {
  const v = board.visits;
  if (!v || (!v.has_site && !v.week && !v.last_week)) return <StartHint builtin="visits" to="/website" />;
  const diff = v.last_week ? Math.round(((v.week - v.last_week) / v.last_week) * 100) : null;
  return (
    <Pressable onPress={go('/website')} accessibilityRole="button" style={box}>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Num label="Visits this week" value={v.week.toLocaleString('en-AU')} hint={diff === null ? 'Counting from today' : `${diff >= 0 ? 'up' : 'down'} ${Math.abs(diff)}% on last week`} colour={diff !== null && diff < 0 ? colours.orange : colours.text} />
        <Num label="Last week" value={v.last_week.toLocaleString('en-AU')} hint={v.top ? `Top page: ${v.top === '/' ? 'home' : v.top}` : null} />
      </View>
    </Pressable>
  );
}

export function QuoteRateBlock({ board }: { board: Board }) {
  const q = board.quote_rate;
  if (!q || !(q.won + q.lost + q.waiting)) return <StartHint builtin="quote_rate" to="/jobs" />;
  const decided = q.won + q.lost;
  const rate = decided ? Math.round((q.won / decided) * 100) : null;
  return (
    <Pressable onPress={go('/jobs')} accessibilityRole="button" style={box}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <Text style={{ color: colours.text, fontSize: 32, fontWeight: '800' }}>{rate === null ? 'No answer yet' : `${rate}%`}</Text>
        {rate !== null ? <Text style={{ color: colours.faint, fontSize: 12, marginBottom: 6 }}>of quotes won, last 90 days</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 8, backgroundColor: 'rgba(28,26,23,0.12)' }}>
        <View style={{ flex: q.won || 0.0001, backgroundColor: colours.good }} />
        <View style={{ flex: q.waiting || 0.0001, backgroundColor: colours.orange }} />
        <View style={{ flex: q.lost || 0.0001, backgroundColor: colours.danger }} />
      </View>
      <Text style={{ color: colours.muted, fontSize: 13, marginTop: 8 }}>{q.won} won  ·  {q.waiting} waiting  ·  {q.lost} lost{q.won_value ? `  ·  ${money0(q.won_value)} won` : ''}</Text>
    </Pressable>
  );
}

const Stars = ({ n, size = 13 }: { n: number; size?: number }) => (
  <View style={{ flexDirection: 'row', gap: 1 }}>{[1, 2, 3, 4, 5].map((i) => <Ionicons key={i} name={i <= Math.round(n) ? 'star' : 'star-outline'} size={size} color="#A8841C" />)}</View>
);

export function HappinessBlock({ board, onChanged, canEdit = true }: { board: Board; onChanged: () => void; canEdit?: boolean }) {
  const h = board.happiness;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(''); const [rating, setRating] = useState(5); const [body, setBody] = useState(''); const [place, setPlace] = useState('Google');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const input = { backgroundColor: colours.sunk, borderWidth: 1, borderColor: colours.border, borderRadius: radius.input, color: colours.text, fontSize: 15, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 } as const;
  async function save() {
    setBusy(true); setErr('');
    try { await addReview({ name, rating, body, place }); setOpen(false); setName(''); setBody(''); setRating(5); onChanged(); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }
  const add = canEdit ? <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityRole="button"><Text style={{ color: colours.purple, fontWeight: '800', fontSize: 13 }}>+ Log a review</Text></Pressable> : null;
  return (
    <View style={box}>
      {!h || !h.count ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ flex: 1, color: colours.muted, fontSize: 13.5, lineHeight: 19 }}>{BUILTINS.happiness.hint}</Text>
          {add}
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ color: colours.text, fontSize: 32, fontWeight: '800' }}>{h.average?.toFixed(1)}</Text>
            <View style={{ flex: 1 }}>
              <Stars n={h.average ?? 0} size={15} />
              <Text style={{ color: colours.faint, fontSize: 12, marginTop: 2 }}>{h.count} {h.count === 1 ? 'review' : 'reviews'}{h.no_reply ? `  ·  ${h.no_reply} with no reply yet` : ''}</Text>
            </View>
            {add}
          </View>
          {h.recent.map((r) => (
            <View key={r.id} style={{ borderTopWidth: 1, borderTopColor: colours.border, marginTop: 10, paddingTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Stars n={r.rating} />
                <Text numberOfLines={1} style={{ flex: 1, color: colours.muted, fontSize: 12.5, fontWeight: '700' }}>{r.name || 'A customer'}{r.place ? `, ${r.place}` : ''}</Text>
                {canEdit ? (
                  <Pressable onPress={() => markReplied(r.id, !r.replied).then(onChanged, () => {})} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: r.replied }}>
                    <Text style={{ color: r.replied ? colours.good : colours.orange, fontSize: 12, fontWeight: '800' }}>{r.replied ? 'Replied' : 'Mark replied'}</Text>
                  </Pressable>
                ) : null}
              </View>
              {r.body ? <Text numberOfLines={3} style={{ color: colours.text, fontSize: 14, lineHeight: 20, marginTop: 4 }}>{r.body}</Text> : null}
              {canEdit && !r.replied && r.body ? (
                <Pressable onPress={() => router.navigate({ pathname: '/talk', params: { ask: `Draft a reply to this ${r.rating} star review from ${r.name || 'a customer'}: "${r.body.slice(0, 400)}"` } } as any)} hitSlop={6} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                  <Text style={{ color: colours.purple, fontSize: 13, fontWeight: '700' }}>Ask Tali to draft a reply  ·  uses 1 credit</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </>
      )}
      <Sheet visible={open} title="Log a review" sub="Copy it in from Google, Facebook or wherever it landed." onClose={() => setOpen(false)}>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Pressable key={i} onPress={() => setRating(i)} accessibilityLabel={`${i} stars`} hitSlop={4}><Ionicons name={i <= rating ? 'star' : 'star-outline'} size={34} color="#A8841C" /></Pressable>
          ))}
        </View>
        <TextInput value={name} onChangeText={setName} placeholder="Who left it (optional)" placeholderTextColor={colours.faint} style={input} maxLength={80} />
        <TextInput value={place} onChangeText={setPlace} placeholder="Where (Google, Facebook...)" placeholderTextColor={colours.faint} style={input} maxLength={40} />
        <TextInput value={body} onChangeText={setBody} placeholder="What they said (optional)" placeholderTextColor={colours.faint} style={[input, { minHeight: 90, textAlignVertical: 'top' }]} multiline maxLength={1500} />
        <ErrorText>{err}</ErrorText>
        <Button title="Save review" onPress={save} busy={busy} />
      </Sheet>
    </View>
  );
}
