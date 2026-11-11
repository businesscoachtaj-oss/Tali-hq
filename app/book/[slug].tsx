// 12 Nov 2026 (Taj): the public booking page, talihq.com.au/book/<name>. No sign in. A customer picks
// a service, a day and a free time, and it lands in the owner's Bookings as a request for their yes.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { publicPage, publicRequest, zonedIso, type PublicPage } from '@/lib/bookings';
import { colours, radius } from '@/constants/theme';

const BLUE = '#7FA8FF';
const prettyHm = (hm: string) => { const [h, m] = hm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
const hm = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

export default function Book() {
  const { slug: raw } = useLocalSearchParams<{ slug?: string }>();
  const slug = String(Array.isArray(raw) ? raw[0] : raw ?? '');
  const [page, setPage] = useState<PublicPage | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'sent'>('loading');
  const [service, setService] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    publicPage(slug).then((p) => { setPage(p); setState(p ? 'ready' : 'missing'); if (p?.services.length === 1) setService(p.services[0].id); }).catch(() => setState('missing'));
  }, [slug]);

  const svc = page?.services.find((s) => s.id === service) ?? null;
  // The next 21 days they work, as dates in their own timezone.
  const days = useMemo(() => {
    if (!page) return [];
    const out: { iso: string; label: string }[] = [];
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: page.timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
    for (let i = 0; i < 28 && out.length < 14; i++) {
      const d = new Date(Date.now() + i * 86400000);
      const iso = fmt.format(d);
      const dow = new Date(`${iso}T12:00:00Z`).getUTCDay();
      if (page.days.includes(dow)) out.push({ iso, label: new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-AU', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }) });
    }
    return out;
  }, [page]);
  const slots = useMemo(() => {
    if (!page || !svc || !day) return [];
    const out: { hm: string; iso: string }[] = [];
    const busy = page.busy.map((b) => ({ from: new Date(b.starts_at).getTime(), to: new Date(b.starts_at).getTime() + b.minutes * 60000 }));
    for (let m = toMins(page.day_start); m + svc.minutes <= toMins(page.day_end); m += 30) {
      const iso = zonedIso(day, hm(m), page.timezone);
      const from = new Date(iso).getTime(), to = from + svc.minutes * 60000;
      if (from < Date.now() + 3600000) continue;
      if (busy.some((b) => b.from < to && b.to > from)) continue;
      out.push({ hm: hm(m), iso });
    }
    return out;
  }, [page, svc, day]);

  async function send() {
    setError('');
    const slot = slots.find((s) => s.hm === time);
    if (!svc || !slot) return setError('Pick a service, a day and a time.');
    if (name.trim().length < 2) return setError('Add your name.');
    if (!email.trim() && !phone.trim()) return setError('Add an email or a phone number so they can confirm.');
    setBusy(true);
    const res = await publicRequest(slug, { service_id: svc.id, starts_at: slot.iso, name, email: email.trim(), phone: phone.trim(), note });
    setBusy(false);
    if (res.ok) setState('sent');
    else setError(res.message ?? 'Could not send that. Try again.');
  }

  const chip = (on: boolean) => ({ borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: on ? BLUE : colours.surface, borderWidth: 1, borderColor: on ? BLUE : colours.border } as const);
  const chipText = (on: boolean) => ({ fontSize: 14, fontWeight: '700', color: on ? '#141033' : colours.text } as const);
  const input = { backgroundColor: colours.surface, borderRadius: radius.input, borderWidth: 1, borderColor: colours.border, color: colours.text, fontSize: 16, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 12 } as const;
  const label = { color: colours.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 18, marginBottom: 8 } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colours.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, maxWidth: 560, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        {state === 'loading' ? <Text style={{ color: colours.muted, marginTop: 40 }}>Loading...</Text> : null}
        {state === 'missing' ? (
          <View style={{ marginTop: 40 }}>
            <Text style={{ color: colours.text, fontSize: 30, fontFamily: 'InstrumentSerif_400Regular' }}>This page is not taking bookings</Text>
            <Text style={{ color: colours.muted, fontSize: 15, marginTop: 8, lineHeight: 22 }}>The link may be switched off or typed wrong. Get in touch with the business directly.</Text>
          </View>
        ) : null}
        {state === 'sent' && page ? (
          <View style={{ marginTop: 40 }}>
            <Text style={{ color: colours.good, fontSize: 12, fontWeight: '800', letterSpacing: 2 }}>REQUEST SENT</Text>
            <Text style={{ color: colours.text, fontSize: 34, lineHeight: 38, marginTop: 8, fontFamily: 'InstrumentSerif_400Regular' }}>Thanks, {name.trim().split(' ')[0]}.</Text>
            <Text style={{ color: colours.muted, fontSize: 15, marginTop: 10, lineHeight: 22 }}>{page.name} has your request for {svc?.name} on {days.find((d) => d.iso === day)?.label} at {time ? prettyHm(time) : ''}. It is not confirmed yet. They will be in touch to confirm.</Text>
          </View>
        ) : null}
        {state === 'ready' && page ? (
          <>
            <Text style={{ color: BLUE, fontSize: 12, fontWeight: '800', letterSpacing: 2 }}>BOOK A TIME</Text>
            <Text style={{ color: colours.text, fontSize: 38, lineHeight: 42, marginTop: 6, fontFamily: 'InstrumentSerif_400Regular' }}>{page.name}</Text>
            {page.intro ? <Text style={{ color: colours.muted, fontSize: 15, marginTop: 8, lineHeight: 22 }}>{page.intro}</Text> : null}
            {!page.services.length ? <Text style={{ color: colours.muted, marginTop: 20 }}>Nothing to book here yet.</Text> : (
              <>
                <Text style={label}>WHAT FOR</Text>
                <View style={{ gap: 8 }}>
                  {page.services.map((s) => (
                    <Pressable key={s.id} onPress={() => { setService(s.id); setTime(null); }} accessibilityRole="radio" accessibilityState={{ selected: service === s.id }}
                      style={{ borderRadius: radius.card, padding: 14, backgroundColor: service === s.id ? BLUE + '26' : colours.surface, borderWidth: service === s.id ? 2 : 1, borderColor: service === s.id ? BLUE : colours.border }}>
                      <Text style={{ color: colours.text, fontSize: 16, fontWeight: '800' }}>{s.name}</Text>
                      <Text style={{ color: colours.muted, fontSize: 13, marginTop: 2 }}>{s.minutes >= 60 ? `${Math.round((s.minutes / 60) * 10) / 10} h` : `${s.minutes} min`}{s.price == null ? '' : Number(s.price) === 0 ? ', free' : `, A$${Number(s.price)}`}</Text>
                    </Pressable>
                  ))}
                </View>
                {svc ? (
                  <>
                    <Text style={label}>WHICH DAY</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {days.map((d) => <Pressable key={d.iso} onPress={() => { setDay(d.iso); setTime(null); }} accessibilityRole="radio" accessibilityState={{ selected: day === d.iso }} style={chip(day === d.iso)}><Text style={chipText(day === d.iso)}>{d.label}</Text></Pressable>)}
                    </View>
                  </>
                ) : null}
                {svc && day ? (
                  <>
                    <Text style={label}>WHAT TIME ({page.timezone.split('/').pop()?.replace('_', ' ')} time)</Text>
                    {!slots.length ? <Text style={{ color: colours.muted }}>Nothing free that day. Try another.</Text> : null}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {slots.map((s) => <Pressable key={s.hm} onPress={() => setTime(s.hm)} accessibilityRole="radio" accessibilityState={{ selected: time === s.hm }} style={chip(time === s.hm)}><Text style={chipText(time === s.hm)}>{prettyHm(s.hm)}</Text></Pressable>)}
                    </View>
                  </>
                ) : null}
                {svc && day && time ? (
                  <>
                    <Text style={label}>YOUR DETAILS</Text>
                    <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={colours.faint} accessibilityLabel="Your name" maxLength={120} style={input} />
                    <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={colours.faint} accessibilityLabel="Email" autoCapitalize="none" keyboardType="email-address" maxLength={200} style={input} />
                    <TextInput value={phone} onChangeText={setPhone} placeholder="Phone" placeholderTextColor={colours.faint} accessibilityLabel="Phone" keyboardType="phone-pad" maxLength={40} style={input} />
                    <TextInput value={note} onChangeText={setNote} placeholder="Anything they should know (optional)" placeholderTextColor={colours.faint} accessibilityLabel="Anything they should know" multiline maxLength={1000} style={[input, { minHeight: 80, textAlignVertical: 'top' }]} />
                    {error ? <Text style={{ color: colours.danger, fontWeight: '700', marginBottom: 10 }}>{error}</Text> : null}
                    <Pressable onPress={send} disabled={busy} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 15, borderRadius: radius.pill, backgroundColor: colours.purple, opacity: busy ? 0.6 : 1 }}>
                      <Text style={{ color: colours.onPurple, fontSize: 16, fontWeight: '800' }}>{busy ? 'Sending...' : 'Ask for this time'}</Text>
                    </Pressable>
                    <Text style={{ color: colours.faint, fontSize: 12.5, marginTop: 10, lineHeight: 18 }}>This sends a request. It is confirmed once {page.name} says yes.</Text>
                  </>
                ) : null}
              </>
            )}
            <Text style={{ color: colours.faint, fontSize: 12, marginTop: 30 }}>Bookings by Tali HQ</Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
