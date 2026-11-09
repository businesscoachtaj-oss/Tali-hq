// 9 Nov 2026 look refresh: one brain, two rooms. Business and Life show the same app split in half,
// so each screen is focused without removing anything.
import { Pressable, Text, View } from 'react-native';
import { colours, radius } from '@/constants/theme';

export type Room = 'business' | 'life';

export function RoomSwitch({ value, onChange }: { value: Room; onChange: (r: Room) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colours.sunk, borderRadius: radius.pill, padding: 4, marginBottom: 16 }}>
      {(['business', 'life'] as const).map((r) => {
        const on = value === r;
        return (
          <Pressable key={r} onPress={() => onChange(r)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={{ flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center', backgroundColor: on ? colours.surface : 'transparent', shadowColor: '#272626', shadowOpacity: on ? 0.08 : 0, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
            <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: on ? colours.purple : colours.muted }}>{r === 'business' ? 'Business' : 'Life'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
