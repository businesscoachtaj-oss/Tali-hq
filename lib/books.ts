// 12 Nov 2026 (Taj): Bookkeeping pack. One quarter of the business on a page: money in from paid
// invoices, money out from receipts, and the GST on each. For the owner's records and their
// accountant. It is a summary, not tax advice.
import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { invoices as loadInvoices, type Invoice } from './data';
import { receipts as loadReceipts, type Receipt } from './grow';

export type Quarter = { key: string; label: string; from: string; to: string };
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The quarter that holds `today` (yyyy-mm-dd) and the five before it, newest first. */
export function quarters(today: string): Quarter[] {
  let y = Number(today.slice(0, 4));
  let q = Math.floor((Number(today.slice(5, 7)) - 1) / 3); // 0 = Jan to Mar
  const out: Quarter[] = [];
  for (let i = 0; i < 6; i++) {
    const m1 = q * 3 + 1, m3 = m1 + 2;
    const last = new Date(Date.UTC(y, m3, 0)).getUTCDate();
    out.push({ key: `${y}-Q${q + 1}`, label: `${MONTHS[m1 - 1]} to ${MONTHS[m3 - 1]} ${y}`, from: iso(y, m1, 1), to: iso(y, m3, last) });
    q -= 1;
    if (q < 0) { q = 3; y -= 1; }
  }
  return out;
}

export type Pack = {
  quarter: Quarter;
  paid: Invoice[];
  owed: Invoice[];
  spent: Receipt[];
  income: number; gstCollected: number;
  expenses: number; gstPaid: number;
  byCategory: { category: string; amount: number; count: number }[];
  outstanding: number;
};
const inRange = (d: string | null | undefined, q: Quarter) => !!d && d.slice(0, 10) >= q.from && d.slice(0, 10) <= q.to;
const round = (n: number) => Math.round(n * 100) / 100;

export async function loadBooks(): Promise<{ invoices: Invoice[]; receipts: Receipt[] }> {
  const [i, r] = await Promise.all([loadInvoices(), loadReceipts()]);
  return { invoices: i, receipts: r };
}

/** Paid invoices count in the quarter they were paid in. Receipts count by the date on the receipt. */
export function buildPack(q: Quarter, invoices: Invoice[], receipts: Receipt[]): Pack {
  const paid = invoices.filter((i) => i.status === 'paid' && inRange(i.paid_at ?? i.issue_date, q));
  const owed = invoices.filter((i) => i.status === 'sent' && inRange(i.issue_date, q));
  const spent = receipts.filter((r) => inRange(r.date, q));
  const cats = new Map<string, { amount: number; count: number }>();
  for (const r of spent) {
    const c = cats.get(r.category) ?? { amount: 0, count: 0 };
    c.amount += Number(r.amount) || 0; c.count += 1;
    cats.set(r.category, c);
  }
  return {
    quarter: q, paid, owed, spent,
    income: round(paid.reduce((a, i) => a + (Number(i.total) || 0), 0)),
    gstCollected: round(paid.reduce((a, i) => a + (Number(i.gst_amount) || 0), 0)),
    expenses: round(spent.reduce((a, r) => a + (Number(r.amount) || 0), 0)),
    gstPaid: round(spent.reduce((a, r) => a + (Number(r.gst) || 0), 0)),
    byCategory: [...cats.entries()].map(([category, v]) => ({ category, amount: round(v.amount), count: v.count })).sort((a, b) => b.amount - a.amount),
    outstanding: round(owed.reduce((a, i) => a + (Number(i.total) || 0), 0)),
  };
}

export const aud2 = (n: number) => `A$${(Number(n) || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const day = (d: string | null | undefined) => (d ? `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}` : '');

export function packHtml(p: Pack, businessName: string) {
  const row = (cells: string[], cls = '') => `<tr class="${cls}">${cells.map((c, i) => `<td${i >= cells.length - 2 && cells.length > 2 ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`;
  const none = (cols: number, text: string) => `<tr><td colspan="${cols}" class="m">${text}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 16mm; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #272626; font-size: 11.5px; }
  h1 { font-size: 22px; margin: 0; } h2 { font-size: 14px; margin: 22px 0 6px; }
  .sub { color: #6b6b6b; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; } td, th { padding: 5px 6px; border-bottom: 1px solid #e6e6e6; text-align: left; vertical-align: top; }
  th { font-size: 10px; letter-spacing: .6px; text-transform: uppercase; color: #6b6b6b; } .n { text-align: right; white-space: nowrap; } .m { color: #6b6b6b; }
  .box { display: inline-block; width: 23%; margin-right: 1.5%; border: 1px solid #e6e6e6; border-radius: 8px; padding: 9px 10px; box-sizing: border-box; }
  .box b { display: block; font-size: 15px; margin-top: 3px; } .tot td { font-weight: 700; border-top: 2px solid #272626; }
  .foot { margin-top: 26px; color: #6b6b6b; font-size: 10px; line-height: 1.5; }
  </style></head><body>
  <h1>${esc(businessName || 'Bookkeeping pack')}</h1>
  <div class="sub">Bookkeeping pack, ${esc(p.quarter.label)} (${esc(day(p.quarter.from))} to ${esc(day(p.quarter.to))})</div>
  <div style="margin-top:16px">
    <div class="box">Money in<b>${aud2(p.income)}</b></div><div class="box">GST collected<b>${aud2(p.gstCollected)}</b></div><div class="box">Money out<b>${aud2(p.expenses)}</b></div><div class="box" style="margin-right:0">GST paid<b>${aud2(p.gstPaid)}</b></div>
  </div>
  <h2>Money in: invoices paid this quarter</h2>
  <table><tr><th>Paid</th><th>Invoice</th><th>Customer</th><th class="n">GST</th><th class="n">Total</th></tr>
  ${p.paid.length ? p.paid.map((i) => row([esc(day(i.paid_at ?? i.issue_date)), esc(i.number), esc(i.client_name), aud2(i.gst_amount), aud2(i.total)])).join('') : none(5, 'No invoices were paid in this quarter.')}
  ${p.paid.length ? row(['', '', 'Total', aud2(p.gstCollected), aud2(p.income)], 'tot') : ''}</table>
  <h2>Money out: receipts dated this quarter</h2>
  <table><tr><th>Date</th><th>From</th><th>Type</th><th class="n">GST</th><th class="n">Amount</th></tr>
  ${p.spent.length ? p.spent.map((r) => row([esc(day(r.date)), esc(r.vendor), esc(r.category), aud2(r.gst), aud2(r.amount)])).join('') : none(5, 'No receipts are dated in this quarter.')}
  ${p.spent.length ? row(['', '', 'Total', aud2(p.gstPaid), aud2(p.expenses)], 'tot') : ''}</table>
  <h2>Money out by type</h2>
  <table><tr><th>Type</th><th class="n">Receipts</th><th class="n">Amount</th></tr>
  ${p.byCategory.length ? p.byCategory.map((c) => row([esc(c.category), String(c.count), aud2(c.amount)])).join('') : none(3, 'Nothing to show.')}</table>
  <h2>Still owed to you: invoices sent this quarter and not paid</h2>
  <table><tr><th>Sent</th><th>Invoice</th><th>Customer</th><th class="n">Due</th><th class="n">Total</th></tr>
  ${p.owed.length ? p.owed.map((i) => row([esc(day(i.issue_date)), esc(i.number), esc(i.client_name), esc(day(i.due_date)), aud2(i.total)])).join('') : none(5, 'Nothing outstanding from this quarter.')}</table>
  <div class="foot">Made from the invoices and receipts saved in Tali HQ. Amounts include GST. Paid invoices are counted in the quarter they were paid. This is a summary for your records and your accountant. It is not tax advice and it is not a BAS.</div>
  </body></html>`;
}

/** Phone: a PDF and the share sheet. Web: the browser's print window. */
export async function sharePack(p: Pack, businessName: string) {
  const html = packHtml(p, businessName);
  if (Platform.OS === 'web') { await Print.printAsync({ html }); return; }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Bookkeeping pack, ${p.quarter.label}`, UTI: 'com.adobe.pdf' });
  else await Print.printAsync({ uri });
}
