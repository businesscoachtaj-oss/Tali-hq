// lib/emailCheck.ts
// ADDED (20 Nov 2026, Taj approved the mockup): is this email a throwaway inbox (mailinator.com
// and about 10,000 others, any country)? One list for all of Totality 360's apps: it lives in the
// email-check function on the Totality Supabase project (public, no sign in, reads and stores
// nothing), so Tali HQ asks that one rather than keeping a second copy.
// Fails open: if the check is slow or down, sign up carries on as before.

const CHECK_URL = 'https://spqazfyxxhzizbtmxklr.supabase.co/functions/v1/email-check';

export const THROWAWAY_EMAIL_MESSAGE =
  "That's a throwaway email address. Use one you'll keep, so you get your receipts and can reset your password.";

const memo = new Map<string, boolean>();

export async function isThrowawayEmail(email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at < 1 || !e.slice(at + 1).includes('.')) return false;
  const domain = e.slice(at + 1);
  const known = memo.get(domain);
  if (known !== undefined) return known;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(CHECK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: e }),
      signal: ctrl.signal,
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (typeof data?.disposable !== 'boolean') return false;
    memo.set(domain, data.disposable);
    return data.disposable;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
