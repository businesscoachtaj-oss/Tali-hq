// 12 Nov 2026 (Taj): Bookings. Your week, requests waiting on your yes, your services and one link
// customers book from. Nothing from the link is confirmed without your yes. Part of the Business plans.
import { useCallback, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '@/lib/auth';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { myCredits, type Credits } from '@/lib/data';
import { BOOK_BASE, bookingPage, bookings as loadBookings, cleanSlug, deleteService, saveBooking, saveBookingPage, saveService, services as loadServices, setBookingStatus, type Booking, type BookingPage, type Service } from '@/lib/bookings';
import { addDays, isoDate } from '@/lib/dates';
import { hasBusinessTools } from '@/lib/plan';
import { ChipPicker } from '@/components/ChipPicker';
import { Button, ErrorText, Field, Label, Loading, Screen, useConfirm } from '@/components/ui';
import { BLUE, Box, H, Head, Line, Pill, Stats, Sub } from '@/components/Biz';
import { BusinessBar, useBusinesses } from '@/lib/businesses';
import { BizLock } from '@/components/BizLock';
import { colours, radius } from '@/constants/theme';

const DAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_SETS: { label: string; days: number[] }[] = [{ label: 'Mon to Fri', days: [1, 2, 3, 4, 5] }, { label: 'Mon to Sat', days: [1, 2, 3, 4, 5, 6] }, { label: 'Every day', days: [0, 1, 2, 3, 4, 5, 6] }];
const HOURS = ['06:00', '07:00', '08:00', '09:00', '10:00'];
const ENDS = ['15:00', '16:00', '17:00', '18:00', '19:00'];
const pretty = (hm: string) => { const [h, m] = hm.split(':').map(Number); return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`; };
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
const dayOf = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' });
const lengthOf = (m: number) => (m >= 60 ? `${Math.round((m / 60) * 10) / 10} h` : `${m} min`);
const TAG: Record<string, { text: string; colour: string }> = { link: { text: 'From your link', colour: '#FFB561' }, tali: { text: 'Booked by Tali', colour: '#D7B5FF' }, you: { text: 'Booked by you', colour: BLUE } };

export default function Bookings() {
  const { session } = useAuth();
  const [credits, setCredits] = useState<Credits | null>(null);
  const [allBookings, setList] = useState<Booking[]>([]);
  // 12 Nov 2026: more than one business. Only this business's (or all of them together).
  const biz = useBusinesses();
  const list = allBookings.filter(biz.visible);
  const [svc, setSvc] = useState<Service[]>([]);
  const [page, setPage] = useState<BookingPage>({ slug: '', enabled: false, intro: '', days: [1, 2, 3, 4, 5], day_start: '09:00', day_end: '17:00' });
  const [hasPage, setHasPage] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [day, setDay] = useState(isoDate(new Date()));
  const [adding, setAdding] = useState(false);
  const [what, setWhat] = useState(''); const [who, setWho] = useState(''); const [at, setAt] = useState('09:00'); const [mins, setMins] = useState('60'); const [place, setPlace] = useState('');
  const [sName, setSName] = useState(''); const [sMins, setSMins] = useState('60'); const [sPrice, setSPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const { armed, confirm } = useConfirm();
  const ok = hasBusinessTools(credits, session?.user.id);

  const load = useCallback(async () => {
    setError('');
    try {
      const c = await myCredits();
      setCredits(c);
      if (hasBusinessTools(c, session?.user.id)) {
        const from = new Date(new Date().setHours(0, 0, 0, 0));
        const [b, s, p] = await Promise.all([loadBookings(from.toISOString(), addDays(from, 35).toISOString()), loadServices(), bookingPage()]);
        setList(b); setSvc(s);
        if (p) { setPage(p); setHasPage(true); }
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your bookings.');
    }
    setLoaded(true);
  }, [session?.user.id]);
  useFocusLoad(load); // Speed pass (13 Nov 2026): see lib/useFocusLoad.ts

  if (!loaded) return <Screen><Loading /></Screen>;
  if (!ok) {
    return <BizLock title="Bookings" sub="Your week, who wants a time, and one link your customers book from. Nothing is confirmed without your yes."
      points={[{ icon: 'calendar-outline', title: 'Your week at a glance', sub: 'Every job, visit and regular on one screen' }, { icon: 'link-outline', title: 'One booking link', sub: 'Customers pick a service and a free time' }, { icon: 'checkmark-circle-outline', title: 'Your yes, every time', sub: 'Requests wait for you before anything is confirmed' }]} />;
  }

  async function run(work: () => Promise<void>, fail: string) {
    setError(''); setNote(''); setBusy(true);
    try { await work(); await load(); } catch (e: any) { setError(e?.message ?? fail); }
    setBusy(false);
  }
  const addBooking = () => run(async () => {
    if (!what.trim()) throw new Error('What is the booking for?');
    const m = /^(\d{1,2})[:.]?(\d{2})?\s*(am|pm)?$/i.exec(at.trim());
    if (!m) throw new Error('Type the time like 9:30 or 2pm.');
    let h = Number(m[1]); const mm = Number(m[2] ?? 0);
    if (m[3]?.toLowerCase() === 'pm' && h < 12) h += 12;
    if (m[3]?.toLowerCase() === 'am' && h === 12) h = 0;
    if (h > 23 || mm > 59) throw new Error('Type the time like 9:30 or 2pm.');
    const [y, mo, d] = day.split('-').map(Number);
    await saveBooking({ title: what, client_name: who, starts_at: new Date(y, mo - 1, d, h, mm).toISOString(), minutes: Number(mins) || 60, place });
    setWhat(''); setWho(''); setPlace(''); setAdding(false);
  }, 'Could not save that booking.');
  const addService = () => run(async () => {
    if (!sName.trim()) throw new Error('Give the service a name.');
    const price = sPrice.trim() ? Number(sPrice.replace(/[^0-9.]/g, '')) : null;
    await saveService({ name: sName, minutes: Number(sMins) || 60, price: price != null && Number.isFinite(price) ? price : null });
    setSName(''); setSPrice('');
  }, 'Could not save that service.');
  const savePage = () => run(async () => {
    if (!session) return;
    await saveBookingPage(session.user.id, page);
    setHasPage(true); setNote(page.enabled ? 'Saved. Your booking link is live.' : 'Saved. Switch the link on when you are ready.');
  }, 'Could not save your booking link.');

  const today0 = new Date(new Date().setHours(0, 0, 0, 0));
  const week = Array.from({ length: 7 }, (_, i) => addDays(today0, i));
  const live = list.filter((b) => b.status === 'booked' || b.status === 'done');
  const onDay = (iso: string) => live.filter((b) => isoDate(new Date(b.starts_at)) === iso);
  const waiting = list.filter((b) => b.status === 'requested');
  const todays = onDay(day);
  const thisWeek = week.reduce((a, d) => a + onDay(isoDate(d)).length, 0);
  const slug = cleanSlug(page.slug);

  return (
    <Screen onRefresh={load}>
      <BusinessBar />
      <Head over="Business" title="Bookings" sub="Your week, who wants a time, and one link your customers book from. Nothing is confirmed without your yes." />
      <Stats items={[{ label: 'booked this week', value: String(thisWeek) }, { label: 'waiting on you', value: String(waiting.length), colour: waiting.length ? '#FFB561' : undefined }, { label: 'from your link', value: String(list.filter((b) => b.source === 'link' && b.status !== 'requested').length), colour: colours.good }]} />
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
        {week.map((d) => {
          const iso = isoDate(d), on = iso === day, n = onDay(iso).length;
          return (
            <Pressable key={iso} onPress={() => setDay(iso)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={dayOf(d.toISOString())}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 14, backgroundColor: on ? BLUE : colours.surface, borderWidth: 1, borderColor: on ? BLUE : colours.border }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: on ? '#141033' : colours.faint }}>{DAY[d.getDay()]}</Text>
              <Text style={{ fontSize: 17, fontWeight: '800', color: on ? '#141033' : colours.text, marginTop: 2 }}>{d.getDate()}</Text>
              <View style={{ flexDirection: 'row', gap: 2, marginTop: 4, height: 5 }}>
                {Array.from({ length: Math.min(n, 4) }).map((_, k) => <View key={k} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: on ? '#141033' : BLUE }} />)}
              </View>
            </Pressable>
          );
        })}
      </View>
      <ErrorText>{error}</ErrorText>
      {note ? <Text style={{ color: colours.good, fontWeight: '700', marginBottom: 10 }}>{note}</Text> : null}

      {waiting.length ? <Label>Waiting on your yes</Label> : null}
      {waiting.map((b) => (
        <Box key={b.id} edge="#FFB561">
          <H>{b.client_name || 'Someone'}</H>
          <Sub>{b.title}, {dayOf(b.starts_at)} at {timeOf(b.starts_at)}</Sub>
          {b.client_email || b.client_phone ? <Text selectable style={{ color: colours.muted, fontSize: 13, marginTop: 4 }}>{[b.client_email, b.client_phone].filter(Boolean).join(' · ')}</Text> : null}
          {b.notes ? <Text style={{ color: colours.text, fontSize: 13.5, marginTop: 6, lineHeight: 19 }}>{b.notes}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => run(() => setBookingStatus(b.id, 'booked'), 'Could not book that.')} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colours.purple }}><Text style={{ color: colours.onPurple, fontWeight: '800' }}>Yes, book it</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => confirm(`no-${b.id}`, () => run(() => setBookingStatus(b.id, 'cancelled'), 'Could not turn that down.'))} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colours.border }}><Text style={{ color: colours.text, fontWeight: '700' }}>{armed === `no-${b.id}` ? 'Tap again' : 'No, turn it down'}</Text></Pressable>
          </View>
          <Text style={{ color: colours.faint, fontSize: 12, marginTop: 8 }}>Let them know yourself for now. Tali confirming by text is coming soon.</Text>
        </Box>
      ))}

      <Label>{dayOf(`${day}T12:00:00`)}</Label>
      <Box>
        {!todays.length ? <Sub>Nothing booked.</Sub> : null}
        {todays.map((b, i) => (
          <View key={b.id} style={{ flexDirection: 'row', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colours.border }}>
            <View style={{ width: 74 }}>
              <Text style={{ color: colours.text, fontSize: 14, fontWeight: '800' }}>{timeOf(b.starts_at)}</Text>
              <Text style={{ color: colours.faint, fontSize: 12 }}>{lengthOf(b.minutes)}</Text>
            </View>
            <View style={{ width: 4, borderRadius: 2, backgroundColor: TAG[b.source].colour }} />
            <View style={{ flex: 1 }}>
              <H>{b.title}</H><Sub>{[b.client_name, b.place].filter(Boolean).join(', ') || 'No details'}</Sub>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
                <Pill text={b.status === 'done' ? 'Done' : TAG[b.source].text} colour={b.status === 'done' ? colours.good : TAG[b.source].colour} />
                {b.status === 'booked' ? <Pressable accessibilityRole="button" hitSlop={8} onPress={() => confirm(`x-${b.id}`, () => run(() => setBookingStatus(b.id, 'cancelled'), 'Could not cancel that.'))}><Text style={{ color: colours.muted, fontSize: 12.5, fontWeight: '700' }}>{armed === `x-${b.id}` ? 'Tap again to cancel' : 'Cancel'}</Text></Pressable> : null}
              </View>
            </View>
          </View>
        ))}
      </Box>
      {adding ? (
        <Box>
          <Field label="What is it" value={what} onChangeText={setWhat} placeholder="Site visit" maxLength={160} autoFocus />
          <Field label="Who with (optional)" value={who} onChangeText={setWho} placeholder="Their name" maxLength={120} />
          <Field label="Time" value={at} onChangeText={setAt} placeholder="9:30 or 2pm" autoCapitalize="none" />
          <Label>How long</Label>
          <ChipPicker options={['30', '60', '90', '120', '240']} value={mins} onChange={setMins} label={(m) => lengthOf(Number(m))} />
          <Field label="Where (optional)" value={place} onChangeText={setPlace} maxLength={300} />
          <Button title="Save the booking" onPress={addBooking} busy={busy} />
          <Button title="Cancel" kind="ghost" onPress={() => setAdding(false)} />
        </Box>
      ) : <Button title="Add a booking on this day" onPress={() => { setError(''); setAdding(true); }} />}

      <Label>Your services</Label>
      <Box>
        {!svc.length ? <Sub>Add what people can book, like a site visit or a one hour consult.</Sub> : null}
        {svc.map((s, i) => (
          <Line key={s.id} first={!i} icon="pricetag-outline" title={s.name} sub={`${lengthOf(s.minutes)}${s.price == null ? '' : s.price === 0 ? ', free' : `, A$${s.price}`}`}
            right={<Pressable accessibilityRole="button" hitSlop={8} onPress={() => confirm(`s-${s.id}`, () => run(() => deleteService(s.id), 'Could not remove that.'))}><Text style={{ color: colours.muted, fontSize: 12.5, fontWeight: '700' }}>{armed === `s-${s.id}` ? 'Tap again' : 'Remove'}</Text></Pressable>} />
        ))}
        <View style={{ height: 10 }} />
        <Field label="New service" value={sName} onChangeText={setSName} placeholder="Site visit and quote" maxLength={80} />
        <Label>How long</Label>
        <ChipPicker options={['30', '60', '90', '120']} value={sMins} onChange={setSMins} label={(m) => lengthOf(Number(m))} />
        <Field label="Price, A$ (leave empty to show no price)" value={sPrice} onChangeText={setSPrice} keyboardType="decimal-pad" placeholder="0 for free" />
        <Button title="Add the service" kind="ghost" onPress={addService} disabled={busy} />
      </Box>

      <Label>Your booking link</Label>
      <Box>
        <Field label="Link name" value={page.slug} onChangeText={(v) => setPage({ ...page, slug: v })} placeholder="coastline" autoCapitalize="none" maxLength={40} />
        <Text selectable style={{ color: BLUE, fontSize: 14.5, fontWeight: '800', marginTop: -4, marginBottom: 12 }}>{BOOK_BASE}{slug || 'your-name'}</Text>
        <Label>Days people can book</Label>
        <ChipPicker options={DAY_SETS.map((d) => d.label)} value={DAY_SETS.find((d) => d.days.join() === [...page.days].sort().join())?.label ?? null} onChange={(l) => setPage({ ...page, days: DAY_SETS.find((d) => d.label === l)!.days })} />
        <Label>From</Label>
        <ChipPicker options={HOURS} value={page.day_start} onChange={(v) => setPage({ ...page, day_start: v })} label={pretty} />
        <Label>Until</Label>
        <ChipPicker options={ENDS} value={page.day_end} onChange={(v) => setPage({ ...page, day_end: v })} label={pretty} />
        <Field label="A line for the top of the page (optional)" value={page.intro} onChangeText={(v) => setPage({ ...page, intro: v })} maxLength={300} placeholder="Pick a time and I will confirm it the same day." />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: colours.text }}>Take bookings from the link</Text>
            <Text style={{ color: colours.muted, fontSize: 13, marginTop: 2 }}>Off means the page says you are not taking bookings.</Text>
          </View>
          <Switch value={page.enabled} onValueChange={(v) => setPage({ ...page, enabled: v })} trackColor={{ true: colours.purple, false: colours.borderStrong }} thumbColor="#FFFFFF" {...({ activeThumbColor: '#FFFFFF' } as object)} />
        </View>
        <Button title="Save the link" onPress={savePage} busy={busy} />
        {hasPage && slug ? <Button title="Copy the link" kind="ghost" onPress={async () => { await Clipboard.setStringAsync(`${BOOK_BASE}${slug}`); setNote('Link copied.'); }} /> : null}
      </Box>
    </Screen>
  );
}
