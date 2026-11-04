// A slide-up sheet (4 Nov 2026). Replaces the rows that opened in place on Today: tap a row and
// its full content slides up over the page as a floating card with round corners. Tap the
// dark area, the Close button or swipe the phone back to shut it.
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { colours, radius, space } from '@/constants/theme';

export function Sheet({ visible, title, sub, onClose, children }: { visible: boolean; title: string; sub?: string | null; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(20,16,30,0.45)' }}>
      <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
      <View style={{ backgroundColor: colours.bg, borderRadius: 32, marginHorizontal: 8, marginBottom: 8, maxHeight: '86%', paddingTop: 10, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 12 }}>
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colours.borderStrong, alignSelf: 'center', marginBottom: 8 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingBottom: sub ? 2 : space.md, gap: space.md }}>
          <Text style={{ flex: 1, fontSize: 20, fontWeight: '800', color: colours.text }} numberOfLines={2}>{title}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={10} style={{ borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 13, backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.border }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colours.text }}>Close</Text>
          </Pressable>
        </View>
        {sub ? <Text style={{ fontSize: 13, color: colours.muted, paddingHorizontal: space.lg, marginBottom: space.md }}>{sub}</Text> : null}
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </View>
      </View>
    </Modal>
  );
}
