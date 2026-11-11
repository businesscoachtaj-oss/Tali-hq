// Personal money (11 Nov 2026, asked for by Taj): the Personal side of Money. What is left to
// spend this week, the month by category against budgets, recent spends and bills that repeat.
// Spends come in by telling Tali, snapping a receipt or typing them in. Nothing here moves money.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Body, Button, Card, ErrorText, Field, Label, TaliSays, useConfirm } from '@/components/ui';
import { colours, elevation, radius, space } from '@/constants/theme';
import { friendlyDate } from '@/lib/dates';
import { discardReceiptFile, readReceipt, uploadReceipt } from '@/lib/grow';
import { pickFiles } from '@/lib/pickFiles';
import {
  SPEND_CATEGORIES, addRepeat, addSpend, cents, deleteRepeat, deleteSpend, dollars, loadPersonalMoney, localToday, saveBudgets,
  taliPersonalLine, updateSpend, type PersonalMoney as Picture, type Repeat, type Spend,
} from '@/lib/personalMoney';

const BAR: Record<string, string> = {
  Groceries: '#B9A6FF', Rent: '#7FD1FF', Bills: '#9FB7FF', 'Eating out': '#FFC37A', Transport: '#FFB561', Fun: '#7FE0B0', Health: '#8EF0C8', Shopping: '#FF9EC7', Other: '#C9C2EE',
};
const SOURCE: Record<Spend['source'], string> = { tali: 'told Tali', receipt: 'receipt', manual: 'typed in', repeat: 'repeats' };
const EVERY: Record<Repeat['every'], string> = { week: 'every week', fortnight: 'every fortnight', month: 'every month' };

const num = (s: string) => {
  const n = Number(String(s).replace(/[^0-9.]/g, ''));
  return String(s).trim() === '' || !Number.isFinite(n) ? null : n;
};

type Draft = { id?: string; description: string; amount: string; local_date: string; category: string; source: 'manual' | 'receipt' };

export function PersonalMoney({ refreshKey }: { refreshKey: number }) {
  const [pic, setPic] = useState<Picture | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [budgeting, setBudgeting] = useState(false);
  const [weekly, setWeekly] = useState('');
  const [budgets, setBudgets] = useState<Record<string, string>>({});
  const [bill, setBill] = useState<{ description: string; amount: string; category: string; every: Repeat['every']; next_date: string } | null>(null);
  const confirm = useConfirm();

  const load = useCallback(async () => {
    try {
      setPic(await loadPersonalMoney());
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your personal money.');
    }
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  function openBudgets() {
    if (!pic) return;
    setWeekly(pic.weeklyAmount != null ? String(pic.weeklyAmount) : '');
    const b: Record<string, string> = {};
    for (const c of SPEND_CATEGORIES) {
      const line = pic.categories.find((x) => x.category === c);
      b[c] = line?.budget != null ? String(line.budget) : '';
    }
    setBudgets(b);
    setError('');
    setBudgeting(true);
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'That did not work. Try again.');
    }
    setBusy(false);
  }

  async function snap(source: 'camera' | 'file') {
    setError('');
    const files = await pickFiles(source, 1).catch((e) => { setError(e?.message ?? 'Could not open that.'); return []; });
    if (!files.length) return;
    setReading(true);
    try {
      const up = await uploadReceipt(files[0]);
      const res = await readReceipt(up.path);
      // The photo is only read, never kept: personal receipts stay out of the business receipts list.
      await discardReceiptFile(up.path).catch(() => {});
      const r = res.ok ? res.receipt : null;
      if (!res.ok) setError(res.message);
      setDraft({ description: r?.vendor ?? '', amount: r?.amount ? r.amount.toFixed(2) : '', local_date: r?.date && r.date <= localToday() ? r.date : localToday(), category: 'Other', source: 'receipt' });
    } catch (e: any) {
      setError(e?.message ?? 'Could not read that receipt. You can type it in.');
    }
    setReading(false);
  }

  function saveDraft() {
    if (!draft) return;
    const amount = num(draft.amount);
    if (!draft.description.trim()) return setError('Add what it was for.');
    if (amount == null || amount <= 0) return setError('Add how much it was.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.local_date) || draft.local_date > localToday()) return setError('Write the date as YYYY-MM-DD, today or earlier.');
    const row = { amount, description: draft.description.trim().slice(0, 120), category: draft.category, local_date: draft.local_date };
    run(async () => {
      if (draft.id) await updateSpend(draft.id, row);
      else await addSpend({ ...row, source: draft.source });
      setDraft(null);
    });
  }

  function saveBudgetForm() {
    const w = num(weekly);
    const b: Record<string, number | null> = {};
    for (const c of SPEND_CATEGORIES) b[c] = num(budgets[c] ?? '');
    run(async () => {
      await saveBudgets(w, b);
      setBudgeting(false);
    });
  }

  function saveBill() {
    if (!bill) return;
    const amount = num(bill.amount);
    if (!bill.description.trim()) return setError('Add what the bill is.');
    if (amount == null || amount <= 0) return setError('Add how much it is.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bill.next_date)) return setError('Write the next date as YYYY-MM-DD.');
    run(async () => {
      await addRepeat({ description: bill.description.trim().slice(0, 120), amount, category: bill.category, every: bill.every, next_date: bill.next_date });
      setBill(null);
    });
  }

  if (!pic) return error ? <Card><Body muted>{error}</Body></Card> : <ActivityIndicator color={colours.purple} style={{ marginTop: space.lg }} />;

  const left = pic.weeklyAmount != null ? pic.weeklyAmount - pic.weekSpent : null;
  const biggest = pic.categories.find((c) => c.spent > 0);
  const over = left != null && left < 0;

  return (
    <>
      <TaliSays pose="idle">{taliPersonalLine(pic)}</TaliSays>

      <Card>
        <Text style={tileLabel}>Left to spend this week</Text>
        {left != null ? (
          <>
            <Text style={{ fontSize: 38, fontWeight: '800', color: over ? colours.danger : colours.good, marginTop: 2 }}>{over ? `${dollars(-left)} over` : dollars(left)}</Text>
            <Text style={tileSub}>{dollars(pic.weekSpent)} spent of {dollars(pic.weeklyAmount ?? 0)}. Resets Monday. Bills that repeat are not counted here.</Text>
            <Bar pct={pic.weeklyAmount ? pic.weekSpent / pic.weeklyAmount : 1} colour={over ? colours.danger : colours.good} />
          </>
        ) : (
          <>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colours.text, marginTop: 4 }}>{dollars(pic.weekSpent)} spent this week</Text>
            <Text style={tileSub}>Set a weekly amount to see what is left.</Text>
            <Button title="Set a weekly amount" kind="ghost" onPress={openBudgets} />
          </>
        )}
      </Card>

      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.sm }}>
        <Tile label="Spent this month" value={dollars(pic.monthSpent)} sub={pic.monthBudget ? `of ${dollars(pic.monthBudget)} budget` : 'No budgets set'} />
        <Tile label="Biggest" value={biggest ? biggest.category : 'Nothing yet'} sub={biggest ? `${dollars(biggest.spent)} so far` : 'This month'} muted={!biggest} />
      </View>

      {!draft && !budgeting && !bill ? (
        <>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}><Button title="Tell Tali" onPress={() => router.navigate({ pathname: '/talk', params: { ask: 'I spent ' } })} /></View>
            <View style={{ flex: 1 }}><Button title="Snap a receipt" kind="ghost" busy={reading} onPress={() => snap('camera')} /></View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, marginBottom: space.md, marginTop: 2 }}>
            <Link label="Type it in" onPress={() => { setError(''); setDraft({ description: '', amount: '', local_date: localToday(), category: 'Groceries', source: 'manual' }); }} />
            <Link label="Choose a receipt photo" onPress={() => snap('file')} />
          </View>
        </>
      ) : null}
      {!draft && !budgeting && !bill ? <ErrorText>{error}</ErrorText> : null}

      {draft ? (
        <Card>
          <Text style={formTitle}>{draft.id ? 'Fix this spend' : draft.source === 'receipt' ? 'Check the receipt' : 'Add a spend'}</Text>
          <Field label="What was it" value={draft.description} onChangeText={(v) => setDraft({ ...draft, description: v })} placeholder="Woolworths, coffee, fuel" maxLength={120} />
          <Field label="Amount (A$)" value={draft.amount} onChangeText={(v) => setDraft({ ...draft, amount: v })} keyboardType="decimal-pad" inputMode="decimal" placeholder="0.00" />
          <Field label="Date" value={draft.local_date} onChangeText={(v) => setDraft({ ...draft, local_date: v })} placeholder="YYYY-MM-DD" autoCapitalize="none" autoCorrect={false} />
          <Label>Category</Label>
          <Chips options={SPEND_CATEGORIES as readonly string[]} value={draft.category} onPick={(c) => setDraft({ ...draft, category: c })} />
          <ErrorText>{error}</ErrorText>
          <Button title="Save" onPress={saveDraft} busy={busy} />
          {draft.id ? <Button title={confirm.armed === 'spend' ? 'Tap again to delete' : 'Delete'} kind="danger" onPress={() => confirm.confirm('spend', () => run(async () => { await deleteSpend(draft.id!); setDraft(null); }))} /> : null}
          <Button title="Cancel" kind="ghost" onPress={() => { setDraft(null); setError(''); }} />
        </Card>
      ) : null}

      <Text style={section}>This month by category</Text>
      {budgeting ? (
        <Card>
          <Text style={formTitle}>Your budgets</Text>
          <Field label="To spend each week (A$)" value={weekly} onChangeText={setWeekly} keyboardType="decimal-pad" inputMode="decimal" placeholder="For example 400" />
          <Body muted>Monthly budget for each category. Leave one blank for no budget.</Body>
          <View style={{ height: space.sm }} />
          {SPEND_CATEGORIES.map((c) => (
            <Field key={c} label={`${c} each month (A$)`} value={budgets[c] ?? ''} onChangeText={(v) => setBudgets({ ...budgets, [c]: v })} keyboardType="decimal-pad" inputMode="decimal" placeholder="No budget" />
          ))}
          <ErrorText>{error}</ErrorText>
          <Button title="Save budgets" onPress={saveBudgetForm} busy={busy} />
          <Button title="Cancel" kind="ghost" onPress={() => { setBudgeting(false); setError(''); }} />
        </Card>
      ) : (
        <>
          <Card>
            {pic.categories.length ? pic.categories.map((c, i) => {
              const isOver = c.budget != null && c.spent > c.budget;
              return (
                <View key={c.category} style={{ marginTop: i ? 12 : 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                    <Text style={{ fontSize: 14.5, fontWeight: '700', color: colours.text, flex: 1 }} numberOfLines={1}>{c.category}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: isOver ? colours.danger : colours.muted }}>{c.budget != null ? `${dollars(c.spent)} of ${dollars(c.budget)}` : dollars(c.spent)}</Text>
                  </View>
                  {c.budget != null ? <Bar pct={c.budget ? c.spent / c.budget : 1} colour={isOver ? colours.danger : BAR[c.category] ?? colours.purple} /> : null}
                </View>
              );
            }) : <Body muted>Nothing spent this month yet. Set a budget for a category and it shows here.</Body>}
          </Card>
          {!draft && !bill ? <Button title={pic.monthBudget || pic.weeklyAmount != null ? 'Change budgets' : 'Set budgets'} kind="ghost" onPress={openBudgets} /> : null}
        </>
      )}

      <Text style={section}>Recent</Text>
      <Card>
        {pic.recent.length ? pic.recent.map((s, i) => (
          <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`${s.description}, ${cents(s.amount)}. Fix or delete.`}
            onPress={() => { setError(''); setBudgeting(false); setBill(null); setDraft({ id: s.id, description: s.description, amount: s.amount.toFixed(2), local_date: s.local_date, category: s.category, source: 'manual' }); }}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colours.border, paddingTop: i ? 10 : 0 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14.5, color: colours.text }} numberOfLines={1}>{s.description}</Text>
              <Text style={{ fontSize: 12, color: colours.faint, marginTop: 1 }}>{friendlyDate(s.local_date)} · {s.category} · {SOURCE[s.source] ?? s.source}</Text>
            </View>
            <Text style={{ fontSize: 14.5, fontWeight: '800', color: colours.text }}>{cents(s.amount)}</Text>
          </Pressable>
        )) : <Body muted>No spends yet. Tell Tali, snap a receipt or type one in.</Body>}
      </Card>

      <Text style={section}>Bills that repeat</Text>
      <Card>
        {pic.repeats.length ? pic.repeats.map((r, i) => (
          <View key={r.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm, paddingTop: i ? 10 : 0, marginTop: i ? 10 : 0, borderTopWidth: i ? 1 : 0, borderTopColor: colours.border }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14.5, color: colours.text }} numberOfLines={1}>{r.description} · {cents(r.amount)}</Text>
              <Text style={{ fontSize: 12, color: colours.faint, marginTop: 1 }}>{r.category} · {EVERY[r.every]} · next {friendlyDate(r.next_date)}</Text>
            </View>
            <Link label={confirm.armed === r.id ? 'Tap again' : 'Remove'} onPress={() => confirm.confirm(r.id, () => run(() => deleteRepeat(r.id)))} />
          </View>
        )) : <Body muted>Rent, phone, subscriptions. Add them once and they log themselves on the day.</Body>}
      </Card>
      {bill ? (
        <Card>
          <Text style={formTitle}>Add a bill that repeats</Text>
          <Field label="What is it" value={bill.description} onChangeText={(v) => setBill({ ...bill, description: v })} placeholder="Rent, phone, gym" maxLength={120} />
          <Field label="Amount each time (A$)" value={bill.amount} onChangeText={(v) => setBill({ ...bill, amount: v })} keyboardType="decimal-pad" inputMode="decimal" placeholder="0.00" />
          <Label>How often</Label>
          <Chips options={['week', 'fortnight', 'month']} labels={EVERY} value={bill.every} onPick={(v) => setBill({ ...bill, every: v as Repeat['every'] })} />
          <Field label="Next date it comes out" value={bill.next_date} onChangeText={(v) => setBill({ ...bill, next_date: v })} placeholder="YYYY-MM-DD" autoCapitalize="none" autoCorrect={false} />
          <Label>Category</Label>
          <Chips options={SPEND_CATEGORIES as readonly string[]} value={bill.category} onPick={(c) => setBill({ ...bill, category: c })} />
          <ErrorText>{error}</ErrorText>
          <Button title="Save bill" onPress={saveBill} busy={busy} />
          <Button title="Cancel" kind="ghost" onPress={() => { setBill(null); setError(''); }} />
        </Card>
      ) : !draft && !budgeting ? (
        <Button title="Add a bill that repeats" kind="ghost" onPress={() => { setError(''); setBill({ description: '', amount: '', category: 'Bills', every: 'month', next_date: localToday() }); }} />
      ) : null}
    </>
  );
}

const tileLabel = { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: colours.muted } as const;
const tileSub = { fontSize: 12.5, color: colours.muted, marginTop: 2 } as const;
const formTitle = { fontSize: 16, fontWeight: '800', color: colours.text, marginBottom: space.sm } as const;
const section = { color: colours.text, fontSize: 24, fontFamily: 'InstrumentSerif_400Regular', marginTop: space.md, marginBottom: space.sm } as const;

function Bar({ pct, colour }: { pct: number; colour: string }) {
  const w = Math.max(0, Math.min(1, Number.isFinite(pct) ? pct : 0));
  return (
    <View style={{ height: 8, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.14)', marginTop: 8, overflow: 'hidden' }}>
      <View style={{ width: `${w * 100}%`, height: 8, borderRadius: 99, backgroundColor: colour }} />
    </View>
  );
}

function Tile({ label, value, sub, muted }: { label: string; value: string; sub?: string; muted?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: colours.surface, borderRadius: radius.card, padding: space.md, borderWidth: 1, borderColor: colours.border, ...elevation.card }}>
      <Text style={tileLabel}>{label}</Text>
      <Text style={{ fontSize: muted ? 18 : 22, fontWeight: '800', color: muted ? colours.faint : colours.text, marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {sub ? <Text style={{ fontSize: 12, color: colours.muted, marginTop: 2 }} numberOfLines={2}>{sub}</Text> : null}
    </View>
  );
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8}>
      <Text style={{ color: colours.purpleInk, fontSize: 14, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

// Chips wrap onto more lines, never scroll sideways.
function Chips({ options, labels, value, onPick }: { options: readonly string[]; labels?: Record<string, string>; value: string; onPick: (v: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space.md }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable key={o} onPress={() => onPick(o)} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, backgroundColor: on ? colours.purple : colours.purpleSoft, borderWidth: 1, borderColor: on ? colours.purple : colours.border }}>
            <Text style={{ color: on ? colours.onPurple : colours.text, fontSize: 13, fontWeight: '800' }}>{labels?.[o] ?? o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
