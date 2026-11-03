// Root layout. Owns the auth gate with Expo Router's protected routes:
//   signed out                -> (auth) sign in / sign up
//   signed in, not onboarded  -> onboarding
//   signed in, onboarded      -> (app) tabs
//   opened a reset link       -> reset-password, until they set a new one
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/lib/auth';
import { Loading } from '@/components/ui';
import { colours } from '@/constants/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { isLoading, session, profile, profileReady, recovering } = useAuth();
  // Wait for the signed-in user's profile too, or onboarding flashes up for a moment after sign in.
  if (isLoading || !profileReady) return <Loading />;

  const signedIn = !!session;
  const onboarded = !!profile?.onboarded_at;

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
    </Stack>
  );
}
