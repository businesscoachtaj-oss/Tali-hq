import { Pressable, Text, View } from 'react-native';
import { colours, elevation, radius, space } from '@/constants/theme';

export function ChipPicker<T extends string>({
  options,
  value,
  onChange,
  label = (o: T) => o,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  label?: (o: T) => string;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md }}>
      {options.map((o) => {
        const on = value === o;
        return (
          <Pressable
            key={o}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o)}
            style={{
              paddingVertical: 9,
              paddingHorizontal: 14,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: on ? colours.purple : colours.borderStrong,
              backgroundColor: on ? colours.purple : colours.surface,
              ...(on ? elevation.button(colours.purple) : elevation.lift),
            }}>
            <Text style={{ color: on ? colours.onPurple : colours.text, fontWeight: '600' }}>{label(o)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
