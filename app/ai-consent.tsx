// app/ai-consent.tsx (22 Nov 2026): the "Tali and your data" yes, shown once after sign in and
// before onboarding or the app (see app/_layout.tsx). App Review guidelines 5.1.1(i) and 5.1.2(i).
import { Screen } from '@/components/ui';
import { AiConsent } from '@/components/AiConsent';

export default function AiConsentGate() {
  // The root layout moves on by itself once the profile has a yes or "Not now" is saved.
  return (
    <Screen>
      <AiConsent gate onDone={() => {}} />
    </Screen>
  );
}
