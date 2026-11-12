// 12 Nov 2026 (Taj: "Build it all"): more than one business on one account.
//
// The business an account already has is the main one. It has no row and its work has
// business_id null, so nothing changes for anyone with a single business. Each extra business is
// a row in public.businesses. The one in use is kept on the profile, and the database stamps it
// onto new jobs, invoices, bookings, projects and receipts by itself.
//
// This file is the app's one place for "which business am I in": a small shared store, the
// useBusinesses() hook, and the pill and tag that show it. With no extra business every helper
// here is a no-op, and the pill and tags draw nothing.
import { useEffect, useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { colours, radius } from '@/constants/theme';

export type Business = { id: string; name: string; about: string; colour: string; abn: string | null; payment_details: string | null };
/** The main business has id null. */
export type AnyBusiness = { id: string | null; name: string; colour: string; about: string };
export const MAIN_COLOUR = '#7FA8FF';
export const BUSINESS_COLOURS = ['#7FE0B0', '#FFB561', '#FF8A7E', '#9FE8FF', '#D7B5FF'];

type State = { loaded: boolean; userId: string | null; extras: Business[]; current: string | null; all: boolean };
let state: State = { loaded: false, userId: null, extras: [], current: null, all: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const ALL_KEY = 'tali.business.all';

let loading: Promise<void> | null = null;
/** Reads the extra businesses and which one is in use. Any failure leaves the app on the main business. */
export function loadBusinesses(userId: string, force = false): Promise<void> {
  if (!force && state.loaded && state.userId === userId) return Promise.resolve();
  if (loading && !force) return loading;
  loading = (async () => {
    try {
      const [{ data: rows, error }, { data: prof }, all] = await Promise.all([
        supabase.from('businesses').select('id, name, about, colour, abn, payment_details').order('created_at'),
        supabase.from('profiles').select('current_business_id').eq('id', userId).maybeSingle(),
        AsyncStorage.getItem(ALL_KEY).catch(() => null),
      ]);
      if (error) throw error;
      const extras = (rows as Business[]) ?? [];
      const current = (prof as any)?.current_business_id ?? null;
      set({ loaded: true, userId, extras, current: extras.some((b) => b.id === current) ? current : null, all: extras.length > 0 && all === '1' });
    } catch {
      set({ loaded: true, userId, extras: [], current: null, all: false });
    }
    loading = null;
  })();
  return loading;
}

/** Switches business. 'all' shows everything together; new things still go into the last one picked. */
export async function pickBusiness(id: string | null | 'all') {
  if (id === 'all') {
    set({ all: true });
    AsyncStorage.setItem(ALL_KEY, '1').catch(() => {});
    return;
  }
  const { data, error } = await supabase.rpc('set_current_business', { p_business: id });
  if (error || data !== true) throw new Error('Could not switch business. Try again.');
  set({ current: id, all: false });
  AsyncStorage.setItem(ALL_KEY, '0').catch(() => {});
}

export function useBusinesses() {
  const { session, profile } = useAuth();
  const s = useSyncExternalStore(subscribe, () => state, () => state);
  const userId = session?.user.id ?? null;
  useEffect(() => { if (userId) loadBusinesses(userId); }, [userId]);
  const main: AnyBusiness = { id: null, name: profile?.business_name?.trim() || 'Your business', colour: MAIN_COLOUR, about: profile?.business_type ?? '' };
  const list: AnyBusiness[] = [main, ...s.extras];
  const many = s.extras.length > 0;
  const of = (id: string | null | undefined): AnyBusiness => (id ? s.extras.find((b) => b.id === id) ?? main : main);
  const here = of(s.current);
  return {
    loaded: s.loaded,
    /** True once there is more than one business. Everything below only matters then. */
    many,
    extras: s.extras,
    list,
    main,
    current: s.current,
    all: many && s.all,
    here,
    of,
    /** Does this job, invoice, booking, project or receipt belong on screen right now? */
    visible: (row: { business_id?: string | null }) => !many || s.all || (row.business_id && s.extras.some((b) => b.id === row.business_id) ? row.business_id : null) === s.current,
    /** Same question for a customer, who can be in more than one business. */
    visibleClient: (c: { business_tags?: string[] | null }) => !many || s.all || clientBusinesses(c, s.extras).includes(s.current),
    clientIn: (c: { business_tags?: string[] | null }) => clientBusinesses(c, s.extras).map(of),
    reload: () => (userId ? loadBusinesses(userId, true) : Promise.resolve()),
  };
}

/** The businesses a customer belongs to (null is the main one). No tags means the main business. */
function clientBusinesses(c: { business_tags?: string[] | null }, extras: Business[]): (string | null)[] {
  const tags = (c.business_tags ?? []).filter((t) => t === 'main' || extras.some((b) => b.id === t));
  if (!tags.length) return [null];
  return tags.map((t) => (t === 'main' ? null : t));
}

/**
 * A job, invoice or booking was just saved for this customer in the business in use: make sure
 * the customer shows in that business too. Quiet on purpose, the save has already worked.
 */
export async function tagClientHere(clientId: string | null | undefined) {
  if (!clientId || !state.extras.length) return;
  try {
    const { data } = await supabase.from('clients').select('business_tags').eq('id', clientId).maybeSingle();
    const tags: string[] = ((data as any)?.business_tags ?? []).slice();
    const want = state.current ?? 'main';
    if (!tags.length && want === 'main') return; // no tags already means the main business
    const next = tags.length ? tags : ['main'];
    if (next.includes(want)) return;
    await supabase.from('clients').update({ business_tags: [...next, want] }).eq('id', clientId);
  } catch { /* the customer simply keeps the tags they had */ }
}

/** The pill at the top of a business screen. Draws nothing until there is a second business. */
export function BusinessBar() {
  const b = useBusinesses();
  if (!b.many) return null;
  const colour = b.all ? colours.purple : b.here.colour;
  return (
    <Pressable onPress={() => router.navigate('/businesses')} accessibilityRole="button" accessibilityLabel={`${b.all ? 'All businesses' : b.here.name}. Change business`}
      style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.pill, paddingVertical: 7, paddingLeft: 10, paddingRight: 12, marginTop: 6, backgroundColor: colour + '26', borderWidth: 1, borderColor: colour + '80' }}>
      <Ionicons name={b.all ? 'albums-outline' : 'business-outline'} size={15} color={colour} />
      <Text style={{ color: colours.text, fontSize: 13.5, fontWeight: '800', flexShrink: 1 }} numberOfLines={1}>{b.all ? 'All businesses' : b.here.name}</Text>
      <Ionicons name="chevron-down" size={14} color={colour} />
    </Pressable>
  );
}

/** A small tag saying which business something belongs to. Only shown in the All businesses view. */
export function BizTag({ id, always }: { id: string | null | undefined; always?: boolean }) {
  const b = useBusinesses();
  if (!b.many || (!b.all && !always)) return null;
  const x = b.of(id);
  return (
    <View style={{ alignSelf: 'flex-start', borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 9, backgroundColor: x.colour + '26', borderWidth: 1, borderColor: x.colour + '80', maxWidth: 160 }}>
      <Text style={{ fontSize: 11, fontWeight: '800', color: x.colour }} numberOfLines={1}>{x.name}</Text>
    </View>
  );
}

/**
 * The details that go on a quote or invoice for a given business: the main business's invoice
 * settings, with the extra business's own name, ABN and payment details laid over the top when
 * it has them.
 */
export function settingsForBusiness<T extends { business_name?: string | null; abn?: string | null; payment_details?: string | null }>(settings: T | null, businessId: string | null | undefined): T | null {
  const x = businessId ? state.extras.find((e) => e.id === businessId) : null;
  if (!x) return settings;
  return { ...(settings ?? ({} as T)), business_name: x.name, ...(x.abn ? { abn: x.abn } : null), ...(x.payment_details ? { payment_details: x.payment_details } : null) } as T;
}
