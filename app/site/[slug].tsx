// 12 Nov 2026 (Taj): the public website, talihq.com.au/site/<name>. No sign in. Shows what the owner
// chose to show, a Book a time button when their booking link is on, and a contact form.
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { publicEnquiry, publicSite, type PublicSite } from '@/lib/site';
import { colours, radius } from '@/constants/theme';

export default function Site() {
  const { slug: raw } = useLocalSearchParams<{ slug?: string }>();
  const slug = String(Array.isArray(raw) ? raw[0] : raw ?? '');
  const [site, setSite] = useState<PublicSite | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    publicSite(slug).then((s) => { setSite(s); setState(s ? 'ready' : 'missing'); }).catch(() => setState('missing'));
  }, [slug]);

  async function send() {
    setError('');
    if (name.trim().length < 2) return setError('Add your name.');
    if (!email.trim() && !phone.trim()) return setError('Add an email or a phone number so they can reply.');
    setBusy(true);
    const res = await publicEnquiry(slug, { name, email: email.trim(), phone: phone.trim(), message });
    setBusy(false);
    if (res.ok) setSent(true);
    else setError(res.message ?? 'Could not send that. Try again.');
  }

  const accent = site?.accent ?? '#7FA8FF';
  const input = { backgroundColor: colours.surface, borderRadius: radius.input, borderWidth: 1, borderColor: colours.border, color: colours.text, fontSize: 16, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 12 } as const;
  const label = { color: accent, fontSize: 12, fontWeight: '800', letterSpacing: 2, marginTop: 30, marginBottom: 10 } as const;
  const para = { color: colours.text, fontSize: 16, lineHeight: 25, opacity: 0.9 } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colours.bg }}>
      <ScrollView contentContainerStyle={{ padding: 22, maxWidth: 640, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        {state === 'loading' ? <Text style={{ color: colours.muted, marginTop: 40 }}>Loading...</Text> : null}
        {state === 'missing' ? (
          <View style={{ marginTop: 40 }}>
            <Text style={{ color: colours.text, fontSize: 30, fontFamily: 'InstrumentSerif_400Regular' }}>Nothing here yet</Text>
            <Text style={{ color: colours.muted, fontSize: 15, marginTop: 8, lineHeight: 22 }}>This site is not live, or the address is typed wrong.</Text>
          </View>
        ) : null}
        {state === 'ready' && site ? (
          <>
            <View style={{ height: 6, width: 56, borderRadius: 3, backgroundColor: accent, marginTop: 18 }} />
            <Text accessibilityRole="header" style={{ color: colours.text, fontSize: 44, lineHeight: 48, marginTop: 16, fontFamily: 'InstrumentSerif_400Regular' }}>{site.name}</Text>
            {site.tagline ? <Text style={{ color: colours.muted, fontSize: 18, lineHeight: 26, marginTop: 10 }}>{site.tagline}</Text> : null}
            {site.book_slug ? (
              <Pressable onPress={() => router.push({ pathname: '/book/[slug]', params: { slug: site.book_slug! } })} accessibilityRole="link"
                style={{ alignSelf: 'flex-start', marginTop: 20, paddingVertical: 14, paddingHorizontal: 24, borderRadius: radius.pill, backgroundColor: accent }}>
                <Text style={{ color: '#141033', fontSize: 16, fontWeight: '800' }}>Book a time</Text>
              </Pressable>
            ) : null}

            {site.about ? <><Text style={label}>ABOUT</Text><Text style={para}>{site.about}</Text></> : null}

            {site.services.length ? (
              <>
                <Text style={label}>{site.kind === 'business' ? 'SERVICES' : 'WHAT I OFFER'}</Text>
                <View style={{ gap: 8 }}>
                  {site.services.map((s, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, padding: 14 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colours.text, fontSize: 16, fontWeight: '800' }}>{s.name}</Text>
                        <Text style={{ color: colours.muted, fontSize: 13, marginTop: 2 }}>{s.minutes >= 60 ? `${Math.round((s.minutes / 60) * 10) / 10} h` : `${s.minutes} min`}</Text>
                      </View>
                      {s.price == null ? null : <Text style={{ color: accent, fontSize: 16, fontWeight: '800' }}>{Number(s.price) === 0 ? 'Free' : `A$${Number(s.price)}`}</Text>}
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {site.sections.map((s, i) => (
              <View key={i}>
                {s.heading ? <Text style={label}>{s.heading.toUpperCase()}</Text> : <View style={{ height: 24 }} />}
                {s.text ? <Text style={para}>{s.text}</Text> : null}
              </View>
            ))}

            {site.show_contact ? (
              <>
                <Text style={label}>GET IN TOUCH</Text>
                {site.contact_email ? <Text selectable style={{ color: colours.text, fontSize: 16, marginBottom: 4 }}>{site.contact_email}</Text> : null}
                {site.contact_phone ? <Text selectable style={{ color: colours.text, fontSize: 16, marginBottom: 4 }}>{site.contact_phone}</Text> : null}
                {sent ? (
                  <Text style={{ color: colours.good, fontSize: 16, fontWeight: '700', marginTop: 10 }}>Thanks, {name.trim().split(' ')[0]}. Your message is with {site.name}.</Text>
                ) : (
                  <View style={{ marginTop: 10 }}>
                    <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={colours.faint} accessibilityLabel="Your name" maxLength={120} style={input} />
                    <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={colours.faint} accessibilityLabel="Email" autoCapitalize="none" keyboardType="email-address" maxLength={200} style={input} />
                    <TextInput value={phone} onChangeText={setPhone} placeholder="Phone" placeholderTextColor={colours.faint} accessibilityLabel="Phone" keyboardType="phone-pad" maxLength={40} style={input} />
                    <TextInput value={message} onChangeText={setMessage} placeholder="Your message" placeholderTextColor={colours.faint} accessibilityLabel="Your message" multiline maxLength={2000} style={[input, { minHeight: 100, textAlignVertical: 'top' }]} />
                    {error ? <Text style={{ color: colours.danger, fontWeight: '700', marginBottom: 10 }}>{error}</Text> : null}
                    <Pressable onPress={send} disabled={busy} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 15, borderRadius: radius.pill, backgroundColor: accent, opacity: busy ? 0.6 : 1 }}>
                      <Text style={{ color: '#141033', fontSize: 16, fontWeight: '800' }}>{busy ? 'Sending...' : 'Send message'}</Text>
                    </Pressable>
                  </View>
                )}
              </>
            ) : null}
            <Text style={{ color: colours.faint, fontSize: 12, marginTop: 36 }}>Made with Tali HQ</Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
