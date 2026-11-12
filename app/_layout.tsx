// Root layout. Owns the auth gate with Expo Router's protected routes:
//   signed out                -> (auth) sign in / sign up
//   signed in, not onboarded  -> onboarding
//   signed in, onboarded      -> (app) tabs
//   opened a reset link       -> reset-password, until they set a new one
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/lib/auth';
import { Loading } from '@/components/ui';
import { customHost, DomainSite } from '@/components/DomainSite';
import { colours } from '@/constants/theme';
import { useFonts, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import { Literata_400Regular, Literata_400Regular_Italic, Literata_600SemiBold } from '@expo-google-fonts/literata';

// Where a tapped push goes (4 Nov 2026). Pushes carry data.url ('/', '/inbox', ...), the same shape
// the web service worker (public/sw.js) opens. Phone builds land here instead.
const PUSH_ROUTES = ['/', '/inbox'];
let lastHandled: string | null = null;
function openPushUrl(r: Notifications.NotificationResponse | null) {
  if (!r || r.notification.request.identifier === lastHandled) return;
  lastHandled = r.notification.request.identifier;
  const url = (r.notification.request.content.data as { url?: unknown } | null)?.url;
  if (typeof url !== 'string') return;
  if (PUSH_ROUTES.includes(url)) router.navigate(url as any);
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { isLoading, session, profile, profileReady, recovering } = useAuth();
  const signedIn = !!session;
  const onboarded = !!profile?.onboarded_at;
  const ready = !isLoading && profileReady && signedIn && !recovering && onboarded;

  // Notification taps on phone builds: route by data.url once the app screens are available.
  useEffect(() => {
    if (Platform.OS === 'web' || !ready) return;
    const sub = Notifications.addNotificationResponseReceivedListener(openPushUrl);
    Notifications.getLastNotificationResponseAsync().then(openPushUrl).catch(() => {});
    return () => sub.remove();
  }, [ready]);

  // Wait for the signed-in user's profile too, or onboarding flashes up for a moment after sign in.
  const [fontsReady] = useFonts({ PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold, InstrumentSerif_400Regular, Literata_400Regular, Literata_400Regular_Italic, Literata_600SemiBold });
  if (isLoading || !profileReady || !fontsReady) return <Loading />;

  // 12 Nov 2026: opened on somebody's own domain. Show their site, not the app.
  const ownDomain = customHost();
  if (ownDomain) return <DomainSite host={ownDomain} />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colours.bg } }}>
      <Stack.Protected guard={signedIn && recovering}>
        <Stack.Screen name="reset-password" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !recovering && !onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !recovering && onboarded}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      {/* 12 Nov 2026: the public booking page, the public website and the public quote calculator. Anyone with the link can open them,
          signed in or not. FIX (12 Nov 2026): these sit LAST. The first screen in this list is where a
          signed-out visitor lands, and with these two first, opening talihq.com.au signed out went to an
          empty booking page instead of sign in. */}
      <Stack.Screen name="book/[slug]" />
      <Stack.Screen name="site/[slug]" />
      <Stack.Screen name="quote/[slug]" />
    </Stack>
  );
}
