// Small Stripe helpers for Tali HQ edge functions (plain fetch, no SDK).
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_CONNECT_CLIENT_ID (Connect OAuth, ca_...).

const KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

export const stripeReady = () => KEY.length > 0;

function form(params: Record<string, unknown>, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === 'object' ? form(item, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))));
    else if (typeof v === 'object') form(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

// `account` acts on a business's connected Stripe account (Stripe-Account header).
export async function stripe<T = any>(method: 'GET' | 'POST' | 'DELETE', path: string, params: Record<string, unknown> = {}, account?: string): Promise<T> {
  const url = new URL(`https://api.stripe.com/v1/${path}`);
  const headers: Record<string, string> = { Authorization: `Bearer ${KEY}` };
  if (account) headers['Stripe-Account'] = account;
  const init: RequestInit = { method, headers };
  if (method !== 'POST') form(params).forEach((v, k) => url.searchParams.append(k, v));
  else {
    init.body = form(params);
    (init.headers as Record<string, string>)['Content-Type'] = 'application/x-www-form-urlencoded';
  }
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${data?.error?.message ?? 'error'}`);
  return data as T;
}

// Verifies the Stripe-Signature header (v1 scheme, 5 minute tolerance).
export async function verifyStripeSignature(payload: string, header: string | null, secret: string): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const t = parts['t'];
  const sigs = header
    .split(',')
    .filter((p) => p.startsWith('v1='))
    .map((p) => p.slice(3));
  if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`));
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return sigs.some((s) => s.length === hex.length && timingSafeEqual(s, hex));
}

function timingSafeEqual(a: string, b: string) {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Which plan a Stripe price belongs to. Live price ids are built in (created 1 Nov 2026 in the
// Totality 360 account); secrets can override them, for example for test mode.
export const PRICE_HQ = Deno.env.get('STRIPE_PRICE_HQ') || 'price_1UWucQPy9YlWBZ02DtSHnFNW';
export const PRICE_PRO = Deno.env.get('STRIPE_PRICE_PRO') || 'price_1UWucXPy9YlWBZ02uACyStzk';
// Yearly prices (created 2 Nov 2026): 15% off twelve months of the monthly price.
export const PRICE_HQ_YEARLY = Deno.env.get('STRIPE_PRICE_HQ_YEARLY') || 'price_1UXB4HPy9YlWBZ02pW7k1ubh';
export const PRICE_PRO_YEARLY = Deno.env.get('STRIPE_PRICE_PRO_YEARLY') || 'price_1UXB4JPy9YlWBZ02mazh3HDd';
export const COUPON_FOUNDING = Deno.env.get('STRIPE_COUPON_FOUNDING') || 'TALIHQ_FOUNDING';

export function planForPrice(priceId: string | undefined | null): 'hq' | 'pro' | null {
  if (!priceId) return null;
  const hq = [PRICE_HQ, PRICE_HQ_YEARLY];
  const pro = [PRICE_PRO, PRICE_PRO_YEARLY];
  if (hq.includes(priceId)) return 'hq';
  if (pro.includes(priceId)) return 'pro';
  return null;
}

// Stripe Connect OAuth (Standard accounts): businesses link the Stripe account they already have.
export const CONNECT_CLIENT_ID = Deno.env.get('STRIPE_CONNECT_CLIENT_ID') ?? '';

export async function connectOAuth<T = any>(path: 'token' | 'deauthorize', params: Record<string, string>): Promise<T> {
  const res = await fetch(`https://connect.stripe.com/oauth/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe OAuth ${res.status}: ${data?.error_description ?? data?.error ?? 'error'}`);
  return data as T;
}
