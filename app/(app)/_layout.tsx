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
        tabBarStyle: { backgroundColor: colours.surface, borderTopColor: colours.border, ...elevation.tabBar },
        sceneStyle: { backgroundColor: colours.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('sunny-outline', 0) }} />
      <Tabs.Screen name="talk" options={{ title: 'Talk', tabBarIcon: icon('chatbubble-ellipses-outline', 1) }} />
      <Tabs.Screen name="clients" options={{ title: 'Clients', tabBarIcon: icon('people-outline', 2) }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal', tabBarIcon: icon('book-outline', 3) }} />
      <Tabs.Screen name="me" options={{ title: 'Me', tabBarIcon: icon('person-circle-outline', 4) }} />
      <Tabs.Screen name="settings" options={{ href: null, title: 'Settings' }} />
      <Tabs.Screen name="plans" options={{ href: null, title: 'Plans' }} />
      <Tabs.Screen name="invoices" options={{ href: null, title: 'Invoices' }} />
      <Tabs.Screen name="rules" options={{ href: null, title: 'Rules' }} />
      <Tabs.Screen name="inbox" options={{ href: null, title: 'Tali email' }} />
      <Tabs.Screen name="night-school" options={{ href: null, title: 'Night school' }} />
      <Tabs.Screen name="life" options={{ href: null, title: 'Food and training' }} />
      <Tabs.Screen name="founder" options={{ href: null, title: 'Founder' }} />
      <Tabs.Screen name="founder-users" options={{ href: null, title: 'Users' }} />
      <Tabs.Screen name="sleep" options={{ href: null, title: 'Sleep' }} />
      <Tabs.Screen name="brain" options={{ href: null, title: "Tali's brain" }} />
      <Tabs.Screen name="shutdown" options={{ href: null, title: 'Shut the day down' }} />
      <Tabs.Screen name="review" options={{ href: null, title: 'Weekly review' }} />
      <Tabs.Screen name="goals" options={{ href: null, title: 'Goals' }} />
      <Tabs.Screen name="money" options={{ href: null, title: 'Money' }} />
      <Tabs.Screen name="receipts" options={{ href: null, title: 'Receipts' }} />
      <Tabs.Screen name="top-up" options={{ href: null, title: 'Top up' }} />
      <Tabs.Screen name="person" options={{ href: null, title: 'Person' }} />
      <Tabs.Screen name="decisions" options={{ href: null, title: 'Decisions' }} />
    </Tabs>
  );
}
