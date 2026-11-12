// 12 Nov 2026 (Taj): Jobs and quotes. A quote becomes a job, and a job becomes an invoice.
import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from './supabase';
import { tagClientHere } from './businesses';
import { saveInvoice, type Invoice, type InvoiceItem, type InvoiceSettings } from './data';
import { invoiceHtml } from './invoicePdf';
import { addDays, isoDate, today } from './dates';

export type JobStatus = 'quote' | 'sent' | 'accepted' | 'on' | 'done' | 'invoiced' | 'lost';
export type Job = {
  id: string;
  client_id: string | null;
  client_name: string;
  client_email: string | null;
  title: string;
  address: string;
  number: string;
  status: JobStatus;
  items: InvoiceItem[];
  gst: boolean;
  subtotal: number;
  gst_amount: number;
  total: number;
  valid_days: number;
  notes: string;
  sent_at: string | null;
  accepted_at: string | null;
  done_at: string | null;
  invoice_id: string | null;
  created_by: 'user' | 'tali';
  created_at: string;
  updated_at: string;
  business_id?: string | null; // 12 Nov 2026: which business (null is the main one)
};

export const JOB_STATUS: Record<JobStatus, { label: string; colour: string }> = {
  quote: { label: 'Quote, not sent', colour: '#D2CCEE' },
  sent: { label: 'Quote sent', colour: '#FFB561' },
  accepted: { label: 'Accepted', colour: '#7FE0B0' },
  on: { label: 'On now', colour: '#7FA8FF' },
  done: { label: 'Done', colour: '#D7B5FF' },
  invoiced: { label: 'Invoiced', colour: '#9FE8FF' },
  lost: { label: 'Not going ahead', colour: '#FF8A7E' },
};
/** The steps a job moves through, in order. Lost sits outside them. */
export const JOB_STEPS: JobStatus[] = ['quote', 'sent', 'accepted', 'on', 'done', 'invoiced'];
export const jobGroup = (s: JobStatus): 'Quotes' | 'On now' | 'Done' => (s === 'quote' || s === 'sent' || s === 'lost' ? 'Quotes' : s === 'accepted' || s === 'on' ? 'On now' : 'Done');

const COLS = 'id, client_id, client_name, client_email, title, address, number, status, items, gst, subtotal, gst_amount, total, valid_days, notes, sent_at, accepted_at, done_at, invoice_id, created_by, created_at, updated_at, business_id';
const fix = (r: any): Job => ({ ...r, subtotal: Number(r.subtotal), gst_amount: Number(r.gst_amount), total: Number(r.total), items: Array.isArray(r.items) ? r.items : [] });

export async function jobs(): Promise<Job[]> {
  const { data, error } = await supabase.from('jobs').select(COLS).order('updated_at', { ascending: false }).limit(300);
  if (error) throw error;
  return ((data as any[]) ?? []).map(fix);
}

export async function saveJob(j: { id?: string; client_id?: string | null; client_name: string; client_email?: string | null; title: string; address: string; items: InvoiceItem[]; gst: boolean; notes: string; status?: JobStatus }): Promise<Job> {
  const row = {
    client_id: j.client_id ?? null,
    client_name: j.client_name.trim().slice(0, 120),
    client_email: j.client_email?.trim() || null,
    title: j.title.trim().slice(0, 160),
    address: j.address.trim().slice(0, 300),
    items: j.items.filter((i) => i.description.trim()).map((i) => ({ description: i.description.trim(), qty: Number(i.qty) || 1, unit_price: Number(i.unit_price) || 0 })),
    gst: j.gst,
    notes: j.notes.slice(0, 2000),
    ...(j.status ? { status: j.status } : {}),
  };
  const q = j.id ? supabase.from('jobs').update(row).eq('id', j.id) : supabase.from('jobs').insert(row);
  const { data, error } = await q.select(COLS).single();
  if (error) throw error;
  if (!j.id) tagClientHere(row.client_id); // more than one business: the customer shows in this one too
  return fix(data);
}

export async function setJobStatus(id: string, status: JobStatus): Promise<Job> {
  const { data, error } = await supabase.from('jobs').update({ status }).eq('id', id).select(COLS).single();
  if (error) throw error;
  return fix(data);
}

export async function deleteJob(id: string) {
  const { error } = await supabase.from('jobs').delete().eq('id', id);
  if (error) throw error;
}

/** Makes a draft invoice from the job's lines and marks the job invoiced. The invoice is not sent. */
export async function invoiceJob(job: Job, dueDays = 7): Promise<Invoice> {
  const inv = await saveInvoice({
    client_id: job.client_id,
    client_name: job.client_name || job.title,
    client_email: job.client_email,
    issue_date: today(),
    due_date: isoDate(addDays(new Date(), dueDays)),
    items: job.items,
    gst: job.gst,
    notes: `${job.title}${job.number ? ` (quote ${job.number})` : ''}`.slice(0, 1000),
  });
  const { error } = await supabase.from('jobs').update({ status: 'invoiced', invoice_id: inv.id }).eq('id', job.id);
  if (error) throw error;
  return inv;
}

// The quote as a PDF, laid out like the invoice so the two match.
function quoteHtml(job: Job, s: InvoiceSettings | null, fallbackName: string) {
  const issued = (job.sent_at ?? job.created_at).slice(0, 10);
  const asInvoice = { id: job.id, client_id: job.client_id, client_name: job.client_name || 'Customer', client_email: job.client_email, number: job.number, issue_date: issued, due_date: isoDate(addDays(new Date(`${issued}T12:00:00`), job.valid_days)), items: job.items, gst: job.gst, subtotal: job.subtotal, gst_amount: job.gst_amount, total: job.total, status: 'draft', sent_at: null, paid_at: null, notes: [job.title, job.address, job.notes].filter(Boolean).join('\n'), created_by: 'user', created_at: job.created_at, stripe_invoice_id: null, stripe_url: null, paid_via: null } as Invoice;
  return invoiceHtml(asInvoice, s, fallbackName, 'quote');
}

export async function shareQuote(job: Job, s: InvoiceSettings | null, fallbackName: string) {
  const html = quoteHtml(job, s, fallbackName);
  if (Platform.OS === 'web') { await Print.printAsync({ html }); return; }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `${job.number} for ${job.client_name || job.title}`, UTI: 'com.adobe.pdf' });
  else await Print.printAsync({ uri });
}

/** One line on what to do next, worked out from the job itself. No AI, so it is always true. */
export function jobNext(j: Job, now = Date.now()): string | null {
  const days = (iso: string | null) => (iso ? Math.floor((now - new Date(iso).getTime()) / 86400000) : 0);
  if (j.status === 'quote') return j.items.length ? 'Ready to send.' : 'Add what is in the quote, then send it.';
  if (j.status === 'sent') { const d = days(j.sent_at); return d >= 5 ? `No answer in ${d} days. Worth a nudge.` : d >= 1 ? `Sent ${d} ${d === 1 ? 'day' : 'days'} ago.` : 'Sent today.'; }
  if (j.status === 'accepted') return 'Accepted. Book it in.';
  if (j.status === 'done') { const d = days(j.done_at); return d >= 1 ? `Finished ${d} ${d === 1 ? 'day' : 'days'} ago and not invoiced yet.` : 'Finished today. Invoice it?'; }
  return null;
}
