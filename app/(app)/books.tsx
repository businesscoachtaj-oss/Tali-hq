// 12 Nov 2026 (Taj): Bookkeeping pack. A quarter of the business on one page, ready to send to the
// accountant. Part of the Business plans. A summary for records, not tax advice.
import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { myCredits, type Credits, type Invoice } from '@/lib/data';
import { type Receipt } from '@/lib/grow';
import { aud2, buildPack, loadBooks, quarters, sharePack } from '@/lib/books';
import { today } from '@/lib/dates';
import { hasBusinessTools } from '@/lib/plan';
import { Button, ErrorText, Label, Loading, Screen } from '@/components/ui';
import { BLUE, Head, Line, Stats, TaliLine } from '@/components/Biz';
import { BusinessBar, useBusinesses } from '@/lib/businesses';
import { BizLock } from '@/components/BizLock';
import { colours, radius } from '@/constants/theme';

export default function Books() {
  const { session, profile } = useAuth();
  const [credits, setCredits] = useState<Credits | null>(null);
  const [allInv, setInv] = useState<Invoice[]>([]);
  const [allRec, setRec] = useState<Receipt[]>([]);
  // 12 Nov 2026: more than one business. Only this business's (or all of them together).
  const biz = useBusinesses();
  const inv = allInv.filter(biz.visible);
  const rec = allRec.filter(biz.visible);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const list = useMemo(() => quarters(today()), []);
  const [key, setKey] = useState(list[0].key);
  const ok = hasBusinessTools(credits, session?.user.id);

  const load = useCallback(async () => {
    setError('');
    try {
      const c = await myCredits();
      setCredits(c);
      if (hasBusinessTools(c, session?.user.id)) {
        const b = await loadBooks();
        setInv(b.invoices); setRec(b.receipts);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load your books.'); }
    setLoaded(true);
  }, [session?.user.id]);
  useFocusLoad(load); // Speed pass (13 Nov 2026): see lib/useFocusLoad.ts

  const q = list.find((x) => x.key === key) ?? list[0];
  const pack = useMemo(() => buildPack(q, inv, rec), [q, inv, rec]);

  if (!loaded) return <Loading />;
  if (!ok) {
    return <BizLock title="Bookkeeping pack" sub="A quarter of your business on one page, ready for your accountant. Made from the invoices and receipts you already keep here."
      points={[
        { icon: 'trending-up-outline', title: 'Money in and money out', sub: 'Paid invoices and receipts, with the GST on each' },
        { icon: 'document-text-outline', title: 'One PDF to send', sub: 'Every invoice and receipt for the quarter, listed and totalled' },
        { icon: 'information-circle-outline', title: 'For your records', sub: 'A summary to hand over. It is not tax advice' },
      ]} />;
  }

  const empty = !pack.paid.length && !pack.spent.length && !pack.owed.length;
  const card = { backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, paddingHorizontal: 14 } as const;
  const name = (profile as any)?.business_name || (profile as any)?.first_name || '';
  return (
    <Screen onRefresh={load}>
      <BusinessBar />
      <Head over="Business" title="Bookkeeping pack" sub="A quarter on one page, made from your invoices and receipts. For your records and your accountant. It is not tax advice." />
      <Label>Which quarter</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {list.map((x) => (
          <Pressable key={x.key} onPress={() => setKey(x.key)} accessibilityRole="radio" accessibilityState={{ selected: key === x.key }}
            style={{ borderRadius: radius.pill, paddingVertical: 9, paddingHorizontal: 14, backgroundColor: key === x.key ? BLUE : colours.surface, borderWidth: 1, borderColor: key === x.key ? BLUE : colours.border }}>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: key === x.key ? '#141033' : colours.text }}>{x.label}</Text>
          </Pressable>
        ))}
      </View>
      <Stats items={[{ label: 'Money in', value: aud2(pack.income), colour: '#7FE0B0' }, { label: 'Money out', value: aud2(pack.expenses) }]} />
      <Stats items={[{ label: 'GST collected', value: aud2(pack.gstCollected) }, { label: 'GST paid', value: aud2(pack.gstPaid) }]} />
      {empty ? <TaliLine>Nothing is saved for this quarter yet. Paid invoices and receipts show up here as you add them.</TaliLine> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Label>What is in it</Label>
      <View style={card}>
        <Line first icon="document-text-outline" title="Invoices paid" sub={`${pack.paid.length} paid this quarter`} right={<Text style={{ color: colours.text, fontWeight: '800' }}>{aud2(pack.income)}</Text>} />
        <Line icon="camera-outline" title="Receipts" sub={pack.byCategory.length ? pack.byCategory.slice(0, 3).map((c) => `${c.category} ${aud2(c.amount)}`).join(', ') : `${pack.spent.length} dated this quarter`} right={<Text style={{ color: colours.text, fontWeight: '800' }}>{aud2(pack.expenses)}</Text>} />
        <Line icon="time-outline" title="Still owed to you" sub={`${pack.owed.length} sent this quarter and not paid`} colour={pack.owed.length ? '#FFB561' : BLUE} right={<Text style={{ color: colours.text, fontWeight: '800' }}>{aud2(pack.outstanding)}</Text>} />
      </View>
      <View style={{ height: 14 }} />
      <Button title={`Share the ${q.label} pack`} busy={busy} disabled={empty} onPress={async () => { setBusy(true); setError(''); try { await sharePack(pack, name); } catch { setError('Could not make the PDF. Try again.'); } setBusy(false); }} />
      <Button title="Add a receipt" kind="ghost" onPress={() => router.push('/receipts')} />
      <Text style={{ color: colours.faint, fontSize: 12.5, marginTop: 8, lineHeight: 18 }}>Amounts include GST. Paid invoices count in the quarter they were paid. Check the figures with your accountant before lodging anything.</Text>
    </Screen>
  );
}
