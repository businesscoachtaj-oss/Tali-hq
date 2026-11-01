import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colours } from '@/constants/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function icon(name: IconName) {
  return ({ color, size }: { color: string; size: number }) => <Ionicons name={name} color={color} size={size} />;
}

export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colours.purple,
        tabBarInactiveTintColor: colours.faint,
        tabBarStyle: { backgroundColor: colours.surface, borderTopColor: colours.border },
        sceneStyle: { backgroundColor: colours.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('sunny-outline') }} />
      <Tabs.Screen name="talk" options={{ title: 'Talk', tabBarIcon: icon('chatbubble-ellipses-outline') }} />
      <Tabs.Screen name="clients" options={{ title: 'Clients', tabBarIcon: icon('people-outline') }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal', tabBarIcon: icon('book-outline') }} />
      <Tabs.Screen name="me" options={{ title: 'Me', tabBarIcon: icon('person-circle-outline') }} />
      <Tabs.Screen name="settings" options={{ href: null, title: 'Settings' }} />
      <Tabs.Screen name="plans" options={{ href: null, title: 'Plans' }} />
      <Tabs.Screen name="invoices" options={{ href: null, title: 'Invoices' }} />
      <Tabs.Screen name="rules" options={{ href: null, title: 'Rules' }} />
      <Tabs.Screen name="inbox" options={{ href: null, title: 'Tali email' }} />
      <Tabs.Screen name="night-school" options={{ href: null, title: 'Night school' }} />
      <Tabs.Screen name="life" options={{ href: null, title: 'Food and training' }} />
    </Tabs>
  );
}
