// Today, decluttered (MOCKUP, 3 Nov 2026, not shipped). Two pieces that let Today stay short:
// GlanceGrid, four small tiles (money, health, week, goals) where tapping one opens its full
// card underneath, and FoldList, a quiet list of "more from Tali" rows that open in place.
// Nothing here loads data; Today passes in what it already has.
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colours, elevation, radius, space } from '@/constants/theme';

export type Tile = { key: string; label: string; value: string; hint?: string; tone?: 'good' | 'warn' | 'bad' | 'plain'; body: ReactNode };

const toneColour = (t?: Tile['tone']) =>
  t === 'good' ? colours.good : t === 'warn' ? colours.orange : t === 'bad' ? colours.danger : colours.purple;

export function GlanceGrid({ tiles }: { tiles: Tile[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!tiles.length) return null;
  const openTile = tiles.find((t) => t.key === open);
  return (
    <View>
      <View style={g.grid}>
        {tiles.map((t) => {
          const on = t.key === open;
          return (
            <Pressable
              key={t.key}
              onPress={() => setOpen(on ? null : t.key)}
              accessibilityRole="button"
              accessibilityState={{ expanded: on }}
              style={[g.tile, on && g.tileOn]}>
              <View style={g.tileTop}>
                <View style={[g.dot, { backgroundColor: toneColour(t.tone) }]} />
                <Text style={[g.label, on && { color: colours.purpleInk }]}>{t.label}</Text>
              </View>
              <Text style={g.value} numberOfLines={1}>{t.value}</Text>
              {t.hint ? <Text style={g.hint} numberOfLines={1}>{t.hint}</Text> : null}
            </Pressable>
          );
        })}
      </View>
      {openTile ? <View style={{ marginTop: space.sm }}>{openTile.body}</View> : null}
    </View>
  );
}

export type Fold = { key: string; title: string; hint?: string; body: ReactNode };

export function FoldList({ folds }: { folds: Fold[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!folds.length) return null;
  return (
    <View style={g.list}>
      {folds.map((f, i) => {
        const on = f.key === open;
        return (
          <View key={f.key} style={i ? g.rowBorder : null}>
            <Pressable onPress={() => setOpen(on ? null : f.key)} accessibilityRole="button" accessibilityState={{ expanded: on }} style={g.row}>
              <View style={{ flex: 1 }}>
                <Text style={g.rowTitle}>{f.title}</Text>
                {f.hint && !on ? <Text style={g.rowHint} numberOfLines={1}>{f.hint}</Text> : null}
              </View>
              <Text style={[g.chev, on && { transform: [{ rotate: '90deg' }] }]}>{'›'}</Text>
            </Pressable>
            {on ? <View style={g.rowBody}>{f.body}</View> : null}
          </View>
        );
      })}
    </View>
  );
}

const g = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colours.surface,
    borderRadius: 16,
    padding: space.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...elevation.card,
  },
  tileOn: { borderColor: colours.purple, backgroundColor: colours.purpleSoft },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 12, fontWeight: '800', color: colours.muted, letterSpacing: 0.6, textTransform: 'uppercase' },
  value: { fontSize: 20, fontWeight: '800', color: colours.text, marginTop: 6, letterSpacing: -0.3 },
  hint: { fontSize: 12, color: colours.muted, marginTop: 2 },
  list: { backgroundColor: colours.surface, borderRadius: radius.card, ...elevation.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: space.lg, gap: space.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: colours.border },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colours.text },
  rowHint: { fontSize: 13, color: colours.muted, marginTop: 2 },
  chev: { fontSize: 22, color: colours.faint, fontWeight: '600' },
  rowBody: { paddingHorizontal: space.sm, paddingBottom: space.sm, backgroundColor: colours.sunk },
});
