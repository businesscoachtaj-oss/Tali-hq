// 12 Nov 2026 (Taj): Website. A simple site Tali HQ hosts for you at talihq.com.au/site/<name>. A business
// site can show your services, your booking link and a contact form that lands as a new lead.
import { useCallback, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { myCredits, type Credits } from '@/lib/data';
import { cleanSlug } from '@/lib/bookings';
import { ACCENTS, blankSite, deleteEnquiry, enquiries as loadEnquiries, mySite, saveSite, SITE_BASE, writeSite, type Enquiry, type Site } from '@/lib/site';
import { useMode } from '@/lib/mode';
import { hasBusinessTools } from '@/lib/plan';
import { Button, ErrorText, Field, Label, Loading, Screen, useConfirm } from '@/components/ui';
import { BLUE, Head, Line, Pill, Sub, TaliLine } from '@/components/Biz';
import { BizLock } from '@/components/BizLock';
import { colours, radius } from '@/constants/theme';

export default function Website() {
  const { session } = useAuth();
  const mode = useMode();
  const [credits, setCredits] = useState<Credits | null>(null);
  const [site, setSite] = useState<Site>(blankSite('business'));
  const [has, setHas] = useState(false);
  const [inbox, setInbox] = useState<Enquiry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState('');
  const [writing, setWriting] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const { armed, confirm } = useConfirm();
  const ok = hasBusinessTools(credits, session?.user.id);

  const load = useCallback(async () => {
    setError('');
    try {
      const c = await myCredits();
      setCredits(c);
      if (hasBusinessTools(c, session?.user.id)) {
        const [s, e] = await Promise.all([mySite(), loadEnquiries()]);
        if (s) { setSite(s); setHas(true); } else setSite(blankSite(mode === 'life' ? 'life' : 'business'));
        setInbox(e);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load your website.'); }
    setLoaded(true);
  }, [session?.user.id, mode]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const set = (patch: Partial<Site>) => { setSite((s) => ({ ...s, ...patch })); setNote(''); };
  const setSection = (i: number, patch: Partial<Site['sections'][number]>) => set({ sections: site.sections.map((x, k) => (k === i ? { ...x, ...patch } : x)) });

  async function save(publish?: boolean) {
    if (!session) return;
    setError(''); setNote(''); setBusy(true);
    try {
      const next = { ...site, ...(publish === undefined ? {} : { published: publish }) };
      await saveSite(session.user.id, next);
      setSite({ ...next, slug: cleanSlug(next.slug) }); setHas(true);
      setNote(next.published ? 'Saved. Your site is live.' : 'Saved. Put it live when you are ready.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save that.'); }
    setBusy(false);
  }

  // Tali drafts the words into the boxes. Nothing is saved or live until the owner saves.
  async function write() {
    setError(''); setNote(''); setWriting(true);
    const res = await writeSite(site.kind, ask);
    setWriting(false);
    if (!res.ok) return setError(res.message);
    setSite((s) => ({ ...s, title: res.draft.title || s.title, tagline: res.draft.tagline, about: res.draft.about, sections: res.draft.sections }));
    setNote('Tali has drafted it below. Read it over, change what you like, then save.');
  }

  if (!loaded) return <Loading />;
  if (!ok) {
    return <BizLock title="Website" sub="A simple site for your business, hosted by Tali HQ. Your services, your booking link and a contact form that lands as a new lead."
      points={[
        { icon: 'globe-outline', title: 'Live in minutes', sub: 'Fill in a few boxes and put it live at your own address' },
        { icon: 'calendar-outline', title: 'Works with Bookings', sub: 'Customers book a time straight from your site' },
        { icon: 'person-add-outline', title: 'Enquiries become leads', sub: 'Each one lands in your Pipeline with a nudge on your To do' },
      ]} />;
  }

  const slug = cleanSlug(site.slug);
  const card = { backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, paddingHorizontal: 14 } as const;
  const toggle = (value: boolean, onChange: (v: boolean) => void, label: string) => <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: colours.purple, false: colours.borderStrong }} thumbColor="#FFFFFF" {...({ activeThumbColor: '#FFFFFF' } as object)} />;
  return (
    <Screen onRefresh={load}>
      <Head over={site.kind === 'life' ? 'Life' : 'Business'} title="Website" sub="A simple site Tali HQ hosts for you. Fill it in, have a look, then put it live." />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Pill text={site.published ? 'Live' : has ? 'Not live yet' : 'Not set up yet'} colour={site.published ? '#7FE0B0' : '#FFB561'} />
        <Text selectable numberOfLines={1} style={{ flex: 1, color: BLUE, fontSize: 13.5, fontWeight: '800' }}>{SITE_BASE}{slug || 'your-name'}</Text>
      </View>
      {!has ? <TaliLine>Start with your name and one line about what you do. You can change anything later.</TaliLine> : null}

      <Label>What kind of site</Label>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        {(['business', 'life'] as const).map((k) => (
          <Pressable key={k} onPress={() => set({ kind: k, ...(k === 'life' ? { show_services: false, show_booking: false } : {}) })} accessibilityRole="radio" accessibilityState={{ selected: site.kind === k }}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: radius.pill, backgroundColor: site.kind === k ? BLUE : colours.surface, borderWidth: 1, borderColor: site.kind === k ? BLUE : colours.border }}>
            <Text style={{ color: site.kind === k ? '#141033' : colours.text, fontWeight: '800' }}>{k === 'business' ? 'My business' : 'Just me'}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ ...card, paddingVertical: 12, marginBottom: 16 }}>
        <Text style={{ color: colours.text, fontSize: 15.5, fontWeight: '800' }}>Ask Tali to write it</Text>
        <Sub>She drafts the words from what she knows about you. Nothing is saved until you save.</Sub>
        <View style={{ height: 10 }} />
        <Field value={ask} onChangeText={setAsk} placeholder="Anything she should mention (optional)" accessibilityLabel="Anything Tali should mention" multiline maxLength={1500} style={{ minHeight: 60, textAlignVertical: 'top' }} />
        <Button title={writing ? 'Tali is writing...' : site.about ? 'Write it again' : 'Write it for me'} kind="ghost" busy={writing} onPress={write} />
        {site.about ? <Text style={{ color: colours.faint, fontSize: 12.5, marginTop: 6 }}>This replaces the one line, About and extra sections below.</Text> : null}
      </View>

      <Field label="Your address" value={site.slug} onChangeText={(v) => set({ slug: v })} placeholder="your-name" autoCapitalize="none" autoCorrect={false} maxLength={40} />
      <Field label="Name at the top" value={site.title} onChangeText={(v) => set({ title: v })} placeholder={site.kind === 'life' ? 'Your name' : 'Your business name'} maxLength={80} />
      <Field label="One line about what you do" value={site.tagline} onChangeText={(v) => set({ tagline: v })} placeholder="Garden design and upkeep across Geelong" maxLength={160} />
      <Field label="About" value={site.about} onChangeText={(v) => set({ about: v })} placeholder="A few sentences in your own words" multiline maxLength={2000} style={{ minHeight: 100, textAlignVertical: 'top' }} />

      <Label>Colour</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        {ACCENTS.map((a) => (
          <Pressable key={a} onPress={() => set({ accent: a })} accessibilityRole="radio" accessibilityLabel={`Colour ${a}`} accessibilityState={{ selected: site.accent === a }}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: a, borderWidth: site.accent === a ? 3 : 0, borderColor: colours.text }} />
        ))}
      </View>

      <Label>Extra sections</Label>
      {site.sections.map((s, i) => (
        <View key={i} style={{ ...card, paddingVertical: 12, marginBottom: 10 }}>
          <Field label={`Section ${i + 1} heading`} value={s.heading} onChangeText={(v) => setSection(i, { heading: v })} placeholder="What we do" maxLength={80} />
          <Field label="Words" value={s.text} onChangeText={(v) => setSection(i, { text: v })} multiline maxLength={1200} style={{ minHeight: 80, textAlignVertical: 'top' }} />
          <Button title="Remove this section" kind="ghost" onPress={() => set({ sections: site.sections.filter((_, k) => k !== i) })} />
        </View>
      ))}
      {site.sections.length < 8 ? <Button title="Add a section" kind="ghost" onPress={() => set({ sections: [...site.sections, { heading: '', text: '' }] })} /> : null}

      <View style={{ height: 14 }} />
      <Label>What shows</Label>
      <View style={card}>
        {site.kind === 'business' ? <Line first icon="pricetags-outline" title="Your services and prices" sub="From Bookings" right={toggle(site.show_services, (v) => set({ show_services: v }), 'Show services')} /> : null}
        {site.kind === 'business' ? <Line icon="calendar-outline" title="A Book a time button" sub="Shows when your booking link is on" right={toggle(site.show_booking, (v) => set({ show_booking: v }), 'Show booking button')} /> : null}
        <Line first={site.kind === 'life'} icon="mail-outline" title="A contact form" sub={site.kind === 'business' ? 'Each message lands as a new lead' : 'Messages land here'} right={toggle(site.show_contact, (v) => set({ show_contact: v }), 'Show contact form')} />
      </View>
      {site.show_contact ? (
        <View style={{ marginTop: 14 }}>
          <Field label="Email to show (optional)" value={site.contact_email} onChangeText={(v) => set({ contact_email: v })} autoCapitalize="none" keyboardType="email-address" maxLength={200} />
          <Field label="Phone to show (optional)" value={site.contact_phone} onChangeText={(v) => set({ contact_phone: v })} keyboardType="phone-pad" maxLength={40} />
        </View>
      ) : <View style={{ height: 14 }} />}

      {error ? <ErrorText>{error}</ErrorText> : null}
      {note ? <Text style={{ color: colours.good, fontWeight: '700', marginBottom: 10 }}>{note}</Text> : null}
      <Button title={site.published ? 'Save changes' : 'Save'} busy={busy} onPress={() => save()} />
      {site.published
        ? <Button title="Take it offline" kind="ghost" onPress={() => save(false)} />
        : <Button title="Save and put it live" kind="ghost" onPress={() => save(true)} />}
      {has && slug ? <Button title="Copy my address" kind="ghost" onPress={async () => { await Clipboard.setStringAsync(`${SITE_BASE}${slug}`); setNote('Address copied.'); }} /> : null}

      <View style={{ ...card, marginTop: 8 }}>
        <Line first icon="link-outline" colour={colours.muted} title="Use my own domain" sub="A one-off unlock so your site sits at your own address" right={<Pill text="Coming soon" colour={colours.muted} />} />
      </View>

      {inbox.length ? (
        <>
          <View style={{ height: 18 }} />
          <Label>Messages from your site</Label>
          {inbox.map((e) => (
            <View key={e.id} style={{ ...card, paddingVertical: 12, marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ flex: 1, color: colours.text, fontSize: 15.5, fontWeight: '800' }}>{e.name}</Text>
                <Pressable onPress={() => confirm(e.id, async () => { await deleteEnquiry(e.id); setInbox((l) => l.filter((x) => x.id !== e.id)); })} accessibilityRole="button" accessibilityLabel={`Delete the message from ${e.name}`} hitSlop={8}>
                  {armed === e.id ? <Text style={{ color: colours.danger, fontWeight: '800', fontSize: 13 }}>Tap again</Text> : <Ionicons name="trash-outline" size={18} color={colours.muted} />}
                </Pressable>
              </View>
              <Sub>{[e.email, e.phone].filter(Boolean).join(', ')} · {new Date(e.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</Sub>
              {e.message ? <Text selectable style={{ color: colours.text, fontSize: 14.5, lineHeight: 21, marginTop: 6 }}>{e.message}</Text> : null}
            </View>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
