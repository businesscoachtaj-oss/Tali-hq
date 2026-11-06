// Visual memories (6 Nov 2026, asked for by Taj): the images Tali made for you, kept in the occipital
// (vision) part of her brain. A grid of thumbnails; tap one to see it big, open it full size, jump to
// the chat it came from or delete it.
import { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Card, useConfirm } from '@/components/ui';
import { colours, radius, space } from '@/constants/theme';
import { deleteVisualMemory, visualMemories, type VisualMemory } from '@/lib/brain';

const COLS = 3;
const GAP = 6;

export function VisualMemories() {
  const [items, setItems] = useState<VisualMemory[] | null>(null);
  const [open, setOpen] = useState<VisualMemory | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [gridW, setGridW] = useState(0);
  const { armed, confirm } = useConfirm();
  const { width, height } = useWindowDimensions();

  const load = useCallback(async () => {
    try {
      setItems(await visualMemories());
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your images.');
      setItems([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const tile = gridW ? Math.floor((gridW - GAP * (COLS - 1)) / COLS) : 0;
  const key = (v: VisualMemory) => `${v.message_id}:${v.idx}`;

  function remove(v: VisualMemory) {
    confirm(key(v), async () => {
      setBusy(true);
      try {
        await deleteVisualMemory(v);
        setOpen(null);
        setItems((list) => (list ?? []).filter((x) => key(x) !== key(v)));
      } catch {
        setError('Could not delete that one. Try again.');
      }
      setBusy(false);
    });
  }

  const big = Math.min(width - space.lg * 2, 520);
  const bigH = open ? (open.shape === 'portrait' ? big * 1.5 : open.shape === 'landscape' ? big / 1.5 : big) : big;
  const fitH = Math.min(bigH, height * 0.55);
  const fitW = fitH < bigH ? (big * fitH) / bigH : big;

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colours.text, flex: 1 }}>Visual memories</Text>
        {items?.length ? <Text style={{ color: colours.muted, fontWeight: '700' }}>{items.length}</Text> : null}
      </View>
      <Text style={{ color: colours.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }}>Every image Tali has made for you. Tap one to see it, save it or delete it.</Text>
      {error ? <Text style={{ color: colours.danger, fontSize: 13, marginTop: space.sm }}>{error}</Text> : null}

      {items === null ? null : items.length === 0 ? (
        <Text style={{ color: colours.muted, marginTop: space.md, lineHeight: 20 }}>Nothing yet. Ask Tali for a poster, logo or social graphic in Talk and it lands here.</Text>
      ) : (
        <View onLayout={(e) => setGridW(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP, marginTop: space.md }}>
          {tile
            ? items.map((v) => (
                <Pressable key={key(v)} onPress={() => setOpen(v)} accessibilityRole="imagebutton" accessibilityLabel={`Image: ${v.prompt.slice(0, 80)}`}>
                  <Image source={{ uri: v.url }} style={{ width: tile, height: tile, borderRadius: 10, backgroundColor: colours.sunk }} resizeMode="cover" />
                </Pressable>
              ))
            : null}
        </View>
      )}

      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable onPress={() => setOpen(null)} style={{ flex: 1, backgroundColor: 'rgba(20,19,19,0.82)', justifyContent: 'center', alignItems: 'center', padding: space.lg }}>
          {open ? (
            <Pressable onPress={() => {}} style={{ width: big, maxWidth: '100%', backgroundColor: colours.surface, borderRadius: radius.card, padding: space.md, gap: space.md }}>
              <Image source={{ uri: open.url }} style={{ width: fitW, height: fitH, alignSelf: 'center', borderRadius: 12, backgroundColor: colours.sunk }} resizeMode="contain" />
              <ScrollView style={{ maxHeight: 90 }}>
                <Text style={{ color: colours.faint, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
                  Made {new Date(open.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
                <Text style={{ color: colours.text, fontSize: 13, lineHeight: 19, marginTop: 2 }}>{open.prompt}</Text>
              </ScrollView>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                <Pill label="Open full size" filled onPress={() => open.url && Linking.openURL(open.url)} />
                <Pill label="Go to the chat" onPress={() => { const c = open.conversation_id; setOpen(null); router.navigate({ pathname: '/talk', params: { chat: c } }); }} />
                <Pill label={armed === key(open) ? 'Sure? Tap again' : 'Delete'} danger onPress={() => remove(open)} disabled={busy} />
              </View>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
    </Card>
  );
}

function Pill({ label, onPress, filled, danger, disabled }: { label: string; onPress: () => void; filled?: boolean; danger?: boolean; disabled?: boolean }) {
  const c = danger ? colours.danger : colours.purple;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: c, backgroundColor: filled ? c : 'transparent', opacity: disabled ? 0.5 : 1 }}>
      <Text style={{ color: filled ? colours.onPurple : c, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}
