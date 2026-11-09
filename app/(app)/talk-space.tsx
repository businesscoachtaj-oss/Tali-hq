// 9 Nov 2026 concept: talking to her inside her space. Her words float in the sky, no bubbles. Yours glow.
// When she keeps something, you see it become a memory and where in her brain it goes. Mockup route.
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { NightBackground } from '@/components/NightSky';
import { Aurora } from '@/components/Aurora';
import { TaliAvatar } from '@/components/TaliAvatar';
import { currentConversation, messages as loadMessages, type Message } from '@/lib/data';
import { NO_BOTTOM } from '@/constants/theme';

// Sample of what the memory moment would show. Real ones come from what tali-chat saves each turn.
const KEPT: Record<number, { text: string; part: string; colour: string }> = {
  1: { text: 'Your ads lose people when the offer comes late', part: 'Work', colour: '#7FA8FF' },
  5: { text: 'Raising PT prices in January, current clients held until April', part: 'Plans and ideas', colour: '#FFE066' },
};

export default function TalkSpace() {
  const [msgs, setMsgs] = useState<Message[]>([]);
  useFocusEffect(useCallback(() => {
    currentConversation().then(loadMessages).then(setMsgs).catch(() => {});
  }, []));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#07061A' }} edges={NO_BOTTOM}>
      <NightBackground />
      <Aurora />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 }}>
        <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(185,166,255,0.18)', borderWidth: 1, borderColor: 'rgba(214,200,255,0.6)', shadowColor: '#B9A6FF', shadowOpacity: 1, shadowRadius: 20 }}>
          <TaliAvatar pose="head" size={36} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 26, fontFamily: 'InstrumentSerif_400Regular' }}>Tali</Text>
          <Text style={{ color: '#8EF0C8', fontSize: 12 }}>{'●'} Listening</Text>
        </View>
        <Text style={{ color: '#B9A6FF', fontSize: 15, fontWeight: '700' }}>Chats</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 30, gap: 22 }}>
        {msgs.map((m, i) => m.role === 'user' ? (
          <View key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '82%', backgroundColor: 'rgba(122,77,255,0.35)', borderRadius: 22, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(200,180,255,0.6)', shadowColor: '#7A4DFF', shadowOpacity: 0.7, shadowRadius: 18 }}>
            {m.attachments?.length ? <Text style={{ color: '#D7CCFF', fontSize: 12, fontWeight: '700', marginBottom: 4 }}>{'▶'} {m.attachments[0].name}</Text> : null}
            <Text style={{ color: '#FFFFFF', fontSize: 16, lineHeight: 22 }}>{m.content}</Text>
          </View>
        ) : (
          <View key={m.id} style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 9, backgroundColor: '#D7CCFF', shadowColor: '#B9A6FF', shadowOpacity: 1, shadowRadius: 10 }} />
            <View style={{ flex: 1 }}>
              {m.meta?.deep ? <Text style={{ color: '#B9A6FF', fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 6 }}>SHE THOUGHT HARDER</Text> : null}
              <Text style={{ color: '#FFFFFF', fontSize: 18, lineHeight: 27, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 8 }}>{m.content}</Text>
              {KEPT[i] ? (
                <View style={{ marginTop: 12, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: KEPT[i].colour + '22', borderWidth: 1, borderColor: KEPT[i].colour + 'AA', shadowColor: KEPT[i].colour, shadowOpacity: 0.8, shadowRadius: 14 }}>
                  <Text style={{ color: KEPT[i].colour, fontSize: 13 }}>{'✦'}</Text>
                  <Text style={{ color: '#FFFFFF', fontSize: 12.5, flexShrink: 1 }}><Text style={{ fontWeight: '800' }}>New memory</Text> {KEPT[i].text} <Text style={{ color: KEPT[i].colour, fontWeight: '700' }}>{'→'} {KEPT[i].part}</Text></Text>
                </View>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 12, borderRadius: 999, paddingVertical: 8, paddingLeft: 20, paddingRight: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(214,200,255,0.45)' }}>
        <Text style={{ flex: 1, color: 'rgba(255,255,255,0.6)', fontSize: 16 }}>Tell her anything...</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Talk out loud" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#B9A6FF', alignItems: 'center', justifyContent: 'center', shadowColor: '#B9A6FF', shadowOpacity: 1, shadowRadius: 16 }}>
          <Text style={{ color: '#0C0A24', fontSize: 18, fontWeight: '800' }}>{'●'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
