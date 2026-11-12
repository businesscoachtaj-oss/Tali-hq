import { useRef } from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { registerTab } from '@/lib/tourTabPositions';
import { colours, elevation } from '@/constants/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// Each icon registers itself so the first-run tour can ring the right tab.
function TabIcon({ name, color, size, index }: { name: IconName; color: string; size: number; index: number }) {
  const ref = useRef<View>(null);
  return (
    <View ref={ref} onLayout={() => registerTab(index, ref)}>
      <Ionicons name={name} color={color} size={size} />
    </View>
  );
}

function icon(name: IconName, index: number) {
  return ({ color, size }: { color: string; size: number }) => <TabIcon name={name} color={color} size={size} index={index} />;
}

export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colours.purple,
        tabBarInactiveTintColor: colours.faint,
        tabBarStyle: { backgroundColor: '#0D0B22', borderTopColor: colours.border, ...elevation.tabBar },
        sceneStyle: { backgroundColor: colours.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('sunny-outline', 0) }} />
      <Tabs.Screen name="talk" options={{ title: 'Talk', tabBarIcon: icon('chatbubble-ellipses-outline', 1) }} />
      {/* 9 Nov 2026 look refresh: her brain gets a tab of its own, in the middle. Clients moves into Me. */}
      <Tabs.Screen name="brain" options={{ title: 'Her brain', tabBarIcon: icon('sparkles-outline', 2) }} />
      <Tabs.Screen name="world" options={{ title: 'Your world', tabBarIcon: icon('planet-outline', 3) }} />
      <Tabs.Screen name="journal" options={{ href: null, title: 'Journal' }} />
      <Tabs.Screen name="notes" options={{ href: null, title: 'Notes' }} />
      <Tabs.Screen name="me" options={{ title: 'Me', tabBarIcon: icon('person-circle-outline', 4) }} />
      <Tabs.Screen name="settings" options={{ href: null, title: 'Settings' }} />
      <Tabs.Screen name="plans" options={{ href: null, title: 'Plans' }} />
      <Tabs.Screen name="invoices" options={{ href: null, title: 'Invoices' }} />
      <Tabs.Screen name="rules" options={{ href: null, title: 'Rules' }} />
      <Tabs.Screen name="inbox" options={{ href: null, title: 'Tali email' }} />
      <Tabs.Screen name="night-school" options={{ href: null, title: 'Night school' }} />
      <Tabs.Screen name="library" options={{ href: null, title: "Tali's library" }} />
      <Tabs.Screen name="life" options={{ href: null, title: 'Food and training' }} />
      <Tabs.Screen name="founder" options={{ href: null, title: 'Founder' }} />
      <Tabs.Screen name="founder-users" options={{ href: null, title: 'Users' }} />
      <Tabs.Screen name="sleep" options={{ href: null, title: 'Sleep' }} />
      <Tabs.Screen name="clients" options={{ href: null, title: 'Clients' }} />
      <Tabs.Screen name="brain-card" options={{ href: null, title: 'Share her brain' }} />
      <Tabs.Screen name="brain-ai" options={{ href: null, title: 'How Tali thinks' }} />
      <Tabs.Screen name="shutdown" options={{ href: null, title: 'Shut the day down' }} />
      <Tabs.Screen name="review" options={{ href: null, title: 'Weekly review' }} />
      <Tabs.Screen name="goals" options={{ href: null, title: 'Goals' }} />
      <Tabs.Screen name="money" options={{ href: null, title: 'Money' }} />
      <Tabs.Screen name="receipts" options={{ href: null, title: 'Receipts' }} />
      <Tabs.Screen name="top-up" options={{ href: null, title: 'Top up' }} />
      <Tabs.Screen name="person" options={{ href: null, title: 'Person' }} />
      <Tabs.Screen name="decisions" options={{ href: null, title: 'Decisions' }} />
      {/* 11 Nov 2026: Your world, filled in. One screen for the new lists, plus Body, Headspace and Dates. */}
      <Tabs.Screen name="list" options={{ href: null, title: 'List' }} />
      <Tabs.Screen name="body" options={{ href: null, title: 'Body' }} />
      <Tabs.Screen name="headspace" options={{ href: null, title: 'Headspace' }} />
      <Tabs.Screen name="dates" options={{ href: null, title: 'Dates that matter' }} />
      {/* 12 Nov 2026 (Taj): the business tools. */}
      <Tabs.Screen name="jobs" options={{ href: null, title: 'Jobs and quotes' }} />
      <Tabs.Screen name="mock" options={{ href: null, title: 'Mockup' }} />
      <Tabs.Screen name="pipeline" options={{ href: null, title: 'Pipeline' }} />
      <Tabs.Screen name="bookings" options={{ href: null, title: 'Bookings' }} />
      <Tabs.Screen name="projects" options={{ href: null, title: 'Projects' }} />
      <Tabs.Screen name="website" options={{ href: null, title: 'Website' }} />
      <Tabs.Screen name="autopilot" options={{ href: null, title: 'On autopilot' }} />
      <Tabs.Screen name="quote-calc" options={{ href: null, title: 'Quote calculator' }} />
      <Tabs.Screen name="books" options={{ href: null, title: 'Bookkeeping pack' }} />
    </Tabs>
  );
}
