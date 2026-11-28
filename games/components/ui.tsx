// The building blocks the brain games use (25 Nov 2026, from the brain games app). Brought into the main
// app on 28 Nov 2026 (Taj): the games now live inside Learnéd (was Tali HQ), so this is trimmed to what
// the games and the game frame need, in the app's paper and ink.
import { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, type StyleProp, type ViewStyle } from 'react-native';
import { C, F, R } from './theme';
import { REGIONS, type RegionId } from '../lib/brain';

/** Grown-ups only in the main app, so text is always the normal size. */
export function useScale() {
  return 1;
}

export function Btn({ label, onPress, kind = 'ink', colour, small, disabled, style }: { label: string; onPress?: () => void; kind?: 'ink' | 'ghost' | 'soft' | 'colour' | 'quiet'; colour?: string; small?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const bg = kind === 'ink' ? C.ink : kind === 'colour' ? colour ?? C.teal : kind === 'soft' ? C.card : 'transparent';
  const fg = kind === 'ink' || kind === 'colour' ? C.cream : kind === 'quiet' ? C.soft : C.ink;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
      style={({ pressed }) => [s.btn, small && s.btnSmall, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 }, kind === 'ghost' && { borderWidth: 1.5, borderColor: C.ink }, kind === 'soft' && { borderWidth: 1, borderColor: C.line }, style]}>
      <Text style={[s.btnT, small && { fontSize: 14 }, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, on, onPress, colour = C.ink }: { label: string; on?: boolean; onPress?: () => void; colour?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!on }} style={[s.chip, on && { backgroundColor: colour, borderColor: colour }]}>
      <Text style={[s.chipT, on && { color: C.cream }]}>{label}</Text>
    </Pressable>
  );
}

export const Chips = ({ children }: { children: ReactNode }) => <View style={s.chips}>{children}</View>;

export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={s.sheet}>
        <View style={s.grab} />
        <Text style={s.sheetT}>{title}</Text>
        {children}
      </View>
    </Modal>
  );
}

export function Stars({ n, size = 16 }: { n: number; size?: number }) {
  return <Text style={{ fontSize: size, letterSpacing: 1 }} accessibilityLabel={`${n} of 3 stars`}><Text style={{ color: '#E2A21B' }}>{'★'.repeat(n)}</Text><Text style={{ color: '#DCD2BE' }}>{'★'.repeat(Math.max(0, 3 - n))}</Text></Text>;
}

export function Bar({ pct, colour = C.teal, h = 8 }: { pct: number; colour?: string; h?: number }) {
  return <View style={{ height: h, borderRadius: h, backgroundColor: C.line, overflow: 'hidden' }}><View style={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%`, height: h, borderRadius: h, backgroundColor: colour }} /></View>;
}

export function PartChip({ region, kids }: { region: RegionId; kids?: boolean }) {
  const r = REGIONS[region];
  return (
    <View style={s.partChip} accessibilityLabel={`Works your ${r.name}`}>
      <View style={[s.partDot, { backgroundColor: r.colour }]} />
      <Text style={s.partT}>Works your {kids ? r.kidName.toLowerCase() : `${r.name.toLowerCase()}: ${r.human.toLowerCase()}`}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  btn: { borderRadius: R.pill, paddingVertical: 15, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { paddingVertical: 9, paddingHorizontal: 14, alignSelf: 'flex-start' },
  btnT: { fontFamily: F.bold, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: R.pill, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingHorizontal: 14, paddingVertical: 9 },
  chipT: { fontFamily: F.bold, fontSize: 14, color: C.ink },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(31,27,22,0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, paddingBottom: 36, gap: 12, maxHeight: '88%' },
  grab: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: C.line },
  sheetT: { fontFamily: F.display, fontSize: 24, color: C.ink },
  partChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: R.pill, paddingHorizontal: 11, paddingVertical: 5 },
  partDot: { width: 8, height: 8, borderRadius: 4 },
  partT: { fontFamily: F.med, fontSize: 12, color: C.soft },
});
