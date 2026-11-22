// FIX (23 Nov 2026, Taj's iPhone showed "Unmatched Route"). Since Expo SDK 58, a signed out visit to
// "/" is sent to the (auth) group, and the group had no index screen, so the router had nowhere to
// land. This sends it on to sign in.
import { Redirect } from 'expo-router';

export default function AuthIndex() {
  return <Redirect href="/sign-in" />;
}
