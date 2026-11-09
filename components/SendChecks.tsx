// "Check before sending" (9 Nov 2026, from Tali's Tuesday list). Runs on every draft before it can go:
//   1. Leftover placeholder text like [client name] or [YOUR PRICE]. Found = red, and Send waits.
//   2. The sending address: bounces in the last 30 days (sending-health edge function, which asks
//      Resend). Only known for the Tali address; for Gmail and Outlook, and on any failure, the row
//      just doesn't show. It never blocks a send on its own.
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { colours, space } from '@/constants/theme';

const PLACEHOLDER = /\[[^\]\n]{2,40}\]/g;

export function findPlaceholders(...texts: (string | null | undefined)[]): string[] {
  const found = new Set<string>();
  for (const t of texts) for (const m of (t ?? '').match(PLACEHOLDER) ?? []) found.add(m);
  return [...found];
}

type Sending = { address: string; bounces_30d: number } | null;

export function SendChecks({ placeholders, approvalId }: { placeholders: string[]; approvalId: string }) {
  const [sending, setSending] = useState<Sending>(null);
  useEffect(() => {
    let alive = true;
    supabase.functions.invoke('sending-health', { body: { approvalId } }).then(({ data, error }) => {
      const d = data as { address?: string; bounces_30d?: number | null } | null;
      if (alive && !error && d?.address && typeof d.bounces_30d === 'number') setSending({ address: d.address, bounces_30d: d.bounces_30d });
    }, () => {});
    return () => { alive = false; };
  }, [approvalId]);

  const rows: { ok: boolean; title: string; sub: string }[] = [];
  rows.push(placeholders.length
    ? { ok: false, title: placeholders.length === 1 ? 'A placeholder is still in the text' : `${placeholders.length} placeholders are still in the text`, sub: `${placeholders.join(', ')} needs the real details. Tell Tali with "something else...".` }
    : { ok: true, title: 'No placeholders left', sub: 'Every name and detail is filled in.' });
  if (sending) rows.push(sending.bounces_30d
    ? { ok: false, title: 'Recent bounces from this address', sub: `${sending.address} had ${sending.bounces_30d} bounce${sending.bounces_30d === 1 ? '' : 's'} in 30 days. Check it's set up before sending.` }
    : { ok: true, title: 'Sending address is healthy', sub: `No bounces from ${sending.address} in 30 days.` });

  return (
    <View style={{ marginTop: space.md, borderWidth: 1, borderColor: colours.border, borderRadius: 12, overflow: 'hidden' }}>
      <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: colours.muted, paddingHorizontal: space.md, paddingTop: 10, paddingBottom: 4 }}>TALI CHECKED IT</Text>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 10, paddingHorizontal: space.md, paddingVertical: 10, backgroundColor: r.ok ? 'transparent' : '#FDECEA', borderTopWidth: i ? 1 : 0, borderTopColor: colours.border }}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: r.ok ? colours.good : colours.danger, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>{r.ok ? '✓' : '!'}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colours.text }}>{r.title}</Text>
            <Text style={{ fontSize: 13, color: colours.muted, lineHeight: 18 }}>{r.sub}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
