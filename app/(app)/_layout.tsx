import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { registerTab } from '@/lib/tourTabPositions';
import { colours, elevation } from '@/constants/theme';
import { HIDDEN_TAB } from '@/lib/hiddenTab';
import { useWide, withWideTabs } from '@/lib/wideWeb';
import { WideSideBrand } from '@/components/WideSideBrand';
import type { ColorValue, ViewInstance } from 'react-native';
import { useAuth } from '@/lib/auth';
import { syncGames } from '@/games/lib/cloud';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// Each icon registers itself so the first-run tour can ring the right tab.
// 23 Nov 2026 (paper and ink, from the approved mockups): on a phone the tabs are words in small caps
// with an indigo dot over the one you are on. On a PC side menu the icons stay, they help there.
function TabIcon({ name, color, size, index, focused, wide }: { name: IconName; color: string; size: number; index: number; focused: boolean; wide: boolean }) {
  const ref = useRef<ViewInstance>(null);
  return (
    <View ref={ref} onLayout={() => registerTab(index, ref)} style={wide ? undefined : { height: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
      {wide ? <Ionicons name={name} color={color} size={size} /> : <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: focused ? colours.purple : 'transparent' }} />}
    </View>
  );
}

function makeIcon(wide: boolean) {
  return function icon(name: IconName, index: number) {
    function TabBarIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
      return <TabIcon name={name} color={color as string} size={size} index={index} focused={focused} wide={wide} />;
    }
    return TabBarIcon;
  };
}

export default function AppTabs() {
  // 22 Nov 2026: on a PC the tabs become a side menu with Learnéd's name and Tali (lib/wideWeb.ts).
  const wide = useWide();
  const icon = makeIcon(wide);
  // 28 Nov 2026 (Learnéd): the brain games' results follow you to every device.
  const { session, profile } = useAuth();
  useEffect(() => {
    if (session?.user.id) syncGames(session.user.id, profile?.first_name ?? null);
  }, [session?.user.id, profile?.first_name]);
  return (
    <>
    <Tabs
      screenOptions={withWideTabs(wide, {
        headerShown: false,
        tabBarInactiveTintColor: colours.faint,
        tabBarStyle: { backgroundColor: colours.bg, borderTopColor: colours.ink, borderTopWidth: 1 },
        tabBarLabelStyle: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
        tabBarActiveTintColor: colours.ink,
        sceneStyle: { backgroundColor: colours.bg },
        // Speed pass (13 Nov 2026): screens you've left stop re-rendering until you come back.
        // Every tab you visit stays mounted, so before this each one re-rendered on every app change.
        freezeOnBlur: true,
      })}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('sunny-outline', 0) }} />
      <Tabs.Screen name="talk" options={{ title: 'Talk', tabBarIcon: icon('chatbubble-ellipses-outline', 1) }} />
      {/* Learnéd (28 Nov 2026, Taj): Learn gets a tab of its own, next to Talk. */}
      <Tabs.Screen name="learn" options={{ title: 'Learn', tabBarIcon: icon('school-outline', 2) }} />
      {/* 9 Nov 2026 look refresh: her brain gets a tab of its own, in the middle. Clients moves into Me. */}
      <Tabs.Screen name="brain" options={{ title: 'Her brain', tabBarIcon: icon('sparkles-outline', 3) }} />
      <Tabs.Screen name="world" options={{ title: 'Your life', tabBarIcon: icon('planet-outline', 4) }} />
      <Tabs.Screen name="path" options={{ ...HIDDEN_TAB, title: 'Path' }} />
      <Tabs.Screen name="lesson" options={{ ...HIDDEN_TAB, title: 'Lesson' }} />
      <Tabs.Screen name="game" options={{ ...HIDDEN_TAB, title: 'Game' }} />
      <Tabs.Screen name="reminders" options={{ ...HIDDEN_TAB, title: 'Reminders' }} />
      <Tabs.Screen name="courses" options={{ ...HIDDEN_TAB, title: 'Everything to learn' }} />
      <Tabs.Screen name="games" options={{ ...HIDDEN_TAB, title: 'Brain games' }} />
      <Tabs.Screen name="journal" options={{ ...HIDDEN_TAB, title: 'Journal' }} />
      <Tabs.Screen name="time" options={{ ...HIDDEN_TAB, title: 'Your time' }} />
      <Tabs.Screen name="philosophy" options={{ ...HIDDEN_TAB, title: 'Your philosophy' }} />
      <Tabs.Screen name="notes" options={{ ...HIDDEN_TAB, title: 'Notes' }} />
      <Tabs.Screen name="me" options={{ title: 'Me', tabBarIcon: icon('person-circle-outline', 5) }} />
      <Tabs.Screen name="settings" options={{ ...HIDDEN_TAB, title: 'Settings' }} />
      <Tabs.Screen name="ai-data" options={{ ...HIDDEN_TAB, title: 'Tali and your data' }} />
      <Tabs.Screen name="home-edit" options={{ ...HIDDEN_TAB, title: 'Edit home' }} />
      <Tabs.Screen name="tracker" options={{ ...HIDDEN_TAB, title: 'Tracker' }} />
      <Tabs.Screen name="team-home" options={{ ...HIDDEN_TAB, title: 'Team layout' }} />
      <Tabs.Screen name="widget-new" options={{ ...HIDDEN_TAB, title: 'Make a tracker' }} />
      <Tabs.Screen name="home-share" options={{ ...HIDDEN_TAB, title: 'Share your layout' }} />
      <Tabs.Screen name="plans" options={{ ...HIDDEN_TAB, title: 'Plans' }} />
      <Tabs.Screen name="invoices" options={{ ...HIDDEN_TAB, title: 'Invoices' }} />
      <Tabs.Screen name="rules" options={{ ...HIDDEN_TAB, title: 'Rules' }} />
      <Tabs.Screen name="inbox" options={{ ...HIDDEN_TAB, title: 'Tali email' }} />
      <Tabs.Screen name="night-school" options={{ ...HIDDEN_TAB, title: 'Night school' }} />
      <Tabs.Screen name="library" options={{ ...HIDDEN_TAB, title: "Tali's library" }} />
      <Tabs.Screen name="life" options={{ ...HIDDEN_TAB, title: 'Food and training' }} />
      <Tabs.Screen name="founder" options={{ ...HIDDEN_TAB, title: 'Founder' }} />
      <Tabs.Screen name="founder-users" options={{ ...HIDDEN_TAB, title: 'Users' }} />
      <Tabs.Screen name="sleep" options={{ ...HIDDEN_TAB, title: 'Sleep' }} />
      <Tabs.Screen name="clients" options={{ ...HIDDEN_TAB, title: 'Clients' }} />
      <Tabs.Screen name="brain-card" options={{ ...HIDDEN_TAB, title: 'Share her brain' }} />
      <Tabs.Screen name="brain-ai" options={{ ...HIDDEN_TAB, title: 'How Tali thinks' }} />
      <Tabs.Screen name="shutdown" options={{ ...HIDDEN_TAB, title: 'Shut the day down' }} />
      <Tabs.Screen name="review" options={{ ...HIDDEN_TAB, title: 'Weekly review' }} />
      <Tabs.Screen name="goals" options={{ ...HIDDEN_TAB, title: 'Goals' }} />
      <Tabs.Screen name="money" options={{ ...HIDDEN_TAB, title: 'Money' }} />
      <Tabs.Screen name="receipts" options={{ ...HIDDEN_TAB, title: 'Receipts' }} />
      <Tabs.Screen name="top-up" options={{ ...HIDDEN_TAB, title: 'Top up' }} />
      <Tabs.Screen name="person" options={{ ...HIDDEN_TAB, title: 'Person' }} />
      <Tabs.Screen name="decisions" options={{ ...HIDDEN_TAB, title: 'Decisions' }} />
      {/* 11 Nov 2026: Your world, filled in. One screen for the new lists, plus Body, Headspace and Dates. */}
      <Tabs.Screen name="list" options={{ ...HIDDEN_TAB, title: 'List' }} />
      <Tabs.Screen name="body" options={{ ...HIDDEN_TAB, title: 'Body' }} />
      <Tabs.Screen name="headspace" options={{ ...HIDDEN_TAB, title: 'Headspace' }} />
      <Tabs.Screen name="dates" options={{ ...HIDDEN_TAB, title: 'Dates that matter' }} />
      {/* 12 Nov 2026 (Taj): the business tools. */}
      <Tabs.Screen name="jobs" options={{ ...HIDDEN_TAB, title: 'Jobs and quotes' }} />
      <Tabs.Screen name="pipeline" options={{ ...HIDDEN_TAB, title: 'Pipeline' }} />
      <Tabs.Screen name="bookings" options={{ ...HIDDEN_TAB, title: 'Bookings' }} />
      <Tabs.Screen name="projects" options={{ ...HIDDEN_TAB, title: 'Projects' }} />
      <Tabs.Screen name="team" options={{ ...HIDDEN_TAB, title: 'Your team' }} />
      <Tabs.Screen name="work" options={{ ...HIDDEN_TAB, title: 'Work given to you' }} />
      <Tabs.Screen name="businesses" options={{ ...HIDDEN_TAB, title: 'Which business?' }} />
      <Tabs.Screen name="website" options={{ ...HIDDEN_TAB, title: 'Website' }} />
      <Tabs.Screen name="autopilot" options={{ ...HIDDEN_TAB, title: 'On autopilot' }} />
      <Tabs.Screen name="quote-calc" options={{ ...HIDDEN_TAB, title: 'Quote calculator' }} />
      <Tabs.Screen name="books" options={{ ...HIDDEN_TAB, title: 'Bookkeeping pack' }} />
    </Tabs>
    {wide ? <WideSideBrand /> : null}
    </>
  );
}
