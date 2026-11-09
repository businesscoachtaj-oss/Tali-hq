// 9 Nov 2026 concept: talking to her inside her space. Her words float in the sky, no bubbles. Yours glow.
// When she keeps something, you see it become a memory and where in her brain it goes. Mockup route.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { NightBackground } from '@/components/NightSky';
import { Aurora } from '@/components/Aurora';
import { TaliDots } from '@/components/TaliDots';
import { currentConversation, messages as loadMessages, type Message } from '@/lib/data';
import { NO_BOTTOM } from '@/constants/theme';

// Sample of what the memory moment would show. Real ones come from what tali-chat saves each turn.
const KEPT: Record<number, { text: string; part: string; colour: string }> = {
  1: { text: 'Your ads lose people when the offer comes late', part: 'Work', colour: '#7FA8FF' },
  5: { text: 'Raising PT prices in January, current clients held until April', part: 'Plans and ideas', colour: '#FFE066' },
};

export default function TalkSpace() {
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [shown, setShown] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const { width, height } = useWindowDimensions();
  // She's working out a reply when the next message due in is hers.
  const thinking = shown > 0 && shown < msgs.length && msgs[shown]?.role === 'assistant';
  const status = thinking ? 'Thinking' : 'Listening';
  // Each time she keeps a memory, a few of her dots float off her head and down to Her brain.
  const [flights, setFlights] = useState<{ key: number; colour: string }[]>([]);
  useEffect(() => {
    const i = shown - 1;
    if (KEPT[i]) {
      const t = setTimeout(() => setFlights((f) => [...f, { key: i, colour: KEPT[i].colour }]), 900);
      return () => clearTimeout(t);
    }
  }, [shown]);
  useEffect(() => {
    if (shown >= msgs.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 400 : 1700);
    return () => clearTimeout(t);
  }, [shown, msgs.length]);
  useEffect(() => { setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 150); }, [shown]);
  useFocusEffect(useCallback(() => {
    currentConversation().then(loadMessages).then(setMsgs).catch(() => {});
  }, []));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#07061A' }} edges={NO_BOTTOM}>
      <NightBackground />
      <Aurora />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(214,200,255,0.15)' }}>
        <TaliDots width={92} height={128} thinking={thinking} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 30, fontFamily: 'InstrumentSerif_400Regular' }}>Tali</Text>
          <Text style={{ color: thinking ? '#FFB04D' : '#8EF0C8', fontSize: 13, fontWeight: '700' }}>{'●'} {status}</Text>
        </View>
        <Text style={{ color: '#B9A6FF', fontSize: 15, fontWeight: '700' }}>Chats</Text>
      </View>
      <ScrollView ref={scroller} contentContainerStyle={{ padding: 20, paddingBottom: 30, gap: 22 }}>
        {msgs.slice(0, shown).map((m, i) => m.role === 'user' ? (
          <FadeIn key={m.id}><View style={{ alignSelf: 'flex-end', maxWidth: '82%', backgroundColor: 'rgba(122,77,255,0.35)', borderRadius: 22, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(200,180,255,0.6)', shadowColor: '#7A4DFF', shadowOpacity: 0.7, shadowRadius: 18 }}>
            {m.attachments?.length ? <Text style={{ color: '#D7CCFF', fontSize: 12, fontWeight: '700', marginBottom: 4 }}>{'▶'} {m.attachments[0].name}</Text> : null}
            <Text style={{ color: '#FFFFFF', fontSize: 16, lineHeight: 22 }}>{m.content}</Text>
          </View></FadeIn>
        ) : (
          <FadeIn key={m.id}><View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 9, backgroundColor: '#D7CCFF', shadowColor: '#B9A6FF', shadowOpacity: 1, shadowRadius: 10 }} />
            <View style={{ flex: 1 }}>
              {m.meta?.deep ? <Text style={{ color: '#B9A6FF', fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 6 }}>SHE THOUGHT HARDER</Text> : null}
              <Text style={{ color: '#FFFFFF', fontSize: 18, lineHeight: 27, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 8 }}>{m.content}</Text>
              {KEPT[i] ? (
                <FadeIn delay={900} pop><View style={{ marginTop: 12, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: KEPT[i].colour + '22', borderWidth: 1, borderColor: KEPT[i].colour + 'AA', shadowColor: KEPT[i].colour, shadowOpacity: 0.8, shadowRadius: 14 }}>
                  <Text style={{ color: KEPT[i].colour, fontSize: 13 }}>{'✦'}</Text>
                  <Text style={{ color: '#FFFFFF', fontSize: 12.5, flexShrink: 1 }}><Text style={{ fontWeight: '800' }}>New memory</Text> {KEPT[i].text} <Text style={{ color: KEPT[i].colour, fontWeight: '700' }}>{'→'} {KEPT[i].part}</Text></Text>
                </View></FadeIn>
              ) : null}
            </View>
          </View></FadeIn>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 12, borderRadius: 999, paddingVertical: 8, paddingLeft: 20, paddingRight: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(214,200,255,0.45)' }}>
        <Text style={{ flex: 1, color: 'rgba(255,255,255,0.6)', fontSize: 16 }}>Tell her anything...</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Talk out loud" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#B9A6FF', alignItems: 'center', justifyContent: 'center', shadowColor: '#B9A6FF', shadowOpacity: 1, shadowRadius: 16 }}>
          <Text style={{ color: '#0C0A24', fontSize: 18, fontWeight: '800' }}>{'●'}</Text>
        </Pressable>
      </View>
      {flights.map((f) => (
        <Flight key={f.key} colour={f.colour} from={{ x: 58, y: 40 }} to={{ x: width / 2, y: height - 30 }} />
      ))}
    </SafeAreaView>
  );
}

// A handful of her dots peel off her head and drift down to Her brain in the tab bar, in the colour of
// the part the memory went to.
function Flight({ colour, from, to }: { colour: string; from: { x: number; y: number }; to: { x: number; y: number } }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(); }, [v]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      {Array.from({ length: 9 }).map((_, i) => {
        const bend = (i - 4) * 18;
        const lag = i * 0.04;
        const p = v.interpolate({ inputRange: [0, lag, Math.min(1, 0.7 + lag), 1], outputRange: [0, 0, 0.85, 1], extrapolate: 'clamp' });
        const x = p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [from.x + (i % 3) * 6, (from.x + to.x) / 2 + 90 + bend, to.x] });
        const y = p.interpolate({ inputRange: [0, 1], outputRange: [from.y + Math.floor(i / 3) * 6, to.y] });
        const o = v.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] });
        const sz = 5 + (i % 3);
        return (
          <Animated.View key={i} style={{ position: 'absolute', width: sz, height: sz, opacity: o, transform: [{ translateX: x }, { translateY: y }] }}>
            <View style={{ position: 'absolute', width: sz * 3, height: sz * 3, left: -sz, top: -sz, borderRadius: sz * 1.5, backgroundColor: colour, opacity: 0.25 }} />
            <View style={{ width: sz, height: sz, borderRadius: sz / 2, backgroundColor: colour }} />
            <View style={{ position: 'absolute', width: sz * 0.5, height: sz * 0.5, left: sz * 0.25, top: sz * 0.25, borderRadius: sz, backgroundColor: '#FFFFFF' }} />
          </Animated.View>
        );
      })}
    </View>
  );
}

function FadeIn({ children, delay = 0, pop }: { children: React.ReactNode; delay?: number; pop?: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 650, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, [v, delay]);
  const y = v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const sc = v.interpolate({ inputRange: [0, 1], outputRange: [pop ? 0.6 : 1, 1] });
  return <Animated.View style={{ opacity: v, transform: [{ translateY: y }, { scale: sc }] }}>{children}</Animated.View>;
}
