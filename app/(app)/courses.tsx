// Everything to learn (28 Nov 2026): the lesson library by category. Tali writes a new lesson in every
// category each night, so there is always more here than anyone has done.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ErrorText, Screen, goBack } from '@/components/ui';
import { PHeader, kicker, pathHref, serif } from '@/components/Learned';
import { learnHome, type LearnHome } from '@/lib/learn';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { colours, space } from '@/constants/theme';

export default function Courses() {
  const [home, setHome] = useState<LearnHome | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setHome(await learnHome()); setError(''); } catch (e: any) { setError(e?.message ?? 'Could not load the library.'); }
  }, []);
  useFocusLoad(load);
  const mine = new Set((home?.paths ?? []).map((p) => p.id));
  return (
    <Screen onRefresh={load}>
      <PHeader kick="THE LESSON LIBRARY" title="Everything to learn" sub="Ten areas, a new lesson in each one every night. Start anything, one lesson a day." onBack={() => goBack('/learn')} backLabel="Learn" />
      {error ? <ErrorText>{error}</ErrorText> : null}
      {home === null ? <Text style={{ color: colours.faint }}>Loading...</Text> : null}
      {(home?.categories ?? []).map((c) => (
        <View key={c.id} style={{ marginTop: space.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colours.ink }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.colour }} />
            <Text style={{ flex: 1, color: colours.text, fontSize: 25, fontFamily: serif }}>{c.name}</Text>
          </View>
          <Text style={{ color: colours.muted, fontSize: 13.5, marginTop: 6 }}>{c.line}</Text>
          {c.courses.length ? c.courses.map((k, i) => (
            <Pressable key={k.id} onPress={() => router.navigate(pathHref(k.id))} accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: i === c.courses.length - 1 ? 0 : 1, borderBottomColor: colours.border }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colours.text, fontSize: 18, fontFamily: serif }}>{k.title}</Text>
                {k.line ? <Text style={{ color: colours.muted, fontSize: 13, marginTop: 1 }}>{k.line}</Text> : null}
              </View>
              {mine.has(k.id) ? <Text style={[kicker, { color: c.colour, fontSize: 10 }]}>ON IT</Text> : <Text style={{ color: colours.faint, fontSize: 12.5 }}>{k.live} of {k.planned}</Text>}
              <Ionicons name="chevron-forward" size={17} color={colours.faint} />
            </Pressable>
          )) : <Text style={{ color: colours.faint, fontSize: 13.5, paddingVertical: 10 }}>Tali is writing the first one tonight.</Text>}
        </View>
      ))}
      <View style={{ height: space.xxl }} />
    </Screen>
  );
}
