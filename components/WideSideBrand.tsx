// components/WideSideBrand.tsx (22 Nov 2026): the top and bottom of the side menu on a PC. Tali HQ's
// name sits above the tabs and Tali stands at the bottom (her own sprite, unchanged). Only drawn on a
// wide web window (the tab layout checks useWide first), so phones and the phone apps never see it.
import { StyleSheet, Text, View } from 'react-native';
import { TaliAvatar } from '@/components/TaliAvatar';
import { SIDEBAR, SIDE_TOP } from '@/lib/wideWeb';

export function WideSideBrand() {
  return (
    <>
      <View pointerEvents="none" style={s.top}>
        <View style={s.head}>
          <TaliAvatar pose="head" size={30} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.kicker} numberOfLines={1}>TALI HQ</Text>
          <Text style={s.name} numberOfLines={1}>Life and business</Text>
        </View>
      </View>
      <View pointerEvents="none" style={s.tali}>
        <TaliAvatar pose="wave" size={96} />
      </View>
    </>
  );
}

const s = StyleSheet.create({
  top: { position: 'absolute', left: 0, top: 0, width: SIDEBAR, height: SIDE_TOP, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, zIndex: 2 },
  head: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(185,166,255,0.18)', borderWidth: 1, borderColor: 'rgba(214,200,255,0.6)' },
  kicker: { fontSize: 13, fontWeight: '800', letterSpacing: 3, color: '#3B3F9E' },
  name: { fontSize: 15, fontWeight: '700', color: '#1C1A17', marginTop: 2 },
  tali: { position: 'absolute', left: 0, bottom: 24, width: SIDEBAR, alignItems: 'center', zIndex: 2 },
});
