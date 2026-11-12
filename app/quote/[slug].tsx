// 12 Nov 2026 (Taj): the public quote calculator, talihq.com.au/quote/<name>. No sign in. A customer
// picks what they want and sees a rough price as they go. Sending it lands in the owner's Pipeline as
// a new lead. The server works the price out again from the owner's saved prices.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { estimate, money, publicCalc, publicQuoteRequest, type Answers, type PublicCalc } from '@/lib/calc';
import { colours, radius } from '@/constants/theme';

const BLUE = '#7FA8FF';

export default function Quote() {
  const { slug: raw } = useLocalSearchParams<{ slug?: string }>();
  const slug = String(Array.isArray(raw) ? raw[0] : raw ?? '');
  const [calc, setCalc] = useState<PublicCalc | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'sent'>('loading');
  const [answers, setAnswers] = useState<Answers>({});
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentTotal, setSentTotal] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    publicCalc(slug).then((c) => { setCalc(c); setState(c ? 'ready' : 'missing'); }).catch(() => setState('missing'));
  }, [slug]);

  const total = useMemo(() => (calc ? estimate(calc, answers) : 0), [calc, answers]);
  const setA = (id: string, v: number | boolean) => setAnswers((a) => ({ ...a, [id]: v }));

  async function send() {
    setError('');
    if (name.trim().length < 2) return setError('Add your name.');
    if (!email.trim() && !phone.trim()) return setError('Add an email or a phone number so they can reply.');
    setBusy(true);
    const res = await publicQuoteRequest(slug, { name, email: email.trim(), phone: phone.trim(), note, answers });
    setBusy(false);
    if (res.ok) { setSentTotal(typeof res.estimate === 'number' ? res.estimate : total); setState('sent'); }
    else setError(res.message ?? 'Could not send that. Try again.');
  }

  const input = { backgroundColor: colours.surface, borderRadius: radius.input, borderWidth: 1, borderColor: colours.border, color: colours.text, fontSize: 16, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 12 } as const;
  const label = { color: colours.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 18, marginBottom: 8 } as const;
  const box = { backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, padding: 14, marginBottom: 8 } as const;
  const step = { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colours.bg, borderWidth: 1, borderColor: colours.border } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colours.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, maxWidth: 560, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        {state === 'loading' ? <Text style={{ color: colours.muted, marginTop: 40 }}>Loading...</Text> : null}
        {state === 'missing' ? (
          <View style={{ marginTop: 40 }}>
            <Text style={{ color: colours.text, fontSize: 30, fontFamily: 'InstrumentSerif_400Regular' }}>This page is not taking quote requests</Text>
            <Text style={{ color: colours.muted, fontSize: 15, marginTop: 8, lineHeight: 22 }}>The link may be switched off or typed wrong. Get in touch with the business directly.</Text>
          </View>
        ) : null}
        {state === 'sent' && calc ? (
          <View style={{ marginTop: 40 }}>
            <Text style={{ color: colours.good, fontSize: 12, fontWeight: '800', letterSpacing: 2 }}>REQUEST SENT</Text>
            <Text style={{ color: colours.text, fontSize: 34, lineHeight: 38, marginTop: 8, fontFamily: 'InstrumentSerif_400Regular' }}>Thanks, {name.trim().split(' ')[0]}.</Text>
            <Text style={{ color: colours.muted, fontSize: 15, marginTop: 10, lineHeight: 22 }}>{calc.name} has your request, with a guide price of about {money(sentTotal ?? total)}. It is a rough price, not a final quote. They will be in touch to confirm.</Text>
          </View>
        ) : null}
        {state === 'ready' && calc ? (
          <>
            <Text style={{ color: BLUE, fontSize: 12, fontWeight: '800', letterSpacing: 2 }}>{calc.name.toUpperCase()}</Text>
            <Text accessibilityRole="header" style={{ color: colours.text, fontSize: 38, lineHeight: 42, marginTop: 6, fontFamily: 'InstrumentSerif_400Regular' }}>{calc.title || 'Get a rough price'}</Text>
            {calc.intro ? <Text style={{ color: colours.muted, fontSize: 15, marginTop: 8, lineHeight: 22 }}>{calc.intro}</Text> : null}

            {calc.items.length ? <Text style={label}>WHAT DO YOU NEED</Text> : <View style={{ height: 16 }} />}
            {calc.items.map((it) => {
              const v = answers[it.id];
              if (it.kind === 'tick') {
                const on = v === true;
                return (
                  <Pressable key={it.id} onPress={() => setA(it.id, !on)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ ...box, flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: on ? BLUE : colours.border, borderWidth: on ? 2 : 1 }}>
                    <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: on ? BLUE : colours.borderStrong, backgroundColor: on ? BLUE : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{on ? <Text style={{ color: '#141033', fontWeight: '900', fontSize: 14 }}>✓</Text> : null}</View>
                    <Text style={{ flex: 1, color: colours.text, fontSize: 16, fontWeight: '700' }}>{it.label}</Text>
                    {it.price ? <Text style={{ color: colours.muted, fontSize: 14 }}>{money(it.price)}</Text> : null}
                  </Pressable>
                );
              }
              if (it.kind === 'qty') {
                const n = typeof v === 'number' ? v : 0;
                return (
                  <View key={it.id} style={{ ...box, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colours.text, fontSize: 16, fontWeight: '700' }}>{it.label}</Text>
                      {it.price ? <Text style={{ color: colours.muted, fontSize: 13, marginTop: 2 }}>{money(it.price)} each</Text> : null}
                    </View>
                    <Pressable onPress={() => setA(it.id, Math.max(0, n - 1))} accessibilityRole="button" accessibilityLabel={`One less: ${it.label}`} style={step}><Text style={{ color: colours.text, fontSize: 22, fontWeight: '700' }}>-</Text></Pressable>
                    <Text accessibilityLabel={`${n} ${it.unit}`} style={{ color: colours.text, fontSize: 18, fontWeight: '800', minWidth: 28, textAlign: 'center' }}>{n}</Text>
                    <Pressable onPress={() => setA(it.id, Math.min(it.max, n + 1))} accessibilityRole="button" accessibilityLabel={`One more: ${it.label}`} style={step}><Text style={{ color: colours.text, fontSize: 22, fontWeight: '700' }}>+</Text></Pressable>
                  </View>
                );
              }
              return (
                <View key={it.id} style={box}>
                  <Text style={{ color: colours.text, fontSize: 16, fontWeight: '700', marginBottom: 10 }}>{it.label}</Text>
                  <View style={{ gap: 8 }}>
                    {it.choices.map((ch, k) => {
                      const on = v === k;
                      return (
                        <Pressable key={k} onPress={() => setA(it.id, k)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12, borderRadius: radius.input, backgroundColor: on ? BLUE + '26' : colours.bg, borderWidth: on ? 2 : 1, borderColor: on ? BLUE : colours.border }}>
                          <Text style={{ flex: 1, color: colours.text, fontSize: 15, fontWeight: '700' }}>{ch.label}</Text>
                          {ch.price ? <Text style={{ color: colours.muted, fontSize: 14 }}>{money(ch.price)}</Text> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            <View style={{ backgroundColor: BLUE + '1F', borderRadius: radius.card, borderWidth: 1, borderColor: BLUE + '66', padding: 16, marginTop: 10 }}>
              <Text style={{ color: colours.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>ROUGH PRICE</Text>
              <Text accessibilityLiveRegion="polite" style={{ color: colours.text, fontSize: 36, fontWeight: '800', marginTop: 4 }}>{money(total)}</Text>
              <Text style={{ color: colours.muted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>A guide only. {calc.name} will confirm the price before any work starts.</Text>
            </View>

            <Text style={label}>YOUR DETAILS</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={colours.faint} accessibilityLabel="Your name" maxLength={120} style={input} />
            <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={colours.faint} accessibilityLabel="Email" autoCapitalize="none" keyboardType="email-address" maxLength={200} style={input} />
            <TextInput value={phone} onChangeText={setPhone} placeholder="Phone" placeholderTextColor={colours.faint} accessibilityLabel="Phone" keyboardType="phone-pad" maxLength={40} style={input} />
            <TextInput value={note} onChangeText={setNote} placeholder="Anything they should know (optional)" placeholderTextColor={colours.faint} accessibilityLabel="Anything they should know" multiline maxLength={600} style={[input, { minHeight: 80, textAlignVertical: 'top' }]} />
            {error ? <Text style={{ color: colours.danger, fontWeight: '700', marginBottom: 10 }}>{error}</Text> : null}
            <Pressable onPress={send} disabled={busy} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 15, borderRadius: radius.pill, backgroundColor: colours.purple, opacity: busy ? 0.6 : 1 }}>
              <Text style={{ color: colours.onPurple, fontSize: 16, fontWeight: '800' }}>{busy ? 'Sending...' : 'Send my request'}</Text>
            </Pressable>
            <Text style={{ color: colours.faint, fontSize: 12, marginTop: 30 }}>Quotes by Tali HQ</Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
