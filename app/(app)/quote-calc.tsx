// 12 Nov 2026 (Taj): Quote calculator. Part of the Business plans. The owner sets a starting price and
// a few things a customer can pick. Tali HQ hosts it at talihq.com.au/quote/<name>. A request lands in
// the Pipeline as a new lead with what they picked and the rough price.
import { useCallback, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/lib/auth';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { myCredits, type Credits } from '@/lib/data';
import { cleanSlug } from '@/lib/bookings';
import { blankCalc, estimate, KIND_LABEL, money, myCalc, newItem, QUOTE_BASE, saveCalc, writeCalc, type Calc, type CalcItem } from '@/lib/calc';
import { hasBusinessTools } from '@/lib/plan';
import { Button, ErrorText, Field, Label, Loading, Screen } from '@/components/ui';
import { BLUE, Head, Pill, Sub, TaliLine } from '@/components/Biz';
import { BizLock } from '@/components/BizLock';
import { colours, radius } from '@/constants/theme';

const dollars = (v: string) => { const n = Number(v.replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : 0; };

export default function QuoteCalc() {
  const { session } = useAuth();
  const [credits, setCredits] = useState<Credits | null>(null);
  const [calc, setCalc] = useState<Calc>(blankCalc());
  const [has, setHas] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState('');
  const [writing, setWriting] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const ok = hasBusinessTools(credits, session?.user.id);

  const load = useCallback(async () => {
    setError('');
    try {
      const c = await myCredits();
      setCredits(c);
      if (hasBusinessTools(c, session?.user.id)) {
        const mine = await myCalc();
        if (mine) { setCalc(mine); setHas(true); }
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load your calculator.'); }
    setLoaded(true);
  }, [session?.user.id]);
  useFocusLoad(load); // Speed pass (13 Nov 2026): see lib/useFocusLoad.ts

  const set = (patch: Partial<Calc>) => { setCalc((c) => ({ ...c, ...patch })); setNote(''); };
  const setItem = (id: string, patch: Partial<CalcItem>) => set({ items: calc.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) });

  async function save(enabled?: boolean) {
    if (!session) return;
    setError(''); setNote(''); setBusy(true);
    try {
      const next = { ...calc, ...(enabled === undefined ? {} : { enabled }) };
      await saveCalc(session.user.id, next);
      setCalc({ ...next, slug: cleanSlug(next.slug) }); setHas(true);
      setNote(next.enabled ? 'Saved. Your calculator is live.' : 'Saved. Switch it on when you are ready.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save that.'); }
    setBusy(false);
  }

  // Tali sets up the things to pick from a description. Nothing is saved until the owner saves.
  async function write() {
    setError(''); setNote(''); setWriting(true);
    const res = await writeCalc(ask);
    setWriting(false);
    if (!res.ok) return setError(res.message);
    setCalc((c) => ({ ...c, title: res.draft.title || c.title, intro: res.draft.intro || c.intro, base: res.draft.base || c.base, items: res.draft.items }));
    setNote('Tali has set it up below. Check every price, change what you like, then save.');
  }

  if (!loaded) return <Loading />;
  if (!ok) {
    return <BizLock title="Quote calculator" sub="A page where customers pick what they want and see a rough price, then send it to you."
      points={[
        { icon: 'calculator-outline', title: 'A rough price in seconds', sub: 'A starting price plus the things that change it' },
        { icon: 'funnel-outline', title: 'It lands in your Pipeline', sub: 'A new lead with what they picked and the estimate' },
        { icon: 'sparkles-outline', title: 'Tali can set it up', sub: 'Tell her how you price your work and she drafts it' },
      ]} />;
  }

  const slug = cleanSlug(calc.slug);
  const card = { backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10 } as const;
  const kinds: CalcItem['kind'][] = ['qty', 'tick', 'choice'];
  // What a customer would see with one of everything, so the owner can sanity check the sums.
  const sample = estimate(calc, Object.fromEntries(calc.items.map((i) => [i.id, i.kind === 'tick' ? true : i.kind === 'qty' ? 1 : 0])));
  return (
    <Screen onRefresh={load}>
      <Head over="Business" title="Quote calculator" sub="Customers pick what they want and see a rough price. Their request lands in your Pipeline." />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Pill text={calc.enabled ? 'Live' : has ? 'Switched off' : 'Not set up yet'} colour={calc.enabled ? '#7FE0B0' : '#FFB561'} />
        <Text selectable numberOfLines={1} style={{ flex: 1, color: BLUE, fontSize: 13.5, fontWeight: '800' }}>{QUOTE_BASE}{slug || 'your-name'}</Text>
      </View>
      {!has ? <TaliLine>Tell me how you price your work and I will set it up. Or add the things to pick yourself below.</TaliLine> : null}

      <View style={card}>
        <Text style={{ color: colours.text, fontSize: 15.5, fontWeight: '800' }}>Ask Tali to set it up</Text>
        <Sub>She only uses prices you give her. Anything without a price is left at A$0 for you to fill in.</Sub>
        <View style={{ height: 10 }} />
        <Field value={ask} onChangeText={setAsk} placeholder="Like: call out A$90, lawns A$60 each, hedges A$45 an hour, green waste removal A$40" accessibilityLabel="How you price your work" multiline maxLength={1500} style={{ minHeight: 70, textAlignVertical: 'top' }} />
        <Button title={writing ? 'Tali is setting it up...' : calc.items.length ? 'Set it up again' : 'Set it up for me'} kind="ghost" busy={writing} onPress={write} />
        {calc.items.length ? <Text style={{ color: colours.faint, fontSize: 12.5, marginTop: 6 }}>This replaces the things to pick below.</Text> : null}
      </View>

      <Field label="Your link name" value={calc.slug} onChangeText={(v) => set({ slug: v })} placeholder="your-name" autoCapitalize="none" autoCorrect={false} maxLength={40} />
      <Field label="Heading" value={calc.title} onChangeText={(v) => set({ title: v })} placeholder="Get a rough price" maxLength={80} />
      <Field label="A line or two under it" value={calc.intro} onChangeText={(v) => set({ intro: v })} placeholder="Pick what you need for a guide price. I will confirm it before any work starts." multiline maxLength={400} style={{ minHeight: 70, textAlignVertical: 'top' }} />
      <Field label="Starting price (A$)" value={calc.base ? String(calc.base) : ''} onChangeText={(v) => set({ base: dollars(v) })} placeholder="0" keyboardType="decimal-pad" maxLength={10} />

      <Label>Things to pick</Label>
      {calc.items.map((it, n) => (
        <View key={it.id} style={card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Text style={{ flex: 1, color: colours.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>{`PICK ${n + 1}`}</Text>
            <Pressable onPress={() => set({ items: calc.items.filter((x) => x.id !== it.id) })} accessibilityRole="button" accessibilityLabel={`Remove ${it.label || `pick ${n + 1}`}`} hitSlop={8}><Ionicons name="trash-outline" size={18} color={colours.muted} /></Pressable>
          </View>
          <Field label="What they are picking" value={it.label} onChangeText={(v) => setItem(it.id, { label: v })} placeholder="Lawns to mow" maxLength={80} />
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {kinds.map((k) => (
              <Pressable key={k} onPress={() => setItem(it.id, { kind: k, choices: k === 'choice' && it.choices.length < 2 ? [{ label: '', price: 0 }, { label: '', price: 0 }] : it.choices })} accessibilityRole="radio" accessibilityState={{ selected: it.kind === k }}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.pill, backgroundColor: it.kind === k ? BLUE : colours.bg, borderWidth: 1, borderColor: it.kind === k ? BLUE : colours.border }}>
                <Text style={{ color: it.kind === k ? '#141033' : colours.text, fontWeight: '800', fontSize: 12.5 }}>{KIND_LABEL[k]}</Text>
              </Pressable>
            ))}
          </View>
          {it.kind === 'qty' ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Field label="Price each (A$)" value={it.price ? String(it.price) : ''} onChangeText={(v) => setItem(it.id, { price: dollars(v) })} placeholder="0" keyboardType="decimal-pad" maxLength={10} /></View>
              <View style={{ flex: 1 }}><Field label="Counted in" value={it.unit} onChangeText={(v) => setItem(it.id, { unit: v })} placeholder="lawns" maxLength={20} /></View>
            </View>
          ) : null}
          {it.kind === 'tick' ? <Field label="Price if they tick it (A$)" value={it.price ? String(it.price) : ''} onChangeText={(v) => setItem(it.id, { price: dollars(v) })} placeholder="0" keyboardType="decimal-pad" maxLength={10} /> : null}
          {it.kind === 'choice' ? (
            <>
              {it.choices.map((ch, k) => (
                <View key={k} style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 2 }}><Field label={`Option ${k + 1}`} value={ch.label} onChangeText={(v) => setItem(it.id, { choices: it.choices.map((c, j) => (j === k ? { ...c, label: v } : c)) })} placeholder={k ? 'Large yard' : 'Small yard'} maxLength={60} /></View>
                  <View style={{ flex: 1 }}><Field label="A$" value={ch.price ? String(ch.price) : ''} onChangeText={(v) => setItem(it.id, { choices: it.choices.map((c, j) => (j === k ? { ...c, price: dollars(v) } : c)) })} placeholder="0" keyboardType="decimal-pad" maxLength={10} /></View>
                </View>
              ))}
              {it.choices.length < 6 ? <Button title="Add an option" kind="ghost" onPress={() => setItem(it.id, { choices: [...it.choices, { label: '', price: 0 }] })} /> : null}
            </>
          ) : null}
        </View>
      ))}
      {calc.items.length < 20 ? (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {kinds.map((k) => (
            <Pressable key={k} onPress={() => set({ items: [...calc.items, newItem(k)] })} accessibilityRole="button" accessibilityLabel={`Add a ${KIND_LABEL[k].toLowerCase()} pick`}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: radius.pill, backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.border }}>
              <Text style={{ color: colours.text, fontWeight: '800', fontSize: 12.5 }}>+ {KIND_LABEL[k]}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {calc.items.length || calc.base ? <TaliLine>With one of everything, a customer would see about {money(sample)}.</TaliLine> : null}

      <View style={{ ...card, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colours.text, fontSize: 15.5, fontWeight: '800' }}>Taking quote requests</Text>
          <Sub>Each request is a guide price. Nothing is promised until you say so.</Sub>
        </View>
        <Switch value={calc.enabled} onValueChange={(v) => set({ enabled: v })} accessibilityLabel="Taking quote requests" trackColor={{ true: colours.purple, false: colours.borderStrong }} thumbColor="#FFFFFF" {...({ activeThumbColor: '#FFFFFF' } as object)} />
      </View>

      {error ? <ErrorText>{error}</ErrorText> : null}
      {note ? <Text style={{ color: colours.good, fontWeight: '700', marginBottom: 10 }}>{note}</Text> : null}
      <Button title="Save" busy={busy} onPress={() => save()} />
      {has && slug ? <Button title="Copy my link" kind="ghost" onPress={async () => { await Clipboard.setStringAsync(`${QUOTE_BASE}${slug}`); setNote('Link copied.'); }} /> : null}
      <Text style={{ color: colours.faint, fontSize: 12.5, marginTop: 8, lineHeight: 18 }}>When your business website is live, it shows a Get a quote button that opens this page.</Text>
    </Screen>
  );
}
