// Receipts (6 Nov 2026, asked for by Taj). A folder for receipts and invoices you pay: snap a photo
// or add a file, Tali reads it and fills in who, when and how much, you check it and save it. At tax
// time the whole financial year downloads as one zip with a spreadsheet of the totals.
// Tali HQ and Pro. Reading costs no credits. Files: the private receipts bucket under <user id>/.
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, ErrorText, Field, Label, Screen, TaliSays, goBack, useConfirm } from '@/components/ui';
import { SkinHeader } from '@/components/PageSkin';
import { colours, elevation, radius, space } from '@/constants/theme';
import { myCredits } from '@/lib/data';
import { isPaid } from '@/lib/plan';
import { pickFiles } from '@/lib/pickFiles';
import {
  RECEIPT_TYPES, deleteReceipt, discardReceiptFile, financialYear, readReceipt, receiptLink, receipts as loadReceipts,
  receiptsZip, saveReceipt, uploadReceipt, type Receipt,
} from '@/lib/grow';

const BROWN = '#6E4A0C';
const aud = (n: number) => `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const monthName = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
const dayName = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
const todayIso = () => new Intl.DateTimeFormat('en-CA').format(new Date());

type Draft = { path: string; file_kind: 'image' | 'pdf'; vendor: string; date: string; amount: string; gst: string; category: Receipt['category'] };

export default function Receipts() {
  const [paid, setPaid] = useState<boolean | null>(null);
  const [list, setList] = useState<Receipt[]>([]);
  const [type, setType] = useState<string>('All');
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);
  const { armed, confirm } = useConfirm();
  const fy = financialYear();

  const load = useCallback(async () => {
    setError('');
    try {
      const c = await myCredits();
      const p = isPaid(c);
      setPaid(p);
      if (p) setList(await loadReceipts());
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your receipts.');
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const inFy = useMemo(() => list.filter((r) => r.date >= fy.start && r.date <= fy.end), [list, fy.start, fy.end]);
  const total = inFy.reduce((s, r) => s + Number(r.amount), 0);
  const gst = inFy.reduce((s, r) => s + Number(r.gst), 0);
  const shown = type === 'All' ? list : list.filter((r) => r.category === type);
  const months = useMemo(() => {
    const m: { key: string; items: Receipt[] }[] = [];
    for (const r of shown) {
      const key = r.date.slice(0, 7);
      let g = m.find((x) => x.key === key);
      if (!g) m.push((g = { key, items: [] }));
      g.items.push(r);
    }
    return m;
  }, [shown]);

  async function add(source: 'camera' | 'file') {
    setError('');
    const files = await pickFiles(source, 1).catch((e) => { setError(e?.message ?? 'Could not open that.'); return []; });
    if (!files.length) return;
    setReading(true);
    try {
      const up = await uploadReceipt(files[0]);
      const res = await readReceipt(up.path);
      const r = res.ok ? res.receipt : null;
      if (!res.ok) setError(res.message);
      setDraft({
        path: up.path,
        file_kind: up.kind,
        vendor: r?.vendor ?? '',
        date: r?.date || todayIso(),
        amount: r?.amount ? r.amount.toFixed(2) : '',
        gst: r?.gst ? r.gst.toFixed(2) : '',
        category: r?.category ?? 'Other',
      });
    } catch (e: any) {
      setError(e?.message ?? 'Could not add that receipt.');
    }
    setReading(false);
  }

  async function save() {
    if (!draft) return;
    const amount = Number(draft.amount.replace(/[$,\s]/g, ''));
    const g = Number((draft.gst || '0').replace(/[$,\s]/g, ''));
    if (!draft.vendor.trim()) return setError('Add who you paid.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return setError('Write the date as YYYY-MM-DD.');
    if (!Number.isFinite(amount) || amount <= 0) return setError('Add the amount you paid.');
    if (!Number.isFinite(g) || g < 0 || g > amount) return setError('The GST looks wrong. Leave it blank if there was none.');
    setSaving(true);
    setError('');
    try {
      await saveReceipt({ vendor: draft.vendor.trim(), date: draft.date, amount, gst: g, category: draft.category, file_kind: draft.file_kind, path: draft.path });
      setDraft(null);
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save that receipt.');
    }
    setSaving(false);
  }

  async function cancel() {
    if (draft) await discardReceiptFile(draft.path).catch(() => null);
    setDraft(null);
    setError('');
  }

  async function view(r: Receipt) {
    const url = await receiptLink(r.path);
    if (url) Platform.OS === 'web' ? window.open(url, '_blank') : Linking.openURL(url);
  }

  async function download() {
    setZipping(true);
    setError('');
    const res = await receiptsZip(fy.start, fy.end);
    setZipping(false);
    if (!res.ok) return setError(res.message);
    Platform.OS === 'web' ? window.location.assign(res.url) : Linking.openURL(res.url);
  }

  if (paid === false) {
    return (
      <Screen skin="shoebox">
        <SkinHeader id="shoebox" title="Receipts" onBack={() => goBack('/me')} backLabel="Back" />
        <TaliSays pose="think">Receipts are part of Tali HQ. Snap a receipt, I read it and file it, and at tax time it's one download for your accountant.</TaliSays>
        <Button title="See plans" onPress={() => router.navigate('/plans')} />
      </Screen>
    );
  }

  return (
    <Screen skin="shoebox" onRefresh={load}>
      <SkinHeader id="shoebox" title="Receipts" sub="Snap it, Tali files it. At tax time it's one download." onBack={() => goBack('/me')} backLabel="Back" />

      {draft ? (
        <Card style={{ borderWidth: 2, borderColor: '#C98A1E' }}>
          <Text style={{ color: '#8A5A0E', fontSize: 12, fontWeight: '800', letterSpacing: 0.6 }}>CHECK THIS BEFORE IT'S SAVED</Text>
          <Text style={{ color: colours.muted, fontSize: 13, marginTop: 2, marginBottom: space.md }}>Here's what I read. Fix anything I got wrong.</Text>
          <Field label="Who you paid" value={draft.vendor} onChangeText={(v) => setDraft({ ...draft, vendor: v })} placeholder="e.g. Officeworks" maxLength={120} />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}><Field label="Date" value={draft.date} onChangeText={(v) => setDraft({ ...draft, date: v })} placeholder="YYYY-MM-DD" /></View>
            <View style={{ flex: 1 }}><Field label="Total" value={draft.amount} onChangeText={(v) => setDraft({ ...draft, amount: v })} placeholder="0.00" keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label="GST" value={draft.gst} onChangeText={(v) => setDraft({ ...draft, gst: v })} placeholder="0.00" keyboardType="decimal-pad" /></View>
          </View>
          <Label>Type</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: space.md }}>
            {RECEIPT_TYPES.map((t) => <Chip key={t} text={t} on={draft.category === t} onPress={() => setDraft({ ...draft, category: t })} />)}
          </View>
          <ErrorText>{error}</ErrorText>
          <Button title="Save receipt" onPress={save} busy={saving} />
          <Pressable onPress={cancel} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: space.sm }}>
            <Text style={{ color: colours.muted, fontWeight: '700' }}>Cancel</Text>
          </Pressable>
        </Card>
      ) : (
        <>
          <Card>
            <Text style={{ color: colours.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 }}>{fy.label} SO FAR</Text>
            <Text style={{ color: colours.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 }}>{aud(total)}</Text>
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
              <Stat value={aud(gst)} label="GST in that" />
              <Stat value={String(inFy.length)} label={inFy.length === 1 ? 'receipt' : 'receipts'} />
            </View>
            <Pressable onPress={download} disabled={zipping || !inFy.length} accessibilityRole="button" style={{ marginTop: space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: radius.pill, borderWidth: 1.5, borderColor: '#C98A1E', opacity: inFy.length ? 1 : 0.5 }}>
              {zipping ? <ActivityIndicator color="#8A5A0E" /> : <Ionicons name="download-outline" size={18} color="#8A5A0E" />}
              <Text style={{ color: '#8A5A0E', fontWeight: '800', fontSize: 15 }}>{zipping ? 'Putting it together' : `Download ${fy.label} for tax time`}</Text>
            </Pressable>
            <Text style={{ color: colours.faint, fontSize: 12, textAlign: 'center', marginTop: 6 }}>One zip with every file and a spreadsheet of the totals.</Text>
          </Card>

          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
            <AddButton icon="camera-outline" title={Platform.OS === 'web' ? 'Add a photo' : 'Snap a receipt'} primary onPress={() => add('camera')} disabled={reading} />
            <AddButton icon="document-attach-outline" title="Add a file" onPress={() => add('file')} disabled={reading} />
          </View>
          {reading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm }}>
              <ActivityIndicator color={BROWN} />
              <Text style={{ color: colours.muted, fontSize: 13 }}>Reading it now...</Text>
            </View>
          ) : (
            <Text style={{ color: colours.muted, fontSize: 12.5, lineHeight: 18, marginTop: space.sm }}>Tali reads it and fills in who, when, how much and the GST. You check it before it's saved.</Text>
          )}
          <ErrorText>{error}</ErrorText>
        </>
      )}

      {list.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.lg }}>
          {['All', ...RECEIPT_TYPES].map((t) => <Chip key={t} text={t} on={t === type} onPress={() => setType(t)} />)}
        </View>
      ) : null}

      {months.map((g) => (
        <View key={g.key}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: space.lg }}>
            <Label>{monthName(g.key + '-01')}</Label>
            <Text style={{ color: colours.muted, fontSize: 13, fontWeight: '700' }}>{aud(g.items.reduce((s, r) => s + Number(r.amount), 0))}</Text>
          </View>
          <Card style={{ paddingVertical: 4 }}>
            {g.items.map((r, i) => (
              <View key={r.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: colours.border }}>
                <Pressable onPress={() => setOpen(open === r.id ? null : r.id)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 11 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#F7F0E2', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={r.file_kind === 'pdf' ? 'document-text-outline' : 'image-outline'} size={19} color="#8A5A0E" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colours.text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>{r.vendor}</Text>
                    <Text style={{ color: colours.muted, fontSize: 12.5, marginTop: 1 }}>{r.category} · {dayName(r.date)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: colours.text, fontWeight: '800', fontSize: 15 }}>{aud(Number(r.amount))}</Text>
                    {Number(r.gst) ? <Text style={{ color: colours.faint, fontSize: 11.5, marginTop: 1 }}>GST {aud(Number(r.gst))}</Text> : null}
                  </View>
                </Pressable>
                {open === r.id ? (
                  <View style={{ flexDirection: 'row', gap: space.lg, paddingBottom: space.md, paddingLeft: 38 + space.md }}>
                    <Pressable onPress={() => view(r)} accessibilityRole="button" hitSlop={8}>
                      <Text style={{ color: '#8A5A0E', fontWeight: '800' }}>View file</Text>
                    </Pressable>
                    <Pressable onPress={() => confirm(r.id, () => deleteReceipt(r).then(load).catch((e) => setError(e.message)))} accessibilityRole="button" hitSlop={8}>
                      <Text style={{ color: armed === r.id ? colours.danger : colours.muted, fontWeight: '800' }}>{armed === r.id ? 'Tap again to delete' : 'Delete'}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))}
          </Card>
        </View>
      ))}
      {paid && list.length === 0 && !draft ? <Text style={{ color: colours.muted, textAlign: 'center', marginTop: space.lg }}>No receipts yet. Snap your first one and Tali does the rest.</Text> : null}
      <View style={{ height: space.xl }} />
    </Screen>
  );
}

function Chip({ text, on, onPress }: { text: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: on ? BROWN : colours.surface, borderWidth: 1, borderColor: on ? BROWN : colours.border, ...(on ? elevation.button(BROWN) : elevation.lift) }}>
      <Text style={{ color: on ? '#fff' : colours.text, fontWeight: '700', fontSize: 13 }}>{text}</Text>
    </Pressable>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#F7F0E2', borderRadius: 12, padding: space.sm, paddingHorizontal: space.md }}>
      <Text style={{ color: colours.text, fontWeight: '800', fontSize: 17 }}>{value}</Text>
      <Text style={{ color: colours.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

function AddButton({ icon, title, primary, onPress, disabled }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; primary?: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={{ flex: 1, height: 50, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: disabled ? 0.6 : 1, backgroundColor: primary ? BROWN : colours.surface, borderWidth: primary ? 0 : 1, borderColor: colours.border, ...(primary ? elevation.button(BROWN) : elevation.lift) }}>
      <Ionicons name={icon} size={19} color={primary ? '#fff' : colours.text} />
      <Text style={{ color: primary ? '#fff' : colours.text, fontWeight: '800', fontSize: 15 }}>{title}</Text>
    </Pressable>
  );
}
