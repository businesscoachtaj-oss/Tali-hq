// 27 Nov 2026 (Taj): Settings, Connections. Zapier and the Tali HQ API.
// Make a key, copy it into Zapier, revoke it when it's no longer used. The key shows once.
// The key can read clients and leads, enquiries, bookings, paid invoices and accepted quotes, and add a
// client or lead, a reminder or a note. It never sends, spends or deletes (supabase/functions/tali-api).
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '@/lib/supabase';
import { myCredits } from '@/lib/data';
import { isPaid } from '@/lib/plan';
import { Button, Card } from '@/components/ui';
import { colours, space } from '@/constants/theme';

type Key = { id: string; name: string; last4: string; created_at: string; last_used_at: string | null; revoked_at: string | null };
const when = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : 'never');

async function call(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('tali-api', { body });
  if (error) return { ok: false, message: 'Could not reach Tali HQ. Please try again.' };
  return data;
}

export function ApiKeysCard() {
  const [keys, setKeys] = useState<Key[] | null>(null);
  const [paid, setPaid] = useState<boolean | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const [credits, res] = await Promise.all([
      myCredits().catch(() => null),
      supabase.from('api_keys').select('id, name, last4, created_at, last_used_at, revoked_at').is('revoked_at', null).order('created_at', { ascending: false }),
    ]);
    setPaid(isPaid(credits));
    setKeys((res.data as Key[]) ?? []);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function make() {
    setNote(''); setBusy(true);
    const r = await call({ action: 'create_key', name: 'Zapier' });
    setBusy(false);
    if (!r?.ok) return setNote(r?.message ?? 'Could not make a key.');
    setFresh(r.key); setCopied(false);
    load();
  }
  async function copy() {
    if (!fresh) return;
    try { await Clipboard.setStringAsync(fresh); setCopied(true); } catch { setNote('Could not copy. Select the key and copy it by hand.'); }
  }
  async function revoke(id: string) {
    setBusy(true);
    const r = await call({ action: 'revoke_key', id });
    setBusy(false); setConfirm(null);
    if (!r?.ok) return setNote(r?.message ?? 'Could not revoke it.');
    load();
  }

  return (
    <Card>
      <Text style={{ fontWeight: '700', color: colours.text, fontSize: 16 }}>Zapier and the Tali HQ API</Text>
      <Text style={{ color: colours.muted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
        Link me to thousands of apps through Zapier. New leads, enquiries, bookings, paid invoices and accepted quotes can start a Zap, and a Zap can add a lead, a reminder or a note for me. A key can never send, spend or delete anything.
      </Text>

      {paid === false ? (
        <Text style={{ color: colours.muted, fontSize: 13, marginTop: space.sm }}>Comes with HQ, Pro and Max.</Text>
      ) : null}

      {fresh ? (
        <View style={{ marginTop: space.md, padding: space.md, borderRadius: 12, backgroundColor: colours.purpleSoft }}>
          <Text style={{ color: colours.text, fontWeight: '700' }}>Your new key</Text>
          <Text selectable style={{ color: colours.text, fontFamily: 'monospace', fontSize: 13, marginTop: 6 }}>{fresh}</Text>
          <Text style={{ color: colours.muted, fontSize: 12.5, marginTop: 6 }}>Copy it now. For your safety it won't show again.</Text>
          <Button title={copied ? 'Copied' : 'Copy key'} kind="ghost" onPress={copy} />
        </View>
      ) : null}

      {(keys ?? []).map((k) => (
        <View key={k.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colours.border }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colours.text, fontWeight: '600' }}>{k.name} key ending {k.last4}</Text>
            <Text style={{ color: colours.muted, fontSize: 12.5 }}>Made {when(k.created_at)}. Last used {when(k.last_used_at)}.</Text>
          </View>
          {confirm === k.id ? (
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Pressable onPress={() => revoke(k.id)} disabled={busy} accessibilityRole="button"><Text style={{ color: colours.danger, fontWeight: '700' }}>Revoke</Text></Pressable>
              <Pressable onPress={() => setConfirm(null)} accessibilityRole="button"><Text style={{ color: colours.muted, fontWeight: '600' }}>Keep</Text></Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setConfirm(k.id)} accessibilityRole="button"><Text style={{ color: colours.muted, fontWeight: '600' }}>Revoke</Text></Pressable>
          )}
        </View>
      ))}

      {note ? <Text style={{ color: colours.danger, fontSize: 13, marginTop: space.sm }}>{note}</Text> : null}
      {paid ? <Button title={keys?.length ? 'Make another key' : 'Make a key'} kind={keys?.length ? 'ghost' : 'primary'} onPress={make} busy={busy} /> : null}
    </Card>
  );
}
