// Today, decluttered (3 Nov 2026). Two pieces that let Today stay short:
// GlanceGrid, four small tiles (money, health, week, goals) where tapping one slides its full
// card up in a sheet, and FoldList, a quiet list of rows that each open in a sheet (4 Nov 2026:
// nothing opens in place any more).
// Nothing here loads data; Today passes in what it already has.
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sheet } from '@/components/Sheet';
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
      <View style={{ gap: space.sm }}>
        {pairs(tiles).map((row, ri) => (
          <View key={ri} style={g.grid}>
            {row.map((t) => {
              const on = t.key === open;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setOpen(on ? null : t.key)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: on }}
                  style={g.tile}>
                  <View style={g.tileTop}>
                    <View style={[g.dot, { backgroundColor: toneColour(t.tone) }]} />
                    <Text style={g.label}>{t.label}</Text>
                  </View>
                  <Text style={g.value} numberOfLines={1}>{t.value}</Text>
                  {t.hint ? <Text style={g.hint} numberOfLines={1}>{t.hint}</Text> : null}
                </Pressable>
              );
            })}
            {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        ))}
      </View>
      <Sheet visible={!!openTile} title={openTile ? cap(openTile.label) : ''} onClose={() => setOpen(null)}>
        {openTile?.body}
      </Sheet>
    </View>
  );
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase();

// Two tiles a row, so an odd one out keeps its size instead of stretching across.
function pairs<T>(list: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += 2) out.push(list.slice(i, i + 2));
  return out;
}

// A row of chips; tapping one shows its card underneath. One level only, no cards inside cards.
export function ChipPicker({ items }: { items: Fold[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!items.length) return null;
  const cur = items.find((f) => f.key === open);
  return (
    <View>
      <View style={g.chips}>
        {items.map((f) => {
          const on = f.key === open;
          return (
            <Pressable key={f.key} onPress={() => setOpen(on ? null : f.key)} accessibilityRole="button" accessibilityState={{ expanded: on }} style={[g.chip, on && g.chipOn]}>
              <Text style={[g.chipText, on && { color: colours.onPurple }]}>{f.title}</Text>
            </Pressable>
          );
        })}
      </View>
      {cur ? (
        <View style={{ marginTop: space.sm }}>
          {cur.hint ? <Text style={g.chipHint}>{cur.hint}</Text> : null}
          {cur.body}
        </View>
      ) : null}
    </View>
  );
}

export type Fold = { key: string; title: string; hint?: string; body: ReactNode };

export function FoldList({ folds }: { folds: Fold[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!folds.length) return null;
  const cur = folds.find((f) => f.key === open);
  return (
    <View style={g.list}>
      {folds.map((f, i) => (
        <View key={f.key} style={i ? g.rowBorder : null}>
          <Pressable onPress={() => setOpen(f.key)} accessibilityRole="button" style={g.row}>
            <View style={{ flex: 1 }}>
              <Text style={g.rowTitle}>{f.title}</Text>
              {f.hint ? <Text style={g.rowHint} numberOfLines={1}>{f.hint}</Text> : null}
            </View>
            <Text style={g.chev}>{'›'}</Text>
          </Pressable>
        </View>
      ))}
      <Sheet visible={!!cur} title={cur?.title ?? ''} onClose={() => setOpen(null)}>
        {cur?.body}
      </Sheet>
    </View>
  );
}

const g = StyleSheet.create({
  grid: { flexDirection: 'row', gap: space.sm },
  tile: {
    flex: 1,
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { backgroundColor: colours.surface, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1, borderColor: colours.border, ...elevation.tile },
  chipOn: { backgroundColor: colours.purple, borderColor: colours.purple },
  chipText: { fontSize: 14, fontWeight: '700', color: colours.text },
  chipHint: { fontSize: 13, color: colours.muted, marginBottom: space.sm, marginLeft: 2 },
  list: { backgroundColor: colours.surface, borderRadius: radius.card, ...elevation.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: space.lg, gap: space.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: colours.border },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colours.text },
  rowHint: { fontSize: 13, color: colours.muted, marginTop: 2 },
  chev: { fontSize: 22, color: colours.faint, fontWeight: '600' },
  rowBody: { paddingHorizontal: space.sm, paddingBottom: space.sm, backgroundColor: colours.sunk },
});
