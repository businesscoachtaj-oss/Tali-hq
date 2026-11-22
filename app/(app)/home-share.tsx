// app/(app)/home-share.tsx
// ADDED (16 Nov 2026, Taj): share your HQ layout as a link. People who open it can copy the
// layout into their own Tali HQ. Only the layout goes by default: which blocks, their targets and
// how they look. Your numbers stay yours unless you switch them on.
// BUILT FOR REAL (17 Nov 2026): makes a real link (shared_layouts), which can be switched off any time.
import { useEffect, useState } from 'react';
import { Platform, Pressable, Share, Switch, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BackLink, Button, ErrorText, Screen, Title } from '@/components/ui';
import { MiniLayout } from '@/components/Widgets';
import { colours, radius, space } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { homeKeyFor, snapshot, useHome, type Widget } from '@/lib/widgets';
import { MODE, type Mode } from '@/lib/mode';
import { useAuth } from '@/lib/auth';
import { useHasBusiness } from '@/lib/business';
import { useBusinesses } from '@/lib/businesses';

export const HQ_BASE = 'https://talihq.com.au/hq/';
/** A shared snapshot back into blocks that can be drawn. */
export function fromSnapshot(blocks: any[]): Widget[] {
  return (blocks ?? []).map((b: any) => (b.kind === 'tracker' && b.spec ? { ...b, tracker: b.value !== undefined ? { ...b.spec, value: Number(b.value), week: (b.week ?? []).map(Number), streak: 0 } : undefined } : b)) as Widget[];
}

type Row = { slug: string; name: string; about: string; show_numbers: boolean; featured_ok: boolean; active: boolean; copies: number };

export default function HomeShare() {
  const q = useLocalSearchParams<{ mode?: string }>();
  const hasBiz = useHasBusiness();
  const bz = useBusinesses();
  const mode: Mode = !hasBiz ? 'life' : q.mode === 'business' ? 'business' : 'life';
  const { profile } = useAuth();
  const home = useHome(homeKeyFor(mode, hasBiz, bz.current), hasBiz);
  const free = home.plan === 'free';
  const [row, setRow] = useState<Row | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [numbers, setNumbers] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    let live = true;
    setLoaded(false);
    supabase.from('shared_layouts').select('slug, name, about, show_numbers, featured_ok, active, copies').eq('home', mode).order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => {
        if (!live) return;
        const r = ((data as Row[]) ?? [])[0] ?? null;
        setRow(r);
        setName(r?.name ?? `${profile?.first_name || 'My'}${profile?.first_name ? "'s" : ''} ${hasBiz ? MODE[mode].label.toLowerCase() + ' ' : ''}HQ`);
        setAbout(r?.about ?? ''); setNumbers(!!r?.show_numbers); setFeatured(!!r?.featured_ok);
        setLoaded(true);
      }, () => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, [mode, profile?.first_name, hasBiz]);

  const blocks = snapshot(home.shown, numbers);
  const link = row ? `${HQ_BASE}${row.slug}` : '';

  async function save(patch: Partial<Row> = {}) {
    setBusy(true); setErr(''); setNote('');
    try {
      const body = { home: mode, name: name.trim().slice(0, 80) || 'My HQ', about: about.trim().slice(0, 300), blocks, show_numbers: numbers, featured_ok: featured, active: true, updated_at: new Date().toISOString(), ...patch };
      if (row) {
        const { error } = await supabase.from('shared_layouts').update(body).eq('slug', row.slug);
        if (error) throw error;
        setRow({ ...row, ...body } as Row);
      } else {
        const stem = (profile?.first_name || 'hq').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 14) || 'hq';
        const slug = `${stem}-${Math.random().toString(36).slice(2, 6)}${Date.now().toString(36).slice(-2)}`;
        const { error } = await supabase.from('shared_layouts').insert({ slug, ...body });
        if (error) throw error;
        setRow({ slug, copies: 0, ...body } as Row);
      }
      setNote(patch.active === false ? 'Link switched off. Nobody can open it now.' : row ? 'Link updated with your home as it is now.' : 'Your link is ready.');
    } catch { setErr('Could not save your link. Check your connection and try again.'); }
    setBusy(false);
  }
  async function copy() { await Clipboard.setStringAsync(link); setNote('Link copied.'); }
  async function share() {
    if (Platform.OS === 'web' && !(navigator as any).share) return copy();
    try { await Share.share(Platform.OS === 'ios' ? { url: link, message: `My Tali HQ layout: ${row!.name}` } : { message: `My Tali HQ layout: ${row!.name} ${link}` }); } catch {}
  }

  if (free) {
    return (
      <Screen>
        <BackLink onPress={() => router.navigate(`/home-edit?mode=${mode}` as any)} label="Edit home" />
        <Title sub="Sharing your layout by link comes with Tali HQ and up.">Share your layout</Title>
        <Button title="See plans" onPress={() => router.navigate('/plans')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <BackLink onPress={() => router.navigate(`/home-edit?mode=${mode}` as any)} label="Edit home" />
      <Title sub="Send it to a friend, a teammate or your followers. They can copy it into their own HQ.">Share your layout</Title>

      <View style={{ borderRadius: 24, padding: 16, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: colours.purple, marginBottom: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Ionicons name="planet-outline" size={18} color={colours.purple} />
          <Text numberOfLines={1} style={{ color: colours.text, fontSize: 18, fontWeight: '800', flex: 1 }}>{name || 'My HQ'}</Text>
          <Text style={{ color: colours.faint, fontSize: 12 }}>{blocks.length} blocks</Text>
        </View>
        <MiniLayout widgets={fromSnapshot(blocks)} blank={!numbers} />
      </View>

      <TextInput value={name} onChangeText={setName} maxLength={80} placeholder="Name your layout" placeholderTextColor={colours.faint} accessibilityLabel="Layout name"
        style={{ backgroundColor: colours.sunk, borderWidth: 1, borderColor: colours.border, borderRadius: radius.input, color: colours.text, fontSize: 16, paddingHorizontal: 14, paddingVertical: 11, marginBottom: space.sm }} />
      <TextInput value={about} onChangeText={setAbout} maxLength={300} placeholder="One line about it (optional)" placeholderTextColor={colours.faint} accessibilityLabel="About this layout"
        style={{ backgroundColor: colours.sunk, borderWidth: 1, borderColor: colours.border, borderRadius: radius.input, color: colours.text, fontSize: 15, paddingHorizontal: 14, paddingVertical: 11, marginBottom: space.md }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.border, marginBottom: space.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colours.text, fontWeight: '800' }}>Show my numbers</Text>
          <Text style={{ color: colours.muted, fontSize: 12.5 }}>Off: they see the layout and targets only. On: they also see where you were at when you last updated the link.</Text>
        </View>
        <Switch value={numbers} onValueChange={setNumbers} accessibilityLabel="Show my numbers" />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.border, marginBottom: space.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colours.text, fontWeight: '800' }}>OK to feature</Text>
          <Text style={{ color: colours.muted, fontSize: 12.5 }}>If we add a shelf of popular layouts later, yours can go on it. Numbers are never shown there.</Text>
        </View>
        <Switch value={featured} onValueChange={setFeatured} accessibilityLabel="OK to feature" />
      </View>

      {row && row.active ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.input, backgroundColor: colours.sunk, borderWidth: 1, borderColor: colours.border, marginVertical: space.md }}>
          <Ionicons name="link" size={16} color={colours.purple} />
          <Text numberOfLines={1} style={{ flex: 1, color: colours.text, fontSize: 14 }} selectable>{link.replace('https://', '')}</Text>
          <Pressable onPress={copy} accessibilityRole="button" style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colours.purpleSoft }}><Text style={{ color: colours.purpleInk, fontWeight: '800' }}>Copy</Text></Pressable>
        </View>
      ) : <View style={{ height: space.md }} />}
      {note ? <Text style={{ color: colours.good, fontWeight: '700', marginBottom: space.sm }}>{note}</Text> : null}
      <ErrorText>{err}</ErrorText>

      {row && row.active ? (
        <>
          <Button title="Share" onPress={share} />
          <Button kind="ghost" title="Update the link with my home now" onPress={() => save()} busy={busy} />
          <Button kind="ghost" title="Turn the link off" onPress={() => save({ active: false })} disabled={busy} />
          {row.copies ? <Text style={{ color: colours.faint, fontSize: 12.5, textAlign: 'center' }}>Copied into {row.copies} {row.copies === 1 ? 'HQ' : 'HQs'} so far.</Text> : null}
        </>
      ) : (
        <Button title={row ? 'Turn the link back on' : 'Make my link'} onPress={() => save()} busy={busy} disabled={!loaded || !blocks.length} />
      )}
      <Text style={{ color: colours.faint, fontSize: 12.5, marginTop: space.md, lineHeight: 18 }}>Nothing from your brain, journal, people or messages is ever in a shared layout. A note is shared as an empty note and a checklist without its items. You can turn the link off any time.</Text>
      <View style={{ height: space.xl }} />
    </Screen>
  );
}
