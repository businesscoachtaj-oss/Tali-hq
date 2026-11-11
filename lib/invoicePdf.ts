import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Invoice, InvoiceSettings } from './data';

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
export const money = (n: number) => `A$${(Number(n) || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const longDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

// A clean A4 invoice. "Tax invoice" and the GST line only when they are GST registered.
// 12 Nov 2026: the same page also prints a quote (kind 'quote'), so quotes and invoices match.
export function invoiceHtml(inv: Invoice, s: InvoiceSettings | null, fallbackName: string, kind: 'invoice' | 'quote' = 'invoice') {
  const quote = kind === 'quote';
  const name = s?.business_name || fallbackName || 'Invoice';
  const title = quote ? 'Quote' : inv.gst ? 'Tax invoice' : 'Invoice';
  const rows = inv.items
    .map(
      (i) => `<tr><td>${esc(i.description)}</td><td class="n">${esc(i.qty)}</td><td class="n">${money(i.unit_price)}</td><td class="n">${money(
        Math.round(i.qty * i.unit_price * 100) / 100,
      )}</td></tr>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 18mm; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #272626; font-size: 12px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #6C3483; padding-bottom: 14px; }
  h1 { font-size: 26px; margin: 0; color: #6C3483; }
  .biz { text-align: right; line-height: 1.5; }
  .biz b { font-size: 15px; }
  .meta { display: flex; justify-content: space-between; margin: 22px 0; line-height: 1.6; }
  .label { color: #66615B; font-size: 10px; text-transform: uppercase; letter-spacing: .6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .6px; color: #66615B; border-bottom: 1px solid #D3CCC4; padding: 8px 4px; }
  td { padding: 9px 4px; border-bottom: 1px solid #E7E2DC; vertical-align: top; }
  .n { text-align: right; white-space: nowrap; }
  .totals { margin-left: auto; width: 260px; margin-top: 14px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .grand { font-size: 16px; font-weight: 700; border-top: 2px solid #272626; margin-top: 4px; padding-top: 8px !important; }
  .box { margin-top: 28px; padding: 12px 14px; background: #F5F3F0; border-radius: 8px; line-height: 1.6; white-space: pre-wrap; }
  .foot { margin-top: 26px; color: #66615B; font-size: 11px; white-space: pre-wrap; }
  .paid { color: #1E8E4E; font-weight: 700; font-size: 14px; margin-top: 6px; }
</style></head><body>
<div class="top">
  <div><h1>${title}</h1><div style="margin-top:6px">${esc(inv.number)}</div>${inv.status === 'paid' ? '<div class="paid">PAID</div>' : ''}</div>
  <div class="biz"><b>${esc(name)}</b>${s?.abn ? `<br>ABN ${esc(s.abn)}` : ''}${s?.address ? `<br>${esc(s.address).replace(/\n/g, '<br>')}` : ''}${
    s?.email ? `<br>${esc(s.email)}` : ''
  }${s?.phone ? `<br>${esc(s.phone)}` : ''}</div>
</div>
<div class="meta">
  <div><div class="label">${quote ? 'Quote for' : 'Bill to'}</div><b>${esc(inv.client_name)}</b>${inv.client_email ? `<br>${esc(inv.client_email)}` : ''}</div>
  <div style="text-align:right"><div class="label">${quote ? 'Date' : 'Issued'}</div>${longDate(inv.issue_date)}<div class="label" style="margin-top:6px">${quote ? 'Valid until' : 'Due'}</div>${longDate(inv.due_date)}</div>
</div>
<table><thead><tr><th>Description</th><th class="n">Qty</th><th class="n">Price</th><th class="n">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="totals">
  <div><span>Subtotal</span><span>${money(inv.subtotal)}</span></div>
  ${inv.gst ? `<div><span>GST 10%</span><span>${money(inv.gst_amount)}</span></div>` : ''}
  <div class="grand"><span>Total${inv.gst ? ' incl. GST' : ''}</span><span>${money(inv.total)}</span></div>
</div>
${s?.payment_details && !quote ? `<div class="box"><div class="label">How to pay</div>${esc(s.payment_details)}</div>` : ''}
${inv.notes ? `<div class="box">${esc(inv.notes)}</div>` : ''}
${s?.footer ? `<div class="foot">${esc(s.footer)}</div>` : ''}
</body></html>`;
}

// Phone: make a PDF and open the share sheet (email, Messages, save to Files).
// Web: opens the browser's print window, where "Save as PDF" is one click.
export async function shareInvoice(inv: Invoice, s: InvoiceSettings | null, fallbackName: string) {
  const html = invoiceHtml(inv, s, fallbackName);
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `${inv.number} for ${inv.client_name}`, UTI: 'com.adobe.pdf' });
  } else {
    await Print.printAsync({ uri });
  }
}
