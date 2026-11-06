// Receipts (6 Nov 2026, asked for by Taj). A folder for receipts and invoices you pay: snap a photo
// or add a PDF, Tali reads it and fills in who, when and how much, and at tax time you download the
// whole financial year as one zip for your accountant.
// MOCKUP: adding and the zip are wired up once Taj approves the screen.
import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, ErrorText, Label, Screen, goBack } from '@/components/ui';
import { SkinHeader } from '@/components/PageSkin';
import { colours, elevation, radius, space } from '@/constants/theme';
import { RECEIPT_TYPES, financialYear, receipts as loadReceipts, type Receipt } from '@/lib/grow';

const aud = (n: number) => `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const monthName = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
const dayName = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });

export default function Receipts() {
  const [list, setList] = useState<Receipt[]>([]);
  const [type, setType] = useState<string>('All');
  const [error, setError] = useState('');
  const fy = financialYear();

  const load = useCallback(async () => {
    setError('');
    try {
      setList(await loadReceipts());
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your receipts.');
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const inFy = useMemo(() => list.filter((r) => r.date >= fy.start && r.date <= fy.end), [list, fy.start, fy.end]);
  const total = inFy.reduce((s, r) => s + r.amount, 0);
  const gst = inFy.reduce((s, r) => s + r.gst, 0);
  const shown = type === 'All' ? list : list.filter((r) => r.category === type);
  const months = useMemo(() => {
    const m: { key: string; items: Receipt[] }[] = [];
    for (const r of shown) {
      const key = r.date.slice(0, 7);
      const g = m.find((x) => x.key === key) ?? (m.push({ key, items: [] }), m[m.length - 1]);
      g.items.push(r);
    }
    return m;
  }, [shown]);

  return (
    <Screen skin="shoebox">
      <SkinHeader id="shoebox" title="Receipts" sub="Snap it, Tali files it. At tax time it's one download." onBack={() => goBack('/me')} backLabel="Back" />
      <ErrorText>{error}</ErrorText>

      <Card>
        <Text style={{ color: colours.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 }}>{fy.label} SO FAR</Text>
        <Text style={{ color: colours.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 }}>{aud(total)}</Text>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
          <Stat value={aud(gst)} label="GST in that" />
          <Stat value={String(inFy.length)} label={inFy.length === 1 ? 'receipt' : 'receipts'} />
        </View>
        <Pressable accessibilityRole="button" style={{ marginTop: space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: radius.pill, borderWidth: 1.5, borderColor: '#C98A1E' }}>
          <Ionicons name="download-outline" size={18} color="#8A5A0E" />
          <Text style={{ color: '#8A5A0E', fontWeight: '800', fontSize: 15 }}>Download {fy.label} for tax time</Text>
        </Pressable>
        <Text style={{ color: colours.faint, fontSize: 12, textAlign: 'center', marginTop: 6 }}>One zip with every file and a spreadsheet of the totals.</Text>
      </Card>

      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
        <AddButton icon="camera-outline" title="Snap a receipt" primary />
        <AddButton icon="document-attach-outline" title="Add a PDF" />
      </View>
      <Text style={{ color: colours.muted, fontSize: 12.5, lineHeight: 18, marginTop: space.sm }}>Tali reads it and fills in who, when, how much and the GST. You check it before it's saved.</Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.lg }}>
        {['All', ...RECEIPT_TYPES].map((t) => {
          const on = t === type;
          return (
            <Pressable key={t} onPress={() => setType(t)} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: on ? '#6E4A0C' : colours.surface, borderWidth: 1, borderColor: on ? '#6E4A0C' : colours.border, ...(on ? elevation.button('#6E4A0C') : elevation.lift) }}>
              <Text style={{ color: on ? '#fff' : colours.text, fontWeight: '700', fontSize: 13 }}>{t}</Text>
            </Pressable>
          );
        })}
      </View>

      {months.map((g) => (
        <View key={g.key}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: space.lg }}>
            <Label>{monthName(g.key + '-01')}</Label>
            <Text style={{ color: colours.muted, fontSize: 13, fontWeight: '700' }}>{aud(g.items.reduce((s, r) => s + r.amount, 0))}</Text>
          </View>
          <Card style={{ paddingVertical: 4 }}>
            {g.items.map((r, i) => (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: colours.border }}>
                <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#F7F0E2', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={r.file_kind === 'pdf' ? 'document-text-outline' : 'image-outline'} size={19} color="#8A5A0E" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colours.text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>{r.vendor}</Text>
                  <Text style={{ color: colours.muted, fontSize: 12.5, marginTop: 1 }}>{r.category} · {dayName(r.date)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: colours.text, fontWeight: '800', fontSize: 15 }}>{aud(r.amount)}</Text>
                  {r.gst ? <Text style={{ color: colours.faint, fontSize: 11.5, marginTop: 1 }}>GST {aud(r.gst)}</Text> : null}
                </View>
              </View>
            ))}
          </Card>
        </View>
      ))}
      {list.length === 0 ? <Text style={{ color: colours.muted, textAlign: 'center', marginTop: space.lg }}>No receipts yet. Snap your first one and Tali does the rest.</Text> : null}
      <View style={{ height: space.xl }} />
    </Screen>
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

function AddButton({ icon, title, primary }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; primary?: boolean }) {
  return (
    <Pressable accessibilityRole="button" style={{ flex: 1, height: 50, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: primary ? '#6E4A0C' : colours.surface, borderWidth: primary ? 0 : 1, borderColor: colours.border, ...(primary ? elevation.button('#6E4A0C') : elevation.lift) }}>
      <Ionicons name={icon} size={19} color={primary ? '#fff' : colours.text} />
      <Text style={{ color: primary ? '#fff' : colours.text, fontWeight: '800', fontSize: 15 }}>{title}</Text>
    </Pressable>
  );
}
