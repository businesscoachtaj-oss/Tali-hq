// 9 Nov 2026 "life with a growing brain": Your world. Everything in your life Tali helps with, grouped
// the way a life is (people, work, health, growth, your words), instead of a list of app features.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { myCredits, type Credits } from '@/lib/data';
import { isPaid, isPro } from '@/lib/plan';
import { Screen } from '@/components/ui';
import { SkinHeader } from '@/components/PageSkin';
import { WorldMap } from '@/components/WorldMap';
import { colours, radius, space } from '@/constants/theme';
import { useHasBusiness } from '@/lib/business';

type Row = { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; sub: string; to: string; locked?: boolean; pro?: boolean };

export default function World() {
  const [credits, setCredits] = useState<Credits | null>(null);
  useFocusEffect(useCallback(() => { myCredits().then(setCredits).catch(() => {}); }, []));
  const paid = isPaid(credits);
  const pro = isPro(credits);
  // 10 Nov 2026: someone who said "No, just me" at sign-up does not get the business tools.
  // Work is their job and their inbox. They can switch the rest on in Settings by adding a business.
  const hasBusiness = useHasBusiness();
  const areas: { title: string; line: string; colour: string; rows: Row[] }[] = [
    { title: 'People', line: hasBusiness ? 'Clients, leads and everyone who matters to you' : 'Family, friends and everyone who matters to you', colour: '#8EF0C8', rows: [
      { icon: 'people-outline', title: 'Your people', sub: hasBusiness ? 'Clients, leads, family and friends' : 'Family, friends and the people you mention', to: '/clients' },
    ] },
    ...(hasBusiness ? [
    { title: 'Work', line: 'The business, handled', colour: '#9FB7FF', rows: [
      { icon: 'mail-outline', title: 'Email', sub: 'Sorted, replies drafted', to: '/inbox', locked: !paid },
      { icon: 'document-text-outline', title: 'Invoices', sub: 'Make, share, track', to: '/invoices', locked: !paid },
      { icon: 'wallet-outline', title: 'Money', sub: 'In, owed and runway', to: '/money', locked: !paid },
      { icon: 'file-tray-full-outline', title: 'Receipts', sub: 'Ready for tax time', to: '/receipts', locked: !paid },
      { icon: 'flash-outline', title: 'Rules', sub: 'What she does on her own', to: '/rules', locked: !pro, pro: true },
    ] as Row[] },
    ] : [
    { title: 'Work', line: 'Your job, your inbox, your money', colour: '#9FB7FF', rows: [
      { icon: 'mail-outline', title: 'Email', sub: 'Sorted, replies drafted', to: '/inbox', locked: !paid },
      { icon: 'wallet-outline', title: 'Money', sub: 'What comes in and what goes out', to: '/money', locked: !paid },
      { icon: 'briefcase-outline', title: 'Run a business?', sub: 'Add it in Settings for invoices, clients and receipts', to: '/settings' },
    ] as Row[] },
    ]),
    { title: 'Health', line: 'Body, food and sleep', colour: '#FF9EC4', rows: [
      { icon: 'barbell-outline', title: 'Food and training', sub: 'Logged by chatting', to: '/life' },
      { icon: 'bed-outline', title: 'Sleep', sub: 'Sounds with a timer', to: '/sleep' },
    ] },
    { title: 'Growth', line: 'Where you are heading, and how', colour: '#FFE38A', rows: [
      { icon: 'flag-outline', title: 'Goals', sub: "What you're chasing", to: '/goals', locked: !paid },
      { icon: 'calendar-outline', title: 'Weekly review', sub: "What moved and what's next", to: '/review', locked: !paid },
      { icon: 'git-branch-outline', title: 'Decisions', sub: 'What you decided and why', to: '/decisions' },
      { icon: 'moon-outline', title: 'Shut down', sub: 'Two minutes, then off', to: '/shutdown' },
    ] },
    { title: 'Your words', line: 'What you write, she learns from', colour: '#D7B5FF', rows: [
      { icon: 'book-outline', title: 'Journal and notes', sub: 'Private unless you share', to: '/journal' },
      { icon: 'school-outline', title: 'Night school', sub: 'What she studies for you tonight', to: '/night-school', locked: !pro, pro: true },
    ] },
  ];
  return (
    <Screen>
      <SkinHeader id="brain" title="Your world" sub="Everything she looks after, as she sees it. Each star is something she knows. Tap a part of your life to step into it." />
      <View style={{ marginHorizontal: -space.lg }}>
        <WorldMap />
      </View>
      <Text style={{ color: colours.muted, fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: space.md }}>EVERYTHING, AS A LIST</Text>
      {areas.map((a) => (
        <View key={a.title} style={{ marginBottom: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: a.colour, shadowColor: a.colour, shadowOpacity: 1, shadowRadius: 8 }} />
            <Text style={{ color: colours.text, fontSize: 28, fontFamily: 'InstrumentSerif_400Regular' }}>{a.title}</Text>
          </View>
          <Text style={{ color: colours.muted, fontSize: 13.5, marginBottom: 10 }}>{a.line}</Text>
          <View style={{ backgroundColor: a.colour + '22', borderRadius: radius.card, borderWidth: 1, borderColor: a.colour + '80', overflow: 'hidden', shadowColor: a.colour, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } }}>
            {a.rows.map((r, i) => (
              <Pressable key={r.title} onPress={() => router.navigate(r.to as any)} accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14, paddingHorizontal: space.lg, borderTopWidth: i ? 1 : 0, borderTopColor: a.colour + '40' }}>
                <Ionicons name={r.icon} size={21} color={a.colour} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colours.text, fontSize: 16, fontWeight: '600' }}>{r.title}</Text>
                  <Text style={{ color: colours.muted, fontSize: 13, marginTop: 1 }}>{r.sub}</Text>
                </View>
                {r.locked ? <Text style={{ fontSize: 11, fontWeight: '700', color: colours.purpleInk }}>{r.pro ? 'Pro' : 'HQ'}</Text> : null}
                <Ionicons name="chevron-forward" size={18} color={colours.faint} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}
